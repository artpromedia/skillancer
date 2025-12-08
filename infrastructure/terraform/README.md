# Terraform Infrastructure

Infrastructure as Code for Skillancer using Terraform.

## Prerequisites

- Terraform >= 1.6.0
- AWS CLI configured
- GCP CLI configured (for VDI)

## Structure

```
terraform/
├── modules/
│   ├── networking/
│   ├── database/
│   ├── cache/
│   ├── storage/
│   └── kubernetes/
├── environments/
│   ├── dev/
│   ├── staging/
│   └── production/
└── main.tf
```

## Usage

```bash
# Initialize
cd environments/dev
terraform init

# Plan changes
terraform plan

# Apply changes
terraform apply

# Destroy (careful!)
terraform destroy
```

## Modules

- **networking**: VPC, subnets, security groups
- **database**: RDS PostgreSQL
- **cache**: ElastiCache Redis
- **storage**: S3 buckets
- **kubernetes**: EKS cluster
