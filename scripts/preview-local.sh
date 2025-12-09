#!/usr/bin/env bash
# =============================================================================
# Local Preview Environment Script
# =============================================================================
# This script simulates a preview environment locally for testing.
# Usage: ./scripts/preview-local.sh [PR_NUMBER]
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default PR number for local testing
PR_NUMBER=${1:-"local"}
PREVIEW_ID="pr-${PR_NUMBER}"

echo -e "${BLUE}🚀 Setting up local preview environment: ${PREVIEW_ID}${NC}"
echo "=================================================="

# =============================================================================
# Check Prerequisites
# =============================================================================
check_prerequisites() {
    echo -e "\n${YELLOW}📋 Checking prerequisites...${NC}"
    
    local missing=()
    
    command -v node >/dev/null 2>&1 || missing+=("node")
    command -v pnpm >/dev/null 2>&1 || missing+=("pnpm")
    command -v docker >/dev/null 2>&1 || missing+=("docker")
    
    if [ ${#missing[@]} -ne 0 ]; then
        echo -e "${RED}❌ Missing required tools: ${missing[*]}${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites met${NC}"
}

# =============================================================================
# Setup Database
# =============================================================================
setup_database() {
    echo -e "\n${YELLOW}🗄️ Setting up preview database...${NC}"
    
    # Check if we should use Neon or local PostgreSQL
    if [ -n "$NEON_API_KEY" ] && [ -n "$NEON_PROJECT_ID" ]; then
        echo "Using Neon for preview database..."
        
        # Create Neon branch
        BRANCH_RESPONSE=$(curl -s -X POST \
            -H "Authorization: Bearer ${NEON_API_KEY}" \
            -H "Content-Type: application/json" \
            -d "{\"endpoints\": [{\"type\": \"read_write\"}], \"branch\": {\"name\": \"preview/${PREVIEW_ID}\", \"parent_id\": \"main\"}}" \
            "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches")
        
        DATABASE_URL=$(echo "$BRANCH_RESPONSE" | jq -r '.connection_uris[0].connection_uri')
        
        if [ "$DATABASE_URL" == "null" ] || [ -z "$DATABASE_URL" ]; then
            echo -e "${RED}❌ Failed to create Neon branch${NC}"
            echo "$BRANCH_RESPONSE"
            exit 1
        fi
        
        export DATABASE_URL
        echo -e "${GREEN}✅ Neon branch created: preview/${PREVIEW_ID}${NC}"
    else
        echo "Using local PostgreSQL..."
        
        # Start local PostgreSQL with Docker
        docker compose -f docker-compose.preview.yml up -d postgres
        
        export DATABASE_URL="postgresql://skillancer:skillancer@localhost:5432/skillancer_preview_${PR_NUMBER}"
        
        # Wait for PostgreSQL to be ready
        echo "Waiting for PostgreSQL..."
        sleep 5
        
        # Create database if it doesn't exist
        docker exec skillancer-postgres psql -U skillancer -c "CREATE DATABASE skillancer_preview_${PR_NUMBER};" 2>/dev/null || true
        
        echo -e "${GREEN}✅ Local PostgreSQL ready${NC}"
    fi
    
    # Run migrations
    echo "Running migrations..."
    pnpm db:migrate:deploy
    
    echo -e "${GREEN}✅ Database setup complete${NC}"
}

# =============================================================================
# Setup Redis
# =============================================================================
setup_redis() {
    echo -e "\n${YELLOW}📦 Setting up Redis...${NC}"
    
    if [ -n "$PREVIEW_REDIS_URL" ]; then
        export REDIS_URL="$PREVIEW_REDIS_URL"
        echo "Using remote Redis"
    else
        docker compose -f docker-compose.preview.yml up -d redis
        export REDIS_URL="redis://localhost:6379"
        echo "Using local Redis"
    fi
    
    echo -e "${GREEN}✅ Redis ready${NC}"
}

# =============================================================================
# Build Services
# =============================================================================
build_services() {
    echo -e "\n${YELLOW}🔨 Building services...${NC}"
    
    pnpm turbo run build --filter=./services/* --filter=./packages/*
    
    echo -e "${GREEN}✅ Services built${NC}"
}

# =============================================================================
# Start Services
# =============================================================================
start_services() {
    echo -e "\n${YELLOW}🚀 Starting services...${NC}"
    
    # Set environment variables
    export NODE_ENV="preview"
    export LOG_LEVEL="debug"
    export PREVIEW_MODE="true"
    export PR_NUMBER="$PR_NUMBER"
    
    # Start API Gateway
    echo "Starting API Gateway..."
    (cd services/api-gateway && node dist/main.js &)
    
    # Give services time to start
    sleep 5
    
    echo -e "${GREEN}✅ Services started${NC}"
}

# =============================================================================
# Start Web Apps
# =============================================================================
start_web_apps() {
    echo -e "\n${YELLOW}🌐 Starting web apps...${NC}"
    
    export NEXT_PUBLIC_API_URL="http://localhost:3000"
    export NEXT_PUBLIC_PREVIEW_MODE="true"
    export NEXT_PUBLIC_PR_NUMBER="$PR_NUMBER"
    
    # Start web apps in development mode
    pnpm turbo run dev --filter=./apps/web* --parallel &
    
    sleep 10
    
    echo -e "${GREEN}✅ Web apps starting...${NC}"
}

# =============================================================================
# Health Check
# =============================================================================
health_check() {
    echo -e "\n${YELLOW}🏥 Running health checks...${NC}"
    
    local max_retries=10
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -sf "http://localhost:3000/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ API Gateway is healthy${NC}"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        echo "Waiting for services... (attempt $retry_count/$max_retries)"
        sleep 5
    done
    
    echo -e "${RED}❌ Health check failed${NC}"
    return 1
}

# =============================================================================
# Print Summary
# =============================================================================
print_summary() {
    echo -e "\n${GREEN}=================================================="
    echo "🎉 Preview Environment Ready!"
    echo "==================================================${NC}"
    echo ""
    echo -e "Preview ID: ${BLUE}${PREVIEW_ID}${NC}"
    echo ""
    echo "📚 Services:"
    echo "  - API Gateway:  http://localhost:3000"
    echo "  - Web:          http://localhost:3001"
    echo "  - Web Market:   http://localhost:3002"
    echo "  - Web Cockpit:  http://localhost:3003"
    echo "  - Web SkillPod: http://localhost:3004"
    echo ""
    echo "🔗 Useful Commands:"
    echo "  - View logs:    docker compose -f docker-compose.preview.yml logs -f"
    echo "  - Stop preview: ./scripts/preview-cleanup.sh ${PR_NUMBER}"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop the preview environment${NC}"
}

# =============================================================================
# Cleanup Handler
# =============================================================================
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    
    # Kill background processes
    pkill -f "services/api-gateway" 2>/dev/null || true
    pkill -f "turbo run dev" 2>/dev/null || true
    
    # Stop Docker services
    docker compose -f docker-compose.preview.yml down 2>/dev/null || true
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

trap cleanup EXIT

# =============================================================================
# Main
# =============================================================================
main() {
    check_prerequisites
    setup_database
    setup_redis
    build_services
    start_services
    start_web_apps
    health_check
    print_summary
    
    # Keep script running
    wait
}

main "$@"
