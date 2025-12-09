# =============================================================================
# RDS Module Outputs
# =============================================================================

output "instance_id" {
  description = "ID of the RDS instance"
  value       = aws_db_instance.main.id
}

output "instance_arn" {
  description = "ARN of the RDS instance"
  value       = aws_db_instance.main.arn
}

output "cluster_endpoint" {
  description = "Endpoint of the RDS instance (writer)"
  value       = aws_db_instance.main.endpoint
}

output "cluster_id" {
  description = "Identifier of the RDS instance"
  value       = aws_db_instance.main.identifier
}

output "cluster_arn" {
  description = "ARN of the RDS instance"
  value       = aws_db_instance.main.arn
}

output "reader_endpoint" {
  description = "Reader endpoint (replica if exists, otherwise primary)"
  value       = length(aws_db_instance.replica) > 0 ? aws_db_instance.replica[0].endpoint : aws_db_instance.main.endpoint
}

output "address" {
  description = "Hostname of the RDS instance"
  value       = aws_db_instance.main.address
}

output "port" {
  description = "Port of the RDS instance"
  value       = aws_db_instance.main.port
}

output "database_name" {
  description = "Name of the database"
  value       = aws_db_instance.main.db_name
}

output "master_username" {
  description = "Master username"
  value       = aws_db_instance.main.username
  sensitive   = true
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
  value       = aws_db_parameter_group.main.name
}

output "replica_endpoints" {
  description = "Endpoints of read replicas"
  value       = aws_db_instance.replica[*].endpoint
}

output "replica_ids" {
  description = "IDs of read replicas"
  value       = aws_db_instance.replica[*].id
}

output "credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = var.store_credentials_in_secrets_manager ? aws_secretsmanager_secret.db_credentials[0].arn : null
}

output "credentials_secret_name" {
  description = "Name of the Secrets Manager secret"
  value       = var.store_credentials_in_secrets_manager ? aws_secretsmanager_secret.db_credentials[0].name : null
}

output "enhanced_monitoring_role_arn" {
  description = "ARN of the enhanced monitoring role"
  value       = var.monitoring_interval > 0 ? aws_iam_role.enhanced_monitoring[0].arn : null
}

output "connection_string" {
  description = "PostgreSQL connection string (password placeholder)"
  value       = "postgresql://${aws_db_instance.main.username}:PASSWORD@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}"
  sensitive   = true
}

output "connection_string_read" {
  description = "PostgreSQL read replica connection string (if replica exists)"
  value       = length(aws_db_instance.replica) > 0 ? "postgresql://${aws_db_instance.main.username}:PASSWORD@${aws_db_instance.replica[0].endpoint}/${aws_db_instance.main.db_name}" : null
  sensitive   = true
}

output "db_subnet_group_name" {
  description = "Name of the DB subnet group"
  value       = var.db_subnet_group_name != null ? var.db_subnet_group_name : aws_db_subnet_group.main[0].name
}

output "cloudwatch_alarm_arns" {
  description = "ARNs of CloudWatch alarms"
  value = var.enable_cloudwatch_alarms ? {
    cpu         = aws_cloudwatch_metric_alarm.cpu_utilization[0].arn
    storage     = aws_cloudwatch_metric_alarm.free_storage_space[0].arn
    connections = aws_cloudwatch_metric_alarm.database_connections[0].arn
    memory      = aws_cloudwatch_metric_alarm.freeable_memory[0].arn
    read_latency  = aws_cloudwatch_metric_alarm.read_latency[0].arn
    write_latency = aws_cloudwatch_metric_alarm.write_latency[0].arn
  } : {}
}

output "rds_summary" {
  description = "Summary of RDS configuration"
  value = {
    identifier       = aws_db_instance.main.identifier
    engine           = "${aws_db_instance.main.engine} ${aws_db_instance.main.engine_version}"
    instance_class   = aws_db_instance.main.instance_class
    storage_gb       = aws_db_instance.main.allocated_storage
    multi_az         = aws_db_instance.main.multi_az
    replica_count    = length(aws_db_instance.replica)
    endpoint         = aws_db_instance.main.endpoint
    database         = aws_db_instance.main.db_name
    encrypted        = aws_db_instance.main.storage_encrypted
  }
}
