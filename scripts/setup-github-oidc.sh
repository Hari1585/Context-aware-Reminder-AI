#!/bin/bash
# Script to set up GitHub OIDC provider in AWS

set -e

GITHUB_ORG="your-org"
GITHUB_REPO="reminder-app"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Setting up GitHub OIDC for $GITHUB_ORG/$GITHUB_REPO"

# Create OIDC provider (if not exists)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  2>/dev/null || echo "OIDC provider already exists"

# Create trust policy
cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_ORG}/${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

# Create IAM role
ROLE_NAME="GitHubActionsRole-${GITHUB_REPO}"
aws iam create-role \
  --role-name $ROLE_NAME \
  --assume-role-policy-document file:///tmp/trust-policy.json \
  --description "Role for GitHub Actions to deploy ${GITHUB_REPO}" \
  2>/dev/null || echo "Role already exists"

# Attach policies (adjust as needed for least privilege)
aws iam attach-role-policy \
  --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

aws iam attach-role-policy \
  --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/IAMFullAccess

ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Add these secrets to your GitHub repository:"
echo "  AWS_ROLE_ARN: $ROLE_ARN"
echo "  AWS_ACCOUNT_ID: $AWS_ACCOUNT_ID"
echo ""
echo "Go to: https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/settings/secrets/actions"
