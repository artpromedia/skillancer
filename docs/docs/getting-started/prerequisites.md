---
sidebar_position: 1
---

# Prerequisites

Before setting up Skillancer for development, ensure you have the following tools installed.

## Required Software

### Node.js 20+

Skillancer requires Node.js 20 or later for ES modules support and performance improvements.

```bash
# Check your Node.js version
node --version

# Should output v20.x.x or higher
```

**Installation options:**

- [Official installer](https://nodejs.org/)
- [nvm (Node Version Manager)](https://github.com/nvm-sh/nvm) - Recommended for managing multiple versions
- [fnm](https://github.com/Schniz/fnm) - Fast Node.js version manager

```bash
# Using nvm
nvm install 20
nvm use 20

# Using fnm
fnm install 20
fnm use 20
```

### pnpm 8+

We use pnpm for its speed and disk efficiency in monorepo setups.

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version
```

:::tip Why pnpm?
pnpm uses hard links and a content-addressable store, which means:

- **Faster installs** - Dependencies are linked, not copied
- **Disk efficient** - Shared dependencies across projects
- **Strict** - Prevents phantom dependencies
  :::

### Docker Desktop

Docker is required for running infrastructure services (PostgreSQL, Redis, etc.) locally.

- [Docker Desktop for Mac](https://docs.docker.com/desktop/mac/install/)
- [Docker Desktop for Windows](https://docs.docker.com/desktop/windows/install/)
- [Docker Engine for Linux](https://docs.docker.com/engine/install/)

```bash
# Verify Docker is running
docker --version
docker compose version
```

### Git

Git 2.30+ is required for some advanced features we use.

```bash
git --version
```

### Make (optional but recommended)

Make simplifies running common commands. It's pre-installed on macOS and most Linux distributions.

**Windows:**

```powershell
# Using Chocolatey
choco install make

# Using winget
winget install GnuWin32.Make
```

## Recommended Tools

### VS Code Extensions

Install these extensions for the best development experience:

```json
// .vscode/extensions.json (already in repo)
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-azuretools.vscode-docker",
    "vitest.explorer",
    "formulahendry.auto-rename-tag",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

VS Code will prompt you to install these when you open the project.

### GitHub CLI

The GitHub CLI makes it easier to work with issues, PRs, and GitHub Actions.

```bash
# Install
brew install gh          # macOS
winget install GitHub.cli  # Windows

# Authenticate
gh auth login
```

### AWS CLI (for deployment)

If you'll be working with deployment or infrastructure:

```bash
# Install AWS CLI v2
# macOS
brew install awscli

# Windows
winget install Amazon.AWSCLI

# Verify
aws --version
```

## System Requirements

| Resource   | Minimum | Recommended |
| ---------- | ------- | ----------- |
| RAM        | 8 GB    | 16 GB       |
| Disk Space | 10 GB   | 20 GB       |
| CPU Cores  | 4       | 8           |

:::warning Docker Resources
Make sure Docker Desktop has adequate resources allocated. We recommend at least 4 GB of RAM and 2 CPUs for Docker.
:::

## Network Requirements

The following ports should be available:

| Port      | Service          |
| --------- | ---------------- |
| 3000-3030 | Web applications |
| 3001-3010 | Backend services |
| 5432      | PostgreSQL       |
| 6379      | Redis            |
| 8025      | Mailhog          |
| 5555      | Prisma Studio    |
| 16686     | Jaeger           |

## Next Steps

Once you have all prerequisites installed, proceed to [Installation](/docs/getting-started/installation).
