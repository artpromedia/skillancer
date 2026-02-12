# =============================================================================
# Secrets Module
# Creates Secrets Manager secrets for application configuration
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
# Random passwords for services
# -----------------------------------------------------------------------------

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "api_key" {
  length  = 32
  special = false
}

# -----------------------------------------------------------------------------
# Database Secret (if not created by RDS module)
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "database" {
  count = var.create_database_secret ? 1 : 0

  name        = "${var.project}/${var.environment}/database/credentials"
  description = "Database credentials for ${var.project} ${var.environment}"
  kms_key_id  = var.kms_key_id

  tags = {
    Name = "${var.project}-${var.environment}-database-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "database" {
  count = var.create_database_secret ? 1 : 0

  secret_id = aws_secretsmanager_secret.database[0].id
  secret_string = jsonencode({
    username = var.database_username
    password = var.database_password
    host     = var.database_host
    port     = var.database_port
    dbname   = var.database_name
  })
}

# -----------------------------------------------------------------------------
# Application Secrets
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${var.project}/${var.environment}/app/secrets"
  description = "Application secrets for ${var.project} ${var.environment}"
  kms_key_id  = var.kms_key_id

  tags = {
    Name = "${var.project}-${var.environment}-app-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode(merge(
    {
      JWT_SECRET     = random_password.jwt_secret.result
      API_KEY        = random_password.api_key.result
      ENVIRONMENT    = var.environment
    },
    var.additional_secrets
  ))
}

# -----------------------------------------------------------------------------
# Service-specific Secrets
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "service_secrets" {
  for_each = var.service_secrets

  name        = "${var.project}/${var.environment}/${each.key}/secrets"
  description = "Secrets for ${each.key} service in ${var.project} ${var.environment}"
  kms_key_id  = var.kms_key_id

  tags = {
    Name    = "${var.project}-${var.environment}-${each.key}-secrets"
    Service = each.key
  }
}

resource "aws_secretsmanager_secret_version" "service_secrets" {
  for_each = var.service_secrets

  secret_id     = aws_secretsmanager_secret.service_secrets[each.key].id
  secret_string = jsonencode(each.value)
}

# -----------------------------------------------------------------------------
# Third-party Integration Secrets
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "integrations" {
  count = var.create_integration_secrets ? 1 : 0

  name        = "${var.project}/${var.environment}/integrations"
  description = "Third-party integration secrets for ${var.project} ${var.environment}"
  kms_key_id  = var.kms_key_id

  tags = {
    Name = "${var.project}-${var.environment}-integration-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "integrations" {
  count = var.create_integration_secrets ? 1 : 0

  secret_id = aws_secretsmanager_secret.integrations[0].id
  secret_string = jsonencode({
    STRIPE_API_KEY           = var.stripe_api_key
    STRIPE_WEBHOOK_SECRET    = var.stripe_webhook_secret
    SENDGRID_API_KEY         = var.sendgrid_api_key
    ALERT_WEBHOOK_URL        = var.alert_webhook_url
    SENTRY_DSN               = var.sentry_dsn
  })
}
