# =============================================================================
# Skillancer — Cloudflare Infrastructure
# =============================================================================
# Provisions:
#   - DNS records (A, CNAME, MX, TXT)
#   - Cloudflare Tunnel (Zero Trust) → Hetzner origin
#   - R2 Object Storage bucket (S3-compatible, zero egress)
#   - WAF / Security rules
#   - Page Rules / Cache Rules
#   - Rate limiting
#   - Bot management
#   - SSL/TLS settings
#
# Usage:
#   cd infrastructure/cloudflare/terraform
#   cp terraform.tfvars.example terraform.tfvars   # fill in values
#   terraform init
#   terraform plan
#   terraform apply
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# =============================================================================
# Variables
# =============================================================================

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Zone/DNS/Tunnel/R2 permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID (found in dashboard sidebar)"
  type        = string
}

variable "domain" {
  description = "Primary domain (must already be added to Cloudflare)"
  type        = string
  default     = "skillancer.com"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "hetzner_origin_ip" {
  description = "Hetzner Load Balancer or control plane public IP (fallback, used if Tunnel disabled)"
  type        = string
  default     = ""
}

variable "enable_tunnel" {
  description = "Use Cloudflare Tunnel instead of exposing origin IPs"
  type        = bool
  default     = true
}

variable "enable_r2" {
  description = "Create Cloudflare R2 bucket for object storage"
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Enable WAF rulesets and security rules"
  type        = bool
  default     = true
}

variable "notification_email" {
  description = "Email for alerts, certificates, etc."
  type        = string
  default     = "devops@skillancer.com"
}

# =============================================================================
# Provider
# =============================================================================

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# =============================================================================
# Zone Data
# =============================================================================

data "cloudflare_zone" "main" {
  name = var.domain
}

locals {
  zone_id = data.cloudflare_zone.main.id
}

# =============================================================================
# SSL/TLS Settings
# =============================================================================

resource "cloudflare_zone_settings_override" "tls" {
  zone_id = local.zone_id

  settings {
    ssl                      = "strict"
    always_use_https         = "on"
    min_tls_version          = "1.2"
    tls_1_3                  = "on"
    automatic_https_rewrites = "on"
    opportunistic_encryption = "on"
    http3                    = "on"
    zero_rtt                 = "on"
    security_level           = "high"
    browser_check            = "on"
    challenge_ttl            = 1800
    privacy_pass             = "on"
    early_hints              = "on"
    brotli                   = "on"
    security_header {
      enabled            = true
      preload            = true
      max_age            = 31536000
      include_subdomains = true
      nosniff            = true
    }
  }
}

# =============================================================================
# Cloudflare Tunnel (Zero Trust)
# =============================================================================

resource "random_id" "tunnel_secret" {
  byte_length = 64
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "skillancer" {
  count      = var.enable_tunnel ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "skillancer-${var.environment}"
  secret     = random_id.tunnel_secret.b64_std
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "skillancer" {
  count      = var.enable_tunnel ? 1 : 0
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.skillancer[0].id

  config {
    # API Gateway
    ingress_rule {
      hostname = "api.${var.domain}"
      service  = "http://localhost:4000"
      origin_request {
        no_tls_verify  = false
        http2_origin   = true
        connect_timeout = "30s"
      }
    }

    # Web Application
    ingress_rule {
      hostname = var.domain
      service  = "http://localhost:3000"
    }

    ingress_rule {
      hostname = "www.${var.domain}"
      service  = "http://localhost:3000"
    }

    # Web Market
    ingress_rule {
      hostname = "market.${var.domain}"
      service  = "http://localhost:3100"
    }

    # Web Cockpit
    ingress_rule {
      hostname = "cockpit.${var.domain}"
      service  = "http://localhost:3200"
    }

    # Web SkillPod
    ingress_rule {
      hostname = "pod.${var.domain}"
      service  = "http://localhost:3300"
    }

    # Admin panel
    ingress_rule {
      hostname = "admin.${var.domain}"
      service  = "http://localhost:3400"
    }

    # Grafana metrics
    ingress_rule {
      hostname = "metrics.${var.domain}"
      service  = "http://localhost:3001"
      origin_request {
        access {
          required  = true
          team_name = "skillancer"
        }
      }
    }

    # Catch-all (required)
    ingress_rule {
      service = "http_status:404"
    }
  }
}

# =============================================================================
# DNS Records
# =============================================================================

# --- Tunnel DNS (proxied through Cloudflare Tunnel) ---

resource "cloudflare_record" "root" {
  zone_id         = local.zone_id
  name            = "@"
  type            = var.enable_tunnel ? "CNAME" : "A"
  content         = var.enable_tunnel ? "${cloudflare_zero_trust_tunnel_cloudflared.skillancer[0].id}.cfargotunnel.com" : var.hetzner_origin_ip
  proxied         = true
  ttl             = 1 # Auto
  allow_overwrite = true
  comment         = "Skillancer web app"
}

resource "cloudflare_record" "www" {
  zone_id         = local.zone_id
  name            = "www"
  type            = "CNAME"
  content         = var.domain
  proxied         = true
  ttl             = 1
  allow_overwrite = true
  comment         = "www redirect"
}

resource "cloudflare_record" "api" {
  zone_id = local.zone_id
  name    = "api"
  type    = var.enable_tunnel ? "CNAME" : "A"
  content = var.enable_tunnel ? "${cloudflare_zero_trust_tunnel_cloudflared.skillancer[0].id}.cfargotunnel.com" : var.hetzner_origin_ip
  proxied = true
  ttl     = 1
  comment = "API gateway"
}

resource "cloudflare_record" "market" {
  zone_id = local.zone_id
  name    = "market"
  type    = var.enable_tunnel ? "CNAME" : "A"
  content = var.enable_tunnel ? "${cloudflare_zero_trust_tunnel_cloudflared.skillancer[0].id}.cfargotunnel.com" : var.hetzner_origin_ip
  proxied = true
  ttl     = 1
  comment = "Marketplace"
}

resource "cloudflare_record" "cockpit" {
  zone_id = local.zone_id
  name    = "cockpit"
  type    = var.enable_tunnel ? "CNAME" : "A"
  content = var.enable_tunnel ? "${cloudflare_zero_trust_tunnel_cloudflared.skillancer[0].id}.cfargotunnel.com" : var.hetzner_origin_ip
  proxied = true
  ttl     = 1
  comment = "Cockpit dashboard"
}

resource "cloudflare_record" "pod" {
  zone_id = local.zone_id
  name    = "pod"
  type    = var.enable_tunnel ? "CNAME" : "A"
  content = var.enable_tunnel ? "${cloudflare_zero_trust_tunnel_cloudflared.skillancer[0].id}.cfargotunnel.com" : var.hetzner_origin_ip
  proxied = true
  ttl     = 1
  comment = "SkillPod"
}

resource "cloudflare_record" "admin" {
  zone_id = local.zone_id
  name    = "admin"
  type    = var.enable_tunnel ? "CNAME" : "A"
  content = var.enable_tunnel ? "${cloudflare_zero_trust_tunnel_cloudflared.skillancer[0].id}.cfargotunnel.com" : var.hetzner_origin_ip
  proxied = true
  ttl     = 1
  comment = "Admin panel"
}

resource "cloudflare_record" "metrics" {
  zone_id = local.zone_id
  name    = "metrics"
  type    = var.enable_tunnel ? "CNAME" : "A"
  content = var.enable_tunnel ? "${cloudflare_zero_trust_tunnel_cloudflared.skillancer[0].id}.cfargotunnel.com" : var.hetzner_origin_ip
  proxied = true
  ttl     = 1
  comment = "Grafana metrics (Zero Trust protected)"
}

# --- Email DNS ---

resource "cloudflare_record" "mx1" {
  zone_id  = local.zone_id
  name     = "@"
  type     = "MX"
  content  = "mx1.${var.domain}"
  priority = 10
  ttl      = 3600
  comment  = "Primary MX"
}

resource "cloudflare_record" "spf" {
  zone_id = local.zone_id
  name    = "@"
  type    = "TXT"
  content = "v=spf1 include:_spf.google.com include:amazonses.com ~all"
  ttl     = 3600
  comment = "SPF record"
}

resource "cloudflare_record" "dmarc" {
  zone_id = local.zone_id
  name    = "_dmarc"
  type    = "TXT"
  content = "v=DMARC1; p=quarantine; rua=mailto:dmarc@${var.domain}; ruf=mailto:dmarc@${var.domain}; fo=1"
  ttl     = 3600
  comment = "DMARC policy"
}

# =============================================================================
# Cloudflare R2 (Object Storage)
# =============================================================================

resource "cloudflare_r2_bucket" "uploads" {
  count      = var.enable_r2 ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "skillancer-${var.environment}-uploads"
  location   = "WEUR" # Western Europe (closest to Hetzner FSN1)
}

resource "cloudflare_r2_bucket" "assets" {
  count      = var.enable_r2 ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "skillancer-${var.environment}-assets"
  location   = "WEUR"
}

resource "cloudflare_r2_bucket" "backups" {
  count      = var.enable_r2 ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "skillancer-${var.environment}-backups"
  location   = "WEUR"
}

# Custom domain for R2 public access (assets bucket)
resource "cloudflare_record" "cdn_assets" {
  count   = var.enable_r2 ? 1 : 0
  zone_id = local.zone_id
  name    = "cdn"
  type    = "CNAME"
  content = "public.r2.dev"
  proxied = true
  ttl     = 1
  comment = "CDN assets via R2"
}

# =============================================================================
# WAF / Security Rules
# =============================================================================

# Managed WAF rulesets
resource "cloudflare_ruleset" "waf_managed" {
  count   = var.enable_waf ? 1 : 0
  zone_id = local.zone_id
  name    = "Skillancer WAF"
  kind    = "zone"
  phase   = "http_request_firewall_managed"

  # Cloudflare Managed Ruleset
  rules {
    action = "execute"
    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee" # Cloudflare Managed Ruleset
    }
    expression  = "true"
    description = "Execute Cloudflare Managed Ruleset"
    enabled     = true
  }

  # OWASP Core Ruleset
  rules {
    action = "execute"
    action_parameters {
      id = "4814384a9e5d4991b9815dcfc25d2f1f" # OWASP Core Ruleset
    }
    expression  = "true"
    description = "Execute OWASP Core Ruleset"
    enabled     = true
  }
}

# Custom WAF rules
resource "cloudflare_ruleset" "waf_custom" {
  count   = var.enable_waf ? 1 : 0
  zone_id = local.zone_id
  name    = "Skillancer Custom WAF"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  # Block requests to admin from non-whitelisted countries
  rules {
    action     = "block"
    expression = "(http.host eq \"admin.${var.domain}\" and not ip.geoip.country in {\"DE\" \"AT\" \"CH\" \"NL\" \"US\" \"GB\"})"
    description = "Block admin from non-whitelisted countries"
    enabled     = true
  }

  # Block known bad user agents
  rules {
    action     = "block"
    expression = "(http.user_agent contains \"sqlmap\" or http.user_agent contains \"nikto\" or http.user_agent contains \"nmap\" or http.user_agent contains \"masscan\")"
    description = "Block scanner user agents"
    enabled     = true
  }

  # Challenge suspicious API requests
  rules {
    action     = "managed_challenge"
    expression = "(http.host eq \"api.${var.domain}\" and http.request.method eq \"POST\" and cf.threat_score gt 30)"
    description = "Challenge suspicious API POST requests"
    enabled     = true
  }

  # Rate limit auth endpoints
  rules {
    action     = "block"
    expression = "(http.host eq \"api.${var.domain}\" and starts_with(http.request.uri.path, \"/auth/login\") and cf.threat_score gt 50)"
    description = "Block high-threat-score auth requests"
    enabled     = true
  }
}

# =============================================================================
# Rate Limiting
# =============================================================================

resource "cloudflare_ruleset" "rate_limiting" {
  zone_id = local.zone_id
  name    = "Skillancer Rate Limiting"
  kind    = "zone"
  phase   = "http_ratelimit"

  # API general rate limit
  rules {
    action = "block"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period               = 60
      requests_per_period  = 200
      mitigation_timeout   = 60
    }
    expression  = "(http.host eq \"api.${var.domain}\")"
    description = "API rate limit: 200 req/min per IP"
    enabled     = true
  }

  # Auth endpoints strict rate limit (login, register, reset)
  rules {
    action = "block"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period               = 60
      requests_per_period  = 5
      mitigation_timeout   = 60
    }
    expression  = "(http.host eq \"api.${var.domain}\" and starts_with(http.request.uri.path, \"/auth/\"))"
    description = "Auth rate limit: 5 req/min per IP"
    enabled     = true
  }
}

# =============================================================================
# Cache Rules
# =============================================================================

resource "cloudflare_ruleset" "cache" {
  zone_id = local.zone_id
  name    = "Skillancer Cache Rules"
  kind    = "zone"
  phase   = "http_request_cache_settings"

  # Cache static assets aggressively
  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 2592000 # 30 days
      }
      browser_ttl {
        mode    = "override_origin"
        default = 86400 # 1 day
      }
    }
    expression  = "(http.request.uri.path.extension in {\"js\" \"css\" \"png\" \"jpg\" \"jpeg\" \"gif\" \"svg\" \"woff\" \"woff2\" \"ttf\" \"ico\" \"webp\" \"avif\"})"
    description = "Cache static assets 30 days edge, 1 day browser"
    enabled     = true
  }

  # Cache Next.js _next/static
  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 31536000 # 1 year (immutable hashed filenames)
      }
      browser_ttl {
        mode    = "override_origin"
        default = 31536000
      }
    }
    expression  = "(starts_with(http.request.uri.path, \"/_next/static/\"))"
    description = "Cache Next.js static chunks 1 year"
    enabled     = true
  }

  # Bypass cache for API
  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = false
    }
    expression  = "(http.host eq \"api.${var.domain}\")"
    description = "Bypass cache for API"
    enabled     = true
  }

  # Bypass cache for admin
  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = false
    }
    expression  = "(http.host eq \"admin.${var.domain}\")"
    description = "Bypass cache for admin"
    enabled     = true
  }
}

# =============================================================================
# Redirect Rules (managed via Cloudflare Dashboard)
# =============================================================================
# NOTE: www → apex 301 redirect is configured manually in the dashboard
# under Rules → Redirect Rules, because the http_request_dynamic_redirect
# phase requires a token permission not available in custom API tokens.
# Rule: (http.host eq "www.skillancer.com") → 301 → https://skillancer.com{path}

# =============================================================================
# Outputs
# =============================================================================

output "zone_id" {
  description = "Cloudflare zone ID"
  value       = local.zone_id
}

output "tunnel_id" {
  description = "Cloudflare Tunnel ID"
  value       = var.enable_tunnel ? cloudflare_zero_trust_tunnel_cloudflared.skillancer[0].id : "N/A"
}

output "tunnel_token" {
  description = "Cloudflare Tunnel token (use to install cloudflared on origin)"
  value       = var.enable_tunnel ? cloudflare_zero_trust_tunnel_cloudflared.skillancer[0].tunnel_token : "N/A"
  sensitive   = true
}

output "tunnel_cname" {
  description = "CNAME target for Tunnel DNS records"
  value       = var.enable_tunnel ? "${cloudflare_zero_trust_tunnel_cloudflared.skillancer[0].id}.cfargotunnel.com" : "N/A"
}

output "r2_uploads_bucket" {
  description = "R2 uploads bucket name"
  value       = var.enable_r2 ? cloudflare_r2_bucket.uploads[0].name : "N/A"
}

output "r2_endpoint" {
  description = "R2 S3-compatible API endpoint"
  value       = var.enable_r2 ? "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com" : "N/A"
}

output "nameservers" {
  description = "Cloudflare nameservers (set these at your registrar)"
  value       = data.cloudflare_zone.main.name_servers
}

output "setup_instructions" {
  description = "Next steps after terraform apply"
  value = <<-EOT

    ╔══════════════════════════════════════════════════════════════╗
    ║  Cloudflare Setup Complete!                                 ║
    ╠══════════════════════════════════════════════════════════════╣
    ║                                                              ║
    ║  1. Install cloudflared on your Hetzner server:              ║
    ║     ssh root@<server-ip>                                     ║
    ║     cloudflared service install <TUNNEL_TOKEN>               ║
    ║                                                              ║
    ║  2. Create R2 API tokens in Cloudflare dashboard:            ║
    ║     Dashboard → R2 → Manage R2 API Tokens                   ║
    ║                                                              ║
    ║  3. Set env vars for your app:                               ║
    ║     S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com║
    ║     S3_BUCKET=skillancer-production-uploads                  ║
    ║     S3_FORCE_PATH_STYLE=false                                ║
    ║     CLOUDFLARE_ACCOUNT_ID=<account_id>                       ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
  EOT
}
