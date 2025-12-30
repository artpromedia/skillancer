# Skillancer API Documentation

Welcome to the Skillancer API. This RESTful API enables you to integrate Skillancer's marketplace functionality into your applications.

## Base URL

```
Production: https://api.skillancer.com/v1
Staging:    https://api.staging.skillancer.com/v1
```

## Authentication

All API requests require authentication using Bearer tokens.

### Obtaining an API Key

1. Log in to your Skillancer account
2. Navigate to **Settings → API Access**
3. Click **"Generate API Key"**
4. Store your key securely (shown only once)

### Using the API Key

Include the token in the Authorization header:

```bash
curl -X GET "https://api.skillancer.com/v1/jobs" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### OAuth 2.0 (User Authorization)

For actions on behalf of users, use OAuth 2.0:

```
Authorization URL: https://skillancer.com/oauth/authorize
Token URL:         https://api.skillancer.com/oauth/token
```

**Supported Grant Types:**

- Authorization Code (recommended)
- Refresh Token

## Rate Limits

| Plan         | Requests/Minute | Requests/Day |
| ------------ | --------------- | ------------ |
| Free         | 60              | 1,000        |
| Professional | 300             | 10,000       |
| Enterprise   | 1,000           | 100,000      |

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640000000
```

### Handling Rate Limits

When exceeded, you'll receive:

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "retry_after": 30
}
```

## Error Handling

### HTTP Status Codes

| Code | Meaning          |
| ---- | ---------------- |
| 200  | Success          |
| 201  | Created          |
| 400  | Bad Request      |
| 401  | Unauthorized     |
| 403  | Forbidden        |
| 404  | Not Found        |
| 422  | Validation Error |
| 429  | Rate Limited     |
| 500  | Server Error     |

### Error Response Format

```json
{
  "error": "validation_error",
  "message": "Invalid request parameters",
  "details": [
    {
      "field": "budget",
      "message": "Must be a positive number"
    }
  ],
  "request_id": "req_abc123"
}
```

## Pagination

List endpoints use cursor-based pagination:

```json
{
  "data": [...],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJpZCI6MTAwfQ==",
    "prev_cursor": null
  }
}
```

### Query Parameters

| Parameter | Default | Max | Description       |
| --------- | ------- | --- | ----------------- |
| `limit`   | 20      | 100 | Items per page    |
| `cursor`  | null    | -   | Pagination cursor |

## Webhooks

Receive real-time notifications for events. See [Webhooks Documentation](./webhooks.md).

## SDKs Available

| Language   | Package           | Install                                      |
| ---------- | ----------------- | -------------------------------------------- |
| JavaScript | `@skillancer/sdk` | `npm install @skillancer/sdk`                |
| Python     | `skillancer`      | `pip install skillancer`                     |
| Ruby       | `skillancer`      | `gem install skillancer`                     |
| PHP        | `skillancer/sdk`  | `composer require skillancer/sdk`            |
| Go         | `skillancer-go`   | `go get github.com/skillancer/skillancer-go` |

### JavaScript Example

```javascript
import { Skillancer } from '@skillancer/sdk';

const client = new Skillancer({ apiKey: 'YOUR_API_KEY' });

const jobs = await client.jobs.list({ category: 'web-development' });
```

## API Versioning

The API version is included in the URL path (`/v1/`). We maintain backward compatibility within major versions.

### Deprecation Policy

- 12-month notice before breaking changes
- Deprecation warnings in response headers
- Migration guides provided

## Support

- **Documentation**: https://docs.skillancer.com
- **Status Page**: https://status.skillancer.com
- **Support Email**: api-support@skillancer.com
