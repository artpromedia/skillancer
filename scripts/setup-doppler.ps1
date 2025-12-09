# =============================================================================
# Doppler Setup Script (PowerShell)
# Configures Doppler for local development secrets management
# =============================================================================

param(
    [string]$Environment = "dev"
)

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_NAME = "skillancer"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║         Skillancer Doppler Setup                           ║" -ForegroundColor Blue  
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# Check if Doppler CLI is installed
$dopplerInstalled = $null
try {
    $dopplerInstalled = Get-Command doppler -ErrorAction SilentlyContinue
} catch {}

if (-not $dopplerInstalled) {
    Write-Host "Doppler CLI not found. Installing..." -ForegroundColor Yellow
    
    # Check for package managers
    $scoopInstalled = $null
    $chocoInstalled = $null
    
    try { $scoopInstalled = Get-Command scoop -ErrorAction SilentlyContinue } catch {}
    try { $chocoInstalled = Get-Command choco -ErrorAction SilentlyContinue } catch {}
    
    if ($scoopInstalled) {
        Write-Host "Installing via Scoop..." -ForegroundColor Blue
        scoop bucket add doppler https://github.com/DopplerHQ/scoop-doppler.git
        scoop install doppler
    } elseif ($chocoInstalled) {
        Write-Host "Installing via Chocolatey..." -ForegroundColor Blue
        choco install doppler -y
    } else {
        Write-Host "No package manager found. Please install Doppler manually:" -ForegroundColor Red
        Write-Host "  Option 1: Install Scoop, then run: scoop install doppler" -ForegroundColor Yellow
        Write-Host "  Option 2: Install Chocolatey, then run: choco install doppler" -ForegroundColor Yellow
        Write-Host "  Option 3: Download from https://docs.doppler.com/docs/install-cli" -ForegroundColor Yellow
        exit 1
    }
    
    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Host "✓ Doppler CLI installed successfully" -ForegroundColor Green
} else {
    $version = doppler --version 2>&1 | Select-Object -First 1
    Write-Host "✓ Doppler CLI found: $version" -ForegroundColor Green
}

Write-Host ""

# Check if user is logged in
$loggedIn = $false
try {
    $null = doppler me 2>$null
    $loggedIn = $true
} catch {}

if (-not $loggedIn) {
    Write-Host "You are not logged in to Doppler." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Opening Doppler login..." -ForegroundColor Blue
    doppler login
    Write-Host ""
    Write-Host "✓ Successfully logged in to Doppler" -ForegroundColor Green
} else {
    try {
        $userInfo = doppler me --json 2>$null | ConvertFrom-Json
        Write-Host "✓ Already logged in as: $($userInfo.email)" -ForegroundColor Green
    } catch {
        Write-Host "✓ Already logged in to Doppler" -ForegroundColor Green
    }
}

Write-Host ""

# Check for existing configuration
if (Test-Path "doppler.yaml") {
    Write-Host "Found existing doppler.yaml configuration." -ForegroundColor Yellow
    $reconfigure = Read-Host "Do you want to reconfigure? (y/N)"
    if ($reconfigure -ne "y" -and $reconfigure -ne "Y") {
        Write-Host "Using existing configuration." -ForegroundColor Green
        doppler setup --no-interactive
        Write-Host ""
        Write-Host "✓ Doppler setup complete!" -ForegroundColor Green
        exit 0
    }
}

# Select environment
Write-Host "Available environments:" -ForegroundColor Blue
Write-Host "  1) dev     - Development (local development)"
Write-Host "  2) staging - Staging (pre-production testing)"
Write-Host "  3) prod    - Production (live environment)"
Write-Host ""
$envChoice = Read-Host "Select environment [1-3] (default: 1)"

$CONFIG = switch ($envChoice) {
    "2" { "staging" }
    "3" { "prod" }
    default { "dev" }
}

Write-Host ""
Write-Host "Configuring Doppler for $PROJECT_NAME ($CONFIG)..." -ForegroundColor Blue

# Try to setup the project
try {
    doppler setup --project $PROJECT_NAME --config $CONFIG 2>$null
    Write-Host "✓ Project configured successfully" -ForegroundColor Green
} catch {
    Write-Host "Project '$PROJECT_NAME' not found in Doppler." -ForegroundColor Yellow
    Write-Host ""
    $createProject = Read-Host "Would you like to create it? (y/N)"
    
    if ($createProject -eq "y" -or $createProject -eq "Y") {
        Write-Host "Creating Doppler project '$PROJECT_NAME'..." -ForegroundColor Blue
        doppler projects create $PROJECT_NAME --description "Skillancer application secrets"
        
        Write-Host "Creating environment configs..." -ForegroundColor Blue
        doppler configs create --project $PROJECT_NAME --environment development --name dev
        doppler configs create --project $PROJECT_NAME --environment staging --name staging
        doppler configs create --project $PROJECT_NAME --environment production --name prod
        
        doppler setup --project $PROJECT_NAME --config $CONFIG
        Write-Host "✓ Project created and configured" -ForegroundColor Green
    } else {
        Write-Host "Please ask your team lead to create the Doppler project." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""

# Create doppler.yaml if it doesn't exist
if (-not (Test-Path "doppler.yaml")) {
    Write-Host "Creating doppler.yaml configuration file..." -ForegroundColor Blue
    @"
# Doppler configuration for Skillancer
# See: https://docs.doppler.com/docs/doppler-yaml
setup:
  project: $PROJECT_NAME
  config: $CONFIG
"@ | Set-Content -Path "doppler.yaml"
    Write-Host "✓ Created doppler.yaml" -ForegroundColor Green
}

Write-Host ""

# Verify configuration
Write-Host "Verifying configuration..." -ForegroundColor Blue
try {
    $secrets = doppler secrets --only-names 2>$null
    $secretCount = ($secrets | Measure-Object -Line).Lines
    Write-Host "✓ Configuration verified ($secretCount secrets available)" -ForegroundColor Green
} catch {
    Write-Host "⚠ No secrets found. Please add secrets in Doppler dashboard." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         Doppler Setup Complete!                            ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Usage:" -ForegroundColor Blue
Write-Host ""
Write-Host "  Run application with secrets:"
Write-Host "    doppler run -- pnpm dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Run specific app:"
Write-Host "    doppler run -- pnpm --filter @skillancer/api dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "  View secrets (names only):"
Write-Host "    doppler secrets --only-names" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Download secrets to .env file (for debugging only):"
Write-Host "    doppler secrets download --no-file --format env > .env.local" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Switch environment:"
Write-Host "    doppler setup --config staging" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠ Never commit .env files with real secrets!" -ForegroundColor Red
Write-Host ""
