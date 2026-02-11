# Local Development Guide

## Prerequisites

- AWS CLI configured with credentials
- Node.js 20+
- Python 3.11+
- Git

## Initial Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/reminder-app.git
cd reminder-app
```

### 2. Install Dependencies
```bash
# Root workspace
npm install

# Infrastructure
cd infra
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 3. Deploy Dev Infrastructure (First Time)
```bash
# Set OpenAI API key
aws ssm put-parameter \
  --name "/reminder-app/dev/openai-api-key" \
  --value "sk-YOUR-OPENAI-KEY" \
  --type SecureString \
  --region us-east-1

# Bootstrap CDK
cd infra
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap aws://$AWS_ACCOUNT_ID/us-east-1

# Deploy all stacks
npm run deploy:dev
cd ..
```

### 4. Capture CDK Outputs
```bash
# Save these for local development
export API_URL=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-api --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
export USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-auth --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
export USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-auth --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
export COGNITO_DOMAIN=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-auth --query 'Stacks[0].Outputs[?OutputKey==`CognitoDomain`].OutputValue' --output text)
export TABLE_NAME=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-data --query 'Stacks[0].Outputs[?OutputKey==`RemindersTableName`].OutputValue' --output text)
export QUEUE_URL=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-events --query 'Stacks[0].Outputs[?OutputKey==`LocationQueueUrl`].OutputValue' --output text)
export TOPIC_ARN=$(aws cloudformation describe-stacks --stack-name reminder-app-dev-events --query 'Stacks[0].Outputs[?OutputKey==`NotificationTopicArn`].OutputValue' --output text)

# Print for reference
echo "API_URL=$API_URL"
echo "USER_POOL_ID=$USER_POOL_ID"
echo "USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID"
echo "COGNITO_DOMAIN=$COGNITO_DOMAIN"
echo "TABLE_NAME=$TABLE_NAME"
echo "QUEUE_URL=$QUEUE_URL"
echo "TOPIC_ARN=$TOPIC_ARN"
```

## Backend Development

### Run API Locally
```bash
cd backend
source venv/bin/activate

# Set environment variables
export ENV=dev
export TABLE_NAME=reminder-app-dev-reminders
export QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT/reminder-app-dev-location-events.fifo
export TOPIC_ARN=arn:aws:sns:us-east-1:ACCOUNT:reminder-app-dev-notifications
export USER_POOL_ID=us-east-1_XXXXXXXXX
export REGION=us-east-1
export LOG_LEVEL=DEBUG

# Run API server
uvicorn src.handlers.api_handler:app --reload --port 8000

# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### Run Tests
```bash
cd backend
source venv/bin/activate

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ -v --cov=src --cov-report=html

# Run specific test file
pytest tests/test_parser.py -v

# Run specific test
pytest tests/test_parser.py::test_regex_parser_basic -v
```

### Test Parser Locally
```python
# backend/test_parser_local.py
from src.services.parser import ReminderParser

parser = ReminderParser()

# Test with LLM (requires OpenAI key in SSM)
result = parser.parse("Remind me to buy milk when I'm near Walmart")
print(result)

# Test with regex fallback
result = parser._parse_with_regex("Buy coffee at Starbucks, urgent")
print(result)
```

### Test Geofence Locally
```python
# backend/test_geofence_local.py
from src.services.geofence import haversine_distance, calculate_geofence_score
from src.models.reminder import ReminderResponse, ReminderStatus, ReminderPriority, Location
from datetime import datetime

# Create test reminder
reminder = ReminderResponse(
    id="test-1",
    user_id="user-1",
    task="Buy milk",
    location_query="Walmart",
    location=Location(latitude=47.6062, longitude=-122.3321),
    radius_meters=500,
    status=ReminderStatus.ACTIVE,
    priority=ReminderPriority.MEDIUM,
    created_at=datetime.utcnow().isoformat(),
    updated_at=datetime.utcnow().isoformat()
)

# Test location (100m away)
current_location = Location(latitude=47.6070, longitude=-122.3321)

# Calculate
distance = haversine_distance(
    reminder.location.latitude,
    reminder.location.longitude,
    current_location.latitude,
    current_location.longitude
)
print(f"Distance: {distance:.2f} meters")

should_trigger, score = calculate_geofence_score(reminder, current_location)
print(f"Should trigger: {should_trigger}, Score: {score:.2f}")
```

## Frontend Development

### Run Frontend Locally
```bash
cd frontend

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
NEXT_PUBLIC_COGNITO_DOMAIN=$COGNITO_DOMAIN
NEXT_PUBLIC_REGION=us-east-1
EOF

# Run dev server
npm run dev

# Open http://localhost:3000
```

### Frontend with Deployed API
```bash
cd frontend

# Use deployed API instead of local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=$API_URL
NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
NEXT_PUBLIC_COGNITO_DOMAIN=$COGNITO_DOMAIN
NEXT_PUBLIC_REGION=us-east-1
EOF

npm run dev
```

### Update Cognito for Localhost
```bash
# Add localhost to Cognito callback URLs
aws cognito-idp update-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $USER_POOL_CLIENT_ID \
  --callback-urls "http://localhost:3000/callback" "$API_URL/callback" \
  --logout-urls "http://localhost:3000" "$API_URL"
```

## Infrastructure Development

### CDK Commands
```bash
cd infra

# List stacks
npx cdk list --context env=dev

# Synthesize CloudFormation
npx cdk synth --context env=dev

# Show diff
npx cdk diff --all --context env=dev

# Deploy single stack
npx cdk deploy reminder-app-dev-api --context env=dev

# Deploy all stacks
npm run deploy:dev

# Destroy all stacks
npx cdk destroy --all --context env=dev
```

### Test CDK Changes
```bash
cd infra

# Compile TypeScript
npm run build

# Watch mode
npm run watch

# Check for errors
npx tsc --noEmit
```

## Debugging

### View Lambda Logs
```bash
# API Lambda
aws logs tail /aws/lambda/reminder-app-dev-api --follow

# Evaluator Lambda
aws logs tail /aws/lambda/reminder-app-dev-evaluator --follow

# Filter errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/reminder-app-dev-api \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000
```

### Query DynamoDB
```bash
# List all reminders for a user
aws dynamodb query \
  --table-name reminder-app-dev-reminders \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"USER#YOUR-USER-ID"}}'

# Query active reminders (GSI)
aws dynamodb query \
  --table-name reminder-app-dev-reminders \
  --index-name GSI1-Status \
  --key-condition-expression "GSI1PK = :status" \
  --expression-attribute-values '{":status":{"S":"STATUS#active"}}'

# Scan all items (dev only, expensive in prod)
aws dynamodb scan --table-name reminder-app-dev-reminders --max-items 10
```

### Check SQS Queue
```bash
# Get queue attributes
aws sqs get-queue-attributes \
  --queue-url $QUEUE_URL \
  --attribute-names All

# Receive messages (for debugging)
aws sqs receive-message \
  --queue-url $QUEUE_URL \
  --max-number-of-messages 1 \
  --wait-time-seconds 5

# Purge queue (dev only)
aws sqs purge-queue --queue-url $QUEUE_URL
```

### Test SNS Notifications
```bash
# Publish test message
aws sns publish \
  --topic-arn $TOPIC_ARN \
  --subject "Test Reminder" \
  --message "This is a test notification"

# List subscriptions
aws sns list-subscriptions-by-topic --topic-arn $TOPIC_ARN
```

## Common Workflows

### Add New API Endpoint
1. Add route in `backend/src/handlers/api_handler.py`
2. Add Pydantic models in `backend/src/models/`
3. Add business logic in `backend/src/services/`
4. Add tests in `backend/tests/`
5. Run tests: `pytest tests/ -v`
6. Deploy: `cd infra && npm run deploy:dev`

### Update Frontend UI
1. Edit components in `frontend/src/app/` or `frontend/src/components/`
2. Test locally: `npm run dev`
3. Build: `npm run build`
4. Deploy: `aws s3 sync out/ s3://BUCKET/ && aws cloudfront create-invalidation --distribution-id ID --paths "/*"`

### Add New Infrastructure
1. Edit CDK stacks in `infra/lib/`
2. Compile: `npm run build`
3. Preview changes: `npx cdk diff --all --context env=dev`
4. Deploy: `npm run deploy:dev`

### Update Dependencies
```bash
# Backend
cd backend
pip install --upgrade -r requirements.txt
pip freeze > requirements.txt

# Frontend
cd frontend
npm update
npm audit fix

# Infrastructure
cd infra
npm update
npm audit fix
```

## Environment Variables Reference

### Backend
- `ENV`: Environment (dev/stage/prod)
- `TABLE_NAME`: DynamoDB table name
- `QUEUE_URL`: SQS queue URL
- `TOPIC_ARN`: SNS topic ARN
- `USER_POOL_ID`: Cognito user pool ID
- `REGION`: AWS region
- `LOG_LEVEL`: Logging level (DEBUG/INFO/WARNING/ERROR)

### Frontend
- `NEXT_PUBLIC_API_URL`: API Gateway URL
- `NEXT_PUBLIC_USER_POOL_ID`: Cognito user pool ID
- `NEXT_PUBLIC_USER_POOL_CLIENT_ID`: Cognito app client ID
- `NEXT_PUBLIC_COGNITO_DOMAIN`: Cognito hosted UI domain
- `NEXT_PUBLIC_REGION`: AWS region

## Tips & Tricks

### Fast Iteration
```bash
# Backend: Use --reload for auto-restart
uvicorn src.handlers.api_handler:app --reload

# Frontend: Next.js auto-reloads on file changes
npm run dev

# CDK: Use watch mode
npm run watch
```

### Mock AWS Services Locally
```bash
# Use LocalStack for local AWS services (optional)
docker run -d -p 4566:4566 localstack/localstack

# Configure AWS CLI to use LocalStack
export AWS_ENDPOINT_URL=http://localhost:4566
```

### Debug Lambda Locally
```bash
# Use AWS SAM CLI (optional)
sam local start-api

# Or use Lambda Docker images
docker run -p 9000:8080 public.ecr.aws/lambda/python:3.11
```

### Profile Performance
```python
# Add to backend code
import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()

# Your code here

profiler.disable()
stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(10)
```

## Troubleshooting

### "Module not found" errors
```bash
# Backend: Ensure virtual environment is activated
source venv/bin/activate

# Frontend: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### AWS credentials issues
```bash
# Check credentials
aws sts get-caller-identity

# Reconfigure
aws configure

# Use named profile
export AWS_PROFILE=your-profile
```

### Port already in use
```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 PID

# Or use different port
uvicorn src.handlers.api_handler:app --port 8001
```

### CORS errors
- Check API Gateway CORS configuration in `infra/lib/api-stack.ts`
- Verify `allowOrigins` includes your local URL
- Redeploy API: `cd infra && npm run deploy:dev`

## Next Steps

1. Read [RUNBOOK.md](RUNBOOK.md) for operations
2. Read [ARCHITECTURE.md](ARCHITECTURE.md) for system design
3. Read [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for production deployment
4. Read [PHASE2_MIGRATION.md](PHASE2_MIGRATION.md) for container migration
