# =============================================================================
# Subnet Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# Public Subnets (ALB, NAT Gateways, Bastion)
# -----------------------------------------------------------------------------

resource "aws_subnet" "public" {
  count = local.az_count

  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_subnets[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  # IPv6 support
  ipv6_cidr_block                 = var.enable_ipv6 ? cidrsubnet(aws_vpc.main.ipv6_cidr_block, 8, count.index) : null
  assign_ipv6_address_on_creation = var.enable_ipv6

  tags = merge(local.common_tags, {
    Name                     = "${local.name_prefix}-public-${local.azs[count.index]}"
    Type                     = "public"
    "kubernetes.io/role/elb" = "1" # For future EKS compatibility
  })
}

# -----------------------------------------------------------------------------
# Private Subnets (Application - ECS Tasks)
# -----------------------------------------------------------------------------

resource "aws_subnet" "private" {
  count = local.az_count

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnets[count.index]
  availability_zone = local.azs[count.index]

  # IPv6 support
  ipv6_cidr_block                 = var.enable_ipv6 ? cidrsubnet(aws_vpc.main.ipv6_cidr_block, 8, count.index + local.az_count) : null
  assign_ipv6_address_on_creation = var.enable_ipv6

  tags = merge(local.common_tags, {
    Name                              = "${local.name_prefix}-private-${local.azs[count.index]}"
    Type                              = "private"
    "kubernetes.io/role/internal-elb" = "1" # For future EKS compatibility
  })
}

# -----------------------------------------------------------------------------
# Database Subnets (RDS, ElastiCache)
# -----------------------------------------------------------------------------

resource "aws_subnet" "database" {
  count = local.az_count

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.database_subnets[count.index]
  availability_zone = local.azs[count.index]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-${local.azs[count.index]}"
    Type = "database"
  })
}

# -----------------------------------------------------------------------------
# Database Subnet Group (for RDS)
# -----------------------------------------------------------------------------

resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-db-subnet-group"
  description = "Database subnet group for ${local.name_prefix}"
  subnet_ids  = aws_subnet.database[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

# -----------------------------------------------------------------------------
# ElastiCache Subnet Group
# -----------------------------------------------------------------------------

resource "aws_elasticache_subnet_group" "main" {
  name        = "${local.name_prefix}-cache-subnet-group"
  description = "ElastiCache subnet group for ${local.name_prefix}"
  subnet_ids  = aws_subnet.database[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cache-subnet-group"
  })
}
