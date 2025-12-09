# =============================================================================
# Outputs - Production Environment
# =============================================================================

# -----------------------------------------------------------------------------
# VPC Outputs
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.networking.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.networking.private_subnet_ids
}

output "database_subnet_ids" {
  description = "IDs of database subnets"
  value       = module.networking.database_subnet_ids
}

output "nat_gateway_ips" {
  description = "Elastic IPs of NAT gateways"
  value       = module.networking.nat_gateway_ips
}

# -----------------------------------------------------------------------------
# ECS Outputs
# -----------------------------------------------------------------------------

output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = module.ecs_cluster.cluster_id
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = module.ecs_cluster.cluster_arn
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs_cluster.cluster_name
}

output "ecs_service_arns" {
  description = "ARNs of ECS services"
  value       = { for k, v in module.ecs_services : k => v.service_arn }
}

output "ecs_service_names" {
  description = "Names of ECS services"
  value       = { for k, v in module.ecs_services : k => v.service_name }
}

# -----------------------------------------------------------------------------
# RDS Outputs
# -----------------------------------------------------------------------------

output "rds_cluster_endpoint" {
  description = "Writer endpoint of the RDS cluster"
  value       = module.rds.cluster_endpoint
}

output "rds_reader_endpoint" {
  description = "Reader endpoint of the RDS cluster"
  value       = module.rds.reader_endpoint
}

output "rds_cluster_arn" {
  description = "ARN of the RDS cluster"
  value       = module.rds.cluster_arn
}

output "rds_cluster_id" {
  description = "Identifier of the RDS cluster"
  value       = module.rds.cluster_id
}

output "rds_security_group_id" {
  description = "Security group ID for RDS"
  value       = module.rds.security_group_id
}

# -----------------------------------------------------------------------------
# ElastiCache Outputs
# -----------------------------------------------------------------------------

output "redis_endpoint" {
  description = "Primary endpoint for Redis cluster"
  value       = module.elasticache.primary_endpoint
}

output "redis_reader_endpoint" {
  description = "Reader endpoint for Redis cluster"
  value       = module.elasticache.reader_endpoint
}

output "redis_port" {
  description = "Port for Redis connections"
  value       = module.elasticache.port
}

output "redis_security_group_id" {
  description = "Security group ID for Redis"
  value       = module.elasticache.security_group_id
}

# -----------------------------------------------------------------------------
# ALB Outputs
# -----------------------------------------------------------------------------

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = module.alb.alb_arn
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the ALB"
  value       = module.alb.alb_zone_id
}

output "alb_https_listener_arn" {
  description = "ARN of the HTTPS listener"
  value       = module.alb.https_listener_arn
}

output "alb_security_group_id" {
  description = "Security group ID of the ALB"
  value       = module.alb.security_group_id
}

# -----------------------------------------------------------------------------
# ECR Outputs
# -----------------------------------------------------------------------------

output "ecr_repository_urls" {
  description = "URLs of ECR repositories"
  value       = { for k, v in module.ecr : k => v.repository_url }
}

output "ecr_repository_arns" {
  description = "ARNs of ECR repositories"
  value       = { for k, v in module.ecr : k => v.repository_arn }
}

# -----------------------------------------------------------------------------
# Secrets Outputs
# -----------------------------------------------------------------------------

output "database_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = module.secrets.database_secret_arn
}

output "service_secrets_arns" {
  description = "ARNs of service-specific secrets"
  value       = { for k, v in module.ecs_services : k => v.secrets_arn }
}

# -----------------------------------------------------------------------------
# IAM Outputs
# -----------------------------------------------------------------------------

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = module.iam.ecs_task_execution_role_arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = module.iam.ecs_task_role_arn
}

# -----------------------------------------------------------------------------
# Monitoring Outputs
# -----------------------------------------------------------------------------

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = module.monitoring.log_group_name
}

output "cloudwatch_dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = module.monitoring.dashboard_name
}

output "sns_alerts_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = module.monitoring.alerts_topic_arn
}

output "sns_critical_topic_arn" {
  description = "ARN of the SNS topic for critical alerts"
  value       = module.monitoring.critical_topic_arn
}

# -----------------------------------------------------------------------------
# Connection Strings (sensitive)
# -----------------------------------------------------------------------------

output "database_connection_string" {
  description = "Database connection string (from Secrets Manager)"
  value       = "Retrieved from: ${module.secrets.database_secret_arn}"
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = "rediss://${module.elasticache.primary_endpoint}:${module.elasticache.port}"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Environment Information
# -----------------------------------------------------------------------------

output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "region" {
  description = "AWS region"
  value       = var.aws_region
}

output "domain" {
  description = "Environment domain"
  value       = var.domain
}

output "api_endpoint" {
  description = "API endpoint URL"
  value       = "https://api.${var.domain}"
}
