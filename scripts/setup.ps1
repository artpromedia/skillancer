# Skillancer Monorepo Setup Script (PowerShell)
# This script sets up the development environment on Windows

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 Setting up Skillancer development environment..." -ForegroundColor Cyan

# Check prerequisites
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js version
try {
    $nodeVersion = (node -v) -replace 'v', ''
    $majorVersion = [int]($nodeVersion.Split('.')[0])
    if ($majorVersion -lt 20) {
        Write-Host "❌ Node.js version must be >= 20.0.0. Current: v$nodeVersion" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Node.js v$nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js >= 20.0.0" -ForegroundColor Red
    exit 1
}

# Check pnpm
try {
    $pnpmVersion = pnpm -v
    Write-Host "✅ pnpm $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  pnpm is not installed. Installing..." -ForegroundColor Yellow
    npm install -g pnpm
    $pnpmVersion = pnpm -v
    Write-Host "✅ pnpm $pnpmVersion installed" -ForegroundColor Green
}

# Check Docker (optional)
try {
    $dockerVersion = (docker -v) -replace 'Docker version ', '' -replace ',.*', ''
    Write-Host "✅ Docker $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Docker is not installed. Local database will not be available." -ForegroundColor Yellow
}

# Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
pnpm install

# Copy environment files
Write-Host "`n⚙️  Setting up environment files..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host "✅ Created .env.local from .env.example" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env.local already exists, skipping" -ForegroundColor Yellow
}

# Start Docker services (if available)
try {
    $null = Get-Command docker -ErrorAction Stop
    Write-Host "`n🐳 Starting Docker services..." -ForegroundColor Yellow
    if (Test-Path "infrastructure/docker/docker-compose.yml") {
        docker-compose -f infrastructure/docker/docker-compose.yml up -d
        Write-Host "✅ Docker services started" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Docker not available, skipping services" -ForegroundColor Yellow
}

# Generate Prisma client
Write-Host "`n🗄️  Setting up database..." -ForegroundColor Yellow
if (Test-Path "packages/database/prisma/schema.prisma") {
    pnpm db:generate
    Write-Host "✅ Prisma client generated" -ForegroundColor Green
} else {
    Write-Host "⚠️  Prisma schema not found, skipping" -ForegroundColor Yellow
}

# Build packages
Write-Host "`n🔨 Building packages..." -ForegroundColor Yellow
pnpm build --filter="@skillancer/config" --filter="@skillancer/types" --filter="@skillancer/utils"

# Setup husky
Write-Host "`n🐶 Setting up Git hooks..." -ForegroundColor Yellow
if (Test-Path ".git") {
    pnpm prepare
    Write-Host "✅ Git hooks installed" -ForegroundColor Green
}

# Done
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host "==========================================`n" -ForegroundColor Cyan

Write-Host "Next steps:"
Write-Host "  1. Update .env.local with your configuration"
Write-Host "  2. Run 'pnpm dev' to start development"
Write-Host "  3. Visit http://localhost:3000"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  pnpm dev          - Start all apps in dev mode"
Write-Host "  pnpm build        - Build all packages"
Write-Host "  pnpm test         - Run tests"
Write-Host "  pnpm lint         - Lint code"
Write-Host "  pnpm db:studio    - Open Prisma Studio"
Write-Host ""
