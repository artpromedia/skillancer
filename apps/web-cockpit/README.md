# Web Cockpit - Executive Dashboard

Multi-tenant dashboard for fractional executives.

## Tech Stack

- **Framework**: Next.js 14+
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts / Tremor

## Getting Started

```bash
# From monorepo root
pnpm dev --filter=@skillancer/web-cockpit

# Or from this directory
pnpm dev
```

## Features

- Multi-tenant workspace management
- Real-time analytics and KPIs
- Integration management
- Team collaboration tools
- Custom reporting

## Structure

```
web-cockpit/
├── src/
│   ├── app/           # Next.js App Router
│   ├── components/    # Page-specific components
│   ├── features/      # Feature modules
│   └── lib/           # Utilities and helpers
├── public/            # Static assets
└── package.json
```
