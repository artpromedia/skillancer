#!/usr/bin/env bash
# =============================================================================
# Skillancer — Guided Deployment (Hetzner + Cloudflare)
# =============================================================================
# Interactive script that walks you through the entire deployment process.
#
# Usage:
#   ./scripts/deploy-guided.sh
#   ./scripts/deploy-guided.sh --step 3   # Resume from step 3
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# State file for resuming
STATE_FILE="$ROOT_DIR/.deploy-state.json"
TOTAL_STEPS=10

# =============================================================================
# Helper Functions
# =============================================================================

banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}  ${BOLD}Skillancer — Guided Deployment${NC}                              ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}  ${DIM}Hetzner Cloud + Cloudflare${NC}                                   ${CYAN}║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

step_header() {
  local num="$1"
  local title="$2"
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  ${BOLD}Step $num/$TOTAL_STEPS: $title${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

log_info()    { echo -e "  ${BLUE}ℹ${NC}  $1"; }
log_success() { echo -e "  ${GREEN}✅${NC} $1"; }
log_warn()    { echo -e "  ${YELLOW}⚠${NC}  $1"; }
log_error()   { echo -e "  ${RED}❌${NC} $1"; }
log_cmd()     { echo -e "  ${DIM}\$ $1${NC}"; }

confirm() {
  local msg="${1:-Continue?}"
  echo ""
  read -p "  $(echo -e "${YELLOW}?${NC}") $msg [Y/n] " -n 1 -r
  echo ""
  [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]
}

prompt() {
  local msg="$1"
  local var_name="$2"
  local default="${3:-}"
  local prompt_text="  $(echo -e "${YELLOW}?${NC}") $msg"
  if [ -n "$default" ]; then
    prompt_text="$prompt_text [$default]"
  fi
  read -p "$prompt_text: " value
  value="${value:-$default}"
  eval "$var_name='$value'"
}

prompt_secret() {
  local msg="$1"
  local var_name="$2"
  read -s -p "  $(echo -e "${YELLOW}?${NC}") $msg: " value
  echo ""
  eval "$var_name='$value'"
}

check_tool() {
  local tool="$1"
  local install_hint="$2"
  if command -v "$tool" &>/dev/null; then
    log_success "$tool $(command -v "$tool")"
    return 0
  else
    log_error "$tool not found"
    log_info "Install: $install_hint"
    return 1
  fi
}

wait_for_enter() {
  echo ""
  read -p "  $(echo -e "${DIM}Press Enter to continue...${NC}")" -r
}

# =============================================================================
# Step 1: Prerequisites Check
# =============================================================================

step_1_prerequisites() {
  step_header 1 "Prerequisites Check"

  log_info "Checking required tools..."
  echo ""

  local missing=0

  check_tool "terraform" "https://terraform.io/downloads" || missing=$((missing + 1))
  check_tool "kubectl"   "brew install kubectl / choco install kubernetes-cli" || missing=$((missing + 1))
  check_tool "jq"        "brew install jq / choco install jq" || missing=$((missing + 1))
  check_tool "ssh"       "Should be pre-installed" || missing=$((missing + 1))
  check_tool "git"       "brew install git / choco install git" || missing=$((missing + 1))

  echo ""

  if [ "$missing" -gt 0 ]; then
    log_error "$missing required tools missing. Install them and re-run."
    exit 1
  fi

  log_success "All prerequisites met!"
}

# =============================================================================
# Step 2: Account Setup
# =============================================================================

step_2_accounts() {
  step_header 2 "Account Setup"

  echo -e "  You need accounts for:"
  echo -e "    ${BOLD}1.${NC} Hetzner Cloud — ${DIM}https://console.hetzner.cloud${NC}"
  echo -e "    ${BOLD}2.${NC} Cloudflare    — ${DIM}https://dash.cloudflare.com${NC}"
  echo -e "    ${BOLD}3.${NC} GitHub        — ${DIM}https://github.com (for GHCR container registry)${NC}"
  echo ""

  log_info "${BOLD}Hetzner Cloud:${NC}"
  echo -e "    → Sign up at ${CYAN}https://console.hetzner.cloud/register${NC}"
  echo -e "    → Create a project called 'Skillancer'"
  echo -e "    → Go to Security → API Tokens → Generate API Token (Read & Write)"
  echo ""

  log_info "${BOLD}Cloudflare:${NC}"
  echo -e "    → Sign up at ${CYAN}https://dash.cloudflare.com/sign-up${NC}"
  echo -e "    → Add your domain (${BOLD}skillancer.com${NC})"
  echo -e "    → Update nameservers at your registrar to Cloudflare's"
  echo -e "    → Create API Token: Profile → API Tokens → Create Token"
  echo -e "    → Permissions needed:"
  echo -e "      • Zone: DNS: Edit"
  echo -e "      • Zone: Zone Settings: Edit"
  echo -e "      • Zone: Firewall Services: Edit"
  echo -e "      • Account: Cloudflare Tunnel: Edit"
  echo -e "      • Account: R2 Storage: Edit"
  echo ""

  log_info "${BOLD}Also note your Cloudflare Account ID:${NC}"
  echo -e "    → Dashboard sidebar → scroll down → 'Account ID'"
  echo ""

  if confirm "Do you have all accounts and tokens ready?"; then
    log_success "Accounts ready"
  else
    log_warn "Set up your accounts and re-run with: $0 --step 2"
    exit 0
  fi
}

# =============================================================================
# Step 3: SSH Key
# =============================================================================

step_3_ssh_key() {
  step_header 3 "SSH Key Setup"

  local ssh_key="$HOME/.ssh/id_ed25519"

  if [ -f "$ssh_key.pub" ]; then
    log_success "SSH key found: $ssh_key.pub"
    echo -e "    ${DIM}$(cat "$ssh_key.pub" | head -c 80)...${NC}"
  else
    log_info "No ED25519 key found. Generating one..."
    ssh-keygen -t ed25519 -C "skillancer-deploy" -f "$ssh_key" -N ""
    log_success "SSH key generated: $ssh_key"
  fi

  echo ""
  log_info "This key will be used for SSH access to your Hetzner servers."
}

# =============================================================================
# Step 4: Configure Hetzner Terraform
# =============================================================================

step_4_hetzner_terraform() {
  step_header 4 "Configure Hetzner Infrastructure"

  local tf_dir="$ROOT_DIR/infrastructure/hetzner/terraform"
  local tfvars="$tf_dir/terraform.tfvars"

  if [ -f "$tfvars" ]; then
    log_warn "terraform.tfvars already exists"
    if ! confirm "Overwrite?"; then
      log_info "Keeping existing configuration"
      return
    fi
  fi

  prompt_secret "Hetzner Cloud API Token" HCLOUD_TOKEN
  prompt "Domain" DOMAIN "skillancer.com"
  prompt "Environment (production/staging)" ENVIRONMENT "production"
  prompt "Datacenter location (fsn1/nbg1/hel1/ash)" LOCATION "fsn1"
  prompt "Worker node count" WORKER_COUNT "3"

  cat > "$tfvars" <<EOF
# Auto-generated by deploy-guided.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)

hcloud_token        = "$HCLOUD_TOKEN"
domain              = "$DOMAIN"
environment         = "$ENVIRONMENT"
location            = "$LOCATION"
worker_count        = $WORKER_COUNT

ssh_public_key_path = "~/.ssh/id_ed25519.pub"
control_plane_type  = "cx31"
worker_type         = "cx31"
db_server_type      = "cx31"
redis_server_type   = "cx21"
enable_self_hosted_db = true
EOF

  log_success "Hetzner terraform.tfvars written"
  echo ""

  # Initialize Terraform
  log_info "Initializing Terraform..."
  cd "$tf_dir"
  terraform init -input=false

  log_success "Terraform initialized"
}

# =============================================================================
# Step 5: Configure Cloudflare Terraform
# =============================================================================

step_5_cloudflare_terraform() {
  step_header 5 "Configure Cloudflare"

  local tf_dir="$ROOT_DIR/infrastructure/cloudflare/terraform"
  local tfvars="$tf_dir/terraform.tfvars"

  if [ -f "$tfvars" ]; then
    log_warn "terraform.tfvars already exists"
    if ! confirm "Overwrite?"; then
      log_info "Keeping existing configuration"
      return
    fi
  fi

  prompt_secret "Cloudflare API Token" CF_API_TOKEN
  prompt "Cloudflare Account ID" CF_ACCOUNT_ID
  prompt "Domain" CF_DOMAIN "skillancer.com"
  prompt "Enable Cloudflare Tunnel? (true/false)" CF_TUNNEL "true"
  prompt "Enable R2 Storage? (true/false)" CF_R2 "true"
  prompt "Enable WAF? (true/false)" CF_WAF "true"
  prompt "Notification email" CF_EMAIL "devops@skillancer.com"

  cat > "$tfvars" <<EOF
# Auto-generated by deploy-guided.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)

cloudflare_api_token  = "$CF_API_TOKEN"
cloudflare_account_id = "$CF_ACCOUNT_ID"
domain                = "$CF_DOMAIN"
environment           = "production"

enable_tunnel = $CF_TUNNEL
enable_r2     = $CF_R2
enable_waf    = $CF_WAF

notification_email = "$CF_EMAIL"
EOF

  log_success "Cloudflare terraform.tfvars written"
  echo ""

  log_info "Initializing Terraform..."
  cd "$tf_dir"
  terraform init -input=false

  log_success "Terraform initialized"
}

# =============================================================================
# Step 6: Provision Hetzner Infrastructure
# =============================================================================

step_6_provision_hetzner() {
  step_header 6 "Provision Hetzner Servers"

  local tf_dir="$ROOT_DIR/infrastructure/hetzner/terraform"
  cd "$tf_dir"

  log_info "Planning infrastructure..."
  echo ""
  terraform plan -out=tfplan

  echo ""
  log_warn "This will create servers on Hetzner Cloud (billable resources!)."
  echo ""
  echo -e "  ${BOLD}Estimated monthly cost:${NC}"
  echo -e "    Control plane (CX31):  €12.49"
  echo -e "    Workers (3× CX31):     €37.47"
  echo -e "    Database (CX31):       €12.49"
  echo -e "    Redis (CX21):          €5.49"
  echo -e "    Load Balancer (LB11):  €5.39"
  echo -e "    Volume (100GB):        €4.80"
  echo -e "    ${BOLD}Total:                  ~€78/mo${NC}"
  echo ""

  if confirm "Apply Hetzner infrastructure?"; then
    terraform apply tfplan
    rm -f tfplan

    echo ""
    log_success "Hetzner infrastructure provisioned!"
    echo ""

    echo -e "  ${BOLD}Server IPs:${NC}"
    echo -e "    Control Plane: $(terraform output -raw control_plane_ip)"
    echo -e "    Workers:       $(terraform output -json worker_ips | jq -r 'join(", ")')"
    echo -e "    Load Balancer: $(terraform output -raw load_balancer_ip)"
    echo ""

    log_info "Servers are booting and running cloud-init (takes ~3-5 minutes)."
    log_info "K3s cluster will auto-form once all nodes are ready."
  else
    log_warn "Skipped. Run manually: cd $tf_dir && terraform apply"
  fi
}

# =============================================================================
# Step 7: Provision Cloudflare
# =============================================================================

step_7_provision_cloudflare() {
  step_header 7 "Provision Cloudflare (DNS + Tunnel + R2 + WAF)"

  local tf_dir="$ROOT_DIR/infrastructure/cloudflare/terraform"
  cd "$tf_dir"

  # If Hetzner LB IP is needed and tunnel is off
  local hetzner_tf_dir="$ROOT_DIR/infrastructure/hetzner/terraform"
  if [ -d "$hetzner_tf_dir/.terraform" ]; then
    local lb_ip
    lb_ip=$(cd "$hetzner_tf_dir" && terraform output -raw load_balancer_ip 2>/dev/null || echo "")
    if [ -n "$lb_ip" ]; then
      log_info "Detected Hetzner LB IP: $lb_ip"
    fi
  fi

  log_info "Planning Cloudflare resources..."
  echo ""
  terraform plan -out=tfplan

  echo ""
  log_info "This will configure:"
  echo -e "    • DNS records for all subdomains"
  echo -e "    • Cloudflare Tunnel (Zero Trust)"
  echo -e "    • R2 storage buckets (uploads, assets, backups)"
  echo -e "    • WAF managed + custom rules"
  echo -e "    • Rate limiting rules"
  echo -e "    • Cache rules for static assets"
  echo -e "    • SSL/TLS (Full Strict + HSTS)"
  echo ""

  if confirm "Apply Cloudflare configuration?"; then
    terraform apply tfplan
    rm -f tfplan

    echo ""
    log_success "Cloudflare configured!"
    echo ""

    # Save tunnel token
    local tunnel_token
    tunnel_token=$(terraform output -raw tunnel_token 2>/dev/null || echo "")
    if [ -n "$tunnel_token" ] && [ "$tunnel_token" != "N/A" ]; then
      echo "$tunnel_token" > "$ROOT_DIR/.tunnel-token"
      chmod 600 "$ROOT_DIR/.tunnel-token"
      log_success "Tunnel token saved to .tunnel-token"
    fi

    echo -e "  ${BOLD}Cloudflare Outputs:${NC}"
    echo -e "    Zone ID:    $(terraform output -raw zone_id)"
    echo -e "    Tunnel ID:  $(terraform output -raw tunnel_id 2>/dev/null || echo "N/A")"
    echo -e "    R2 Endpoint: $(terraform output -raw r2_endpoint 2>/dev/null || echo "N/A")"
  else
    log_warn "Skipped. Run manually: cd $tf_dir && terraform apply"
  fi
}

# =============================================================================
# Step 8: Connect Cluster + Install Tunnel
# =============================================================================

step_8_connect_cluster() {
  step_header 8 "Connect to K3s Cluster & Install Cloudflare Tunnel"

  local hetzner_tf_dir="$ROOT_DIR/infrastructure/hetzner/terraform"
  local cp_ip

  if [ -d "$hetzner_tf_dir/.terraform" ]; then
    cp_ip=$(cd "$hetzner_tf_dir" && terraform output -raw control_plane_ip 2>/dev/null || echo "")
  fi

  if [ -z "$cp_ip" ]; then
    prompt "Control plane public IP" cp_ip
  fi

  log_info "Waiting for K3s to be ready on $cp_ip..."
  echo ""

  local retries=0
  while [ $retries -lt 20 ]; do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 "root@$cp_ip" "kubectl get nodes" &>/dev/null; then
      log_success "K3s cluster is ready!"
      break
    fi
    retries=$((retries + 1))
    echo -e "  ${DIM}Waiting... ($retries/20)${NC}"
    sleep 15
  done

  if [ $retries -ge 20 ]; then
    log_error "Timed out waiting for K3s. SSH in manually:"
    log_cmd "ssh root@$cp_ip"
    log_cmd "journalctl -u k3s -f"
    return
  fi

  # Copy kubeconfig
  log_info "Copying kubeconfig..."
  mkdir -p "$HOME/.kube"
  ssh -o StrictHostKeyChecking=no "root@$cp_ip" "cat /etc/rancher/k3s/k3s.yaml" | \
    sed "s/127.0.0.1/$cp_ip/g" > "$HOME/.kube/config-skillancer"
  chmod 600 "$HOME/.kube/config-skillancer"
  export KUBECONFIG="$HOME/.kube/config-skillancer"

  echo ""
  log_success "Kubeconfig saved: ~/.kube/config-skillancer"
  echo ""
  log_info "Cluster nodes:"
  kubectl get nodes -o wide
  echo ""

  # Install Cloudflare Tunnel
  local tunnel_token_file="$ROOT_DIR/.tunnel-token"
  if [ -f "$tunnel_token_file" ]; then
    log_info "Installing Cloudflare Tunnel in K3s..."
    echo ""

    kubectl create namespace cloudflare --dry-run=client -o yaml | kubectl apply -f -
    kubectl create secret generic cloudflared-token \
      -n cloudflare \
      --from-literal=token="$(cat "$tunnel_token_file")" \
      --dry-run=client -o yaml | kubectl apply -f -

    kubectl apply -f "$ROOT_DIR/infrastructure/cloudflare/k8s/cloudflared.yaml"

    echo ""
    log_info "Waiting for cloudflared pods..."
    sleep 10
    kubectl get pods -n cloudflare
    echo ""
    log_success "Cloudflare Tunnel installed!"
  else
    log_warn "No tunnel token found. Install manually:"
    log_cmd "kubectl apply -f infrastructure/cloudflare/k8s/cloudflared.yaml"
  fi
}

# =============================================================================
# Step 9: Deploy Application
# =============================================================================

step_9_deploy() {
  step_header 9 "Deploy Skillancer Services"

  export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config-skillancer}"

  if ! kubectl cluster-info &>/dev/null; then
    log_error "Cannot connect to cluster. Set KUBECONFIG first."
    return
  fi

  # Create namespace
  kubectl create namespace skillancer --dry-run=client -o yaml | kubectl apply -f -

  # Create GHCR pull secret
  log_info "Setting up container registry access..."
  prompt "GitHub username (for GHCR)" GH_USER
  prompt_secret "GitHub PAT (with packages:read)" GH_TOKEN

  kubectl create secret docker-registry ghcr-secret \
    -n skillancer \
    --docker-server=ghcr.io \
    --docker-username="$GH_USER" \
    --docker-password="$GH_TOKEN" \
    --dry-run=client -o yaml | kubectl apply -f -

  echo ""

  # Create app secrets
  log_info "Setting up application secrets..."

  local hetzner_tf_dir="$ROOT_DIR/infrastructure/hetzner/terraform"
  local db_url redis_url

  if [ -d "$hetzner_tf_dir/.terraform" ]; then
    db_url=$(cd "$hetzner_tf_dir" && terraform output -raw database_url 2>/dev/null || echo "")
    redis_url=$(cd "$hetzner_tf_dir" && terraform output -raw redis_url 2>/dev/null || echo "")
  fi

  if [ -z "$db_url" ]; then
    prompt "DATABASE_URL" db_url "postgresql://skillancer:password@10.0.2.10:5432/skillancer"
  fi
  if [ -z "$redis_url" ]; then
    prompt "REDIS_URL" redis_url "redis://:password@10.0.2.20:6379"
  fi

  prompt_secret "JWT_SECRET (min 32 chars)" JWT_SECRET
  prompt_secret "SESSION_SECRET (min 32 chars)" SESSION_SECRET
  prompt "STRIPE_SECRET_KEY" STRIPE_KEY "sk_test_..."

  # R2 env vars
  local cf_tf_dir="$ROOT_DIR/infrastructure/cloudflare/terraform"
  local r2_endpoint=""
  if [ -d "$cf_tf_dir/.terraform" ]; then
    r2_endpoint=$(cd "$cf_tf_dir" && terraform output -raw r2_endpoint 2>/dev/null || echo "")
  fi

  kubectl create secret generic skillancer-secrets \
    -n skillancer \
    --from-literal=DATABASE_URL="$db_url" \
    --from-literal=REDIS_URL="$redis_url" \
    --from-literal=JWT_SECRET="$JWT_SECRET" \
    --from-literal=SESSION_SECRET="$SESSION_SECRET" \
    --from-literal=STRIPE_SECRET_KEY="$STRIPE_KEY" \
    --from-literal=S3_ENDPOINT="${r2_endpoint:-}" \
    --from-literal=S3_BUCKET="skillancer-production-uploads" \
    --dry-run=client -o yaml | kubectl apply -f -

  kubectl create secret generic db-credentials \
    -n skillancer \
    --from-literal=password="$(echo "$db_url" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')" \
    --dry-run=client -o yaml | kubectl apply -f -

  echo ""
  log_success "Secrets configured"
  echo ""

  # Deploy services
  prompt "Version to deploy" DEPLOY_VERSION "latest"

  log_info "Deploying all services..."
  echo ""
  "$ROOT_DIR/scripts/deploy-hetzner.sh" production all "$DEPLOY_VERSION"
}

# =============================================================================
# Step 10: Verify & Celebrate
# =============================================================================

step_10_verify() {
  step_header 10 "Verify Deployment"

  export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config-skillancer}"

  echo -e "  ${BOLD}Cluster Status:${NC}"
  kubectl get nodes 2>/dev/null || log_warn "Cannot reach cluster"
  echo ""

  echo -e "  ${BOLD}Pod Status:${NC}"
  kubectl get pods -n skillancer 2>/dev/null || true
  echo ""

  echo -e "  ${BOLD}Cloudflare Tunnel:${NC}"
  kubectl get pods -n cloudflare 2>/dev/null || true
  echo ""

  echo -e "  ${BOLD}Services:${NC}"
  kubectl get svc -n skillancer 2>/dev/null || true
  echo ""

  # Domain check
  local domain="skillancer.com"
  log_info "Checking domain resolution..."
  if command -v dig &>/dev/null; then
    dig +short "$domain" 2>/dev/null || true
    dig +short "api.$domain" 2>/dev/null || true
  elif command -v nslookup &>/dev/null; then
    nslookup "$domain" 2>/dev/null | tail -3 || true
  fi

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║${NC}                                                              ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}  ${BOLD}🎉 Deployment Complete!${NC}                                    ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}                                                              ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}  Your Skillancer instance is now running on:                 ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}                                                              ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}    🌐 Web:     https://skillancer.com                        ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}    🔌 API:     https://api.skillancer.com                    ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}    🏪 Market:  https://market.skillancer.com                 ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}    🎛️  Cockpit: https://cockpit.skillancer.com                ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}    🎓 SkillPod: https://pod.skillancer.com                   ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}    📊 Metrics: https://metrics.skillancer.com                ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}                                                              ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}  Infrastructure:                                             ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}    ☁️  Hetzner K3s + Cloudflare CDN/WAF/Tunnel                ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}    🗄️  PostgreSQL 16 + Redis 7 (private network)              ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}    📦 Cloudflare R2 (S3-compatible object storage)            ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}    🔒 Full-Strict TLS + OWASP WAF + Rate Limiting            ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}                                                              ${GREEN}║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  echo -e "  ${BOLD}Useful commands:${NC}"
  echo -e "    ${DIM}export KUBECONFIG=~/.kube/config-skillancer${NC}"
  echo -e "    ${DIM}kubectl get pods -n skillancer${NC}"
  echo -e "    ${DIM}kubectl logs -f deployment/api-gateway -n skillancer${NC}"
  echo -e "    ${DIM}./scripts/deploy-hetzner.sh production api-gateway v1.0.1${NC}"
  echo ""

  # Cleanup
  rm -f "$ROOT_DIR/.tunnel-token"
}

# =============================================================================
# Main
# =============================================================================

main() {
  banner

  local start_step=1

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --step) start_step="$2"; shift 2 ;;
      -h|--help)
        echo "Usage: $0 [--step N]"
        echo "  --step N   Resume from step N (1-$TOTAL_STEPS)"
        exit 0
        ;;
      *) shift ;;
    esac
  done

  log_info "Starting from step $start_step"
  echo ""

  local steps=(
    step_1_prerequisites
    step_2_accounts
    step_3_ssh_key
    step_4_hetzner_terraform
    step_5_cloudflare_terraform
    step_6_provision_hetzner
    step_7_provision_cloudflare
    step_8_connect_cluster
    step_9_deploy
    step_10_verify
  )

  for i in $(seq $start_step $TOTAL_STEPS); do
    ${steps[$((i - 1))]}

    if [ "$i" -lt "$TOTAL_STEPS" ]; then
      if ! confirm "Continue to next step?"; then
        log_info "Paused at step $i. Resume with: $0 --step $((i + 1))"
        exit 0
      fi
    fi
  done
}

main "$@"
