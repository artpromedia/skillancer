# GitHub Secrets & Variables Configuration

This document lists all secrets and repository variables required for the Skillancer CI/CD pipelines.

## How to Configure

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add each secret/variable as listed below

---

## Required Secrets

### 🔐 Core Build & CI

| Secret Name     | Description                              | How to Obtain                                                                      |
| --------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `TURBO_TOKEN`   | Turborepo remote cache token             | [Vercel Dashboard](https://vercel.com/account/tokens) → Create token for Turborepo |
| `CODECOV_TOKEN` | Code coverage reporting token            | [Codecov](https://codecov.io) → Your repo settings                                 |
| `NPM_TOKEN`     | NPM publish token (for package releases) | [npmjs.com](https://www.npmjs.com) → Access Tokens → Generate                      |

### 🗄️ Database (Neon)

| Secret Name               | Description                             | How to Obtain                                                           |
| ------------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| `NEON_PROJECT_ID`         | Neon database project ID                | [Neon Console](https://console.neon.tech) → Project Settings            |
| `NEON_API_KEY`            | Neon API key for branch management      | [Neon Console](https://console.neon.tech) → Account Settings → API Keys |
| `STAGING_DATABASE_URL`    | Staging PostgreSQL connection string    | Neon Console → Connection Details (staging branch)                      |
| `PRODUCTION_DATABASE_URL` | Production PostgreSQL connection string | Neon Console → Connection Details (production branch)                   |

### 🚂 Railway (Preview Environments)

| Secret Name          | Description                        | How to Obtain                                                        |
| -------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| `RAILWAY_TOKEN`      | Railway API token                  | [Railway Dashboard](https://railway.app) → Account Settings → Tokens |
| `RAILWAY_PROJECT_ID` | Railway project ID                 | Railway Dashboard → Project Settings                                 |
| `PREVIEW_REDIS_URL`  | Redis URL for preview environments | Railway Dashboard → Redis service → Connect                          |

### ▲ Vercel (Frontend Deployments)

| Secret Name                      | Description                        | How to Obtain                                                        |
| -------------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| `VERCEL_TOKEN`                   | Vercel API token                   | [Vercel Dashboard](https://vercel.com/account/tokens) → Create Token |
| `VERCEL_ORG_ID`                  | Vercel organization/team ID        | Vercel Dashboard → Team Settings → General                           |
| `VERCEL_PROJECT_ID_WEB`          | Project ID for `apps/web`          | Vercel Dashboard → web project → Settings → General                  |
| `VERCEL_PROJECT_ID_WEB_MARKET`   | Project ID for `apps/web-market`   | Vercel Dashboard → web-market project → Settings → General           |
| `VERCEL_PROJECT_ID_WEB_COCKPIT`  | Project ID for `apps/web-cockpit`  | Vercel Dashboard → web-cockpit project → Settings → General          |
| `VERCEL_PROJECT_ID_WEB_SKILLPOD` | Project ID for `apps/web-skillpod` | Vercel Dashboard → web-skillpod project → Settings → General         |

### ☁️ AWS (Infrastructure & ECS Deployments)

| Secret Name             | Description                        | How to Obtain                                              |
| ----------------------- | ---------------------------------- | ---------------------------------------------------------- |
| `AWS_ACCOUNT_ID`        | AWS account ID (12-digit number)   | AWS Console → Top right → Account ID                       |
| `AWS_ACCESS_KEY_ID`     | AWS IAM access key                 | AWS IAM → Users → Security credentials → Create access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key          | Created with access key above                              |
| `AWS_ROLE_ARN_DEV`      | IAM role ARN for dev Terraform     | `arn:aws:iam::<ACCOUNT_ID>:role/terraform-dev-role`        |
| `AWS_ROLE_ARN_STAGING`  | IAM role ARN for staging Terraform | `arn:aws:iam::<ACCOUNT_ID>:role/terraform-staging-role`    |
| `AWS_ROLE_ARN_PROD`     | IAM role ARN for prod Terraform    | `arn:aws:iam::<ACCOUNT_ID>:role/terraform-prod-role`       |

### 💰 Cost Management

| Secret Name         | Description                          | How to Obtain                                             |
| ------------------- | ------------------------------------ | --------------------------------------------------------- |
| `INFRACOST_API_KEY` | Infracost API key for cost estimates | [Infracost](https://www.infracost.io) → Account → API Key |

### 📢 Notifications

| Secret Name         | Description                | How to Obtain                                     |
| ------------------- | -------------------------- | ------------------------------------------------- |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL | Slack → Apps → Incoming Webhooks → Create webhook |

### 🔒 Auto-Provided Secrets

These secrets are automatically provided by GitHub and **do not need to be configured**:

| Secret Name    | Description                                              |
| -------------- | -------------------------------------------------------- |
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions for repo access |

---

## Repository Variables

Repository variables are used for non-sensitive configuration.

Navigate to **Settings** → **Secrets and variables** → **Actions** → **Variables** tab.

| Variable Name | Description                           | Recommended Value     |
| ------------- | ------------------------------------- | --------------------- |
| `TURBO_TEAM`  | Turborepo team name                   | Your Vercel team slug |
| `CLEANUP_DNS` | Enable DNS cleanup in preview cleanup | `true` or `false`     |

---

## Environments

GitHub Environments provide additional protection for deployments.

Navigate to **Settings** → **Environments** to create:

### `staging`

- **Protection rules**: Require reviewers (optional)
- **Deployment branches**: `master`, `main`

### `production`

- **Protection rules**: Require reviewers (recommended)
- **Deployment branches**: `master`, `main`
- **Wait timer**: 5 minutes (optional)

---

## Required IAM Permissions (AWS)

### For CI/CD User (`AWS_ACCESS_KEY_ID`)

Create an IAM user with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECSAccess",
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:UpdateService",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:ListTasks",
        "ecs:DescribeTasks"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CodeDeployAccess",
      "Effect": "Allow",
      "Action": [
        "codedeploy:CreateDeployment",
        "codedeploy:GetDeployment",
        "codedeploy:GetDeploymentConfig",
        "codedeploy:RegisterApplicationRevision"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": ["arn:aws:iam::*:role/*-task-execution-role", "arn:aws:iam::*:role/*-task-role"]
    }
  ]
}
```

### For Terraform Roles (`AWS_ROLE_ARN_*`)

Create IAM roles with trust policy for GitHub OIDC:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:artpromedia/skillancer:*"
        }
      }
    }
  ]
}
```

Attach `AdministratorAccess` or a custom policy with required permissions for infrastructure management.

---

## Verification Checklist

Run through this checklist after adding all secrets:

- [ ] **CI Pipeline**: Push a commit and verify builds pass
- [ ] **Preview Environments**: Open a PR and verify preview deploys
- [ ] **Staging Deploy**: Merge to master and verify staging deployment
- [ ] **Production Deploy**: Trigger production deployment manually
- [ ] **Rollback**: Test rollback workflow functions correctly
- [ ] **Database Migrations**: Verify migration workflows can connect

---

## Troubleshooting

### "Context access might be invalid" warnings in VS Code

These are IDE warnings, not actual errors. The VS Code GitHub Actions extension cannot verify that secrets exist—only GitHub can validate them at runtime. If workflows fail with "secret not found" errors, the secret needs to be added.

### "Error: Resource not accessible by integration"

The `GITHUB_TOKEN` has insufficient permissions. Check the workflow's `permissions` block or repository settings under **Settings** → **Actions** → **General** → **Workflow permissions**.

### AWS Authentication Failures

1. Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
2. Check IAM user has required permissions
3. For OIDC roles, verify the trust policy includes your repository

### Vercel Deployment Failures

1. Ensure `VERCEL_TOKEN` has access to the organization
2. Verify `VERCEL_ORG_ID` matches your team
3. Check each `VERCEL_PROJECT_ID_*` corresponds to the correct project

---

## Security Best Practices

1. **Rotate secrets regularly** - Especially `AWS_ACCESS_KEY_ID` and database URLs
2. **Use least privilege** - IAM policies should only grant required permissions
3. **Enable environment protection** - Require approvals for production deployments
4. **Audit secret usage** - Review GitHub Actions logs for unexpected secret access
5. **Never commit secrets** - Use `.env.example` files as templates, never `.env` files with real values
