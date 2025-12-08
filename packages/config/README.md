# Config Package

Shared configuration files for the Skillancer monorepo.

## TypeScript Configurations

The package provides several TypeScript configurations for different project types:

### Available Configs

| Config | Use Case |
|--------|----------|
| `tsconfig/base.json` | Base configuration with strict settings |
| `tsconfig/nextjs.json` | Next.js applications |
| `tsconfig/node.json` | Node.js backend services |
| `tsconfig/react-library.json` | React component libraries |
| `tsconfig/library.json` | Pure TypeScript libraries |

### Usage

#### Next.js Applications

```json
// apps/web/tsconfig.json
{
  "extends": "@skillancer/config/tsconfig/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", ".next"]
}
```

#### Node.js Services

```json
// services/api-gateway/tsconfig.json
{
  "extends": "@skillancer/config/tsconfig/node.json",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

#### React Libraries

```json
// packages/ui/tsconfig.json
{
  "extends": "@skillancer/config/tsconfig/react-library.json",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

#### Pure TypeScript Libraries

```json
// packages/utils/tsconfig.json
{
  "extends": "@skillancer/config/tsconfig/library.json",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Path Aliases

The configs include predefined path aliases for workspace packages:

```json
{
  "paths": {
    "@skillancer/ui": ["../../packages/ui/src"],
    "@skillancer/types": ["../../packages/types/src"],
    "@skillancer/utils": ["../../packages/utils/src"],
    "@skillancer/database": ["../../packages/database/src"],
    "@skillancer/cache": ["../../packages/cache/src"],
    "@skillancer/api-client": ["../../packages/api-client/src"]
  }
}
```

### Strict Mode Settings

All configs enforce strict TypeScript settings:

- `strict: true` - Enable all strict type checking options
- `noUncheckedIndexedAccess: true` - Add `undefined` to index signatures
- `exactOptionalPropertyTypes: true` - Differentiate between `undefined` and optional
- `noImplicitReturns: true` - Require explicit return statements
- `noFallthroughCasesInSwitch: true` - Prevent switch fallthrough
- `noImplicitOverride: true` - Require `override` keyword

## ESLint Configurations

### Available Presets

| Preset | Use Case |
|--------|----------|
| `eslint-preset.js` | Base configuration |
| `eslint-next.js` | Next.js applications |
| `eslint-node.js` | Node.js services |

### Usage

```js
// .eslintrc.js
module.exports = {
  extends: ['@skillancer/config/eslint-preset'],
};

// For Next.js
module.exports = {
  extends: ['@skillancer/config/eslint-next'],
};

// For Node.js
module.exports = {
  extends: ['@skillancer/config/eslint-node'],
};
```

## Prettier Configuration

```js
// prettier.config.js
module.exports = require('@skillancer/config/prettier-preset');
```

## Customization

### Overriding Settings

You can override any setting in your local config:

```json
{
  "extends": "@skillancer/config/tsconfig/node.json",
  "compilerOptions": {
    "noUncheckedIndexedAccess": false
  }
}
```

### Adding New Path Aliases

```json
{
  "extends": "@skillancer/config/tsconfig/nextjs.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@lib/*": ["./src/lib/*"]
    }
  }
}
```
