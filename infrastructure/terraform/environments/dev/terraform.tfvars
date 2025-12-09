# =============================================================================
# Terraform Variables - Development Environment
# =============================================================================
# This file contains environment-specific variable values.
# Update values as needed for your development environment.
# =============================================================================

# =============================================================================
# General Configuration
# =============================================================================

environment = "dev"
aws_region  = "us-east-1"

# =============================================================================
# Domain Configuration
# =============================================================================
# Update these with your actual domain and certificate ARN

domain          = "dev.skillancer.com"
certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERTIFICATE_ID"

# =============================================================================
# VPC Configuration
# =============================================================================

vpc_cidr = "10.0.0.0/16"

# Leave empty to auto-detect availability zones
availability_zones = []

# Subnet CIDRs
public_subnet_cidrs   = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
private_subnet_cidrs  = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
database_subnet_cidrs = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]

# VPC Flow Logs (disabled in dev to save costs)
enable_vpc_flow_logs = false

# =============================================================================
# ECS Configuration
# =============================================================================

# Default container resources (minimal for dev)
service_cpu    = 256
service_memory = 512

# Container image tag
container_image_tag = "latest"

# Enable Container Insights
enable_container_insights = true

# =============================================================================
# RDS Configuration
# =============================================================================

rds_engine_version        = "16.1"
rds_instance_class        = "db.t3.micro"
rds_allocated_storage     = 20
rds_max_allocated_storage = 100

# =============================================================================
# ElastiCache Configuration
# =============================================================================

redis_engine_version = "7.0"
redis_node_type      = "cache.t3.micro"

# =============================================================================
# Monitoring Configuration
# =============================================================================

# Email for CloudWatch alerts (leave empty to skip alert setup)
alert_email = ""
