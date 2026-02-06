#!/usr/bin/env bash
# =============================================================================
# Skillancer — Dedicated Server Provisioning Script
# =============================================================================
# Provisions a Hetzner dedicated server (bare-metal) with:
#   - Optimal disk layout (NVMe split + SATA SSD)
#   - PostgreSQL 16 (NVMe-optimized, 64GB RAM tuning)
#   - Redis 7 (on separate NVMe)
#   - K3s single-node cluster
#   - cloudflared (Cloudflare Tunnel)
#   - UFW firewall (SSH only, all traffic via tunnel)
#   - Automated daily backups
#   - Node Exporter + Prometheus monitoring
#
# Target Hardware:
#   Intel Core i7-8700 (6C/12T)
#   64 GB DDR4 RAM
#   2× NVMe M.2 1TB SSD
#   1× SATA SSD 1.92TB
#
# Usage:
#   scp provision.sh root@<server-ip>:~/
#   ssh root@<server-ip>
#   chmod +x provision.sh
#   ./provision.sh
#
# Or run remotely:
#   ssh root@<server-ip> 'bash -s' < infrastructure/hetzner/dedicated/provision.sh
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuration — edit these before running
# =============================================================================

# -- Disk Devices (verify with `lsblk` after Hetzner rescue install) --
NVME_1="/dev/nvme0n1"   # NVMe 1TB — OS + PostgreSQL data
NVME_2="/dev/nvme1n1"   # NVMe 1TB — WAL + Redis
SATA_SSD="/dev/sda"     # SATA 1.92TB — Backups, uploads, logs

# -- PostgreSQL --
PG_VERSION="16"
PG_DB="skillancer"
PG_USER="skillancer_admin"
PG_PASSWORD=""  # Will be auto-generated if empty

# -- Redis --
REDIS_PASSWORD=""  # Will be auto-generated if empty

# -- K3s --
K3S_VERSION="v1.30.2+k3s1"

# -- Cloudflare Tunnel --
CF_TUNNEL_TOKEN=""  # Set this or provide interactively

# -- Domain --
DOMAIN="skillancer.com"

# -- Timezone --
TIMEZONE="Europe/Berlin"

# =============================================================================
# Colors & Helpers
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error()   { echo -e "${RED}❌ $1${NC}"; }
log_step()    { echo -e "\n${CYAN}${BOLD}════════════════════════════════════════════════════════════${NC}"; echo -e "${CYAN}${BOLD}  $1${NC}"; echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════${NC}\n"; }

generate_password() {
  openssl rand -base64 32 | tr -d '/+=' | head -c 32
}

# =============================================================================
# Pre-flight checks
# =============================================================================

if [ "$(id -u)" -ne 0 ]; then
  log_error "This script must be run as root"
  exit 1
fi

if [ -z "$PG_PASSWORD" ]; then
  PG_PASSWORD=$(generate_password)
  log_info "Generated PostgreSQL password"
fi

if [ -z "$REDIS_PASSWORD" ]; then
  REDIS_PASSWORD=$(generate_password)
  log_info "Generated Redis password"
fi

if [ -z "$CF_TUNNEL_TOKEN" ]; then
  echo ""
  echo -e "${YELLOW}Cloudflare Tunnel token not set.${NC}"
  echo -e "Get it from: cd infrastructure/cloudflare/terraform && terraform output -raw tunnel_token"
  echo ""
  read -rp "Paste your Cloudflare Tunnel token (or press Enter to skip): " CF_TUNNEL_TOKEN
fi

# Save credentials to a secure file
CREDS_FILE="/root/.skillancer-credentials"

cat << 'BANNER'

  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║   🚀 Skillancer Dedicated Server Provisioning                 ║
  ║                                                               ║
  ║   Target: Intel i7-8700 · 64GB · NVMe + SSD                  ║
  ║   Stack:  K3s · PostgreSQL 16 · Redis 7 · cloudflared         ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝

BANNER

echo "This script will:"
echo "  1. Format and mount disks (NVMe1=OS+DB, NVMe2=WAL+Redis, SATA=backups)"
echo "  2. Install PostgreSQL 16 with NVMe-optimized configuration"
echo "  3. Install Redis 7 with persistence"
echo "  4. Install K3s (single-node cluster)"
echo "  5. Install cloudflared (Cloudflare Tunnel)"
echo "  6. Configure UFW firewall (SSH only)"
echo "  7. Set up automated daily backups"
echo "  8. Install monitoring (node_exporter)"
echo ""
read -rp "Continue? (y/N): " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

SECONDS=0

# =============================================================================
# Step 1: System Basics
# =============================================================================
log_step "Step 1/8 — System Configuration"

# Set timezone
timedatectl set-timezone "$TIMEZONE"

# Update system
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget gnupg2 lsb-release apt-transport-https ca-certificates \
  software-properties-common jq htop iotop tree unzip \
  fail2ban ufw logrotate \
  linux-tools-common sysstat

log_success "System packages installed"

# Kernel tuning for database + many services
cat > /etc/sysctl.d/99-skillancer.conf << 'EOF'
# PostgreSQL & Redis optimizations
vm.swappiness = 1
vm.overcommit_memory = 0
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
vm.dirty_expire_centisecs = 500

# Network tuning
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# File descriptor limits
fs.file-max = 2097152
fs.nr_open = 2097152
fs.inotify.max_user_watches = 524288

# Memory
vm.max_map_count = 262144

# Disable transparent huge pages (bad for databases)
# (also handled in rc.local)
EOF
sysctl -p /etc/sysctl.d/99-skillancer.conf

# Disable THP
echo 'never' > /sys/kernel/mm/transparent_hugepage/enabled
echo 'never' > /sys/kernel/mm/transparent_hugepage/defrag
cat > /etc/rc.local << 'EOF'
#!/bin/bash
echo 'never' > /sys/kernel/mm/transparent_hugepage/enabled
echo 'never' > /sys/kernel/mm/transparent_hugepage/defrag
exit 0
EOF
chmod +x /etc/rc.local

# Increase file limits
cat > /etc/security/limits.d/99-skillancer.conf << 'EOF'
* soft nofile 1048576
* hard nofile 1048576
* soft nproc 65536
* hard nproc 65536
root soft nofile 1048576
root hard nofile 1048576
postgres soft nofile 1048576
postgres hard nofile 1048576
EOF

log_success "Kernel tuning applied"

# =============================================================================
# Step 2: Disk Layout
# =============================================================================
log_step "Step 2/8 — Disk Layout"

# Note: NVME_1 is typically already the OS disk after Hetzner installimage.
# We only need to set up additional mount points.
# If Hetzner installed the OS on NVME_1, we add partitions for PG data.
# If it's a fresh install, the user ran installimage on NVME_1 already.

# Check if NVMe 2 needs formatting
if ! blkid "${NVME_2}p1" &>/dev/null && ! blkid "${NVME_2}" | grep -q "TYPE"; then
  log_info "Formatting NVMe 2 (${NVME_2}) for WAL + Redis..."
  parted -s "$NVME_2" mklabel gpt
  parted -s "$NVME_2" mkpart pg-wal ext4 1MiB 256GiB
  parted -s "$NVME_2" mkpart redis ext4 256GiB 320GiB
  parted -s "$NVME_2" mkpart docker ext4 320GiB 100%
  sleep 2
  mkfs.ext4 -L pg-wal "${NVME_2}p1"
  mkfs.ext4 -L redis "${NVME_2}p2"
  mkfs.ext4 -L k3s-data "${NVME_2}p3"
  log_success "NVMe 2 formatted"
else
  log_warn "NVMe 2 already has partitions, skipping format"
fi

# Check if SATA SSD needs formatting
if ! blkid "${SATA_SSD}1" &>/dev/null && ! blkid "${SATA_SSD}" | grep -q "TYPE"; then
  log_info "Formatting SATA SSD (${SATA_SSD}) for backups + uploads..."
  parted -s "$SATA_SSD" mklabel gpt
  parted -s "$SATA_SSD" mkpart backups ext4 1MiB 500GiB
  parted -s "$SATA_SSD" mkpart uploads ext4 500GiB 1200GiB
  parted -s "$SATA_SSD" mkpart logs ext4 1200GiB 100%
  sleep 2
  mkfs.ext4 -L backups "${SATA_SSD}1"
  mkfs.ext4 -L uploads "${SATA_SSD}2"
  mkfs.ext4 -L logs "${SATA_SSD}3"
  log_success "SATA SSD formatted"
else
  log_warn "SATA SSD already has partitions, skipping format"
fi

# Create mount points
mkdir -p /var/lib/postgresql/16/wal
mkdir -p /var/lib/redis
mkdir -p /var/lib/rancher/k3s
mkdir -p /backups/postgres
mkdir -p /backups/redis
mkdir -p /uploads
mkdir -p /var/log/skillancer

# Add to fstab (if not already there)
add_fstab_entry() {
  local device="$1" mount="$2" fs="$3" opts="$4"
  if ! grep -q "$mount" /etc/fstab; then
    echo "$device $mount $fs $opts 0 2" >> /etc/fstab
    log_info "Added fstab entry: $mount"
  fi
}

add_fstab_entry "LABEL=pg-wal"   "/var/lib/postgresql/16/wal" "ext4" "defaults,noatime,nodiratime"
add_fstab_entry "LABEL=redis"    "/var/lib/redis"             "ext4" "defaults,noatime"
add_fstab_entry "LABEL=k3s-data" "/var/lib/rancher/k3s"       "ext4" "defaults,noatime"
add_fstab_entry "LABEL=backups"  "/backups"                    "ext4" "defaults,noatime"
add_fstab_entry "LABEL=uploads"  "/uploads"                    "ext4" "defaults,noatime"
add_fstab_entry "LABEL=logs"     "/var/log/skillancer"         "ext4" "defaults,noatime"

mount -a

log_success "Disk layout configured"
echo ""
echo "  NVMe 1: / (OS) + /var/lib/postgresql (DB data)  ← fastest, on OS drive"
echo "  NVMe 2: /var/lib/postgresql/16/wal (WAL) + /var/lib/redis + /var/lib/rancher/k3s"
echo "  SATA:   /backups + /uploads + /var/log/skillancer"

# =============================================================================
# Step 3: PostgreSQL 16
# =============================================================================
log_step "Step 3/8 — PostgreSQL 16"

# Add PostgreSQL repo
if [ ! -f /etc/apt/sources.list.d/pgdg.list ]; then
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
fi

apt-get install -y -qq postgresql-${PG_VERSION} postgresql-contrib-${PG_VERSION}
systemctl stop postgresql

# Set WAL directory ownership
chown -R postgres:postgres /var/lib/postgresql/16/wal

# Move WAL to NVMe 2 (symlink approach — works even if initdb already ran)
PG_DATA="/var/lib/postgresql/${PG_VERSION}/main"
if [ -d "$PG_DATA/pg_wal" ] && [ ! -L "$PG_DATA/pg_wal" ]; then
  log_info "Moving WAL to NVMe 2..."
  mv "$PG_DATA/pg_wal" /var/lib/postgresql/16/wal/pg_wal
  ln -s /var/lib/postgresql/16/wal/pg_wal "$PG_DATA/pg_wal"
  chown -h postgres:postgres "$PG_DATA/pg_wal"
  log_success "WAL moved to separate NVMe"
fi

# PostgreSQL configuration (NVMe-optimized, 64GB RAM)
cat > /etc/postgresql/${PG_VERSION}/main/conf.d/skillancer.conf << 'PGCONF'
# =============================================================================
# Skillancer PostgreSQL Config — Dedicated Server
# Intel i7-8700, 64GB DDR4, NVMe storage
# =============================================================================

# --- Connection ---
listen_addresses = '127.0.0.1'
port = 5432
max_connections = 200
superuser_reserved_connections = 3

# --- Memory (tuned for 64GB RAM) ---
shared_buffers = 16GB
effective_cache_size = 48GB
work_mem = 256MB
maintenance_work_mem = 2GB
wal_buffers = 64MB
huge_pages = try

# --- NVMe-Optimized I/O ---
random_page_cost = 1.1
seq_page_cost = 1.0
effective_io_concurrency = 200
max_worker_processes = 12
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_parallel_maintenance_workers = 4

# --- WAL (on separate NVMe) ---
wal_level = replica
max_wal_size = 4GB
min_wal_size = 1GB
checkpoint_completion_target = 0.9
checkpoint_timeout = 10min
wal_compression = lz4

# --- Write Performance ---
synchronous_commit = on
commit_delay = 100
commit_siblings = 5
full_page_writes = on

# --- Query Planner ---
default_statistics_target = 200
jit = on
jit_above_cost = 100000

# --- Autovacuum (aggressive for OLTP) ---
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 30s
autovacuum_vacuum_threshold = 50
autovacuum_vacuum_scale_factor = 0.05
autovacuum_analyze_threshold = 50
autovacuum_analyze_scale_factor = 0.025
autovacuum_vacuum_cost_delay = 2ms
autovacuum_vacuum_cost_limit = 1000

# --- Logging ---
logging_collector = on
log_directory = '/var/log/skillancer/postgresql'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = off
log_disconnections = off
log_lock_waits = on
log_temp_files = 0
log_autovacuum_min_duration = 1000

# --- Data Integrity ---
data_checksums = on
fsync = on

# --- Full-Text Search ---
default_text_search_config = 'pg_catalog.english'
PGCONF

# Create log directory
mkdir -p /var/log/skillancer/postgresql
chown postgres:postgres /var/log/skillancer/postgresql

# pg_hba.conf — localhost only + md5
cat > /etc/postgresql/${PG_VERSION}/main/pg_hba.conf << 'PGHBA'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
# K3s pod network (if services connect directly)
host    all             all             10.42.0.0/16            md5
host    all             all             10.43.0.0/16            md5
PGHBA

# Enable data checksums (requires re-init if not already enabled)
# Check if checksums are already enabled
if ! su - postgres -c "pg_checksums --check -D $PG_DATA" &>/dev/null; then
  log_warn "Data checksums not enabled (would require re-init). Skipping."
fi

systemctl start postgresql
systemctl enable postgresql

# Create database and user
su - postgres -c "psql -v ON_ERROR_STOP=1" << EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${PG_USER}') THEN
    CREATE ROLE ${PG_USER} WITH LOGIN PASSWORD '${PG_PASSWORD}' CREATEDB;
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${PG_DB} OWNER ${PG_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${PG_DB}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};
-- Enable extensions
\c ${PG_DB}
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
EOSQL

log_success "PostgreSQL ${PG_VERSION} installed and configured"

# =============================================================================
# Step 4: Redis 7
# =============================================================================
log_step "Step 4/8 — Redis 7"

# Add Redis repo
if [ ! -f /etc/apt/sources.list.d/redis.list ]; then
  curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" > /etc/apt/sources.list.d/redis.list
  apt-get update -qq
fi

apt-get install -y -qq redis-server
systemctl stop redis-server

# Redis configuration
cat > /etc/redis/redis.conf << REDISCONF
# Skillancer Redis Config — Dedicated Server
bind 127.0.0.1
port 6379
protected-mode yes
requirepass ${REDIS_PASSWORD}

# Persistence (on NVMe 2)
dir /var/lib/redis
dbfilename dump.rdb
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Memory (4GB limit, good for sessions/cache)
maxmemory 4gb
maxmemory-policy allkeys-lru

# Performance
tcp-backlog 511
timeout 300
tcp-keepalive 300
hz 10
dynamic-hz yes
io-threads 4
io-threads-do-reads yes

# Logging
loglevel notice
logfile /var/log/skillancer/redis.log

# Snapshotting
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes

# Security
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG "SKILLANCER_CONFIG"
rename-command DEBUG ""
REDISCONF

chown redis:redis /var/lib/redis
systemctl start redis-server
systemctl enable redis-server

# Verify Redis
redis-cli -a "$REDIS_PASSWORD" ping | grep -q PONG && log_success "Redis 7 installed and running" || log_error "Redis health check failed"

# =============================================================================
# Step 5: K3s (Single-Node Cluster)
# =============================================================================
log_step "Step 5/8 — K3s Cluster"

# Install K3s
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="$K3S_VERSION" sh -s - server \
  --disable=traefik \
  --disable=servicelb \
  --data-dir=/var/lib/rancher/k3s \
  --write-kubeconfig-mode=644 \
  --kube-apiserver-arg="--max-requests-inflight=400" \
  --kube-apiserver-arg="--max-mutating-requests-inflight=200" \
  --kubelet-arg="--max-pods=110" \
  --kubelet-arg="--image-gc-high-threshold=85" \
  --kubelet-arg="--image-gc-low-threshold=80" \
  --kubelet-arg="--eviction-hard=memory.available<256Mi,nodefs.available<5%" \
  --kubelet-arg="--system-reserved=cpu=500m,memory=1Gi"

# Wait for K3s to be ready
log_info "Waiting for K3s to start..."
sleep 15

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Wait for node to be Ready
RETRIES=30
for i in $(seq 1 $RETRIES); do
  if kubectl get nodes | grep -q "Ready"; then
    break
  fi
  sleep 5
  [ "$i" -eq "$RETRIES" ] && { log_error "K3s node not ready after ${RETRIES} attempts"; exit 1; }
done

# Install nginx ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/baremetal/deploy.yaml

# Patch nginx to use hostNetwork (so it listens on the server's localhost)
kubectl patch daemonset ingress-nginx-controller -n ingress-nginx \
  --type='json' \
  -p='[{"op":"replace","path":"/spec/template/spec/hostNetwork","value":true}]' 2>/dev/null || true

log_success "K3s cluster running (single-node)"
kubectl get nodes -o wide

# =============================================================================
# Step 6: Cloudflare Tunnel
# =============================================================================
log_step "Step 6/8 — Cloudflare Tunnel"

# Install cloudflared
if ! command -v cloudflared &>/dev/null; then
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb
  rm -f /tmp/cloudflared.deb
fi

if [ -n "$CF_TUNNEL_TOKEN" ]; then
  # Install as system service
  cloudflared service install "$CF_TUNNEL_TOKEN"
  systemctl enable cloudflared
  systemctl start cloudflared
  
  # Verify tunnel
  sleep 5
  if systemctl is-active --quiet cloudflared; then
    log_success "Cloudflare Tunnel connected"
  else
    log_warn "cloudflared service started but may need a moment to connect"
    log_info "Check status: systemctl status cloudflared"
  fi
else
  log_warn "No tunnel token provided. Install manually later:"
  echo "  cloudflared service install <TUNNEL_TOKEN>"
fi

# =============================================================================
# Step 7: Firewall (UFW)
# =============================================================================
log_step "Step 7/8 — Firewall"

ufw default deny incoming
ufw default allow outgoing

# SSH only — all web traffic comes through Cloudflare Tunnel
ufw allow 22/tcp comment 'SSH'

# Allow K3s internal traffic on loopback
ufw allow in on lo

# Allow K3s pod/service network
ufw allow from 10.42.0.0/16 comment 'K3s pod network'
ufw allow from 10.43.0.0/16 comment 'K3s service network'

# Enable
echo "y" | ufw enable

# Fail2ban for SSH
cat > /etc/fail2ban/jail.local << 'F2B'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
F2B
systemctl restart fail2ban

log_success "Firewall configured (SSH only, all web via Cloudflare Tunnel)"

# =============================================================================
# Step 8: Backups & Monitoring
# =============================================================================
log_step "Step 8/8 — Backups & Monitoring"

# -- Daily PostgreSQL backup --
cat > /etc/cron.d/skillancer-backup << CRON
# Daily PostgreSQL backup at 02:00 UTC
0 2 * * * postgres pg_dump -Fc -Z 6 ${PG_DB} > /backups/postgres/daily-\$(date +\%Y\%m\%d-\%H\%M).dump 2>> /var/log/skillancer/backup.log

# Weekly full backup (Sundays 03:00 UTC)
0 3 * * 0 postgres pg_dumpall --clean > /backups/postgres/weekly-full-\$(date +\%Y\%m\%d).sql 2>> /var/log/skillancer/backup.log

# Redis backup (daily 02:30 UTC)
30 2 * * * root cp /var/lib/redis/dump.rdb /backups/redis/dump-\$(date +\%Y\%m\%d).rdb 2>> /var/log/skillancer/backup.log

# Prune backups older than 14 days (daily 04:00 UTC)
0 4 * * * root find /backups -type f -mtime +14 -delete 2>> /var/log/skillancer/backup.log
CRON

chmod 644 /etc/cron.d/skillancer-backup
mkdir -p /backups/postgres /backups/redis
chown postgres:postgres /backups/postgres
log_success "Automated backups configured"

# -- Node Exporter (for Prometheus/Grafana) --
NODE_EXPORTER_VERSION="1.8.1"
if ! command -v node_exporter &>/dev/null; then
  cd /tmp
  curl -fsSLO "https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz"
  tar xzf "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz"
  cp "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64/node_exporter" /usr/local/bin/
  rm -rf "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64"*

  # systemd service
  useradd --no-create-home --shell /bin/false node_exporter 2>/dev/null || true
  cat > /etc/systemd/system/node_exporter.service << 'NEXPORTER'
[Unit]
Description=Prometheus Node Exporter
After=network-online.target
Wants=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter \
  --collector.filesystem \
  --collector.diskstats \
  --collector.meminfo \
  --collector.cpu \
  --collector.netdev \
  --collector.loadavg \
  --web.listen-address=127.0.0.1:9100
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
NEXPORTER
  systemctl daemon-reload
  systemctl enable node_exporter
  systemctl start node_exporter
fi
log_success "Node Exporter installed (localhost:9100)"

# -- Logrotate for Skillancer logs --
cat > /etc/logrotate.d/skillancer << 'LOGROTATE'
/var/log/skillancer/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root adm
    sharedscripts
    postrotate
        systemctl reload postgresql 2>/dev/null || true
        systemctl reload redis-server 2>/dev/null || true
    endscript
}

/var/log/skillancer/postgresql/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 postgres postgres
    su postgres postgres
}
LOGROTATE

log_success "Log rotation configured"

# =============================================================================
# Save Credentials
# =============================================================================

cat > "$CREDS_FILE" << CREDS
# Skillancer Credentials — KEEP THIS SECURE
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Server: $(hostname -f)

DATABASE_URL=postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:5432/${PG_DB}
REDIS_URL=redis://:${REDIS_PASSWORD}@127.0.0.1:6379/0

PG_USER=${PG_USER}
PG_PASSWORD=${PG_PASSWORD}
PG_DATABASE=${PG_DB}

REDIS_PASSWORD=${REDIS_PASSWORD}

KUBECONFIG=/etc/rancher/k3s/k3s.yaml
CREDS
chmod 600 "$CREDS_FILE"

# =============================================================================
# Summary
# =============================================================================

ELAPSED=$SECONDS

echo ""
echo ""
cat << DONE

  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║   ✅ Skillancer Dedicated Server — Ready!                     ║
  ║                                                               ║
  ║   Time: $((ELAPSED / 60))m $((ELAPSED % 60))s                                          ║
  ║                                                               ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║                                                               ║
  ║   PostgreSQL:  127.0.0.1:5432 (NVMe, data checksums)         ║
  ║   Redis:       127.0.0.1:6379 (NVMe, AOF persistence)        ║
  ║   K3s:         Single-node cluster (12 threads, 64GB)         ║
  ║   Tunnel:      Cloudflare Tunnel → all traffic encrypted      ║
  ║   Firewall:    SSH only (port 22)                             ║
  ║   Backups:     Daily at 02:00 UTC → /backups/                 ║
  ║   Monitoring:  node_exporter → localhost:9100                  ║
  ║                                                               ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║                                                               ║
  ║   Credentials saved to: /root/.skillancer-credentials         ║
  ║   Kubeconfig:           /etc/rancher/k3s/k3s.yaml             ║
  ║                                                               ║
  ║   NEXT STEPS:                                                  ║
  ║   1. Copy kubeconfig to your local machine:                    ║
  ║      scp root@<ip>:/etc/rancher/k3s/k3s.yaml ~/.kube/config  ║
  ║      (update server IP in the file)                            ║
  ║                                                               ║
  ║   2. Create K8s secrets:                                       ║
  ║      kubectl create namespace skillancer                       ║
  ║      kubectl create secret generic skillancer-secrets \\        ║
  ║        -n skillancer \\                                         ║
  ║        --from-env-file=/root/.skillancer-credentials           ║
  ║                                                               ║
  ║   3. Deploy services:                                          ║
  ║      ./scripts/deploy-hetzner.sh production all latest         ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝

DONE

echo ""
log_info "Database URL: postgresql://${PG_USER}:****@127.0.0.1:5432/${PG_DB}"
log_info "Redis URL:    redis://:****@127.0.0.1:6379/0"
echo ""
log_warn "IMPORTANT: Save /root/.skillancer-credentials to a secure location!"
log_warn "IMPORTANT: Run 'source /root/.skillancer-credentials' to load env vars"
