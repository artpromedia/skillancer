#!/bin/bash
# ===========================================
# LocalStack Test Initialization Script
# ===========================================
# This script runs when LocalStack test container is ready

set -e

echo "🧪 Initializing LocalStack services for Skillancer Tests..."

# Wait for LocalStack to be fully ready
sleep 2

# ===========================================
# S3 Buckets
# ===========================================
echo "📦 Creating test S3 buckets..."

awslocal s3 mb s3://skillancer-test-uploads --region us-east-1 || true
awslocal s3 mb s3://skillancer-test-assets --region us-east-1 || true
awslocal s3 mb s3://skillancer-test-backups --region us-east-1 || true

# Configure CORS for uploads bucket
awslocal s3api put-bucket-cors --bucket skillancer-test-uploads --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}'

echo "✅ Test S3 buckets created"

# ===========================================
# SQS Queues
# ===========================================
echo "📨 Creating test SQS queues..."

awslocal sqs create-queue --queue-name skillancer-test-notifications --region us-east-1 || true
awslocal sqs create-queue --queue-name skillancer-test-emails --region us-east-1 || true
awslocal sqs create-queue --queue-name skillancer-test-jobs --region us-east-1 || true
awslocal sqs create-queue --queue-name skillancer-test-webhooks --region us-east-1 || true

# Create dead letter queues
awslocal sqs create-queue --queue-name skillancer-test-notifications-dlq --region us-east-1 || true
awslocal sqs create-queue --queue-name skillancer-test-emails-dlq --region us-east-1 || true

echo "✅ Test SQS queues created"

# ===========================================
# SES Email Identities
# ===========================================
echo "📧 Configuring test SES..."

awslocal ses verify-email-identity --email-address test@skillancer.io --region us-east-1 || true
awslocal ses verify-email-identity --email-address noreply@skillancer.io --region us-east-1 || true

echo "✅ Test SES configured"

# ===========================================
# DynamoDB Tables
# ===========================================
echo "📊 Creating test DynamoDB tables..."

# Sessions table for testing
awslocal dynamodb create-table \
    --table-name skillancer-test-sessions \
    --attribute-definitions AttributeName=sessionId,AttributeType=S \
    --key-schema AttributeName=sessionId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1 2>/dev/null || true

# Rate limiting table
awslocal dynamodb create-table \
    --table-name skillancer-test-rate-limits \
    --attribute-definitions AttributeName=key,AttributeType=S \
    --key-schema AttributeName=key,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1 2>/dev/null || true

echo "✅ Test DynamoDB tables created"

# ===========================================
# Summary
# ===========================================
echo ""
echo "🎉 LocalStack test initialization complete!"
echo ""
echo "Test S3 Buckets:"
echo "  - skillancer-test-uploads"
echo "  - skillancer-test-assets"
echo "  - skillancer-test-backups"
echo ""
echo "Test SQS Queues:"
echo "  - skillancer-test-notifications"
echo "  - skillancer-test-emails"
echo "  - skillancer-test-jobs"
echo "  - skillancer-test-webhooks"
echo ""
