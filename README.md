# Context-Aware Location-Based Reminder AI

Production-ready serverless application on AWS that sends intelligent reminders based on your location.

## Features

### Core Capabilities (MVP)
- **Natural Language Input**: "Remind me to buy milk when I arrive at Walmart"
- **Multiple Trigger Types**:
  - **Arrival**: Trigger when entering a location
  - **Departure**: Trigger when leaving a location
  - **Nearby**: Trigger when within radius (default)
  - **Dwell**: Trigger after staying in location for duration
- **Recurring Reminders**: One-shot, always, daily, weekly
- **Time Windows**: "After 6pm", "weekdays", "mornings"
- **Priority Levels**: Low, medium, high, urgent
- **Smart Filtering**:
  - GPS accuracy check (reject poor signals)
  - Speed detection (delay if driving)
  - Rate limiting (prevent spam)
- **AI-Powered Parsing**: LLM + deterministic fallback
- **Event-Driven Architecture**: SQS FIFO → Lambda evaluator → SNS
- **Secure Authentication**: Cognito Hosted UI with OAuth2
- **Serverless-First**: API Gateway + Lambda + DynamoDB (Phase 1)
- **Container-Ready**: Migration path to ECS + RDS (Phase 2)

## Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────┐
│   CloudFront    │
└────────┬────────┘
         │
    ┌────┴────┐
    │   S3    │ (Next.js static)
    └─────────┘

┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ API calls (JWT)
       ▼
┌─────────────────┐      ┌──────────────┐
│  API Gateway    │─────▶│   Cognito    │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Lambda (API)   │─────▶│  DynamoDB    │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐
│   SQS FIFO      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│Lambda(Evaluator)│─────▶│     SNS      │
└─────────────────┘      └──────┬───────┘
                                │
                         ┌──────┴───────┐
                         │ Email / SMS  │
                         └──────────────┘
```

## Tech Stack

### Infrastructure
- **IaC**: AWS CDK (TypeScript)
- **Compute**: Lambda (Python 3.11)
- **API**: API Gateway REST API
- **Database**: DynamoDB (single-table design)
- **Queue**: SQS FIFO
- **Notifications**: SNS
- **Auth**: Cognito User Pool
- **Frontend Hosting**: S3 + CloudFront
- **CI/CD**: GitHub Actions with OIDC

### Backend
- **Framework**: FastAPI + Mangum
- **Language**: Python 3.11
- **AI**: OpenAI GPT-4 (with regex fallback)
- **Testing**: pytest

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Auth**: amazon-cognito-identity-js
- **HTTP**: axios

## Quick Start

### Prerequisites
- AWS Account
- AWS CLI configured
- Node.js 20+
- Python 3.11+
- OpenAI API key

### 1. Clone Repository
```bash
git clone https://github.com/your-org/reminder-app.git
cd reminder-app
```

### 2. Configure AWS
```bash
# Set OpenAI API key in SSM
aws ssm put-parameter \
  --name "/reminder-app/dev/openai-api-key" \
  --value "sk-YOUR-KEY" \
  --type SecureString \
  --region us-east-1
```

### 3. Deploy Infrastructure
```bash
cd infra
npm install

# Bootstrap CDK (first time only)
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap aws://$AWS_ACCOUNT_ID/us-east-1

# Deploy all stacks
npm run deploy:dev
```

### 4. Deploy Frontend
```bash
cd frontend
npm install

# Get CDK outputs
export NEXT_PUBLIC_API_URL=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-api --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
export NEXT_PUBLIC_USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-auth --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
export NEXT_PUBLIC_USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-auth --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
export NEXT_PUBLIC_COGNITO_DOMAIN=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-auth --query 'Stacks[0].Outputs[?OutputKey==`CognitoDomain`].OutputValue' --output text)

# Build and deploy
npm run build
aws s3 sync out/ s3://$(aws cloudformation describe-stacks --stack-name reminder-app-dev-frontend --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' --output text)/ --delete
```

### 5. Update Cognito Callback URLs
```bash
# Add CloudFront URL to Cognito
DISTRIBUTION_URL=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-frontend --query 'Stacks[0].Outputs[?OutputKey==`DistributionUrl`].OutputValue' --output text)

# Update via AWS Console:
# Cognito → User Pools → reminder-app-dev → App clients → Edit
# Add callback URL: $DISTRIBUTION_URL/callback
# Add logout URL: $DISTRIBUTION_URL
```

### 6. Subscribe to Notifications
```bash
TOPIC_ARN=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-events --query 'Stacks[0].Outputs[?OutputKey==`NotificationTopicArn`].OutputValue' --output text)

aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## Usage

1. Open CloudFront URL in browser
2. Click "Sign In with Cognito"
3. Create account or sign in
4. Create reminders using natural language:
   - "Remind me to buy milk when I arrive at Walmart"
   - "When I leave office, remind me to call mom"
   - "Every time I go to the gym, remind me to bring my belt"
   - "If I'm near Target after 6pm, remind me to buy batteries"
   - "Urgent: remind me to pick up prescription at pharmacy"
5. Enable location services in Settings
6. App will send location events as you move
7. Receive email notifications based on your location and conditions

### Supported Use Cases
- ✅ Location arrival/departure
- ✅ Nearby radius reminders (with custom radius)
- ✅ Recurring reminders (once, always, daily, weekly)
- ✅ Time + location combo (after 6pm, weekdays, mornings)
- ✅ Priority + urgency
- ✅ GPS accuracy filtering
- ✅ Speed detection (delay if driving)

See [USE_CASES.md](docs/USE_CASES.md) for complete coverage.

## Development

### Local Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set environment variables (from CDK outputs)
export TABLE_NAME=reminder-app-dev-reminders
export QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT/reminder-app-dev-location-events.fifo
export TOPIC_ARN=arn:aws:sns:us-east-1:ACCOUNT:reminder-app-dev-notifications
export ENV=dev

# Run API
uvicorn src.handlers.api_handler:app --reload --port 8000

# Run tests
pytest tests/ -v
```

### Local Frontend
```bash
cd frontend
npm install

# Create .env.local with CDK outputs
npm run dev
# Open http://localhost:3000
```

## Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v --cov=src
```

### Integration Test
```bash
# Create reminder
curl -X POST https://YOUR-API/dev/reminders \
  -H "Authorization: Bearer YOUR-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Buy milk near Walmart"}'

# Post location event
curl -X POST https://YOUR-API/dev/location-events \
  -H "Authorization: Bearer YOUR-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location": {"latitude": 47.6062, "longitude": -122.3321}}'
```

## Monitoring

### CloudWatch Logs
```bash
# API logs
aws logs tail /aws/lambda/reminder-app-dev-api --follow

# Evaluator logs
aws logs tail /aws/lambda/reminder-app-dev-evaluator --follow
```

### Metrics
- API Gateway: Latency, 4XX/5XX errors
- Lambda: Invocations, errors, duration, throttles
- DynamoDB: Read/write capacity, throttles
- SQS: Messages visible, age of oldest message
- DLQ: Messages (alarm if > 0)

## Cost Estimation

**ACCOUNT/REGION-DEPENDENT** - Verify via AWS Cost Explorer

### Dev Environment (~10 users)
- Lambda: $5/month
- DynamoDB: $5/month (PAY_PER_REQUEST)
- API Gateway: $3/month
- SQS: $1/month
- CloudFront: $5/month
- **Total: ~$20/month**

### Production (~10K users)
- Lambda: $50/month
- DynamoDB: $100/month
- API Gateway: $35/month
- SQS: $5/month
- CloudFront: $50/month
- **Total: ~$240/month**

## Security

- **Authentication**: Cognito with MFA support
- **Authorization**: JWT verification (API Gateway authorizer)
- **Secrets**: SSM Parameter Store (SecureString)
- **Network**: HTTPS only, CloudFront + API Gateway
- **IAM**: Least-privilege roles
- **Data**: DynamoDB encryption at rest, S3 encryption

## Documentation

- [RUNBOOK.md](docs/RUNBOOK.md) - Operations guide
- [PHASE2_MIGRATION.md](docs/PHASE2_MIGRATION.md) - Container migration plan
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Detailed architecture

## CI/CD

GitHub Actions workflows:
- **deploy-dev.yml**: Auto-deploy on push to main
- **deploy-prod.yml**: Deploy on git tags (v*)

### Setup
1. Create OIDC provider in AWS IAM
2. Create IAM role with trust policy for GitHub
3. Add secrets to GitHub:
   - `AWS_ROLE_ARN`: IAM role ARN
   - `AWS_ACCOUNT_ID`: AWS account ID

## Roadmap

### Phase 1 (Current) - Serverless MVP
- ✅ Natural language parsing (LLM + fallback)
- ✅ Geofence triggering
- ✅ Email notifications
- ✅ Web UI

### Phase 2 - Container Migration
- [ ] ECS Fargate deployment
- [ ] RDS Postgres
- [ ] ALB
- [ ] Data migration script

### Phase 3 - Advanced Features
- [ ] Vector DB for semantic search
- [ ] Mobile app (React Native)
- [ ] SMS notifications
- [ ] Recurring reminders
- [ ] Geohash optimization
- [ ] Time-based constraints

## Troubleshooting

### API Returns 401
- Check Cognito token expiration
- Verify authorization header format

### Reminders Not Triggering
- Check evaluator Lambda logs
- Verify SQS queue has messages
- Check DLQ for failures
- Verify geofence calculation

### High Costs
```bash
aws ce get-cost-and-usage \
  --time-period Start=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

## License

MIT

## Contributing

1. Fork repository
2. Create feature branch
3. Run tests
4. Submit pull request

## Support

- Issues: GitHub Issues
- Email: support@example.com
