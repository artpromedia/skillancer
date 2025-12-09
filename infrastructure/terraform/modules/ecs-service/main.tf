# =============================================================================
# ECS Service Module
# Creates ECS Fargate service with auto-scaling, load balancer integration,
# service discovery, and optional blue-green deployments
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_region" "current" {}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  name_prefix = "${var.project}-${var.environment}"
  full_name   = "${local.name_prefix}-${var.service_name}"
  
  common_tags = merge(var.tags, {
    Project     = var.project
    Environment = var.environment
    Service     = var.service_name
    ManagedBy   = "terraform"
    Module      = "ecs-service"
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Log Group (service-specific)
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "service" {
  count = var.create_log_group ? 1 : 0

  name              = "/aws/ecs/${local.name_prefix}/${var.service_name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = merge(local.common_tags, {
    Name = "${local.full_name}-logs"
  })
}

# -----------------------------------------------------------------------------
# ECS Task Definition
# -----------------------------------------------------------------------------

resource "aws_ecs_task_definition" "main" {
  family                   = local.full_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = var.service_name
      image     = "${var.ecr_repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        for k, v in var.environment_variables : {
          name  = k
          value = v
        }
      ]

      secrets = [
        for k, v in var.secrets : {
          name      = k
          valueFrom = v
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.create_log_group ? aws_cloudwatch_log_group.service[0].name : var.log_group_name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = var.service_name
        }
      }

      healthCheck = var.container_health_check != null ? {
        command     = var.container_health_check.command
        interval    = var.container_health_check.interval
        timeout     = var.container_health_check.timeout
        retries     = var.container_health_check.retries
        startPeriod = var.container_health_check.start_period
      } : null

      linuxParameters = {
        initProcessEnabled = true
      }
      
      # Resource limits
      ulimits = var.ulimits
    }
  ])

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  tags = merge(local.common_tags, {
    Name = "${local.full_name}-task-definition"
  })
}

# -----------------------------------------------------------------------------
# ALB Target Group (Primary - for Blue deployment)
# -----------------------------------------------------------------------------

resource "aws_lb_target_group" "primary" {
  count = var.create_target_group ? 1 : 0

  name                 = "${substr(local.full_name, 0, min(length(local.full_name), 28))}-pri"
  port                 = var.container_port
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = var.deregistration_delay

  health_check {
    enabled             = true
    healthy_threshold   = var.health_check_healthy_threshold
    interval            = var.health_check_interval
    matcher             = var.health_check_matcher
    path                = var.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = var.health_check_timeout
    unhealthy_threshold = var.health_check_unhealthy_threshold
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = var.stickiness_duration
    enabled         = var.enable_stickiness
  }

  tags = merge(local.common_tags, {
    Name       = "${local.full_name}-tg-primary"
    Deployment = "Blue"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# ALB Target Group (Secondary - for Green deployment, used with CodeDeploy)
resource "aws_lb_target_group" "secondary" {
  count = var.create_target_group && var.enable_blue_green ? 1 : 0

  name                 = "${substr(local.full_name, 0, min(length(local.full_name), 28))}-sec"
  port                 = var.container_port
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = var.deregistration_delay

  health_check {
    enabled             = true
    healthy_threshold   = var.health_check_healthy_threshold
    interval            = var.health_check_interval
    matcher             = var.health_check_matcher
    path                = var.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = var.health_check_timeout
    unhealthy_threshold = var.health_check_unhealthy_threshold
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = var.stickiness_duration
    enabled         = var.enable_stickiness
  }

  tags = merge(local.common_tags, {
    Name       = "${local.full_name}-tg-secondary"
    Deployment = "Green"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# ALB Listener Rule
# -----------------------------------------------------------------------------

resource "aws_lb_listener_rule" "service" {
  count = var.alb_listener_arn != null ? 1 : 0

  listener_arn = var.alb_listener_arn
  priority     = var.alb_priority

  action {
    type             = "forward"
    target_group_arn = var.create_target_group ? aws_lb_target_group.primary[0].arn : var.target_group_arn
  }

  # Host-based routing
  dynamic "condition" {
    for_each = var.host_headers != null ? [1] : []
    content {
      host_header {
        values = var.host_headers
      }
    }
  }

  # Path-based routing
  dynamic "condition" {
    for_each = var.path_patterns != null ? [1] : []
    content {
      path_pattern {
        values = var.path_patterns
      }
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.full_name}-listener-rule"
  })
}

# -----------------------------------------------------------------------------
# ECS Service
# -----------------------------------------------------------------------------

resource "aws_ecs_service" "main" {
  name                               = var.service_name
  cluster                            = var.cluster_arn
  task_definition                    = aws_ecs_task_definition.main.arn
  desired_count                      = var.desired_count
  launch_type                        = var.use_fargate_spot ? null : "FARGATE"
  platform_version                   = var.platform_version
  health_check_grace_period_seconds  = var.health_check_grace_period
  enable_execute_command             = var.enable_execute_command
  propagate_tags                     = "SERVICE"
  deployment_minimum_healthy_percent = var.deployment_minimum_healthy_percent
  deployment_maximum_percent         = var.deployment_maximum_percent
  enable_ecs_managed_tags            = true
  wait_for_steady_state              = var.wait_for_steady_state

  dynamic "capacity_provider_strategy" {
    for_each = var.use_fargate_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = 70
      base              = 1
    }
  }

  dynamic "capacity_provider_strategy" {
    for_each = var.use_fargate_spot ? [1] : []
    content {
      capacity_provider = "FARGATE"
      weight            = 30
      base              = 0
    }
  }

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = false
  }

  # Load balancer configuration
  dynamic "load_balancer" {
    for_each = var.create_target_group || var.target_group_arn != null ? [1] : []
    content {
      target_group_arn = var.create_target_group ? aws_lb_target_group.primary[0].arn : var.target_group_arn
      container_name   = var.service_name
      container_port   = var.container_port
    }
  }

  # Service discovery configuration
  dynamic "service_registries" {
    for_each = var.enable_service_discovery ? [1] : []
    content {
      registry_arn = aws_service_discovery_service.main[0].arn
    }
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = var.enable_blue_green ? "CODE_DEPLOY" : "ECS"
  }

  lifecycle {
    ignore_changes = [
      desired_count,
      task_definition,
      load_balancer
    ]
  }

  tags = merge(local.common_tags, {
    Name = local.full_name
  })

  depends_on = [aws_lb_listener_rule.service]
}

# -----------------------------------------------------------------------------
# Security Group
# -----------------------------------------------------------------------------

resource "aws_security_group" "service" {
  name        = "${local.full_name}-sg"
  description = "Security group for ${var.service_name} service"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = var.alb_security_group_ids
    description     = "Allow traffic from ALB"
  }

  dynamic "ingress" {
    for_each = var.allow_internal_traffic ? [1] : []
    content {
      from_port   = var.container_port
      to_port     = var.container_port
      protocol    = "tcp"
      self        = true
      description = "Allow internal service traffic"
    }
  }

  # Allow inter-service communication via VPC CIDR
  dynamic "ingress" {
    for_each = var.vpc_cidr != null ? [1] : []
    content {
      from_port   = var.container_port
      to_port     = var.container_port
      protocol    = "tcp"
      cidr_blocks = [var.vpc_cidr]
      description = "Allow traffic from VPC (service discovery)"
    }
  }

  dynamic "ingress" {
    for_each = var.additional_security_group_ids
    content {
      from_port       = var.container_port
      to_port         = var.container_port
      protocol        = "tcp"
      security_groups = [ingress.value]
      description     = "Allow traffic from additional security group"
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(local.common_tags, {
    Name = "${local.full_name}-sg"
  })
}

# -----------------------------------------------------------------------------
# Service Discovery Service (optional)
# -----------------------------------------------------------------------------

resource "aws_service_discovery_service" "main" {
  count = var.enable_service_discovery ? 1 : 0

  name = var.service_name

  dns_config {
    namespace_id   = var.service_discovery_namespace_id
    routing_policy = "MULTIVALUE"

    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = merge(local.common_tags, {
    Name = "${local.full_name}-discovery"
  })
}

# -----------------------------------------------------------------------------
# Auto Scaling
# -----------------------------------------------------------------------------

resource "aws_appautoscaling_target" "main" {
  count = var.enable_auto_scaling ? 1 : 0

  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.main.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  count = var.enable_auto_scaling ? 1 : 0

  name               = "${local.full_name}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.main[0].resource_id
  scalable_dimension = aws_appautoscaling_target.main[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.main[0].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.cpu_scale_target
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "memory" {
  count = var.enable_auto_scaling ? 1 : 0

  name               = "${local.full_name}-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.main[0].resource_id
  scalable_dimension = aws_appautoscaling_target.main[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.main[0].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.memory_scale_target
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "request_count" {
  count = var.enable_auto_scaling && (var.create_target_group || var.target_group_arn != null) ? 1 : 0

  name               = "${local.full_name}-request-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.main[0].resource_id
  scalable_dimension = aws_appautoscaling_target.main[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.main[0].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.request_count_scale_target
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown

    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = var.alb_resource_label
    }
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms for Service Monitoring
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "service_cpu_high" {
  count = var.enable_service_alarms ? 1 : 0

  alarm_name          = "${local.full_name}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.service_cpu_alarm_threshold
  alarm_description   = "${var.service_name} service CPU utilization is too high"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = aws_ecs_service.main.name
  }

  alarm_actions = var.alarm_sns_topic_arns
  ok_actions    = var.alarm_sns_topic_arns

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "service_memory_high" {
  count = var.enable_service_alarms ? 1 : 0

  alarm_name          = "${local.full_name}-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.service_memory_alarm_threshold
  alarm_description   = "${var.service_name} service memory utilization is too high"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = aws_ecs_service.main.name
  }

  alarm_actions = var.alarm_sns_topic_arns
  ok_actions    = var.alarm_sns_topic_arns

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "service_running_count" {
  count = var.enable_service_alarms ? 1 : 0

  alarm_name          = "${local.full_name}-running-count-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Average"
  threshold           = var.min_capacity
  alarm_description   = "${var.service_name} service running task count is below minimum"
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = aws_ecs_service.main.name
  }

  alarm_actions = var.alarm_sns_topic_arns
  ok_actions    = var.alarm_sns_topic_arns

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# CodeDeploy Resources (for Blue-Green Deployments)
# -----------------------------------------------------------------------------

resource "aws_codedeploy_app" "service" {
  count = var.enable_blue_green ? 1 : 0

  compute_platform = "ECS"
  name             = local.full_name

  tags = local.common_tags
}

resource "aws_codedeploy_deployment_group" "service" {
  count = var.enable_blue_green ? 1 : 0

  app_name               = aws_codedeploy_app.service[0].name
  deployment_group_name  = "${local.full_name}-dg"
  deployment_config_name = var.codedeploy_deployment_config
  service_role_arn       = var.codedeploy_role_arn

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  blue_green_deployment_config {
    deployment_ready_option {
      action_on_timeout    = var.codedeploy_wait_time_for_cutover > 0 ? "STOP_DEPLOYMENT" : "CONTINUE_DEPLOYMENT"
      wait_time_in_minutes = var.codedeploy_wait_time_for_cutover
    }

    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = var.codedeploy_termination_wait_time
    }
  }

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "BLUE_GREEN"
  }

  ecs_service {
    cluster_name = var.cluster_name
    service_name = aws_ecs_service.main.name
  }

  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route {
        listener_arns = [var.alb_listener_arn]
      }

      dynamic "test_traffic_route" {
        for_each = var.alb_test_listener_arn != null ? [1] : []
        content {
          listener_arns = [var.alb_test_listener_arn]
        }
      }

      target_group {
        name = aws_lb_target_group.primary[0].name
      }

      target_group {
        name = aws_lb_target_group.secondary[0].name
      }
    }
  }

  dynamic "alarm_configuration" {
    for_each = length(var.codedeploy_alarm_arns) > 0 ? [1] : []
    content {
      enabled = true
      alarms  = var.codedeploy_alarm_arns
    }
  }

  tags = local.common_tags
}
