# ===========================================
# Skillancer Makefile
# ===========================================
# Common development commands

.PHONY: help setup dev build test lint clean docker db

# Default target
.DEFAULT_GOAL := help

# Colors
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

# Docker compose command (supports both old and new syntax)
DOCKER_COMPOSE := $(shell command -v docker-compose 2> /dev/null || echo "docker compose")

#@ Help
help: ## Show this help message
	@echo ""
	@echo "$(CYAN)Skillancer Development Commands$(NC)"
	@echo "=================================="
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) }' $(MAKEFILE_LIST)
	@echo ""

##@ Setup

setup: ## Run initial project setup
	@./scripts/setup.sh

install: ## Install dependencies
	@pnpm install

reinstall: ## Clean install dependencies
	@rm -rf node_modules pnpm-lock.yaml
	@pnpm install

##@ Development

dev: ## Start development servers
	@./scripts/dev.sh

dev-web: ## Start only web app
	@./scripts/dev.sh --filter=web

dev-api: ## Start all API services
	@./scripts/dev.sh --filter='api-*'

dev-services: ## Start backend services
	@./scripts/dev.sh --filter='./services/*'

dev-tools: ## Start with admin tools (pgAdmin, Redis Commander)
	@./scripts/dev.sh --with-tools

##@ Build

build: ## Build all packages
	@pnpm build

build-packages: ## Build only packages
	@pnpm build --filter='./packages/*'

build-apps: ## Build only apps
	@pnpm build --filter='./apps/*'

build-services: ## Build only services
	@pnpm build --filter='./services/*'

typecheck: ## Run type checking
	@pnpm typecheck

##@ Testing

test: ## Run all tests
	@pnpm test

test-watch: ## Run tests in watch mode
	@pnpm test:watch

test-coverage: ## Run tests with coverage
	@pnpm test:coverage

test-e2e: ## Run end-to-end tests
	@pnpm test:e2e

##@ Code Quality

lint: ## Run linting
	@pnpm lint

lint-fix: ## Run linting with auto-fix
	@pnpm lint --fix

format: ## Format code with Prettier
	@pnpm format

format-check: ## Check code formatting
	@pnpm format:check

##@ Database

db-generate: ## Generate Prisma client
	@pnpm db:generate

db-migrate: ## Run database migrations
	@pnpm db:migrate:dev

db-push: ## Push schema changes (no migration)
	@pnpm db:push

db-reset: ## Reset database and re-run migrations
	@./scripts/reset-db.sh

db-reset-force: ## Reset database without confirmation
	@./scripts/reset-db.sh --force

db-seed: ## Seed database with sample data
	@pnpm db:seed

db-studio: ## Open Prisma Studio
	@pnpm db:studio

##@ Docker

docker-up: ## Start Docker services
	@cd infrastructure/docker && $(DOCKER_COMPOSE) up -d postgres redis mailhog localstack

docker-down: ## Stop Docker services
	@cd infrastructure/docker && $(DOCKER_COMPOSE) down

docker-restart: ## Restart Docker services
	@cd infrastructure/docker && $(DOCKER_COMPOSE) restart

docker-tools: ## Start with optional tools (pgAdmin, Redis Commander, Minio)
	@cd infrastructure/docker && $(DOCKER_COMPOSE) --profile tools up -d

docker-logs: ## Show Docker logs
	@cd infrastructure/docker && $(DOCKER_COMPOSE) logs -f

docker-logs-postgres: ## Show PostgreSQL logs
	@cd infrastructure/docker && $(DOCKER_COMPOSE) logs -f postgres

docker-logs-redis: ## Show Redis logs
	@cd infrastructure/docker && $(DOCKER_COMPOSE) logs -f redis

docker-logs-localstack: ## Show LocalStack logs
	@cd infrastructure/docker && $(DOCKER_COMPOSE) logs -f localstack

docker-ps: ## Show running containers
	@cd infrastructure/docker && $(DOCKER_COMPOSE) ps

docker-clean: ## Stop and remove Docker volumes
	@cd infrastructure/docker && $(DOCKER_COMPOSE) down -v --remove-orphans

##@ Cleanup

clean: ## Clean build artifacts
	@./scripts/clean.sh

clean-all: ## Clean everything (including node_modules and Docker)
	@./scripts/clean.sh --all

clean-node: ## Clean only node_modules
	@./scripts/clean.sh --node-modules

clean-docker: ## Clean only Docker resources
	@./scripts/clean.sh --docker

##@ Utilities

deps-check: ## Check for dependency updates
	@pnpm outdated

deps-update: ## Update dependencies interactively
	@pnpm update -i

graph: ## Show dependency graph
	@pnpm nx graph

new-package: ## Create a new package (usage: make new-package name=my-package)
	@mkdir -p packages/$(name)/src
	@echo '{"name":"@skillancer/$(name)","version":"0.0.0","main":"./src/index.ts","types":"./src/index.ts","scripts":{"build":"tsup","lint":"eslint .","typecheck":"tsc --noEmit"}}' | jq . > packages/$(name)/package.json
	@echo "export {};" > packages/$(name)/src/index.ts
	@echo "Created packages/$(name)"

##@ CI/CD

ci: ## Run CI checks (lint, typecheck, test)
	@pnpm lint
	@pnpm typecheck
	@pnpm test

pre-commit: ## Run pre-commit checks
	@pnpm lint-staged

##@ Services URLs

urls: ## Show service URLs
	@echo ""
	@echo "$(CYAN)Skillancer Service URLs$(NC)"
	@echo "========================"
	@echo ""
	@echo "$(GREEN)Applications:$(NC)"
	@echo "  Web App:           http://localhost:3000"
	@echo "  API Gateway:       http://localhost:3001"
	@echo "  API Docs:          http://localhost:3001/docs"
	@echo ""
	@echo "$(GREEN)Development Tools:$(NC)"
	@echo "  Mailhog:           http://localhost:8025"
	@echo "  Prisma Studio:     http://localhost:5555"
	@echo "  LocalStack:        http://localhost:4566"
	@echo ""
	@echo "$(GREEN)Optional Tools (run 'make docker-tools'):$(NC)"
	@echo "  pgAdmin:           http://localhost:5050"
	@echo "  Redis Commander:   http://localhost:8081"
	@echo "  Minio Console:     http://localhost:9001"
	@echo ""
