# ADR-004: JWT Authentication Strategy

## Status

**Accepted**

- Date: 2024-01-20
- Deciders: Engineering Team, Security Lead

## Context

Skillancer needs a secure authentication system that supports:

- Stateless authentication for microservices
- Multiple client types (web, mobile, API)
- Role-based access control
- Session management
- Token refresh mechanisms

### Security Requirements

- Tokens must be short-lived
- Support for token revocation
- Protection against common attacks (XSS, CSRF)
- Audit trail for authentication events

## Decision

**We will use JWT (JSON Web Tokens) with a dual-token strategy (access + refresh tokens).**

### Token Strategy

| Token Type    | Storage         | Lifetime   | Purpose            |
| ------------- | --------------- | ---------- | ------------------ |
| Access Token  | Memory          | 15 minutes | API authentication |
| Refresh Token | HttpOnly Cookie | 7 days     | Token renewal      |

```typescript
// Token payload structure
interface AccessTokenPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
  iat: number; // Issued at
  exp: number; // Expiration
  jti: string; // JWT ID for revocation
}

interface RefreshTokenPayload {
  sub: string; // User ID
  tokenFamily: string; // For rotation detection
  iat: number;
  exp: number;
  jti: string;
}
```

## Alternatives Considered

### Option A: Session-Based Authentication

**Pros:**

- Simple implementation
- Easy revocation
- Server controls session state

**Cons:**

- Requires session storage (Redis)
- Not suitable for microservices
- Horizontal scaling complexity
- Every request hits session store

### Option B: JWT Only (Single Token)

**Pros:**

- Stateless
- Simple implementation
- Good for short-lived operations

**Cons:**

- No refresh mechanism
- User must re-login frequently
- Difficult to revoke

### Option C: JWT with Dual Tokens (Selected)

**Pros:**

- Stateless API authentication
- Short access token limits exposure
- Refresh token enables long sessions
- Supports token rotation
- Works well with microservices

**Cons:**

- More complex implementation
- Need to handle token refresh flow
- Requires some state for refresh tokens

### Option D: OAuth 2.0 with External Provider

**Pros:**

- Delegated security
- Social login support
- Standards compliant

**Cons:**

- External dependency
- More complex setup
- May not fit all use cases

## Consequences

### Positive

1. **Stateless**: Services validate tokens without database lookup
2. **Scalability**: No session state to synchronize
3. **Security**: Short-lived access tokens limit exposure
4. **Flexibility**: Works with web, mobile, and API clients
5. **Revocation**: Refresh token tracking enables logout

### Negative

1. **Complexity**: Dual-token flow is more complex
   - _Mitigation_: Well-documented implementation
2. **Token refresh handling**: Clients must handle expiry
   - _Mitigation_: SDK/library for common clients
3. **Revocation delay**: Access tokens valid until expiry
   - _Mitigation_: 15-minute lifetime limits exposure

## Implementation

### Token Generation

```typescript
import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TOKEN_SECRET = new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET);

export async function generateAccessToken(user: User): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setJti(crypto.randomUUID())
    .sign(ACCESS_TOKEN_SECRET);
}
```

### Token Verification Middleware

```typescript
// Fastify plugin
export const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null);

  fastify.addHook('onRequest', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const token = authHeader.slice(7);
    try {
      const { payload } = await jwtVerify(token, ACCESS_TOKEN_SECRET);
      request.user = payload;
    } catch {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  });
};
```

### Refresh Token Flow

```
┌────────┐                    ┌────────────┐                    ┌──────────┐
│ Client │                    │ API Gateway│                    │ User Svc │
└────┬───┘                    └─────┬──────┘                    └────┬─────┘
     │                              │                                 │
     │  POST /auth/refresh          │                                 │
     │  Cookie: refresh_token       │                                 │
     │─────────────────────────────▶│                                 │
     │                              │  Validate refresh token         │
     │                              │────────────────────────────────▶│
     │                              │                                 │
     │                              │  User data + new tokens         │
     │                              │◀────────────────────────────────│
     │                              │                                 │
     │  200 OK                      │                                 │
     │  { accessToken }             │                                 │
     │  Set-Cookie: refresh_token   │                                 │
     │◀─────────────────────────────│                                 │
```

### Security Headers

```typescript
// Cookie settings for refresh token
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true, // Prevents XSS access
  secure: true, // HTTPS only
  sameSite: 'strict', // CSRF protection
  path: '/auth/refresh', // Limited path
  maxAge: 7 * 24 * 60 * 60, // 7 days
};
```

## References

- [JWT Best Practices (RFC 8725)](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [jose library](https://github.com/panva/jose)
