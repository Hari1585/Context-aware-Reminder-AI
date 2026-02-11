import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  envName: string;
  apiGateway: apigateway.RestApi;
  lambdaFunctions: lambda.Function[];
  remindersTable: dynamodb.Table;
  locationQueue: sqs.Queue;
  dlQueue: sqs.Queue;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { envName, apiGateway, lambdaFunctions, remindersTable, locationQueue, dlQueue } = props;

    // SNS Topic for alarms (optional: add email subscription)
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `reminder-app-${envName}-alarms`,
      displayName: 'Reminder App Alarms',
    });

    // Example: Add email subscription (user must confirm)
    // alarmTopic.addSubscription(new sns_subscriptions.EmailSubscription('[email]'));

    // API Gateway Alarms
    new cloudwatch.Alarm(this, 'ApiHighErrorRate', {
      alarmName: `${envName}-api-high-error-rate`,
      metric: apiGateway.metricServerError({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    new cloudwatch.Alarm(this, 'ApiHighLatency', {
      alarmName: `${envName}-api-high-latency`,
      metric: apiGateway.metricLatency({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 2000, // 2 seconds
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // Lambda Alarms
    lambdaFunctions.forEach((fn, idx) => {
      new cloudwatch.Alarm(this, `Lambda${idx}Errors`, {
        alarmName: `${envName}-${fn.functionName}-errors`,
        metric: fn.metricErrors({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      }).addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

      new cloudwatch.Alarm(this, `Lambda${idx}Throttles`, {
        alarmName: `${envName}-${fn.functionName}-throttles`,
        metric: fn.metricThrottles({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      }).addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));
    });

    // DLQ Alarm
    new cloudwatch.Alarm(this, 'DLQMessages', {
      alarmName: `${envName}-dlq-messages`,
      metric: dlQueue.metricApproximateNumberOfMessagesVisible({
        statistic: 'Maximum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // Outputs
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: alarmTopic.topicArn,
      description: 'SNS Topic for CloudWatch Alarms',
    });
  }
}
