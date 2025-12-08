# Web - Marketing & Shared Shell

The main Skillancer marketing website and shared application shell.

## Tech Stack

- **Framework**: Next.js 14+
- **Language**: TypeScript
- **Styling**: Tailwind CSS

## Getting Started

```bash
# From monorepo root
pnpm dev --filter=@skillancer/web

# Or from this directory
pnpm dev
```

## Structure

```
web/
├── src/
│   ├── app/           # Next.js App Router
│   ├── components/    # Page-specific components
│   └── lib/           # Utilities and helpers
├── public/            # Static assets
└── package.json
```
