# Jobs API

Endpoints for managing job postings on Skillancer.

## List Jobs

Retrieve a paginated list of jobs.

```http
GET /v1/jobs
```

### Query Parameters

| Parameter      | Type     | Description                        |
| -------------- | -------- | ---------------------------------- |
| `category`     | string   | Filter by category slug            |
| `skills`       | string[] | Filter by required skills          |
| `budget_min`   | number   | Minimum budget                     |
| `budget_max`   | number   | Maximum budget                     |
| `type`         | string   | `fixed` or `hourly`                |
| `experience`   | string   | `entry`, `intermediate`, `expert`  |
| `posted_after` | ISO8601  | Jobs posted after date             |
| `status`       | string   | `open`, `in_progress`, `completed` |
| `limit`        | number   | Results per page (max 100)         |
| `cursor`       | string   | Pagination cursor                  |

### Response

```json
{
  "data": [
    {
      "id": "job_abc123",
      "title": "React Developer for E-commerce Platform",
      "description": "We need an experienced React developer...",
      "category": {
        "id": "cat_web",
        "name": "Web Development"
      },
      "skills": ["react", "typescript", "node.js"],
      "budget": {
        "type": "fixed",
        "amount": 5000,
        "currency": "USD"
      },
      "experience_level": "intermediate",
      "duration": "1-3 months",
      "client": {
        "id": "usr_xyz789",
        "name": "TechCorp Inc",
        "verified": true,
        "rating": 4.8,
        "jobs_posted": 45
      },
      "proposals_count": 12,
      "status": "open",
      "created_at": "2024-01-15T10:30:00Z",
      "expires_at": "2024-02-15T10:30:00Z"
    }
  ],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJpZCI6MTAwfQ=="
  }
}
```

---

## Get Job Details

Retrieve details of a specific job.

```http
GET /v1/jobs/{job_id}
```

### Response

```json
{
  "id": "job_abc123",
  "title": "React Developer for E-commerce Platform",
  "description": "Full job description with requirements...",
  "category": {
    "id": "cat_web",
    "name": "Web Development"
  },
  "subcategory": {
    "id": "subcat_frontend",
    "name": "Frontend Development"
  },
  "skills": [
    { "id": "skill_react", "name": "React", "required": true },
    { "id": "skill_ts", "name": "TypeScript", "required": true },
    { "id": "skill_redux", "name": "Redux", "required": false }
  ],
  "budget": {
    "type": "fixed",
    "amount": 5000,
    "currency": "USD"
  },
  "experience_level": "intermediate",
  "duration": "1-3 months",
  "weekly_hours": null,
  "attachments": [
    {
      "id": "att_123",
      "name": "requirements.pdf",
      "url": "https://files.skillancer.com/...",
      "size": 245000
    }
  ],
  "questions": [
    "Describe your experience with e-commerce platforms",
    "What is your availability for the next 3 months?"
  ],
  "client": {
    "id": "usr_xyz789",
    "name": "TechCorp Inc",
    "verified": true,
    "location": "San Francisco, CA",
    "rating": 4.8,
    "reviews_count": 32,
    "jobs_posted": 45,
    "total_spent": 150000,
    "member_since": "2020-03-15"
  },
  "proposals_count": 12,
  "interviews_count": 3,
  "status": "open",
  "visibility": "public",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-16T08:00:00Z",
  "expires_at": "2024-02-15T10:30:00Z"
}
```

---

## Create Job

Create a new job posting. **Requires client authorization.**

```http
POST /v1/jobs
```

### Request Body

```json
{
  "title": "React Developer for E-commerce Platform",
  "description": "We need an experienced React developer to build...",
  "category_id": "cat_web",
  "subcategory_id": "subcat_frontend",
  "skills": ["react", "typescript", "node.js"],
  "budget": {
    "type": "fixed",
    "amount": 5000,
    "currency": "USD"
  },
  "experience_level": "intermediate",
  "duration": "1-3 months",
  "questions": ["Describe your experience with e-commerce platforms"],
  "visibility": "public",
  "skillpod_required": false
}
```

### Response

```json
{
  "id": "job_abc123",
  "title": "React Developer for E-commerce Platform",
  "status": "draft",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Update Job

Update an existing job. **Requires job owner authorization.**

```http
PATCH /v1/jobs/{job_id}
```

### Request Body

```json
{
  "title": "Updated Job Title",
  "budget": {
    "amount": 6000
  },
  "status": "open"
}
```

### Response

Returns the updated job object.

---

## Close Job

Close a job posting. **Requires job owner authorization.**

```http
POST /v1/jobs/{job_id}/close
```

### Request Body

```json
{
  "reason": "filled",
  "feedback": "Found a great freelancer!"
}
```

### Close Reasons

| Reason      | Description        |
| ----------- | ------------------ |
| `filled`    | Hired a freelancer |
| `cancelled` | No longer needed   |
| `other`     | Other reason       |

---

## Search Jobs

Full-text search across jobs.

```http
GET /v1/jobs/search
```

### Query Parameters

| Parameter  | Type   | Description                                        |
| ---------- | ------ | -------------------------------------------------- |
| `q`        | string | Search query (required)                            |
| `category` | string | Filter by category                                 |
| `sort`     | string | `relevance`, `newest`, `budget_high`, `budget_low` |

### Response

Same format as List Jobs with additional `score` field.

---

## Job Categories

List all job categories.

```http
GET /v1/jobs/categories
```

### Response

```json
{
  "data": [
    {
      "id": "cat_web",
      "name": "Web Development",
      "slug": "web-development",
      "subcategories": [
        { "id": "subcat_frontend", "name": "Frontend Development" },
        { "id": "subcat_backend", "name": "Backend Development" }
      ]
    }
  ]
}
```
