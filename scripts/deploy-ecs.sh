#!/usr/bin/env bash
# =============================================================================
# ECS Deployment Helper Script
# =============================================================================
# Deploys services to AWS ECS with support for both rolling and blue-green
# deployments.
#
# Usage:
#   ./scripts/deploy-ecs.sh <environment> <service> <version>
#   ./scripts/deploy-ecs.sh staging api-gateway v1.0.0
#   ./scripts/deploy-ecs.sh production all v1.0.0
#
# Environment Variables:
#   AWS_REGION - AWS region (default: us-east-1)
#   ECR_REGISTRY - ECR registry URL
#   DRY_RUN - Set to "true" for dry run mode
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REGISTRY="${ECR_REGISTRY:-}"
DRY_RUN="${DRY_RUN:-false}"

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

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

usage() {
    cat << EOF
Usage: $(basename "$0") <environment> <service> <version>

Arguments:
    environment     Target environment (staging|production)
    service         Service name or "all" for all services
    version         Version/tag to deploy

Options:
    -h, --help      Show this help message
    -n, --dry-run   Dry run mode (no actual deployment)
    -w, --wait      Wait for deployment to complete
    -f, --force     Force deployment even if version is same

Examples:
    $(basename "$0") staging api-gateway v1.0.0
    $(basename "$0") production all v1.0.0
    $(basename "$0") --dry-run staging auth-svc latest
EOF
    exit 0
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing=()
    
    command -v aws >/dev/null 2>&1 || missing+=("aws")
    command -v jq >/dev/null 2>&1 || missing+=("jq")
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "AWS credentials not configured or invalid"
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
    
    if [[ "$service" == "all" ]]; then
        return 0
    fi
    
    for s in "${ALL_SERVICES[@]}"; do
        if [[ "$s" == "$service" ]]; then
            return 0
        fi
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

get_current_task_definition() {
    local cluster="$1"
    local service="$2"
    
    aws ecs describe-services \
        --cluster "$cluster" \
        --services "$service" \
        --query 'services[0].taskDefinition' \
        --output text 2>/dev/null || echo ""
}

get_task_definition() {
    local task_def_name="$1"
    
    aws ecs describe-task-definition \
        --task-definition "$task_def_name" \
        --query 'taskDefinition' \
        --output json 2>/dev/null || echo ""
}

update_task_definition_image() {
    local task_def="$1"
    local new_image="$2"
    
    echo "$task_def" | jq \
        --arg IMAGE "$new_image" \
        '.containerDefinitions[0].image = $IMAGE | 
         del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)'
}

register_task_definition() {
    local task_def="$1"
    
    aws ecs register-task-definition \
        --cli-input-json "$task_def" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text
}

update_service() {
    local cluster="$1"
    local service="$2"
    local task_arn="$3"
    
    aws ecs update-service \
        --cluster "$cluster" \
        --service "$service" \
        --task-definition "$task_arn" \
        --force-new-deployment \
        --output text > /dev/null
}

wait_for_service() {
    local cluster="$1"
    local service="$2"
    local timeout="${3:-900}"
    
    log_info "Waiting for $service to stabilize (timeout: ${timeout}s)..."
    
    if aws ecs wait services-stable \
        --cluster "$cluster" \
        --services "$service" 2>/dev/null; then
        log_success "$service is stable"
        return 0
    else
        log_warn "$service did not stabilize within timeout"
        return 1
    fi
}

deploy_service() {
    local environment="$1"
    local service="$2"
    local version="$3"
    local wait="${4:-false}"
    
    local cluster="skillancer-$environment"
    local task_def_name="skillancer-$environment-$service"
    local image="$ECR_REGISTRY/$service:$version"
    
    echo ""
    echo "========================================"
    log_info "Deploying $service to $environment"
    echo "========================================"
    echo "  Cluster: $cluster"
    echo "  Task Definition: $task_def_name"
    echo "  Image: $image"
    echo ""
    
    # Get current task definition
    log_info "Fetching current task definition..."
    local task_def
    task_def=$(get_task_definition "$task_def_name")
    
    if [ -z "$task_def" ]; then
        log_error "Task definition not found: $task_def_name"
        return 1
    fi
    
    # Update image
    log_info "Updating task definition with new image..."
    local new_task_def
    new_task_def=$(update_task_definition_image "$task_def" "$image")
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "DRY RUN: Would register new task definition"
        log_warn "DRY RUN: Would update service $service"
        return 0
    fi
    
    # Register new task definition
    log_info "Registering new task definition..."
    local new_task_arn
    new_task_arn=$(register_task_definition "$new_task_def")
    
    log_success "Registered: $new_task_arn"
    
    # Update service
    log_info "Updating ECS service..."
    update_service "$cluster" "$service" "$new_task_arn"
    
    log_success "Deployment initiated for $service"
    
    # Wait if requested
    if [[ "$wait" == "true" ]]; then
        wait_for_service "$cluster" "$service"
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    local environment=""
    local service=""
    local version=""
    local wait=false
    local force=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage
                ;;
            -n|--dry-run)
                DRY_RUN="true"
                shift
                ;;
            -w|--wait)
                wait=true
                shift
                ;;
            -f|--force)
                force=true
                shift
                ;;
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
    
    # Validate arguments
    if [ -z "$environment" ] || [ -z "$service" ] || [ -z "$version" ]; then
        log_error "Missing required arguments"
        usage
    fi
    
    validate_environment "$environment"
    validate_service "$service"
    check_prerequisites
    
    # Auto-detect ECR registry if not set
    if [ -z "$ECR_REGISTRY" ]; then
        local account_id
        account_id=$(aws sts get-caller-identity --query 'Account' --output text)
        ECR_REGISTRY="$account_id.dkr.ecr.$AWS_REGION.amazonaws.com"
        log_info "Using ECR registry: $ECR_REGISTRY"
    fi
    
    echo ""
    echo "========================================"
    echo "  ECS Deployment"
    echo "========================================"
    echo "  Environment: $environment"
    echo "  Service: $service"
    echo "  Version: $version"
    echo "  Dry Run: $DRY_RUN"
    echo "  Wait: $wait"
    echo "========================================"
    echo ""
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "Running in DRY RUN mode - no changes will be made"
    fi
    
    # Get services to deploy
    local services
    read -ra services <<< "$(get_services_to_deploy "$service")"
    
    local failed=()
    
    for svc in "${services[@]}"; do
        if ! deploy_service "$environment" "$svc" "$version" "$wait"; then
            failed+=("$svc")
        fi
    done
    
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
