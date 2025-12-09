#------------------------------------------------------------------------------
# CloudWatch Dashboards for Skillancer Platform
#
# This module creates dashboards for:
# - Platform Overview (requests, latency, errors)
# - Business Metrics (users, jobs, payments)
# - SLO Dashboard (availability, latency targets)
#------------------------------------------------------------------------------

locals {
  dashboard_namespace = "${var.project_name}/Services"
  business_namespace  = "${var.project_name}/Business"
}

#------------------------------------------------------------------------------
# Platform Overview Dashboard
#------------------------------------------------------------------------------

resource "aws_cloudwatch_dashboard" "platform_overview" {
  dashboard_name = "${var.project_name}-${var.environment}-platform-overview"

  dashboard_body = jsonencode({
    widgets = [
      # Row 1: Request Metrics
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "Total Requests"
          region = var.aws_region
          metrics = [
            [local.dashboard_namespace, "RequestCount", { stat = "Sum", period = 300 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "Requests by Service"
          region = var.aws_region
          metrics = [
            for service in var.services : [
              local.dashboard_namespace, "RequestCount",
              "Service", service,
              { stat = "Sum", period = 300 }
            ]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "Request Rate (per minute)"
          region = var.aws_region
          metrics = [
            [local.dashboard_namespace, "RequestCount", { stat = "Sum", period = 60 }]
          ]
          view = "timeSeries"
        }
      },

      # Row 2: Latency Metrics
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "Request Latency (P50, P95, P99)"
          region = var.aws_region
          metrics = [
            [local.dashboard_namespace, "RequestLatency", { stat = "p50", period = 300, label = "P50" }],
            [local.dashboard_namespace, "RequestLatency", { stat = "p95", period = 300, label = "P95" }],
            [local.dashboard_namespace, "RequestLatency", { stat = "p99", period = 300, label = "P99" }]
          ]
          view = "timeSeries"
          yAxis = {
            left = { label = "ms" }
          }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "Latency by Service (P95)"
          region = var.aws_region
          metrics = [
            for service in var.services : [
              local.dashboard_namespace, "RequestLatency",
              "Service", service,
              { stat = "p95", period = 300 }
            ]
          ]
          view = "timeSeries"
          yAxis = {
            left = { label = "ms" }
          }
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "Average Latency"
          region = var.aws_region
          metrics = [
            [local.dashboard_namespace, "RequestLatency", { stat = "Average", period = 300 }]
          ]
          view = "singleValue"
        }
      },

      # Row 3: Error Metrics
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "Error Count"
          region = var.aws_region
          metrics = [
            [local.dashboard_namespace, "ErrorCount", { stat = "Sum", period = 300 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "Errors by Type"
          region = var.aws_region
          metrics = [
            [local.dashboard_namespace, "ErrorCount", "ErrorType", "4xx", { stat = "Sum", period = 300 }],
            [local.dashboard_namespace, "ErrorCount", "ErrorType", "5xx", { stat = "Sum", period = 300 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "Error Rate (%)"
          region = var.aws_region
          metrics = [
            [{
              expression = "(m2/m1)*100"
              label      = "Error Rate"
              id         = "e1"
            }],
            [local.dashboard_namespace, "RequestCount", { stat = "Sum", period = 300, id = "m1", visible = false }],
            [local.dashboard_namespace, "ErrorCount", { stat = "Sum", period = 300, id = "m2", visible = false }]
          ]
          view = "timeSeries"
          yAxis = {
            left = { label = "%" }
          }
        }
      },

      # Row 4: Infrastructure - ECS
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6
        properties = {
          title  = "ECS CPU Utilization"
          region = var.aws_region
          metrics = [
            for service in var.services : [
              "AWS/ECS", "CPUUtilization",
              "ServiceName", service,
              "ClusterName", var.ecs_cluster_name,
              { stat = "Average", period = 300 }
            ]
          ]
          view = "timeSeries"
          yAxis = {
            left = { min = 0, max = 100 }
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 18
        width  = 12
        height = 6
        properties = {
          title  = "ECS Memory Utilization"
          region = var.aws_region
          metrics = [
            for service in var.services : [
              "AWS/ECS", "MemoryUtilization",
              "ServiceName", service,
              "ClusterName", var.ecs_cluster_name,
              { stat = "Average", period = 300 }
            ]
          ]
          view = "timeSeries"
          yAxis = {
            left = { min = 0, max = 100 }
          }
        }
      },

      # Row 5: Infrastructure - RDS
      {
        type   = "metric"
        x      = 0
        y      = 24
        width  = 8
        height = 6
        properties = {
          title  = "RDS CPU Utilization"
          region = var.aws_region
          metrics = var.rds_instance_id != null ? [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_instance_id, { stat = "Average", period = 300 }]
          ] : []
          view = "timeSeries"
          yAxis = {
            left = { min = 0, max = 100 }
          }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 24
        width  = 8
        height = 6
        properties = {
          title  = "RDS Connections"
          region = var.aws_region
          metrics = var.rds_instance_id != null ? [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.rds_instance_id, { stat = "Average", period = 300 }]
          ] : []
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 24
        width  = 8
        height = 6
        properties = {
          title  = "RDS Free Storage"
          region = var.aws_region
          metrics = var.rds_instance_id != null ? [
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", var.rds_instance_id, { stat = "Average", period = 300 }]
          ] : []
          view = "timeSeries"
        }
      }
    ]
  })
}

#------------------------------------------------------------------------------
# Business Metrics Dashboard
#------------------------------------------------------------------------------

resource "aws_cloudwatch_dashboard" "business_metrics" {
  dashboard_name = "${var.project_name}-${var.environment}-business-metrics"

  dashboard_body = jsonencode({
    widgets = [
      # Row 1: User Metrics
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "User Signups"
          region = var.aws_region
          metrics = [
            [local.business_namespace, "UserSignup", { stat = "Sum", period = 3600 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "User Logins"
          region = var.aws_region
          metrics = [
            [local.business_namespace, "UserLogin", { stat = "Sum", period = 3600 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "Active Sessions"
          region = var.aws_region
          metrics = [
            [local.business_namespace, "SessionStarted", { stat = "Sum", period = 3600 }]
          ]
          view = "singleValue"
        }
      },

      # Row 2: Marketplace Metrics
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "Jobs Posted"
          region = var.aws_region
          metrics = [
            [local.business_namespace, "JobPosted", { stat = "Sum", period = 3600 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "Bids Submitted"
          region = var.aws_region
          metrics = [
            [local.business_namespace, "BidSubmitted", { stat = "Sum", period = 3600 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "Contracts Created"
          region = var.aws_region
          metrics = [
            [local.business_namespace, "ContractCreated", { stat = "Sum", period = 3600 }]
          ]
          view = "timeSeries"
        }
      },

      # Row 3: Revenue Metrics
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "Payments Processed"
          region = var.aws_region
          metrics = [
            [local.business_namespace, "PaymentProcessed", { stat = "Sum", period = 3600 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "Total Payment Volume"
          region = var.aws_region
          metrics = [
            [local.business_namespace, "PaymentAmount", { stat = "Sum", period = 3600 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "Payment Failures"
          region = var.aws_region
          metrics = [
            [local.business_namespace, "PaymentFailed", { stat = "Sum", period = 3600 }]
          ]
          view = "timeSeries"
        }
      },

      # Row 4: Engagement Metrics
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6
        properties = {
          title  = "Search Volume"
          region = var.aws_region
          metrics = [
            [local.business_namespace, "SearchPerformed", { stat = "Sum", period = 3600 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 18
        width  = 12
        height = 6
        properties = {
          title  = "Messages Sent"
          region = var.aws_region
          metrics = [
            [local.business_namespace, "MessagesSent", { stat = "Sum", period = 3600 }]
          ]
          view = "timeSeries"
        }
      }
    ]
  })
}

#------------------------------------------------------------------------------
# SLO Dashboard
#------------------------------------------------------------------------------

resource "aws_cloudwatch_dashboard" "slo_dashboard" {
  dashboard_name = "${var.project_name}-${var.environment}-slo-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      # Row 1: SLO Gauges
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "Availability (Target: 99.9%)"
          region = var.aws_region
          metrics = [
            [{
              expression = "((m1-m2)/m1)*100"
              label      = "Availability"
              id         = "availability"
            }],
            [local.dashboard_namespace, "RequestCount", { stat = "Sum", period = 86400, id = "m1", visible = false }],
            [local.dashboard_namespace, "ErrorCount", { stat = "Sum", period = 86400, id = "m2", visible = false }]
          ]
          view = "gauge"
          yAxis = {
            left = { min = 99, max = 100 }
          }
          annotations = {
            horizontal = [
              { value = 99.9, label = "SLO Target" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "P95 Latency (Target: 500ms)"
          region = var.aws_region
          metrics = [
            [local.dashboard_namespace, "RequestLatency", { stat = "p95", period = 86400 }]
          ]
          view = "gauge"
          yAxis = {
            left = { min = 0, max = 1000 }
          }
          annotations = {
            horizontal = [
              { value = 500, label = "SLO Target" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "Error Budget Remaining"
          region = var.aws_region
          metrics = [
            [{
              expression = "100 - ((m2/m1)*100/0.1)"
              label      = "Budget %"
              id         = "budget"
            }],
            [local.dashboard_namespace, "RequestCount", { stat = "Sum", period = 2592000, id = "m1", visible = false }],
            [local.dashboard_namespace, "ErrorCount", { stat = "Sum", period = 2592000, id = "m2", visible = false }]
          ]
          view = "gauge"
          yAxis = {
            left = { min = 0, max = 100 }
          }
        }
      },

      # Row 2: SLO Trends
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "7-Day Availability Trend"
          region = var.aws_region
          metrics = [
            [{
              expression = "((m1-m2)/m1)*100"
              label      = "Availability"
              id         = "availability"
            }],
            [local.dashboard_namespace, "RequestCount", { stat = "Sum", period = 3600, id = "m1", visible = false }],
            [local.dashboard_namespace, "ErrorCount", { stat = "Sum", period = 3600, id = "m2", visible = false }]
          ]
          view = "timeSeries"
          yAxis = {
            left = { min = 99, max = 100 }
          }
          annotations = {
            horizontal = [
              { value = 99.9, label = "SLO Target" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "7-Day Latency Trend (P95)"
          region = var.aws_region
          metrics = [
            [local.dashboard_namespace, "RequestLatency", { stat = "p95", period = 3600 }]
          ]
          view = "timeSeries"
          yAxis = {
            left = { min = 0 }
          }
          annotations = {
            horizontal = [
              { value = 500, label = "SLO Target" }
            ]
          }
        }
      },

      # Row 3: Per-Service SLIs
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 24
        height = 6
        properties = {
          title  = "Service Availability"
          region = var.aws_region
          metrics = [
            for service in var.services : [
              {
                expression = "((m1_${service}-m2_${service})/m1_${service})*100"
                label      = service
                id         = "avail_${service}"
              }
            ]
          ]
          view = "timeSeries"
          yAxis = {
            left = { min = 99, max = 100 }
          }
        }
      }
    ]
  })
}
