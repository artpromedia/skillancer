# Web SkillPod - VDI Admin & Viewer

Browser-based VDI administration and viewer interface.

## Tech Stack

- **Framework**: Next.js 14+
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **WebRTC**: For real-time streaming

## Getting Started

```bash
# From monorepo root
pnpm dev --filter=@skillancer/web-skillpod

# Or from this directory
pnpm dev
```

## Features

- VDI session management
- Real-time screen streaming
- Input capture and relay
- Session recording
- Resource monitoring

## Structure

```
web-skillpod/
├── src/
│   ├── app/           # Next.js App Router
│   ├── components/    # Page-specific components
│   ├── features/      # Feature modules
│   └── lib/           # Utilities and helpers
├── public/            # Static assets
└── package.json
```
