# PowerShell equivalent for Windows users
# Guided Deployment - Hetzner + Cloudflare
# Usage: .\scripts\deploy-guided.ps1

$ErrorActionPreference = "Stop"
$ROOT_DIR = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $ROOT_DIR) { $ROOT_DIR = (Get-Location).Path }

function Write-Banner {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  Skillancer — Guided Deployment                             ║" -ForegroundColor Cyan
    Write-Host "║  Hetzner Cloud + Cloudflare                                 ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-StepHeader($Num, $Title) {
    Write-Host ""
    Write-Host ("━" * 60) -ForegroundColor Blue
    Write-Host "  Step $Num/10: $Title" -ForegroundColor White
    Write-Host ("━" * 60) -ForegroundColor Blue
    Write-Host ""
}

function Write-Info($msg) { Write-Host "  ℹ  $msg" -ForegroundColor Blue }
function Write-Ok($msg) { Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠  $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "  ❌ $msg" -ForegroundColor Red }

function Confirm-Step($msg = "Continue?") {
    $reply = Read-Host "  ? $msg [Y/n]"
    return ($reply -eq "" -or $reply -match "^[Yy]")
}

function Get-SecureInput($msg) {
    $secure = Read-Host "  ? $msg" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}

# Step 1: Prerequisites
function Step-1 {
    Write-StepHeader 1 "Prerequisites Check"

    $tools = @(
        @{ Name = "terraform"; Hint = "https://terraform.io/downloads or choco install terraform" },
        @{ Name = "kubectl"; Hint = "choco install kubernetes-cli" },
        @{ Name = "ssh"; Hint = "Should be pre-installed on Windows 10+" },
        @{ Name = "git"; Hint = "choco install git" }
    )

    $missing = 0
    foreach ($tool in $tools) {
        if (Get-Command $tool.Name -ErrorAction SilentlyContinue) {
            Write-Ok "$($tool.Name) found"
        } else {
            Write-Err "$($tool.Name) not found — $($tool.Hint)"
            $missing++
        }
    }

    if ($missing -gt 0) {
        Write-Err "$missing tools missing. Install them and re-run."
        exit 1
    }
    Write-Ok "All prerequisites met!"
}

# Step 2: Accounts
function Step-2 {
    Write-StepHeader 2 "Account Setup"

    Write-Host "  You need accounts for:" -ForegroundColor White
    Write-Host "    1. Hetzner Cloud — https://console.hetzner.cloud" -ForegroundColor Gray
    Write-Host "    2. Cloudflare    — https://dash.cloudflare.com" -ForegroundColor Gray
    Write-Host "    3. GitHub        — https://github.com" -ForegroundColor Gray
    Write-Host ""
    Write-Info "Hetzner: Create project 'Skillancer' → Security → API Tokens → Generate"
    Write-Info "Cloudflare: Add domain → Profile → API Tokens → Create"
    Write-Host "    Permissions: Zone DNS Edit, Zone Settings Edit, Firewall Edit, Tunnel Edit, R2 Edit" -ForegroundColor Gray
    Write-Host ""

    if (-not (Confirm-Step "Do you have all accounts and tokens ready?")) {
        Write-Warn "Set up accounts, then re-run"
        exit 0
    }
}

# Step 3: SSH Key
function Step-3 {
    Write-StepHeader 3 "SSH Key Setup"

    $sshKey = "$env:USERPROFILE\.ssh\id_ed25519"
    if (Test-Path "$sshKey.pub") {
        Write-Ok "SSH key found: $sshKey.pub"
    } else {
        Write-Info "Generating ED25519 key..."
        ssh-keygen -t ed25519 -C "skillancer-deploy" -f $sshKey -N '""'
        Write-Ok "SSH key generated"
    }
}

# Step 4: Configure Hetzner
function Step-4 {
    Write-StepHeader 4 "Configure Hetzner Infrastructure"

    $tfDir = Join-Path $ROOT_DIR "infrastructure\hetzner\terraform"
    $tfvars = Join-Path $tfDir "terraform.tfvars"

    $token = Get-SecureInput "Hetzner Cloud API Token"
    $domain = Read-Host "  ? Domain [skillancer.com]"
    if (-not $domain) { $domain = "skillancer.com" }
    $env_ = Read-Host "  ? Environment [production]"
    if (-not $env_) { $env_ = "production" }
    $location = Read-Host "  ? Location (fsn1/nbg1/hel1) [fsn1]"
    if (-not $location) { $location = "fsn1" }
    $workers = Read-Host "  ? Worker count [3]"
    if (-not $workers) { $workers = "3" }

    @"
hcloud_token        = "$token"
domain              = "$domain"
environment         = "$env_"
location            = "$location"
worker_count        = $workers
ssh_public_key_path = "~/.ssh/id_ed25519.pub"
control_plane_type  = "cx31"
worker_type         = "cx31"
db_server_type      = "cx31"
redis_server_type   = "cx21"
enable_self_hosted_db = true
"@ | Set-Content $tfvars -Encoding UTF8

    Write-Ok "terraform.tfvars written"

    Push-Location $tfDir
    terraform init -input=false
    Pop-Location
    Write-Ok "Terraform initialized"
}

# Step 5: Configure Cloudflare
function Step-5 {
    Write-StepHeader 5 "Configure Cloudflare"

    $tfDir = Join-Path $ROOT_DIR "infrastructure\cloudflare\terraform"
    $tfvars = Join-Path $tfDir "terraform.tfvars"

    $cfToken = Get-SecureInput "Cloudflare API Token"
    $cfAccount = Read-Host "  ? Cloudflare Account ID"
    $cfDomain = Read-Host "  ? Domain [skillancer.com]"
    if (-not $cfDomain) { $cfDomain = "skillancer.com" }
    $cfTunnel = Read-Host "  ? Enable Tunnel? [true]"
    if (-not $cfTunnel) { $cfTunnel = "true" }
    $cfR2 = Read-Host "  ? Enable R2 Storage? [true]"
    if (-not $cfR2) { $cfR2 = "true" }
    $cfEmail = Read-Host "  ? Notification email [devops@skillancer.com]"
    if (-not $cfEmail) { $cfEmail = "devops@skillancer.com" }

    @"
cloudflare_api_token  = "$cfToken"
cloudflare_account_id = "$cfAccount"
domain                = "$cfDomain"
environment           = "production"
enable_tunnel         = $cfTunnel
enable_r2             = $cfR2
enable_waf            = true
notification_email    = "$cfEmail"
"@ | Set-Content $tfvars -Encoding UTF8

    Write-Ok "terraform.tfvars written"

    Push-Location $tfDir
    terraform init -input=false
    Pop-Location
    Write-Ok "Terraform initialized"
}

# Step 6-10: Apply & Deploy (delegates to bash or terraform directly)
function Step-6 {
    Write-StepHeader 6 "Provision Hetzner Servers"
    $tfDir = Join-Path $ROOT_DIR "infrastructure\hetzner\terraform"
    Push-Location $tfDir
    terraform plan -out=tfplan
    Write-Host ""
    Write-Warn "This creates billable Hetzner resources (~€78/mo)."
    if (Confirm-Step "Apply Hetzner infrastructure?") {
        terraform apply tfplan
        Remove-Item tfplan -ErrorAction SilentlyContinue
        Write-Ok "Hetzner provisioned!"
        Write-Host "  Control Plane: $(terraform output -raw control_plane_ip)" -ForegroundColor White
        Write-Host "  Load Balancer: $(terraform output -raw load_balancer_ip)" -ForegroundColor White
    }
    Pop-Location
}

function Step-7 {
    Write-StepHeader 7 "Provision Cloudflare"
    $tfDir = Join-Path $ROOT_DIR "infrastructure\cloudflare\terraform"
    Push-Location $tfDir
    terraform plan -out=tfplan
    if (Confirm-Step "Apply Cloudflare configuration?") {
        terraform apply tfplan
        Remove-Item tfplan -ErrorAction SilentlyContinue
        Write-Ok "Cloudflare configured!"
    }
    Pop-Location
}

function Step-8 {
    Write-StepHeader 8 "Connect to K3s + Install Tunnel"
    $cpIp = Read-Host "  ? Control plane IP"
    Write-Info "Copying kubeconfig..."

    $kubeDir = "$env:USERPROFILE\.kube"
    if (-not (Test-Path $kubeDir)) { New-Item -ItemType Directory -Path $kubeDir | Out-Null }

    ssh -o StrictHostKeyChecking=no "root@$cpIp" "cat /etc/rancher/k3s/k3s.yaml" |
        ForEach-Object { $_ -replace "127.0.0.1", $cpIp } |
        Set-Content "$kubeDir\config-skillancer" -Encoding UTF8

    $env:KUBECONFIG = "$kubeDir\config-skillancer"
    Write-Ok "Kubeconfig saved"
    kubectl get nodes

    Write-Info "Installing Cloudflare Tunnel..."
    kubectl apply -f (Join-Path $ROOT_DIR "infrastructure\cloudflare\k8s\cloudflared.yaml")
    Write-Ok "Tunnel installed"
}

function Step-9 {
    Write-StepHeader 9 "Deploy Application"
    Write-Info "Use the deploy script to deploy services:"
    Write-Host "  bash scripts/deploy-hetzner.sh production all latest" -ForegroundColor Gray
    Write-Host ""
    Write-Info "Or build and push images first via GitHub Actions."
}

function Step-10 {
    Write-StepHeader 10 "Verify Deployment"
    kubectl get nodes 2>$null
    kubectl get pods -n skillancer 2>$null
    kubectl get pods -n cloudflare 2>$null

    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  🎉 Deployment Complete!                                    ║" -ForegroundColor Green
    Write-Host "║                                                              ║" -ForegroundColor Green
    Write-Host "║  🌐 https://skillancer.com                                   ║" -ForegroundColor Green
    Write-Host "║  🔌 https://api.skillancer.com                               ║" -ForegroundColor Green
    Write-Host "║  📊 https://metrics.skillancer.com                           ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
}

# Main
Write-Banner

$startStep = 1
if ($args.Count -ge 2 -and $args[0] -eq "--step") {
    $startStep = [int]$args[1]
}

Write-Info "Starting from step $startStep"

$steps = @(
    { Step-1 }, { Step-2 }, { Step-3 }, { Step-4 }, { Step-5 },
    { Step-6 }, { Step-7 }, { Step-8 }, { Step-9 }, { Step-10 }
)

for ($i = $startStep; $i -le 10; $i++) {
    & $steps[$i - 1]
    if ($i -lt 10) {
        if (-not (Confirm-Step "Continue to next step?")) {
            Write-Info "Resume with: .\scripts\deploy-guided.ps1 --step $($i + 1)"
            exit 0
        }
    }
}
