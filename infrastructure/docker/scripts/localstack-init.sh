#!/bin/bash
# ===========================================
# LocalStack Initialization Script
# ===========================================
# This script runs when LocalStack is ready

set -e

echo "🚀 Initializing LocalStack services for Skillancer..."

# Wait for LocalStack to be fully ready
sleep 2

# ===========================================
# S3 Buckets
# ===========================================
echo "📦 Creating S3 buckets..."

awslocal s3 mb s3://skillancer-dev-uploads --region us-east-1 || true
awslocal s3 mb s3://skillancer-dev-assets --region us-east-1 || true
awslocal s3 mb s3://skillancer-dev-backups --region us-east-1 || true

# Configure CORS for uploads bucket
awslocal s3api put-bucket-cors --bucket skillancer-dev-uploads --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}'

echo "✅ S3 buckets created"

# ===========================================
# SQS Queues
# ===========================================
echo "📨 Creating SQS queues..."

awslocal sqs create-queue --queue-name skillancer-dev-notifications --region us-east-1 || true
awslocal sqs create-queue --queue-name skillancer-dev-emails --region us-east-1 || true
awslocal sqs create-queue --queue-name skillancer-dev-jobs --region us-east-1 || true
awslocal sqs create-queue --queue-name skillancer-dev-analytics --region us-east-1 || true

# Create dead letter queues
awslocal sqs create-queue --queue-name skillancer-dev-notifications-dlq --region us-east-1 || true
awslocal sqs create-queue --queue-name skillancer-dev-emails-dlq --region us-east-1 || true

echo "✅ SQS queues created"

# ===========================================
# SNS Topics
# ===========================================
echo "📢 Creating SNS topics..."

awslocal sns create-topic --name skillancer-dev-events --region us-east-1 || true
awslocal sns create-topic --name skillancer-dev-notifications --region us-east-1 || true
awslocal sns create-topic --name skillancer-dev-alerts --region us-east-1 || true

echo "✅ SNS topics created"

# ===========================================
# Secrets Manager
# ===========================================
echo "🔐 Creating secrets..."

awslocal secretsmanager create-secret \
  --name skillancer-dev/jwt-secret \
  --secret-string "dev-jwt-secret-change-in-production" \
  --region us-east-1 || true

awslocal secretsmanager create-secret \
  --name skillancer-dev/database-url \
  --secret-string "postgresql://skillancer:skillancer_dev@postgres:5432/skillancer_dev" \
  --region us-east-1 || true

awslocal secretsmanager create-secret \
  --name skillancer-dev/redis-url \
  --secret-string "redis://redis:6379" \
  --region us-east-1 || true

echo "✅ Secrets created"

# ===========================================
# SES Email Identities (for local testing)
# ===========================================
echo "📧 Creating SES identities..."

awslocal ses verify-email-identity --email-address noreply@skillancer.local --region us-east-1 || true
awslocal ses verify-email-identity --email-address support@skillancer.local --region us-east-1 || true

echo "✅ SES identities created"

# ===========================================
# Summary
# ===========================================
echo ""
echo "=========================================="
echo "✅ LocalStack initialization complete!"
echo "=========================================="
echo ""
echo "S3 Buckets:"
echo "  - skillancer-dev-uploads"
echo "  - skillancer-dev-assets"
echo "  - skillancer-dev-backups"
echo ""
echo "SQS Queues:"
echo "  - skillancer-dev-notifications"
echo "  - skillancer-dev-emails"
echo "  - skillancer-dev-jobs"
echo "  - skillancer-dev-analytics"
echo ""
echo "SNS Topics:"
echo "  - skillancer-dev-events"
echo "  - skillancer-dev-notifications"
echo "  - skillancer-dev-alerts"
echo ""
echo "Endpoint: http://localhost:4566"
echo ""
