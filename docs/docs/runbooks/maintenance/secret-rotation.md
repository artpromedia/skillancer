# Secret Rotation

Guide for rotating API keys, secrets, and credentials.

**Last Verified**: 2024-01-25  
**Owner**: Security Team

## Overview

Regular secret rotation is essential for security. This runbook covers rotating various secrets used by Skillancer services.

## Rotation Schedule

| Secret Type          | Rotation Frequency  | Last Rotated |
| -------------------- | ------------------- | ------------ |
| Database passwords   | Quarterly           | [Check AWS]  |
| API keys (internal)  | Quarterly           | [Check AWS]  |
| JWT signing keys     | Annually            | [Check AWS]  |
| Third-party API keys | Per provider policy | Varies       |
| AWS access keys      | Quarterly           | [Check IAM]  |

## Prerequisites

- [ ] AWS IAM access (secrets management)
- [ ] Kubernetes access (production)
- [ ] Access to third-party dashboards
- [ ] Maintenance window scheduled

## General Rotation Process

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Secret Rotation Flow                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │
│  │  Generate   │───▶│   Update    │───▶│    Update App           │  │
│  │ New Secret  │    │   Storage   │    │    Config               │  │
│  └─────────────┘    └─────────────┘    └─────────────────────────┘  │
│         │                  │                        │               │
│         ▼                  ▼                        ▼               │
│     Generate           AWS Secrets           Restart services       │
│     securely           Manager               or rolling update      │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │
│  │   Verify    │───▶│   Revoke    │───▶│    Document             │  │
│  │  New Works  │    │    Old      │    │                         │  │
│  └─────────────┘    └─────────────┘    └─────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Password Rotation

### RDS Password Rotation

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

# 2. Update in AWS Secrets Manager
aws secretsmanager update-secret \
  --secret-id skillancer/production/database \
  --secret-string "{\"username\":\"skillancer\",\"password\":\"$NEW_PASSWORD\",\"host\":\"...\",\"port\":5432,\"database\":\"skillancer\"}"

# 3. Update RDS master password
aws rds modify-db-instance \
  --db-instance-identifier skillancer-production \
  --master-user-password "$NEW_PASSWORD" \
  --apply-immediately

# 4. Wait for RDS to update (few minutes)
aws rds wait db-instance-available \
  --db-instance-identifier skillancer-production

# 5. Restart services to pick up new credentials
kubectl rollout restart deployment -n production
```

### Verify Database Connection

```bash
# Test connection with new password
PGPASSWORD=$NEW_PASSWORD psql -h <host> -U skillancer -d skillancer -c "SELECT 1"

# Check application logs for connection errors
kubectl logs -l app=user-service -n production --since=5m | grep -i "connection\|password"
```

## JWT Signing Key Rotation

### Rotate JWT Keys

JWT keys require a transition period to avoid invalidating active tokens.

```bash
# 1. Generate new key pair
openssl genrsa -out new_jwt_private.pem 2048
openssl rsa -in new_jwt_private.pem -pubout -out new_jwt_public.pem

# 2. Base64 encode for storage
NEW_PRIVATE=$(base64 -w 0 new_jwt_private.pem)
NEW_PUBLIC=$(base64 -w 0 new_jwt_public.pem)

# 3. Update secret (keep old key for verification during transition)
aws secretsmanager update-secret \
  --secret-id skillancer/production/jwt \
  --secret-string "{
    \"private_key\": \"$NEW_PRIVATE\",
    \"public_key\": \"$NEW_PUBLIC\",
    \"old_public_key\": \"$OLD_PUBLIC\"
  }"

# 4. Deploy with transition mode
# Application should verify with both new and old public keys

# 5. After token TTL (24 hours), remove old key
aws secretsmanager update-secret \
  --secret-id skillancer/production/jwt \
  --secret-string "{
    \"private_key\": \"$NEW_PRIVATE\",
    \"public_key\": \"$NEW_PUBLIC\"
  }"
```

## Third-Party API Keys

### Stripe API Keys

```bash
# 1. Generate new key in Stripe Dashboard
# https://dashboard.stripe.com/apikeys

# 2. Update in AWS Secrets Manager
aws secretsmanager update-secret \
  --secret-id skillancer/production/stripe \
  --secret-string "{
    \"secret_key\": \"sk_live_new...\",
    \"publishable_key\": \"pk_live_new...\",
    \"webhook_secret\": \"whsec_...\"
  }"

# 3. Restart payment service
kubectl rollout restart deployment/payment-service -n production

# 4. Verify webhook works
# Create a test webhook event in Stripe

# 5. Deactivate old key in Stripe Dashboard
```

### SendGrid API Key

```bash
# 1. Generate new key in SendGrid
# https://app.sendgrid.com/settings/api_keys

# 2. Update in AWS
aws secretsmanager update-secret \
  --secret-id skillancer/production/sendgrid \
  --secret-string "{\"api_key\": \"SG.new...\"}"

# 3. Restart notification service
kubectl rollout restart deployment/notification-service -n production

# 4. Verify email sending works
# Trigger a test email

# 5. Delete old key in SendGrid
```

### AWS Access Keys

```bash
# 1. Create new access key
aws iam create-access-key --user-name skillancer-app

# 2. Update wherever used (environment, secrets)
aws secretsmanager update-secret \
  --secret-id skillancer/production/aws \
  --secret-string "{
    \"access_key_id\": \"AKIA...\",
    \"secret_access_key\": \"...\"
  }"

# 3. Deploy changes
kubectl rollout restart deployment -n production

# 4. Verify functionality

# 5. Deactivate old key
aws iam update-access-key \
  --user-name skillancer-app \
  --access-key-id OLD_KEY_ID \
  --status Inactive

# 6. After verification period (24-48h), delete old key
aws iam delete-access-key \
  --user-name skillancer-app \
  --access-key-id OLD_KEY_ID
```

## Kubernetes Secret Rotation

If using Kubernetes secrets directly:

```bash
# 1. Create new secret version
kubectl create secret generic <secret-name>-v2 \
  --from-literal=key=new_value \
  -n production

# 2. Update deployment to use new secret
kubectl patch deployment <service> -n production \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/envFrom/0/secretRef/name", "value": "<secret-name>-v2"}]'

# 3. Verify application works

# 4. Delete old secret
kubectl delete secret <secret-name> -n production
```

## Verification Checklist

After rotation:

- [ ] Application starts successfully
- [ ] No authentication errors in logs
- [ ] External services accessible (payments, email, etc.)
- [ ] Health checks passing
- [ ] Error rates normal
- [ ] Old secret/key revoked

## Emergency: Compromised Secret

If a secret is compromised:

1. **Immediately** rotate the compromised secret
2. Do **NOT** wait for maintenance window
3. Notify security team
4. Audit access logs for unauthorized use
5. Document incident

```bash
# Quick rotation (example for API key)
NEW_KEY=$(openssl rand -hex 32)
aws secretsmanager update-secret \
  --secret-id <secret-id> \
  --secret-string "$NEW_KEY"

kubectl rollout restart deployment -n production

# Then revoke old key in provider dashboard
```

## Documentation

After rotation:

1. Update rotation log in wiki
2. Update `last_rotated` field in secrets metadata
3. Schedule next rotation reminder

## Related Runbooks

- [Database Maintenance](./database)
- [Production Deployment](../deployment/production)
