# Contracts API

Endpoints for managing contracts on Skillancer.

## List Contracts

Retrieve contracts for the authenticated user.

```http
GET /v1/contracts
```

### Query Parameters

| Parameter | Type   | Description                                  |
| --------- | ------ | -------------------------------------------- |
| `status`  | string | `active`, `paused`, `completed`, `cancelled` |
| `type`    | string | `fixed`, `hourly`                            |
| `role`    | string | `client`, `freelancer`                       |
| `limit`   | number | Results per page                             |
| `cursor`  | string | Pagination cursor                            |

### Response

```json
{
  "data": [
    {
      "id": "contract_abc123",
      "title": "React E-commerce Platform Development",
      "job": {
        "id": "job_xyz789",
        "title": "React Developer for E-commerce Platform"
      },
      "client": {
        "id": "usr_client1",
        "name": "TechCorp Inc"
      },
      "freelancer": {
        "id": "usr_freelancer1",
        "name": "John Developer"
      },
      "type": "fixed",
      "budget": {
        "total": 4500,
        "funded": 1000,
        "released": 0,
        "currency": "USD"
      },
      "status": "active",
      "start_date": "2024-01-20",
      "created_at": "2024-01-18T10:00:00Z"
    }
  ],
  "pagination": {
    "has_more": false
  }
}
```

---

## Get Contract Details

```http
GET /v1/contracts/{contract_id}
```

### Response

```json
{
  "id": "contract_abc123",
  "title": "React E-commerce Platform Development",
  "description": "Development of e-commerce platform using React...",
  "job": {
    "id": "job_xyz789",
    "title": "React Developer for E-commerce Platform"
  },
  "proposal": {
    "id": "prop_abc123"
  },
  "client": {
    "id": "usr_client1",
    "name": "TechCorp Inc",
    "email": "contact@techcorp.com"
  },
  "freelancer": {
    "id": "usr_freelancer1",
    "name": "John Developer",
    "email": "john@developer.com"
  },
  "type": "fixed",
  "budget": {
    "total": 4500,
    "funded": 1000,
    "released": 0,
    "pending": 1000,
    "currency": "USD"
  },
  "milestones": [
    {
      "id": "ms_1",
      "description": "Design and architecture",
      "amount": 1000,
      "status": "in_progress",
      "due_date": "2024-01-25",
      "funded_at": "2024-01-20T10:00:00Z"
    },
    {
      "id": "ms_2",
      "description": "Core development",
      "amount": 2500,
      "status": "pending",
      "due_date": "2024-02-10"
    }
  ],
  "terms": {
    "payment_schedule": "milestone",
    "skillpod_required": false
  },
  "status": "active",
  "start_date": "2024-01-20",
  "end_date": null,
  "created_at": "2024-01-18T10:00:00Z",
  "updated_at": "2024-01-20T10:00:00Z"
}
```

---

## Submit Milestone

Submit a completed milestone for review. **Requires freelancer authorization.**

```http
POST /v1/contracts/{contract_id}/milestones/{milestone_id}/submit
```

### Request Body

```json
{
  "message": "Milestone completed. Please review the deliverables.",
  "deliverables": [
    {
      "type": "file",
      "attachment_id": "att_design123"
    },
    {
      "type": "link",
      "url": "https://github.com/project/repo",
      "description": "Source code repository"
    }
  ]
}
```

### Response

```json
{
  "id": "ms_1",
  "description": "Design and architecture",
  "amount": 1000,
  "status": "submitted",
  "submitted_at": "2024-01-25T14:00:00Z",
  "deliverables": [...],
  "review_deadline": "2024-02-08T14:00:00Z"
}
```

---

## Approve Milestone

Approve a submitted milestone and release payment. **Requires client authorization.**

```http
POST /v1/contracts/{contract_id}/milestones/{milestone_id}/approve
```

### Request Body

```json
{
  "feedback": "Great work! Everything looks perfect.",
  "rating": 5
}
```

### Response

```json
{
  "id": "ms_1",
  "status": "approved",
  "approved_at": "2024-01-26T10:00:00Z",
  "payment": {
    "amount": 1000,
    "status": "released",
    "transaction_id": "txn_release123"
  }
}
```

---

## Request Revision

Request changes to a submitted milestone. **Requires client authorization.**

```http
POST /v1/contracts/{contract_id}/milestones/{milestone_id}/request-revision
```

### Request Body

```json
{
  "feedback": "Please address the following issues...",
  "issues": [
    "Navigation menu needs to be responsive",
    "Color scheme doesn't match brand guidelines"
  ]
}
```

### Response

```json
{
  "id": "ms_1",
  "status": "revision_requested",
  "revision_count": 1,
  "revision_feedback": "Please address the following issues..."
}
```

---

## Get Time Entries

Retrieve time entries for an hourly contract.

```http
GET /v1/contracts/{contract_id}/time-entries
```

### Query Parameters

| Parameter | Type   | Description                       |
| --------- | ------ | --------------------------------- |
| `week`    | string | Week identifier (YYYY-Www)        |
| `status`  | string | `pending`, `approved`, `disputed` |
| `limit`   | number | Results per page                  |

### Response

```json
{
  "data": [
    {
      "id": "te_123",
      "date": "2024-01-22",
      "hours": 6.5,
      "description": "Implemented user authentication",
      "activity_level": 85,
      "screenshots": [
        {
          "time": "10:30:00",
          "url": "https://..."
        }
      ],
      "status": "approved"
    }
  ],
  "summary": {
    "week": "2024-W04",
    "total_hours": 32.5,
    "billable_amount": 1625,
    "status": "approved"
  }
}
```

---

## Add Time Entry

Manually add a time entry. **Requires freelancer authorization.**

```http
POST /v1/contracts/{contract_id}/time-entries
```

### Request Body

```json
{
  "date": "2024-01-22",
  "hours": 2.5,
  "description": "Code review and bug fixes",
  "memo": "Reviewed PR #45 and fixed reported issues"
}
```

---

## End Contract

End an active contract. **Requires authorization from either party.**

```http
POST /v1/contracts/{contract_id}/end
```

### Request Body

```json
{
  "reason": "completed",
  "feedback": {
    "rating": 5,
    "review": "Excellent work! Would hire again.",
    "private_feedback": "Very professional and responsive."
  },
  "recommend": true
}
```

### End Reasons

| Reason                  | Description                |
| ----------------------- | -------------------------- |
| `completed`             | Work finished successfully |
| `mutual_agreement`      | Both parties agreed to end |
| `client_terminated`     | Client ended contract      |
| `freelancer_terminated` | Freelancer ended contract  |

### Response

```json
{
  "id": "contract_abc123",
  "status": "completed",
  "ended_at": "2024-02-15T10:00:00Z",
  "ended_by": "client",
  "reason": "completed",
  "final_payment": {
    "amount": 4500,
    "currency": "USD"
  }
}
```

---

## Pause Contract

Temporarily pause an hourly contract. **Requires client authorization.**

```http
POST /v1/contracts/{contract_id}/pause
```

### Request Body

```json
{
  "reason": "Budget review needed",
  "expected_resume_date": "2024-02-01"
}
```

---

## Resume Contract

Resume a paused contract.

```http
POST /v1/contracts/{contract_id}/resume
```

---

## Contract Messages

Contracts include an integrated messaging system.

### List Messages

```http
GET /v1/contracts/{contract_id}/messages
```

### Send Message

```http
POST /v1/contracts/{contract_id}/messages
```

### Request Body

```json
{
  "content": "Here's the progress update for this week...",
  "attachments": ["att_file123"]
}
```

---

## Contract Files

Manage files attached to a contract.

### List Files

```http
GET /v1/contracts/{contract_id}/files
```

### Upload File

```http
POST /v1/contracts/{contract_id}/files
```

Use `multipart/form-data` with `file` field.

### Response

```json
{
  "id": "att_file123",
  "name": "design-specs.pdf",
  "size": 245000,
  "mime_type": "application/pdf",
  "url": "https://files.skillancer.com/...",
  "uploaded_by": "usr_freelancer1",
  "created_at": "2024-01-22T10:00:00Z"
}
```
