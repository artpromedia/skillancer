# =============================================================================
# ElastiCache Module
# Creates Redis cluster with optional replication
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Random Auth Token
# -----------------------------------------------------------------------------

resource "random_password" "auth_token" {
  count = var.transit_encryption_enabled && var.auth_token == null ? 1 : 0

  length           = 64
  special          = false
  override_special = ""
}

# -----------------------------------------------------------------------------
# Parameter Group
# -----------------------------------------------------------------------------

resource "aws_elasticache_parameter_group" "main" {
  name        = "${var.project}-${var.environment}-redis-pg"
  family      = "redis${split(".", var.engine_version)[0]}"
  description = "Parameter group for ${var.project} ${var.environment}"

  dynamic "parameter" {
    for_each = var.parameters
    content {
      name  = parameter.value.name
      value = parameter.value.value
    }
  }

  # Default parameters
  parameter {
    name  = "maxmemory-policy"
    value = var.maxmemory_policy
  }

  tags = {
    Name = "${var.project}-${var.environment}-redis-pg"
  }
}

# -----------------------------------------------------------------------------
# Subnet Group
# -----------------------------------------------------------------------------

resource "aws_elasticache_subnet_group" "main" {
  count = var.subnet_group_name == null ? 1 : 0

  name        = "${var.project}-${var.environment}-redis-subnet-group"
  description = "ElastiCache subnet group for ${var.project} ${var.environment}"
  subnet_ids  = var.subnet_ids

  tags = {
    Name = "${var.project}-${var.environment}-redis-subnet-group"
  }
}

# -----------------------------------------------------------------------------
# Security Group
# -----------------------------------------------------------------------------

resource "aws_security_group" "main" {
  name        = "${var.project}-${var.environment}-redis-sg"
  description = "Security group for ElastiCache ${var.project} ${var.environment}"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project}-${var.environment}-redis-sg"
  }
}

resource "aws_security_group_rule" "ingress" {
  for_each = toset(var.allowed_security_group_ids)

  type                     = "ingress"
  from_port                = var.port
  to_port                  = var.port
  protocol                 = "tcp"
  source_security_group_id = each.value
  security_group_id        = aws_security_group.main.id
  description              = "Allow Redis from allowed security groups"
}

resource "aws_security_group_rule" "egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.main.id
  description       = "Allow all outbound"
}

# -----------------------------------------------------------------------------
# Replication Group
# -----------------------------------------------------------------------------

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project}-${var.environment}"
  description          = "Redis cluster for ${var.project} ${var.environment}"

  # Engine
  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  parameter_group_name = aws_elasticache_parameter_group.main.name
  port                 = var.port

  # Cluster mode
  num_cache_clusters = var.cluster_mode_enabled ? null : var.num_cache_clusters

  dynamic "cluster_mode" {
    for_each = var.cluster_mode_enabled ? [1] : []
    content {
      num_node_groups         = var.num_node_groups
      replicas_per_node_group = var.replicas_per_node_group
    }
  }

  # Network
  subnet_group_name  = var.subnet_group_name != null ? var.subnet_group_name : aws_elasticache_subnet_group.main[0].name
  security_group_ids = [aws_security_group.main.id]

  # High availability
  automatic_failover_enabled = var.automatic_failover_enabled
  multi_az_enabled           = var.multi_az_enabled

  # Security
  at_rest_encryption_enabled = var.at_rest_encryption_enabled
  transit_encryption_enabled = var.transit_encryption_enabled
  auth_token                 = var.transit_encryption_enabled ? (var.auth_token != null ? var.auth_token : random_password.auth_token[0].result) : null
  kms_key_id                 = var.at_rest_encryption_enabled ? var.kms_key_id : null

  # Maintenance
  maintenance_window         = var.maintenance_window
  snapshot_window            = var.snapshot_window
  snapshot_retention_limit   = var.snapshot_retention_limit
  final_snapshot_identifier  = var.skip_final_snapshot ? null : "${var.project}-${var.environment}-redis-final"
  auto_minor_version_upgrade = var.auto_minor_version_upgrade
  apply_immediately          = var.apply_immediately

  # Notifications
  notification_topic_arn = var.notification_topic_arn

  tags = {
    Name = "${var.project}-${var.environment}-redis"
  }

  lifecycle {
    ignore_changes = [
      num_cache_clusters
    ]
  }
}

# -----------------------------------------------------------------------------
# Store auth token in Secrets Manager
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "redis_auth" {
  count = var.transit_encryption_enabled && var.store_auth_token_in_secrets_manager ? 1 : 0

  name        = "${var.project}/${var.environment}/redis/auth-token"
  description = "Redis auth token for ${var.project} ${var.environment}"
  kms_key_id  = var.secrets_kms_key_id

  tags = {
    Name = "${var.project}-${var.environment}-redis-auth"
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  count = var.transit_encryption_enabled && var.store_auth_token_in_secrets_manager ? 1 : 0

  secret_id = aws_secretsmanager_secret.redis_auth[0].id
  secret_string = jsonencode({
    auth_token       = var.auth_token != null ? var.auth_token : random_password.auth_token[0].result
    primary_endpoint = aws_elasticache_replication_group.main.primary_endpoint_address
    reader_endpoint  = aws_elasticache_replication_group.main.reader_endpoint_address
    port             = var.port
  })
}
