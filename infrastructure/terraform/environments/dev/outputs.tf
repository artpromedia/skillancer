# =============================================================================
# Outputs - Development Environment
# =============================================================================

# =============================================================================
# General Outputs
# =============================================================================

output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "account_id" {
  description = "AWS account ID"
  value       = local.account_id
}

# =============================================================================
# VPC Outputs
# =============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = module.networking.vpc_cidr
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.networking.private_subnet_ids
}

output "database_subnet_ids" {
  description = "Database subnet IDs"
  value       = module.networking.database_subnet_ids
}

output "nat_gateway_ips" {
  description = "NAT Gateway public IPs"
  value       = module.networking.nat_gateway_ips
}

# =============================================================================
# ECS Outputs
# =============================================================================

output "ecs_cluster_id" {
  description = "ECS cluster ID"
  value       = module.ecs_cluster.cluster_id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs_cluster.cluster_name
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN"
  value       = module.ecs_cluster.cluster_arn
}

output "ecs_service_names" {
  description = "Map of ECS service names"
  value       = { for k, v in module.ecs_services : k => v.service_name }
}

output "ecs_task_security_group_id" {
  description = "Security group ID for ECS tasks"
  value       = module.ecs_cluster.tasks_security_group_id
}

# =============================================================================
# ALB Outputs
# =============================================================================

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.dns_name
}

output "alb_zone_id" {
  description = "ALB Route53 zone ID"
  value       = module.alb.zone_id
}

output "alb_arn" {
  description = "ALB ARN"
  value       = module.alb.arn
}

output "alb_security_group_id" {
  description = "ALB security group ID"
  value       = module.alb.security_group_id
}

output "https_listener_arn" {
  description = "HTTPS listener ARN"
  value       = module.alb.https_listener_arn
}

# =============================================================================
# RDS Outputs
# =============================================================================

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "rds_port" {
  description = "RDS port"
  value       = module.rds.port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = module.rds.database_name
}

output "rds_instance_id" {
  description = "RDS instance identifier"
  value       = module.rds.instance_id
}

output "rds_security_group_id" {
  description = "RDS security group ID"
  value       = module.rds.security_group_id
}

# =============================================================================
# ElastiCache Outputs
# =============================================================================

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = module.elasticache.primary_endpoint
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = module.elasticache.port
}

output "redis_cluster_id" {
  description = "ElastiCache cluster ID"
  value       = module.elasticache.cluster_id
}

output "redis_security_group_id" {
  description = "Redis security group ID"
  value       = module.elasticache.security_group_id
}

# =============================================================================
# Secrets Manager Outputs
# =============================================================================

output "secrets_arns" {
  description = "Map of secret ARNs"
  value       = module.secrets.secret_arns
  sensitive   = true
}

output "secrets_names" {
  description = "Map of secret names"
  value       = module.secrets.secret_names
}

# =============================================================================
# IAM Outputs
# =============================================================================

output "ecs_execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = module.iam.ecs_execution_role_arn
}

output "ecs_task_role_arn" {
  description = "ECS task role ARN"
  value       = module.iam.ecs_task_role_arn
}

# =============================================================================
# Monitoring Outputs
# =============================================================================

output "cloudwatch_dashboard_name" {
  description = "CloudWatch dashboard name"
  value       = module.monitoring.dashboard_name
}

output "sns_alert_topic_arn" {
  description = "SNS topic ARN for alerts"
  value       = module.monitoring.alert_topic_arn
}

# =============================================================================
# Connection Strings (for local development reference)
# =============================================================================

output "connection_info" {
  description = "Connection information for services"
  value = {
    api_gateway_url = "https://api.${var.domain}"
    auth_url        = "https://auth.${var.domain}"
    alb_url         = "https://${module.alb.dns_name}"
  }
}
