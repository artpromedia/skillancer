# =============================================================================
# NAT Gateway Configuration
# =============================================================================
# NAT Gateways provide outbound internet access for resources in private subnets.
# Options:
# - Single NAT Gateway: Cost-effective, but single point of failure
# - HA NAT Gateway: One per AZ for high availability (recommended for prod)
# =============================================================================

# -----------------------------------------------------------------------------
# Elastic IPs for NAT Gateways
# -----------------------------------------------------------------------------

resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : local.az_count) : 0
  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = var.single_nat_gateway ? "${local.name_prefix}-nat-eip" : "${local.name_prefix}-nat-eip-${local.azs[count.index]}"
  })

  depends_on = [aws_internet_gateway.main]
}

# -----------------------------------------------------------------------------
# NAT Gateways
# -----------------------------------------------------------------------------

resource "aws_nat_gateway" "main" {
  count = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : local.az_count) : 0

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.common_tags, {
    Name = var.single_nat_gateway ? "${local.name_prefix}-nat" : "${local.name_prefix}-nat-${local.azs[count.index]}"
  })

  depends_on = [aws_internet_gateway.main]

  # Ensure proper ordering for destroy operations
  lifecycle {
    create_before_destroy = true
  }
}
