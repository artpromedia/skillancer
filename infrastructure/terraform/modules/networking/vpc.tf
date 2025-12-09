# =============================================================================
# VPC Configuration
# =============================================================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Enable IPv6 if requested
  assign_generated_ipv6_cidr_block = var.enable_ipv6

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

# -----------------------------------------------------------------------------
# Internet Gateway
# -----------------------------------------------------------------------------

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
  })
}

# -----------------------------------------------------------------------------
# Default Security Group (restrictive)
# -----------------------------------------------------------------------------

resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id

  # No ingress rules - deny all inbound by default
  # No egress rules - deny all outbound by default

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-default-sg"
  })
}

# -----------------------------------------------------------------------------
# Default Network ACL
# -----------------------------------------------------------------------------

resource "aws_default_network_acl" "default" {
  default_network_acl_id = aws_vpc.main.default_network_acl_id

  # Allow all traffic by default (security groups handle restrictions)
  ingress {
    protocol   = -1
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  egress {
    protocol   = -1
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-default-nacl"
  })

  lifecycle {
    ignore_changes = [subnet_ids]
  }
}
