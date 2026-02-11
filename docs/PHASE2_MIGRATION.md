# Phase 2: Container Migration Plan (ECS Fargate + RDS)

## Overview
Migrate from serverless (Lambda + DynamoDB) to container-first (ECS Fargate + RDS Postgres) while maintaining API contracts and zero downtime.

## Architecture Changes

### Current (Phase 1 - Serverless)
```
CloudFront → API Gateway → Lambda (FastAPI via Mangum) → DynamoDB
                          ↓
                        SQS FIFO → Lambda Evaluator → SNS
```

### Target (Phase 2 - Containers)
```
CloudFront → ALB → ECS Fargate (FastAPI) → RDS Postgres
                   ↓
                 SQS FIFO → ECS Fargate Evaluator → SNS
```

## What Changes

### 1. Infrastructure (CDK Changes)

#### New Stacks Required
Create `infra/lib/ecs-stack.ts`:
```typescript
// VPC (required for RDS + ECS)
const vpc = new ec2.Vpc(this, 'Vpc', {
  maxAzs: 2,
  natGateways: 1, // Cost optimization: 1 NAT for dev, 2+ for prod
});

// RDS Postgres
const dbCluster = new rds.DatabaseCluster(this, 'Database', {
  engine: rds.DatabaseClusterEngine.auroraPostgres({
    version: rds.AuroraPostgresEngineVersion.VER_15_3,
  }),
  instances: envName === 'prod' ? 2 : 1,
  instanceProps: {
    vpc,
    instanceType: ec2.InstanceType.of(
      ec2.InstanceClass.T4G,
      ec2.InstanceSize.MEDIUM
    ),
  },
  defaultDatabaseName: 'reminders',
  credentials: rds.Credentials.fromGeneratedSecret('postgres'),
  backup: {
    retention: cdk.Duration.days(7),
  },
});

// ECS Cluster
const cluster = new ecs.Cluster(this, 'Cluster', {
  vpc,
  containerInsights: true,
});

// API Service
const apiTaskDef = new ecs.FargateTaskDefinition(this, 'ApiTask', {
  cpu: 512,
  memoryLimitMiB: 1024,
});

apiTaskDef.addContainer('api', {
  image: ecs.ContainerImage.fromAsset('../backend'),
  environment: {
    ENV: envName,
    DATABASE_URL: `postgresql://postgres:${dbCluster.secret!.secretValueFromJson('password')}@${dbCluster.clusterEndpoint.hostname}:5432/reminders`,
    QUEUE_URL: locationQueue.queueUrl,
    TOPIC_ARN: notificationTopic.topicArn,
  },
  logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'api' }),
  portMappings: [{ containerPort: 8000 }],
});

const apiService = new ecs.FargateService(this, 'ApiService', {
  cluster,
  taskDefinition: apiTaskDef,
  desiredCount: envName === 'prod' ? 2 : 1,
  healthCheckGracePeriod: cdk.Duration.seconds(60),
});

// ALB
const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
  vpc,
  internetFacing: true,
});

const listener = alb.addListener('Listener', {
  port: 443,
  certificates: [certificate], // ACM certificate
});

listener.addTargets('ApiTarget', {
  port: 8000,
  targets: [apiService],
  healthCheck: {
    path: '/health',
    interval: cdk.Duration.seconds(30),
  },
});

// Evaluator Service (background worker)
const evaluatorTaskDef = new ecs.FargateTaskDefinition(this, 'EvaluatorTask', {
  cpu: 1024,
  memoryLimitMiB: 2048,
});

evaluatorTaskDef.addContainer('evaluator', {
  image: ecs.ContainerImage.fromAsset('../backend'),
  command: ['python', 'src/handlers/evaluator_worker.py'], // New worker script
  environment: {
    ENV: envName,
    DATABASE_URL: `postgresql://...`,
    QUEUE_URL: locationQueue.queueUrl,
    TOPIC_ARN: notificationTopic.topicArn,
  },
  logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'evaluator' }),
});

const evaluatorService = new ecs.FargateService(this, 'EvaluatorService', {
  cluster,
  taskDefinition: evaluatorTaskDef,
  desiredCount: envName === 'prod' ? 2 : 1,
});
```

#### Remove/Modify
- Remove `ApiStack` Lambda functions
- Remove API Gateway (replace with ALB)
- Keep `AuthStack`, `EventsStack`, `FrontendStack` unchanged
- Keep `MonitoringStack` (update metrics for ECS)

### 2. Backend Code Changes

#### Database Layer (`backend/src/services/db.py`)
Replace DynamoDB client with SQLAlchemy:

```python
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

Base = declarative_base()

class ReminderModel(Base):
    __tablename__ = 'reminders'
    
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    task = Column(String, nullable=False)
    location_query = Column(String, nullable=False)
    location_lat = Column(Float, nullable=True)
    location_lon = Column(Float, nullable=True)
    radius_meters = Column(Integer, nullable=False)
    status = Column(String, nullable=False, index=True)
    priority = Column(String, nullable=False)
    time_constraints = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    triggered_at = Column(DateTime, nullable=True)
    last_notification_at = Column(DateTime, nullable=True)

engine = create_engine(os.getenv('DATABASE_URL'))
SessionLocal = sessionmaker(bind=engine)

class PostgresDBService:
    def __init__(self):
        self.session = SessionLocal()
    
    def create_reminder(self, user_id, task, location_query, location, radius_meters, priority, time_constraints):
        reminder = ReminderModel(
            id=str(uuid.uuid4()),
            user_id=user_id,
            task=task,
            location_query=location_query,
            location_lat=location.latitude if location else None,
            location_lon=location.longitude if location else None,
            radius_meters=radius_meters,
            status='active',
            priority=priority.value,
            time_constraints=time_constraints
        )
        self.session.add(reminder)
        self.session.commit()
        return self._model_to_response(reminder)
    
    def get_active_reminders(self):
        reminders = self.session.query(ReminderModel).filter(
            ReminderModel.status == 'active'
        ).all()
        return [self._model_to_response(r) for r in reminders]
    
    # ... other methods similar to DynamoDB version
```

#### API Handler (`backend/src/handlers/api_handler.py`)
Remove Mangum wrapper (not needed for ECS):

```python
# Remove: from mangum import Mangum
# Remove: handler = Mangum(app, lifespan="off")

# Keep FastAPI app as-is
# Run with: uvicorn src.handlers.api_handler:app --host 0.0.0.0 --port 8000
```

#### Evaluator Worker (`backend/src/handlers/evaluator_worker.py`)
New long-running worker for SQS polling:

```python
import boto3
import json
import time
from services.db import PostgresDBService
from services.geofence import calculate_geofence_score, should_rate_limit
from services.notifications import NotificationService
from models.reminder import Location
from utils.logger import get_logger
from utils.config import settings

logger = get_logger(__name__)
sqs = boto3.client('sqs', region_name=settings.REGION)
db = PostgresDBService()
notifier = NotificationService()

def main():
    logger.info('Evaluator worker started')
    
    while True:
        try:
            # Long poll SQS
            response = sqs.receive_message(
                QueueUrl=settings.QUEUE_URL,
                MaxNumberOfMessages=10,
                WaitTimeSeconds=20,
                VisibilityTimeout=60
            )
            
            messages = response.get('Messages', [])
            if not messages:
                continue
            
            for message in messages:
                try:
                    process_message(message)
                    sqs.delete_message(
                        QueueUrl=settings.QUEUE_URL,
                        ReceiptHandle=message['ReceiptHandle']
                    )
                except Exception as e:
                    logger.error('Failed to process message', error=str(e))
                    # Message will become visible again after timeout
        
        except Exception as e:
            logger.error('Worker error', error=str(e))
            time.sleep(5)

def process_message(message):
    body = json.loads(message['Body'])
    user_id = body['user_id']
    location = Location(**body['location'])
    
    active_reminders = db.get_active_reminders()
    user_reminders = [r for r in active_reminders if r.user_id == user_id]
    
    for reminder in user_reminders:
        if should_rate_limit(reminder):
            continue
        
        should_trigger, score = calculate_geofence_score(reminder, location)
        if should_trigger:
            notifier.send_reminder_notification(reminder, score)
            db.update_reminder(
                user_id=reminder.user_id,
                reminder_id=reminder.id,
                status='triggered',
                triggered_at=datetime.utcnow().isoformat(),
                last_notification_at=datetime.utcnow().isoformat()
            )

if __name__ == '__main__':
    main()
```

#### Dockerfile Updates
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install psycopg2-binary sqlalchemy

# Copy code
COPY src/ ./src/

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Default: run API
CMD ["uvicorn", "src.handlers.api_handler:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 3. Data Migration

#### Migration Script (`scripts/migrate_dynamodb_to_postgres.py`)
```python
import boto3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Connect to both databases
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('reminder-app-prod-reminders')

engine = create_engine(os.getenv('DATABASE_URL'))
Session = sessionmaker(bind=engine)
session = Session()

# Scan DynamoDB
response = table.scan()
items = response['Items']

while 'LastEvaluatedKey' in response:
    response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
    items.extend(response['Items'])

print(f'Found {len(items)} items to migrate')

# Insert into Postgres
for item in items:
    if not item['SK'].startswith('REM#'):
        continue
    
    reminder = ReminderModel(
        id=item['id'],
        user_id=item['user_id'],
        task=item['task'],
        location_query=item['location_query'],
        location_lat=item.get('location', {}).get('latitude'),
        location_lon=item.get('location', {}).get('longitude'),
        radius_meters=item['radius_meters'],
        status=item['status'],
        priority=item['priority'],
        time_constraints=item.get('time_constraints'),
        created_at=datetime.fromisoformat(item['created_at']),
        updated_at=datetime.fromisoformat(item['updated_at']),
        triggered_at=datetime.fromisoformat(item['triggered_at']) if item.get('triggered_at') else None,
        last_notification_at=datetime.fromisoformat(item['last_notification_at']) if item.get('last_notification_at') else None
    )
    session.add(reminder)

session.commit()
print('Migration complete')
```

#### Migration Steps
```bash
# 1. Deploy RDS in new ECS stack (parallel to existing Lambda stack)
cd infra
npx cdk deploy reminder-app-prod-ecs --context env=prod

# 2. Run migration script
export DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id reminder-app-prod-db-secret --query SecretString --output text | jq -r .password)
python scripts/migrate_dynamodb_to_postgres.py

# 3. Verify data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM reminders;"

# 4. Deploy ECS services (API + Evaluator)
# Services start but don't receive traffic yet

# 5. Update ALB target group health checks
# Wait for healthy targets

# 6. Cutover: Update CloudFront origin from API Gateway to ALB
aws cloudfront update-distribution \
  --id DISTRIBUTION_ID \
  --distribution-config file://new-config.json

# 7. Monitor for 24 hours
# Keep DynamoDB + Lambda running in parallel

# 8. Decommission old stack
npx cdk destroy reminder-app-prod-api --context env=prod
```

### 4. What Stays the Same

#### No Changes Required
- **Frontend**: API contracts unchanged, same endpoints
- **Auth**: Cognito User Pool, same JWT tokens
- **Events**: SQS FIFO queue, SNS topic (same ARNs)
- **Frontend Hosting**: S3 + CloudFront
- **CI/CD**: GitHub Actions (update to build Docker images)

#### API Contract Compatibility
All endpoints remain identical:
- `POST /reminders`
- `GET /reminders`
- `PATCH /reminders/{id}`
- `DELETE /reminders/{id}`
- `POST /location-events`

Response schemas unchanged (Pydantic models).

### 5. Cost Comparison

#### Phase 1 (Serverless) - Estimated Monthly
- Lambda: $20-50 (10K users, 1M requests)
- DynamoDB: $25-100 (PAY_PER_REQUEST)
- API Gateway: $35 (1M requests)
- SQS: $5
- **Total: ~$85-190/month**

#### Phase 2 (Containers) - Estimated Monthly
- ECS Fargate: $50-150 (2 API tasks + 1 evaluator, 24/7)
- RDS Aurora Postgres: $100-300 (t4g.medium, 2 instances prod)
- ALB: $20
- NAT Gateway: $45 (1 NAT)
- SQS: $5
- **Total: ~$220-520/month**

**Trade-off**: Higher baseline cost, but more predictable at scale. Better for >50K users.

### 6. Rollback Plan

#### Immediate Rollback (< 1 hour)
```bash
# Revert CloudFront origin to API Gateway
aws cloudfront update-distribution \
  --id DISTRIBUTION_ID \
  --distribution-config file://old-config.json

# Traffic back to Lambda + DynamoDB
```

#### Data Rollback (if needed)
```bash
# Reverse migration: Postgres → DynamoDB
python scripts/migrate_postgres_to_dynamodb.py

# Verify
aws dynamodb scan --table-name reminder-app-prod-reminders --select COUNT
```

### 7. Testing Strategy

#### Pre-Migration
1. Deploy ECS stack to staging
2. Run load tests (Apache Bench, Locust)
3. Verify latency < 200ms p99
4. Test failover scenarios

#### During Migration
1. Dual-write to both databases for 24 hours
2. Compare query results
3. Monitor error rates

#### Post-Migration
1. Synthetic monitoring (CloudWatch Synthetics)
2. Real user monitoring (RUM)
3. Cost tracking (AWS Cost Explorer)

## Timeline

- **Week 1**: Create ECS stack, deploy to dev
- **Week 2**: Data migration script, test in staging
- **Week 3**: Deploy to prod (parallel), dual-write
- **Week 4**: Cutover, monitor, decommission old stack

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Dual-write period, backups, dry-run |
| Increased latency | Load testing, auto-scaling, caching |
| Higher costs | Right-size instances, Savings Plans |
| VPC complexity | Use AWS best practices, NAT Gateway HA |
| RDS failover time | Multi-AZ, read replicas, connection pooling |

## Conclusion

Phase 2 migration provides:
- Better performance predictability
- Relational data model (easier queries)
- Standard container deployment
- Easier local development

Trade-offs:
- Higher baseline cost
- More infrastructure complexity
- VPC management overhead

**Recommendation**: Migrate when user base > 50K or when relational queries become critical.
