# =============================================================================
# ECS Cluster Module Outputs
# =============================================================================

output "cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "exec_log_group_name" {
  description = "Name of the CloudWatch log group for ECS Exec"
  value       = aws_cloudwatch_log_group.ecs_exec.name
}

output "exec_log_group_arn" {
  description = "ARN of the CloudWatch log group for ECS Exec"
  value       = aws_cloudwatch_log_group.ecs_exec.arn
}

output "services_log_group_name" {
  description = "Name of the CloudWatch log group for services"
  value       = aws_cloudwatch_log_group.ecs_services.name
}

output "services_log_group_arn" {
  description = "ARN of the CloudWatch log group for services"
  value       = aws_cloudwatch_log_group.ecs_services.arn
}

output "service_discovery_namespace_id" {
  description = "ID of the service discovery namespace"
  value       = var.enable_service_discovery ? aws_service_discovery_private_dns_namespace.main[0].id : null
}

output "service_discovery_namespace_arn" {
  description = "ARN of the service discovery namespace"
  value       = var.enable_service_discovery ? aws_service_discovery_private_dns_namespace.main[0].arn : null
}

output "service_discovery_namespace_name" {
  description = "Name of the service discovery namespace"
  value       = var.enable_service_discovery ? aws_service_discovery_private_dns_namespace.main[0].name : null
}
