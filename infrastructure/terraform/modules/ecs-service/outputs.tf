# =============================================================================
# ECS Service Module Outputs
# =============================================================================

output "service_id" {
  description = "ID of the ECS service"
  value       = aws_ecs_service.main.id
}

output "service_arn" {
  description = "ARN of the ECS service"
  value       = aws_ecs_service.main.id
}

output "service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.main.name
}

output "task_definition_arn" {
  description = "ARN of the task definition"
  value       = aws_ecs_task_definition.main.arn
}

output "task_definition_family" {
  description = "Family of the task definition"
  value       = aws_ecs_task_definition.main.family
}

output "task_definition_revision" {
  description = "Revision of the task definition"
  value       = aws_ecs_task_definition.main.revision
}

output "security_group_id" {
  description = "Security group ID of the service"
  value       = aws_security_group.service.id
}

output "security_group_arn" {
  description = "Security group ARN of the service"
  value       = aws_security_group.service.arn
}

output "service_discovery_service_arn" {
  description = "ARN of the service discovery service"
  value       = var.enable_service_discovery ? aws_service_discovery_service.main[0].arn : null
}

output "service_discovery_service_id" {
  description = "ID of the service discovery service"
  value       = var.enable_service_discovery ? aws_service_discovery_service.main[0].id : null
}

output "autoscaling_target_id" {
  description = "ID of the autoscaling target"
  value       = var.enable_auto_scaling ? aws_appautoscaling_target.main[0].id : null
}

output "secrets_arn" {
  description = "Placeholder for service secrets ARN"
  value       = null
}
