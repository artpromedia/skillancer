#!/usr/bin/env bash
# =============================================================================
# Health Check Script
# =============================================================================
# Performs health checks on deployed services.
#
# Usage:
#   ./scripts/health-check.sh <environment>
#   ./scripts/health-check.sh staging
#   ./scripts/health-check.sh production
#
# Environment Variables:
#   MAX_RETRIES - Maximum number of retry attempts (default: 5)
#   RETRY_DELAY - Delay between retries in seconds (default: 10)
#   VERBOSE - Enable verbose output (default: false)
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
MAX_RETRIES="${MAX_RETRIES:-5}"
RETRY_DELAY="${RETRY_DELAY:-10}"
VERBOSE="${VERBOSE:-false}"

# Endpoints to check
HEALTH_ENDPOINTS=(
    "/health"
    "/ready"
)

API_ENDPOINTS=(
    "/api/v1/status"
    "/docs"
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

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}   $1${NC}"
    fi
}

usage() {
    cat << EOF
Usage: $(basename "$0") <environment> [options]

Arguments:
    environment     Target environment (staging|production)

Options:
    -h, --help      Show this help message
    -v, --verbose   Enable verbose output
    -r, --retries   Maximum retry attempts (default: $MAX_RETRIES)
    -d, --delay     Delay between retries in seconds (default: $RETRY_DELAY)
    --full          Run full health check including all endpoints

Examples:
    $(basename "$0") staging
    $(basename "$0") production --verbose
    $(basename "$0") staging --retries 10 --delay 5
EOF
    exit 0
}

get_base_url() {
    local env="$1"
    
    case "$env" in
        staging)
            echo "https://api-staging.skillancer.com"
            ;;
        production)
            echo "https://api.skillancer.com"
            ;;
        local)
            echo "http://localhost:3000"
            ;;
        *)
            log_error "Unknown environment: $env"
            exit 1
            ;;
    esac
}

# =============================================================================
# Health Check Functions
# =============================================================================

check_endpoint() {
    local url="$1"
    local expected_status="${2:-200}"
    
    local response
    local status
    local time
    
    response=$(curl -s -w "\n%{http_code}\n%{time_total}" -o /tmp/health_response.txt "$url" 2>/dev/null || echo -e "\n000\n0")
    
    status=$(echo "$response" | tail -2 | head -1)
    time=$(echo "$response" | tail -1)
    
    log_verbose "Response: status=$status, time=${time}s"
    
    if [[ "$status" == "$expected_status" ]]; then
        return 0
    else
        return 1
    fi
}

check_endpoint_with_retry() {
    local url="$1"
    local expected_status="${2:-200}"
    local max_retries="${3:-$MAX_RETRIES}"
    local retry_delay="${4:-$RETRY_DELAY}"
    
    local attempt=1
    
    while [ $attempt -le $max_retries ]; do
        log_verbose "Attempt $attempt/$max_retries: $url"
        
        if check_endpoint "$url" "$expected_status"; then
            return 0
        fi
        
        if [ $attempt -lt $max_retries ]; then
            log_verbose "Retrying in ${retry_delay}s..."
            sleep "$retry_delay"
        fi
        
        attempt=$((attempt + 1))
    done
    
    return 1
}

check_health() {
    local base_url="$1"
    local endpoint="$2"
    local url="${base_url}${endpoint}"
    
    printf "  %-30s " "$endpoint"
    
    if check_endpoint_with_retry "$url"; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        return 1
    fi
}

check_response_body() {
    local base_url="$1"
    local endpoint="$2"
    local expected_field="$3"
    local url="${base_url}${endpoint}"
    
    printf "  %-30s " "$endpoint (body check)"
    
    local response
    response=$(curl -s "$url" 2>/dev/null || echo "{}")
    
    if echo "$response" | jq -e ".$expected_field" &>/dev/null; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        log_verbose "Expected field '$expected_field' not found in response"
        return 1
    fi
}

check_response_time() {
    local base_url="$1"
    local endpoint="$2"
    local max_time="$3"
    local url="${base_url}${endpoint}"
    
    printf "  %-30s " "$endpoint (< ${max_time}s)"
    
    local time
    time=$(curl -s -w "%{time_total}" -o /dev/null "$url" 2>/dev/null || echo "999")
    
    if (( $(echo "$time < $max_time" | bc -l) )); then
        echo -e "${GREEN}✓ OK${NC} (${time}s)"
        return 0
    else
        echo -e "${YELLOW}⚠ SLOW${NC} (${time}s)"
        return 1
    fi
}

# =============================================================================
# Main Health Check
# =============================================================================

run_basic_health_check() {
    local base_url="$1"
    local failed=0
    
    echo ""
    log_info "Basic Health Checks"
    echo "  URL: $base_url"
    echo ""
    
    for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
        if ! check_health "$base_url" "$endpoint"; then
            failed=$((failed + 1))
        fi
    done
    
    return $failed
}

run_api_health_check() {
    local base_url="$1"
    local failed=0
    
    echo ""
    log_info "API Endpoint Checks"
    echo ""
    
    for endpoint in "${API_ENDPOINTS[@]}"; do
        if ! check_health "$base_url" "$endpoint"; then
            failed=$((failed + 1))
        fi
    done
    
    return $failed
}

run_performance_check() {
    local base_url="$1"
    local failed=0
    
    echo ""
    log_info "Performance Checks"
    echo ""
    
    # Health endpoint should respond within 1 second
    if ! check_response_time "$base_url" "/health" 1; then
        failed=$((failed + 1))
    fi
    
    # API endpoints should respond within 3 seconds
    if ! check_response_time "$base_url" "/api/v1/status" 3; then
        failed=$((failed + 1))
    fi
    
    return $failed
}

run_body_check() {
    local base_url="$1"
    local failed=0
    
    echo ""
    log_info "Response Body Checks"
    echo ""
    
    # Check health endpoint returns status field
    if ! check_response_body "$base_url" "/health" "status"; then
        failed=$((failed + 1))
    fi
    
    return $failed
}

# =============================================================================
# Main
# =============================================================================

main() {
    local environment=""
    local full_check=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage
                ;;
            -v|--verbose)
                VERBOSE="true"
                shift
                ;;
            -r|--retries)
                MAX_RETRIES="$2"
                shift 2
                ;;
            -d|--delay)
                RETRY_DELAY="$2"
                shift 2
                ;;
            --full)
                full_check=true
                shift
                ;;
            *)
                if [ -z "$environment" ]; then
                    environment="$1"
                fi
                shift
                ;;
        esac
    done
    
    if [ -z "$environment" ]; then
        log_error "Environment argument required"
        usage
    fi
    
    local base_url
    base_url=$(get_base_url "$environment")
    
    echo ""
    echo "========================================"
    echo "  Health Check: $environment"
    echo "========================================"
    echo "  Base URL: $base_url"
    echo "  Max Retries: $MAX_RETRIES"
    echo "  Retry Delay: ${RETRY_DELAY}s"
    echo "========================================"
    
    local total_failed=0
    
    # Basic health check
    run_basic_health_check "$base_url" || total_failed=$((total_failed + $?))
    
    # API endpoint check
    run_api_health_check "$base_url" || total_failed=$((total_failed + $?))
    
    # Full check includes performance and body checks
    if [[ "$full_check" == "true" ]]; then
        run_performance_check "$base_url" || total_failed=$((total_failed + $?))
        run_body_check "$base_url" || total_failed=$((total_failed + $?))
    fi
    
    echo ""
    echo "========================================"
    echo "  Summary"
    echo "========================================"
    
    if [ $total_failed -eq 0 ]; then
        log_success "All health checks passed!"
        exit 0
    else
        log_error "$total_failed health check(s) failed"
        exit 1
    fi
}

main "$@"
