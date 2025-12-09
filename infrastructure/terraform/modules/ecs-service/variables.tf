# =============================================================================
# ECS Service Module Variables
# =============================================================================

variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "service_name" {
  description = "Name of the ECS service"
  type        = string
}

variable "cluster_arn" {
  description = "ARN of the ECS cluster"
  type        = string
}

variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block for inter-service communication"
  type        = string
  default     = null
}

variable "subnet_ids" {
  description = "Subnet IDs for the service"
  type        = list(string)
}

variable "ecr_repository_url" {
  description = "ECR repository URL"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "cpu" {
  description = "CPU units for the task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memory for the task in MB"
  type        = number
  default     = 512
}

variable "cpu_architecture" {
  description = "CPU architecture (X86_64 or ARM64)"
  type        = string
  default     = "X86_64"
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 3000
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 1
}

variable "platform_version" {
  description = "Fargate platform version"
  type        = string
  default     = "LATEST"
}

variable "execution_role_arn" {
  description = "ECS task execution role ARN"
  type        = string
}

variable "task_role_arn" {
  description = "ECS task role ARN"
  type        = string
}

variable "log_group_name" {
  description = "CloudWatch log group name (used if create_log_group is false)"
  type        = string
  default     = null
}

variable "create_log_group" {
  description = "Create a dedicated CloudWatch log group for this service"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "kms_key_arn" {
  description = "KMS key ARN for encrypting logs"
  type        = string
  default     = null
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secrets from Secrets Manager or SSM Parameter Store"
  type        = map(string)
  default     = {}
}

variable "container_health_check" {
  description = "Container health check configuration"
  type = object({
    command      = list(string)
    interval     = number
    timeout      = number
    retries      = number
    start_period = number
  })
  default = null
}

variable "ulimits" {
  description = "Container ulimits configuration"
  type = list(object({
    name      = string
    softLimit = number
    hardLimit = number
  }))
  default = null
}

# -----------------------------------------------------------------------------
# Security Group Variables
# -----------------------------------------------------------------------------

variable "alb_security_group_ids" {
  description = "Security group IDs of the ALB"
  type        = list(string)
  default     = []
}

variable "additional_security_group_ids" {
  description = "Additional security group IDs to allow traffic from"
  type        = list(string)
  default     = []
}

variable "allow_internal_traffic" {
  description = "Allow traffic from within the same security group"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Load Balancer Variables
# -----------------------------------------------------------------------------

variable "create_target_group" {
  description = "Create ALB target group for this service"
  type        = bool
  default     = true
}

variable "target_group_arn" {
  description = "ARN of existing ALB target group (used if create_target_group is false)"
  type        = string
  default     = null
}

variable "alb_listener_arn" {
  description = "ARN of the ALB listener"
  type        = string
  default     = null
}

variable "alb_test_listener_arn" {
  description = "ARN of the ALB test listener (for blue-green deployments)"
  type        = string
  default     = null
}

variable "alb_priority" {
  description = "Priority for ALB listener rule"
  type        = number
  default     = 100
}

variable "host_headers" {
  description = "Host headers for ALB routing"
  type        = list(string)
  default     = null
}

variable "path_patterns" {
  description = "Path patterns for ALB routing"
  type        = list(string)
  default     = null
}

variable "health_check_path" {
  description = "Health check path for target group"
  type        = string
  default     = "/health"
}

variable "health_check_interval" {
  description = "Health check interval in seconds"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 5
}

variable "health_check_healthy_threshold" {
  description = "Number of consecutive successful health checks"
  type        = number
  default     = 2
}

variable "health_check_unhealthy_threshold" {
  description = "Number of consecutive failed health checks"
  type        = number
  default     = 3
}

variable "health_check_matcher" {
  description = "HTTP codes to use when checking for a successful response"
  type        = string
  default     = "200"
}

variable "health_check_grace_period" {
  description = "Health check grace period in seconds"
  type        = number
  default     = 60
}

variable "deregistration_delay" {
  description = "Deregistration delay in seconds"
  type        = number
  default     = 30
}

variable "enable_stickiness" {
  description = "Enable sticky sessions"
  type        = bool
  default     = false
}

variable "stickiness_duration" {
  description = "Stickiness duration in seconds"
  type        = number
  default     = 86400
}

# -----------------------------------------------------------------------------
# Deployment Variables
# -----------------------------------------------------------------------------

variable "deployment_minimum_healthy_percent" {
  description = "Minimum healthy percent during deployment"
  type        = number
  default     = 100
}

variable "deployment_maximum_percent" {
  description = "Maximum percent during deployment"
  type        = number
  default     = 200
}

variable "enable_execute_command" {
  description = "Enable ECS Exec for debugging"
  type        = bool
  default     = true
}

variable "use_fargate_spot" {
  description = "Use Fargate Spot for cost savings"
  type        = bool
  default     = false
}

variable "wait_for_steady_state" {
  description = "Wait for the service to reach a steady state"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Service Discovery Variables
# -----------------------------------------------------------------------------

variable "enable_service_discovery" {
  description = "Enable Cloud Map service discovery"
  type        = bool
  default     = false
}

variable "service_discovery_namespace_id" {
  description = "Service discovery namespace ID"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Auto Scaling Variables
# -----------------------------------------------------------------------------

variable "enable_auto_scaling" {
  description = "Enable auto scaling"
  type        = bool
  default     = true
}

variable "min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 10
}

variable "cpu_scale_target" {
  description = "Target CPU utilization for scaling"
  type        = number
  default     = 70
}

variable "memory_scale_target" {
  description = "Target memory utilization for scaling"
  type        = number
  default     = 80
}

variable "request_count_scale_target" {
  description = "Target request count per target for scaling"
  type        = number
  default     = 1000
}

variable "alb_resource_label" {
  description = "ALB resource label for request count scaling"
  type        = string
  default     = null
}

variable "scale_in_cooldown" {
  description = "Scale in cooldown period in seconds"
  type        = number
  default     = 300
}

variable "scale_out_cooldown" {
  description = "Scale out cooldown period in seconds"
  type        = number
  default     = 60
}

# -----------------------------------------------------------------------------
# Blue-Green Deployment Variables
# -----------------------------------------------------------------------------

variable "enable_blue_green" {
  description = "Enable blue-green deployment via CodeDeploy"
  type        = bool
  default     = false
}

variable "codedeploy_role_arn" {
  description = "IAM role ARN for CodeDeploy"
  type        = string
  default     = null
}

variable "codedeploy_deployment_config" {
  description = "CodeDeploy deployment configuration"
  type        = string
  default     = "CodeDeployDefault.ECSAllAtOnce"
}

variable "codedeploy_wait_time_for_cutover" {
  description = "Minutes to wait before cutover in blue-green deployment"
  type        = number
  default     = 0
}

variable "codedeploy_termination_wait_time" {
  description = "Minutes to wait before terminating old tasks"
  type        = number
  default     = 5
}

variable "codedeploy_alarm_arns" {
  description = "CloudWatch alarm ARNs to monitor during deployment"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Monitoring Variables
# -----------------------------------------------------------------------------

variable "enable_service_alarms" {
  description = "Enable CloudWatch alarms for service monitoring"
  type        = bool
  default     = true
}

variable "service_cpu_alarm_threshold" {
  description = "CPU utilization threshold for service alarm"
  type        = number
  default     = 85
}

variable "service_memory_alarm_threshold" {
  description = "Memory utilization threshold for service alarm"
  type        = number
  default     = 85
}

variable "alarm_sns_topic_arns" {
  description = "SNS topic ARNs for CloudWatch alarm notifications"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
