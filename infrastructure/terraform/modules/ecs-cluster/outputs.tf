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

output "service_discovery_hosted_zone_id" {
  description = "Hosted zone ID of the service discovery namespace"
  value       = var.enable_service_discovery ? aws_service_discovery_private_dns_namespace.main[0].hosted_zone : null
}

# IAM Role Outputs
output "task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "task_execution_role_name" {
  description = "Name of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.name
}

output "task_role_arn" {
  description = "ARN of the default ECS task role"
  value       = aws_iam_role.ecs_task.arn
}

output "task_role_name" {
  description = "Name of the default ECS task role"
  value       = aws_iam_role.ecs_task.name
}

# Summary Output
output "cluster_summary" {
  description = "Summary of cluster configuration"
  value = {
    cluster_name               = aws_ecs_cluster.main.name
    cluster_arn                = aws_ecs_cluster.main.arn
    container_insights_enabled = var.enable_container_insights
    service_discovery_enabled  = var.enable_service_discovery
    service_discovery_namespace = var.enable_service_discovery ? aws_service_discovery_private_dns_namespace.main[0].name : null
    task_execution_role_arn    = aws_iam_role.ecs_task_execution.arn
    task_role_arn              = aws_iam_role.ecs_task.arn
  }
}
