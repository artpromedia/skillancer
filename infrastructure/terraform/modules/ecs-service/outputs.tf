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

# Target Group Outputs
output "target_group_arn" {
  description = "ARN of the primary target group"
  value       = var.create_target_group ? aws_lb_target_group.primary[0].arn : var.target_group_arn
}

output "target_group_name" {
  description = "Name of the primary target group"
  value       = var.create_target_group ? aws_lb_target_group.primary[0].name : null
}

output "secondary_target_group_arn" {
  description = "ARN of the secondary target group (for blue-green)"
  value       = var.enable_blue_green && var.create_target_group ? aws_lb_target_group.secondary[0].arn : null
}

output "secondary_target_group_name" {
  description = "Name of the secondary target group (for blue-green)"
  value       = var.enable_blue_green && var.create_target_group ? aws_lb_target_group.secondary[0].name : null
}

# Service Discovery Outputs
output "service_discovery_service_arn" {
  description = "ARN of the service discovery service"
  value       = var.enable_service_discovery ? aws_service_discovery_service.main[0].arn : null
}

output "service_discovery_service_id" {
  description = "ID of the service discovery service"
  value       = var.enable_service_discovery ? aws_service_discovery_service.main[0].id : null
}

output "service_discovery_dns_name" {
  description = "DNS name for service discovery"
  value       = var.enable_service_discovery ? "${var.service_name}.${var.environment}.skillancer.local" : null
}

# Auto Scaling Outputs
output "autoscaling_target_id" {
  description = "ID of the autoscaling target"
  value       = var.enable_auto_scaling ? aws_appautoscaling_target.main[0].id : null
}

# CloudWatch Log Group Outputs
output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = var.create_log_group ? aws_cloudwatch_log_group.service[0].name : var.log_group_name
}

output "log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = var.create_log_group ? aws_cloudwatch_log_group.service[0].arn : null
}

# CodeDeploy Outputs (Blue-Green)
output "codedeploy_app_name" {
  description = "Name of the CodeDeploy application"
  value       = var.enable_blue_green ? aws_codedeploy_app.service[0].name : null
}

output "codedeploy_deployment_group_name" {
  description = "Name of the CodeDeploy deployment group"
  value       = var.enable_blue_green ? aws_codedeploy_deployment_group.service[0].deployment_group_name : null
}

# Summary Output
output "service_summary" {
  description = "Summary of the service configuration"
  value = {
    service_name        = aws_ecs_service.main.name
    task_family         = aws_ecs_task_definition.main.family
    cpu                 = var.cpu
    memory              = var.memory
    desired_count       = var.desired_count
    min_capacity        = var.min_capacity
    max_capacity        = var.max_capacity
    container_port      = var.container_port
    service_discovery   = var.enable_service_discovery
    blue_green_enabled  = var.enable_blue_green
    auto_scaling        = var.enable_auto_scaling
    xray_enabled        = var.enable_xray
  }
}

# X-Ray / Tracing Outputs
output "xray_task_definition_arn" {
  description = "ARN of the task definition with X-Ray sidecar"
  value       = var.enable_xray ? aws_ecs_task_definition.with_xray[0].arn : null
}

output "xray_task_definition_family" {
  description = "Family of the task definition with X-Ray sidecar"
  value       = var.enable_xray ? aws_ecs_task_definition.with_xray[0].family : null
}
