# @skillancer/shared-api-client

Shared API client library for Skillancer web applications (web-market, web-cockpit, admin).

## Features

- **Base HTTP client** using axios with interceptors
- **Request/response typing** with TypeScript generics
- **Automatic token attachment** from auth store
- **Request retry logic** with exponential backoff
- **Request cancellation** support
- **Type-safe endpoint definitions** for all backend services
- **Environment-based configuration** (dev/staging/prod)

## Installation

```bash
pnpm add @skillancer/shared-api-client
```

## Usage

### Basic Setup

```typescript
import {
  createApiClient,
  LocalStorageTokenStorage,
  getEnvironmentConfig,
} from '@skillancer/shared-api-client';

// Create client with local storage tokens
const apiClient = createApiClient({
  baseUrl: getEnvironmentConfig().apiGateway,
  tokenStorage: new LocalStorageTokenStorage(),
  debug: process.env.NODE_ENV === 'development',
  onAuthFailure: () => {
    // Redirect to login
    window.location.href = '/login';
  },
});

// Make requests
const response = await apiClient.get<User>('/users/me');
console.log(response.data);
```

### With Zustand Auth Store

```typescript
import { createApiClient, createZustandTokenStorage } from '@skillancer/shared-api-client';
import { useAuthStore } from './stores/auth';

const apiClient = createApiClient({
  baseUrl: 'https://api.skillancer.com',
  tokenStorage: createZustandTokenStorage(
    () => useAuthStore.getState(),
    (accessToken, refreshToken) => useAuthStore.getState().setTokens(accessToken, refreshToken),
    () => useAuthStore.getState().logout()
  ),
});
```

### Using Endpoints

```typescript
import { AUTH_ENDPOINTS, MARKET_ENDPOINTS } from '@skillancer/shared-api-client/endpoints';

// Login
const loginResponse = await apiClient.post(AUTH_ENDPOINTS.LOGIN, {
  email: 'user@example.com',
  password: 'password123',
});

// Get jobs
const jobs = await apiClient.get(MARKET_ENDPOINTS.JOBS, {
  params: { page: 1, limit: 20 },
});

// Get job by ID
const job = await apiClient.get(MARKET_ENDPOINTS.JOB_BY_ID('job-123'));
```

### Request Cancellation

```typescript
// Create a cancellable request
const { promise, cancel } = apiClient.createCancellableRequest('search-jobs', (cancelToken) =>
  apiClient.get('/jobs/search', {
    params: { query: 'react developer' },
    // Pass the cancel token
  })
);

// Cancel if needed (e.g., user types new search term)
cancel('New search initiated');

// Or cancel all pending requests
apiClient.cancelAllRequests();
```

### Custom Request Configuration

```typescript
// With custom timeout and retries
const response = await apiClient.get('/slow-endpoint', {
  timeout: 60000,
  retries: 5,
  retryDelay: 2000,
});

// Skip authentication
const publicData = await apiClient.get('/public/data', {
  skipAuth: true,
});

// With abort signal
const controller = new AbortController();
const response = await apiClient.get('/data', {
  signal: controller.signal,
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);
```

### Error Handling

```typescript
import { ApiError, isApiErrorInstance } from '@skillancer/shared-api-client';

try {
  await apiClient.post('/users', userData);
} catch (error) {
  if (isApiErrorInstance(error)) {
    if (error.isValidationError()) {
      // Handle validation errors
      error.validationErrors?.forEach((err) => {
        console.log(`${err.field}: ${err.message}`);
      });
    } else if (error.isAuthError()) {
      // Handle authentication errors
      redirectToLogin();
    } else if (error.isRateLimitError()) {
      // Handle rate limiting
      showRateLimitMessage();
    }
  }
}
```

### Type-Safe Responses

```typescript
import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

interface User {
  id: string;
  email: string;
  name: string;
}

// Single item response
const userResponse: ApiResponse<User> = await apiClient.get('/users/me');
console.log(userResponse.data.name);

// Paginated response
const usersResponse: PaginatedResponse<User> = await apiClient.get('/users', {
  params: { page: 1, limit: 20 },
});
console.log(usersResponse.data); // User[]
console.log(usersResponse.meta.totalPages);
```

## API Reference

### `createApiClient(config)`

Creates a new API client instance.

```typescript
interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  tokenStorage?: TokenStorage;
  getAuthToken?: () => string | null;
  getRefreshToken?: () => string | null;
  onTokenRefresh?: (tokens: AuthTokens) => void;
  onAuthFailure?: () => void;
  debug?: boolean;
  requestInterceptor?: (config: RequestOptions) => RequestOptions;
  responseInterceptor?: <T>(response: ApiResponse<T>) => ApiResponse<T>;
  errorHandler?: (error: ApiError) => void;
}
```

### Token Storage Implementations

- `LocalStorageTokenStorage` - Persists tokens in localStorage
- `SessionStorageTokenStorage` - Persists tokens in sessionStorage
- `MemoryTokenStorage` - In-memory storage (for SSR/testing)
- `createZustandTokenStorage()` - Integration with Zustand stores

### Environment Configuration

```typescript
import { getEnvironmentConfig, detectEnvironment } from '@skillancer/shared-api-client/endpoints';

// Auto-detect environment
const config = getEnvironmentConfig();

// Or specify environment
const stagingConfig = getEnvironmentConfig('staging');

// Get specific service URL
import { getServiceUrl } from '@skillancer/shared-api-client/endpoints';
const authUrl = getServiceUrl('auth', 'production');
```

## License

Private - Skillancer Platform
