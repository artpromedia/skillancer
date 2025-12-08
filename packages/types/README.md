# Types Package

Shared TypeScript type definitions used across the Skillancer monorepo.

## Usage

```typescript
import type { User, Project, Workspace } from '@skillancer/types';
import { userSchema, projectSchema } from '@skillancer/types/schemas';
```

## Structure

```
types/
├── src/
│   ├── user.ts
│   ├── project.ts
│   ├── workspace.ts
│   ├── billing.ts
│   ├── schemas/          # Zod schemas
│   └── index.ts
└── package.json
```

## Guidelines

- All types should be exported from `index.ts`
- Use Zod for runtime validation schemas
- Keep types aligned with database models
- Document complex types with JSDoc
