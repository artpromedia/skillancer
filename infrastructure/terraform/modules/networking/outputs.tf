# =============================================================================
# Networking Module Outputs
# =============================================================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "vpc_arn" {
  description = "ARN of the VPC"
  value       = aws_vpc.main.arn
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "public_subnet_cidrs" {
  description = "CIDR blocks of public subnets"
  value       = aws_subnet.public[*].cidr_block
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "private_subnet_cidrs" {
  description = "CIDR blocks of private subnets"
  value       = aws_subnet.private[*].cidr_block
}

output "database_subnet_ids" {
  description = "IDs of database subnets"
  value       = aws_subnet.database[*].id
}

output "database_subnet_cidrs" {
  description = "CIDR blocks of database subnets"
  value       = aws_subnet.database[*].cidr_block
}

output "db_subnet_group_name" {
  description = "Name of the database subnet group"
  value       = aws_db_subnet_group.main.name
}

output "db_subnet_group_arn" {
  description = "ARN of the database subnet group"
  value       = aws_db_subnet_group.main.arn
}

output "elasticache_subnet_group_name" {
  description = "Name of the ElastiCache subnet group"
  value       = aws_elasticache_subnet_group.main.name
}

output "nat_gateway_ids" {
  description = "IDs of NAT gateways"
  value       = aws_nat_gateway.main[*].id
}

output "nat_gateway_ips" {
  description = "Elastic IPs of NAT gateways"
  value       = aws_eip.nat[*].public_ip
}

output "internet_gateway_id" {
  description = "ID of the internet gateway"
  value       = aws_internet_gateway.main.id
}

output "public_route_table_id" {
  description = "ID of the public route table"
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "IDs of private route tables"
  value       = aws_route_table.private[*].id
}

output "database_route_table_id" {
  description = "ID of the database route table"
  value       = aws_route_table.database.id
}

output "flow_log_id" {
  description = "ID of the VPC flow log"
  value       = var.enable_flow_logs ? aws_flow_log.main[0].id : null
}

output "flow_log_group_name" {
  description = "Name of the CloudWatch log group for flow logs"
  value       = var.enable_flow_logs ? aws_cloudwatch_log_group.flow_logs[0].name : null
}

output "flow_log_group_arn" {
  description = "ARN of the CloudWatch log group for flow logs"
  value       = var.enable_flow_logs ? aws_cloudwatch_log_group.flow_logs[0].arn : null
}

# =============================================================================
# Security Group Outputs
# =============================================================================

output "alb_security_group_id" {
  description = "Security group ID for the Application Load Balancer"
  value       = aws_security_group.alb.id
}

output "alb_security_group_arn" {
  description = "Security group ARN for the Application Load Balancer"
  value       = aws_security_group.alb.arn
}

output "ecs_tasks_security_group_id" {
  description = "Security group ID for ECS tasks"
  value       = aws_security_group.ecs_tasks.id
}

output "ecs_tasks_security_group_arn" {
  description = "Security group ARN for ECS tasks"
  value       = aws_security_group.ecs_tasks.arn
}

output "database_security_group_id" {
  description = "Security group ID for databases (RDS/ElastiCache)"
  value       = aws_security_group.database.id
}

output "database_security_group_arn" {
  description = "Security group ARN for databases (RDS/ElastiCache)"
  value       = aws_security_group.database.arn
}

output "vpc_endpoints_security_group_id" {
  description = "Security group ID for VPC endpoints"
  value       = var.enable_vpc_endpoints ? aws_security_group.vpc_endpoints[0].id : null
}

output "availability_zones" {
  description = "Availability zones used"
  value       = length(var.availability_zones) > 0 ? var.availability_zones : data.aws_availability_zones.available.names
}

# =============================================================================
# VPC Endpoint Outputs
# =============================================================================

output "s3_endpoint_id" {
  description = "ID of the S3 VPC endpoint"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.s3[0].id : null
}

output "dynamodb_endpoint_id" {
  description = "ID of the DynamoDB VPC endpoint"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.dynamodb[0].id : null
}

# =============================================================================
# Summary Output (useful for debugging/reference)
# =============================================================================

output "network_summary" {
  description = "Summary of the network configuration"
  value = {
    vpc_id                = aws_vpc.main.id
    vpc_cidr              = aws_vpc.main.cidr_block
    region                = data.aws_region.current.name
    availability_zones    = local.az_names
    public_subnets        = length(aws_subnet.public)
    private_subnets       = length(aws_subnet.private)
    database_subnets      = length(aws_subnet.database)
    nat_gateways          = length(aws_nat_gateway.main)
    vpc_endpoints_enabled = var.enable_vpc_endpoints
    flow_logs_enabled     = var.enable_flow_logs
  }
}
