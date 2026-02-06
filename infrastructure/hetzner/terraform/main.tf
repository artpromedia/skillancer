# =============================================================================
# Skillancer Production Infrastructure — Hetzner Cloud
# =============================================================================
# Provisions:
#   - Private network + subnets
#   - K3s control plane + worker VMs
#   - Managed database (PostgreSQL) or self-hosted
#   - Load balancer
#   - Firewall rules
#   - Object storage bucket
#   - SSH keys
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    cloudinit = {
      source  = "hashicorp/cloudinit"
      version = "~> 2.3"
    }
  }

  # Use PostgreSQL backend or Terraform Cloud for state
  # For Hetzner Object Storage backend, use S3-compatible config:
  # backend "s3" {
  #   bucket                      = "skillancer-tf-state"
  #   key                         = "production/terraform.tfstate"
  #   region                      = "eu-central"
  #   endpoints                   = { s3 = "https://fsn1.your-objectstorage.com" }
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_requesting_account_id  = true
  #   skip_region_validation      = true
  #   skip_s3_checksum            = true
  #   use_path_style              = true
  # }
}

# =============================================================================
# Variables
# =============================================================================

variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "location" {
  description = "Hetzner datacenter location"
  type        = string
  default     = "fsn1" # Falkenstein, Germany. Alternatives: nbg1, hel1, ash, hil
}

variable "domain" {
  description = "Primary domain"
  type        = string
  default     = "skillancer.com"
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key for server access"
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "control_plane_type" {
  description = "Server type for K3s control plane"
  type        = string
  default     = "cx31" # 4 vCPU, 8 GB RAM, 80 GB disk
}

variable "worker_type" {
  description = "Server type for K3s worker nodes"
  type        = string
  default     = "cx31" # 4 vCPU, 8 GB RAM, 80 GB disk
}

variable "worker_count" {
  description = "Number of K3s worker nodes"
  type        = number
  default     = 3
}

variable "db_server_type" {
  description = "Server type for PostgreSQL (if self-hosted)"
  type        = string
  default     = "cx31"
}

variable "redis_server_type" {
  description = "Server type for Redis"
  type        = string
  default     = "cx21" # 2 vCPU, 4 GB RAM
}

variable "enable_self_hosted_db" {
  description = "Use self-hosted PostgreSQL instead of Hetzner managed (not yet GA)"
  type        = bool
  default     = true
}

# =============================================================================
# Provider
# =============================================================================

provider "hcloud" {
  token = var.hcloud_token
}

# =============================================================================
# SSH Key
# =============================================================================

resource "hcloud_ssh_key" "default" {
  name       = "skillancer-${var.environment}"
  public_key = file(var.ssh_public_key_path)
}

# =============================================================================
# Private Network
# =============================================================================

resource "hcloud_network" "main" {
  name     = "skillancer-${var.environment}"
  ip_range = "10.0.0.0/16"
}

resource "hcloud_network_subnet" "k3s" {
  type         = "cloud"
  network_id   = hcloud_network.main.id
  network_zone = "eu-central"
  ip_range     = "10.0.1.0/24"
}

resource "hcloud_network_subnet" "database" {
  type         = "cloud"
  network_id   = hcloud_network.main.id
  network_zone = "eu-central"
  ip_range     = "10.0.2.0/24"
}

# =============================================================================
# Firewall
# =============================================================================

resource "hcloud_firewall" "k3s_control_plane" {
  name = "skillancer-${var.environment}-control-plane"

  # SSH
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # Kubernetes API
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "6443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # HTTP
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # HTTPS
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # K3s inter-node (private network CIDR)
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "any"
    source_ips = ["10.0.0.0/16"]
  }

  rule {
    direction  = "in"
    protocol   = "udp"
    port       = "any"
    source_ips = ["10.0.0.0/16"]
  }
}

resource "hcloud_firewall" "workers" {
  name = "skillancer-${var.environment}-workers"

  # SSH
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # HTTP
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # HTTPS
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # NodePort range for services
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "30000-32767"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # K3s inter-node (private network CIDR)
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "any"
    source_ips = ["10.0.0.0/16"]
  }

  rule {
    direction  = "in"
    protocol   = "udp"
    port       = "any"
    source_ips = ["10.0.0.0/16"]
  }
}

resource "hcloud_firewall" "database" {
  name = "skillancer-${var.environment}-database"

  # SSH
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["10.0.0.0/16"]
  }

  # PostgreSQL — only from private network
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "5432"
    source_ips = ["10.0.0.0/16"]
  }

  # Redis — only from private network
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "6379"
    source_ips = ["10.0.0.0/16"]
  }
}

# =============================================================================
# K3s Control Plane
# =============================================================================

resource "hcloud_server" "control_plane" {
  name        = "skillancer-${var.environment}-cp"
  server_type = var.control_plane_type
  image       = "ubuntu-24.04"
  location    = var.location
  ssh_keys    = [hcloud_ssh_key.default.id]
  firewall_ids = [hcloud_firewall.k3s_control_plane.id]

  labels = {
    environment = var.environment
    role        = "control-plane"
    project     = "skillancer"
  }

  user_data = templatefile("${path.module}/templates/cloud-init-cp.yaml", {
    k3s_token   = random_password.k3s_token.result
    private_ip  = "10.0.1.10"
    environment = var.environment
  })

  network {
    network_id = hcloud_network.main.id
    ip         = "10.0.1.10"
  }

  depends_on = [
    hcloud_network_subnet.k3s
  ]
}

resource "random_password" "k3s_token" {
  length  = 64
  special = false
}

# =============================================================================
# K3s Worker Nodes
# =============================================================================

resource "hcloud_server" "workers" {
  count       = var.worker_count
  name        = "skillancer-${var.environment}-worker-${count.index + 1}"
  server_type = var.worker_type
  image       = "ubuntu-24.04"
  location    = var.location
  ssh_keys    = [hcloud_ssh_key.default.id]
  firewall_ids = [hcloud_firewall.workers.id]

  labels = {
    environment = var.environment
    role        = "worker"
    project     = "skillancer"
  }

  user_data = templatefile("${path.module}/templates/cloud-init-worker.yaml", {
    k3s_token      = random_password.k3s_token.result
    control_plane_ip = "10.0.1.10"
    private_ip     = "10.0.1.${20 + count.index}"
    environment    = var.environment
    worker_index   = count.index + 1
  })

  network {
    network_id = hcloud_network.main.id
    ip         = "10.0.1.${20 + count.index}"
  }

  depends_on = [
    hcloud_network_subnet.k3s,
    hcloud_server.control_plane
  ]
}

# =============================================================================
# Database Server (Self-Hosted PostgreSQL + Redis)
# =============================================================================

resource "hcloud_server" "database" {
  count       = var.enable_self_hosted_db ? 1 : 0
  name        = "skillancer-${var.environment}-db"
  server_type = var.db_server_type
  image       = "ubuntu-24.04"
  location    = var.location
  ssh_keys    = [hcloud_ssh_key.default.id]
  firewall_ids = [hcloud_firewall.database.id]

  labels = {
    environment = var.environment
    role        = "database"
    project     = "skillancer"
  }

  user_data = templatefile("${path.module}/templates/cloud-init-db.yaml", {
    db_name     = "skillancer"
    db_user     = "skillancer_admin"
    db_password = random_password.db_password.result
    private_ip  = "10.0.2.10"
    environment = var.environment
  })

  network {
    network_id = hcloud_network.main.id
    ip         = "10.0.2.10"
  }

  depends_on = [
    hcloud_network_subnet.database
  ]
}

resource "hcloud_server" "redis" {
  name        = "skillancer-${var.environment}-redis"
  server_type = var.redis_server_type
  image       = "ubuntu-24.04"
  location    = var.location
  ssh_keys    = [hcloud_ssh_key.default.id]
  firewall_ids = [hcloud_firewall.database.id]

  labels = {
    environment = var.environment
    role        = "redis"
    project     = "skillancer"
  }

  user_data = templatefile("${path.module}/templates/cloud-init-redis.yaml", {
    redis_password = random_password.redis_password.result
    private_ip     = "10.0.2.20"
    environment    = var.environment
  })

  network {
    network_id = hcloud_network.main.id
    ip         = "10.0.2.20"
  }

  depends_on = [
    hcloud_network_subnet.database
  ]
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "random_password" "redis_password" {
  length  = 32
  special = false
}

# =============================================================================
# Hetzner Load Balancer
# =============================================================================

resource "hcloud_load_balancer" "main" {
  name               = "skillancer-${var.environment}-lb"
  load_balancer_type = "lb11"
  location           = var.location

  labels = {
    environment = var.environment
    project     = "skillancer"
  }
}

resource "hcloud_load_balancer_network" "main" {
  load_balancer_id = hcloud_load_balancer.main.id
  network_id       = hcloud_network.main.id
  ip               = "10.0.1.2"
}

resource "hcloud_load_balancer_service" "http" {
  load_balancer_id = hcloud_load_balancer.main.id
  protocol         = "tcp"
  listen_port      = 80
  destination_port = 80

  health_check {
    protocol = "http"
    port     = 80
    interval = 15
    timeout  = 10
    retries  = 3
    http {
      path         = "/health"
      status_codes = ["2??", "3??"]
    }
  }
}

resource "hcloud_load_balancer_service" "https" {
  load_balancer_id = hcloud_load_balancer.main.id
  protocol         = "tcp"
  listen_port      = 443
  destination_port = 443

  health_check {
    protocol = "https"
    port     = 443
    interval = 15
    timeout  = 10
    retries  = 3
    http {
      path         = "/health"
      status_codes = ["2??", "3??"]
      tls          = true
    }
  }
}

# Attach all K3s nodes (control plane + workers) to LB
resource "hcloud_load_balancer_target" "control_plane" {
  type             = "server"
  load_balancer_id = hcloud_load_balancer.main.id
  server_id        = hcloud_server.control_plane.id
  use_private_ip   = true

  depends_on = [hcloud_load_balancer_network.main]
}

resource "hcloud_load_balancer_target" "workers" {
  count            = var.worker_count
  type             = "server"
  load_balancer_id = hcloud_load_balancer.main.id
  server_id        = hcloud_server.workers[count.index].id
  use_private_ip   = true

  depends_on = [hcloud_load_balancer_network.main]
}

# =============================================================================
# Volumes (persistent storage for DB)
# =============================================================================

resource "hcloud_volume" "db_data" {
  count    = var.enable_self_hosted_db ? 1 : 0
  name     = "skillancer-${var.environment}-db-data"
  size     = 100 # GB
  location = var.location
  format   = "ext4"
}

resource "hcloud_volume_attachment" "db_data" {
  count     = var.enable_self_hosted_db ? 1 : 0
  volume_id = hcloud_volume.db_data[0].id
  server_id = hcloud_server.database[0].id
  automount = true
}

# =============================================================================
# Placement Group (spread VMs across hosts)
# =============================================================================

resource "hcloud_placement_group" "k3s" {
  name = "skillancer-${var.environment}-k3s"
  type = "spread"
}

# =============================================================================
# Outputs
# =============================================================================

output "control_plane_ip" {
  description = "K3s control plane public IP"
  value       = hcloud_server.control_plane.ipv4_address
}

output "control_plane_private_ip" {
  description = "K3s control plane private IP"
  value       = "10.0.1.10"
}

output "worker_ips" {
  description = "K3s worker public IPs"
  value       = hcloud_server.workers[*].ipv4_address
}

output "worker_private_ips" {
  description = "K3s worker private IPs"
  value       = [for i in range(var.worker_count) : "10.0.1.${20 + i}"]
}

output "database_ip" {
  description = "Database server private IP"
  value       = var.enable_self_hosted_db ? "10.0.2.10" : "N/A (using managed)"
}

output "redis_ip" {
  description = "Redis server private IP"
  value       = "10.0.2.20"
}

output "load_balancer_ip" {
  description = "Load balancer public IP"
  value       = hcloud_load_balancer.main.ipv4
}

output "k3s_token" {
  description = "K3s cluster join token"
  value       = random_password.k3s_token.result
  sensitive   = true
}

output "db_password" {
  description = "PostgreSQL password"
  value       = random_password.db_password.result
  sensitive   = true
}

output "redis_password" {
  description = "Redis password"
  value       = random_password.redis_password.result
  sensitive   = true
}

output "database_url" {
  description = "PostgreSQL connection string"
  value       = "postgresql://skillancer_admin:${random_password.db_password.result}@10.0.2.10:5432/skillancer"
  sensitive   = true
}

output "redis_url" {
  description = "Redis connection string"
  value       = "redis://:${random_password.redis_password.result}@10.0.2.20:6379"
  sensitive   = true
}
