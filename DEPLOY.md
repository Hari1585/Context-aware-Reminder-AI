# 🚀 Complete Deployment Guide

## ⚠️ BEFORE YOU START

You need to configure AWS CLI first. Run this command:

```bash
aws configure
```

Enter:
- **AWS Access Key ID**: Your AWS access key
- **AWS Secret Access Key**: Your AWS secret key
- **Default region**: `us-east-1`
- **Default output format**: `json`

To verify it works:
```bash
aws sts get-caller-identity
```

You should see your AWS account ID and user ARN.

---

## 📋 STEP-BY-STEP DEPLOYMENT

### Step 1: Prerequisites Setup (5 minutes)

```bash
# 1. Verify AWS CLI is configured
aws sts get-caller-identity

# 2. Save your AWS account ID
$env:AWS_ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
echo $env:AWS_ACCOUNT_ID

# 3. Set your OpenAI API key in AWS SSM
# REPLACE 'sk-YOUR-KEY-HERE' with your actual OpenAI API key
aws ssm put-parameter `
  --name "/reminder-app/dev/openai-api-key" `
  --value "sk-YOUR-OPENAI-API-KEY-HERE" `
  --type SecureString `
  --region us-east-1

# Verify it was created
aws ssm get-parameter --name "/reminder-app/dev/openai-api-key" --with-decryption
```

**✅ Checkpoint**: You should see your account ID and the SSM parameter created.

---

### Step 2: Deploy Infrastructure (10-15 minutes)

```bash
# 1. Go to infra directory
cd infra

# 2. Install CDK dependencies
npm install

# 3. Bootstrap CDK (first time only)
npx cdk bootstrap aws://$env:AWS_ACCOUNT_ID/us-east-1

# 4. Build TypeScript
npm run build

# 5. Preview changes (optional)
npx cdk diff --all --context env=dev

# 6. Deploy all stacks
npm run deploy:dev

# This will take 10-15 minutes and deploy:
# ✅ reminder-app-dev-auth (Cognito)
# ✅ reminder-app-dev-data (DynamoDB)
# ✅ reminder-app-dev-events (SQS + SNS)
# ✅ reminder-app-dev-api (API Gateway + Lambda)
# ✅ reminder-app-dev-frontend (S3 + CloudFront)
# ✅ reminder-app-dev-monitoring (CloudWatch Alarms)
```

**✅ Checkpoint**: All 6 stacks should show "CREATE_COMPLETE" status.

---

### Step 3: Capture Outputs (2 minutes)

```powershell
# Save these values - you'll need them!

# API URL
$env:API_URL = (aws cloudformation describe-stacks `
  --stack-name reminder-app-dev-api `
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' `
  --output text)

# Cognito User Pool ID
$env:USER_POOL_ID = (aws cloudformation describe-stacks `
  --stack-name reminder-app-dev-auth `
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' `
  --output text)

# Cognito Client ID
$env:USER_POOL_CLIENT_ID = (aws cloudformation describe-stacks `
  --stack-name reminder-app-dev-auth `
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' `
  --output text)

# Cognito Domain
$env:COGNITO_DOMAIN = (aws cloudformation describe-stacks `
  --stack-name reminder-app-dev-auth `
  --query 'Stacks[0].Outputs[?OutputKey==`CognitoDomain`].OutputValue' `
  --output text)

# Frontend Bucket
$env:FRONTEND_BUCKET = (aws cloudformation describe-stacks `
  --stack-name reminder-app-dev-frontend `
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' `
  --output text)

# CloudFront Distribution ID
$env:DISTRIBUTION_ID = (aws cloudformation describe-stacks `
  --stack-name reminder-app-dev-frontend `
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' `
  --output text)

# CloudFront URL
$env:DISTRIBUTION_URL = (aws cloudformation describe-stacks `
  --stack-name reminder-app-dev-frontend `
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionUrl`].OutputValue' `
  --output text)

# Print all values
Write-Host "API_URL: $env:API_URL"
Write-Host "USER_POOL_ID: $env:USER_POOL_ID"
Write-Host "USER_POOL_CLIENT_ID: $env:USER_POOL_CLIENT_ID"
Write-Host "COGNITO_DOMAIN: $env:COGNITO_DOMAIN"
Write-Host "FRONTEND_BUCKET: $env:FRONTEND_BUCKET"
Write-Host "DISTRIBUTION_ID: $env:DISTRIBUTION_ID"
Write-Host "DISTRIBUTION_URL: $env:DISTRIBUTION_URL"

# Save to file for later use
@"
API_URL=$env:API_URL
USER_POOL_ID=$env:USER_POOL_ID
USER_POOL_CLIENT_ID=$env:USER_POOL_CLIENT_ID
COGNITO_DOMAIN=$env:COGNITO_DOMAIN
FRONTEND_BUCKET=$env:FRONTEND_BUCKET
DISTRIBUTION_ID=$env:DISTRIBUTION_ID
DISTRIBUTION_URL=$env:DISTRIBUTION_URL
"@ | Out-File -FilePath ..\deployment-outputs.txt
```

**✅ Checkpoint**: All values should be populated (not empty).

---

### Step 4: Deploy Frontend (5 minutes)

```bash
# 1. Go to frontend directory
cd ..\frontend

# 2. Install dependencies
npm install

# 3. Create environment file
@"
NEXT_PUBLIC_API_URL=$env:API_URL
NEXT_PUBLIC_USER_POOL_ID=$env:USER_POOL_ID
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$env:USER_POOL_CLIENT_ID
NEXT_PUBLIC_COGNITO_DOMAIN=$env:COGNITO_DOMAIN
NEXT_PUBLIC_REGION=us-east-1
"@ | Out-File -FilePath .env.local -Encoding utf8

# 4. Build static site
npm run build

# 5. Upload to S3
aws s3 sync out/ s3://$env:FRONTEND_BUCKET/ --delete

# 6. Invalidate CloudFront cache
aws cloudfront create-invalidation `
  --distribution-id $env:DISTRIBUTION_ID `
  --paths "/*"
```

**✅ Checkpoint**: Files uploaded to S3, CloudFront invalidation created.

---

### Step 5: Update Cognito Callback URLs (2 minutes)

```powershell
# Add CloudFront URL to Cognito allowed callbacks
aws cognito-idp update-user-pool-client `
  --user-pool-id $env:USER_POOL_ID `
  --client-id $env:USER_POOL_CLIENT_ID `
  --callback-urls "http://localhost:3000/callback" "$env:DISTRIBUTION_URL/callback" `
  --logout-urls "http://localhost:3000" "$env:DISTRIBUTION_URL"

Write-Host "✅ Cognito callback URLs updated"
```

**✅ Checkpoint**: Command completes without errors.

---

### Step 6: Subscribe to Notifications (2 minutes)

```powershell
# Get SNS topic ARN
$env:TOPIC_ARN = (aws cloudformation describe-stacks `
  --stack-name reminder-app-dev-events `
  --query 'Stacks[0].Outputs[?OutputKey==`NotificationTopicArn`].OutputValue' `
  --output text)

Write-Host "Topic ARN: $env:TOPIC_ARN"

# Subscribe your email (REPLACE with your actual email)
aws sns subscribe `
  --topic-arn $env:TOPIC_ARN `
  --protocol email `
  --notification-endpoint YOUR-EMAIL@example.com

Write-Host "✅ Check your email and confirm the subscription!"
```

**✅ Checkpoint**: Check your email for SNS subscription confirmation.

---

### Step 7: Test the Application (5 minutes)

```powershell
# 1. Open the app in browser
Write-Host "🌐 Open this URL in your browser:"
Write-Host $env:DISTRIBUTION_URL
Start-Process $env:DISTRIBUTION_URL

# 2. Sign up / Sign in via Cognito
Write-Host "📝 Create an account or sign in"

# 3. Create a test reminder in the UI:
# "Remind me to buy milk when I arrive at Walmart"

# 4. Check if it was created
Write-Host "`n📊 Checking DynamoDB for reminders..."
aws dynamodb scan `
  --table-name reminder-app-dev-reminders `
  --max-items 5

# 5. Monitor Lambda logs (in separate terminal)
Write-Host "`n📋 To monitor logs, run in separate terminals:"
Write-Host "aws logs tail /aws/lambda/reminder-app-dev-api --follow"
Write-Host "aws logs tail /aws/lambda/reminder-app-dev-evaluator --follow"
```

**✅ Checkpoint**: App loads, you can sign in, create reminders.

---

### Step 8: Test Enhanced Features (5 minutes)

Try creating these enhanced reminder types in the UI:

```
✅ "Every time I arrive at the gym, remind me to bring my belt"
   → Tests: Recurring + Arrival trigger

✅ "When I leave office, remind me to call mom"
   → Tests: Departure trigger

✅ "If I'm near Target after 6pm, remind me to buy batteries"
   → Tests: Time window

✅ "Urgent: remind me to pick up prescription at pharmacy"
   → Tests: Priority

✅ "Remind me to get gas when I'm within 1 mile of Shell"
   → Tests: Custom radius
```

**✅ Checkpoint**: All reminder types are created successfully.

---

## 🎉 DEPLOYMENT COMPLETE!

### Your Application URLs

```powershell
# Print all important URLs
Write-Host "`n🎉 DEPLOYMENT COMPLETE!"
Write-Host "`n📱 Application URL:"
Write-Host $env:DISTRIBUTION_URL
Write-Host "`n🔐 Cognito Login URL:"
Write-Host "https://$env:COGNITO_DOMAIN/login?client_id=$env:USER_POOL_CLIENT_ID&response_type=code&redirect_uri=$env:DISTRIBUTION_URL/callback"
Write-Host "`n🔧 API URL:"
Write-Host $env:API_URL
```

---

## 📊 Monitoring Commands

```powershell
# API Logs
aws logs tail /aws/lambda/reminder-app-dev-api --follow

# Evaluator Logs
aws logs tail /aws/lambda/reminder-app-dev-evaluator --follow

# Check DynamoDB
aws dynamodb scan --table-name reminder-app-dev-reminders --max-items 10

# Check SQS Queue
$QUEUE_URL = (aws cloudformation describe-stacks `
  --stack-name reminder-app-dev-events `
  --query 'Stacks[0].Outputs[?OutputKey==`LocationQueueUrl`].OutputValue' `
  --output text)
aws sqs get-queue-attributes `
  --queue-url $QUEUE_URL `
  --attribute-names ApproximateNumberOfMessages
```

---

## 🆘 Troubleshooting

### If deployment fails:
```powershell
# Check CloudFormation events
aws cloudformation describe-stack-events `
  --stack-name reminder-app-dev-api `
  --max-items 20

# Destroy and redeploy
cd infra
npx cdk destroy --all --context env=dev --force
npm run deploy:dev
```

### If frontend doesn't load:
```powershell
# Re-upload frontend
cd frontend
aws s3 sync out/ s3://$env:FRONTEND_BUCKET/ --delete
aws cloudfront create-invalidation --distribution-id $env:DISTRIBUTION_ID --paths "/*"
```

### If you get 401 errors:
- Clear browser cache
- Sign out and sign in again
- Check Cognito callback URLs are correct

---

## 📋 Deployment Checklist

- [ ] AWS CLI configured (`aws configure`)
- [ ] OpenAI API key in SSM
- [ ] CDK bootstrapped
- [ ] Infrastructure deployed (6 stacks)
- [ ] Outputs captured and saved
- [ ] Frontend built and uploaded
- [ ] CloudFront invalidated
- [ ] Cognito callback URLs updated
- [ ] SNS email subscription confirmed
- [ ] Test reminder created
- [ ] Enhanced features tested

---

## 🎯 What's Next?

1. **Test all features** - Try different reminder types
2. **Enable location services** - In browser settings
3. **Post location events** - Via Settings page
4. **Monitor notifications** - Check your email
5. **Review logs** - Check for any errors
6. **Invite team members** - Create more Cognito users

---

## 📚 Documentation

- `README.md` - Project overview
- `docs/RUNBOOK.md` - Operations guide
- `docs/USE_CASES.md` - Feature coverage (20/44 use cases)
- `docs/ENHANCED_FEATURES_GUIDE.md` - How to use features
- `docs/DEPLOYMENT_CHECKLIST.md` - Detailed deployment
- `docs/LOCAL_DEVELOPMENT.md` - Local dev setup

---

## 💰 Cost Estimate

**Dev Environment** (~10 users):
- Lambda: $5/month
- DynamoDB: $5/month
- API Gateway: $3/month
- SQS: $1/month
- CloudFront: $5/month
- **Total: ~$20/month**

Monitor costs: https://console.aws.amazon.com/cost-management/home

---

**You're all set! Follow the steps above in order.** 🚀
