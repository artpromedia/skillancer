---
sidebar_position: 1
slug: /getting-started
---

# Getting Started

Welcome to the Skillancer developer documentation! This guide will help you set up your development environment and start contributing to the platform.

## What is Skillancer?

Skillancer is a comprehensive platform for the global workforce, consisting of three main products:

- **SkillPod** - Secure Virtual Desktop Infrastructure (VDI) environments for remote work
- **Skillancer Market** - A freelancer marketplace connecting talent with opportunities
- **Cockpit** - An executive dashboard for fractional executives and consultants

## Quick Start

Get up and running in minutes:

```bash
# Clone the repository
git clone https://github.com/artpromedia/skillancer.git
cd skillancer

# Run the automated setup
make setup

# Start all services in development mode
make dev
```

That's it! You should now have the entire Skillancer stack running locally.

## What's Running?

After setup, you'll have access to:

| Service       | URL                        | Description            |
| ------------- | -------------------------- | ---------------------- |
| Web App       | http://localhost:3000      | Main marketing site    |
| Market App    | http://localhost:3010      | Freelancer marketplace |
| Cockpit App   | http://localhost:3020      | Executive dashboard    |
| SkillPod App  | http://localhost:3030      | VDI admin interface    |
| API Gateway   | http://localhost:3001      | API entry point        |
| API Docs      | http://localhost:3001/docs | Swagger documentation  |
| Mailhog       | http://localhost:8025      | Email testing          |
| Prisma Studio | http://localhost:5555      | Database browser       |
| Jaeger        | http://localhost:16686     | Distributed tracing    |

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm 8+** - Install with `npm install -g pnpm`
- **Docker Desktop** - [Download](https://docker.com/)
- **Git** - [Download](https://git-scm.com/)
- **Make** - Usually pre-installed on macOS/Linux

:::tip Windows Users
On Windows, we recommend using [WSL2](https://docs.microsoft.com/en-us/windows/wsl/install) for the best development experience. Alternatively, you can use Git Bash or PowerShell.
:::

## Next Steps

<div className="features">
  <div className="feature">
    <div className="feature__icon">📁</div>
    <div className="feature__title">Project Structure</div>
    <div className="feature__description">
      Understand how the monorepo is organized and where to find things.
    </div>
    <a href="/docs/getting-started/project-structure">Learn more →</a>
  </div>
  
  <div className="feature">
    <div className="feature__icon">🔧</div>
    <div className="feature__title">Development Workflow</div>
    <div className="feature__description">
      Learn our development practices, branching strategy, and CI/CD pipeline.
    </div>
    <a href="/docs/getting-started/workflow">Learn more →</a>
  </div>
  
  <div className="feature">
    <div className="feature__icon">🧪</div>
    <div className="feature__title">Running Tests</div>
    <div className="feature__description">
      How to run unit tests, integration tests, and E2E tests.
    </div>
    <a href="/docs/getting-started/testing">Learn more →</a>
  </div>
</div>

## Getting Help

- **Discord**: Join our [developer community](https://discord.gg/skillancer)
- **GitHub Issues**: Report bugs or request features
- **Internal Docs**: Check the `/docs` folder in each package for package-specific documentation
