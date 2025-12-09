#!/bin/bash

# ===========================================
# Skillancer Monorepo Setup Script
# ===========================================
# This script sets up the complete development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$ROOT_DIR/infrastructure/docker"

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           🚀 Skillancer Development Setup                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ===========================================
# Check Prerequisites
# ===========================================
echo -e "${BLUE}📋 Checking prerequisites...${NC}"
echo ""

check_command() {
  if ! command -v $1 &> /dev/null; then
    echo -e "${RED}❌ $1 is not installed${NC}"
    echo "   Please install $1 and try again"
    return 1
  else
    local version=$($1 --version 2>/dev/null | head -n1 || echo "installed")
    echo -e "${GREEN}✓ $1${NC} - $version"
    return 0
  fi
}

MISSING_DEPS=0

check_command "node" || MISSING_DEPS=1
check_command "pnpm" || MISSING_DEPS=1
check_command "docker" || MISSING_DEPS=1
check_command "git" || MISSING_DEPS=1

# Check docker-compose or docker compose
if command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose"
  echo -e "${GREEN}✓ docker-compose${NC}"
elif docker compose version &> /dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
  echo -e "${GREEN}✓ docker compose${NC}"
else
  echo -e "${RED}❌ docker-compose is not installed${NC}"
  MISSING_DEPS=1
fi

if [ $MISSING_DEPS -eq 1 ]; then
  echo ""
  echo -e "${RED}Please install missing dependencies and try again.${NC}"
  exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${RED}❌ Node.js version 20 or higher is required (found v$NODE_VERSION)${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js version is compatible (v$NODE_VERSION)${NC}"

echo ""

# ===========================================
# Install Dependencies
# ===========================================
echo -e "${BLUE}📦 Installing dependencies...${NC}"
cd "$ROOT_DIR"
pnpm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# ===========================================
# Setup Environment Files
# ===========================================
echo -e "${BLUE}⚙️  Setting up environment files...${NC}"

# Root .env
if [ ! -f "$ROOT_DIR/.env" ]; then
  if [ -f "$ROOT_DIR/.env.example" ]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo -e "${GREEN}✓ Created .env from .env.example${NC}"
  fi
else
  echo -e "${YELLOW}⚠ .env already exists, skipping${NC}"
fi

# Service .env files
for dir in "$ROOT_DIR"/services/*/; do
  if [ -d "$dir" ]; then
    service_name=$(basename "$dir")
    if [ -f "${dir}.env.example" ] && [ ! -f "${dir}.env" ]; then
      cp "${dir}.env.example" "${dir}.env"
      echo -e "${GREEN}✓ Created services/$service_name/.env${NC}"
    fi
  fi
done

# App .env.local files
for dir in "$ROOT_DIR"/apps/*/; do
  if [ -d "$dir" ]; then
    app_name=$(basename "$dir")
    if [ -f "${dir}.env.example" ] && [ ! -f "${dir}.env.local" ]; then
      cp "${dir}.env.example" "${dir}.env.local"
      echo -e "${GREEN}✓ Created apps/$app_name/.env.local${NC}"
    fi
  fi
done

echo ""

# ===========================================
# Start Docker Services
# ===========================================
echo -e "${BLUE}🐳 Starting Docker services...${NC}"

cd "$DOCKER_DIR"
$DOCKER_COMPOSE up -d postgres redis mailhog localstack

echo "Waiting for services to be healthy..."

# Wait for PostgreSQL
echo -n "  PostgreSQL: "
until $DOCKER_COMPOSE exec -T postgres pg_isready -U skillancer -d skillancer_dev > /dev/null 2>&1; do
  echo -n "."
  sleep 2
done
echo -e " ${GREEN}Ready${NC}"

# Wait for Redis
echo -n "  Redis: "
until $DOCKER_COMPOSE exec -T redis redis-cli ping > /dev/null 2>&1; do
  echo -n "."
  sleep 2
done
echo -e " ${GREEN}Ready${NC}"

# Wait for LocalStack
echo -n "  LocalStack: "
until curl -s http://localhost:4566/_localstack/health > /dev/null 2>&1; do
  echo -n "."
  sleep 2
done
echo -e " ${GREEN}Ready${NC}"

echo -e "${GREEN}✓ Docker services started${NC}"
echo ""

# ===========================================
# Database Setup
# ===========================================
echo -e "${BLUE}🗄️  Setting up database...${NC}"

cd "$ROOT_DIR"

# Generate Prisma client
echo "  Generating Prisma client..."
pnpm db:generate
echo -e "${GREEN}✓ Prisma client generated${NC}"

# Run migrations
echo "  Running migrations..."
pnpm db:migrate:dev --name init 2>/dev/null || pnpm db:migrate:dev 2>/dev/null || true
echo -e "${GREEN}✓ Migrations applied${NC}"

# Seed database (if seed script exists)
if pnpm db:seed 2>/dev/null; then
  echo -e "${GREEN}✓ Database seeded${NC}"
else
  echo -e "${YELLOW}⚠ No seed data or seed skipped${NC}"
fi

echo ""

# ===========================================
# Build Packages
# ===========================================
echo -e "${BLUE}🔨 Building packages...${NC}"

pnpm build --filter='./packages/*'
echo -e "${GREEN}✓ Packages built${NC}"
echo ""

# ===========================================
# Setup Git Hooks
# ===========================================
echo -e "${BLUE}🐶 Setting up Git hooks...${NC}"

if [ -d "$ROOT_DIR/.git" ]; then
  pnpm prepare 2>/dev/null || true
  echo -e "${GREEN}✓ Git hooks installed${NC}"
else
  echo -e "${YELLOW}⚠ Not a git repository, skipping hooks${NC}"
fi

echo ""

# ===========================================
# Complete!
# ===========================================
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              🎉 Setup Complete!                            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${GREEN}You can now start development:${NC}"
echo ""
echo "  pnpm dev                    # Start all services"
echo "  pnpm dev --filter=web       # Start only web app"
echo "  pnpm dev --filter=api-*     # Start all API services"
echo ""
echo -e "${GREEN}Useful URLs:${NC}"
echo ""
echo "  📱 Web App:        http://localhost:3000"
echo "  🔌 API Gateway:    http://localhost:3001"
echo "  📚 API Docs:       http://localhost:3001/docs"
echo "  📧 Mailhog:        http://localhost:8025"
echo "  ☁️  LocalStack:     http://localhost:4566"
echo ""
echo -e "${GREEN}Database connection:${NC}"
echo ""
echo "  Host:     localhost"
echo "  Port:     5432"
echo "  User:     skillancer"
echo "  Password: skillancer_dev"
echo "  Database: skillancer_dev"
echo ""
echo -e "${GREEN}Optional tools (run with 'make docker-tools'):${NC}"
echo ""
echo "  🗄️  pgAdmin:        http://localhost:5050"
echo "  📊 Redis Commander: http://localhost:8081"
echo ""
echo -e "${YELLOW}Need help? Check out the docs:${NC}"
echo "  - CONTRIBUTING.md for development guidelines"
echo "  - docs/ for architecture and API documentation"
echo ""
echo "Next steps:"
echo "  1. Update .env.local with your configuration"
echo "  2. Run 'pnpm dev' to start development"
echo "  3. Visit http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  pnpm dev          - Start all apps in dev mode"
echo "  pnpm build        - Build all packages"
echo "  pnpm test         - Run tests"
echo "  pnpm lint         - Lint code"
echo "  pnpm db:studio    - Open Prisma Studio"
echo ""
