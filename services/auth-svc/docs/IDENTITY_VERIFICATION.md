# Identity Verification System

The Skillancer platform implements a comprehensive Biometric Identity Verification System using [Persona](https://withpersona.com) as the KYC/AML provider. This system provides three tiers of verification, enabling trust and compliance across the marketplace.

## Overview

### Verification Tiers

| Tier         | Features                                            | Use Case                                   |
| ------------ | --------------------------------------------------- | ------------------------------------------ |
| **BASIC**    | Government ID verification, selfie match            | Standard freelancer onboarding             |
| **ENHANCED** | Basic + AML/sanctions screening, watchlist check    | Higher-value contracts, enterprise clients |
| **PREMIUM**  | Enhanced + biometric liveness, address verification | Financial services, regulated industries   |

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Auth Service   │────▶│   Persona API   │
│   (Web/Mobile)  │◀────│   (Verification) │◀────│   (KYC/AML)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Database   │
                        │   (Prisma)   │
                        └──────────────┘
```

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# Persona Identity Verification
PERSONA_API_KEY=persona_sandbox_xxxxxxxx  # Your Persona API key
PERSONA_BASIC_TEMPLATE_ID=tmpl_basic      # Template for BASIC verification
PERSONA_ENHANCED_TEMPLATE_ID=tmpl_enhanced # Template for ENHANCED verification
PERSONA_PREMIUM_TEMPLATE_ID=tmpl_premium  # Template for PREMIUM verification
PERSONA_WEBHOOK_SECRET=webhook_secret     # Webhook signature verification
```

### Persona Dashboard Setup

1. **Create Templates** in Persona Dashboard:
   - BASIC: ID Document + Selfie
   - ENHANCED: BASIC + AML/PEP Watchlist
   - PREMIUM: ENHANCED + Liveness Check + Address Proof

2. **Configure Webhooks**:
   - URL: `https://your-domain.com/api/webhooks/persona`
   - Events: `inquiry.created`, `inquiry.completed`, `inquiry.approved`, `inquiry.declined`, `inquiry.expired`

## API Endpoints

### User Endpoints

#### Start Verification

```http
POST /api/v1/verification/start
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "verificationType": "BASIC" | "ENHANCED" | "PREMIUM",
  "redirectUri": "https://app.skillancer.com/verification/callback"
}
```

**Response:**

```json
{
  "inquiryId": "inq_abc123",
  "sessionToken": "sess_xyz789",
  "personaInquiryId": "inq_persona_123",
  "verificationType": "BASIC",
  "expiresAt": "2024-01-15T12:00:00Z"
}
```

#### Get Verification Status

```http
GET /api/v1/verification/status/:inquiryId
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "inquiryId": "inq_abc123",
  "status": "PENDING" | "IN_REVIEW" | "COMPLETED" | "APPROVED" | "DECLINED" | "EXPIRED",
  "verificationType": "BASIC",
  "createdAt": "2024-01-08T12:00:00Z",
  "completedAt": null,
  "verificationLevel": null,
  "documents": []
}
```

#### Get Verification History

```http
GET /api/v1/verification/history
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "inquiries": [
    {
      "id": "inq_abc123",
      "verificationType": "BASIC",
      "status": "APPROVED",
      "createdAt": "2024-01-08T12:00:00Z",
      "completedAt": "2024-01-08T12:30:00Z",
      "verificationLevel": "BASIC"
    }
  ],
  "currentBadges": [
    {
      "id": "badge_123",
      "level": "BASIC",
      "grantedAt": "2024-01-08T12:30:00Z",
      "expiresAt": "2025-01-08T12:30:00Z",
      "isActive": true
    }
  ],
  "highestLevel": "BASIC"
}
```

### Admin Endpoints

#### Get All Inquiries

```http
GET /api/v1/admin/verification/inquiries?status=PENDING&page=1&limit=20
Authorization: Bearer <admin_token>
```

#### Get Inquiry Details

```http
GET /api/v1/admin/verification/inquiries/:inquiryId
Authorization: Bearer <admin_token>
```

#### Manual Review

```http
POST /api/v1/admin/verification/inquiries/:inquiryId/review
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "decision": "APPROVE" | "DECLINE",
  "reason": "Manual review notes"
}
```

### Webhook Endpoint

```http
POST /api/webhooks/persona
X-Persona-Signature: sha256=xxxxx
Content-Type: application/json

{
  "data": {
    "type": "event",
    "attributes": {
      "name": "inquiry.approved",
      "payload": {
        "data": {
          "id": "inq_persona_123",
          "type": "inquiry",
          "attributes": {
            "status": "approved",
            "reference-id": "user_123"
          }
        }
      }
    }
  }
}
```

## Frontend Integration

### Using Persona Embedded Flow

```typescript
import Persona from 'persona';

// Start verification
const response = await fetch('/api/v1/verification/start', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    verificationType: 'BASIC',
  }),
});

const { sessionToken, inquiryId } = await response.json();

// Launch Persona embedded flow
const client = new Persona.Client({
  templateId: 'tmpl_basic',
  environment: 'sandbox', // or 'production'
  sessionToken: sessionToken,
  onReady: () => client.open(),
  onComplete: ({ inquiryId, status }) => {
    console.log('Verification complete:', status);
    // Poll for status updates or wait for webhook
  },
  onCancel: ({ inquiryId }) => {
    console.log('User cancelled verification');
  },
  onError: (error) => {
    console.error('Verification error:', error);
  },
});
```

### Checking Verification Status

```typescript
// Poll for status
async function checkVerificationStatus(inquiryId: string) {
  const response = await fetch(`/api/v1/verification/status/${inquiryId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  return response.json();
}

// Display verification badge
function VerificationBadge({ level }: { level: string }) {
  const badges = {
    BASIC: { icon: '✓', color: 'green', label: 'ID Verified' },
    ENHANCED: { icon: '★', color: 'blue', label: 'Enhanced Verified' },
    PREMIUM: { icon: '◆', color: 'gold', label: 'Premium Verified' }
  };

  const badge = badges[level];
  return (
    <span className={`badge badge-${badge.color}`}>
      {badge.icon} {badge.label}
    </span>
  );
}
```

## Database Schema

### VerificationInquiry

```prisma
model VerificationInquiry {
  id               String             @id @default(cuid())
  userId           String
  personaInquiryId String             @unique
  personaTemplateId String
  verificationType VerificationType
  status           VerificationStatus
  verificationLevel VerificationLevel?
  initiatedAt      DateTime           @default(now())
  completedAt      DateTime?
  expiresAt        DateTime
  rawResponse      Json?
  documents        VerificationDocument[]
  user             User               @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([status])
}
```

### UserVerificationBadge

```prisma
model UserVerificationBadge {
  id         String            @id @default(cuid())
  userId     String
  level      VerificationLevel
  grantedAt  DateTime          @default(now())
  expiresAt  DateTime
  isActive   Boolean           @default(true)
  inquiryId  String
  user       User              @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([level, isActive])
}
```

## Webhook Processing

The system automatically processes Persona webhooks:

| Event               | Action                                        |
| ------------------- | --------------------------------------------- |
| `inquiry.created`   | Log inquiry creation                          |
| `inquiry.completed` | Update status to COMPLETED, await review      |
| `inquiry.approved`  | Grant verification badge, update user profile |
| `inquiry.declined`  | Update status, notify user                    |
| `inquiry.expired`   | Update status, allow retry                    |

### Webhook Security

Webhooks are verified using HMAC-SHA256 signatures:

```typescript
// Verification is handled automatically by the webhook route
const isValid = personaService.verifyWebhookSignature(payload, signature, webhookSecret);
```

## Error Handling

### Common Errors

| Code                          | Description                | Resolution                    |
| ----------------------------- | -------------------------- | ----------------------------- |
| `VERIFICATION_NOT_CONFIGURED` | Persona not configured     | Check environment variables   |
| `USER_NOT_FOUND`              | User doesn't exist         | Ensure user is authenticated  |
| `INQUIRY_NOT_FOUND`           | Inquiry doesn't exist      | Check inquiry ID              |
| `VERIFICATION_IN_PROGRESS`    | Active verification exists | Wait or cancel existing       |
| `TEMPLATE_NOT_CONFIGURED`     | Template not set up        | Configure template in Persona |

### Error Response Format

```json
{
  "error": {
    "code": "VERIFICATION_IN_PROGRESS",
    "message": "You already have an active verification inquiry",
    "inquiryId": "inq_abc123"
  }
}
```

## Testing

### Sandbox Testing

Use Persona's sandbox environment for testing:

1. Set `PERSONA_API_KEY` to your sandbox key
2. Use test documents provided by Persona
3. Simulate different outcomes using test SSNs

### Unit Tests

Run the verification service tests:

```bash
cd services/auth-svc
pnpm test
```

Tests cover:

- Starting verification inquiries
- Resuming existing inquiries
- Status checking
- Webhook processing
- Badge management

## Security Considerations

1. **Data Privacy**: Personal documents are stored with Persona, not in Skillancer database
2. **Access Control**: Only authenticated users can access their verification data
3. **Admin Review**: Admins can manually review and override verification decisions
4. **Audit Logging**: All verification actions are logged for compliance
5. **Token Security**: Session tokens are short-lived and scoped to specific inquiries

## Compliance

The verification system supports:

- KYC (Know Your Customer) requirements
- AML (Anti-Money Laundering) screening
- GDPR data protection (data minimization, right to erasure)
- SOC 2 compliance (via Persona)

## Support

For issues with:

- **Persona Integration**: Contact Persona support or check their [documentation](https://docs.withpersona.com)
- **Skillancer Implementation**: File an issue in the repository
- **Verification Decisions**: Contact Skillancer support for manual review
