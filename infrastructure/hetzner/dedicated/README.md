# Skillancer — Hetzner Dedicated Server

Single bare-metal server deployment for Skillancer.

## Target Hardware

| Component | Spec                                     |
| --------- | ---------------------------------------- |
| CPU       | Intel Core i7-8700 (6C/12T, 3.2–4.6 GHz) |
| RAM       | 64 GB DDR4                               |
| NVMe 1    | 1 TB M.2 NVMe — OS + PostgreSQL data     |
| NVMe 2    | 1 TB M.2 NVMe — WAL + Redis + K3s data   |
| SATA SSD  | 1.92 TB — Backups, uploads, logs         |
| Network   | 1 Gbit                                   |
| Location  | Germany, FSN1                            |

## Quick Start

```bash
# 1. Copy provisioning script to the server
scp infrastructure/hetzner/dedicated/provision.sh root@<server-ip>:~/

# 2. SSH in and run it
ssh root@<server-ip>
chmod +x provision.sh
./provision.sh

# 3. Copy kubeconfig to your local machine
scp root@<server-ip>:/etc/rancher/k3s/k3s.yaml ~/.kube/config-dedicated
# Edit the file: change 127.0.0.1 to your server's public IP

# 4. Set up K8s secrets (run on server)
./scripts/deploy-dedicated.sh setup

# 5. Deploy all services
./scripts/deploy-dedicated.sh deploy
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Hetzner Dedicated Server (FSN1)                │
│  i7-8700 · 64GB · NVMe × 2 + SATA SSD          │
│                                                  │
│  ┌── NVMe 1 (1TB) ──────────────────────────┐   │
│  │  / (OS)                                   │   │
│  │  /var/lib/postgresql/16/main (DB data)    │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ┌── NVMe 2 (1TB) ──────────────────────────┐   │
│  │  /var/lib/postgresql/16/wal (WAL)         │   │
│  │  /var/lib/redis (Redis data)              │   │
│  │  /var/lib/rancher/k3s (containers)        │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ┌── SATA SSD (1.92TB) ─────────────────────┐   │
│  │  /backups (PG + Redis backups)            │   │
│  │  /uploads (file upload cache)             │   │
│  │  /var/log/skillancer (application logs)   │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ┌── Services ───────────────────────────────┐   │
│  │  K3s (single-node)                        │   │
│  │  ├── cloudflared → Cloudflare Tunnel      │   │
│  │  ├── nginx-ingress                        │   │
│  │  ├── api-gateway (:4000)                  │   │
│  │  ├── auth-svc (:3001)                     │   │
│  │  ├── market-svc (:3002)                   │   │
│  │  ├── skillpod-svc (:3003)                 │   │
│  │  ├── cockpit-svc (:3004)                  │   │
│  │  ├── billing-svc (:3005)                  │   │
│  │  ├── notification-svc (:4006)             │   │
│  │  └── audit-svc (:3012)                    │   │
│  │                                           │   │
│  │  PostgreSQL 16 (:5432) ← localhost        │   │
│  │  Redis 7 (:6379) ← localhost              │   │
│  │  node_exporter (:9100) ← localhost        │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  UFW: SSH only (port 22)                         │
│  All web traffic via Cloudflare Tunnel           │
└─────────────────────────────────────────────────┘
```

## Files

| File                                                         | Purpose                                      |
| ------------------------------------------------------------ | -------------------------------------------- |
| `infrastructure/hetzner/dedicated/provision.sh`              | Server provisioning (8-step automated setup) |
| `infrastructure/kubernetes/production/values-dedicated.yaml` | Helm values for single-node K3s              |
| `scripts/deploy-dedicated.sh`                                | Deployment + operations CLI                  |

## Operations

```bash
# Deploy all services
./scripts/deploy-dedicated.sh deploy

# Deploy specific version
./scripts/deploy-dedicated.sh deploy v1.2.0

# Check status
./scripts/deploy-dedicated.sh status

# Full health check
./scripts/deploy-dedicated.sh health

# View logs
./scripts/deploy-dedicated.sh logs api-gateway

# Manual backup
./scripts/deploy-dedicated.sh backup
```

## Backups

| Schedule             | What               | Where                                 |
| -------------------- | ------------------ | ------------------------------------- |
| Daily 02:00 UTC      | PG compressed dump | `/backups/postgres/daily-*.dump`      |
| Weekly Sun 03:00 UTC | PG full dump       | `/backups/postgres/weekly-full-*.sql` |
| Daily 02:30 UTC      | Redis RDB snapshot | `/backups/redis/dump-*.rdb`           |
| Daily 04:00 UTC      | Prune > 14 days    | automatic                             |

### Upload backups to R2

```bash
aws s3 cp /backups/postgres/daily-20260206.dump \
  s3://skillancer-production-backups/db/ \
  --endpoint-url https://<account_id>.r2.cloudflarestorage.com
```

## PostgreSQL Tuning

The provisioning script installs an NVMe-optimized config at `/etc/postgresql/16/main/conf.d/skillancer.conf`:

| Setting                    | Value  | Why                                   |
| -------------------------- | ------ | ------------------------------------- |
| `shared_buffers`           | 16 GB  | 25% of RAM                            |
| `effective_cache_size`     | 48 GB  | 75% of RAM (includes OS page cache)   |
| `work_mem`                 | 256 MB | Complex queries (joins, sorts)        |
| `random_page_cost`         | 1.1    | NVMe has near-zero random I/O penalty |
| `effective_io_concurrency` | 200    | NVMe handles massive parallelism      |
| `max_parallel_workers`     | 8      | Use available cores                   |
| `wal_compression`          | lz4    | Reduce WAL write volume               |
| `jit`                      | on     | JIT compilation for complex queries   |

## Security

- **Firewall**: UFW — only SSH (port 22) is open
- **Web traffic**: All routed through Cloudflare Tunnel (no exposed HTTP/HTTPS ports)
- **Fail2ban**: Blocks IPs after 5 failed SSH attempts (1-hour ban)
- **PostgreSQL**: Listens on localhost only, md5 auth
- **Redis**: Password-protected, dangerous commands renamed/disabled
- **THP**: Disabled (transparent huge pages hurt database performance)

## Cost

| Item                        | Monthly        |
| --------------------------- | -------------- |
| Hetzner Dedicated (auction) | ~€35–45        |
| Cloudflare (Free plan)      | $0             |
| Cloudflare R2 (10GB)        | ~$0.15         |
| **Total**                   | **~€36–46/mo** |
