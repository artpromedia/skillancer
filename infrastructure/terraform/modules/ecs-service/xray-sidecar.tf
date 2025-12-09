# =============================================================================
# AWS X-Ray Daemon Sidecar Container
# =============================================================================
# This file defines the X-Ray daemon sidecar container configuration
# to be used alongside application containers for distributed tracing.
# 
# Usage: Include the xray_sidecar_container_definition in your task definition
#        when enable_xray is true.
# =============================================================================

# -----------------------------------------------------------------------------
# X-Ray Sidecar Container Definition (Local Value)
# -----------------------------------------------------------------------------

locals {
  xray_sidecar_container_definition = var.enable_xray ? [
    {
      name      = "xray-daemon"
      image     = "amazon/aws-xray-daemon:latest"
      essential = false
      cpu       = 32
      memory    = 256

      portMappings = [
        {
          containerPort = 2000
          protocol      = "udp"
        }
      ]

      environment = [
        {
          name  = "AWS_REGION"
          value = data.aws_region.current.name
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.create_log_group ? aws_cloudwatch_log_group.service[0].name : var.log_group_name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "xray-daemon"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:2000 || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
    }
  ] : []
}

# -----------------------------------------------------------------------------
# X-Ray Daemon Task Definition (Alternative standalone approach)
# -----------------------------------------------------------------------------
# This creates a separate task definition with the X-Ray daemon sidecar.
# The main task definition in main.tf should be updated to include
# the sidecar container when enable_xray is true.

resource "aws_ecs_task_definition" "with_xray" {
  count = var.enable_xray ? 1 : 0

  family                   = "${local.full_name}-xray"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode(concat(
    [
      # Main application container
      {
        name      = var.service_name
        image     = "${var.ecr_repository_url}:${var.image_tag}"
        essential = true
        cpu       = var.cpu - 32  # Reserve 32 CPU units for X-Ray daemon

        portMappings = [
          {
            containerPort = var.container_port
            protocol      = "tcp"
          }
        ]

        environment = concat(
          [
            for k, v in var.environment_variables : {
              name  = k
              value = v
            }
          ],
          [
            # Add X-Ray environment variables
            {
              name  = "AWS_XRAY_DAEMON_ADDRESS"
              value = "127.0.0.1:2000"
            },
            {
              name  = "OTEL_EXPORTER_OTLP_ENDPOINT"
              value = var.otlp_endpoint != null ? var.otlp_endpoint : "http://127.0.0.1:4318"
            }
          ]
        )

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

        ulimits = var.ulimits

        # Dependency: wait for X-Ray daemon to start
        dependsOn = [
          {
            containerName = "xray-daemon"
            condition     = "START"
          }
        ]
      },
      # X-Ray daemon sidecar container
      {
        name      = "xray-daemon"
        image     = "amazon/aws-xray-daemon:latest"
        essential = false
        cpu       = 32
        memory    = 256

        portMappings = [
          {
            containerPort = 2000
            protocol      = "udp"
          }
        ]

        environment = [
          {
            name  = "AWS_REGION"
            value = data.aws_region.current.name
          }
        ]

        logConfiguration = {
          logDriver = "awslogs"
          options = {
            "awslogs-group"         = var.create_log_group ? aws_cloudwatch_log_group.service[0].name : var.log_group_name
            "awslogs-region"        = data.aws_region.current.name
            "awslogs-stream-prefix" = "xray-daemon"
          }
        }
      }
    ],
    # Include any additional sidecars
    var.additional_sidecars
  ))

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  tags = merge(local.common_tags, {
    Name    = "${local.full_name}-xray-task-definition"
    Tracing = "xray"
  })
}
