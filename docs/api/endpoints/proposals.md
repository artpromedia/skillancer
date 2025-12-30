# Proposals API

Endpoints for managing job proposals on Skillancer.

## Submit Proposal

Submit a proposal to a job. **Requires freelancer authorization.**

```http
POST /v1/jobs/{job_id}/proposals
```

### Request Body

```json
{
  "cover_letter": "I'm excited about this opportunity...",
  "bid": {
    "type": "fixed",
    "amount": 4500,
    "currency": "USD"
  },
  "duration": "4 weeks",
  "milestones": [
    {
      "description": "Design and architecture",
      "amount": 1000,
      "due_days": 7
    },
    {
      "description": "Core development",
      "amount": 2500,
      "due_days": 21
    },
    {
      "description": "Testing and deployment",
      "amount": 1000,
      "due_days": 28
    }
  ],
  "answers": [
    {
      "question": "Describe your experience with e-commerce platforms",
      "answer": "I have 5 years of experience building..."
    }
  ],
  "attachments": ["att_sample123"]
}
```

### Response

```json
{
  "id": "prop_abc123",
  "job_id": "job_xyz789",
  "freelancer": {
    "id": "usr_freelancer1",
    "name": "John Developer",
    "avatar": "https://..."
  },
  "cover_letter": "I'm excited about this opportunity...",
  "bid": {
    "type": "fixed",
    "amount": 4500,
    "currency": "USD"
  },
  "status": "pending",
  "connects_used": 4,
  "created_at": "2024-01-16T14:30:00Z"
}
```

### Connect Costs

| Job Budget    | Connects Required |
| ------------- | ----------------- |
| Under $500    | 2                 |
| $500 - $1,000 | 4                 |
| Over $1,000   | 6                 |

---

## List Proposals

### For Freelancers

List your submitted proposals.

```http
GET /v1/proposals
```

### Query Parameters

| Parameter | Type   | Description                                                   |
| --------- | ------ | ------------------------------------------------------------- |
| `status`  | string | `pending`, `shortlisted`, `accepted`, `rejected`, `withdrawn` |
| `job_id`  | string | Filter by specific job                                        |
| `limit`   | number | Results per page                                              |
| `cursor`  | string | Pagination cursor                                             |

### Response

```json
{
  "data": [
    {
      "id": "prop_abc123",
      "job": {
        "id": "job_xyz789",
        "title": "React Developer for E-commerce Platform",
        "client": {
          "id": "usr_client1",
          "name": "TechCorp Inc"
        }
      },
      "bid": {
        "type": "fixed",
        "amount": 4500,
        "currency": "USD"
      },
      "status": "shortlisted",
      "viewed_at": "2024-01-17T09:00:00Z",
      "created_at": "2024-01-16T14:30:00Z"
    }
  ],
  "pagination": {
    "has_more": false,
    "next_cursor": null
  }
}
```

### For Clients

List proposals for your jobs.

```http
GET /v1/jobs/{job_id}/proposals
```

### Response (Client View)

```json
{
  "data": [
    {
      "id": "prop_abc123",
      "freelancer": {
        "id": "usr_freelancer1",
        "name": "John Developer",
        "title": "Senior React Developer",
        "avatar": "https://...",
        "rating": 4.9,
        "job_success": 98,
        "total_earned": 85000,
        "verified_skills": ["react", "typescript"]
      },
      "cover_letter": "I'm excited about this opportunity...",
      "bid": {
        "type": "fixed",
        "amount": 4500,
        "currency": "USD"
      },
      "duration": "4 weeks",
      "milestones": [...],
      "answers": [...],
      "status": "pending",
      "created_at": "2024-01-16T14:30:00Z"
    }
  ]
}
```

---

## Get Proposal Details

```http
GET /v1/proposals/{proposal_id}
```

### Response

Full proposal object with all details (as shown in submit response, plus additional fields based on status).

---

## Update Proposal

Update a pending proposal. **Requires proposal owner authorization.**

```http
PATCH /v1/proposals/{proposal_id}
```

### Request Body

```json
{
  "cover_letter": "Updated cover letter...",
  "bid": {
    "amount": 4200
  }
}
```

### Limitations

- Can only update pending proposals
- Maximum 3 updates allowed
- Cannot change after client views

---

## Withdraw Proposal

Withdraw a submitted proposal. **Requires proposal owner authorization.**

```http
POST /v1/proposals/{proposal_id}/withdraw
```

### Request Body

```json
{
  "reason": "Found another opportunity"
}
```

### Response

```json
{
  "id": "prop_abc123",
  "status": "withdrawn",
  "withdrawn_at": "2024-01-18T10:00:00Z"
}
```

### Connect Refund

| Withdrawal Timing         | Refund      |
| ------------------------- | ----------- |
| Within 24 hours, unviewed | Full refund |
| After 24 hours, unviewed  | 50% refund  |
| After client viewed       | No refund   |

---

## Accept Proposal (Client)

Accept a proposal and create a contract. **Requires job owner authorization.**

```http
POST /v1/proposals/{proposal_id}/accept
```

### Request Body

```json
{
  "message": "Looking forward to working with you!",
  "contract": {
    "type": "fixed",
    "payment_terms": "milestone",
    "first_milestone": {
      "description": "Design and architecture",
      "amount": 1000,
      "due_date": "2024-01-25"
    }
  }
}
```

### Response

```json
{
  "proposal": {
    "id": "prop_abc123",
    "status": "accepted"
  },
  "contract": {
    "id": "contract_new123",
    "status": "pending_freelancer_acceptance",
    "created_at": "2024-01-18T10:00:00Z"
  }
}
```

---

## Shortlist Proposal (Client)

Add proposal to shortlist for later review.

```http
POST /v1/proposals/{proposal_id}/shortlist
```

### Response

```json
{
  "id": "prop_abc123",
  "status": "shortlisted",
  "shortlisted_at": "2024-01-17T15:00:00Z"
}
```

---

## Reject Proposal (Client)

Decline a proposal.

```http
POST /v1/proposals/{proposal_id}/reject
```

### Request Body

```json
{
  "reason": "budget_mismatch",
  "feedback": "Looking for someone with lower rates"
}
```

### Rejection Reasons

| Reason                | Description                   |
| --------------------- | ----------------------------- |
| `budget_mismatch`     | Budget doesn't align          |
| `experience_mismatch` | Experience level not suitable |
| `skills_mismatch`     | Missing required skills       |
| `availability`        | Timeline doesn't work         |
| `other`               | Other reason                  |

---

## Proposal Messages

Send a message regarding a proposal.

```http
POST /v1/proposals/{proposal_id}/messages
```

### Request Body

```json
{
  "content": "Can you clarify your timeline estimate?"
}
```

### List Messages

```http
GET /v1/proposals/{proposal_id}/messages
```

### Response

```json
{
  "data": [
    {
      "id": "msg_123",
      "sender": {
        "id": "usr_client1",
        "name": "TechCorp Inc",
        "type": "client"
      },
      "content": "Can you clarify your timeline estimate?",
      "created_at": "2024-01-17T10:00:00Z"
    }
  ]
}
```
