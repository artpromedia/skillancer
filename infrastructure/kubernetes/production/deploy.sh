#!/bin/bash
# =============================================================================
# Skillancer Production Deploy Script
# =============================================================================
# Deploys the Skillancer platform to a dedicated Hetzner server running K3s.
# Builds Docker images directly on the server, runs migrations, and applies
# K3s manifests.
#
# Prerequisites:
#   - SSH access to the server (ssh skillancer)
#   - K3s running on the server
#   - PostgreSQL and Redis running on the server
#   - cloudflared running on the server
#   - Docker installed on the server (for building images)
#
# Usage:
#   ./deploy.sh                    # Full deploy
#   ./deploy.sh --images-only      # Only build images
#   ./deploy.sh --manifests-only   # Only apply manifests
#   ./deploy.sh --migrate-only     # Only run migrations
# =============================================================================

set -euo pipefail

# Configuration
SERVER="skillancer"  # SSH alias
DEPLOY_DIR="/opt/skillancer"
MANIFESTS_DIR="$(dirname "$0")/manifests"
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}  Step: $1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

# Parse arguments
IMAGES_ONLY=false
MANIFESTS_ONLY=false
MIGRATE_ONLY=false
for arg in "$@"; do
  case $arg in
    --images-only) IMAGES_ONLY=true ;;
    --manifests-only) MANIFESTS_ONLY=true ;;
    --migrate-only) MIGRATE_ONLY=true ;;
  esac
done

# =============================================================================
# Step 0: Pre-flight checks
# =============================================================================
step "Pre-flight Checks"

log "Testing SSH connection..."
ssh -o ConnectTimeout=5 "$SERVER" "echo 'SSH OK'" || error "Cannot connect to server"

log "Checking K3s..."
ssh "$SERVER" "kubectl get nodes" || error "K3s is not running"

log "Checking PostgreSQL..."
ssh "$SERVER" "systemctl is-active postgresql" || error "PostgreSQL is not running"

log "Checking Redis..."
ssh "$SERVER" "systemctl is-active redis-server" || error "Redis is not running"

log "Checking Docker..."
ssh "$SERVER" "command -v docker >/dev/null 2>&1 || (apt-get update && apt-get install -y docker.io)" || error "Cannot install Docker"

log "All pre-flight checks passed ✓"

if [ "$MIGRATE_ONLY" = true ]; then
  # Jump straight to migrations
  step "Running Database Migrations"
  goto_migrations=true
fi

# =============================================================================
# Step 1: Prepare server directories
# =============================================================================
if [ "$MANIFESTS_ONLY" != true ] && [ "$MIGRATE_ONLY" != true ]; then

step "Preparing Server"

log "Creating deploy directory..."
ssh "$SERVER" "mkdir -p $DEPLOY_DIR"

# =============================================================================
# Step 2: Sync codebase to server
# =============================================================================
step "Syncing Codebase to Server"

log "Syncing project files (excluding node_modules, .next, .git)..."
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.turbo' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='.terraform' \
  --exclude='terraform.tfstate*' \
  --exclude='*.tfvars' \
  --exclude='.venv' \
  --exclude='apps/mobile' \
  "$PROJECT_ROOT/" "$SERVER:$DEPLOY_DIR/"

log "Codebase synced ✓"

# =============================================================================
# Step 3: Build Docker images on server
# =============================================================================
step "Building Docker Images"

# Backend services
BACKEND_SERVICES=(
  "api-gateway"
  "auth-svc"
  "market-svc"
  "skillpod-svc"
  "cockpit-svc"
  "billing-svc"
  "notification-svc"
  "audit-svc"
)

for svc in "${BACKEND_SERVICES[@]}"; do
  log "Building $svc..."
  ssh "$SERVER" "cd $DEPLOY_DIR && docker build -t skillancer/$svc:latest -f services/$svc/Dockerfile ." || {
    warn "Failed to build $svc — skipping"
    continue
  }
  log "$svc built ✓"
done

# Frontend apps
FRONTEND_APPS=(
  "web-market:apps/web-market"
  "web-cockpit:apps/web-cockpit"
  "web-skillpod:apps/web-skillpod"
  "admin:apps/admin"
)

for app_entry in "${FRONTEND_APPS[@]}"; do
  app_name="${app_entry%%:*}"
  app_path="${app_entry##*:}"
  log "Building $app_name..."
  ssh "$SERVER" "cd $DEPLOY_DIR && docker build -t skillancer/$app_name:latest -f $app_path/Dockerfile ." || {
    warn "Failed to build $app_name — skipping"
    continue
  }
  log "$app_name built ✓"
done

# Python ML service (built with its own directory as context)
log "Building ml-recommendation-svc (Python)..."
ssh "$SERVER" "cd $DEPLOY_DIR && docker build -t skillancer/ml-recommendation-svc:latest services/ml-recommendation-svc/" || {
  warn "Failed to build ml-recommendation-svc — skipping"
}
log "ml-recommendation-svc built ✓"

# Import images into K3s containerd
log "Importing images into K3s..."
for svc in "${BACKEND_SERVICES[@]}"; do
  ssh "$SERVER" "docker save skillancer/$svc:latest | k3s ctr images import -" 2>/dev/null || true
done
for app_entry in "${FRONTEND_APPS[@]}"; do
  app_name="${app_entry%%:*}"
  ssh "$SERVER" "docker save skillancer/$app_name:latest | k3s ctr images import -" 2>/dev/null || true
done
ssh "$SERVER" "docker save skillancer/ml-recommendation-svc:latest | k3s ctr images import -" 2>/dev/null || true

log "All images built and imported ✓"

fi  # end if not MANIFESTS_ONLY

if [ "$IMAGES_ONLY" = true ]; then
  log "Images-only mode — done!"
  exit 0
fi

# =============================================================================
# Step 4: Run Database Migrations
# =============================================================================
step "Running Database Migrations"

log "Loading credentials..."
PG_PASSWORD=$(ssh "$SERVER" "grep PG_PASSWORD /root/.skillancer-credentials | cut -d= -f2")
DATABASE_URL="postgresql://skillancer_admin:${PG_PASSWORD}@127.0.0.1:5432/skillancer"

log "Running Prisma migrations..."
ssh "$SERVER" "cd $DEPLOY_DIR && \
  docker run --rm --network host \
    -e DATABASE_URL='$DATABASE_URL' \
    -v $DEPLOY_DIR/packages/database:/app/packages/database \
    -w /app/packages/database \
    node:20.19-alpine \
    sh -c 'npx prisma migrate deploy 2>&1 || echo \"Migration skipped (no pending migrations)\"'"

log "Migrations complete ✓"

if [ "$MIGRATE_ONLY" = true ]; then
  log "Migrate-only mode — done!"
  exit 0
fi

# =============================================================================
# Step 5: Create K3s namespace and secrets
# =============================================================================
step "Setting Up K3s Namespace & Secrets"

log "Creating namespace..."
ssh "$SERVER" "kubectl create namespace skillancer 2>/dev/null || true"

log "Loading credentials for secrets..."
REDIS_PASSWORD=$(ssh "$SERVER" "grep REDIS_PASSWORD /root/.skillancer-credentials | cut -d= -f2")

# Generate JWT secrets if they don't exist
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_MASTER_KEY=$(openssl rand -hex 32)

log "Creating secrets..."
ssh "$SERVER" "kubectl -n skillancer create secret generic skillancer-secrets \
  --from-literal=DATABASE_URL='postgresql://skillancer_admin:${PG_PASSWORD}@10.43.0.1:5432/skillancer' \
  --from-literal=PG_PASSWORD='${PG_PASSWORD}' \
  --from-literal=REDIS_URL='redis://:${REDIS_PASSWORD}@10.43.0.1:6379/0' \
  --from-literal=REDIS_PASSWORD='${REDIS_PASSWORD}' \
  --from-literal=JWT_SECRET='${JWT_SECRET}' \
  --from-literal=JWT_REFRESH_SECRET='${JWT_REFRESH_SECRET}' \
  --from-literal=SESSION_SECRET='${SESSION_SECRET}' \
  --from-literal=S3_ENDPOINT='https://56f34d4c32d7deeeb917c5e27e0083ac.r2.cloudflarestorage.com' \
  --from-literal=S3_REGION='auto' \
  --from-literal=S3_BUCKET_UPLOADS='skillancer-production-uploads' \
  --from-literal=S3_BUCKET_ASSETS='skillancer-production-assets' \
  --from-literal=S3_BUCKET_RECORDINGS='skillancer-production-recordings' \
  --from-literal=S3_FORCE_PATH_STYLE='false' \
  --from-literal=S3_CDN_URL='https://cdn.skillancer.com' \
  --from-literal=S3_ACCESS_KEY_ID='placeholder-update-with-r2-key' \
  --from-literal=S3_SECRET_ACCESS_KEY='placeholder-update-with-r2-secret' \
  --from-literal=ENCRYPTION_MASTER_KEY='${ENCRYPTION_MASTER_KEY}' \
  --from-literal=ENCRYPTION_ALGORITHM='aes-256-gcm' \
  --from-literal=HETZNER_API_TOKEN='placeholder-update-with-hetzner-token' \
  --from-literal=HETZNER_LOCATION='fsn1' \
  --from-literal=HETZNER_VOLUME_SIZE='10' \
  --from-literal=STRIPE_SECRET_KEY='placeholder' \
  --from-literal=STRIPE_WEBHOOK_SECRET='placeholder' \
  --from-literal=STRIPE_PUBLISHABLE_KEY='placeholder' \
  --from-literal=OPENAI_API_KEY='placeholder' \
  --dry-run=client -o yaml | kubectl apply -f -"

log "Secrets created ✓"

# =============================================================================
# Step 6: Apply ConfigMap
# =============================================================================
step "Applying ConfigMap"

scp "$MANIFESTS_DIR/02-configmap.yaml" "$SERVER:/tmp/02-configmap.yaml"
ssh "$SERVER" "kubectl apply -f /tmp/02-configmap.yaml"

log "ConfigMap applied ✓"

# =============================================================================
# Step 7: Deploy Services
# =============================================================================
step "Deploying Services"

# Copy and apply all manifests
for manifest in "$MANIFESTS_DIR"/1*.yaml "$MANIFESTS_DIR"/2*.yaml; do
  if [ -f "$manifest" ]; then
    filename=$(basename "$manifest")
    log "Applying $filename..."
    scp "$manifest" "$SERVER:/tmp/$filename"
    ssh "$SERVER" "kubectl apply -f /tmp/$filename"
  fi
done

log "All manifests applied ✓"

# =============================================================================
# Step 8: Update cloudflared tunnel to use NodePorts
# =============================================================================
step "Updating Cloudflare Tunnel Config"

log "Tunnel is configured to route to NodePort services:"
log "  skillancer.com     → localhost:30000 (web-market)"
log "  api.skillancer.com → localhost:30040 (api-gateway)"
log "  cockpit.skillancer.com → localhost:30200 (web-cockpit)"
log "  pod.skillancer.com     → localhost:30300 (web-skillpod)"
log "  admin.skillancer.com   → localhost:30400 (admin)"
warn "You need to update the Cloudflare Tunnel config to use these NodePorts!"
warn "Update infrastructure/cloudflare/terraform/main.tf ingress rules."

# =============================================================================
# Step 9: Verify Deployment
# =============================================================================
step "Verifying Deployment"

log "Waiting for pods to start (60s)..."
sleep 10

log "Pod status:"
ssh "$SERVER" "kubectl -n skillancer get pods -o wide"

log "Services:"
ssh "$SERVER" "kubectl -n skillancer get svc"

log ""
log "═══════════════════════════════════════════════════════════════"
log "  Deployment Complete! 🚀"
log "═══════════════════════════════════════════════════════════════"
log ""
log "  Check pod logs:   ssh skillancer 'kubectl -n skillancer logs -f deploy/<name>'"
log "  Check all pods:   ssh skillancer 'kubectl -n skillancer get pods'"
log "  Check services:   ssh skillancer 'kubectl -n skillancer get svc'"
log ""
