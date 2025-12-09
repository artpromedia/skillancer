#!/bin/bash

# ===========================================
# Skillancer Development Server Script
# ===========================================
# Starts development servers with optional filtering

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
FILTER=""
SKIP_DOCKER=false
WITH_TOOLS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --filter=*)
      FILTER="${1#*=}"
      shift
      ;;
    -f)
      FILTER="$2"
      shift 2
      ;;
    --skip-docker)
      SKIP_DOCKER=true
      shift
      ;;
    --with-tools)
      WITH_TOOLS=true
      shift
      ;;
    -h|--help)
      echo "Usage: dev.sh [options]"
      echo ""
      echo "Options:"
      echo "  --filter=<pattern>  Filter packages to run (e.g., --filter=web)"
      echo "  -f <pattern>        Same as --filter"
      echo "  --skip-docker       Don't start Docker services"
      echo "  --with-tools        Start with optional tools (pgAdmin, Redis Commander)"
      echo "  -h, --help          Show this help"
      echo ""
      echo "Examples:"
      echo "  ./scripts/dev.sh                    # Start all services"
      echo "  ./scripts/dev.sh --filter=web       # Start only web app"
      echo "  ./scripts/dev.sh -f 'api-*'         # Start all API services"
      echo "  ./scripts/dev.sh --with-tools       # Start with admin tools"
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
echo "║           🚀 Skillancer Development Server                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ===========================================
# Determine Docker Compose command
# ===========================================
if command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
else
  echo -e "${RED}❌ docker-compose is not installed${NC}"
  exit 1
fi

# ===========================================
# Start Docker Services
# ===========================================
if [ "$SKIP_DOCKER" = false ]; then
  echo -e "${BLUE}🐳 Starting Docker services...${NC}"
  cd "$DOCKER_DIR"
  
  if [ "$WITH_TOOLS" = true ]; then
    $DOCKER_COMPOSE --profile tools up -d
    echo -e "${GREEN}✓ Docker services started (with tools)${NC}"
  else
    $DOCKER_COMPOSE up -d postgres redis mailhog localstack
    echo -e "${GREEN}✓ Docker services started${NC}"
  fi
  
  # Wait for services
  echo ""
  echo "Waiting for services..."
  
  # Wait for PostgreSQL
  echo -n "  PostgreSQL: "
  RETRY=0
  until $DOCKER_COMPOSE exec -T postgres pg_isready -U skillancer -d skillancer_dev > /dev/null 2>&1; do
    echo -n "."
    sleep 1
    RETRY=$((RETRY+1))
    if [ $RETRY -gt 30 ]; then
      echo -e " ${RED}Timeout${NC}"
      exit 1
    fi
  done
  echo -e " ${GREEN}Ready${NC}"
  
  # Wait for Redis
  echo -n "  Redis: "
  RETRY=0
  until $DOCKER_COMPOSE exec -T redis redis-cli ping > /dev/null 2>&1; do
    echo -n "."
    sleep 1
    RETRY=$((RETRY+1))
    if [ $RETRY -gt 30 ]; then
      echo -e " ${RED}Timeout${NC}"
      exit 1
    fi
  done
  echo -e " ${GREEN}Ready${NC}"
  
  cd "$ROOT_DIR"
  echo ""
fi

# ===========================================
# Start Development Servers
# ===========================================
echo -e "${BLUE}🔥 Starting development servers...${NC}"
echo ""

if [ -n "$FILTER" ]; then
  echo -e "${YELLOW}Filter: $FILTER${NC}"
  echo ""
  pnpm dev --filter="$FILTER"
else
  pnpm dev
fi
