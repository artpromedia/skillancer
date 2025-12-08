# Docker Configuration

Docker configurations for local development and production builds.

## Local Development

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d postgres redis

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Production Images

Production Docker images are built in CI/CD and pushed to the container registry.

## Services

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Redis cache |
| mailhog | 8025 | Email testing |
