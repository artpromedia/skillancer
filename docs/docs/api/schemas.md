# API Schemas

This page documents the data schemas used across Skillancer APIs.

## Core Schemas

### User

```typescript
interface User {
  id: string; // Format: usr_[a-z0-9]{8}
  email: string; // Valid email address
  name: string | null; // Display name
  role: UserRole;
  avatar: string | null; // URL to avatar image
  bio: string | null; // User biography
  verified: boolean; // Email verified
  createdAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
}

type UserRole = 'USER' | 'FREELANCER' | 'CLIENT' | 'ADMIN';
```

**Example:**

```json
{
  "id": "usr_abc12345",
  "email": "john@example.com",
  "name": "John Doe",
  "role": "FREELANCER",
  "avatar": "https://cdn.skillancer.com/avatars/usr_abc12345.jpg",
  "bio": "Full-stack developer with 5 years of experience",
  "verified": true,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-20T14:15:00Z"
}
```

### Project

```typescript
interface Project {
  id: string; // Format: prj_[a-z0-9]{8}
  title: string; // 5-200 characters
  description: string; // Project description (markdown)
  status: ProjectStatus;
  budget: Budget;
  category: Category;
  skills: string[]; // Required skills
  ownerId: string; // User ID of client
  freelancerId: string | null; // Assigned freelancer
  deadline: string | null; // ISO 8601 datetime
  createdAt: string;
  updatedAt: string;
}

type ProjectStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface Budget {
  type: 'FIXED' | 'HOURLY';
  minAmount: number;
  maxAmount: number;
  currency: string; // ISO 4217 currency code
}

interface Category {
  id: string;
  name: string;
  slug: string;
}
```

**Example:**

```json
{
  "id": "prj_xyz78901",
  "title": "E-commerce Website Development",
  "description": "Build a modern e-commerce platform with React and Node.js...",
  "status": "OPEN",
  "budget": {
    "type": "FIXED",
    "minAmount": 5000,
    "maxAmount": 10000,
    "currency": "USD"
  },
  "category": {
    "id": "cat_web",
    "name": "Web Development",
    "slug": "web-development"
  },
  "skills": ["React", "Node.js", "PostgreSQL", "TypeScript"],
  "ownerId": "usr_client01",
  "freelancerId": null,
  "deadline": "2024-03-01T00:00:00Z",
  "createdAt": "2024-01-25T10:30:00Z",
  "updatedAt": "2024-01-25T10:30:00Z"
}
```

### Gig

```typescript
interface Gig {
  id: string; // Format: gig_[a-z0-9]{8}
  title: string; // 10-100 characters
  description: string; // Detailed description
  status: GigStatus;
  pricing: GigPricing[];
  category: Category;
  tags: string[];
  images: string[]; // URLs to gig images
  freelancerId: string; // Owner freelancer
  deliveryTime: number; // Days
  revisions: number; // Number of revisions included
  rating: number | null; // Average rating (1-5)
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

type GigStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'DELETED';

interface GigPricing {
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM';
  title: string;
  description: string;
  price: number;
  currency: string;
  deliveryTime: number; // Days
  revisions: number;
  features: string[];
}
```

### Booking

```typescript
interface Booking {
  id: string; // Format: bkg_[a-z0-9]{8}
  type: 'PROJECT' | 'GIG';
  status: BookingStatus;
  projectId: string | null;
  gigId: string | null;
  pricingTier: string | null;
  clientId: string;
  freelancerId: string;
  amount: number;
  currency: string;
  requirements: string; // Client requirements
  milestones: Milestone[];
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type BookingStatus =
  | 'PENDING' // Awaiting freelancer acceptance
  | 'ACCEPTED' // Freelancer accepted
  | 'IN_PROGRESS' // Work started
  | 'IN_REVIEW' // Submitted for review
  | 'REVISION' // Client requested revision
  | 'COMPLETED' // Delivered and accepted
  | 'CANCELLED' // Cancelled by either party
  | 'DISPUTED'; // Under dispute resolution

interface Milestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PAID';
}
```

### Payment

```typescript
interface Payment {
  id: string; // Format: pay_[a-z0-9]{8}
  type: PaymentType;
  status: PaymentStatus;
  bookingId: string;
  payerId: string; // Client user ID
  payeeId: string; // Freelancer user ID
  amount: number;
  currency: string;
  platformFee: number; // Skillancer fee
  netAmount: number; // Amount to freelancer
  stripePaymentId: string | null;
  createdAt: string;
  processedAt: string | null;
}

type PaymentType = 'BOOKING' | 'MILESTONE' | 'TIP' | 'REFUND';

type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
```

### Notification

```typescript
interface Notification {
  id: string; // Format: ntf_[a-z0-9]{8}
  type: NotificationType;
  userId: string; // Recipient
  title: string;
  message: string;
  data: Record<string, unknown>; // Type-specific data
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

type NotificationType =
  | 'BOOKING_CREATED'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_COMPLETED'
  | 'MESSAGE_RECEIVED'
  | 'PAYMENT_RECEIVED'
  | 'REVIEW_RECEIVED'
  | 'SYSTEM_ANNOUNCEMENT';
```

## Common Types

### Pagination

```typescript
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}
```

### Error

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{
      field?: string;
      message: string;
    }>;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}
```

### Address

```typescript
interface Address {
  street: string;
  city: string;
  state: string | null;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2
}
```

### Money

```typescript
interface Money {
  amount: number; // Decimal, 2 places
  currency: string; // ISO 4217
}
```

## Validation Rules

### String Fields

| Field           | Min | Max   | Pattern                                |
| --------------- | --- | ----- | -------------------------------------- |
| email           | 5   | 254   | Valid email                            |
| password        | 8   | 128   | Min 1 uppercase, 1 lowercase, 1 number |
| name            | 1   | 100   | -                                      |
| title (project) | 5   | 200   | -                                      |
| title (gig)     | 10  | 100   | -                                      |
| description     | 10  | 10000 | -                                      |

### Numeric Fields

| Field            | Min | Max     |
| ---------------- | --- | ------- |
| budget.minAmount | 1   | 1000000 |
| budget.maxAmount | 1   | 1000000 |
| price            | 1   | 100000  |
| rating           | 1   | 5       |
| deliveryTime     | 1   | 365     |
| revisions        | 0   | 100     |

### ID Formats

| Entity  | Format            | Example        |
| ------- | ----------------- | -------------- |
| User    | `usr_[a-z0-9]{8}` | `usr_abc12345` |
| Project | `prj_[a-z0-9]{8}` | `prj_xyz78901` |
| Gig     | `gig_[a-z0-9]{8}` | `gig_def45678` |
| Booking | `bkg_[a-z0-9]{8}` | `bkg_ghi90123` |
| Payment | `pay_[a-z0-9]{8}` | `pay_jkl34567` |

## TypeScript Definitions

Full TypeScript definitions are available in the `@skillancer/types` package:

```typescript
import type { User, Project, Gig, Booking, Payment } from '@skillancer/types';
```

Or download from the OpenAPI spec:

```bash
npx openapi-typescript https://api.skillancer.com/openapi.json -o ./types.ts
```
