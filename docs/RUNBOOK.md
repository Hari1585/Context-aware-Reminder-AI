# Reminder App Runbook

## Prerequisites

### Required Tools
- AWS CLI v2 (configured with credentials)
- Node.js 20+ and npm
- Python 3.11+
- Git

### AWS Account Setup
1. **ACCOUNT/REGION-DEPENDENT**: Verify AWS account ID and region
   ```bash
   aws sts get-caller-identity
   aws configure get region
   ```

2. **Create OpenAI API Key Parameter** (required for LLM parsing)
   ```bash
   aws ssm put-parameter \
     --name "/reminder-app/dev/openai-api-key" \
     --value "sk-YOUR-OPENAI-KEY" \
     --type SecureString \
     --region us-east-1
   ```

3. **Configure GitHub OIDC** (for CI/CD)
   - Create OIDC provider in IAM Console
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
   - Create IAM role with trust policy for your GitHub repo
   - Add secrets to GitHub: `AWS_ROLE_ARN`, `AWS_ACCOUNT_ID`

## Local Development

### Backend
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run tests
pytest tests/ -v

# Local API (requires AWS credentials)
export TABLE_NAME=reminder-app-dev-reminders
export QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT/reminder-app-dev-location-events.fifo
export TOPIC_ARN=arn:aws:sns:us-east-1:ACCOUNT:reminder-app-dev-notifications
export ENV=dev
export REGION=us-east-1

uvicorn src.handlers.api_handler:app --reload --port 8000
```

### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Create .env.local (get values from CDK outputs)
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev
NEXT_PUBLIC_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_COGNITO_DOMAIN=reminder-app-dev-XXXXXXXX.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_REGION=us-east-1
EOF

# Run dev server
npm run dev
# Open http://localhost:3000
```

## Deployment

### First-Time Setup
```bash
cd infra
npm install

# Bootstrap CDK (once per account/region)
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1
npx cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
```

### Deploy Dev Environment
```bash
cd infra

# Deploy all stacks
npm run deploy:dev

# Get outputs
aws cloudformation describe-stacks \
  --stack-name reminder-app-dev-frontend \
  --query 'Stacks[0].Outputs' \
  --output table
```

### Deploy Stage/Prod
```bash
cd infra

# Stage
npm run deploy:stage

# Prod (requires approval)
npm run deploy:prod
```

### Update Cognito Callback URLs
After frontend deploys, add CloudFront URL to Cognito:
```bash
DISTRIBUTION_URL=$(aws cloudformation describe-stacks \
  --stack-name reminder-app-dev-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionUrl`].OutputValue' \
  --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name reminder-app-dev-auth \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

# Update via Console or CLI
aws cognito-idp update-user-pool-client \
  --user-pool-id us-east-1_XXXXXXXXX \
  --client-id $USER_POOL_CLIENT_ID \
  --callback-urls "http://localhost:3000/callback" "$DISTRIBUTION_URL/callback" \
  --logout-urls "http://localhost:3000" "$DISTRIBUTION_URL"
```

## Operations

### View Logs
```bash
# API Lambda logs
aws logs tail /aws/lambda/reminder-app-dev-api --follow

# Evaluator Lambda logs
aws logs tail /aws/lambda/reminder-app-dev-evaluator --follow

# Filter errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/reminder-app-dev-api \
  --filter-pattern "ERROR"
```

### Monitor Queue
```bash
# Check queue depth
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT/reminder-app-dev-location-events.fifo \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible

# Check DLQ
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT/reminder-app-dev-location-events-dlq.fifo \
  --attribute-names ApproximateNumberOfMessages
```

### Subscribe to Notifications
```bash
# Email subscription
TOPIC_ARN=$(aws cloudformation describe-stacks \
  --stack-name reminder-app-dev-events \
  --query 'Stacks[0].Outputs[?OutputKey==`NotificationTopicArn`].OutputValue' \
  --output text)

aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol email \
  --notification-endpoint your-email@example.com

# Confirm subscription via email
```

### Database Queries
```bash
# List all reminders for a user
aws dynamodb query \
  --table-name reminder-app-dev-reminders \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"USER#user-id-here"}}'

# Query active reminders (GSI)
aws dynamodb query \
  --table-name reminder-app-dev-reminders \
  --index-name GSI1-Status \
  --key-condition-expression "GSI1PK = :status" \
  --expression-attribute-values '{":status":{"S":"STATUS#active"}}'
```

## Rollback

### Infrastructure Rollback
```bash
# CDK doesn't support automatic rollback
# Manual rollback: redeploy previous version

cd infra
git checkout <previous-commit>
npm run deploy:dev
```

### Frontend Rollback
```bash
# S3 versioning enabled in prod
# Restore previous version
aws s3api list-object-versions \
  --bucket reminder-app-prod-frontend-ACCOUNT \
  --prefix index.html

aws s3api copy-object \
  --bucket reminder-app-prod-frontend-ACCOUNT \
  --copy-source reminder-app-prod-frontend-ACCOUNT/index.html?versionId=VERSION_ID \
  --key index.html

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"
```

### Lambda Rollback
```bash
# List versions
aws lambda list-versions-by-function \
  --function-name reminder-app-prod-api

# Update alias to previous version
aws lambda update-alias \
  --function-name reminder-app-prod-api \
  --name live \
  --function-version <previous-version>
```

## Troubleshooting

### API Returns 401
- Check Cognito token expiration
- Verify JWT signature validation (currently disabled in MVP)
- Check API Gateway authorizer configuration

### Reminders Not Triggering
- Check evaluator Lambda logs
- Verify SQS queue has messages
- Check DLQ for failed messages
- Verify geofence calculation (distance vs radius)
- Check rate limiting (15-minute window)

### Frontend Not Loading
- Check CloudFront distribution status
- Verify S3 bucket has files
- Check browser console for errors
- Verify environment variables in build

### High Costs
**ACCOUNT/REGION-DEPENDENT**: Check AWS Cost Explorer
```bash
# Get current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

## Cleanup

### Delete Dev Environment
```bash
cd infra

# Delete all stacks
npx cdk destroy --all --context env=dev --force

# Verify deletion
aws cloudformation list-stacks \
  --stack-status-filter DELETE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `reminder-app-dev`)].StackName'
```

### Delete SSM Parameters
```bash
aws ssm delete-parameter --name "/reminder-app/dev/openai-api-key"
```

## Health Checks

### API Health
```bash
curl https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/health
```

### End-to-End Test
```bash
# 1. Create reminder
curl -X POST https://YOUR-API/dev/reminders \
  -H "Authorization: Bearer YOUR-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Buy milk near Walmart"}'

# 2. Post location event
curl -X POST https://YOUR-API/dev/location-events \
  -H "Authorization: Bearer YOUR-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location": {"latitude": 47.6062, "longitude": -122.3321}}'

# 3. Check logs for trigger
aws logs tail /aws/lambda/reminder-app-dev-evaluator --follow
```
