#!/usr/bin/env bash
# =============================================================================
# Rollback Script
# =============================================================================
# Performs rollback of services to a previous version.
#
# Usage:
#   ./scripts/rollback.sh <environment> <service> [version]
#   ./scripts/rollback.sh staging api-gateway
#   ./scripts/rollback.sh production all v1.0.0
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
Usage: $(basename "$0") <environment> <service> [version]

Arguments:
    environment     Target environment (staging|production)
    service         Service name or "all" for all services
    version         Version to rollback to (optional, defaults to previous)

Options:
    -h, --help      Show this help message
    -y, --yes       Skip confirmation prompt
    -w, --wait      Wait for rollback to complete

Examples:
    $(basename "$0") staging api-gateway
    $(basename "$0") production all
    $(basename "$0") production auth-svc v1.0.0
EOF
    exit 0
}

confirm() {
    local message="$1"
    
    echo -e "${YELLOW}$message${NC}"
    read -p "Continue? (y/N) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Aborted"
        exit 0
    fi
}

# =============================================================================
# Rollback Functions
# =============================================================================

get_previous_task_definition() {
    local cluster="$1"
    local service="$2"
    
    # Get current task definition
    local current_task
    current_task=$(aws ecs describe-services \
        --cluster "$cluster" \
        --services "$service" \
        --query 'services[0].taskDefinition' \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$current_task" ]; then
        return 1
    fi
    
    # Extract family and revision
    local family
    local current_rev
    family=$(echo "$current_task" | sed 's/:.*$//')
    current_rev=$(echo "$current_task" | sed 's/.*://')
    
    # Get previous revision
    local prev_rev=$((current_rev - 1))
    
    if [ $prev_rev -lt 1 ]; then
        return 1
    fi
    
    echo "$family:$prev_rev"
}

rollback_service() {
    local environment="$1"
    local service="$2"
    local version="${3:-}"
    local wait="${4:-false}"
    
    local cluster="skillancer-$environment"
    local task_def_name="skillancer-$environment-$service"
    
    echo ""
    log_info "Rolling back $service in $environment..."
    
    local target_task
    
    if [ -z "$version" ]; then
        # Rollback to previous
        target_task=$(get_previous_task_definition "$cluster" "$service")
        
        if [ -z "$target_task" ]; then
            log_error "Could not find previous task definition for $service"
            return 1
        fi
        
        log_info "Rolling back to: $target_task"
    else
        # Rollback to specific version
        target_task="$task_def_name:$version"
        
        # Verify task definition exists
        if ! aws ecs describe-task-definition --task-definition "$target_task" &>/dev/null; then
            log_error "Task definition not found: $target_task"
            return 1
        fi
        
        log_info "Rolling back to: $target_task"
    fi
    
    # Update service
    aws ecs update-service \
        --cluster "$cluster" \
        --service "$service" \
        --task-definition "$target_task" \
        --force-new-deployment \
        --output text > /dev/null
    
    log_success "Rollback initiated for $service"
    
    # Wait if requested
    if [[ "$wait" == "true" ]]; then
        log_info "Waiting for $service to stabilize..."
        
        if aws ecs wait services-stable --cluster "$cluster" --services "$service" 2>/dev/null; then
            log_success "$service is stable"
        else
            log_warn "$service did not stabilize in time"
            return 1
        fi
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    local environment=""
    local service=""
    local version=""
    local skip_confirm=false
    local wait=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage
                ;;
            -y|--yes)
                skip_confirm=true
                shift
                ;;
            -w|--wait)
                wait=true
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
    if [ -z "$environment" ] || [ -z "$service" ]; then
        log_error "Missing required arguments"
        usage
    fi
    
    echo ""
    echo "========================================"
    echo "  Rollback"
    echo "========================================"
    echo "  Environment: $environment"
    echo "  Service: $service"
    echo "  Version: ${version:-previous}"
    echo "========================================"
    
    # Confirm for production
    if [[ "$environment" == "production" ]] && [[ "$skip_confirm" != "true" ]]; then
        confirm "⚠️  You are about to rollback in PRODUCTION!"
    fi
    
    # Get services to rollback
    local services
    if [[ "$service" == "all" ]]; then
        services=("${ALL_SERVICES[@]}")
    else
        services=("$service")
    fi
    
    local failed=()
    
    for svc in "${services[@]}"; do
        if ! rollback_service "$environment" "$svc" "$version" "$wait"; then
            failed+=("$svc")
        fi
    done
    
    echo ""
    echo "========================================"
    echo "  Summary"
    echo "========================================"
    
    if [ ${#failed[@]} -eq 0 ]; then
        log_success "All rollbacks completed successfully!"
    else
        log_error "Failed rollbacks: ${failed[*]}"
        exit 1
    fi
}

main "$@"
