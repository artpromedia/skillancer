---
sidebar_position: 2
---

# Installation

This guide walks you through setting up the Skillancer development environment.

## Clone the Repository

```bash
git clone https://github.com/artpromedia/skillancer.git
cd skillancer
```

## Automated Setup

The easiest way to get started is using our setup script:

```bash
make setup
```

This command will:

1. Install all dependencies via pnpm
2. Set up Git hooks (Husky)
3. Copy environment templates
4. Start Docker infrastructure (PostgreSQL, Redis, etc.)
5. Run database migrations
6. Seed the database with sample data

## Manual Setup

If you prefer manual control or the automated setup fails, follow these steps:

### 1. Install Dependencies

```bash
pnpm install
```

This installs dependencies for all workspaces in the monorepo.

### 2. Set Up Environment Variables

```bash
# Copy the environment template
cp .env.example .env

# For each app/service that needs configuration:
cp apps/web/.env.example apps/web/.env.local
cp services/api-gateway/.env.example services/api-gateway/.env
# ... repeat for other services
```

Edit the `.env` files with your local configuration. Most defaults work out of the box.

### 3. Start Infrastructure

```bash
# Start PostgreSQL, Redis, LocalStack, etc.
make docker-up

# Or using docker compose directly
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

### 4. Set Up the Database

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate:dev

# Seed with sample data
pnpm db:seed
```

### 5. Start Development Servers

```bash
# Start all services
pnpm dev

# Or start specific services
pnpm --filter @skillancer/web dev
pnpm --filter @skillancer/api-gateway dev
```

## Verify Installation

Check that everything is running:

```bash
# Health check all services
make health

# Or manually check:
curl http://localhost:3001/health  # API Gateway
curl http://localhost:3000         # Web App
```

Open http://localhost:3000 in your browser. You should see the Skillancer homepage.

## Common Setup Issues

### Port Already in Use

```bash
# Find what's using a port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process or change the port in .env
```

### Docker Not Running

```bash
# Check Docker status
docker info

# If not running, start Docker Desktop
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker compose ps

# Check logs
docker compose logs postgres

# Reset if needed
make docker-down
make docker-up
```

### Prisma Migration Issues

```bash
# Reset database (WARNING: deletes all data)
pnpm db:migrate:reset

# Or push schema directly (for development)
pnpm db:push
```

### pnpm Install Failures

```bash
# Clear pnpm cache
pnpm store prune

# Delete node_modules and reinstall
rm -rf node_modules
rm -rf **/node_modules
pnpm install
```

## Environment Variables Reference

Key environment variables you may need to configure:

| Variable            | Default                  | Description                       |
| ------------------- | ------------------------ | --------------------------------- |
| `DATABASE_URL`      | `postgresql://...`       | PostgreSQL connection string      |
| `REDIS_URL`         | `redis://localhost:6379` | Redis connection string           |
| `JWT_SECRET`        | `dev-secret-change-me`   | JWT signing secret                |
| `NEXTAUTH_SECRET`   | `dev-secret-change-me`   | NextAuth.js secret                |
| `STRIPE_SECRET_KEY` | -                        | Stripe API key (optional for dev) |

See `.env.example` for the complete list.

## Development Commands

After setup, these commands are available:

```bash
# Start everything
make dev

# Run tests
make test

# Lint and format
make lint
make format

# Database operations
make db-studio    # Open Prisma Studio
make db-migrate   # Run migrations
make db-seed      # Seed database

# Docker operations
make docker-up    # Start infrastructure
make docker-down  # Stop infrastructure
make docker-logs  # View logs

# Clean up
make clean        # Remove build artifacts
make reset        # Full reset (containers, deps, database)
```

## IDE Setup

### VS Code

The repository includes VS Code settings. When you open the project:

1. Install recommended extensions when prompted
2. Settings are automatically applied from `.vscode/settings.json`

### Other IDEs

For other IDEs, configure:

- TypeScript server to use workspace version
- ESLint integration
- Prettier as default formatter
- Tailwind CSS IntelliSense

## Next Steps

- [Project Structure](/docs/getting-started/project-structure) - Understand the codebase layout
- [Development Workflow](/docs/getting-started/workflow) - Learn our development practices
