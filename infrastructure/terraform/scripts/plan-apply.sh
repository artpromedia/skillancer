#!/bin/bash
# =============================================================================
# Terraform Plan/Apply Wrapper Script
# =============================================================================
# A safe wrapper script for running Terraform plan and apply operations
# with additional safety checks and logging.
#
# Usage:
#   ./plan-apply.sh plan <environment>
#   ./plan-apply.sh apply <environment>
#   ./plan-apply.sh destroy <environment>
#
# Examples:
#   ./plan-apply.sh plan dev
#   ./plan-apply.sh apply staging
#   ./plan-apply.sh plan prod --auto-approve
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENTS_DIR="$TERRAFORM_DIR/environments"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

usage() {
    echo ""
    echo "Usage: $0 <action> <environment> [options]"
    echo ""
    echo "Actions:"
    echo "  plan     Generate and show an execution plan"
    echo "  apply    Apply changes to infrastructure"
    echo "  destroy  Destroy managed infrastructure"
    echo "  output   Show outputs from state"
    echo "  state    Run state management commands"
    echo ""
    echo "Environments:"
    echo "  dev      Development environment"
    echo "  staging  Staging environment"
    echo "  prod     Production environment"
    echo ""
    echo "Options:"
    echo "  --auto-approve    Skip interactive approval (use with caution)"
    echo "  --target=<res>    Target specific resource"
    echo "  --var-file=<file> Specify additional var file"
    echo "  --lock=false      Disable state locking"
    echo ""
    echo "Examples:"
    echo "  $0 plan dev"
    echo "  $0 apply staging"
    echo "  $0 plan prod --target=module.rds"
    echo "  $0 destroy dev --auto-approve"
    echo ""
    exit 1
}

validate_environment() {
    local env="$1"
    local env_dir="$ENVIRONMENTS_DIR/$env"
    
    if [ ! -d "$env_dir" ]; then
        log_error "Environment '$env' not found at $env_dir"
        echo "Available environments:"
        ls -1 "$ENVIRONMENTS_DIR" 2>/dev/null || echo "  None found"
        exit 1
    fi
}

check_terraform() {
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed or not in PATH"
        exit 1
    fi
    
    local version=$(terraform version -json | jq -r '.terraform_version')
    log_info "Terraform version: $version"
}

check_aws_credentials() {
    log_info "Checking AWS credentials..."
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or expired"
        exit 1
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local user_arn=$(aws sts get-caller-identity --query Arn --output text)
    
    log_info "AWS Account: $account_id"
    log_info "Identity: $user_arn"
}

run_terraform_init() {
    local env_dir="$1"
    
    log_info "Initializing Terraform..."
    cd "$env_dir"
    
    terraform init -input=false
    
    log_success "Terraform initialized"
}

run_terraform_validate() {
    log_info "Validating Terraform configuration..."
    
    terraform validate
    
    log_success "Configuration is valid"
}

run_terraform_fmt_check() {
    log_info "Checking Terraform formatting..."
    
    if ! terraform fmt -check -recursive "$TERRAFORM_DIR"; then
        log_warn "Some files are not formatted correctly"
        log_info "Run 'terraform fmt -recursive' to fix formatting"
    else
        log_success "All files are properly formatted"
    fi
}

run_terraform_plan() {
    local env="$1"
    shift
    local extra_args="$*"
    
    log_info "Running Terraform plan for '$env'..."
    
    local plan_file="tfplan-${env}-$(date +%Y%m%d-%H%M%S)"
    
    terraform plan \
        -input=false \
        -out="$plan_file" \
        $extra_args
    
    log_success "Plan saved to: $plan_file"
    echo ""
    echo "To apply this plan, run:"
    echo "  terraform apply \"$plan_file\""
    echo ""
}

run_terraform_apply() {
    local env="$1"
    shift
    local extra_args="$*"
    local auto_approve=false
    
    # Check for auto-approve flag
    if [[ "$extra_args" == *"--auto-approve"* ]]; then
        auto_approve=true
        extra_args="${extra_args//--auto-approve/}"
    fi
    
    # Production safety check
    if [ "$env" == "prod" ] && [ "$auto_approve" == false ]; then
        echo ""
        echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ⚠️  PRODUCTION DEPLOYMENT - REQUIRES CONFIRMATION            ║${NC}"
        echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "You are about to apply changes to PRODUCTION infrastructure."
        echo "This action may cause service disruption."
        echo ""
        read -p "Type 'yes-apply-to-prod' to continue: " confirmation
        
        if [ "$confirmation" != "yes-apply-to-prod" ]; then
            log_error "Deployment cancelled"
            exit 1
        fi
    fi
    
    log_info "Running Terraform apply for '$env'..."
    
    if [ "$auto_approve" == true ]; then
        terraform apply -input=false -auto-approve $extra_args
    else
        terraform apply -input=false $extra_args
    fi
    
    log_success "Apply completed successfully"
}

run_terraform_destroy() {
    local env="$1"
    shift
    local extra_args="$*"
    local auto_approve=false
    
    # Check for auto-approve flag
    if [[ "$extra_args" == *"--auto-approve"* ]]; then
        auto_approve=true
        extra_args="${extra_args//--auto-approve/}"
    fi
    
    echo ""
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ⚠️  DESTROY OPERATION - THIS WILL DELETE RESOURCES           ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Extra safety for production
    if [ "$env" == "prod" ]; then
        echo -e "${RED}YOU ARE ABOUT TO DESTROY PRODUCTION INFRASTRUCTURE!${NC}"
        echo ""
        read -p "Type 'destroy-production-$env' to continue: " confirmation
        
        if [ "$confirmation" != "destroy-production-$env" ]; then
            log_error "Destroy cancelled"
            exit 1
        fi
    elif [ "$auto_approve" == false ]; then
        read -p "Type 'destroy-$env' to continue: " confirmation
        
        if [ "$confirmation" != "destroy-$env" ]; then
            log_error "Destroy cancelled"
            exit 1
        fi
    fi
    
    log_warn "Running Terraform destroy for '$env'..."
    
    if [ "$auto_approve" == true ] && [ "$env" != "prod" ]; then
        terraform destroy -input=false -auto-approve $extra_args
    else
        terraform destroy -input=false $extra_args
    fi
    
    log_success "Destroy completed"
}

run_terraform_output() {
    local env="$1"
    shift
    local extra_args="$*"
    
    log_info "Showing outputs for '$env'..."
    
    terraform output $extra_args
}

# =============================================================================
# Main
# =============================================================================

# Parse arguments
if [ $# -lt 2 ]; then
    usage
fi

ACTION="$1"
ENVIRONMENT="$2"
shift 2
EXTRA_ARGS="${*:-}"

# Validate inputs
validate_environment "$ENVIRONMENT"
check_terraform
check_aws_credentials

# Change to environment directory
ENV_DIR="$ENVIRONMENTS_DIR/$ENVIRONMENT"
cd "$ENV_DIR"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Terraform $ACTION - $ENVIRONMENT"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Working Directory: $ENV_DIR"
echo "  Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""

# Initialize and validate
run_terraform_init "$ENV_DIR"
run_terraform_validate

# Execute requested action
case "$ACTION" in
    plan)
        run_terraform_fmt_check
        run_terraform_plan "$ENVIRONMENT" $EXTRA_ARGS
        ;;
    apply)
        run_terraform_apply "$ENVIRONMENT" $EXTRA_ARGS
        ;;
    destroy)
        run_terraform_destroy "$ENVIRONMENT" $EXTRA_ARGS
        ;;
    output)
        run_terraform_output "$ENVIRONMENT" $EXTRA_ARGS
        ;;
    *)
        log_error "Unknown action: $ACTION"
        usage
        ;;
esac

echo ""
log_success "Operation completed at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
