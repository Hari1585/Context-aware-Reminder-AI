#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { EventsStack } from '../lib/events-stack';
import { ApiStack } from '../lib/api-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

// Get environment from context (default to dev)
const env = app.node.tryGetContext('env') || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

if (!account) {
  throw new Error('AWS account not found. Set CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID');
}

const stackProps: cdk.StackProps = {
  env: { account, region },
  tags: {
    Environment: env,
    Application: 'reminder-app',
    ManagedBy: 'CDK',
  },
};

// Stack naming convention: reminder-app-{env}-{stack-name}
const stackPrefix = `reminder-app-${env}`;

// 1. Auth Stack (Cognito)
const authStack = new AuthStack(app, `${stackPrefix}-auth`, {
  ...stackProps,
  stackName: `${stackPrefix}-auth`,
  description: `Authentication stack for reminder app (${env})`,
  envName: env,
});

// 2. Data Stack (DynamoDB)
const dataStack = new DataStack(app, `${stackPrefix}-data`, {
  ...stackProps,
  stackName: `${stackPrefix}-data`,
  description: `Data storage stack for reminder app (${env})`,
  envName: env,
});

// 3. Events Stack (SQS + SNS)
const eventsStack = new EventsStack(app, `${stackPrefix}-events`, {
  ...stackProps,
  stackName: `${stackPrefix}-events`,
  description: `Event processing stack for reminder app (${env})`,
  envName: env,
});

// 4. API Stack (API Gateway + Lambda)
const apiStack = new ApiStack(app, `${stackPrefix}-api`, {
  ...stackProps,
  stackName: `${stackPrefix}-api`,
  description: `API stack for reminder app (${env})`,
  envName: env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  remindersTable: dataStack.remindersTable,
  locationQueue: eventsStack.locationQueue,
  notificationTopic: eventsStack.notificationTopic,
});

// 5. Frontend Stack (S3 + CloudFront)
const frontendStack = new FrontendStack(app, `${stackPrefix}-frontend`, {
  ...stackProps,
  stackName: `${stackPrefix}-frontend`,
  description: `Frontend hosting stack for reminder app (${env})`,
  envName: env,
  apiUrl: apiStack.apiUrl,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
  cognitoDomain: authStack.cognitoDomain,
});

// 6. Monitoring Stack (CloudWatch Alarms)
const monitoringStack = new MonitoringStack(app, `${stackPrefix}-monitoring`, {
  ...stackProps,
  stackName: `${stackPrefix}-monitoring`,
  description: `Monitoring stack for reminder app (${env})`,
  envName: env,
  apiGateway: apiStack.api,
  lambdaFunctions: apiStack.lambdaFunctions,
  remindersTable: dataStack.remindersTable,
  locationQueue: eventsStack.locationQueue,
  dlQueue: eventsStack.dlQueue,
});

// Stack dependencies
apiStack.addDependency(authStack);
apiStack.addDependency(dataStack);
apiStack.addDependency(eventsStack);
frontendStack.addDependency(apiStack);
monitoringStack.addDependency(apiStack);
monitoringStack.addDependency(eventsStack);

app.synth();
