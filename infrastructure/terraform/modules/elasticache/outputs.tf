# =============================================================================
# ElastiCache Module Outputs
# =============================================================================

output "replication_group_id" {
  description = "ID of the replication group"
  value       = aws_elasticache_replication_group.main.id
}

output "replication_group_arn" {
  description = "ARN of the replication group"
  value       = aws_elasticache_replication_group.main.arn
}

output "primary_endpoint" {
  description = "Primary endpoint address"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "reader_endpoint" {
  description = "Reader endpoint address"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "configuration_endpoint" {
  description = "Configuration endpoint (cluster mode only)"
  value       = var.cluster_mode_enabled ? aws_elasticache_replication_group.main.configuration_endpoint_address : null
}

output "port" {
  description = "Redis port"
  value       = var.port
}

output "security_group_id" {
  description = "Security group ID"
  value       = aws_security_group.main.id
}

output "security_group_arn" {
  description = "Security group ARN"
  value       = aws_security_group.main.arn
}

output "parameter_group_name" {
  description = "Name of the parameter group"
  value       = aws_elasticache_parameter_group.main.name
}

output "subnet_group_name" {
  description = "Name of the subnet group"
  value       = var.subnet_group_name != null ? var.subnet_group_name : aws_elasticache_subnet_group.main[0].name
}

output "auth_token_secret_arn" {
  description = "ARN of the Secrets Manager secret for auth token"
  value       = var.transit_encryption_enabled && var.store_auth_token_in_secrets_manager ? aws_secretsmanager_secret.redis_auth[0].arn : null
}

output "auth_token_secret_name" {
  description = "Name of the Secrets Manager secret for auth token"
  value       = var.transit_encryption_enabled && var.store_auth_token_in_secrets_manager ? aws_secretsmanager_secret.redis_auth[0].name : null
}
