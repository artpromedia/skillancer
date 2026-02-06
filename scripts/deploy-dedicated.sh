#!/usr/bin/env bash
# =============================================================================
# Skillancer — Dedicated Server Deployment Script
# =============================================================================
# Deploys Skillancer services to a single-node K3s cluster on a dedicated
# Hetzner server. Wraps deploy-hetzner.sh with dedicated-server specific
# setup (localhost DB/Redis, single-node secrets, health checks).
#
# Usage:
#   ./scripts/deploy-dedicated.sh setup        # First-time K8s namespace + secrets
#   ./scripts/deploy-dedicated.sh deploy        # Deploy all services (latest)
#   ./scripts/deploy-dedicated.sh deploy v1.2.0 # Deploy specific version
#   ./scripts/deploy-dedicated.sh status        # Check all services
#   ./scripts/deploy-dedicated.sh logs <svc>    # Tail logs for a service
#   ./scripts/deploy-dedicated.sh backup        # Trigger immediate backup
#   ./scripts/deploy-dedicated.sh health        # Full system health check
# =============================================================================

set -euo pipefail

# Colors
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
log_step()    { echo -e "${CYAN}${BOLD}── $1${NC}"; }

KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
NAMESPACE="skillancer"
CREDS_FILE="/root/.skillancer-credentials"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export KUBECONFIG

# =============================================================================
# Commands
# =============================================================================

cmd_setup() {
  echo ""
  log_step "Setting up Kubernetes namespace and secrets"
  echo ""

  # Create namespace
  kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
  log_success "Namespace '$NAMESPACE' created"

  # Load credentials
  if [ ! -f "$CREDS_FILE" ]; then
    log_error "Credentials file not found: $CREDS_FILE"
    log_info "Run provision.sh first, or create the file manually."
    exit 1
  fi

  source "$CREDS_FILE"

  # GHCR pull secret
  echo ""
  log_step "Container registry access"
  if kubectl get secret ghcr-secret -n "$NAMESPACE" &>/dev/null; then
    log_info "GHCR secret already exists"
  else
    read -rp "GitHub username: " GH_USER
    read -rsp "GitHub PAT (with packages:read): " GH_PAT
    echo ""
    kubectl create secret docker-registry ghcr-secret \
      -n "$NAMESPACE" \
      --docker-server=ghcr.io \
      --docker-username="$GH_USER" \
      --docker-password="$GH_PAT"
    log_success "GHCR pull secret created"
  fi

  # App secrets
  echo ""
  log_step "Application secrets"

  JWT_SECRET=$(openssl rand -hex 32)
  SESSION_SECRET=$(openssl rand -hex 32)

  # Prompt for optional external secrets
  read -rp "Stripe Secret Key (or press Enter to skip): " STRIPE_SK
  read -rp "Cloudflare Account ID (for R2): " CF_ACCOUNT_ID
  read -rp "R2 Access Key ID: " S3_ACCESS_KEY
  read -rsp "R2 Secret Access Key: " S3_SECRET_KEY
  echo ""

  kubectl create secret generic skillancer-secrets \
    -n "$NAMESPACE" \
    --from-literal=DATABASE_URL="${DATABASE_URL}" \
    --from-literal=REDIS_URL="${REDIS_URL}" \
    --from-literal=PG_PASSWORD="${PG_PASSWORD}" \
    --from-literal=REDIS_PASSWORD="${REDIS_PASSWORD}" \
    --from-literal=JWT_SECRET="${JWT_SECRET}" \
    --from-literal=SESSION_SECRET="${SESSION_SECRET}" \
    --from-literal=STRIPE_SECRET_KEY="${STRIPE_SK:-sk_test_placeholder}" \
    --from-literal=S3_ENDPOINT="https://${CF_ACCOUNT_ID:-placeholder}.r2.cloudflarestorage.com" \
    --from-literal=S3_BUCKET="skillancer-production-uploads" \
    --from-literal=S3_FORCE_PATH_STYLE="false" \
    --from-literal=S3_ACCESS_KEY="${S3_ACCESS_KEY:-placeholder}" \
    --from-literal=S3_SECRET_KEY="${S3_SECRET_KEY:-placeholder}" \
    --from-literal=CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID:-placeholder}" \
    --from-literal=CDN_DOMAIN="cdn.skillancer.com" \
    --from-literal=NODE_ENV="production" \
    --dry-run=client -o yaml | kubectl apply -f -

  log_success "Application secrets created/updated"

  echo ""
  log_success "Setup complete! Run: ./scripts/deploy-dedicated.sh deploy"
}

cmd_deploy() {
  local version="${1:-latest}"

  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "  ╔═════════════════════════════════════════════════╗"
  echo "  ║  Deploying Skillancer — Dedicated Server        ║"
  echo "  ║  Version: ${version}                            "
  echo "  ╚═════════════════════════════════════════════════╝"
  echo -e "${NC}"

  # Pre-flight: check DB and Redis
  log_step "Pre-flight checks"

  if pg_isready -h 127.0.0.1 -p 5432 &>/dev/null; then
    log_success "PostgreSQL: ready"
  else
    log_error "PostgreSQL not running on 127.0.0.1:5432"
    exit 1
  fi

  if redis-cli -a "$(grep REDIS_PASSWORD $CREDS_FILE 2>/dev/null | cut -d= -f2)" ping 2>/dev/null | grep -q PONG; then
    log_success "Redis: ready"
  else
    log_warn "Redis check failed (may need password)"
  fi

  if systemctl is-active --quiet cloudflared 2>/dev/null; then
    log_success "Cloudflare Tunnel: connected"
  else
    log_warn "cloudflared not running (web traffic won't reach server)"
  fi

  # Run Prisma migrations
  echo ""
  log_step "Database migrations"
  if [ -f "$PROJECT_ROOT/packages/database/package.json" ]; then
    cd "$PROJECT_ROOT"
    if command -v pnpm &>/dev/null; then
      pnpm --filter database db:migrate:deploy 2>/dev/null && log_success "Migrations applied" || log_warn "Migration step skipped"
    else
      log_warn "pnpm not found, skipping migrations"
    fi
  fi

  # Deploy via existing script
  echo ""
  log_step "Deploying services"
  "$SCRIPT_DIR/deploy-hetzner.sh" production all "$version"

  # Post-deploy health check
  echo ""
  cmd_health
}

cmd_status() {
  echo ""
  log_step "Cluster Status"
  kubectl get nodes -o wide
  echo ""

  log_step "Pods ($NAMESPACE)"
  kubectl get pods -n "$NAMESPACE" -o wide
  echo ""

  log_step "Services"
  kubectl get svc -n "$NAMESPACE"
  echo ""

  log_step "HPA (Autoscaling)"
  kubectl get hpa -n "$NAMESPACE" 2>/dev/null || echo "  No HPA configured"
  echo ""

  log_step "System Resources"
  echo "  CPU/Memory:"
  kubectl top nodes 2>/dev/null || echo "  (metrics-server not available)"
  echo ""
  echo "  Pod Resources:"
  kubectl top pods -n "$NAMESPACE" 2>/dev/null || echo "  (metrics-server not available)"
}

cmd_logs() {
  local service="${1:-}"
  if [ -z "$service" ]; then
    log_error "Usage: deploy-dedicated.sh logs <service-name>"
    echo "  Available: api-gateway, auth-svc, market-svc, skillpod-svc, cockpit-svc, billing-svc, notification-svc, audit-svc"
    exit 1
  fi
  kubectl logs -f "deployment/$service" -n "$NAMESPACE" --tail=100
}

cmd_backup() {
  log_step "Triggering immediate backup"

  local timestamp
  timestamp=$(date +%Y%m%d-%H%M%S)

  # PostgreSQL
  log_info "Backing up PostgreSQL..."
  su - postgres -c "pg_dump -Fc -Z 6 skillancer > /backups/postgres/manual-${timestamp}.dump"
  local pg_size
  pg_size=$(du -sh "/backups/postgres/manual-${timestamp}.dump" | cut -f1)
  log_success "PostgreSQL backup: /backups/postgres/manual-${timestamp}.dump ($pg_size)"

  # Redis
  log_info "Backing up Redis..."
  redis-cli -a "$(grep REDIS_PASSWORD $CREDS_FILE | cut -d= -f2)" BGSAVE 2>/dev/null
  sleep 2
  cp /var/lib/redis/dump.rdb "/backups/redis/manual-${timestamp}.rdb"
  log_success "Redis backup: /backups/redis/manual-${timestamp}.rdb"

  echo ""
  log_info "To upload to R2:"
  echo "  aws s3 cp /backups/postgres/manual-${timestamp}.dump s3://skillancer-production-backups/db/ --endpoint-url https://<account_id>.r2.cloudflarestorage.com"
}

cmd_health() {
  log_step "System Health Check"
  echo ""

  local issues=0

  # Node
  echo -e "  ${BOLD}Node:${NC}"
  local cpu_usage mem_total mem_used
  cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}')
  mem_total=$(free -g | awk '/^Mem:/{print $2}')
  mem_used=$(free -g | awk '/^Mem:/{print $3}')
  echo "    CPU: ${cpu_usage}% used"
  echo "    RAM: ${mem_used}G / ${mem_total}G"
  echo "    Load: $(cat /proc/loadavg | awk '{print $1, $2, $3}')"
  echo ""

  # Disks
  echo -e "  ${BOLD}Storage:${NC}"
  df -h / /var/lib/postgresql /var/lib/redis /backups 2>/dev/null | awk 'NR>1{printf "    %-30s %s used of %s (%s)\n", $6, $3, $2, $5}'
  echo ""

  # PostgreSQL
  echo -e "  ${BOLD}PostgreSQL:${NC}"
  if pg_isready -h 127.0.0.1 &>/dev/null; then
    local pg_conns pg_size
    pg_conns=$(su - postgres -c "psql -t -c 'SELECT count(*) FROM pg_stat_activity;'" 2>/dev/null | tr -d ' ')
    pg_size=$(su - postgres -c "psql -t -c \"SELECT pg_size_pretty(pg_database_size('skillancer'));\"" 2>/dev/null | tr -d ' ')
    echo -e "    Status: ${GREEN}running${NC}"
    echo "    Connections: ${pg_conns:-?}/200"
    echo "    Database size: ${pg_size:-?}"
  else
    echo -e "    Status: ${RED}DOWN${NC}"
    issues=$((issues + 1))
  fi
  echo ""

  # Redis
  echo -e "  ${BOLD}Redis:${NC}"
  local redis_info
  redis_info=$(redis-cli -a "$(grep REDIS_PASSWORD $CREDS_FILE 2>/dev/null | cut -d= -f2)" INFO 2>/dev/null)
  if [ -n "$redis_info" ]; then
    local redis_mem redis_keys
    redis_mem=$(echo "$redis_info" | grep "used_memory_human:" | cut -d: -f2 | tr -d '[:space:]')
    redis_keys=$(echo "$redis_info" | grep "^db0:" | grep -oP 'keys=\K[0-9]+')
    echo -e "    Status: ${GREEN}running${NC}"
    echo "    Memory: ${redis_mem:-?} / 4GB"
    echo "    Keys: ${redis_keys:-0}"
  else
    echo -e "    Status: ${RED}DOWN${NC}"
    issues=$((issues + 1))
  fi
  echo ""

  # K3s pods
  echo -e "  ${BOLD}Services:${NC}"
  local total_pods ready_pods
  total_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
  ready_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -c "Running" || true)
  echo "    Pods: ${ready_pods}/${total_pods} running"

  kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | while read -r line; do
    local name status
    name=$(echo "$line" | awk '{print $1}')
    status=$(echo "$line" | awk '{print $3}')
    if [ "$status" == "Running" ]; then
      echo -e "      ${GREEN}●${NC} $name"
    else
      echo -e "      ${RED}●${NC} $name ($status)"
      issues=$((issues + 1))
    fi
  done
  echo ""

  # Cloudflare Tunnel
  echo -e "  ${BOLD}Cloudflare Tunnel:${NC}"
  if systemctl is-active --quiet cloudflared 2>/dev/null; then
    echo -e "    Status: ${GREEN}connected${NC}"
  else
    echo -e "    Status: ${RED}disconnected${NC}"
    issues=$((issues + 1))
  fi
  echo ""

  # Backups
  echo -e "  ${BOLD}Backups:${NC}"
  local latest_pg latest_redis
  latest_pg=$(ls -t /backups/postgres/ 2>/dev/null | head -1)
  latest_redis=$(ls -t /backups/redis/ 2>/dev/null | head -1)
  echo "    Latest PG: ${latest_pg:-none}"
  echo "    Latest Redis: ${latest_redis:-none}"
  echo ""

  if [ "$issues" -gt 0 ]; then
    log_warn "$issues issue(s) detected"
    return 1
  else
    log_success "All systems healthy"
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  local command="${1:-}"
  shift || true

  case "$command" in
    setup)   cmd_setup ;;
    deploy)  cmd_deploy "$@" ;;
    status)  cmd_status ;;
    logs)    cmd_logs "$@" ;;
    backup)  cmd_backup ;;
    health)  cmd_health ;;
    *)
      echo ""
      echo "Usage: $(basename "$0") <command> [args]"
      echo ""
      echo "Commands:"
      echo "  setup             First-time setup (namespace, secrets, GHCR)"
      echo "  deploy [version]  Deploy all services (default: latest)"
      echo "  status            Show cluster and pod status"
      echo "  logs <service>    Tail logs for a service"
      echo "  backup            Trigger immediate backup"
      echo "  health            Full system health check"
      echo ""
      exit 1
      ;;
  esac
}

main "$@"
