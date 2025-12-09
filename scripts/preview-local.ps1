#!/usr/bin/env pwsh
# =============================================================================
# Local Preview Environment Script (PowerShell)
# =============================================================================
# This script simulates a preview environment locally for testing.
# Usage: .\scripts\preview-local.ps1 [PR_NUMBER]
# =============================================================================

param(
    [string]$PrNumber = "local"
)

$ErrorActionPreference = "Stop"
$PreviewId = "pr-$PrNumber"

Write-Host "🚀 Setting up local preview environment: $PreviewId" -ForegroundColor Blue
Write-Host "==================================================" -ForegroundColor Blue

# =============================================================================
# Check Prerequisites
# =============================================================================
function Test-Prerequisites {
    Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow
    
    $missing = @()
    
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "node" }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { $missing += "pnpm" }
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { $missing += "docker" }
    
    if ($missing.Count -gt 0) {
        Write-Host "❌ Missing required tools: $($missing -join ', ')" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ All prerequisites met" -ForegroundColor Green
}

# =============================================================================
# Setup Database
# =============================================================================
function Initialize-Database {
    Write-Host "`n🗄️ Setting up preview database..." -ForegroundColor Yellow
    
    if ($env:NEON_API_KEY -and $env:NEON_PROJECT_ID) {
        Write-Host "Using Neon for preview database..."
        
        $headers = @{
            "Authorization" = "Bearer $env:NEON_API_KEY"
            "Content-Type" = "application/json"
        }
        
        $body = @{
            endpoints = @(@{ type = "read_write" })
            branch = @{
                name = "preview/$PreviewId"
                parent_id = "main"
            }
        } | ConvertTo-Json -Depth 3
        
        try {
            $response = Invoke-RestMethod -Uri "https://console.neon.tech/api/v2/projects/$env:NEON_PROJECT_ID/branches" `
                -Method Post -Headers $headers -Body $body
            
            $env:DATABASE_URL = $response.connection_uris[0].connection_uri
            Write-Host "✅ Neon branch created: preview/$PreviewId" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Failed to create Neon branch: $_" -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "Using local PostgreSQL..."
        
        docker compose -f docker-compose.preview.yml up -d postgres
        
        $env:DATABASE_URL = "postgresql://skillancer:skillancer@localhost:5432/skillancer_preview_$PrNumber"
        
        Write-Host "Waiting for PostgreSQL..."
        Start-Sleep -Seconds 5
        
        # Create database if it doesn't exist
        docker exec skillancer-postgres psql -U skillancer -c "CREATE DATABASE skillancer_preview_$PrNumber;" 2>$null
        
        Write-Host "✅ Local PostgreSQL ready" -ForegroundColor Green
    }
    
    # Run migrations
    Write-Host "Running migrations..."
    pnpm db:migrate:deploy
    
    Write-Host "✅ Database setup complete" -ForegroundColor Green
}

# =============================================================================
# Setup Redis
# =============================================================================
function Initialize-Redis {
    Write-Host "`n📦 Setting up Redis..." -ForegroundColor Yellow
    
    if ($env:PREVIEW_REDIS_URL) {
        $env:REDIS_URL = $env:PREVIEW_REDIS_URL
        Write-Host "Using remote Redis"
    }
    else {
        docker compose -f docker-compose.preview.yml up -d redis
        $env:REDIS_URL = "redis://localhost:6379"
        Write-Host "Using local Redis"
    }
    
    Write-Host "✅ Redis ready" -ForegroundColor Green
}

# =============================================================================
# Build Services
# =============================================================================
function Build-Services {
    Write-Host "`n🔨 Building services..." -ForegroundColor Yellow
    
    pnpm turbo run build --filter="./services/*" --filter="./packages/*"
    
    Write-Host "✅ Services built" -ForegroundColor Green
}

# =============================================================================
# Start Services
# =============================================================================
function Start-Services {
    Write-Host "`n🚀 Starting services..." -ForegroundColor Yellow
    
    $env:NODE_ENV = "preview"
    $env:LOG_LEVEL = "debug"
    $env:PREVIEW_MODE = "true"
    $env:PR_NUMBER = $PrNumber
    
    # Start API Gateway
    Write-Host "Starting API Gateway..."
    Start-Process -FilePath "node" -ArgumentList "dist/main.js" -WorkingDirectory "services/api-gateway" -NoNewWindow
    
    Start-Sleep -Seconds 5
    
    Write-Host "✅ Services started" -ForegroundColor Green
}

# =============================================================================
# Start Web Apps
# =============================================================================
function Start-WebApps {
    Write-Host "`n🌐 Starting web apps..." -ForegroundColor Yellow
    
    $env:NEXT_PUBLIC_API_URL = "http://localhost:3000"
    $env:NEXT_PUBLIC_PREVIEW_MODE = "true"
    $env:NEXT_PUBLIC_PR_NUMBER = $PrNumber
    
    # Start web apps in development mode
    Start-Process -FilePath "pnpm" -ArgumentList "turbo", "run", "dev", "--filter=./apps/web*", "--parallel" -NoNewWindow
    
    Start-Sleep -Seconds 10
    
    Write-Host "✅ Web apps starting..." -ForegroundColor Green
}

# =============================================================================
# Health Check
# =============================================================================
function Test-Health {
    Write-Host "`n🏥 Running health checks..." -ForegroundColor Yellow
    
    $maxRetries = 10
    $retryCount = 0
    
    while ($retryCount -lt $maxRetries) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ API Gateway is healthy" -ForegroundColor Green
                return $true
            }
        }
        catch {
            $retryCount++
            Write-Host "Waiting for services... (attempt $retryCount/$maxRetries)"
            Start-Sleep -Seconds 5
        }
    }
    
    Write-Host "❌ Health check failed" -ForegroundColor Red
    return $false
}

# =============================================================================
# Print Summary
# =============================================================================
function Show-Summary {
    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host "🎉 Preview Environment Ready!" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Preview ID: $PreviewId" -ForegroundColor Blue
    Write-Host ""
    Write-Host "📚 Services:"
    Write-Host "  - API Gateway:  http://localhost:3000"
    Write-Host "  - Web:          http://localhost:3001"
    Write-Host "  - Web Market:   http://localhost:3002"
    Write-Host "  - Web Cockpit:  http://localhost:3003"
    Write-Host "  - Web SkillPod: http://localhost:3004"
    Write-Host ""
    Write-Host "🔗 Useful Commands:"
    Write-Host "  - View logs:    docker compose -f docker-compose.preview.yml logs -f"
    Write-Host "  - Stop preview: .\scripts\preview-cleanup.ps1 $PrNumber"
    Write-Host ""
    Write-Host "Press Ctrl+C to stop the preview environment" -ForegroundColor Yellow
}

# =============================================================================
# Main
# =============================================================================
try {
    Test-Prerequisites
    Initialize-Database
    Initialize-Redis
    Build-Services
    Start-Services
    Start-WebApps
    Test-Health
    Show-Summary
    
    # Keep script running
    while ($true) {
        Start-Sleep -Seconds 60
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
finally {
    Write-Host "`n🧹 Cleaning up..." -ForegroundColor Yellow
    
    # Cleanup logic
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    docker compose -f docker-compose.preview.yml down 2>$null
    
    Write-Host "✅ Cleanup complete" -ForegroundColor Green
}
