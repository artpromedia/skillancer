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

output "connection_string" {
  description = "Redis connection string (with TLS)"
  value       = var.transit_encryption_enabled ? "rediss://:AUTH_TOKEN@${aws_elasticache_replication_group.main.primary_endpoint_address}:${var.port}" : "redis://${aws_elasticache_replication_group.main.primary_endpoint_address}:${var.port}"
  sensitive   = true
}

output "connection_string_reader" {
  description = "Redis reader connection string (with TLS)"
  value       = var.transit_encryption_enabled ? "rediss://:AUTH_TOKEN@${aws_elasticache_replication_group.main.reader_endpoint_address}:${var.port}" : "redis://${aws_elasticache_replication_group.main.reader_endpoint_address}:${var.port}"
  sensitive   = true
}

output "cloudwatch_alarm_arns" {
  description = "ARNs of CloudWatch alarms"
  value = var.enable_cloudwatch_alarms ? {
    cpu          = aws_cloudwatch_metric_alarm.cpu_utilization[0].arn
    memory       = aws_cloudwatch_metric_alarm.memory_usage[0].arn
    connections  = aws_cloudwatch_metric_alarm.current_connections[0].arn
    evictions    = aws_cloudwatch_metric_alarm.evictions[0].arn
    cache_hit    = aws_cloudwatch_metric_alarm.cache_hit_rate[0].arn
  } : {}
}

output "elasticache_summary" {
  description = "Summary of ElastiCache configuration"
  value = {
    replication_group_id = aws_elasticache_replication_group.main.id
    engine               = "redis ${var.engine_version}"
    node_type            = var.node_type
    num_cache_clusters   = var.cluster_mode_enabled ? var.num_node_groups * (var.replicas_per_node_group + 1) : var.num_cache_clusters
    cluster_mode         = var.cluster_mode_enabled
    multi_az             = var.multi_az_enabled
    automatic_failover   = var.automatic_failover_enabled
    encryption_at_rest   = var.at_rest_encryption_enabled
    encryption_in_transit = var.transit_encryption_enabled
    primary_endpoint     = aws_elasticache_replication_group.main.primary_endpoint_address
    reader_endpoint      = aws_elasticache_replication_group.main.reader_endpoint_address
  }
}
