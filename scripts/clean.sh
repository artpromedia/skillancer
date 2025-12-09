#!/bin/bash

# ===========================================
# Skillancer Cleanup Script
# ===========================================
# Cleans up build artifacts, node_modules, and optionally Docker volumes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$ROOT_DIR/infrastructure/docker"

# Parse arguments
CLEAN_NODE_MODULES=false
CLEAN_DOCKER=false
CLEAN_ALL=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --node-modules|-n)
      CLEAN_NODE_MODULES=true
      shift
      ;;
    --docker|-d)
      CLEAN_DOCKER=true
      shift
      ;;
    --all|-a)
      CLEAN_ALL=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      echo "Usage: clean.sh [options]"
      echo ""
      echo "Options:"
      echo "  --node-modules, -n  Remove all node_modules directories"
      echo "  --docker, -d        Stop Docker and remove volumes"
      echo "  --all, -a           Clean everything (node_modules + docker)"
      echo "  --dry-run           Show what would be deleted"
      echo "  -h, --help          Show this help"
      echo ""
      echo "Default: Cleans only build artifacts (dist, .turbo, coverage)"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              🧹 Skillancer Cleanup                         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY RUN - No files will be deleted${NC}"
  echo ""
fi

cd "$ROOT_DIR"

# ===========================================
# Clean Build Artifacts
# ===========================================
echo -e "${BLUE}🗑️  Cleaning build artifacts...${NC}"

ARTIFACTS=(
  "dist"
  ".turbo"
  ".next"
  ".nuxt"
  "coverage"
  ".nyc_output"
  "*.log"
  ".cache"
  "tsconfig.tsbuildinfo"
  ".eslintcache"
)

for artifact in "${ARTIFACTS[@]}"; do
  if [ "$DRY_RUN" = true ]; then
    find . -name "$artifact" -not -path "./node_modules/*" 2>/dev/null | head -20
  else
    find . -name "$artifact" -not -path "./node_modules/*" -exec rm -rf {} + 2>/dev/null || true
  fi
done

echo -e "${GREEN}✓ Build artifacts cleaned${NC}"
echo ""

# ===========================================
# Clean node_modules
# ===========================================
if [ "$CLEAN_NODE_MODULES" = true ] || [ "$CLEAN_ALL" = true ]; then
  echo -e "${BLUE}🗑️  Cleaning node_modules...${NC}"
  
  if [ "$DRY_RUN" = true ]; then
    find . -name "node_modules" -type d | head -20
    echo "..."
  else
    find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
    rm -f pnpm-lock.yaml 2>/dev/null || true
  fi
  
  echo -e "${GREEN}✓ node_modules cleaned${NC}"
  echo ""
fi

# ===========================================
# Clean Docker
# ===========================================
if [ "$CLEAN_DOCKER" = true ] || [ "$CLEAN_ALL" = true ]; then
  echo -e "${BLUE}🐳 Cleaning Docker resources...${NC}"
  
  # Determine Docker Compose command
  if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
  elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
  else
    echo -e "${YELLOW}⚠ docker-compose not found, skipping Docker cleanup${NC}"
    DOCKER_COMPOSE=""
  fi
  
  if [ -n "$DOCKER_COMPOSE" ]; then
    cd "$DOCKER_DIR"
    
    if [ "$DRY_RUN" = true ]; then
      echo "Would stop: $($DOCKER_COMPOSE ps -q | wc -l) containers"
      echo "Would remove volumes for skillancer services"
    else
      echo "  Stopping containers..."
      $DOCKER_COMPOSE down --remove-orphans 2>/dev/null || true
      
      echo "  Removing volumes..."
      $DOCKER_COMPOSE down -v 2>/dev/null || true
    fi
    
    cd "$ROOT_DIR"
    echo -e "${GREEN}✓ Docker resources cleaned${NC}"
  fi
  echo ""
fi

# ===========================================
# Clean Generated Files
# ===========================================
echo -e "${BLUE}🗑️  Cleaning generated files...${NC}"

GENERATED=(
  "packages/database/src/generated"
  "packages/database/node_modules/.prisma"
)

for gen in "${GENERATED[@]}"; do
  if [ -e "$gen" ]; then
    if [ "$DRY_RUN" = true ]; then
      echo "Would delete: $gen"
    else
      rm -rf "$gen"
    fi
  fi
done

echo -e "${GREEN}✓ Generated files cleaned${NC}"
echo ""

# ===========================================
# Summary
# ===========================================
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              ✅ Cleanup Complete!                          ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ "$CLEAN_NODE_MODULES" = true ] || [ "$CLEAN_ALL" = true ]; then
  echo -e "${YELLOW}Run 'pnpm install' to reinstall dependencies${NC}"
fi

if [ "$CLEAN_DOCKER" = true ] || [ "$CLEAN_ALL" = true ]; then
  echo -e "${YELLOW}Run './scripts/setup.sh' to reinitialize Docker services${NC}"
fi

echo ""
