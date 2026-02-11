import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  envName: string;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  remindersTable: dynamodb.Table;
  locationQueue: sqs.Queue;
  notificationTopic: sns.Topic;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly apiUrl: string;
  public readonly lambdaFunctions: lambda.Function[];

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { envName, userPool, userPoolClient, remindersTable, locationQueue, notificationTopic } = props;

    this.lambdaFunctions = [];

    // Common Lambda environment variables
    const commonEnv = {
      ENV: envName,
      TABLE_NAME: remindersTable.tableName,
      QUEUE_URL: locationQueue.queueUrl,
      TOPIC_ARN: notificationTopic.topicArn,
      USER_POOL_ID: userPool.userPoolId,
      REGION: cdk.Stack.of(this).region,
      LOG_LEVEL: envName === 'prod' ? 'INFO' : 'DEBUG',
    };

    // Lambda Layer for shared dependencies (optional, for now inline)
    // In production, create a layer with common libs

    // API Lambda Function (FastAPI via Mangum)
    const apiLambda = new lambda.Function(this, 'ApiFunction', {
      functionName: `reminder-app-${envName}-api`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handlers.api_handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_11.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au src/. /asset-output',
          ],
        },
      }),
      environment: commonEnv,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
    });

    // Evaluator Lambda Function (processes location events with enhanced features)
    const evaluatorLambda = new lambda.Function(this, 'EvaluatorFunction', {
      functionName: `reminder-app-${envName}-evaluator`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handlers.evaluator_handler_enhanced.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_11.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au src/. /asset-output',
          ],
        },
      }),
      environment: commonEnv,
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK,
      reservedConcurrentExecutions: envName === 'prod' ? 10 : undefined,
      tracing: lambda.Tracing.ACTIVE,
    });

    this.lambdaFunctions.push(apiLambda, evaluatorLambda);

    // Grant permissions
    remindersTable.grantReadWriteData(apiLambda);
    remindersTable.grantReadData(evaluatorLambda);
    locationQueue.grantSendMessages(apiLambda);
    notificationTopic.grantPublish(evaluatorLambda);

    // SSM Parameter access for OpenAI API key
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter/reminder-app/${envName}/openai-api-key`,
      ],
    }));

    // SQS Event Source for Evaluator
    evaluatorLambda.addEventSource(new lambdaEventSources.SqsEventSource(locationQueue, {
      batchSize: 10,
      maxBatchingWindow: cdk.Duration.seconds(10),
      reportBatchItemFailures: true,
    }));

    // API Gateway
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `reminder-app-${envName}`,
      description: `Reminder App API (${envName})`,
      deployOptions: {
        stageName: envName,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: envName !== 'prod',
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: envName === 'prod' 
          ? ['https://CLOUDFRONT_DOMAIN_HERE'] // Update after frontend deploy
          : apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: true,
      },
      cloudWatchRole: true,
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: `${envName}-cognito-authorizer`,
      identitySource: 'method.request.header.Authorization',
    });

    // Lambda Integration
    const apiIntegration = new apigateway.LambdaIntegration(apiLambda, {
      proxy: true,
      allowTestInvoke: envName !== 'prod',
    });

    // API Routes (proxy all to FastAPI)
    const apiResource = this.api.root.addResource('{proxy+}');
    apiResource.addMethod('ANY', apiIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Health check endpoint (no auth)
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod('GET', apiIntegration);

    this.apiUrl = this.api.url;

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'API Gateway URL',
      exportName: `${envName}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: `${envName}-ApiId`,
    });
  }
}
