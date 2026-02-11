# Deployment Checklist

## Pre-Deployment

### AWS Account Setup
- [ ] AWS CLI installed and configured
- [ ] AWS account ID verified: `aws sts get-caller-identity`
- [ ] Region set (default: us-east-1)
- [ ] Sufficient service quotas (Lambda, DynamoDB, API Gateway)

### Secrets & Parameters
- [ ] OpenAI API key obtained
- [ ] OpenAI API key stored in SSM Parameter Store:
  ```bash
  aws ssm put-parameter \
    --name "/reminder-app/dev/openai-api-key" \
    --value "sk-YOUR-KEY" \
    --type SecureString \
    --region us-east-1
  ```

### GitHub Setup (for CI/CD)
- [ ] Repository created
- [ ] OIDC provider created in AWS IAM
- [ ] IAM role created with trust policy
- [ ] GitHub secrets configured:
  - `AWS_ROLE_ARN`
  - `AWS_ACCOUNT_ID`

### Local Development Tools
- [ ] Node.js 20+ installed
- [ ] Python 3.11+ installed
- [ ] AWS CDK CLI installed: `npm install -g aws-cdk`

## Infrastructure Deployment

### CDK Bootstrap (First Time Only)
- [ ] Bootstrap CDK:
  ```bash
  cd infra
  npm install
  export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  export AWS_REGION=us-east-1
  npx cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
  ```

### Deploy Dev Environment
- [ ] Deploy all stacks:
  ```bash
  cd infra
  npm run deploy:dev
  ```
- [ ] Verify stack outputs:
  ```bash
  aws cloudformation describe-stacks --stack-name reminder-app-dev-auth --query 'Stacks[0].Outputs'
  aws cloudformation describe-stacks --stack-name reminder-app-dev-api --query 'Stacks[0].Outputs'
  aws cloudformation describe-stacks --stack-name reminder-app-dev-frontend --query 'Stacks[0].Outputs'
  ```

### Capture Outputs
- [ ] API URL: `_______________________________`
- [ ] User Pool ID: `_______________________________`
- [ ] User Pool Client ID: `_______________________________`
- [ ] Cognito Domain: `_______________________________`
- [ ] Frontend Bucket: `_______________________________`
- [ ] Distribution ID: `_______________________________`
- [ ] Distribution URL: `_______________________________`
- [ ] SNS Topic ARN: `_______________________________`

## Frontend Deployment

### Build & Deploy
- [ ] Install dependencies:
  ```bash
  cd frontend
  npm install
  ```
- [ ] Create `.env.local` with CDK outputs
- [ ] Build frontend:
  ```bash
  npm run build
  ```
- [ ] Upload to S3:
  ```bash
  aws s3 sync out/ s3://FRONTEND_BUCKET/ --delete
  ```
- [ ] Invalidate CloudFront:
  ```bash
  aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
  ```

### Update Cognito
- [ ] Add CloudFront URL to Cognito callback URLs:
  - Go to AWS Console → Cognito → User Pools → reminder-app-dev
  - App clients → Edit
  - Add callback URL: `https://DISTRIBUTION_URL/callback`
  - Add logout URL: `https://DISTRIBUTION_URL`
- [ ] Or via CLI:
  ```bash
  aws cognito-idp update-user-pool-client \
    --user-pool-id USER_POOL_ID \
    --client-id USER_POOL_CLIENT_ID \
    --callback-urls "http://localhost:3000/callback" "https://DISTRIBUTION_URL/callback" \
    --logout-urls "http://localhost:3000" "https://DISTRIBUTION_URL"
  ```

## Post-Deployment Verification

### Health Checks
- [ ] API health check:
  ```bash
  curl https://API_URL/dev/health
  ```
  Expected: `{"status":"healthy","env":"dev"}`

- [ ] Frontend loads:
  - Open `https://DISTRIBUTION_URL` in browser
  - Verify login page appears

### Authentication Test
- [ ] Sign up new user via Cognito Hosted UI
- [ ] Verify email confirmation
- [ ] Sign in successfully
- [ ] JWT token stored in browser

### End-to-End Test
- [ ] Create reminder via UI: "Buy milk near Walmart"
- [ ] Verify reminder appears in list
- [ ] Check DynamoDB:
  ```bash
  aws dynamodb scan --table-name reminder-app-dev-reminders --max-items 5
  ```
- [ ] Post location event (via browser or curl)
- [ ] Check evaluator Lambda logs:
  ```bash
  aws logs tail /aws/lambda/reminder-app-dev-evaluator --follow
  ```

### Notification Setup
- [ ] Subscribe to SNS topic:
  ```bash
  aws sns subscribe \
    --topic-arn TOPIC_ARN \
    --protocol email \
    --notification-endpoint your-email@example.com
  ```
- [ ] Confirm subscription via email
- [ ] Test notification by triggering reminder

## Monitoring Setup

### CloudWatch Alarms
- [ ] Verify alarms created:
  ```bash
  aws cloudwatch describe-alarms --alarm-name-prefix reminder-app-dev
  ```
- [ ] Subscribe to alarm SNS topic (optional):
  ```bash
  aws sns subscribe \
    --topic-arn ALARM_TOPIC_ARN \
    --protocol email \
    --notification-endpoint ops-team@example.com
  ```

### Dashboards
- [ ] Create CloudWatch dashboard (optional):
  - API Gateway metrics
  - Lambda metrics
  - DynamoDB metrics
  - SQS metrics

## Production Deployment

### Pre-Production Checklist
- [ ] All dev tests passing
- [ ] Load testing completed
- [ ] Security review completed
- [ ] Cost estimation reviewed
- [ ] Backup strategy documented
- [ ] Rollback plan tested

### Deploy Production
- [ ] Create SSM parameter for prod:
  ```bash
  aws ssm put-parameter \
    --name "/reminder-app/prod/openai-api-key" \
    --value "sk-YOUR-KEY" \
    --type SecureString \
    --region us-east-1
  ```
- [ ] Deploy infrastructure:
  ```bash
  cd infra
  npm run deploy:prod
  ```
- [ ] Deploy frontend (same steps as dev)
- [ ] Update Cognito callback URLs for prod
- [ ] Subscribe to SNS notifications
- [ ] Configure custom domain (optional)
- [ ] Set up ACM certificate (optional)

### Production Verification
- [ ] Health check passes
- [ ] Authentication works
- [ ] Create test reminder
- [ ] Trigger test notification
- [ ] Monitor for 24 hours
- [ ] Review CloudWatch metrics
- [ ] Review costs in Cost Explorer

## Rollback Procedures

### Infrastructure Rollback
- [ ] Document current version/commit
- [ ] Test rollback in dev first
- [ ] Rollback command:
  ```bash
  git checkout PREVIOUS_COMMIT
  cd infra
  npm run deploy:prod
  ```

### Frontend Rollback
- [ ] List S3 versions:
  ```bash
  aws s3api list-object-versions --bucket BUCKET --prefix index.html
  ```
- [ ] Restore previous version
- [ ] Invalidate CloudFront

## Cleanup (Dev Environment)

### Delete Resources
- [ ] Delete all stacks:
  ```bash
  cd infra
  npx cdk destroy --all --context env=dev --force
  ```
- [ ] Delete SSM parameters:
  ```bash
  aws ssm delete-parameter --name "/reminder-app/dev/openai-api-key"
  ```
- [ ] Verify deletion:
  ```bash
  aws cloudformation list-stacks --stack-status-filter DELETE_COMPLETE
  ```

## Troubleshooting

### Common Issues

#### CDK Deploy Fails
- Check AWS credentials: `aws sts get-caller-identity`
- Check CDK bootstrap: `cdk bootstrap`
- Check service quotas
- Review CloudFormation events

#### Frontend Not Loading
- Check S3 bucket has files
- Check CloudFront distribution status
- Check browser console for errors
- Verify CORS configuration

#### API Returns 401
- Check Cognito token expiration
- Verify authorization header
- Check API Gateway authorizer

#### Reminders Not Triggering
- Check evaluator Lambda logs
- Check SQS queue depth
- Check DLQ for failures
- Verify geofence calculation

#### High Costs
- Check Cost Explorer
- Review DynamoDB capacity
- Review Lambda invocations
- Review CloudFront data transfer

## Support Contacts

- AWS Support: [AWS Support Center](https://console.aws.amazon.com/support/)
- GitHub Issues: [Repository Issues](https://github.com/your-org/reminder-app/issues)
- Team Email: ops-team@example.com

## Sign-Off

Deployment completed by: ___________________

Date: ___________________

Environment: [ ] Dev [ ] Stage [ ] Prod

Verified by: ___________________

Date: ___________________
