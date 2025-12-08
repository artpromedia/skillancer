# UI Package

Shared React UI component library for all Skillancer web applications.

## Tech Stack

- **Framework**: React 18+
- **Styling**: Tailwind CSS + CVA
- **Components**: Radix UI primitives
- **Icons**: Lucide React
- **Documentation**: Storybook

## Getting Started

```bash
# From monorepo root
pnpm dev --filter=@skillancer/ui

# Run Storybook
pnpm storybook --filter=@skillancer/ui
```

## Usage

```tsx
import { Button, Dialog, Input } from '@skillancer/ui';

function MyComponent() {
  return (
    <Button variant="primary" size="lg">
      Click me
    </Button>
  );
}
```

## Structure

```
ui/
├── src/
│   ├── components/
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Dialog/
│   │   └── ...
│   ├── hooks/
│   ├── utils/
│   └── index.ts
├── stories/
└── package.json
```
