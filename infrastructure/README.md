# Infrastructure

This directory contains Infrastructure as Code (IaC) definitions for the Skillancer platform.

## Structure

```
infrastructure/
├── terraform/          # Terraform modules and configurations
│   ├── modules/        # Reusable modules
│   ├── environments/   # Environment-specific configs
│   └── main.tf
└── docker/             # Docker configurations
    ├── Dockerfile.*    # Service Dockerfiles
    └── docker-compose.yml
```

## Terraform

See [terraform/README.md](./terraform/README.md) for details.

## Docker

See [docker/README.md](./docker/README.md) for details.
