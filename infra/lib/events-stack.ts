import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface EventsStackProps extends cdk.StackProps {
  envName: string;
}

export class EventsStack extends cdk.Stack {
  public readonly locationQueue: sqs.Queue;
  public readonly dlQueue: sqs.Queue;
  public readonly notificationTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    const { envName } = props;

    // Dead Letter Queue for failed location events
    this.dlQueue = new sqs.Queue(this, 'LocationEventsDLQ', {
      queueName: `reminder-app-${envName}-location-events-dlq.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // FIFO Queue for location events (ordered per user)
    this.locationQueue = new sqs.Queue(this, 'LocationEventsQueue', {
      queueName: `reminder-app-${envName}-location-events.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: cdk.Duration.seconds(300), // 5 min for Lambda processing
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: this.dlQueue,
        maxReceiveCount: 3,
      },
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // SNS Topic for reminder notifications
    this.notificationTopic = new sns.Topic(this, 'NotificationTopic', {
      topicName: `reminder-app-${envName}-notifications`,
      displayName: 'Reminder App Notifications',
      fifo: false, // Standard topic for fan-out
      encryption: sns.TopicEncryption.AWS_MANAGED,
    });

    // Outputs
    new cdk.CfnOutput(this, 'LocationQueueUrl', {
      value: this.locationQueue.queueUrl,
      description: 'SQS Location Events Queue URL',
      exportName: `${envName}-LocationQueueUrl`,
    });

    new cdk.CfnOutput(this, 'LocationQueueArn', {
      value: this.locationQueue.queueArn,
      description: 'SQS Location Events Queue ARN',
      exportName: `${envName}-LocationQueueArn`,
    });

    new cdk.CfnOutput(this, 'NotificationTopicArn', {
      value: this.notificationTopic.topicArn,
      description: 'SNS Notification Topic ARN',
      exportName: `${envName}-NotificationTopicArn`,
    });
  }
}
