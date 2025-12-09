# Skillancer AWS Network Architecture

## Overview

This document describes the network architecture for the Skillancer platform deployed on AWS.

## Network Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         AWS Cloud                                            │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              VPC (10.0.0.0/16)                                         │  │
│  │                                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                           Internet Gateway (IGW)                                 │  │  │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                        │                                              │  │
│  │  ┌────────────────────────────────────┬┴┬───────────────────────────────────────────┐│  │
│  │  │              PUBLIC SUBNETS (ALB Tier)                                           ││  │
│  │  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                ││  │
│  │  │  │ Public Subnet 1  │  │ Public Subnet 2  │  │ Public Subnet 3  │                ││  │
│  │  │  │ 10.0.0.0/20      │  │ 10.0.16.0/20     │  │ 10.0.32.0/20     │                ││  │
│  │  │  │ (AZ-a)           │  │ (AZ-b)           │  │ (AZ-c)           │                ││  │
│  │  │  │                  │  │                  │  │                  │                ││  │
│  │  │  │ ┌─────────────┐  │  │ ┌─────────────┐  │  │ ┌─────────────┐  │                ││  │
│  │  │  │ │     ALB     │  │  │ │     ALB     │  │  │ │     ALB     │  │                ││  │
│  │  │  │ └─────────────┘  │  │ └─────────────┘  │  │ └─────────────┘  │                ││  │
│  │  │  │ ┌─────────────┐  │  │                  │  │                  │                ││  │
│  │  │  │ │ NAT Gateway │  │  │  (Single NAT    │  │  for cost        │                ││  │
│  │  │  │ └─────────────┘  │  │   savings)      │  │  savings)        │                ││  │
│  │  │  └──────────────────┘  └──────────────────┘  └──────────────────┘                ││  │
│  │  └──────────────────────────────────────────────────────────────────────────────────┘│  │
│  │                                        │                                              │  │
│  │  ┌─────────────────────────────────────┼────────────────────────────────────────────┐│  │
│  │  │              PRIVATE SUBNETS (ECS Tasks Tier)                                    ││  │
│  │  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                ││  │
│  │  │  │ Private Subnet 1 │  │ Private Subnet 2 │  │ Private Subnet 3 │                ││  │
│  │  │  │ 10.0.48.0/20     │  │ 10.0.64.0/20     │  │ 10.0.80.0/20     │                ││  │
│  │  │  │ (AZ-a)           │  │ (AZ-b)           │  │ (AZ-c)           │                ││  │
│  │  │  │                  │  │                  │  │                  │                ││  │
│  │  │  │ ┌─────────────┐  │  │ ┌─────────────┐  │  │ ┌─────────────┐  │                ││  │
│  │  │  │ │ ECS Tasks   │  │  │ │ ECS Tasks   │  │  │ │ ECS Tasks   │  │                ││  │
│  │  │  │ │ (API, Web)  │  │  │ │ (API, Web)  │  │  │ │ (API, Web)  │  │                ││  │
│  │  │  │ └─────────────┘  │  │ └─────────────┘  │  │ └─────────────┘  │                ││  │
│  │  │  └──────────────────┘  └──────────────────┘  └──────────────────┘                ││  │
│  │  └──────────────────────────────────────────────────────────────────────────────────┘│  │
│  │                                        │                                              │  │
│  │  ┌─────────────────────────────────────┼────────────────────────────────────────────┐│  │
│  │  │              DATABASE SUBNETS (Data Tier)                                        ││  │
│  │  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                ││  │
│  │  │  │ Database Subnet 1│  │ Database Subnet 2│  │ Database Subnet 3│                ││  │
│  │  │  │ 10.0.96.0/20     │  │ 10.0.112.0/20    │  │ 10.0.128.0/20    │                ││  │
│  │  │  │ (AZ-a)           │  │ (AZ-b)           │  │ (AZ-c)           │                ││  │
│  │  │  │                  │  │                  │  │                  │                ││  │
│  │  │  │ ┌─────────────┐  │  │ ┌─────────────┐  │  │ ┌─────────────┐  │                ││  │
│  │  │  │ │RDS Postgres │  │  │ │RDS (Standby)│  │  │ │RDS (Standby)│  │                ││  │
│  │  │  │ │ (Primary)   │  │  │ │             │  │  │ │             │  │                ││  │
│  │  │  │ └─────────────┘  │  │ └─────────────┘  │  │ └─────────────┘  │                ││  │
│  │  │  │ ┌─────────────┐  │  │ ┌─────────────┐  │  │ ┌─────────────┐  │                ││  │
│  │  │  │ │ ElastiCache │  │  │ │ ElastiCache │  │  │ │ ElastiCache │  │                ││  │
│  │  │  │ │   (Redis)   │  │  │ │   (Replica) │  │  │ │   (Replica) │  │                ││  │
│  │  │  │ └─────────────┘  │  │ └─────────────┘  │  │ └─────────────┘  │                ││  │
│  │  │  └──────────────────┘  └──────────────────┘  └──────────────────┘                ││  │
│  │  └──────────────────────────────────────────────────────────────────────────────────┘│  │
│  │                                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                           VPC Endpoints                                          │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │  │  │
│  │  │  │  S3 Gateway  │  │  DynamoDB    │  │  ECR API     │  │ Secrets Mgr  │         │  │  │
│  │  │  │  Endpoint    │  │  Gateway     │  │  Interface   │  │  Interface   │         │  │  │
│  │  │  │  (Free)      │  │  (Free)      │  │              │  │              │         │  │  │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘         │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐                                              │  │  │
│  │  │  │  ECR DKR     │  │  CloudWatch  │                                              │  │  │
│  │  │  │  Interface   │  │  Logs        │                                              │  │  │
│  │  │  └──────────────┘  └──────────────┘                                              │  │  │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Subnet Allocation

| Tier     | AZ-a         | AZ-b          | AZ-c          | Purpose                       |
| -------- | ------------ | ------------- | ------------- | ----------------------------- |
| Public   | 10.0.0.0/20  | 10.0.16.0/20  | 10.0.32.0/20  | ALB, NAT Gateway, Bastion     |
| Private  | 10.0.48.0/20 | 10.0.64.0/20  | 10.0.80.0/20  | ECS Tasks (API, Web, Workers) |
| Database | 10.0.96.0/20 | 10.0.112.0/20 | 10.0.128.0/20 | RDS PostgreSQL, ElastiCache   |

**IP Addresses per Subnet:** 4,091 usable (4,096 - 5 AWS reserved)

## Security Groups

### ALB Security Group

| Direction | Protocol | Port | Source/Destination | Description   |
| --------- | -------- | ---- | ------------------ | ------------- |
| Ingress   | TCP      | 80   | 0.0.0.0/0          | HTTP traffic  |
| Ingress   | TCP      | 443  | 0.0.0.0/0          | HTTPS traffic |
| Egress    | All      | All  | 0.0.0.0/0          | All outbound  |

### ECS Tasks Security Group

| Direction | Protocol | Port    | Source/Destination | Description   |
| --------- | -------- | ------- | ------------------ | ------------- |
| Ingress   | TCP      | 0-65535 | ALB Security Group | From ALB      |
| Ingress   | TCP      | 0-65535 | Self               | Inter-service |
| Egress    | All      | All     | 0.0.0.0/0          | All outbound  |

### Database Security Group

| Direction | Protocol | Port | Source/Destination    | Description     |
| --------- | -------- | ---- | --------------------- | --------------- |
| Ingress   | TCP      | 5432 | ECS Tasks SG          | PostgreSQL      |
| Ingress   | TCP      | 6379 | ECS Tasks SG          | Redis           |
| Ingress   | TCP      | 5432 | Bastion SG (optional) | DB Admin access |
| Egress    | All      | All  | 0.0.0.0/0             | All outbound    |

## Traffic Flow

### Inbound Traffic (User Request)

```
Internet → Internet Gateway → ALB (Public Subnet) → ECS Tasks (Private Subnet)
```

### Database Access

```
ECS Tasks (Private Subnet) → RDS/ElastiCache (Database Subnet)
```

### Outbound Traffic (External APIs)

```
ECS Tasks (Private Subnet) → NAT Gateway (Public Subnet) → Internet Gateway → Internet
```

### AWS Service Access (via VPC Endpoints)

```
ECS Tasks → VPC Endpoint → AWS Service (no internet traversal)
```

## NAT Gateway Configuration

### Single NAT Gateway (Cost Optimized)

- **Use Case:** Development, Staging environments
- **Trade-off:** Single point of failure, but lower cost
- **Cost:** ~$32/month + data processing

### High Availability NAT Gateway

- **Use Case:** Production environment
- **Configuration:** One NAT Gateway per AZ
- **Cost:** ~$96/month (3 AZs) + data processing

## VPC Endpoints

| Endpoint        | Type      | Cost      | Purpose                      |
| --------------- | --------- | --------- | ---------------------------- |
| S3              | Gateway   | Free      | Container image layers, logs |
| DynamoDB        | Gateway   | Free      | Future use                   |
| ECR API         | Interface | ~$7/month | Container registry API       |
| ECR DKR         | Interface | ~$7/month | Container image pulls        |
| Secrets Manager | Interface | ~$7/month | Secrets retrieval            |
| CloudWatch Logs | Interface | ~$7/month | Log shipping                 |

**Total VPC Endpoints Cost:** ~$28/month (when enabled)

## VPC Flow Logs

- **Destination:** CloudWatch Logs
- **Traffic Type:** ALL (Accept + Reject)
- **Retention:** 30 days (configurable)
- **Optional:** S3 export for long-term analysis with Athena

## High Availability Design

1. **Multi-AZ Deployment:** Resources spread across 3 Availability Zones
2. **Redundant NAT Gateway:** Optional per-AZ NAT Gateways for production
3. **Database Replication:** RDS Multi-AZ and ElastiCache replication
4. **Load Balancer:** ALB spans all public subnets

## Network Security Best Practices

1. **No Direct Internet Access:** Private/Database subnets have no Internet Gateway route
2. **VPC Endpoints:** Reduce NAT Gateway traffic and improve security
3. **Security Groups:** Least privilege access between tiers
4. **Flow Logs:** Complete network traffic visibility
5. **Private DNS:** Enable DNS hostnames for VPC endpoint resolution
