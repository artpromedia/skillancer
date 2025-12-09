---
sidebar_position: 7
---

# Code Generation

Skillancer uses [Plop.js](https://plopjs.com/) for code generation to ensure consistency and speed up development.

## Available Generators

| Generator | Command              | Description                       |
| --------- | -------------------- | --------------------------------- |
| Service   | `pnpm new:service`   | Create a new backend microservice |
| Endpoint  | `pnpm new:endpoint`  | Add API endpoint to a service     |
| Component | `pnpm new:component` | Create a React component          |
| Package   | `pnpm new:package`   | Create a shared package           |

## Creating a Service

Generate a complete Fastify microservice with all boilerplate:

```bash
pnpm new:service
```

You'll be prompted for:

- **Service name** - Must end with `-svc` (e.g., `analytics-svc`)
- **Description** - Brief description
- **Port** - Port number (default: 3010)
- **Database** - Include Prisma/PostgreSQL
- **Redis** - Include Redis caching
- **Queue** - Include BullMQ

### Generated Structure

```
services/analytics-svc/
├── src/
│   ├── app.ts           # Fastify app factory
│   ├── server.ts        # Entry point
│   ├── index.ts         # Package exports
│   ├── config/          # Zod configuration
│   ├── plugins/         # Fastify plugins
│   ├── routes/          # API routes
│   │   ├── index.ts
│   │   └── health.ts
│   ├── middleware/      # Error handler, etc.
│   └── types/
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Next Steps After Creating Service

1. Copy `.env.example` to `.env`
2. Add service to `docker-compose.yml` if needed
3. Register in API Gateway
4. Add endpoints using the endpoint generator

## Creating an Endpoint

Add a new API endpoint to an existing service:

```bash
pnpm new:endpoint
```

You'll be prompted for:

- **Service** - Select from existing services
- **Endpoint name** - Resource name (e.g., `projects`)
- **HTTP methods** - GET, POST, PATCH, DELETE
- **Service layer** - Generate business logic layer
- **Repository layer** - Generate data access layer

### Generated Files

```
services/market-svc/src/
├── routes/
│   └── projects.ts        # Route handlers
├── schemas/
│   └── projects.schema.ts # Zod schemas
├── services/
│   └── projects.service.ts # Business logic
└── repositories/
    └── projects.repository.ts # Data access
```

### Register the Route

After generation, register in `routes/index.ts`:

```typescript
import { projectsRoutes } from './projects.js';

export async function registerRoutes(app: FastifyInstance) {
  // ... existing routes
  await app.register(projectsRoutes, { prefix: '/api/projects' });
}
```

## Creating a Component

Generate a React component with optional Storybook story and tests:

```bash
pnpm new:component
```

You'll be prompted for:

- **Location** - Where to create (packages/ui, apps/web, etc.)
- **Component name** - PascalCase (e.g., `UserProfile`)
- **Type** - forwardRef, simple, or server component
- **Storybook** - Generate story file
- **Tests** - Generate test file

### Generated Files

For a UI component in `packages/ui`:

```
packages/ui/src/components/user-profile/
├── user-profile.tsx      # Component
├── user-profile.stories.tsx # Storybook story
├── user-profile.test.tsx   # Tests
└── index.ts              # Barrel export
```

### Export the Component

Add to `packages/ui/src/index.ts`:

```typescript
export * from './components/user-profile';
```

## Creating a Package

Generate a new shared package:

```bash
pnpm new:package
```

You'll be prompted for:

- **Package name** - lowercase with hyphens (e.g., `analytics`)
- **Description** - Package description
- **Type** - TypeScript lib, React lib, or Node.js lib

### Package Types

| Type        | Use Case                  | Includes           |
| ----------- | ------------------------- | ------------------ |
| `ts-lib`    | Pure TypeScript utilities | tsup, vitest       |
| `react-lib` | React components          | + React, Storybook |
| `node-lib`  | Node.js utilities         | + @types/node      |

### Generated Structure

```
packages/analytics/
├── src/
│   └── index.ts         # Entry point
├── package.json
├── tsconfig.json
├── tsup.config.ts       # Build config
└── README.md
```

## Custom Generation

### Running Plop Directly

```bash
# Interactive mode
pnpm plop

# Specific generator
pnpm plop service
pnpm plop endpoint
```

### Plop Configuration

The configuration lives in `plopfile.js`:

```javascript
module.exports = function (plop) {
  // Helpers
  plop.setHelper('upperCase', (text) => text.toUpperCase());

  // Generators
  plop.setGenerator('service', {
    description: 'Create a new backend microservice',
    prompts: [
      /* ... */
    ],
    actions: [
      /* ... */
    ],
  });
};
```

### Templates

Templates are in `plop-templates/`:

```
plop-templates/
├── service/           # Service templates
│   ├── package.json.hbs
│   ├── src/
│   │   ├── app.ts.hbs
│   │   └── ...
├── endpoint/          # Endpoint templates
├── component/         # Component templates
└── package/           # Package templates
```

Templates use [Handlebars](https://handlebarsjs.com/) syntax:

```handlebars
{{! service/package.json.hbs }}
{ "name": "@skillancer/{{name}}", "version": "0.0.1", "description": "{{description}}",
{{#if withDatabase}}
  "dependencies": { "@skillancer/database": "workspace:*" }
{{/if}}
}
```

## Modifying Templates

To customize generated code:

1. Find the template in `plop-templates/`
2. Edit the `.hbs` file
3. Test by running the generator
4. Commit your changes

### Available Helpers

| Helper       | Description | Example                        |
| ------------ | ----------- | ------------------------------ |
| `pascalCase` | PascalCase  | `userProfile` → `UserProfile`  |
| `camelCase`  | camelCase   | `user-profile` → `userProfile` |
| `kebabCase`  | kebab-case  | `UserProfile` → `user-profile` |
| `snakeCase`  | snake_case  | `userProfile` → `user_profile` |
| `upperCase`  | UPPERCASE   | `name` → `NAME`                |
| `lowerCase`  | lowercase   | `NAME` → `name`                |

### Conditional Content

```handlebars
{{#if withDatabase}}
  import { prisma } from '@skillancer/database';
{{/if}}

{{#if (includes methods 'create')}}
  // POST handler
{{/if}}
```

## Best Practices

1. **Use generators for consistency** - Don't manually create services/components
2. **Keep templates updated** - When patterns change, update templates
3. **Add to existing templates** - If you find yourself repeating code, templatize it
4. **Document custom generators** - Add usage info to this page

## Next Steps

- [Contributing](/docs/getting-started/contributing) - Contributing guidelines
- [Architecture](/docs/architecture) - System architecture
