import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DataStackProps extends cdk.StackProps {
  envName: string;
}

export class DataStack extends cdk.Stack {
  public readonly remindersTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { envName } = props;

    // Single-table design for reminders
    // PK: USER#{userId}  SK: REM#{reminderId}  - User's reminders
    // GSI1: PK: STATUS#{status}  SK: USER#{userId}#REM#{reminderId}  - Active reminders query
    // GSI2: PK: GEO#{geohash}  SK: USER#{userId}#REM#{reminderId}  - Location-based query (optional Phase 3)

    this.remindersTable = new dynamodb.Table(this, 'RemindersTable', {
      tableName: `reminder-app-${envName}-reminders`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: envName === 'prod' 
        ? dynamodb.BillingMode.PROVISIONED 
        : dynamodb.BillingMode.PAY_PER_REQUEST,
      readCapacity: envName === 'prod' ? 5 : undefined,
      writeCapacity: envName === 'prod' ? 5 : undefined,
      removalPolicy: envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: envName === 'prod',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // For future event sourcing
      timeToLiveAttribute: 'ttl', // For auto-cleanup of old reminders
    });

    // GSI1: Query active reminders across all users (for evaluator)
    this.remindersTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-Status',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
      readCapacity: envName === 'prod' ? 5 : undefined,
      writeCapacity: envName === 'prod' ? 5 : undefined,
    });

    // GSI2: Query reminders by location (geohash) - for Phase 3 optimization
    this.remindersTable.addGlobalSecondaryIndex({
      indexName: 'GSI2-Location',
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
      readCapacity: envName === 'prod' ? 5 : undefined,
      writeCapacity: envName === 'prod' ? 5 : undefined,
    });

    // Auto-scaling for prod
    if (envName === 'prod') {
      const readScaling = this.remindersTable.autoScaleReadCapacity({
        minCapacity: 5,
        maxCapacity: 100,
      });
      readScaling.scaleOnUtilization({
        targetUtilizationPercent: 70,
      });

      const writeScaling = this.remindersTable.autoScaleWriteCapacity({
        minCapacity: 5,
        maxCapacity: 100,
      });
      writeScaling.scaleOnUtilization({
        targetUtilizationPercent: 70,
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'RemindersTableName', {
      value: this.remindersTable.tableName,
      description: 'DynamoDB Reminders Table Name',
      exportName: `${envName}-RemindersTableName`,
    });

    new cdk.CfnOutput(this, 'RemindersTableArn', {
      value: this.remindersTable.tableArn,
      description: 'DynamoDB Reminders Table ARN',
      exportName: `${envName}-RemindersTableArn`,
    });
  }
}
