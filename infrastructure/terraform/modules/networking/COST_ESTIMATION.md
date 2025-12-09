# Skillancer Network Infrastructure Cost Estimation

## Overview

This document provides cost estimates for the AWS networking infrastructure in different configurations. All estimates are based on US East (N. Virginia) pricing and may vary by region.

## Cost Summary by Environment

| Component                 | Development | Staging  | Production |
| ------------------------- | ----------- | -------- | ---------- |
| NAT Gateway (fixed)       | $32.40      | $32.40   | $97.20     |
| NAT Gateway (data 100GB)  | $4.50       | $4.50    | $4.50      |
| VPC Endpoints (Interface) | $0          | $28.00   | $28.00     |
| VPC Flow Logs             | ~$2.50      | ~$2.50   | ~$5.00     |
| **Total Monthly**         | **~$39**    | **~$67** | **~$135**  |

## Detailed Cost Breakdown

### NAT Gateway

| Item                     | Single NAT       | HA NAT (3 AZs)   |
| ------------------------ | ---------------- | ---------------- |
| Hourly charge            | $0.045 × 1 × 720 | $0.045 × 3 × 720 |
| Monthly fixed cost       | $32.40           | $97.20           |
| Data processing (per GB) | $0.045           | $0.045           |

**Data Processing Examples:**
| Monthly Data | Cost (Single NAT) | Cost (HA NAT) |
|--------------|-------------------|---------------|
| 100 GB | $4.50 | $4.50 |
| 500 GB | $22.50 | $22.50 |
| 1 TB | $46.08 | $46.08 |

### VPC Endpoints

| Endpoint Type          | Hourly Rate | Monthly Cost (per endpoint) |
| ---------------------- | ----------- | --------------------------- |
| Gateway (S3, DynamoDB) | Free        | $0                          |
| Interface              | $0.01/hour  | ~$7.20                      |

**Interface Endpoints in Use:**
| Endpoint | Purpose | Monthly Cost |
|------------------|----------------------------|--------------|
| ECR API | Container registry API | $7.20 |
| ECR DKR | Container image pulls | $7.20 |
| Secrets Manager | Secrets retrieval | $7.20 |
| CloudWatch Logs | Log shipping | $7.20 |
| **Total** | | **$28.80** |

**Data Processing:** First 1 PB: $0.01/GB (usually negligible)

### VPC Flow Logs (CloudWatch)

| Item              | Price             | Estimate           |
| ----------------- | ----------------- | ------------------ |
| Ingestion         | $0.50/GB          | ~$2.50/month (5GB) |
| Storage (30 days) | $0.03/GB          | ~$0.15/month       |
| Insights queries  | $0.005/GB scanned | Variable           |

**Log Volume Estimates:**
| Environment | Daily Logs | Monthly Cost |
|-------------|------------|--------------|
| Development | 50-100 MB | ~$1.00 |
| Staging | 100-200 MB | ~$2.50 |
| Production | 500 MB-1GB | ~$5.00 |

## Configuration Recommendations

### Development Environment

```hcl
single_nat_gateway    = true    # $32/month instead of $97/month
enable_vpc_endpoints  = false   # Save $28/month
enable_flow_logs      = true    # Keep for debugging
```

**Estimated Cost:** ~$35-40/month

### Staging Environment

```hcl
single_nat_gateway    = true    # Cost savings acceptable
enable_vpc_endpoints  = true    # Test production config
enable_flow_logs      = true    # Match production
```

**Estimated Cost:** ~$65-70/month

### Production Environment

```hcl
single_nat_gateway    = false   # HA with 3 NAT Gateways
enable_vpc_endpoints  = true    # Improved security & performance
enable_flow_logs      = true    # Compliance & security
```

**Estimated Cost:** ~$130-140/month

## Cost Optimization Strategies

### 1. NAT Gateway Optimization

- **Use Single NAT Gateway in non-prod:** Saves ~$65/month
- **Use VPC Endpoints:** Reduces NAT data processing costs
- **Schedule non-prod:** Consider destroying dev NAT outside business hours

### 2. VPC Endpoints Benefits

- **Reduced NAT costs:** AWS service traffic doesn't go through NAT
- **Improved latency:** Direct path to AWS services
- **Enhanced security:** Traffic stays within AWS network

### 3. Flow Logs Optimization

- **Reduce retention:** 14 days for dev, 30 for staging, 90 for prod
- **Use S3 for long-term:** Cheaper than CloudWatch for historical data
- **Sample traffic:** For high-volume environments

## Annual Cost Estimates

| Environment | Monthly  | Annual     |
| ----------- | -------- | ---------- |
| Development | $39      | $468       |
| Staging     | $67      | $804       |
| Production  | $135     | $1,620     |
| **Total**   | **$241** | **$2,892** |

## Cost Comparison: Single vs HA NAT Gateway

### Risk Assessment

| Factor         | Single NAT                    | HA NAT (Multi-AZ)  |
| -------------- | ----------------------------- | ------------------ |
| Monthly Cost   | $32.40                        | $97.20             |
| Annual Cost    | $388.80                       | $1,166.40          |
| Savings        | $777.60/year                  | Baseline           |
| Availability   | Single AZ dependency          | Full AZ redundancy |
| Failure Impact | All outbound traffic affected | Only affected AZ   |
| Recovery Time  | Minutes (AWS managed)         | Automatic failover |

### Recommendation

- **Non-Production:** Single NAT Gateway (acceptable risk, good savings)
- **Production:** HA NAT Gateway (worth the extra $65/month for reliability)

## Free Tier Considerations

Note: NAT Gateway and VPC Endpoints are **NOT** included in AWS Free Tier.

Resources included in Free Tier (12 months):

- VPC: Free
- Internet Gateway: Free
- Route Tables: Free
- Security Groups: Free

## Monitoring Costs

Set up AWS Budgets to monitor:

1. NAT Gateway usage
2. Data transfer
3. CloudWatch Logs ingestion

```hcl
# Example CloudWatch alarm for NAT costs
resource "aws_cloudwatch_metric_alarm" "nat_cost" {
  alarm_name          = "nat-gateway-cost-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BytesOutToDestination"
  namespace           = "AWS/NATGateway"
  period              = "86400"
  statistic           = "Sum"
  threshold           = "107374182400"  # 100 GB
  alarm_description   = "NAT Gateway processing over 100GB/day"
}
```

## Summary

The networking infrastructure costs range from **$39/month (dev)** to **$135/month (production)**. Key decisions:

1. **NAT Gateway Mode:** Biggest cost driver - single vs HA
2. **VPC Endpoints:** Worth enabling in staging/production for security
3. **Flow Logs:** Essential for compliance, optimize retention

Total estimated annual networking cost for all environments: **~$2,900**
