# =============================================================================
# Secrets Module Outputs
# =============================================================================

output "database_secret_arn" {
  description = "ARN of the database secret"
  value       = var.create_database_secret ? aws_secretsmanager_secret.database[0].arn : null
}

output "database_secret_name" {
  description = "Name of the database secret"
  value       = var.create_database_secret ? aws_secretsmanager_secret.database[0].name : null
}

output "app_secrets_arn" {
  description = "ARN of the application secrets"
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "app_secrets_name" {
  description = "Name of the application secrets"
  value       = aws_secretsmanager_secret.app_secrets.name
}

output "service_secrets_arns" {
  description = "Map of service name to secret ARN"
  value       = { for k, v in aws_secretsmanager_secret.service_secrets : k => v.arn }
}

output "service_secrets_names" {
  description = "Map of service name to secret name"
  value       = { for k, v in aws_secretsmanager_secret.service_secrets : k => v.name }
}

output "integrations_secret_arn" {
  description = "ARN of the integrations secret"
  value       = var.create_integration_secrets ? aws_secretsmanager_secret.integrations[0].arn : null
}

output "integrations_secret_name" {
  description = "Name of the integrations secret"
  value       = var.create_integration_secrets ? aws_secretsmanager_secret.integrations[0].name : null
}

output "all_secret_arns" {
  description = "List of all secret ARNs"
  value = compact(concat(
    [var.create_database_secret ? aws_secretsmanager_secret.database[0].arn : null],
    [aws_secretsmanager_secret.app_secrets.arn],
    values({ for k, v in aws_secretsmanager_secret.service_secrets : k => v.arn }),
    [var.create_integration_secrets ? aws_secretsmanager_secret.integrations[0].arn : null]
  ))
}
