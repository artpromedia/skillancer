# Freelancer CRM API Documentation

## Overview

The Freelancer CRM (Client Relationship Management) system is part of the Skillancer Cockpit service. It helps freelancers manage their client relationships, track interactions, manage sales opportunities, and grow their business.

## Base URL

```
/api/cockpit
```

## Authentication

All endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## Clients

### Create Client

Create a new client record.

**POST** `/clients`

#### Request Body

```json
{
  "clientType": "COMPANY",
  "source": "MANUAL",
  "companyName": "Acme Corporation",
  "email": "contact@acme.com",
  "phone": "+1234567890",
  "website": "https://acme.com",
  "industry": "Technology",
  "companySize": "MEDIUM",
  "timezone": "America/New_York",
  "notes": "Great client, referred by John",
  "tags": ["enterprise", "tech"],
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "postalCode": "10001"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "clientType": "COMPANY",
    "source": "MANUAL",
    "status": "ACTIVE",
    "companyName": "Acme Corporation",
    ...
  }
}
```

---

### Import Client from Market

Import a client from a Market platform relationship.

**POST** `/clients/import`

#### Request Body

```json
{
  "platformClientId": "uuid-of-market-client"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "source": "MARKET_IMPORT",
    "platformClientId": "uuid-of-market-client",
    ...
  }
}
```

---

### Sync Clients from Market

Sync all client data from Market platform relationships.

**POST** `/clients/sync`

#### Response

```json
{
  "success": true,
  "data": {
    "synced": 15,
    "created": 3,
    "updated": 12
  }
}
```

---

### Search Clients

Search and filter clients.

**GET** `/clients`

#### Query Parameters

| Parameter             | Type              | Description                                                                |
| --------------------- | ----------------- | -------------------------------------------------------------------------- |
| query                 | string            | Search text (name, email, company)                                         |
| status                | string[]          | Filter by status (ACTIVE, LEAD, PROSPECT, INACTIVE, ARCHIVED)              |
| source                | string[]          | Filter by source                                                           |
| clientType            | string[]          | Filter by type (INDIVIDUAL, COMPANY)                                       |
| tags                  | string[]          | Filter by tags                                                             |
| minTotalRevenue       | number            | Minimum total revenue                                                      |
| minHealthScore        | number            | Minimum health score                                                       |
| lastInteractionBefore | string (ISO date) | Last interaction before date                                               |
| sortBy                | string            | Sort field (name, createdAt, lastInteractionAt, totalRevenue, healthScore) |
| sortOrder             | string            | asc or desc                                                                |
| page                  | number            | Page number (default: 1)                                                   |
| limit                 | number            | Items per page (default: 20)                                               |

#### Response

```json
{
  "success": true,
  "data": {
    "clients": [...],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

---

### Get Client

Get client details by ID.

**GET** `/clients/:id`

#### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "clientType": "COMPANY",
    "companyName": "Acme Corporation",
    "contacts": [...],
    "recentInteractions": [...],
    "opportunities": [...],
    "healthScore": 85,
    ...
  }
}
```

---

### Get Client Health Score

Get detailed health score breakdown.

**GET** `/clients/:id/health-score`

#### Response

```json
{
  "success": true,
  "data": {
    "overallScore": 85,
    "components": {
      "recency": 90,
      "frequency": 80,
      "monetary": 85,
      "satisfaction": 90,
      "responsiveness": 75
    },
    "recommendations": [
      "Consider scheduling a follow-up meeting",
      "Response time has improved recently"
    ],
    "lastCalculated": "2024-01-15T10:30:00Z"
  }
}
```

---

### Update Client

Update client details.

**PATCH** `/clients/:id`

#### Request Body

```json
{
  "notes": "Updated notes",
  "tags": ["enterprise", "tech", "priority"],
  "status": "ACTIVE"
}
```

---

### Archive Client

Archive a client.

**POST** `/clients/:id/archive`

---

### Restore Client

Restore an archived client.

**POST** `/clients/:id/restore`

---

### Add Interaction

Log an interaction with a client.

**POST** `/clients/:id/interactions`

#### Request Body

```json
{
  "interactionType": "MEETING",
  "subject": "Project Kickoff Meeting",
  "notes": "Discussed project requirements and timeline",
  "sentiment": "POSITIVE",
  "isOutbound": true,
  "duration": 60,
  "metadata": {
    "location": "Zoom",
    "attendees": ["John", "Jane"]
  }
}
```

#### Interaction Types

- EMAIL
- CALL
- MEETING
- VIDEO_CALL
- MESSAGE
- PROPOSAL_SENT
- INVOICE_SENT
- PAYMENT_RECEIVED
- CONTRACT_SIGNED
- PROJECT_COMPLETED
- FEEDBACK_RECEIVED
- OTHER

---

### Add Contact

Add a contact person to a client.

**POST** `/clients/:id/contacts`

#### Request Body

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@acme.com",
  "phone": "+1234567890",
  "role": "DECISION_MAKER",
  "jobTitle": "CEO",
  "isPrimary": true,
  "preferredContactMethod": "email"
}
```

#### Contact Roles

- OWNER
- DECISION_MAKER
- INFLUENCER
- TECHNICAL
- BILLING
- PROJECT_MANAGER
- OTHER

---

### Get Client Statistics

Get overall client statistics.

**GET** `/clients/stats`

#### Response

```json
{
  "success": true,
  "data": {
    "totalClients": 50,
    "activeClients": 35,
    "leads": 10,
    "prospects": 5,
    "totalRevenue": 250000,
    "averageClientValue": 7142.86,
    "averageHealthScore": 72,
    "clientsNeedingAttention": 5,
    "bySource": {
      "MANUAL": 20,
      "MARKET_IMPORT": 25,
      "REFERRAL": 5
    }
  }
}
```

---

### Get Clients Needing Attention

Get clients with low health scores or no recent interactions.

**GET** `/clients/needs-attention`

#### Query Parameters

| Parameter | Type   | Description                               |
| --------- | ------ | ----------------------------------------- |
| limit     | number | Number of clients to return (default: 10) |

---

## Opportunities

### Create Opportunity

Create a new sales opportunity.

**POST** `/opportunities`

#### Request Body

```json
{
  "clientId": "uuid",
  "title": "Website Redesign Project",
  "description": "Complete redesign of corporate website",
  "source": "INBOUND_INQUIRY",
  "sourceDetails": "Via website contact form",
  "estimatedValue": 15000,
  "currency": "USD",
  "expectedCloseDate": "2024-03-01",
  "stage": "LEAD",
  "priority": "HIGH",
  "tags": ["web", "design"],
  "serviceType": "Web Development"
}
```

#### Opportunity Sources

- MARKET_PROJECT
- MARKET_SERVICE
- REFERRAL
- COLD_OUTREACH
- INBOUND_INQUIRY
- REPEAT_CLIENT
- PARTNERSHIP
- OTHER

---

### Search Opportunities

Search and filter opportunities.

**GET** `/opportunities`

#### Query Parameters

| Parameter           | Type     | Description                                 |
| ------------------- | -------- | ------------------------------------------- |
| clientId            | string   | Filter by client                            |
| source              | string[] | Filter by source                            |
| stage               | string[] | Filter by stage                             |
| status              | string[] | Filter by status (OPEN, ON_HOLD, WON, LOST) |
| priority            | string[] | Filter by priority                          |
| minValue            | number   | Minimum estimated value                     |
| maxValue            | number   | Maximum estimated value                     |
| expectedCloseBefore | string   | Expected close before date                  |
| expectedCloseAfter  | string   | Expected close after date                   |
| sortBy              | string   | Sort field                                  |
| sortOrder           | string   | asc or desc                                 |
| page                | number   | Page number                                 |
| limit               | number   | Items per page                              |

---

### Get Pipeline View

Get visual pipeline view of opportunities.

**GET** `/opportunities/pipeline`

#### Response

```json
{
  "success": true,
  "data": {
    "stages": [
      {
        "stage": "LEAD",
        "opportunities": [...],
        "count": 5,
        "totalValue": 25000,
        "weightedValue": 2500
      },
      {
        "stage": "QUALIFIED",
        "opportunities": [...],
        "count": 3,
        "totalValue": 45000,
        "weightedValue": 11250
      },
      ...
    ],
    "summary": {
      "totalOpportunities": 15,
      "totalValue": 150000,
      "weightedValue": 67500,
      "avgDealSize": 10000
    }
  }
}
```

---

### Get Opportunity Statistics

Get opportunity performance statistics.

**GET** `/opportunities/stats`

#### Query Parameters

| Parameter | Type   | Description       |
| --------- | ------ | ----------------- |
| startDate | string | Period start date |
| endDate   | string | Period end date   |

#### Response

```json
{
  "success": true,
  "data": {
    "total": 50,
    "open": 15,
    "won": 25,
    "lost": 10,
    "winRate": 71,
    "totalWonValue": 375000,
    "totalLostValue": 100000,
    "totalOpenValue": 150000,
    "avgDealSize": 15000,
    "avgTimeToClose": 21,
    "bySource": {
      "INBOUND_INQUIRY": 20,
      "REFERRAL": 15,
      "MARKET_PROJECT": 10,
      ...
    },
    "byStage": {
      "LEAD": 5,
      "QUALIFIED": 4,
      "PROPOSAL": 3,
      "NEGOTIATION": 3
    }
  }
}
```

---

### Update Opportunity Stage

Update opportunity stage (move through pipeline).

**POST** `/opportunities/:id/stage`

#### Request Body

```json
{
  "stage": "QUALIFIED",
  "notes": "Client confirmed budget"
}
```

#### Stages

- LEAD (10% probability)
- QUALIFIED (25% probability)
- PROPOSAL (50% probability)
- NEGOTIATION (75% probability)
- WON (100% probability)
- LOST (0% probability)

---

### Get Opportunity Activities

Get activity history for an opportunity.

**GET** `/opportunities/:id/activities`

---

## Reminders

### Create Reminder

Create a new reminder.

**POST** `/reminders`

#### Request Body

```json
{
  "clientId": "uuid",
  "title": "Follow up on proposal",
  "description": "Check if they reviewed the proposal",
  "reminderType": "FOLLOW_UP",
  "priority": "HIGH",
  "dueDate": "2024-02-15T10:00:00Z",
  "isRecurring": false
}
```

#### Recurring Reminder

```json
{
  "clientId": "uuid",
  "title": "Monthly check-in",
  "reminderType": "CHECK_IN",
  "dueDate": "2024-02-01T10:00:00Z",
  "isRecurring": true,
  "recurringPattern": {
    "frequency": "monthly",
    "interval": 1,
    "endDate": "2024-12-31"
  }
}
```

#### Reminder Types

- FOLLOW_UP
- MEETING
- DEADLINE
- CHECK_IN
- BIRTHDAY
- RENEWAL
- CUSTOM

---

### Get Upcoming Reminders

Get reminders due in the next N days.

**GET** `/reminders/upcoming`

#### Query Parameters

| Parameter | Type   | Description                     |
| --------- | ------ | ------------------------------- |
| days      | number | Days to look ahead (default: 7) |

---

### Get Overdue Reminders

Get all overdue reminders.

**GET** `/reminders/overdue`

---

### Get Today's Reminders

Get reminders due today.

**GET** `/reminders/today`

---

### Complete Reminder

Mark a reminder as complete.

**POST** `/reminders/:id/complete`

#### Request Body

```json
{
  "notes": "Called and confirmed meeting"
}
```

---

### Snooze Reminder

Snooze a reminder to a later time.

**POST** `/reminders/:id/snooze`

#### Request Body

```json
{
  "snoozeUntil": "2024-02-16T10:00:00Z"
}
```

---

### Cancel Reminder

Cancel a reminder.

**POST** `/reminders/:id/cancel`

---

## Documents

### Create Document

Create a document record.

**POST** `/documents`

#### Request Body

```json
{
  "clientId": "uuid",
  "opportunityId": "uuid",
  "documentType": "PROPOSAL",
  "fileName": "proposal_v2.pdf",
  "fileUrl": "https://storage.example.com/proposal_v2.pdf",
  "fileSize": 1048576,
  "mimeType": "application/pdf",
  "description": "Updated proposal with revised pricing",
  "tags": ["proposal", "v2"]
}
```

#### Document Types

- CONTRACT
- PROPOSAL
- INVOICE
- RECEIPT
- AGREEMENT
- BRIEF
- DELIVERABLE
- FEEDBACK
- OTHER

---

### Get Upload URL

Get pre-signed URL for file upload.

**POST** `/documents/upload-url`

#### Request Body

```json
{
  "clientId": "uuid",
  "fileName": "contract.pdf",
  "documentType": "CONTRACT"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://storage.example.com/upload?...",
    "fileUrl": "https://storage.example.com/crm/..."
  }
}
```

---

### Get Recent Documents

Get recently uploaded documents.

**GET** `/documents/recent`

---

### Get Document Statistics

Get document statistics.

**GET** `/documents/stats`

---

## Error Codes

| Code                       | Status | Description                           |
| -------------------------- | ------ | ------------------------------------- |
| CLIENT_NOT_FOUND           | 404    | Client does not exist                 |
| CLIENT_ALREADY_EXISTS      | 409    | Client with this email already exists |
| CONTACT_NOT_FOUND          | 404    | Contact does not exist                |
| OPPORTUNITY_NOT_FOUND      | 404    | Opportunity does not exist            |
| OPPORTUNITY_CLOSED         | 400    | Cannot modify closed opportunity      |
| INVALID_STAGE_TRANSITION   | 400    | Invalid stage transition              |
| REMINDER_NOT_FOUND         | 404    | Reminder does not exist               |
| REMINDER_ALREADY_COMPLETED | 400    | Reminder is already completed         |
| DOCUMENT_NOT_FOUND         | 404    | Document does not exist               |
| INVALID_DOCUMENT_TYPE      | 400    | File type not allowed                 |
| FILE_TOO_LARGE             | 400    | File exceeds size limit               |
| ACCESS_DENIED              | 403    | Not authorized to access resource     |
| SYNC_FAILED                | 500    | Market sync operation failed          |
| INVALID_RECURRING_PATTERN  | 400    | Invalid recurring pattern             |

---

## Webhooks

The CRM system can trigger webhooks for the following events:

- `client.created`
- `client.updated`
- `client.archived`
- `interaction.created`
- `opportunity.created`
- `opportunity.stage_changed`
- `opportunity.won`
- `opportunity.lost`
- `reminder.due`
- `reminder.overdue`

Configure webhooks in the Cockpit settings.

---

## Rate Limits

| Endpoint            | Limit               |
| ------------------- | ------------------- |
| GET requests        | 100 requests/minute |
| POST/PATCH requests | 50 requests/minute  |
| Sync operations     | 5 requests/minute   |

---

## Health Score Algorithm

The client health score is calculated using a weighted RFM (Recency, Frequency, Monetary) model with additional factors:

| Component      | Weight | Description                        |
| -------------- | ------ | ---------------------------------- |
| Recency        | 25%    | Days since last interaction        |
| Frequency      | 20%    | Number of interactions per month   |
| Monetary       | 20%    | Total revenue from client          |
| Satisfaction   | 20%    | Sentiment analysis of interactions |
| Responsiveness | 15%    | Response time to communications    |

Scores range from 0-100, with higher scores indicating healthier relationships.
