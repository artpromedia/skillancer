#!/usr/bin/env bash
# =============================================================================
# Hetzner K3s Deployment Script
# =============================================================================
# Deploys services to K3s cluster running on Hetzner Cloud.
#
# Usage:
#   ./scripts/deploy-hetzner.sh <environment> <service> <version>
#   ./scripts/deploy-hetzner.sh production api-gateway v1.0.0
#   ./scripts/deploy-hetzner.sh production all v1.0.0
#
# Environment Variables:
#   KUBECONFIG       - Path to kubeconfig (default: ~/.kube/config)
#   IMAGE_REGISTRY   - Container registry (default: ghcr.io/artpromedia)
#   DRY_RUN          - Set to "true" for dry run mode
#   ROLLBACK_ON_FAIL - Set to "true" to auto-rollback on failure (default: true)
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io/artpromedia}"
DRY_RUN="${DRY_RUN:-false}"
ROLLBACK_ON_FAIL="${ROLLBACK_ON_FAIL:-true}"
NAMESPACE="skillancer"

ALL_SERVICES=(
  "api-gateway"
  "auth-svc"
  "market-svc"
  "skillpod-svc"
  "cockpit-svc"
  "billing-svc"
  "notification-svc"
  "audit-svc"
)

# =============================================================================
# Helper Functions
# =============================================================================

log_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error()   { echo -e "${RED}❌ $1${NC}"; }
log_step()    { echo -e "${CYAN}🔹 $1${NC}"; }

usage() {
  cat << EOF
Usage: $(basename "$0") <environment> <service> <version>

Arguments:
    environment     Target environment (staging|production)
    service         Service name or "all" for all services
    version         Version/tag to deploy (e.g., v1.0.0, sha-abc1234)

Options:
    -h, --help      Show this help message
    -n, --dry-run   Dry run mode (no actual deployment)
    -w, --wait      Wait for rollout to complete (default: true)
    --no-rollback   Disable automatic rollback on failure

Examples:
    $(basename "$0") production api-gateway v1.0.0
    $(basename "$0") production all v1.0.0
    $(basename "$0") --dry-run staging auth-svc latest
EOF
  exit 0
}

check_prerequisites() {
  log_info "Checking prerequisites..."
  local missing=()

  command -v kubectl >/dev/null 2>&1 || missing+=("kubectl")
  command -v jq >/dev/null 2>&1 || missing+=("jq")

  if [ ${#missing[@]} -ne 0 ]; then
    log_error "Missing required tools: ${missing[*]}"
    exit 1
  fi

  # Check kubeconfig
  if [ ! -f "$KUBECONFIG" ]; then
    log_error "Kubeconfig not found at: $KUBECONFIG"
    log_info "Set KUBECONFIG env var or copy from control plane:"
    log_info "  scp root@<control-plane-ip>:/etc/rancher/k3s/k3s.yaml ~/.kube/config"
    exit 1
  fi

  # Check cluster connectivity
  if ! kubectl cluster-info &>/dev/null; then
    log_error "Cannot connect to Kubernetes cluster"
    exit 1
  fi

  log_success "Prerequisites check passed"
}

validate_environment() {
  local env="$1"
  if [[ "$env" != "staging" && "$env" != "production" ]]; then
    log_error "Invalid environment: $env (must be staging or production)"
    exit 1
  fi
}

validate_service() {
  local service="$1"
  [[ "$service" == "all" ]] && return 0
  for s in "${ALL_SERVICES[@]}"; do
    [[ "$s" == "$service" ]] && return 0
  done
  log_error "Invalid service: $service"
  log_info "Valid services: ${ALL_SERVICES[*]}"
  exit 1
}

get_services_to_deploy() {
  local service="$1"
  if [[ "$service" == "all" ]]; then
    echo "${ALL_SERVICES[@]}"
  else
    echo "$service"
  fi
}

# =============================================================================
# Deployment Functions
# =============================================================================

ensure_namespace() {
  if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
    log_info "Creating namespace $NAMESPACE..."
    kubectl create namespace "$NAMESPACE"
  fi
}

get_current_image() {
  local service="$1"
  kubectl get deployment "$service" \
    -n "$NAMESPACE" \
    -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo ""
}

save_rollback_info() {
  local service="$1"
  local current_image
  current_image=$(get_current_image "$service")
  if [ -n "$current_image" ]; then
    echo "$current_image" > "/tmp/skillancer-rollback-$service"
    log_info "Saved rollback image: $current_image"
  fi
}

rollback_service() {
  local service="$1"
  local rollback_file="/tmp/skillancer-rollback-$service"

  if [ -f "$rollback_file" ]; then
    local prev_image
    prev_image=$(cat "$rollback_file")
    log_warn "Rolling back $service to $prev_image..."
    kubectl set image deployment/"$service" \
      "$service=$prev_image" \
      -n "$NAMESPACE"
    kubectl rollout status deployment/"$service" \
      -n "$NAMESPACE" --timeout=300s || true
    rm -f "$rollback_file"
  else
    log_warn "No rollback info for $service, using kubectl rollout undo..."
    kubectl rollout undo deployment/"$service" -n "$NAMESPACE" || true
  fi
}

deploy_service() {
  local environment="$1"
  local service="$2"
  local version="$3"
  local wait="${4:-true}"

  local image="$IMAGE_REGISTRY/$service:$version"

  echo ""
  echo "========================================"
  log_step "Deploying $service to $environment"
  echo "========================================"
  echo "  Namespace: $NAMESPACE"
  echo "  Image:     $image"
  echo ""

  # Save current state for rollback
  save_rollback_info "$service"

  if [[ "$DRY_RUN" == "true" ]]; then
    log_warn "DRY RUN: Would set image $service → $image"
    return 0
  fi

  # Check if deployment exists
  if ! kubectl get deployment "$service" -n "$NAMESPACE" &>/dev/null; then
    log_warn "Deployment $service not found. Creating from manifest..."
    apply_deployment_manifest "$service" "$image" "$environment"
  else
    # Update image
    kubectl set image deployment/"$service" \
      "$service=$image" \
      -n "$NAMESPACE"

    # Add deployment annotation
    kubectl annotate deployment/"$service" \
      -n "$NAMESPACE" \
      "kubernetes.io/change-cause=Deployed $version by $(whoami) at $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --overwrite
  fi

  # Wait for rollout
  if [[ "$wait" == "true" ]]; then
    log_info "Waiting for rollout to complete..."
    if ! kubectl rollout status deployment/"$service" \
      -n "$NAMESPACE" --timeout=300s; then
      log_error "$service rollout failed!"

      if [[ "$ROLLBACK_ON_FAIL" == "true" ]]; then
        rollback_service "$service"
      fi
      return 1
    fi
  fi

  log_success "$service deployed successfully"
  return 0
}

apply_deployment_manifest() {
  local service="$1"
  local image="$2"
  local environment="$3"

  # Determine port based on service
  local port
  case "$service" in
    api-gateway)      port=4000 ;;
    auth-svc)         port=3001 ;;
    market-svc)       port=3002 ;;
    skillpod-svc)     port=3003 ;;
    cockpit-svc)      port=3004 ;;
    billing-svc)      port=3005 ;;
    notification-svc) port=4006 ;;
    audit-svc)        port=3012 ;;
    *)                port=3000 ;;
  esac

  kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $service
  labels:
    app: $service
    environment: $environment
spec:
  replicas: 2
  selector:
    matchLabels:
      app: $service
  template:
    metadata:
      labels:
        app: $service
        environment: $environment
    spec:
      containers:
        - name: $service
          image: $image
          ports:
            - containerPort: $port
          envFrom:
            - secretRef:
                name: skillancer-secrets
          livenessProbe:
            httpGet:
              path: /health
              port: $port
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: $port
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
---
apiVersion: v1
kind: Service
metadata:
  name: $service
  labels:
    app: $service
spec:
  type: ClusterIP
  ports:
    - port: $port
      targetPort: $port
  selector:
    app: $service
EOF
}

run_health_checks() {
  local environment="$1"

  echo ""
  log_info "Running health checks..."

  local failed=0
  for service in "${ALL_SERVICES[@]}"; do
    if kubectl get deployment "$service" -n "$NAMESPACE" &>/dev/null; then
      local ready
      ready=$(kubectl get deployment "$service" -n "$NAMESPACE" \
        -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
      local desired
      desired=$(kubectl get deployment "$service" -n "$NAMESPACE" \
        -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

      if [ "$ready" == "$desired" ] && [ "$desired" != "0" ]; then
        log_success "$service: $ready/$desired replicas ready"
      else
        log_error "$service: $ready/$desired replicas ready"
        failed=$((failed + 1))
      fi
    fi
  done

  return $failed
}

# =============================================================================
# Main
# =============================================================================

main() {
  local environment=""
  local service=""
  local version=""
  local wait=true

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help)     usage ;;
      -n|--dry-run)  DRY_RUN="true"; shift ;;
      -w|--wait)     wait=true; shift ;;
      --no-rollback) ROLLBACK_ON_FAIL="false"; shift ;;
      *)
        if [ -z "$environment" ]; then
          environment="$1"
        elif [ -z "$service" ]; then
          service="$1"
        elif [ -z "$version" ]; then
          version="$1"
        fi
        shift
        ;;
    esac
  done

  if [ -z "$environment" ] || [ -z "$service" ] || [ -z "$version" ]; then
    log_error "Missing required arguments"
    usage
  fi

  validate_environment "$environment"
  validate_service "$service"
  check_prerequisites
  ensure_namespace

  echo ""
  echo "========================================"
  echo "  Hetzner K3s Deployment"
  echo "========================================"
  echo "  Environment:  $environment"
  echo "  Service:      $service"
  echo "  Version:      $version"
  echo "  Registry:     $IMAGE_REGISTRY"
  echo "  Namespace:    $NAMESPACE"
  echo "  Dry Run:      $DRY_RUN"
  echo "  Auto Rollback: $ROLLBACK_ON_FAIL"
  echo "========================================"
  echo ""

  [[ "$DRY_RUN" == "true" ]] && log_warn "Running in DRY RUN mode"

  local services
  read -ra services <<< "$(get_services_to_deploy "$service")"

  local failed=()

  for svc in "${services[@]}"; do
    if ! deploy_service "$environment" "$svc" "$version" "$wait"; then
      failed+=("$svc")
    fi
  done

  # Health check
  if [ ${#failed[@]} -eq 0 ]; then
    run_health_checks "$environment" || true
  fi

  echo ""
  echo "========================================"
  echo "  Deployment Summary"
  echo "========================================"

  if [ ${#failed[@]} -eq 0 ]; then
    log_success "All services deployed successfully!"
  else
    log_error "Failed services: ${failed[*]}"
    exit 1
  fi
}

main "$@"
