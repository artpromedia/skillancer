# =============================================================================
# Security Groups
# =============================================================================

# -----------------------------------------------------------------------------
# ALB Security Group
# Allows HTTP/HTTPS from internet, egress to ECS tasks
# -----------------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "alb_http_ingress" {
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = var.alb_ingress_cidr_blocks
  description       = "HTTP from allowed CIDRs"
  security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "alb_https_ingress" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = var.alb_ingress_cidr_blocks
  description       = "HTTPS from allowed CIDRs"
  security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "alb_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow all outbound traffic"
  security_group_id = aws_security_group.alb.id
}

# -----------------------------------------------------------------------------
# ECS Tasks Security Group
# Allows traffic from ALB and inter-service communication
# -----------------------------------------------------------------------------

resource "aws_security_group" "ecs_tasks" {
  name        = "${local.name_prefix}-ecs-tasks-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-tasks-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "ecs_alb_ingress" {
  type                     = "ingress"
  from_port                = 0
  to_port                  = 65535
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  description              = "Allow traffic from ALB"
  security_group_id        = aws_security_group.ecs_tasks.id
}

resource "aws_security_group_rule" "ecs_self_ingress" {
  type              = "ingress"
  from_port         = 0
  to_port           = 65535
  protocol          = "tcp"
  self              = true
  description       = "Allow inter-service communication"
  security_group_id = aws_security_group.ecs_tasks.id
}

resource "aws_security_group_rule" "ecs_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow all outbound traffic"
  security_group_id = aws_security_group.ecs_tasks.id
}

# -----------------------------------------------------------------------------
# Database Security Group
# Allows PostgreSQL and Redis from ECS tasks only
# -----------------------------------------------------------------------------

resource "aws_security_group" "database" {
  name        = "${local.name_prefix}-database-sg"
  description = "Security group for RDS and ElastiCache"
  vpc_id      = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "database_postgres_ingress" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  description              = "PostgreSQL from ECS tasks"
  security_group_id        = aws_security_group.database.id
}

resource "aws_security_group_rule" "database_redis_ingress" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  description              = "Redis from ECS tasks"
  security_group_id        = aws_security_group.database.id
}

# Bastion access to database (if enabled)
resource "aws_security_group_rule" "database_bastion_postgres" {
  count = var.bastion_security_group_id != null ? 1 : 0

  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = var.bastion_security_group_id
  description              = "PostgreSQL from Bastion"
  security_group_id        = aws_security_group.database.id
}

resource "aws_security_group_rule" "database_bastion_redis" {
  count = var.bastion_security_group_id != null ? 1 : 0

  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = var.bastion_security_group_id
  description              = "Redis from Bastion"
  security_group_id        = aws_security_group.database.id
}

resource "aws_security_group_rule" "database_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow all outbound traffic"
  security_group_id = aws_security_group.database.id
}

# -----------------------------------------------------------------------------
# VPC Endpoints Security Group
# Allows HTTPS from VPC CIDR
# -----------------------------------------------------------------------------

resource "aws_security_group" "vpc_endpoints" {
  count = var.enable_vpc_endpoints ? 1 : 0

  name        = "${local.name_prefix}-vpc-endpoints-sg"
  description = "Security group for VPC endpoints"
  vpc_id      = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc-endpoints-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "vpc_endpoints_https_ingress" {
  count = var.enable_vpc_endpoints ? 1 : 0

  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = [var.vpc_cidr]
  description       = "HTTPS from VPC"
  security_group_id = aws_security_group.vpc_endpoints[0].id
}

resource "aws_security_group_rule" "vpc_endpoints_egress" {
  count = var.enable_vpc_endpoints ? 1 : 0

  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow all outbound traffic"
  security_group_id = aws_security_group.vpc_endpoints[0].id
}
