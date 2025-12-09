#!/bin/bash

# ===========================================
# Skillancer Database Reset Script
# ===========================================
# Resets the database and re-runs migrations/seeds

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
SKIP_SEED=false
FORCE=false
TEST_DB=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-seed|-s)
      SKIP_SEED=true
      shift
      ;;
    --force|-f)
      FORCE=true
      shift
      ;;
    --test)
      TEST_DB=true
      shift
      ;;
    -h|--help)
      echo "Usage: reset-db.sh [options]"
      echo ""
      echo "Options:"
      echo "  --skip-seed, -s  Skip running seed scripts"
      echo "  --force, -f      Skip confirmation prompt"
      echo "  --test           Reset test database instead of dev"
      echo "  -h, --help       Show this help"
      echo ""
      echo "Examples:"
      echo "  ./scripts/reset-db.sh           # Reset dev database"
      echo "  ./scripts/reset-db.sh --test    # Reset test database"
      echo "  ./scripts/reset-db.sh -f -s     # Force reset, skip seeding"
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
echo "║              🗄️  Database Reset                            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Set database name
if [ "$TEST_DB" = true ]; then
  DB_NAME="skillancer_test"
  echo -e "${YELLOW}Target: Test Database (skillancer_test)${NC}"
else
  DB_NAME="skillancer_dev"
  echo -e "${YELLOW}Target: Development Database (skillancer_dev)${NC}"
fi
echo ""

# ===========================================
# Confirmation
# ===========================================
if [ "$FORCE" = false ]; then
  echo -e "${RED}⚠️  WARNING: This will delete all data in $DB_NAME!${NC}"
  echo ""
  read -p "Are you sure you want to continue? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
  echo ""
fi

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
# Check PostgreSQL is running
# ===========================================
echo -e "${BLUE}🔍 Checking PostgreSQL...${NC}"
cd "$DOCKER_DIR"

if ! $DOCKER_COMPOSE ps postgres | grep -q "Up"; then
  echo "Starting PostgreSQL..."
  $DOCKER_COMPOSE up -d postgres
  
  echo -n "Waiting for PostgreSQL: "
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
fi

echo -e "${GREEN}✓ PostgreSQL is running${NC}"
echo ""

# ===========================================
# Drop and Recreate Database
# ===========================================
echo -e "${BLUE}🗑️  Dropping database $DB_NAME...${NC}"

$DOCKER_COMPOSE exec -T postgres psql -U skillancer -d postgres -c "
  SELECT pg_terminate_backend(pg_stat_activity.pid)
  FROM pg_stat_activity
  WHERE pg_stat_activity.datname = '$DB_NAME'
    AND pid <> pg_backend_pid();
" > /dev/null 2>&1 || true

$DOCKER_COMPOSE exec -T postgres psql -U skillancer -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" > /dev/null

echo -e "${GREEN}✓ Database dropped${NC}"

echo -e "${BLUE}📦 Creating database $DB_NAME...${NC}"

$DOCKER_COMPOSE exec -T postgres psql -U skillancer -d postgres -c "CREATE DATABASE $DB_NAME;" > /dev/null

# Add extensions
$DOCKER_COMPOSE exec -T postgres psql -U skillancer -d $DB_NAME -c "
  CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
  CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";
  CREATE EXTENSION IF NOT EXISTS \"unaccent\";
" > /dev/null

echo -e "${GREEN}✓ Database created with extensions${NC}"
echo ""

cd "$ROOT_DIR"

# ===========================================
# Run Migrations
# ===========================================
echo -e "${BLUE}🔄 Running migrations...${NC}"

if [ "$TEST_DB" = true ]; then
  DATABASE_URL="postgresql://skillancer:skillancer_dev@localhost:5432/skillancer_test" pnpm db:migrate:deploy
else
  pnpm db:migrate:deploy 2>/dev/null || pnpm db:migrate:dev 2>/dev/null || true
fi

echo -e "${GREEN}✓ Migrations applied${NC}"
echo ""

# ===========================================
# Generate Prisma Client
# ===========================================
echo -e "${BLUE}🔧 Regenerating Prisma client...${NC}"
pnpm db:generate
echo -e "${GREEN}✓ Prisma client generated${NC}"
echo ""

# ===========================================
# Seed Database
# ===========================================
if [ "$SKIP_SEED" = false ]; then
  echo -e "${BLUE}🌱 Seeding database...${NC}"
  
  if [ "$TEST_DB" = true ]; then
    DATABASE_URL="postgresql://skillancer:skillancer_dev@localhost:5432/skillancer_test" pnpm db:seed 2>/dev/null || echo -e "${YELLOW}⚠ No seed data or seed skipped${NC}"
  else
    pnpm db:seed 2>/dev/null || echo -e "${YELLOW}⚠ No seed data or seed skipped${NC}"
  fi
  
  echo ""
fi

# ===========================================
# Summary
# ===========================================
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              ✅ Database Reset Complete!                   ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo "Database: $DB_NAME"
echo "Host:     localhost:5432"
echo "User:     skillancer"
echo ""

if [ "$TEST_DB" = false ]; then
  echo "Connection string:"
  echo "  postgresql://skillancer:skillancer_dev@localhost:5432/skillancer_dev"
fi
echo ""
