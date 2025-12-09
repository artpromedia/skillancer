# =============================================================================
# ALB Module
# Creates Application Load Balancer with HTTPS listener
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
# Security Group
# -----------------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.project}-${var.environment}-alb-sg"
  description = "Security group for ALB ${var.project} ${var.environment}"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
    description = "Allow HTTP"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
    description = "Allow HTTPS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name = "${var.project}-${var.environment}-alb-sg"
  }
}

# -----------------------------------------------------------------------------
# Application Load Balancer
# -----------------------------------------------------------------------------

resource "aws_lb" "main" {
  name               = "${var.project}-${var.environment}"
  internal           = var.internal
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.subnet_ids

  enable_deletion_protection = var.enable_deletion_protection
  enable_http2               = true
  idle_timeout               = var.idle_timeout
  drop_invalid_header_fields = true

  dynamic "access_logs" {
    for_each = var.access_logs_bucket != null ? [1] : []
    content {
      bucket  = var.access_logs_bucket
      prefix  = var.access_logs_prefix
      enabled = true
    }
  }

  tags = {
    Name = "${var.project}-${var.environment}-alb"
  }
}

# -----------------------------------------------------------------------------
# HTTP Listener (redirect to HTTPS)
# -----------------------------------------------------------------------------

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = {
    Name = "${var.project}-${var.environment}-http-listener"
  }
}

# -----------------------------------------------------------------------------
# HTTPS Listener
# -----------------------------------------------------------------------------

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = var.ssl_policy
  certificate_arn   = var.certificate_arn

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "application/json"
      message_body = jsonencode({
        error   = "Not Found"
        message = "The requested resource was not found"
      })
      status_code = "404"
    }
  }

  tags = {
    Name = "${var.project}-${var.environment}-https-listener"
  }
}

# -----------------------------------------------------------------------------
# Target Groups
# -----------------------------------------------------------------------------

resource "aws_lb_target_group" "services" {
  for_each = { for svc in var.services : svc.name => svc }

  name                 = "${var.project}-${var.environment}-${each.value.name}"
  port                 = each.value.port
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = each.value.deregistration_delay

  health_check {
    enabled             = true
    healthy_threshold   = each.value.health_check.healthy_threshold
    unhealthy_threshold = each.value.health_check.unhealthy_threshold
    timeout             = each.value.health_check.timeout
    interval            = each.value.health_check.interval
    path                = each.value.health_check.path
    protocol            = "HTTP"
    matcher             = each.value.health_check.matcher
  }

  stickiness {
    type            = "lb_cookie"
    enabled         = each.value.stickiness_enabled
    cookie_duration = each.value.stickiness_duration
  }

  tags = {
    Name    = "${var.project}-${var.environment}-${each.value.name}"
    Service = each.value.name
  }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Listener Rules
# -----------------------------------------------------------------------------

resource "aws_lb_listener_rule" "services" {
  for_each = { for idx, svc in var.services : svc.name => { service = svc, priority = idx + 1 } }

  listener_arn = aws_lb_listener.https.arn
  priority     = each.value.service.priority != null ? each.value.service.priority : each.value.priority * 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.services[each.key].arn
  }

  dynamic "condition" {
    for_each = each.value.service.host_header != null ? [each.value.service.host_header] : []
    content {
      host_header {
        values = [condition.value]
      }
    }
  }

  dynamic "condition" {
    for_each = each.value.service.path_pattern != null ? [each.value.service.path_pattern] : []
    content {
      path_pattern {
        values = [condition.value]
      }
    }
  }

  tags = {
    Name    = "${var.project}-${var.environment}-${each.key}-rule"
    Service = each.key
  }
}

# -----------------------------------------------------------------------------
# WAF Association (optional)
# -----------------------------------------------------------------------------

resource "aws_wafv2_web_acl_association" "main" {
  count = var.waf_acl_arn != null ? 1 : 0

  resource_arn = aws_lb.main.arn
  web_acl_arn  = var.waf_acl_arn
}
