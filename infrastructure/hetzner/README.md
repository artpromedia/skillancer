# Hetzner Cloud Infrastructure - Migration Guide

## Overview

This directory contains everything needed to deploy Skillancer on **Hetzner Cloud** using **K3s** (lightweight Kubernetes), self-hosted **PostgreSQL 16**, and **Redis 7** — replacing the AWS EKS/RDS/ElastiCache stack.

### Cost Comparison

| Component              | AWS (Monthly)            | Hetzner (Monthly)    | Savings  |
| ---------------------- | ------------------------ | -------------------- | -------- |
| Kubernetes (3 workers) | ~$450 (EKS + EC2)        | ~$45 (3× CX31)       | 90%      |
| Database (PostgreSQL)  | ~$200 (RDS db.r6g.large) | ~$15 (CX31 + volume) | 92%      |
| Redis                  | ~$120 (ElastiCache)      | ~$8 (CX21)           | 93%      |
| Load Balancer          | ~$25 (ALB)               | ~$6 (LB11)           | 76%      |
| Object Storage (100GB) | ~$3 (S3)                 | ~$3 (Hetzner)        | 0%       |
| **Total**              | **~$800/mo**             | **~$77/mo**          | **~90%** |

## Architecture

```
                  ┌──────────────────────┐
                  │   Cloudflare CDN     │
                  │   (DNS + WAF + CDN)  │
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │  Hetzner Load        │
                  │  Balancer (LB11)     │
                  └──────────┬───────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
   ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
   │  K3s Worker  │   │  K3s Worker  │   │  K3s Worker  │
   │  (CX31)     │   │  (CX31)     │   │  (CX31)     │
   │  10.0.1.20  │   │  10.0.1.21  │   │  10.0.1.22  │
   └─────────────┘   └─────────────┘   └─────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │  Private Network
                    ┌────────┴────────┐
            ┌───────▼───────┐ ┌───────▼───────┐
            │  PostgreSQL   │ │    Redis      │
            │  (CX31)      │ │    (CX21)     │
            │  10.0.2.10   │ │    10.0.2.20  │
            └───────────────┘ └───────────────┘

   Control Plane: CX31 @ 10.0.1.10 (K3s server + nginx ingress + cert-manager)
```

## Directory Structure

```
infrastructure/hetzner/
├── README.md                          # This file
├── Caddyfile                          # Reverse proxy for docker-compose mode
└── terraform/
    ├── main.tf                        # All Hetzner Cloud resources
    ├── terraform.tfvars.example       # Example variable values
    └── templates/
        ├── cloud-init-cp.yaml         # K3s control plane provisioning
        ├── cloud-init-worker.yaml     # K3s worker node provisioning
        ├── cloud-init-db.yaml         # PostgreSQL server setup
        └── cloud-init-redis.yaml      # Redis server setup
```

## Prerequisites

1. **Hetzner Cloud Account** — [console.hetzner.cloud](https://console.hetzner.cloud)
2. **Hetzner API Token** — Project → Security → API Tokens → Generate
3. **Terraform** ≥ 1.5 — `brew install terraform` or [download](https://terraform.io)
4. **kubectl** — `brew install kubectl`
5. **Domain** pointed to Cloudflare (recommended) or Hetzner DNS

## Quick Start

### 1. Provision Infrastructure

```bash
cd infrastructure/hetzner/terraform

# Copy and edit variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your API token, SSH key, passwords, etc.

# Initialize and apply
terraform init
terraform plan
terraform apply
```

### 2. Get Kubeconfig

After Terraform completes, SSH into the control plane and copy the kubeconfig:

```bash
# Get control plane IP from Terraform output
CP_IP=$(terraform output -raw control_plane_ip)

# Copy kubeconfig locally
ssh root@$CP_IP "cat /etc/rancher/k3s/k3s.yaml" | \
  sed "s/127.0.0.1/$CP_IP/g" > ~/.kube/config-hetzner

export KUBECONFIG=~/.kube/config-hetzner

# Verify
kubectl get nodes
```

### 3. Create Namespace & Secrets

```bash
# Create namespace
kubectl create namespace skillancer

# Create GHCR pull secret
kubectl create secret docker-registry ghcr-secret \
  -n skillancer \
  --docker-server=ghcr.io \
  --docker-username=<github-user> \
  --docker-password=<github-pat>

# Create app secrets (or use Doppler operator)
kubectl create secret generic skillancer-secrets \
  -n skillancer \
  --from-literal=JWT_SECRET='<your-jwt-secret>' \
  --from-literal=SESSION_SECRET='<your-session-secret>' \
  --from-literal=DATABASE_URL='postgresql://skillancer:<db-password>@10.0.2.10:5432/skillancer' \
  --from-literal=REDIS_URL='redis://:<redis-password>@10.0.2.20:6379' \
  --from-literal=STRIPE_SECRET_KEY='<your-stripe-key>'

# Create DB credentials secret
kubectl create secret generic db-credentials \
  -n skillancer \
  --from-literal=password='<db-password>'

# Create Redis credentials secret
kubectl create secret generic redis-credentials \
  -n skillancer \
  --from-literal=password='<redis-password>'
```

### 4. Deploy Services

```bash
# Deploy all services
./scripts/deploy-hetzner.sh production all v1.0.0

# Or deploy a single service
./scripts/deploy-hetzner.sh production api-gateway v1.0.0

# Dry run first
DRY_RUN=true ./scripts/deploy-hetzner.sh production all v1.0.0
```

### 5. Configure DNS

Point your domain to the Hetzner Load Balancer IP:

```bash
# Get LB IP
terraform output load_balancer_ip

# In Cloudflare (or your DNS):
# A  api.skillancer.com    → <LB_IP>  (proxied)
# A  skillancer.com        → <LB_IP>  (proxied)
# A  metrics.skillancer.com → <CP_IP> (DNS only)
```

## Deployment Options

### Option A: K3s Cluster (Recommended for Production)

Uses Helm values with the Hetzner overlay:

```bash
helm upgrade --install skillancer ./chart \
  -f infrastructure/kubernetes/production/values.yaml \
  -f infrastructure/kubernetes/production/values-hetzner.yaml \
  -n skillancer
```

Or use the deploy script which does `kubectl set image` for rolling updates.

### Option B: Docker Compose (Single Server)

For smaller deployments or staging:

```bash
# Create .env from template
cp .env.example .env
# Edit .env with your secrets

# Deploy
docker compose -f docker-compose.hetzner.yml up -d

# Check logs
docker compose -f docker-compose.hetzner.yml logs -f api-gateway
```

## CI/CD (GitHub Actions)

The `.github/workflows/deploy-hetzner.yml` workflow handles automated deployments:

### Required GitHub Secrets

| Secret                       | Description                                  |
| ---------------------------- | -------------------------------------------- |
| `HETZNER_STAGING_KUBECONFIG` | Base64-encoded kubeconfig for staging K3s    |
| `HETZNER_PROD_KUBECONFIG`    | Base64-encoded kubeconfig for production K3s |
| `SLACK_WEBHOOK_URL`          | Slack notifications (optional)               |

### Workflow Flow

```
Push to main → Build images (GHCR) → Deploy staging → Manual approval → Deploy production
```

Automatic rollback is triggered on failed health checks.

## Operations

### SSH Access

```bash
# Control plane
ssh root@$(terraform output -raw control_plane_ip)

# Worker nodes
ssh root@$(terraform output -json worker_ips | jq -r '.[0]')

# Database server
ssh root@$(terraform output -raw database_ip)

# Redis server
ssh root@$(terraform output -raw redis_ip)
```

### Database Backup

```bash
# SSH into DB server
ssh root@$(terraform output -raw database_ip)

# Manual backup
pg_dump -U skillancer skillancer | gzip > /var/lib/postgresql/backups/manual-$(date +%Y%m%d).sql.gz

# Automated daily backups are configured in cloud-init
ls -la /var/lib/postgresql/backups/
```

### Monitoring

- **Grafana**: `https://metrics.skillancer.com` (admin / see Terraform output)
- **Prometheus**: Port-forward `kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring`
- **K3s dashboard**: `kubectl proxy` → `http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/`

### Scaling

```bash
# Scale a service
kubectl scale deployment api-gateway --replicas=5 -n skillancer

# Add a worker node: increase worker_count in terraform.tfvars
terraform apply -var="worker_count=5"
```

### Logs

```bash
# Service logs
kubectl logs -f deployment/api-gateway -n skillancer

# All services
kubectl logs -f -l environment=production -n skillancer --max-log-requests=20
```

## Migration Checklist (AWS → Hetzner)

- [ ] Provision Hetzner infra via Terraform
- [ ] Verify K3s cluster is healthy (`kubectl get nodes`)
- [ ] Export data from AWS RDS → import into Hetzner PostgreSQL
- [ ] Migrate S3 data → Hetzner Object Storage or MinIO
- [ ] Update DNS to point to Hetzner LB
- [ ] Set GitHub secrets for Hetzner kubeconfig
- [ ] Deploy services via CI/CD or deploy script
- [ ] Verify all services healthy
- [ ] Update Doppler env vars (DATABASE_URL, REDIS_URL, S3_ENDPOINT)
- [ ] Monitor for 48h before decommissioning AWS
- [ ] Decommission AWS resources

## Troubleshooting

### K3s Issues

```bash
# Check K3s service
ssh root@<cp-ip> systemctl status k3s

# K3s logs
ssh root@<cp-ip> journalctl -u k3s -f

# Node not joining?
ssh root@<worker-ip> journalctl -u k3s-agent -f
```

### Database Issues

```bash
# Check PostgreSQL
ssh root@<db-ip> systemctl status postgresql

# Slow queries
ssh root@<db-ip> psql -U skillancer -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

### Pod Issues

```bash
# Describe pod for events
kubectl describe pod <pod-name> -n skillancer

# Check resource usage
kubectl top pods -n skillancer
kubectl top nodes
```
