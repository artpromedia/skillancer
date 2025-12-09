# API Reference

Welcome to the Skillancer API documentation. This section covers all backend service APIs, schemas, and authentication.

## API Overview

Skillancer uses a microservices architecture with RESTful APIs. Each service has its own API surface.

### Base URLs

| Environment | Base URL                             |
| ----------- | ------------------------------------ |
| Production  | `https://api.skillancer.com`         |
| Staging     | `https://api.staging.skillancer.com` |
| Local       | `http://localhost:3000`              |

### Services

| Service                                         | Prefix          | Description                        |
| ----------------------------------------------- | --------------- | ---------------------------------- |
| [User Service](./services/user)                 | `/user`         | Authentication, profiles, settings |
| [Project Service](./services/project)           | `/project`      | Projects, gigs, categories         |
| [Booking Service](./services/booking)           | `/booking`      | Orders, contracts, milestones      |
| [Payment Service](./services/payment)           | `/payment`      | Transactions, payouts              |
| [Notification Service](./services/notification) | `/notification` | Notifications, preferences         |

## Quick Start

### Making Your First Request

```bash
# Get your API token
TOKEN=$(curl -s -X POST https://api.skillancer.com/user/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "your-password"}' \
  | jq -r '.accessToken')

# Make an authenticated request
curl -s https://api.skillancer.com/user/me \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
```

### Response Format

All API responses follow a consistent format:

```json
// Success response
{
  "data": {
    "id": "usr_123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-25T10:30:00Z"
  }
}

// Error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address"
      }
    ]
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-25T10:30:00Z"
  }
}
```

### Pagination

List endpoints support pagination:

```bash
curl "https://api.skillancer.com/project/projects?page=1&limit=20"
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## Common Headers

| Header            | Required | Description                           |
| ----------------- | -------- | ------------------------------------- |
| `Authorization`   | Yes\*    | Bearer token for authentication       |
| `Content-Type`    | Yes      | `application/json` for POST/PUT/PATCH |
| `X-Request-ID`    | No       | Custom request ID for tracing         |
| `Accept-Language` | No       | Preferred language (default: `en`)    |

\*Required for authenticated endpoints

## Rate Limiting

API requests are rate-limited per user/IP:

| Tier          | Requests/minute | Burst |
| ------------- | --------------- | ----- |
| Anonymous     | 20              | 30    |
| Authenticated | 100             | 150   |
| Premium       | 500             | 750   |

Rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706176200
```

## Error Codes

### HTTP Status Codes

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| 200  | Success                                  |
| 201  | Created                                  |
| 204  | No Content                               |
| 400  | Bad Request - Invalid input              |
| 401  | Unauthorized - Missing/invalid token     |
| 403  | Forbidden - Insufficient permissions     |
| 404  | Not Found                                |
| 409  | Conflict - Resource already exists       |
| 422  | Unprocessable Entity - Validation failed |
| 429  | Too Many Requests - Rate limited         |
| 500  | Internal Server Error                    |

### Application Error Codes

| Code                   | Description                      |
| ---------------------- | -------------------------------- |
| `VALIDATION_ERROR`     | Input validation failed          |
| `AUTHENTICATION_ERROR` | Invalid credentials              |
| `TOKEN_EXPIRED`        | Access token has expired         |
| `RESOURCE_NOT_FOUND`   | Requested resource doesn't exist |
| `PERMISSION_DENIED`    | User lacks required permissions  |
| `DUPLICATE_RESOURCE`   | Resource already exists          |
| `RATE_LIMITED`         | Too many requests                |

## SDKs & Libraries

### Official SDKs

- TypeScript/JavaScript: `@skillancer/sdk` (coming soon)
- Python: `skillancer-python` (coming soon)

### OpenAPI Specification

Download the OpenAPI spec for code generation:

```bash
# Download spec
curl https://api.skillancer.com/openapi.json -o openapi.json

# Generate TypeScript client
npx openapi-typescript openapi.json --output ./types.ts
```

## Further Reading

- [Authentication](./authentication) - Detailed auth guide
- [Schemas](./schemas) - Data type definitions
- [Webhooks](./webhooks) - Event notifications
