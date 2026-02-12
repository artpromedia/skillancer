# Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
├─────────────┬─────────────┬─────────────┬─────────────┬────────┤
│    web      │ web-market  │ web-cockpit │ web-skillpod│ mobile │
│  (Next.js)  │  (Next.js)  │  (Next.js)  │  (Next.js)  │(Flutter│
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴───┬────┘
       │             │             │             │          │
       └─────────────┴──────┬──────┴─────────────┴──────────┘
                            │
                    ┌───────▼───────┐
                    │  API Gateway  │
                    └───────┬───────┘
                            │
       ┌──────────┬─────────┼─────────┬──────────┬──────────┐
       │          │         │         │          │          │
┌──────▼──┐ ┌─────▼───┐ ┌───▼────┐ ┌──▼───┐ ┌────▼────┐ ┌───▼───┐
│auth-svc │ │market-svc│ │cockpit │ │skill │ │notific- │ │audit- │
│         │ │         │ │  -svc  │ │pod-svc│ │ation-svc│ │  svc  │
└────┬────┘ └────┬────┘ └───┬────┘ └──┬───┘ └────┬────┘ └───┬───┘
     │          │          │         │          │          │
     └──────────┴──────────┴────┬────┴──────────┴──────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
              │ PostgreSQL│ │ Redis │ │    S3     │
              └───────────┘ └───────┘ └───────────┘
```

## Service Responsibilities

### API Gateway

- Request routing
- Authentication/Authorization
- Rate limiting
- Request validation
- Response aggregation

### Auth Service

- User registration/login
- Session management
- OAuth2/Social login
- MFA
- RBAC

### Market Service

- Talent profiles
- Job postings
- Bidding system
- Matching algorithms

### Cockpit Service

- Workspace management
- Third-party integrations
- Analytics

### SkillPod Service

- VDI provisioning
- Session management
- Resource allocation

### Notification Service

- Email notifications
- Push notifications
- In-app notifications

### Audit Service

- Action logging
- Compliance reporting
- Data retention

## Data Flow

1. Client makes request to frontend app
2. Frontend app calls API Gateway
3. API Gateway authenticates request via Auth Service
4. API Gateway routes to appropriate service(s)
5. Services interact with databases as needed
6. Response is aggregated and returned
