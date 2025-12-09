#!/usr/bin/env bash
# =============================================================================
# Preview Environment Cleanup Script
# =============================================================================
# This script cleans up a local preview environment.
# Usage: ./scripts/preview-cleanup.sh [PR_NUMBER]
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PR_NUMBER=${1:-"local"}
PREVIEW_ID="pr-${PR_NUMBER}"

echo -e "${BLUE}🧹 Cleaning up preview environment: ${PREVIEW_ID}${NC}"
echo "=================================================="

# =============================================================================
# Stop Services
# =============================================================================
stop_services() {
    echo -e "\n${YELLOW}🛑 Stopping services...${NC}"
    
    # Kill Node.js processes
    pkill -f "services/api-gateway" 2>/dev/null || true
    pkill -f "turbo run dev" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Services stopped${NC}"
}

# =============================================================================
# Cleanup Docker
# =============================================================================
cleanup_docker() {
    echo -e "\n${YELLOW}🐳 Cleaning up Docker...${NC}"
    
    docker compose -f docker-compose.preview.yml down -v 2>/dev/null || true
    
    # Remove preview-specific containers
    docker rm -f "skillancer-preview-${PR_NUMBER}" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Docker cleaned up${NC}"
}

# =============================================================================
# Cleanup Neon Branch
# =============================================================================
cleanup_neon() {
    echo -e "\n${YELLOW}🗄️ Cleaning up Neon branch...${NC}"
    
    if [ -n "$NEON_API_KEY" ] && [ -n "$NEON_PROJECT_ID" ]; then
        # Get branch ID
        BRANCHES=$(curl -s \
            -H "Authorization: Bearer ${NEON_API_KEY}" \
            "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches")
        
        BRANCH_ID=$(echo "$BRANCHES" | jq -r ".branches[] | select(.name == \"preview/${PREVIEW_ID}\") | .id")
        
        if [ -n "$BRANCH_ID" ] && [ "$BRANCH_ID" != "null" ]; then
            curl -s -X DELETE \
                -H "Authorization: Bearer ${NEON_API_KEY}" \
                "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches/${BRANCH_ID}"
            
            echo -e "${GREEN}✅ Neon branch deleted${NC}"
        else
            echo "Neon branch not found, skipping..."
        fi
    else
        echo "Neon credentials not configured, skipping..."
    fi
}

# =============================================================================
# Cleanup Local Database
# =============================================================================
cleanup_local_db() {
    echo -e "\n${YELLOW}🗄️ Cleaning up local database...${NC}"
    
    # Drop the preview database
    docker exec skillancer-postgres psql -U skillancer -c "DROP DATABASE IF EXISTS skillancer_preview_${PR_NUMBER};" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Local database cleaned up${NC}"
}

# =============================================================================
# Cleanup Temp Files
# =============================================================================
cleanup_temp_files() {
    echo -e "\n${YELLOW}📁 Cleaning up temp files...${NC}"
    
    # Remove any preview-specific temp files
    rm -rf "/tmp/skillancer-preview-${PR_NUMBER}" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Temp files cleaned up${NC}"
}

# =============================================================================
# Main
# =============================================================================
main() {
    stop_services
    cleanup_docker
    cleanup_neon
    cleanup_local_db
    cleanup_temp_files
    
    echo -e "\n${GREEN}=================================================="
    echo "🎉 Preview environment ${PREVIEW_ID} cleaned up!"
    echo "==================================================${NC}"
}

main "$@"
