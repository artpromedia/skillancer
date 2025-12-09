# =============================================================================
# Networking Module - Main Configuration
# =============================================================================
# This module creates a complete VPC infrastructure with:
# - Public subnets for load balancers
# - Private subnets for application services (ECS)
# - Database subnets for RDS and ElastiCache
# - NAT Gateway(s) for outbound internet access
# - VPC endpoints for AWS services
# - Security groups for network isolation
# - VPC Flow Logs for traffic analysis
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_region" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  # Use provided AZs or discover available ones
  azs      = length(var.availability_zones) > 0 ? var.availability_zones : slice(data.aws_availability_zones.available.names, 0, 3)
  az_count = length(local.azs)

  # Calculate subnet CIDRs dynamically if not provided
  # VPC /16 divided into /20 subnets (4096 IPs each)
  # Public:   10.x.0.0/20,  10.x.16.0/20,  10.x.32.0/20
  # Private:  10.x.48.0/20, 10.x.64.0/20,  10.x.80.0/20
  # Database: 10.x.96.0/20, 10.x.112.0/20, 10.x.128.0/20
  
  public_subnets = length(var.public_subnet_cidrs) > 0 ? var.public_subnet_cidrs : [
    for i in range(local.az_count) : cidrsubnet(var.vpc_cidr, 4, i)
  ]

  private_subnets = length(var.private_subnet_cidrs) > 0 ? var.private_subnet_cidrs : [
    for i in range(local.az_count) : cidrsubnet(var.vpc_cidr, 4, i + local.az_count)
  ]

  database_subnets = length(var.database_subnet_cidrs) > 0 ? var.database_subnet_cidrs : [
    for i in range(local.az_count) : cidrsubnet(var.vpc_cidr, 4, i + (local.az_count * 2))
  ]

  # Availability zone names
  az_names = local.azs

  # Common tags
  common_tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
  })

  # Name prefix
  name_prefix = var.name_prefix != null ? var.name_prefix : "${var.project}-${var.environment}"
}
