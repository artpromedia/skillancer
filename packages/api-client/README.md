# API Client

Auto-generated TypeScript API client for Skillancer backend services.

## Generation

The client is generated from OpenAPI specifications:

```bash
pnpm generate --filter=@skillancer/api-client
```

## Usage

```typescript
import { SkillancerClient } from '@skillancer/api-client';

const client = new SkillancerClient({
  baseUrl: process.env.API_URL,
  token: authToken,
});

// Example usage
const user = await client.users.getById('user-id');
const projects = await client.market.listProjects();
```

## Features

- Type-safe API calls
- Automatic token injection
- Request/response interceptors
- Error handling
- Retry logic
