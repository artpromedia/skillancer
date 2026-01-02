# SkillPod Enterprise API

> Version: 1.0  
> Base URL: `https://api.skillpod.io/v1`

## Overview

The SkillPod Enterprise API provides programmatic access to manage sessions, users, policies, and reporting for your organization. This RESTful API enables integration with existing enterprise systems, automation of common workflows, and building custom experiences on top of SkillPod.

### Key Features

- **Session Management**: Create, monitor, and terminate secure desktop sessions
- **User Provisioning**: Sync users from your identity provider or HR systems
- **Policy Automation**: Programmatically define and apply security policies
- **Analytics & Reporting**: Extract usage data and generate compliance reports
- **Webhook Events**: Real-time notifications for session and security events

---

## Authentication

### API Keys

All API requests require authentication via API keys. Keys are scoped to specific permissions and can be rotated without service interruption.

#### Obtaining API Keys

1. Navigate to **Admin Portal → API** in your SkillPod dashboard
2. Click **Create API Key**
3. Select the required scopes
4. Store the key securely—it will only be shown once

#### Using API Keys

Include your API key in the `Authorization` header:

```bash
curl -X GET "https://api.skillpod.io/v1/sessions" \
  -H "Authorization: Bearer skpd_live_xxxxxxxxxxxxxxxxxxxx"
```

### API Key Prefixes

| Prefix       | Environment | Usage                     |
| ------------ | ----------- | ------------------------- |
| `skpd_live_` | Production  | Live data, rate limited   |
| `skpd_test_` | Sandbox     | Test data, no rate limits |

### Scopes

| Scope            | Description                |
| ---------------- | -------------------------- |
| `sessions:read`  | View session information   |
| `sessions:write` | Create and manage sessions |
| `users:read`     | View user data             |
| `users:write`    | Create and manage users    |
| `policies:read`  | View security policies     |
| `policies:write` | Create and manage policies |
| `reports:read`   | Generate and view reports  |
| `webhooks:write` | Manage webhook endpoints   |
| `admin`          | Full administrative access |

---

## Rate Limiting

API requests are rate limited based on your plan:

| Plan       | Requests/Minute | Burst Limit |
| ---------- | --------------- | ----------- |
| Starter    | 100             | 150         |
| Pro        | 500             | 750         |
| Enterprise | 2000            | 3000        |

### Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 499
X-RateLimit-Reset: 1699488000
```

### Handling Rate Limits

When rate limited, you'll receive a `429 Too Many Requests` response:

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please retry after 60 seconds.",
  "retry_after": 60
}
```

Implement exponential backoff:

```javascript
async function apiRequest(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 60;
      await sleep(retryAfter * 1000 * Math.pow(2, i));
      continue;
    }

    return response;
  }
  throw new Error('Max retries exceeded');
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "validation_error",
  "message": "The request body is invalid",
  "details": [
    {
      "field": "email",
      "code": "invalid_format",
      "message": "Must be a valid email address"
    }
  ],
  "request_id": "req_abc123xyz"
}
```

### Error Codes

| HTTP Status | Error Code            | Description                  |
| ----------- | --------------------- | ---------------------------- |
| 400         | `validation_error`    | Invalid request parameters   |
| 401         | `unauthorized`        | Invalid or missing API key   |
| 403         | `forbidden`           | Insufficient permissions     |
| 404         | `not_found`           | Resource not found           |
| 409         | `conflict`            | Resource already exists      |
| 422         | `unprocessable`       | Semantically invalid request |
| 429         | `rate_limit_exceeded` | Too many requests            |
| 500         | `internal_error`      | Server error                 |
| 503         | `service_unavailable` | Temporary outage             |

---

## Pagination

List endpoints return paginated results:

```json
{
  "data": [...],
  "pagination": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "pages": 8,
    "has_more": true
  }
}
```

### Query Parameters

| Parameter | Type    | Default | Description                  |
| --------- | ------- | ------- | ---------------------------- |
| `page`    | integer | 1       | Page number                  |
| `limit`   | integer | 20      | Items per page (max 100)     |
| `sort`    | string  | varies  | Sort field                   |
| `order`   | string  | `desc`  | Sort order (`asc` or `desc`) |

---

## Endpoints

### Sessions

#### List Sessions

```http
GET /sessions
```

Returns a list of sessions for your tenant.

**Query Parameters:**

| Parameter     | Type     | Description                                    |
| ------------- | -------- | ---------------------------------------------- |
| `status`      | string   | Filter by status: `active`, `ended`, `pending` |
| `user_id`     | string   | Filter by user ID                              |
| `template_id` | string   | Filter by template ID                          |
| `since`       | datetime | Sessions created after this time               |
| `until`       | datetime | Sessions created before this time              |

**Example Request:**

```bash
curl -X GET "https://api.skillpod.io/v1/sessions?status=active&limit=10" \
  -H "Authorization: Bearer skpd_live_xxxx"
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "sess_abc123",
      "user_id": "usr_def456",
      "template_id": "tmpl_ghi789",
      "status": "active",
      "started_at": "2024-01-15T10:30:00Z",
      "ended_at": null,
      "duration_seconds": 1800,
      "metadata": {
        "ip_address": "192.168.1.100",
        "browser": "Chrome 120",
        "location": "San Francisco, CA"
      }
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "pages": 5,
    "has_more": true
  }
}
```

---

#### Create Session

```http
POST /sessions
```

Creates a new secure desktop session.

**Request Body:**

```json
{
  "user_id": "usr_def456",
  "template_id": "tmpl_ghi789",
  "policy_id": "pol_jkl012",
  "timeout_minutes": 60,
  "metadata": {
    "project": "Q4 Development",
    "cost_center": "CC-1234"
  }
}
```

**Response:**

```json
{
  "id": "sess_abc123",
  "user_id": "usr_def456",
  "status": "pending",
  "connect_url": "https://pod.skillpod.io/c/sess_abc123",
  "connect_token": "ct_xxxxxxxx",
  "expires_at": "2024-01-15T11:30:00Z",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

#### Get Session

```http
GET /sessions/{session_id}
```

Retrieves details for a specific session.

**Response:**

```json
{
  "id": "sess_abc123",
  "user_id": "usr_def456",
  "template_id": "tmpl_ghi789",
  "policy_id": "pol_jkl012",
  "status": "active",
  "started_at": "2024-01-15T10:30:00Z",
  "ended_at": null,
  "duration_seconds": 2400,
  "resources": {
    "cpu_usage": 45,
    "memory_usage": 2048,
    "disk_usage": 512
  },
  "security": {
    "clipboard_enabled": true,
    "file_transfer_enabled": false,
    "watermark_enabled": true
  }
}
```

---

#### Terminate Session

```http
DELETE /sessions/{session_id}
```

Immediately terminates an active session.

**Query Parameters:**

| Parameter | Type   | Description                               |
| --------- | ------ | ----------------------------------------- |
| `reason`  | string | Reason for termination (logged for audit) |

**Response:**

```json
{
  "id": "sess_abc123",
  "status": "ended",
  "ended_at": "2024-01-15T11:45:00Z",
  "termination_reason": "api_request"
}
```

---

### Users

#### List Users

```http
GET /users
```

Returns all users in your tenant.

**Query Parameters:**

| Parameter | Type   | Description                                       |
| --------- | ------ | ------------------------------------------------- |
| `status`  | string | Filter by status: `active`, `invited`, `disabled` |
| `role`    | string | Filter by role                                    |
| `search`  | string | Search by name or email                           |

**Example Response:**

```json
{
  "data": [
    {
      "id": "usr_def456",
      "email": "jane.smith@company.com",
      "name": "Jane Smith",
      "role": "user",
      "status": "active",
      "sso_linked": true,
      "last_session_at": "2024-01-14T15:30:00Z",
      "sessions_count": 42,
      "created_at": "2023-11-01T10:00:00Z"
    }
  ],
  "pagination": {...}
}
```

---

#### Create User

```http
POST /users
```

Creates or invites a new user.

**Request Body:**

```json
{
  "email": "john.doe@company.com",
  "name": "John Doe",
  "role": "user",
  "groups": ["engineering", "contractors"],
  "send_invite": true,
  "metadata": {
    "employee_id": "E12345",
    "department": "Engineering"
  }
}
```

**Response:**

```json
{
  "id": "usr_xyz789",
  "email": "john.doe@company.com",
  "name": "John Doe",
  "role": "user",
  "status": "invited",
  "invite_expires_at": "2024-01-22T10:00:00Z",
  "created_at": "2024-01-15T10:00:00Z"
}
```

---

#### Bulk Create Users

```http
POST /users/bulk
```

Creates multiple users in a single request (max 100).

**Request Body:**

```json
{
  "users": [
    {
      "email": "user1@company.com",
      "name": "User One",
      "role": "user"
    },
    {
      "email": "user2@company.com",
      "name": "User Two",
      "role": "user"
    }
  ],
  "send_invites": true,
  "on_conflict": "skip"
}
```

**Response:**

```json
{
  "created": 2,
  "skipped": 0,
  "failed": 0,
  "users": [
    { "id": "usr_xxx", "email": "user1@company.com", "status": "created" },
    { "id": "usr_yyy", "email": "user2@company.com", "status": "created" }
  ]
}
```

---

#### Update User

```http
PATCH /users/{user_id}
```

Updates user properties.

**Request Body:**

```json
{
  "role": "admin",
  "groups": ["engineering", "admins"],
  "metadata": {
    "department": "Platform"
  }
}
```

---

#### Disable User

```http
POST /users/{user_id}/disable
```

Disables a user account and terminates any active sessions.

---

### Policies

#### List Policies

```http
GET /policies
```

Returns all security policies.

**Example Response:**

```json
{
  "data": [
    {
      "id": "pol_jkl012",
      "name": "Contractor Access",
      "description": "Restricted policy for external contractors",
      "type": "custom",
      "priority": 100,
      "rules": {
        "clipboard": "disabled",
        "file_transfer": "disabled",
        "watermark": "enabled",
        "session_recording": "enabled",
        "idle_timeout": 30,
        "max_duration": 480
      },
      "conditions": {
        "user_groups": ["contractors"],
        "ip_ranges": ["192.168.0.0/16"]
      },
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-10T00:00:00Z"
    }
  ]
}
```

---

#### Create Policy

```http
POST /policies
```

Creates a new security policy.

**Request Body:**

```json
{
  "name": "High Security",
  "description": "Maximum security for sensitive workloads",
  "priority": 200,
  "rules": {
    "clipboard": "disabled",
    "file_transfer": "disabled",
    "watermark": "enabled",
    "session_recording": "enabled",
    "idle_timeout": 15,
    "max_duration": 240,
    "allowed_applications": ["vscode", "chrome"],
    "network_restrictions": {
      "allow_internet": false,
      "allowed_domains": ["github.com", "*.company.com"]
    }
  },
  "conditions": {
    "user_groups": ["security-team"],
    "time_restrictions": {
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
      "hours": { "start": "09:00", "end": "18:00" },
      "timezone": "America/New_York"
    }
  }
}
```

---

### Reports

#### Generate Report

```http
POST /reports
```

Generates a report and returns the data or a download URL.

**Request Body:**

```json
{
  "type": "usage",
  "date_range": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "format": "json",
  "filters": {
    "user_groups": ["engineering"]
  }
}
```

**Report Types:**

| Type            | Description                             |
| --------------- | --------------------------------------- |
| `usage`         | Session counts, duration, user activity |
| `security`      | Security events, policy violations      |
| `compliance`    | Audit log summary, access patterns      |
| `cost`          | Resource consumption and billing data   |
| `user_activity` | Per-user detailed activity              |

**Response (JSON format):**

```json
{
  "id": "rpt_abc123",
  "type": "usage",
  "status": "completed",
  "data": {
    "summary": {
      "total_sessions": 1250,
      "total_users": 45,
      "total_hours": 3420,
      "avg_session_minutes": 164
    },
    "daily": [{ "date": "2024-01-01", "sessions": 42, "users": 15, "hours": 112 }]
  },
  "generated_at": "2024-01-15T10:00:00Z"
}
```

**Response (CSV/PDF format):**

```json
{
  "id": "rpt_abc123",
  "type": "usage",
  "status": "completed",
  "download_url": "https://reports.skillpod.io/rpt_abc123.pdf",
  "expires_at": "2024-01-16T10:00:00Z"
}
```

---

### Webhooks

#### List Webhooks

```http
GET /webhooks
```

Returns all configured webhook endpoints.

---

#### Create Webhook

```http
POST /webhooks
```

Creates a new webhook endpoint.

**Request Body:**

```json
{
  "url": "https://api.company.com/skillpod-events",
  "events": ["session.started", "session.ended", "security.violation"],
  "secret": "whsec_xxxxxxxxxx",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

**Webhook Events:**

| Event             | Description                  |
| ----------------- | ---------------------------- |
| `session.started` | Session has started          |
| `session.ended`   | Session has ended            |
| `session.timeout` | Session ended due to timeout |
| `user.created`    | New user added               |
| `user.disabled`   | User account disabled        |
| `policy.violated` | Security policy violation    |
| `security.alert`  | Security alert triggered     |

---

#### Webhook Payload

All webhook payloads follow this structure:

```json
{
  "id": "evt_abc123",
  "type": "session.started",
  "tenant_id": "ten_xyz789",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "session_id": "sess_abc123",
    "user_id": "usr_def456",
    "template_id": "tmpl_ghi789"
  }
}
```

#### Verifying Webhook Signatures

Webhooks include a signature in the `X-SkillPod-Signature` header:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const timestamp = signature.split(',')[0].split('=')[1];
  const providedSig = signature.split(',')[1].split('=')[1];

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig));
}
```

---

## SDKs & Libraries

### Official SDKs

| Language              | Package                      | Repository                                   |
| --------------------- | ---------------------------- | -------------------------------------------- |
| JavaScript/TypeScript | `@skillpod/api-client`       | [GitHub](https://github.com/skillpod/sdk-js) |
| Python                | `skillpod`                   | [PyPI](https://pypi.org/project/skillpod/)   |
| Go                    | `github.com/skillpod/sdk-go` | [GitHub](https://github.com/skillpod/sdk-go) |

### JavaScript/TypeScript Example

```typescript
import { SkillPodClient } from '@skillpod/api-client';

const client = new SkillPodClient({
  apiKey: process.env.SKILLPOD_API_KEY,
});

// Create a session
const session = await client.sessions.create({
  userId: 'usr_def456',
  templateId: 'tmpl_ghi789',
  timeoutMinutes: 60,
});

console.log(`Session URL: ${session.connectUrl}`);

// List active sessions
const sessions = await client.sessions.list({
  status: 'active',
  limit: 10,
});

// Generate a report
const report = await client.reports.generate({
  type: 'usage',
  dateRange: {
    start: '2024-01-01',
    end: '2024-01-31',
  },
});
```

### Python Example

```python
from skillpod import SkillPodClient
import os

client = SkillPodClient(api_key=os.environ['SKILLPOD_API_KEY'])

# Create a session
session = client.sessions.create(
    user_id='usr_def456',
    template_id='tmpl_ghi789',
    timeout_minutes=60
)

print(f"Session URL: {session.connect_url}")

# List users
users = client.users.list(status='active')
for user in users:
    print(f"{user.name} - {user.email}")

# Create a webhook
webhook = client.webhooks.create(
    url='https://api.company.com/skillpod-events',
    events=['session.started', 'session.ended']
)
```

---

## Best Practices

### Security

1. **Store API keys securely** - Use environment variables or secrets management
2. **Use minimal scopes** - Request only the permissions you need
3. **Rotate keys regularly** - Rotate production keys every 90 days
4. **Validate webhooks** - Always verify webhook signatures
5. **Use HTTPS** - All API calls must use HTTPS

### Performance

1. **Batch operations** - Use bulk endpoints when possible
2. **Implement caching** - Cache user and policy data locally
3. **Use webhooks** - Prefer webhooks over polling for events
4. **Handle pagination** - Process large datasets in pages
5. **Respect rate limits** - Implement exponential backoff

### Integration Patterns

#### User Provisioning with SCIM

```python
# Sync users from your IdP using SCIM
@app.route('/scim/v2/Users', methods=['POST'])
def create_scim_user():
    scim_user = request.json

    skillpod_user = client.users.create(
        email=scim_user['emails'][0]['value'],
        name=scim_user['displayName'],
        metadata={
            'scim_id': scim_user['id'],
            'department': scim_user.get('department', '')
        }
    )

    return jsonify({'id': skillpod_user.id})
```

#### Session Lifecycle Automation

```typescript
// Automated session management
async function provisionSession(userId: string, projectId: string) {
  // Find appropriate policy based on project
  const policy = await client.policies.findByTag(projectId);

  // Create session with custom metadata
  const session = await client.sessions.create({
    userId,
    templateId: policy.defaultTemplateId,
    policyId: policy.id,
    timeoutMinutes: 60,
    metadata: {
      projectId,
      autoProvisioned: true,
    },
  });

  // Track in your system
  await db.sessionMappings.create({
    externalProjectId: projectId,
    skillpodSessionId: session.id,
  });

  return session;
}
```

---

## Changelog

### v1.0 (2024-01)

- Initial API release
- Session management endpoints
- User provisioning endpoints
- Policy management endpoints
- Report generation endpoints
- Webhook support

---

## Support

- **Documentation**: https://docs.skillpod.io
- **API Status**: https://status.skillpod.io
- **Support Email**: api-support@skillpod.io
- **Enterprise Support**: Available 24/7 for Enterprise plans
