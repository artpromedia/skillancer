# =============================================================================
# Route Table Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# Public Route Table
# Routes: Internet Gateway for 0.0.0.0/0
# -----------------------------------------------------------------------------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-rt"
  })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

# IPv6 route for public subnets
resource "aws_route" "public_internet_ipv6" {
  count = var.enable_ipv6 ? 1 : 0

  route_table_id              = aws_route_table.public.id
  destination_ipv6_cidr_block = "::/0"
  gateway_id                  = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count = local.az_count

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# -----------------------------------------------------------------------------
# Private Route Tables
# Routes: NAT Gateway for 0.0.0.0/0
# One per AZ for HA NAT, or single shared table for cost savings
# -----------------------------------------------------------------------------

resource "aws_route_table" "private" {
  count  = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : local.az_count) : 1
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = var.single_nat_gateway ? "${local.name_prefix}-private-rt" : "${local.name_prefix}-private-rt-${local.azs[count.index]}"
  })
}

resource "aws_route" "private_nat" {
  count = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : local.az_count) : 0

  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[var.single_nat_gateway ? 0 : count.index].id
}

resource "aws_route_table_association" "private" {
  count = local.az_count

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[var.single_nat_gateway ? 0 : count.index].id
}

# -----------------------------------------------------------------------------
# Database Route Table
# No internet access by default - isolated for security
# -----------------------------------------------------------------------------

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-rt"
  })
}

resource "aws_route_table_association" "database" {
  count = local.az_count

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# Optional: Add NAT route for database subnets (e.g., for package updates)
resource "aws_route" "database_nat" {
  count = var.enable_nat_gateway && var.database_subnet_internet_access ? 1 : 0

  route_table_id         = aws_route_table.database.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[0].id
}
