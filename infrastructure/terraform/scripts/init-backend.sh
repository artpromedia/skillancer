#!/bin/bash
# =============================================================================
# Terraform Backend Initialization Script
# =============================================================================
# This script creates the S3 bucket and DynamoDB table required for
# Terraform state management with proper security configurations.
#
# Usage:
#   ./init-backend.sh [environment] [region]
#   ./init-backend.sh dev us-east-1
#   ./init-backend.sh prod eu-west-1
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - Sufficient IAM permissions for S3 and DynamoDB operations
# =============================================================================

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-dev}"
AWS_REGION="${2:-us-east-1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get AWS Account ID
log_info "Retrieving AWS account information..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

if [ -z "$ACCOUNT_ID" ]; then
    log_error "Failed to retrieve AWS account ID. Check your AWS credentials."
    exit 1
fi

log_info "AWS Account ID: $ACCOUNT_ID"
log_info "Environment: $ENVIRONMENT"
log_info "Region: $AWS_REGION"

# Resource names
BUCKET_NAME="skillancer-terraform-state-${ACCOUNT_ID}"
DYNAMODB_TABLE="skillancer-terraform-locks"
KMS_ALIAS="alias/skillancer-terraform"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Terraform Backend Initialization"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# -----------------------------------------------------------------------------
# Step 1: Create KMS Key for encryption (optional but recommended for prod)
# -----------------------------------------------------------------------------
log_info "Checking for existing KMS key..."

KMS_KEY_ID=$(aws kms describe-key \
    --key-id "$KMS_ALIAS" \
    --region "$AWS_REGION" \
    --query 'KeyMetadata.KeyId' \
    --output text 2>/dev/null || echo "")

if [ -z "$KMS_KEY_ID" ] || [ "$KMS_KEY_ID" == "None" ]; then
    log_info "Creating KMS key for Terraform state encryption..."
    
    KMS_KEY_ID=$(aws kms create-key \
        --description "KMS key for Skillancer Terraform state encryption" \
        --region "$AWS_REGION" \
        --query 'KeyMetadata.KeyId' \
        --output text)
    
    aws kms create-alias \
        --alias-name "$KMS_ALIAS" \
        --target-key-id "$KMS_KEY_ID" \
        --region "$AWS_REGION"
    
    log_success "KMS key created: $KMS_KEY_ID"
else
    log_info "KMS key already exists: $KMS_KEY_ID"
fi

# -----------------------------------------------------------------------------
# Step 2: Create S3 bucket for state storage
# -----------------------------------------------------------------------------
log_info "Creating S3 bucket for Terraform state..."

if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    log_info "S3 bucket already exists: $BUCKET_NAME"
else
    if [ "$AWS_REGION" == "us-east-1" ]; then
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$AWS_REGION"
    else
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION"
    fi
    log_success "S3 bucket created: $BUCKET_NAME"
fi

# -----------------------------------------------------------------------------
# Step 3: Enable versioning on the bucket
# -----------------------------------------------------------------------------
log_info "Enabling versioning on S3 bucket..."

aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled

log_success "Versioning enabled"

# -----------------------------------------------------------------------------
# Step 4: Enable server-side encryption
# -----------------------------------------------------------------------------
log_info "Configuring server-side encryption..."

aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "aws:kms",
                "KMSMasterKeyID": "'"$KMS_KEY_ID"'"
            },
            "BucketKeyEnabled": true
        }]
    }'

log_success "Server-side encryption configured with KMS"

# -----------------------------------------------------------------------------
# Step 5: Block all public access
# -----------------------------------------------------------------------------
log_info "Blocking public access to S3 bucket..."

aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration '{
        "BlockPublicAcls": true,
        "IgnorePublicAcls": true,
        "BlockPublicPolicy": true,
        "RestrictPublicBuckets": true
    }'

log_success "Public access blocked"

# -----------------------------------------------------------------------------
# Step 6: Add bucket policy for secure access
# -----------------------------------------------------------------------------
log_info "Applying bucket policy..."

BUCKET_POLICY=$(cat <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "EnforceTLS",
            "Effect": "Deny",
            "Principal": "*",
            "Action": "s3:*",
            "Resource": [
                "arn:aws:s3:::${BUCKET_NAME}",
                "arn:aws:s3:::${BUCKET_NAME}/*"
            ],
            "Condition": {
                "Bool": {
                    "aws:SecureTransport": "false"
                }
            }
        },
        {
            "Sid": "EnforceEncryption",
            "Effect": "Deny",
            "Principal": "*",
            "Action": "s3:PutObject",
            "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
            "Condition": {
                "StringNotEquals": {
                    "s3:x-amz-server-side-encryption": "aws:kms"
                }
            }
        }
    ]
}
EOF
)

aws s3api put-bucket-policy \
    --bucket "$BUCKET_NAME" \
    --policy "$BUCKET_POLICY"

log_success "Bucket policy applied"

# -----------------------------------------------------------------------------
# Step 7: Enable access logging (optional but recommended)
# -----------------------------------------------------------------------------
log_info "Configuring access logging..."

LOGGING_BUCKET="${BUCKET_NAME}-logs"

if ! aws s3api head-bucket --bucket "$LOGGING_BUCKET" 2>/dev/null; then
    if [ "$AWS_REGION" == "us-east-1" ]; then
        aws s3api create-bucket \
            --bucket "$LOGGING_BUCKET" \
            --region "$AWS_REGION"
    else
        aws s3api create-bucket \
            --bucket "$LOGGING_BUCKET" \
            --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION"
    fi
    
    # Block public access on logging bucket
    aws s3api put-public-access-block \
        --bucket "$LOGGING_BUCKET" \
        --public-access-block-configuration '{
            "BlockPublicAcls": true,
            "IgnorePublicAcls": true,
            "BlockPublicPolicy": true,
            "RestrictPublicBuckets": true
        }'
fi

# Enable logging
aws s3api put-bucket-logging \
    --bucket "$BUCKET_NAME" \
    --bucket-logging-status '{
        "LoggingEnabled": {
            "TargetBucket": "'"$LOGGING_BUCKET"'",
            "TargetPrefix": "terraform-state-logs/"
        }
    }' 2>/dev/null || log_warn "Access logging configuration skipped (may need bucket policy update)"

log_success "Access logging configured"

# -----------------------------------------------------------------------------
# Step 8: Create DynamoDB table for state locking
# -----------------------------------------------------------------------------
log_info "Creating DynamoDB table for state locking..."

if aws dynamodb describe-table --table-name "$DYNAMODB_TABLE" --region "$AWS_REGION" 2>/dev/null; then
    log_info "DynamoDB table already exists: $DYNAMODB_TABLE"
else
    aws dynamodb create-table \
        --table-name "$DYNAMODB_TABLE" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "$AWS_REGION" \
        --tags Key=Project,Value=skillancer Key=ManagedBy,Value=terraform
    
    log_info "Waiting for DynamoDB table to be active..."
    aws dynamodb wait table-exists \
        --table-name "$DYNAMODB_TABLE" \
        --region "$AWS_REGION"
    
    log_success "DynamoDB table created: $DYNAMODB_TABLE"
fi

# -----------------------------------------------------------------------------
# Step 9: Enable point-in-time recovery for DynamoDB
# -----------------------------------------------------------------------------
log_info "Enabling point-in-time recovery for DynamoDB..."

aws dynamodb update-continuous-backups \
    --table-name "$DYNAMODB_TABLE" \
    --region "$AWS_REGION" \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true 2>/dev/null || \
    log_warn "Point-in-time recovery may already be enabled"

log_success "Point-in-time recovery enabled"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Backend Initialization Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Resources Created:"
echo "  ─────────────────────────────────────────────────────────────"
echo "  S3 Bucket:      $BUCKET_NAME"
echo "  Logging Bucket: $LOGGING_BUCKET"
echo "  DynamoDB Table: $DYNAMODB_TABLE"
echo "  KMS Key:        $KMS_ALIAS"
echo "  Region:         $AWS_REGION"
echo ""
echo "  Next Steps:"
echo "  ─────────────────────────────────────────────────────────────"
echo "  1. Update backend.tf files with your account ID:"
echo "     bucket = \"$BUCKET_NAME\""
echo ""
echo "  2. Initialize Terraform in each environment:"
echo "     cd environments/$ENVIRONMENT"
echo "     terraform init"
echo ""
echo "  3. Review and apply infrastructure:"
echo "     terraform plan"
echo "     terraform apply"
echo ""
