# Skillancer — Deployment Guide (Hetzner + Cloudflare)

> Complete guide to deploying Skillancer on Hetzner Cloud with Cloudflare for CDN, WAF, DNS, and Zero Trust Tunnel.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start (Guided)](#quick-start-guided)
4. [Manual Setup](#manual-setup)
   - [Step 1: Hetzner Account & API Token](#step-1-hetzner-account--api-token)
   - [Step 2: Cloudflare Account & Domain](#step-2-cloudflare-account--domain)
   - [Step 3: Provision Hetzner Infrastructure](#step-3-provision-hetzner-infrastructure)
   - [Step 4: Provision Cloudflare](#step-4-provision-cloudflare)
   - [Step 5: Connect to K3s Cluster](#step-5-connect-to-k3s-cluster)
   - [Step 6: Install Cloudflare Tunnel](#step-6-install-cloudflare-tunnel)
   - [Step 7: Deploy Application](#step-7-deploy-application)
   - [Step 8: Verify](#step-8-verify)
5. [Cloudflare Features](#cloudflare-features)
6. [R2 Object Storage](#r2-object-storage)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Operations](#operations)
9. [Cost Breakdown](#cost-breakdown)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
                     ┌────────────────────────────────┐
                     │       Cloudflare Edge           │
                     │  ┌──────────────────────────┐   │
     Users ─────────►│  │  CDN / WAF / Rate Limit  │   │
                     │  │  DDoS / Bot Protection   │   │
                     │  │  Full-Strict TLS + HSTS  │   │
                     │  └────────────┬─────────────┘   │
                     │               │                 │
                     │  ┌────────────▼─────────────┐   │
                     │  │  Cloudflare Tunnel        │   │
                     │  │  (Zero Trust, no open     │   │
                     │  │   ports on origin)        │   │
                     │  └────────────┬─────────────┘   │
                     └───────────────┼─────────────────┘
                                     │ Encrypted tunnel
                     ┌───────────────▼─────────────────┐
                     │       Hetzner Cloud (FSN1)       │
                     │                                  │
                     │  ┌──── K3s Cluster ───────────┐  │
                     │  │                            │  │
                     │  │  cloudflared (DaemonSet)   │  │
                     │  │       │                    │  │
                     │  │  ┌────▼──────┐             │  │
                     │  │  │  nginx    │             │  │
                     │  │  │  ingress  │             │  │
                     │  │  └────┬──────┘             │  │
                     │  │       │                    │  │
                     │  │  ┌────▼──────────────────┐ │  │
                     │  │  │  api-gateway          │ │  │
                     │  │  │  auth-svc             │ │  │
                     │  │  │  market-svc           │ │  │
                     │  │  │  skillpod-svc         │ │  │
                     │  │  │  cockpit-svc          │ │  │
                     │  │  │  billing-svc          │ │  │
                     │  │  │  notification-svc     │ │  │
                     │  │  │  audit-svc            │ │  │
                     │  │  └──────────────────────┘ │  │
                     │  │                            │  │
                     │  │  CP + 3 Workers (CX31)    │  │
                     │  └────────────────────────────┘  │
                     │                                  │
                     │  ┌──── Private Network ───────┐  │
                     │  │  PostgreSQL 16  (10.0.2.10)│  │
                     │  │  Redis 7       (10.0.2.20) │  │
                     │  └────────────────────────────┘  │
                     └──────────────────────────────────┘

     Cloudflare R2 ◄── Object Storage (uploads, assets, backups)
```

### Key Benefits

| Feature               | What It Does                                                                           |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Cloudflare Tunnel** | No open ports on origin servers. Traffic routed through Cloudflare's encrypted tunnel. |
| **WAF**               | OWASP Core Ruleset + Cloudflare Managed Rules block SQLi, XSS, RCE.                    |
| **DDoS Protection**   | Unlimited, unmetered DDoS mitigation at L3/L4/L7.                                      |
| **CDN**               | Static assets cached at 300+ edge locations. Next.js `_next/static/` cached 1 year.    |
| **R2**                | S3-compatible storage with zero egress fees.                                           |
| **Rate Limiting**     | API: 200 req/min. Auth: 10 req/5min. Signup: 5/hour.                                   |
| **SSL/TLS**           | Full Strict mode, TLS 1.2+, HSTS preloaded, HTTP/3.                                    |
| **Zero Trust**        | Admin panel and metrics behind Cloudflare Access.                                      |

---

## Prerequisites

### Tools Required

| Tool      | Min Version | Install                                                                     |
| --------- | ----------- | --------------------------------------------------------------------------- |
| Terraform | 1.5+        | [terraform.io](https://terraform.io/downloads) or `choco install terraform` |
| kubectl   | 1.28+       | `choco install kubernetes-cli` or `brew install kubectl`                    |
| SSH       | any         | Pre-installed on Windows 10+, macOS, Linux                                  |
| Git       | 2.0+        | `choco install git` or `brew install git`                                   |
| jq        | 1.6+        | `choco install jq` or `brew install jq`                                     |

### Accounts Required

| Account       | Purpose                       | URL                                                    |
| ------------- | ----------------------------- | ------------------------------------------------------ |
| Hetzner Cloud | Servers, networking, volumes  | [console.hetzner.cloud](https://console.hetzner.cloud) |
| Cloudflare    | CDN, DNS, WAF, Tunnel, R2     | [dash.cloudflare.com](https://dash.cloudflare.com)     |
| GitHub        | Container registry (GHCR)     | [github.com](https://github.com)                       |
| Doppler       | Secrets management (optional) | [doppler.com](https://doppler.com)                     |

---

## Quick Start (Guided)

The guided script walks you through every step interactively:

```bash
# Linux/macOS
chmod +x scripts/deploy-guided.sh
./scripts/deploy-guided.sh

# Windows (PowerShell)
.\scripts\deploy-guided.ps1

# Resume from a specific step
./scripts/deploy-guided.sh --step 5
```

The script covers all 10 steps automatically, prompting for credentials and confirming before creating resources.

---

## Manual Setup

### Step 1: Hetzner Account & API Token

1. Sign up at [console.hetzner.cloud](https://console.hetzner.cloud/register)
2. Create a project called **"Skillancer"**
3. Go to **Security → API Tokens → Generate API Token**
   - Name: `skillancer-terraform`
   - Permission: **Read & Write**
4. Copy the token (you won't see it again)

### Step 2: Cloudflare Account & Domain

1. Sign up at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. **Add your domain** (e.g., `skillancer.com`)
   - Select the **Free** or **Pro** plan
   - Update nameservers at your domain registrar to Cloudflare's
   - Wait for domain to become active (usually < 5 minutes)
3. **Note your Account ID**: Dashboard sidebar → scroll down → copy "Account ID"
4. **Create API Token**: Profile → API Tokens → Create Token

   Required permissions:

   ```
   Zone : DNS           : Edit
   Zone : Zone Settings : Edit
   Zone : Firewall Services : Edit
   Account : Cloudflare Tunnel : Edit
   Account : Workers R2 Storage : Edit
   ```

   Zone Resources: Include → Specific Zone → `skillancer.com`

### Step 3: Provision Hetzner Infrastructure

```bash
cd infrastructure/hetzner/terraform

# Configure
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set your API token, domain, etc.

# Plan & apply
terraform init
terraform plan
terraform apply
```

This creates:

- 1× Control plane (CX31) with K3s server
- 3× Worker nodes (CX31) with K3s agent
- 1× PostgreSQL 16 server (CX31) + 100GB volume
- 1× Redis 7 server (CX21)
- 1× Load Balancer (LB11)
- Private network (10.0.0.0/16)
- Firewalls per role

**Wait ~5 minutes** for cloud-init to complete on all servers.

### Step 4: Provision Cloudflare

```bash
cd infrastructure/cloudflare/terraform

# Configure
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set API token, account ID, domain

# Plan & apply
terraform init
terraform plan
terraform apply
```

This creates:

- DNS records for all subdomains (proxied through Cloudflare)
- Cloudflare Tunnel (encrypted connection to origin)
- R2 buckets (uploads, assets, backups)
- WAF rules (OWASP + custom)
- Rate limiting rules
- Cache rules for static assets
- SSL/TLS Full Strict + HSTS

**Save the tunnel token:**

```bash
terraform output -raw tunnel_token > ../../.tunnel-token
```

### Step 5: Connect to K3s Cluster

```bash
# Get control plane IP
cd ../hetzner/terraform
CP_IP=$(terraform output -raw control_plane_ip)

# Copy kubeconfig
ssh root@$CP_IP "cat /etc/rancher/k3s/k3s.yaml" | \
  sed "s/127.0.0.1/$CP_IP/g" > ~/.kube/config-skillancer

export KUBECONFIG=~/.kube/config-skillancer

# Verify cluster
kubectl get nodes
# Should show 1 control-plane + 3 workers in Ready state
```

### Step 6: Install Cloudflare Tunnel

```bash
# Create namespace and secret
kubectl create namespace cloudflare

kubectl create secret generic cloudflared-token \
  -n cloudflare \
  --from-literal=token="$(cat .tunnel-token)"

# Deploy cloudflared DaemonSet
kubectl apply -f infrastructure/cloudflare/k8s/cloudflared.yaml

# Verify
kubectl get pods -n cloudflare
# Should show cloudflared running on each node
```

After this, traffic flows:

```
Users → Cloudflare Edge → Tunnel → cloudflared pods → nginx ingress → services
```

**No ports need to be open on your Hetzner servers** (except SSH for management).

### Step 7: Deploy Application

```bash
# Create namespace & secrets
kubectl create namespace skillancer

# GHCR pull secret
kubectl create secret docker-registry ghcr-secret \
  -n skillancer \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USER \
  --docker-password=YOUR_GITHUB_PAT

# App secrets (get DB/Redis passwords from Hetzner Terraform output)
cd infrastructure/hetzner/terraform
DB_URL=$(terraform output -raw database_url)
REDIS_URL=$(terraform output -raw redis_url)

kubectl create secret generic skillancer-secrets \
  -n skillancer \
  --from-literal=DATABASE_URL="$DB_URL" \
  --from-literal=REDIS_URL="$REDIS_URL" \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=SESSION_SECRET="$(openssl rand -hex 32)" \
  --from-literal=STRIPE_SECRET_KEY="sk_live_..." \
  --from-literal=S3_ENDPOINT="https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com" \
  --from-literal=S3_BUCKET="skillancer-production-uploads" \
  --from-literal=S3_FORCE_PATH_STYLE="false" \
  --from-literal=CLOUDFLARE_ACCOUNT_ID="YOUR_ACCOUNT_ID"

# Deploy all services
./scripts/deploy-hetzner.sh production all latest
```

### Step 8: Verify

```bash
# Check pods
kubectl get pods -n skillancer
kubectl get pods -n cloudflare

# Check tunnel connectivity
curl -s https://api.skillancer.com/health
# Should return {"status":"ok"}

# Check web
curl -s -o /dev/null -w "%{http_code}" https://skillancer.com
# Should return 200
```

---

## Cloudflare Features

### DNS Records Created

| Subdomain                | Target             | Purpose              |
| ------------------------ | ------------------ | -------------------- |
| `skillancer.com`         | Tunnel CNAME       | Web app              |
| `www.skillancer.com`     | → `skillancer.com` | www redirect         |
| `api.skillancer.com`     | Tunnel CNAME       | API gateway          |
| `market.skillancer.com`  | Tunnel CNAME       | Marketplace          |
| `cockpit.skillancer.com` | Tunnel CNAME       | Cockpit dashboard    |
| `pod.skillancer.com`     | Tunnel CNAME       | SkillPod             |
| `admin.skillancer.com`   | Tunnel CNAME       | Admin panel          |
| `metrics.skillancer.com` | Tunnel CNAME       | Grafana (Zero Trust) |
| `cdn.skillancer.com`     | R2 CNAME           | Static assets        |

### WAF Rules

| Rule               | Action    | Description                                     |
| ------------------ | --------- | ----------------------------------------------- |
| Cloudflare Managed | Execute   | Core WAF with SQLi, XSS, RCE protection         |
| OWASP Core Ruleset | Execute   | Industry-standard web security rules            |
| Admin geo-block    | Block     | Admin only accessible from DE/AT/CH/NL/US/GB    |
| Scanner block      | Block     | Blocks sqlmap, nikto, nmap, masscan user agents |
| Suspicious API     | Challenge | Managed challenge for high-threat POST requests |

### Rate Limits

| Endpoint              | Limit              | Timeout |
| --------------------- | ------------------ | ------- |
| `api.*` (general)     | 200 req/min per IP | 1 min   |
| `/auth/*`             | 10 req/5min per IP | 10 min  |
| `/auth/register` POST | 5/hour per IP      | 1 hour  |

### Cache Rules

| Path                                        | Edge TTL | Browser TTL |
| ------------------------------------------- | -------- | ----------- |
| Static assets (`.js`, `.css`, `.png`, etc.) | 30 days  | 1 day       |
| `/_next/static/*`                           | 1 year   | 1 year      |
| `api.*`                                     | Bypass   | Bypass      |
| `admin.*`                                   | Bypass   | Bypass      |

---

## R2 Object Storage

Cloudflare R2 is S3-compatible with **zero egress fees**.

### Buckets Created

| Bucket                          | Purpose           |
| ------------------------------- | ----------------- |
| `skillancer-production-uploads` | User file uploads |
| `skillancer-production-assets`  | Static assets     |
| `skillancer-production-backups` | Database backups  |

### Configuration

```env
S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
S3_BUCKET=skillancer-production-uploads
S3_FORCE_PATH_STYLE=false
AWS_ACCESS_KEY_ID=<R2 access key>
AWS_SECRET_ACCESS_KEY=<R2 secret key>
AWS_REGION=auto
CLOUDFLARE_ACCOUNT_ID=<your account ID>
CDN_DOMAIN=cdn.skillancer.com
```

### Create R2 API Tokens

1. Go to Cloudflare Dashboard → R2 → **Manage R2 API Tokens**
2. Create token with **Object Read & Write** permission
3. Copy Access Key ID and Secret Access Key
4. Add to your K8s secrets or Doppler

---

## CI/CD Pipeline

The GitHub Actions workflow at `.github/workflows/deploy-hetzner.yml` handles automated deployments.

### Required GitHub Secrets

| Secret                       | Description                              |
| ---------------------------- | ---------------------------------------- |
| `HETZNER_STAGING_KUBECONFIG` | Base64-encoded kubeconfig for staging    |
| `HETZNER_PROD_KUBECONFIG`    | Base64-encoded kubeconfig for production |
| `ALERT_WEBHOOK_URL`          | Alert notifications (optional)           |

### Encode kubeconfig

```bash
cat ~/.kube/config-skillancer | base64 -w 0
# Paste the output as HETZNER_PROD_KUBECONFIG secret in GitHub
```

### Pipeline Flow

```
Push to main
  ↓
Build Docker images (parallel per service)
  ↓
Push to GHCR (ghcr.io/artpromedia/<service>)
  ↓
Trivy security scan
  ↓
Deploy to staging (auto)
  ↓
Manual approval (GitHub Environment protection)
  ↓
Deploy to production (rolling update, zero downtime)
  ↓
Health check → auto-rollback on failure
```

---

## Operations

### SSH Access

```bash
cd infrastructure/hetzner/terraform
ssh root@$(terraform output -raw control_plane_ip)      # Control plane
ssh root@$(terraform output -json worker_ips | jq -r '.[0]')  # Worker 1
```

### Scaling

```bash
# Scale a service
kubectl scale deployment api-gateway --replicas=5 -n skillancer

# Add worker nodes
cd infrastructure/hetzner/terraform
# Edit terraform.tfvars: worker_count = 5
terraform apply
```

### Database Backup

```bash
ssh root@$(terraform output -raw database_ip 2>/dev/null || echo "10.0.2.10")
pg_dump -U skillancer_admin skillancer | gzip > /backups/manual-$(date +%Y%m%d).sql.gz

# Or copy to R2
aws s3 cp /backups/daily.sql.gz \
  s3://skillancer-production-backups/db/$(date +%Y%m%d).sql.gz \
  --endpoint-url https://ACCOUNT_ID.r2.cloudflarestorage.com
```

### Monitoring

- **Grafana**: `https://metrics.skillancer.com` (protected by Cloudflare Access)
- **K3s nodes**: `kubectl top nodes`
- **Pod metrics**: `kubectl top pods -n skillancer`
- **Cloudflare Analytics**: Dashboard → Analytics & Logs

---

## Cost Breakdown

| Component                | Provider        | Monthly Cost          |
| ------------------------ | --------------- | --------------------- |
| K3s Control Plane (CX31) | Hetzner         | €12.49                |
| 3× Worker Nodes (CX31)   | Hetzner         | €37.47                |
| Database Server (CX31)   | Hetzner         | €12.49                |
| Redis Server (CX21)      | Hetzner         | €5.49                 |
| Load Balancer (LB11)     | Hetzner         | €5.39                 |
| Volume 100GB             | Hetzner         | €4.80                 |
| DNS + CDN + WAF + DDoS   | Cloudflare Free | $0                    |
| Tunnel                   | Cloudflare Free | $0                    |
| R2 Storage (10GB)        | Cloudflare      | ~$0.15                |
| R2 Operations            | Cloudflare      | ~$0-1                 |
| **Total**                |                 | **~€78/mo (~$85/mo)** |

Compare with AWS: ~$800/mo → **~90% savings**.

---

## Troubleshooting

### Cloudflare Tunnel Not Connecting

```bash
# Check cloudflared pods
kubectl get pods -n cloudflare
kubectl logs -f daemonset/cloudflared -n cloudflare

# Verify tunnel is running
kubectl exec -it $(kubectl get pods -n cloudflare -o name | head -1) \
  -n cloudflare -- cloudflared tunnel info
```

### DNS Not Resolving

```bash
# Check Cloudflare nameservers are set at registrar
dig NS skillancer.com

# Verify DNS records
dig A api.skillancer.com
# Should return Cloudflare proxy IPs (104.x.x.x or 172.x.x.x)
```

### 502/504 Errors

This usually means the tunnel can't reach the origin service:

```bash
# Check if services are running
kubectl get pods -n skillancer

# Check service endpoints
kubectl get endpoints -n skillancer

# Check ingress
kubectl get ingress -n skillancer

# Check cloudflared routing
kubectl logs daemonset/cloudflared -n cloudflare | grep error
```

### R2 Access Denied

```bash
# Verify credentials
aws s3 ls --endpoint-url https://ACCOUNT_ID.r2.cloudflarestorage.com

# Check bucket exists
aws s3 ls s3://skillancer-production-uploads \
  --endpoint-url https://ACCOUNT_ID.r2.cloudflarestorage.com
```

### K3s Node Not Joining

```bash
# SSH into the problematic worker
ssh root@WORKER_IP
journalctl -u k3s-agent -f

# Common fix: restart agent
systemctl restart k3s-agent
```
