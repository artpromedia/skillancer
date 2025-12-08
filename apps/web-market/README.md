# Web Market - Skillancer Marketplace

The Skillancer Market web application - a hybrid talent marketplace.

## Tech Stack

- **Framework**: Next.js 14+
- **Language**: TypeScript
- **Styling**: Tailwind CSS

## Getting Started

```bash
# From monorepo root
pnpm dev --filter=@skillancer/web-market

# Or from this directory
pnpm dev
```

## Features

- Talent discovery and search
- Project posting and bidding
- Real-time messaging
- Payment processing
- Reviews and ratings

## Structure

```
web-market/
├── src/
│   ├── app/           # Next.js App Router
│   ├── components/    # Page-specific components
│   ├── features/      # Feature modules
│   └── lib/           # Utilities and helpers
├── public/            # Static assets
└── package.json
```
