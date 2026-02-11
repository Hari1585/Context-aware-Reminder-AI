# Architecture Documentation

## System Overview

Context-Aware Location-Based Reminder AI is a serverless application that intelligently triggers reminders based on user location using geofencing and AI-powered natural language processing.

## Design Principles

1. **Serverless-First**: Minimize operational overhead, pay-per-use
2. **Event-Driven**: Decouple components via SQS for scalability
3. **Security by Default**: Cognito auth, IAM least-privilege, encryption
4. **Cost-Optimized**: DynamoDB on-demand, Lambda auto-scaling
5. **Observable**: Structured logging, CloudWatch metrics, alarms

## Component Architecture

### Frontend (Next.js Static Site)

**Technology**: Next.js 14 with App Router, TypeScript, Static Export

**Hosting**: S3 + CloudFront

**Key Features**:
- OAuth2 code flow with Cognito Hosted UI
- JWT token management (localStorage)
- Axios API client with interceptors
- Responsive UI with CSS modules

**Files**:
- `src/app/page.tsx`: Dashboard (create/list reminders)
- `src/app/login/page.tsx`: Login redirect
- `src/app/callback/page.tsx`: OAuth callback handler
- `src/app/settings/page.tsx`: Location permissions, preferences
- `src/lib/auth.ts`: Cognito integration
- `src/lib/api.ts`: API client

**Build Process**:
```bash
npm run build  # Creates static export in out/
aws s3 sync out/ s3://bucket/
aws cloudfront create-invalidation --distribution-id ID --paths "/*"
```

### API Layer (API Gateway + Lambda)

**Technology**: FastAPI (Python) via Mangum adapter

**Authentication**: Cognito User Pool Authorizer (JWT validation)

**Endpoints**:
- `POST /reminders`: Create reminder (NLP parsing)
- `GET /reminders`: List user's reminders
- `GET /reminders/{id}`: Get single reminder
- `PATCH /reminders/{id}`: Update reminder (status, location, radius)
- `DELETE /reminders/{id}`: Delete reminder
- `POST /location-events`: Queue location update
- `GET /health`: Health check (no auth)

**Lambda Configuration**:
- Runtime: Python 3.11
- Memory: 512 MB
- Timeout: 30s
- Concurrency: Unreserved (auto-scales)
- Tracing: X-Ray enabled

**Environment Variables**:
- `TABLE_NAME`: DynamoDB table
- `QUEUE_URL`: SQS FIFO queue
- `TOPIC_ARN`: SNS topic
- `ENV`: dev/stage/prod
- `REGION`: AWS region

### Data Layer (DynamoDB)

**Table Design**: Single-table pattern

**Primary Key**:
- PK: `USER#{userId}`
- SK: `REM#{reminderId}`

**GSI1 (Status Index)**:
- GSI1PK: `STATUS#{status}`
- GSI1SK: `USER#{userId}#REM#{reminderId}`
- Purpose: Query all active reminders (for evaluator)

**GSI2 (Location Index)** - Phase 3:
- GSI2PK: `GEO#{geohash}`
- GSI2SK: `USER#{userId}#REM#{reminderId}`
- Purpose: Spatial queries (geohash optimization)

**Attributes**:
```json
{
  "PK": "USER#123",
  "SK": "REM#456",
  "GSI1PK": "STATUS#active",
  "GSI1SK": "USER#123#REM#456",
  "id": "456",
  "user_id": "123",
  "task": "Buy milk",
  "location_query": "Walmart",
  "location": {
    "latitude": 47.6062,
    "longitude": -122.3321,
    "accuracy": 10
  },
  "radius_meters": 500,
  "status": "active",
  "priority": "medium",
  "time_constraints": null,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "triggered_at": null,
  "last_notification_at": null,
  "ttl": 1704067200
}
```

**Capacity**:
- Dev: PAY_PER_REQUEST
- Prod: Provisioned with auto-scaling (5-100 RCU/WCU)

**TTL**: 90 days (auto-cleanup old reminders)

### Event Processing (SQS + Lambda)

**Queue**: SQS FIFO

**Configuration**:
- Message retention: 4 days
- Visibility timeout: 5 minutes
- Receive wait time: 20s (long polling)
- Content-based deduplication: Enabled
- Message group ID: `userId` (ordered per user)

**Dead Letter Queue**:
- Max receive count: 3
- Retention: 14 days
- Alarm: CloudWatch alarm if messages > 0

**Evaluator Lambda**:
- Runtime: Python 3.11
- Memory: 1024 MB
- Timeout: 60s
- Reserved concurrency: 10 (prod)
- Batch size: 10 messages
- Batch window: 10s
- Partial batch failure: Enabled

**Processing Flow**:
1. Receive batch of location events
2. For each event:
   - Extract user_id and location
   - Query active reminders (GSI1)
   - Filter to user's reminders
   - For each reminder:
     - Check rate limit (15-minute window)
     - Calculate geofence score
     - If score >= threshold:
       - Publish to SNS
       - Update reminder status to "triggered"
       - Set last_notification_at
3. Report batch item failures for retry

### Notification Layer (SNS)

**Topic**: Standard (not FIFO) for fan-out

**Subscriptions**:
- Email: User subscribes via AWS Console or CLI
- SMS: Optional (requires phone number)
- Mobile Push: Phase 3 (SNS Mobile Push)

**Message Format**:
```json
{
  "default": "{\"reminder_id\":\"456\",\"task\":\"Buy milk\"}",
  "email": "You're near Walmart!\n\nReminder: Buy milk\n\nPriority: MEDIUM",
  "sms": "Reminder: Buy milk (near Walmart)"
}
```

**Message Attributes**:
- `user_id`: For filtering
- `priority`: high/medium/low

### Authentication (Cognito)

**User Pool**:
- Sign-up: Email + password
- MFA: Optional (TOTP)
- Password policy: 8+ chars, upper/lower/digit
- Account recovery: Email only

**App Client**:
- Type: Public (no client secret)
- Auth flows: USER_SRP_AUTH, USER_PASSWORD_AUTH
- OAuth: Authorization code grant
- Scopes: openid, email, profile
- Token validity: 1 hour (access/ID), 30 days (refresh)

**Hosted UI**:
- Domain: `reminder-app-{env}-{account}.auth.{region}.amazoncognito.com`
- Callback URLs: CloudFront URL + localhost
- Logout URLs: CloudFront URL + localhost

**JWT Verification**:
- API Gateway Cognito Authorizer
- Validates signature against JWKS
- Extracts `sub` (user ID) from token

### AI/NLP (OpenAI + Fallback)

**LLM Parser**:
- Model: GPT-4
- Temperature: 0.1 (deterministic)
- Max tokens: 200
- Response format: JSON
- Retry: 1 attempt, then fallback

**Prompt**:
```
You are a reminder parser. Extract structured data from natural language reminders.
Output ONLY valid JSON with these fields:
- task: string (what to remind)
- location_query: string (place name or address)
- radius_meters: integer (50-10000, default 500)
- time_constraints: string or null
- priority: "low" | "medium" | "high"
```

**Fallback Parser** (Regex):
- Extract task: Text before "at/near/when"
- Extract location: Text after location keyword
- Extract priority: Keywords (urgent → high, low priority → low)
- Extract radius: "within X meters/feet"
- Extract time: Weekdays, mornings, time ranges

**Validation**:
- Pydantic schema validation
- Radius: 50-10000 meters
- Priority: Enum (low/medium/high)

### Geofence Algorithm

**Distance Calculation**: Haversine formula
```python
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # Earth radius in meters
    phi1 = radians(lat1)
    phi2 = radians(lat2)
    delta_phi = radians(lat2 - lat1)
    delta_lambda = radians(lon2 - lon1)
    
    a = sin(delta_phi/2)**2 + cos(phi1) * cos(phi2) * sin(delta_lambda/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c
```

**Scoring**:
```python
if distance <= radius:
    # Inside geofence: score 1.0 at center, 0.7 at edge
    score = 1.0 - (distance / radius) * 0.3
else:
    score = 0.0

# Priority multiplier
score *= {low: 0.9, medium: 1.0, high: 1.1}[priority]

# Trigger if score >= 0.7
```

**Rate Limiting**:
- Max 1 notification per reminder per 15 minutes
- Stored in `last_notification_at` field
- Prevents spam from repeated location updates

### Monitoring & Observability

**Structured Logging**:
```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "level": "INFO",
  "message": "Reminder triggered",
  "reminder_id": "456",
  "user_id": "123",
  "score": 0.85
}
```

**CloudWatch Metrics**:
- API Gateway: Latency, 4XX/5XX, count
- Lambda: Invocations, errors, duration, throttles, concurrent executions
- DynamoDB: ConsumedReadCapacity, ConsumedWriteCapacity, UserErrors
- SQS: ApproximateNumberOfMessagesVisible, ApproximateAgeOfOldestMessage

**CloudWatch Alarms**:
- API 5XX errors > 10 in 5 minutes
- API latency > 2s average
- Lambda errors > 5 in 5 minutes
- Lambda throttles > 1
- DLQ messages > 0

**X-Ray Tracing**:
- Enabled on API Gateway and Lambda
- Trace location event → evaluator → notification flow

## Data Flow Diagrams

### Create Reminder Flow
```
User → CloudFront → Browser
Browser → API Gateway (POST /reminders, JWT)
API Gateway → Cognito (validate JWT)
API Gateway → Lambda (API)
Lambda → OpenAI (parse NLP)
Lambda → DynamoDB (put item)
Lambda → Browser (reminder response)
```

### Location Event Flow
```
User → Browser (geolocation API)
Browser → API Gateway (POST /location-events, JWT)
API Gateway → Lambda (API)
Lambda → SQS FIFO (send message, MessageGroupId=userId)
SQS → Lambda (Evaluator, batch trigger)
Lambda → DynamoDB (query active reminders, GSI1)
Lambda → Geofence calculation
Lambda → SNS (publish notification)
Lambda → DynamoDB (update reminder status)
SNS → Email/SMS (user subscription)
```

## Security Architecture

**Defense in Depth**:
1. **Network**: HTTPS only, CloudFront + API Gateway
2. **Authentication**: Cognito JWT tokens
3. **Authorization**: API Gateway authorizer, IAM policies
4. **Data**: Encryption at rest (DynamoDB, S3), in transit (TLS)
5. **Secrets**: SSM Parameter Store (SecureString)
6. **IAM**: Least-privilege roles, no long-lived keys

**Threat Model**:
- **Unauthorized access**: Mitigated by Cognito + JWT
- **Data breach**: Mitigated by encryption + IAM
- **DDoS**: Mitigated by CloudFront + API Gateway throttling
- **Injection**: Mitigated by Pydantic validation
- **Secrets exposure**: Mitigated by SSM + no secrets in code

## Scalability

**Horizontal Scaling**:
- Lambda: Auto-scales to 1000 concurrent executions (soft limit)
- API Gateway: Handles 10K requests/second (soft limit)
- DynamoDB: Auto-scales RCU/WCU (5-100 in prod)
- SQS: Unlimited throughput
- CloudFront: Global edge network

**Bottlenecks**:
- DynamoDB: Hot partitions (mitigated by single-table design)
- Lambda: Cold starts (mitigated by provisioned concurrency in prod)
- OpenAI API: Rate limits (mitigated by fallback parser)

**Capacity Planning**:
- 10K users, 1 location event/minute = 167 events/second
- DynamoDB: 200 RCU (read), 50 WCU (write)
- Lambda: 10 concurrent executions (evaluator)
- SQS: 1000 messages/second (well within limits)

## Cost Optimization

**Strategies**:
1. DynamoDB: PAY_PER_REQUEST for dev, provisioned for prod
2. Lambda: Right-size memory (512 MB API, 1024 MB evaluator)
3. CloudFront: Price class 100 for dev (US/Europe only)
4. S3: Lifecycle policies (delete old versions after 30 days)
5. CloudWatch: 7-day log retention (not 30 days)
6. SQS: Long polling (reduce empty receives)

**Cost Breakdown** (10K users, prod):
- Lambda: $50 (1M invocations)
- DynamoDB: $100 (provisioned capacity)
- API Gateway: $35 (1M requests)
- SQS: $5 (1M messages)
- CloudFront: $50 (1 TB transfer)
- SNS: $10 (100K emails)
- **Total: ~$250/month**

## Disaster Recovery

**RTO/RPO**:
- RTO: 1 hour (redeploy from CDK)
- RPO: 5 minutes (DynamoDB point-in-time recovery)

**Backup Strategy**:
- DynamoDB: Point-in-time recovery (35 days)
- S3: Versioning enabled (prod)
- CDK: Infrastructure as code (Git)

**Failover**:
- Multi-AZ: DynamoDB, Lambda, API Gateway (automatic)
- Multi-region: Not implemented (Phase 3)

## Compliance

**Data Residency**: Single region (us-east-1)

**Encryption**:
- At rest: DynamoDB (AWS managed), S3 (SSE-S3)
- In transit: TLS 1.2+

**Audit Logging**: CloudTrail (all API calls)

**GDPR**: User can delete account (deletes all reminders via TTL)

## Future Enhancements

**Phase 2** (Container Migration):
- ECS Fargate + RDS Postgres
- ALB + VPC
- Better relational queries

**Phase 3** (Advanced Features):
- Vector DB (semantic search)
- Geohash optimization (spatial indexing)
- Mobile app (React Native)
- SMS notifications
- Recurring reminders
- Time-based constraints (weekdays 9-5)
- Multi-region (global)

## References

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [API Gateway Best Practices](https://docs.aws.amazon.com/apigateway/latest/developerguide/best-practices.html)
