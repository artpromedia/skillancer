# =============================================================================
# Terraform Variables - Staging Environment
# =============================================================================

environment = "staging"
aws_region  = "us-east-1"

domain          = "staging.skillancer.com"
certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERTIFICATE_ID"

vpc_cidr              = "10.1.0.0/16"
availability_zones    = []
public_subnet_cidrs   = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
private_subnet_cidrs  = ["10.1.11.0/24", "10.1.12.0/24", "10.1.13.0/24"]
database_subnet_cidrs = ["10.1.21.0/24", "10.1.22.0/24", "10.1.23.0/24"]

service_cpu         = 512
service_memory      = 1024
container_image_tag = "staging"

rds_engine_version        = "16.1"
rds_instance_class        = "db.t3.small"
rds_allocated_storage     = 50
rds_max_allocated_storage = 200

redis_engine_version = "7.0"
redis_node_type      = "cache.t3.small"

alb_access_logs_bucket = "skillancer-staging-alb-logs"
alert_email            = "staging-alerts@skillancer.com"
