# User Service API

The User Service handles authentication, user profiles, and account management.

**Base URL**: `/user`

## Endpoints

### Authentication

#### Register

Create a new user account.

```http
POST /user/auth/register
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "role": "FREELANCER"
}
```

| Field    | Type   | Required | Description                             |
| -------- | ------ | -------- | --------------------------------------- |
| email    | string | Yes      | Valid email address                     |
| password | string | Yes      | Min 8 chars, 1 upper, 1 lower, 1 number |
| name     | string | No       | Display name (1-100 chars)              |
| role     | string | Yes      | `USER`, `FREELANCER`, or `CLIENT`       |

**Response (201 Created):**

```json
{
  "data": {
    "user": {
      "id": "usr_abc12345",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "FREELANCER"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errors:**

- `400` - Validation error
- `409` - Email already registered

---

#### Login

Authenticate with email and password.

```http
POST /user/auth/login
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**

```json
{
  "data": {
    "user": {
      "id": "usr_abc12345",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "FREELANCER"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

Sets `refreshToken` as HttpOnly cookie.

**Errors:**

- `400` - Validation error
- `401` - Invalid credentials
- `423` - Account locked

---

#### Refresh Token

Get new access token.

```http
POST /user/auth/refresh
```

Requires `refreshToken` cookie.

**Response (200 OK):**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

#### Logout

Invalidate refresh token.

```http
POST /user/auth/logout
Authorization: Bearer <token>
```

**Response (204 No Content)**

---

### User Profile

#### Get Current User

```http
GET /user/me
Authorization: Bearer <token>
```

**Response (200 OK):**

```json
{
  "data": {
    "id": "usr_abc12345",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "FREELANCER",
    "avatar": "https://cdn.skillancer.com/avatars/usr_abc12345.jpg",
    "bio": "Full-stack developer...",
    "verified": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-20T14:15:00Z"
  }
}
```

---

#### Update Profile

```http
PATCH /user/me
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "John Smith",
  "bio": "Senior full-stack developer with 10 years of experience",
  "timezone": "America/New_York"
}
```

| Field    | Type   | Description         |
| -------- | ------ | ------------------- |
| name     | string | Display name        |
| bio      | string | User biography      |
| timezone | string | IANA timezone       |
| phone    | string | Phone number        |
| location | object | Address information |

**Response (200 OK):** Updated user object

---

#### Upload Avatar

```http
POST /user/me/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**

- `file`: Image file (JPEG, PNG, WebP; max 5MB)

**Response (200 OK):**

```json
{
  "data": {
    "avatar": "https://cdn.skillancer.com/avatars/usr_abc12345.jpg"
  }
}
```

---

### User Lookup

#### Get User by ID

```http
GET /user/users/{userId}
Authorization: Bearer <token>
```

**Response (200 OK):** Public user profile

**Errors:**

- `404` - User not found

---

#### Search Users

```http
GET /user/users?q=john&role=FREELANCER&page=1&limit=20
Authorization: Bearer <token>
```

| Parameter | Type   | Description                            |
| --------- | ------ | -------------------------------------- |
| q         | string | Search query                           |
| role      | string | Filter by role                         |
| page      | number | Page number (default: 1)               |
| limit     | number | Items per page (default: 20, max: 100) |

**Response (200 OK):** Paginated user list

---

### Account Management

#### Change Password

```http
POST /user/me/password
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**Response (204 No Content)**

**Errors:**

- `400` - Validation error
- `401` - Current password incorrect

---

#### Request Password Reset

```http
POST /user/auth/forgot-password
```

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response (202 Accepted):**

```json
{
  "message": "If an account exists, a reset link has been sent"
}
```

---

#### Reset Password

```http
POST /user/auth/reset-password
```

**Request Body:**

```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewPass789!"
}
```

**Response (204 No Content)**

---

#### Verify Email

```http
POST /user/auth/verify-email
```

**Request Body:**

```json
{
  "token": "verification_token_from_email"
}
```

**Response (200 OK):**

```json
{
  "data": {
    "verified": true
  }
}
```

---

### Settings

#### Get Settings

```http
GET /user/me/settings
Authorization: Bearer <token>
```

**Response (200 OK):**

```json
{
  "data": {
    "notifications": {
      "email": {
        "marketing": false,
        "bookingUpdates": true,
        "messages": true
      },
      "push": {
        "enabled": true,
        "bookingUpdates": true,
        "messages": true
      }
    },
    "privacy": {
      "profileVisibility": "PUBLIC",
      "showEmail": false,
      "showOnlineStatus": true
    },
    "preferences": {
      "language": "en",
      "currency": "USD",
      "timezone": "America/New_York"
    }
  }
}
```

---

#### Update Settings

```http
PATCH /user/me/settings
Authorization: Bearer <token>
```

**Request Body:** Partial settings object

**Response (200 OK):** Updated settings

---

## Webhooks

The User Service emits the following events:

| Event           | Description          |
| --------------- | -------------------- |
| `user.created`  | New user registered  |
| `user.updated`  | User profile updated |
| `user.verified` | Email verified       |
| `user.deleted`  | Account deleted      |

See [Webhooks](/api/webhooks) for integration details.
