# Authentication

This guide covers authentication and authorization for the Skillancer API.

## Overview

Skillancer uses JWT (JSON Web Tokens) for API authentication with a dual-token strategy:

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to obtain new access tokens

## Authentication Flow

```
┌────────────┐                           ┌────────────┐
│   Client   │                           │    API     │
└─────┬──────┘                           └─────┬──────┘
      │                                        │
      │  1. POST /auth/login                   │
      │  { email, password }                   │
      │───────────────────────────────────────▶│
      │                                        │
      │  2. { accessToken, user }              │
      │     Set-Cookie: refreshToken           │
      │◀───────────────────────────────────────│
      │                                        │
      │  3. GET /api/resource                  │
      │     Authorization: Bearer <token>      │
      │───────────────────────────────────────▶│
      │                                        │
      │  4. { data }                           │
      │◀───────────────────────────────────────│
      │                                        │
      │  5. POST /auth/refresh (when expired)  │
      │     Cookie: refreshToken               │
      │───────────────────────────────────────▶│
      │                                        │
      │  6. { accessToken }                    │
      │     Set-Cookie: refreshToken (rotated) │
      │◀───────────────────────────────────────│
```

## Endpoints

### Register

Create a new user account.

```http
POST /user/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123!",
  "name": "John Doe",
  "role": "FREELANCER"
}
```

**Response (201 Created)**:

```json
{
  "data": {
    "user": {
      "id": "usr_123abc",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "FREELANCER",
      "createdAt": "2024-01-25T10:30:00Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Login

Authenticate with email and password.

```http
POST /user/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

**Response (200 OK)**:

```json
{
  "data": {
    "user": {
      "id": "usr_123abc",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "FREELANCER"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

The refresh token is set as an HttpOnly cookie:

```
Set-Cookie: refreshToken=eyJhbGc...; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=604800
```

### Refresh Token

Get a new access token using the refresh token.

```http
POST /user/auth/refresh
Cookie: refreshToken=eyJhbGc...
```

**Response (200 OK)**:

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Logout

Invalidate the refresh token.

```http
POST /user/auth/logout
Authorization: Bearer <access_token>
```

**Response (204 No Content)**

### Get Current User

Get the authenticated user's profile.

```http
GET /user/me
Authorization: Bearer <access_token>
```

**Response (200 OK)**:

```json
{
  "data": {
    "id": "usr_123abc",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "FREELANCER",
    "avatar": "https://cdn.skillancer.com/avatars/usr_123abc.jpg",
    "bio": "Full-stack developer...",
    "createdAt": "2024-01-25T10:30:00Z"
  }
}
```

## Using Access Tokens

Include the access token in the `Authorization` header for all authenticated requests:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  https://api.skillancer.com/user/me
```

### Token Structure

Access tokens are JWTs with the following payload:

```json
{
  "sub": "usr_123abc",
  "email": "user@example.com",
  "role": "FREELANCER",
  "iat": 1706176200,
  "exp": 1706177100,
  "jti": "tok_xyz789"
}
```

| Field   | Description                                 |
| ------- | ------------------------------------------- |
| `sub`   | User ID                                     |
| `email` | User email                                  |
| `role`  | User role (USER, FREELANCER, CLIENT, ADMIN) |
| `iat`   | Issued at timestamp                         |
| `exp`   | Expiration timestamp                        |
| `jti`   | Unique token ID                             |

## Handling Token Expiration

Access tokens expire after 15 minutes. Handle expiration by refreshing the token:

```typescript
// TypeScript example
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${getAccessToken()}`,
    },
  });

  if (response.status === 401) {
    // Token expired, try to refresh
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry with new token
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    }
    // Refresh failed, redirect to login
    redirectToLogin();
  }

  return response;
}
```

## Roles and Permissions

### User Roles

| Role         | Description                        |
| ------------ | ---------------------------------- |
| `USER`       | Basic user, can browse             |
| `FREELANCER` | Can create gigs, receive bookings  |
| `CLIENT`     | Can create projects, make bookings |
| `ADMIN`      | Full system access                 |

### Permission Matrix

| Resource        | USER | FREELANCER | CLIENT | ADMIN |
| --------------- | ---- | ---------- | ------ | ----- |
| View projects   | ✅   | ✅         | ✅     | ✅    |
| Create project  | ❌   | ❌         | ✅     | ✅    |
| Create gig      | ❌   | ✅         | ❌     | ✅    |
| Book freelancer | ❌   | ❌         | ✅     | ✅    |
| Manage users    | ❌   | ❌         | ❌     | ✅    |

## OAuth (Coming Soon)

Social authentication will be available for:

- Google
- GitHub
- LinkedIn

## API Keys (For Integrations)

For server-to-server integrations, use API keys instead of JWT:

```http
GET /api/resource
X-API-Key: sk_live_abc123...
```

API keys:

- Have configurable permissions
- Don't expire (but can be revoked)
- Are tied to organizations, not users

Contact support to obtain API keys.

## Security Best Practices

1. **Never expose tokens in URLs** - Use headers instead
2. **Store tokens securely** - Use HttpOnly cookies or secure storage
3. **Implement token refresh** - Don't rely on long-lived access tokens
4. **Handle logout properly** - Clear tokens and call logout endpoint
5. **Use HTTPS always** - Never send tokens over unencrypted connections

## Troubleshooting

### "Token expired" Error

```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Access token has expired"
  }
}
```

**Solution**: Call `/auth/refresh` to get a new access token.

### "Invalid token" Error

```json
{
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid or malformed token"
  }
}
```

**Possible causes**:

- Token is malformed
- Token was issued by a different environment
- Token signature doesn't match

**Solution**: Obtain a new token via login.

### "Refresh token invalid" Error

```json
{
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Refresh token is invalid or revoked"
  }
}
```

**Possible causes**:

- Refresh token expired (7 days)
- User logged out from another device
- Token was revoked by admin

**Solution**: Re-authenticate via login.
