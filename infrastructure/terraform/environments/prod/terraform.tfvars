# =============================================================================
# Production Environment Variables
# =============================================================================

environment = "prod"
aws_region  = "us-east-1"
domain      = "skillancer.io"

# Certificate must be created/imported before applying
certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"

# VPC Configuration
vpc_cidr = "10.2.0.0/16"

availability_zones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c"
]

public_subnet_cidrs = [
  "10.2.1.0/24",
  "10.2.2.0/24",
  "10.2.3.0/24"
]

private_subnet_cidrs = [
  "10.2.11.0/24",
  "10.2.12.0/24",
  "10.2.13.0/24"
]

database_subnet_cidrs = [
  "10.2.21.0/24",
  "10.2.22.0/24",
  "10.2.23.0/24"
]

# ECS Services
service_names = [
  "api-gateway",
  "auth-svc",
  "market-svc",
  "skillpod-svc",
  "cockpit-svc",
  "billing-svc",
  "notification-svc",
  "audit-svc"
]

# Production service sizing
service_cpu    = 1024
service_memory = 2048

# Container image tag (set during deployment)
container_image_tag = "latest"

# RDS Configuration - Production (Aurora-compatible)
rds_engine_version        = "16.1"
rds_instance_class        = "db.r6g.large"
rds_allocated_storage     = 100
rds_max_allocated_storage = 1000
create_rds_read_replica   = true
rds_read_replica_count    = 1

# Redis Configuration - Production
redis_engine_version = "7.0"
redis_node_type      = "cache.r6g.large"

# ALB Configuration
alb_access_logs_bucket = "skillancer-alb-logs-prod"

# S3 Buckets
s3_bucket_arns = [
  "arn:aws:s3:::skillancer-assets-prod",
  "arn:aws:s3:::skillancer-assets-prod/*",
  "arn:aws:s3:::skillancer-uploads-prod",
  "arn:aws:s3:::skillancer-uploads-prod/*",
  "arn:aws:s3:::skillancer-backups-prod",
  "arn:aws:s3:::skillancer-backups-prod/*"
]

# Alerts
alert_email = "alerts-prod@skillancer.io"
# alert_webhook_url set via environment variable: TF_VAR_alert_webhook_url
# pagerduty_service_key set via environment variable: TF_VAR_pagerduty_service_key
