#!/bin/bash

# Skillancer Monorepo Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up Skillancer development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js >= 20.0.0${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js version must be >= 20.0.0. Current: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠️  pnpm is not installed. Installing...${NC}"
    npm install -g pnpm
fi
echo -e "${GREEN}✅ pnpm $(pnpm -v)${NC}"

# Check Docker (optional but recommended)
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker $(docker -v | cut -d' ' -f3 | cut -d',' -f1)${NC}"
else
    echo -e "${YELLOW}⚠️  Docker is not installed. Local database will not be available.${NC}"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Copy environment files
echo ""
echo "⚙️  Setting up environment files..."
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo -e "${GREEN}✅ Created .env.local from .env.example${NC}"
else
    echo -e "${YELLOW}⚠️  .env.local already exists, skipping${NC}"
fi

# Start Docker services (if available)
if command -v docker &> /dev/null; then
    echo ""
    echo "🐳 Starting Docker services..."
    if [ -f infrastructure/docker/docker-compose.yml ]; then
        docker-compose -f infrastructure/docker/docker-compose.yml up -d
        echo -e "${GREEN}✅ Docker services started${NC}"
    fi
fi

# Generate Prisma client
echo ""
echo "🗄️  Setting up database..."
if [ -f packages/database/prisma/schema.prisma ]; then
    pnpm db:generate
    echo -e "${GREEN}✅ Prisma client generated${NC}"
else
    echo -e "${YELLOW}⚠️  Prisma schema not found, skipping${NC}"
fi

# Build packages
echo ""
echo "🔨 Building packages..."
pnpm build --filter="@skillancer/config" --filter="@skillancer/types" --filter="@skillancer/utils"

# Setup husky
echo ""
echo "🐶 Setting up Git hooks..."
if [ -d .git ]; then
    pnpm prepare
    echo -e "${GREEN}✅ Git hooks installed${NC}"
fi

# Done
echo ""
echo "=========================================="
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo "=========================================="
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
