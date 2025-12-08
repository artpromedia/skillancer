# Notification Service

Handles push notifications, emails, and in-app notifications.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **Language**: TypeScript
- **Email**: SendGrid / Resend
- **Push**: Firebase Cloud Messaging

## Getting Started

```bash
# From monorepo root
pnpm dev --filter=@skillancer/notification-svc

# Or from this directory
pnpm dev
```

## Features

- Email notifications (transactional & marketing)
- Push notifications (mobile & web)
- In-app notifications
- Notification preferences
- Template management
- Delivery tracking
