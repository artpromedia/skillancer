# Secrets Management Guide

This document describes how Skillancer manages secrets and sensitive configuration across different environments.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Secret Categories](#secret-categories)
- [Local Development (Doppler)](#local-development-doppler)
- [Production (AWS Secrets Manager)](#production-aws-secrets-manager)
- [Adding New Secrets](#adding-new-secrets)
- [Secret Rotation](#secret-rotation)
- [Emergency Procedures](#emergency-procedures)
- [Best Practices](#best-practices)

## Overview

Skillancer uses a dual-approach to secrets management:

| Environment        | Solution                | Purpose                            |
| ------------------ | ----------------------- | ---------------------------------- |
| Local Development  | **Doppler**             | Easy secret access for developers  |
| Staging/Production | **AWS Secrets Manager** | Secure, audited, rotatable secrets |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Secrets Management Architecture                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Local Development                    Production/Staging                   │
│   ─────────────────                    ───────────────────                  │
│                                                                             │
│   ┌─────────────┐                      ┌─────────────────────┐              │
│   │   Doppler   │                      │  AWS Secrets Manager│              │
│   │   Cloud     │                      │                     │              │
│   └──────┬──────┘                      └──────────┬──────────┘              │
│          │                                        │                         │
│          ▼                                        ▼                         │
│   ┌─────────────┐                      ┌─────────────────────┐              │
│   │ doppler run │                      │    KMS Encryption   │              │
│   │    -- cmd   │                      │                     │              │
│   └──────┬──────┘                      └──────────┬──────────┘              │
│          │                                        │                         │
│          ▼                                        ▼                         │
│   ┌─────────────┐                      ┌─────────────────────┐              │
│   │  App with   │                      │   ECS Task with     │              │
│   │  Env Vars   │                      │   Injected Secrets  │              │
│   └─────────────┘                      └─────────────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Architecture

### AWS Infrastructure

```hcl
# Secrets are managed via Terraform
module "secrets" {
  source = "../../modules/secrets"

  project     = "skillancer"
  environment = "prod"

  secrets = {
    "jwt-secret" = {
      description = "JWT signing secret"
      generate    = true
      length      = 64
    }
    "stripe-secret-key" = {
      description = "Stripe API key"
      generate    = false  # Set manually
    }
  }
}
```

### Naming Convention

| Type            | Pattern                              | Example                             |
| --------------- | ------------------------------------ | ----------------------------------- |
| Secrets Manager | `{project}/{env}/{secret-name}`      | `skillancer/prod/jwt-secret`        |
| SSM Parameters  | `/{project}/{env}/{category}/{name}` | `/skillancer/prod/config/log-level` |
| KMS Keys        | `alias/{project}-{env}-secrets`      | `alias/skillancer-prod-secrets`     |

## Secret Categories

### Authentication & Security

| Secret             | Description             | Rotation                 |
| ------------------ | ----------------------- | ------------------------ |
| `jwt-secret`       | JWT token signing key   | Manual (service restart) |
| `session-secret`   | Session encryption key  | Manual                   |
| `api-internal-key` | Service-to-service auth | Manual                   |

### Database

| Secret                 | Description           | Rotation       |
| ---------------------- | --------------------- | -------------- |
| `database-credentials` | PostgreSQL connection | Auto (30 days) |
| `redis-credentials`    | Redis connection      | Auto (30 days) |

### Third-Party Services

| Secret                       | Description           | How to Obtain                                                             |
| ---------------------------- | --------------------- | ------------------------------------------------------------------------- |
| `stripe-secret-key`          | Stripe API key        | [Stripe Dashboard](https://dashboard.stripe.com/apikeys)                  |
| `stripe-webhook-secret`      | Webhook signing       | Created when webhook endpoint is registered                               |
| `google-oauth-client-secret` | OAuth secret          | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `apple-oauth-client-secret`  | Sign-in with Apple    | [Apple Developer](https://developer.apple.com/account/resources/authkeys) |
| `sendgrid-api-key`           | Email API key         | [SendGrid Settings](https://app.sendgrid.com/settings/api_keys)           |
| `persona-api-key`            | Identity verification | [Persona Dashboard](https://app.withpersona.com/dashboard/api-keys)       |
| `sentry-dsn`                 | Error tracking        | [Sentry Project Settings](https://sentry.io/settings/)                    |

### Configuration (SSM Parameters)

| Parameter                | Description          | Type   |
| ------------------------ | -------------------- | ------ |
| `config/log-level`       | Logging verbosity    | String |
| `config/cors-origins`    | Allowed CORS origins | String |
| `config/feature-flags`   | Feature toggles      | JSON   |
| `oauth/google-client-id` | OAuth client ID      | String |
| `stripe/publishable-key` | Stripe public key    | String |

## Local Development (Doppler)

### Initial Setup

```bash
# macOS/Linux
./scripts/setup-doppler.sh

# Windows (PowerShell)
.\scripts\setup-doppler.ps1
```

### Daily Usage

```bash
# Start development with secrets
doppler run -- pnpm dev

# Start specific service
doppler run -- pnpm --filter @skillancer/api dev

# View available secrets
doppler secrets --only-names

# Switch environment
doppler setup --config staging
```

### Adding Secrets to Doppler

1. **Via Dashboard:**
   - Go to [dashboard.doppler.com](https://dashboard.doppler.com)
   - Select `skillancer` project
   - Choose environment (dev/staging/prod)
   - Add or edit secrets

2. **Via CLI:**

   ```bash
   # Set a secret
   doppler secrets set MY_SECRET "value"

   # Set multiple secrets
   doppler secrets set API_KEY="key1" API_SECRET="key2"

   # Upload from file
   doppler secrets upload .env.example
   ```

### Environment File (For IDE Support)

Some IDEs need a `.env` file for autocomplete. Generate a template:

```bash
# Generate .env.example (no real values)
doppler secrets download --no-file --format env-no-quotes | \
  sed 's/=.*/=/' > .env.example

# For debugging only - generates real values (DO NOT COMMIT!)
doppler secrets download --no-file --format env > .env.local
echo ".env.local" >> .gitignore
```

## Production (AWS Secrets Manager)

### How ECS Accesses Secrets

```hcl
# ECS Task Definition
resource "aws_ecs_task_definition" "api" {
  container_definitions = jsonencode([{
    name = "api"
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = module.secrets.secret_arns["database-credentials"]
      },
      {
        name      = "JWT_SECRET"
        valueFrom = module.secrets.secret_arns["jwt-secret"]
      }
    ]
    environment = [
      {
        name  = "LOG_LEVEL"
        value = "info"  # Non-sensitive config
      }
    ]
  }])
}
```

### Viewing Secrets

```bash
# List all secrets
aws secretsmanager list-secrets \
  --filter Key=name,Values=skillancer/prod

# Get a secret value
aws secretsmanager get-secret-value \
  --secret-id skillancer/prod/jwt-secret \
  --query SecretString --output text
```

### Manual Secret Update

```bash
# Update secret value
aws secretsmanager put-secret-value \
  --secret-id skillancer/prod/stripe-secret-key \
  --secret-string "sk_live_..."

# Restart ECS service to pick up new value
aws ecs update-service \
  --cluster skillancer-prod \
  --service api \
  --force-new-deployment
```

## Adding New Secrets

### Step 1: Define in Terraform

```hcl
# In environments/{env}/secrets.tf
module "secrets" {
  # ...existing config...

  secrets = {
    # ...existing secrets...

    # Add new secret
    "new-api-key" = {
      description = "New third-party API key"
      generate    = false  # or true if auto-generated
    }
  }
}
```

### Step 2: Apply Terraform

```bash
cd infrastructure/terraform/environments/prod
terraform plan
terraform apply
```

### Step 3: Set the Value

```bash
# For manually-set secrets
aws secretsmanager put-secret-value \
  --secret-id skillancer/prod/new-api-key \
  --secret-string "actual-api-key-value"
```

### Step 4: Reference in Service

```hcl
# In ECS task definition
secrets = [
  {
    name      = "NEW_API_KEY"
    valueFrom = module.secrets.secret_arns["new-api-key"]
  }
]
```

### Step 5: Update Doppler

Add the same secret to Doppler for local development.

## Secret Rotation

### Automatic Rotation (Database)

Database passwords rotate automatically every 30 days:

```hcl
# Enabled in secrets module
enable_db_password_rotation = true
db_password_rotation_days   = 30
```

The rotation Lambda:

1. Generates new password
2. Updates RDS credentials
3. Tests connection
4. Marks new version as current

### Manual Rotation

For secrets that can't auto-rotate (JWT, API keys):

```bash
# 1. Generate new value
NEW_SECRET=$(openssl rand -base64 48)

# 2. Update in Secrets Manager
aws secretsmanager put-secret-value \
  --secret-id skillancer/prod/jwt-secret \
  --secret-string "$NEW_SECRET"

# 3. Update in Doppler (for dev)
doppler secrets set JWT_SECRET="$NEW_SECRET" --config dev

# 4. Restart services
aws ecs update-service \
  --cluster skillancer-prod \
  --service api \
  --force-new-deployment
```

### Rotation Schedule

| Secret               | Rotation  | Method    |
| -------------------- | --------- | --------- |
| Database credentials | 30 days   | Automatic |
| Redis credentials    | 30 days   | Automatic |
| JWT secret           | 90 days   | Manual    |
| API keys             | As needed | Manual    |

## Emergency Procedures

### Compromised Secret

1. **Immediately rotate the secret:**

   ```bash
   # Generate new value
   NEW_VALUE=$(openssl rand -base64 32)

   # Update in AWS
   aws secretsmanager put-secret-value \
     --secret-id skillancer/prod/compromised-secret \
     --secret-string "$NEW_VALUE"
   ```

2. **Force service restart:**

   ```bash
   aws ecs update-service \
     --cluster skillancer-prod \
     --service api \
     --force-new-deployment
   ```

3. **Audit access:**

   ```bash
   # Check CloudTrail for secret access
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=ResourceName,AttributeValue=skillancer/prod/compromised-secret \
     --start-time $(date -d '7 days ago' --iso-8601=seconds)
   ```

4. **Notify security team** and document incident

### KMS Key Compromise

If the KMS key is compromised:

1. Create new KMS key
2. Re-encrypt all secrets with new key
3. Update Terraform to use new key
4. Schedule deletion of old key

### Database Credential Issues

If rotation fails or credentials don't work:

```bash
# Check rotation status
aws secretsmanager describe-secret \
  --secret-id skillancer/prod/database-credentials

# Get current version
aws secretsmanager get-secret-value \
  --secret-id skillancer/prod/database-credentials \
  --version-stage AWSCURRENT

# Get pending version (if rotation in progress)
aws secretsmanager get-secret-value \
  --secret-id skillancer/prod/database-credentials \
  --version-stage AWSPENDING

# Cancel pending rotation
aws secretsmanager cancel-rotate-secret \
  --secret-id skillancer/prod/database-credentials
```

## Best Practices

### Do's ✅

- **Use generated secrets** when possible (more secure than human-created)
- **Enable automatic rotation** for database credentials
- **Use separate secrets** for each environment
- **Audit secret access** via CloudTrail
- **Use KMS encryption** for all secrets
- **Reference secrets by ARN** in ECS tasks
- **Use Doppler** for local development (never .env files with real values)

### Don'ts ❌

- **Never commit secrets** to Git (even in private repos)
- **Never log secrets** in application code
- **Never share secrets** via Slack/email
- **Never use production secrets** locally
- **Never hardcode secrets** in Terraform
- **Never disable encryption** on secrets

### Secret Hygiene

```javascript
// ❌ Bad - logging secrets
console.log(`Database URL: ${process.env.DATABASE_URL}`);

// ✅ Good - log presence only
console.log(`Database configured: ${!!process.env.DATABASE_URL}`);

// ❌ Bad - secrets in error messages
throw new Error(`API key ${apiKey} is invalid`);

// ✅ Good - no secrets in errors
throw new Error('API key validation failed');
```

### Git Configuration

Ensure `.gitignore` includes:

```gitignore
# Secrets
.env
.env.local
.env.*.local
*.pem
*.key
secrets.json
credentials.json

# Doppler
.doppler.yaml
```

## Troubleshooting

### "Access Denied" When Accessing Secrets

1. Check IAM role has `secretsmanager:GetSecretValue` permission
2. Check KMS key policy allows the role to decrypt
3. Verify secret ARN is correct

### Doppler Not Injecting Secrets

1. Verify you're logged in: `doppler me`
2. Check project setup: `doppler setup`
3. Verify secrets exist: `doppler secrets --only-names`

### ECS Task Not Getting Secrets

1. Check task execution role has secrets access
2. Verify secret ARN format in task definition
3. Check CloudWatch logs for errors
4. Ensure secret exists in correct region

### Rotation Lambda Failing

1. Check Lambda CloudWatch logs
2. Verify VPC configuration (Lambda needs DB access)
3. Check Lambda IAM role permissions
4. Verify database credentials format

## References

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/)
- [Doppler Documentation](https://docs.doppler.com/)
- [KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [ECS Secrets Reference](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html)
