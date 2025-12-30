# Webhooks

Receive real-time notifications when events occur on Skillancer.

## Overview

Webhooks allow your application to receive HTTP POST requests when specific events happen, enabling real-time integrations without polling.

## Available Events

### Job Events

| Event         | Description              |
| ------------- | ------------------------ |
| `job.created` | New job posted           |
| `job.updated` | Job details updated      |
| `job.closed`  | Job closed               |
| `job.expired` | Job expired without hire |

### Proposal Events

| Event                | Description                |
| -------------------- | -------------------------- |
| `proposal.received`  | New proposal on your job   |
| `proposal.accepted`  | Your proposal was accepted |
| `proposal.rejected`  | Your proposal was declined |
| `proposal.withdrawn` | Proposal was withdrawn     |

### Contract Events

| Event              | Description              |
| ------------------ | ------------------------ |
| `contract.created` | New contract started     |
| `contract.updated` | Contract terms updated   |
| `contract.ended`   | Contract completed/ended |
| `contract.paused`  | Hourly contract paused   |
| `contract.resumed` | Contract resumed         |

### Milestone Events

| Event                          | Description                          |
| ------------------------------ | ------------------------------------ |
| `milestone.funded`             | Milestone escrow funded              |
| `milestone.submitted`          | Milestone submitted for review       |
| `milestone.approved`           | Milestone approved, payment released |
| `milestone.revision_requested` | Revision requested                   |

### Payment Events

| Event               | Description                    |
| ------------------- | ------------------------------ |
| `payment.completed` | Payment successfully processed |
| `payment.failed`    | Payment processing failed      |
| `payout.initiated`  | Payout to freelancer initiated |
| `payout.completed`  | Payout successfully delivered  |

### Message Events

| Event              | Description            |
| ------------------ | ---------------------- |
| `message.received` | New message received   |
| `message.read`     | Message marked as read |

---

## Webhook Security

### Signature Verification

All webhooks include a signature header for verification:

```http
X-Skillancer-Signature: sha256=abc123...
```

### Verifying Signatures

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature =
    'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// Express middleware example
app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-skillancer-signature'];

  if (!verifyWebhookSignature(req.body, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body);
  // Process event...

  res.status(200).send('OK');
});
```

### Python Example

```python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected)
```

---

## Retry Policy

Failed webhook deliveries are retried with exponential backoff:

| Attempt | Delay      |
| ------- | ---------- |
| 1       | Immediate  |
| 2       | 1 minute   |
| 3       | 5 minutes  |
| 4       | 30 minutes |
| 5       | 2 hours    |
| 6       | 8 hours    |
| 7       | 24 hours   |

### Failure Conditions

A delivery is considered failed if:

- HTTP status code >= 400
- Connection timeout (30 seconds)
- SSL/TLS errors
- DNS resolution failure

### Disabling Webhooks

After 7 consecutive failures, the webhook endpoint is disabled. You'll receive an email notification and can re-enable it in settings.

---

## Event Payloads

### Common Structure

All webhook payloads follow this structure:

```json
{
  "id": "evt_abc123",
  "type": "contract.created",
  "created_at": "2024-01-20T10:30:00Z",
  "data": {
    // Event-specific data
  }
}
```

### Job Created

```json
{
  "id": "evt_job_created_123",
  "type": "job.created",
  "created_at": "2024-01-15T10:30:00Z",
  "data": {
    "job": {
      "id": "job_abc123",
      "title": "React Developer Needed",
      "category": "web-development",
      "budget": {
        "type": "fixed",
        "amount": 5000,
        "currency": "USD"
      },
      "client_id": "usr_client1"
    }
  }
}
```

### Proposal Received

```json
{
  "id": "evt_proposal_123",
  "type": "proposal.received",
  "created_at": "2024-01-16T14:30:00Z",
  "data": {
    "proposal": {
      "id": "prop_abc123",
      "job_id": "job_xyz789",
      "freelancer": {
        "id": "usr_freelancer1",
        "name": "John Developer"
      },
      "bid": {
        "amount": 4500,
        "currency": "USD"
      }
    }
  }
}
```

### Contract Created

```json
{
  "id": "evt_contract_123",
  "type": "contract.created",
  "created_at": "2024-01-20T10:00:00Z",
  "data": {
    "contract": {
      "id": "contract_abc123",
      "job_id": "job_xyz789",
      "proposal_id": "prop_abc123",
      "client_id": "usr_client1",
      "freelancer_id": "usr_freelancer1",
      "type": "fixed",
      "budget": {
        "total": 4500,
        "currency": "USD"
      }
    }
  }
}
```

### Milestone Approved

```json
{
  "id": "evt_milestone_123",
  "type": "milestone.approved",
  "created_at": "2024-01-26T10:00:00Z",
  "data": {
    "milestone": {
      "id": "ms_1",
      "contract_id": "contract_abc123",
      "description": "Design and architecture",
      "amount": 1000,
      "currency": "USD"
    },
    "payment": {
      "amount": 1000,
      "fee": 200,
      "net_amount": 800,
      "transaction_id": "txn_release123"
    }
  }
}
```

### Payment Completed

```json
{
  "id": "evt_payment_123",
  "type": "payment.completed",
  "created_at": "2024-01-26T10:05:00Z",
  "data": {
    "payment": {
      "id": "pay_abc123",
      "type": "milestone_release",
      "amount": 1000,
      "fee": 200,
      "net_amount": 800,
      "currency": "USD",
      "contract_id": "contract_abc123",
      "milestone_id": "ms_1"
    }
  }
}
```

---

## Testing Webhooks

### Webhook Test Endpoint

Send test events to your endpoint:

```http
POST /v1/webhooks/{webhook_id}/test
```

### Request Body

```json
{
  "event_type": "contract.created"
}
```

### Local Development

Use tools like ngrok to expose local endpoints:

```bash
ngrok http 3000
# Use the generated URL as your webhook endpoint
```

### Webhook Logs

View recent deliveries in the dashboard:

1. Go to **Settings → API & Webhooks**
2. Click on webhook endpoint
3. View **Delivery History**

Log entries include:

- Timestamp
- Event type
- Response status
- Response time
- Request/response bodies

---

## Managing Webhooks

### Create Webhook

```http
POST /v1/webhooks
```

```json
{
  "url": "https://your-app.com/webhooks",
  "events": ["contract.created", "payment.completed"],
  "secret": "your_webhook_secret"
}
```

### List Webhooks

```http
GET /v1/webhooks
```

### Update Webhook

```http
PATCH /v1/webhooks/{webhook_id}
```

```json
{
  "events": ["contract.created", "contract.ended"],
  "active": true
}
```

### Delete Webhook

```http
DELETE /v1/webhooks/{webhook_id}
```

---

## Best Practices

1. **Always verify signatures** - Never trust unverified payloads
2. **Respond quickly** - Return 200 within 5 seconds, process async
3. **Handle duplicates** - Use event `id` for idempotency
4. **Monitor failures** - Set up alerts for delivery issues
5. **Use HTTPS** - Webhook URLs must use HTTPS in production
6. **Log everything** - Keep records for debugging
