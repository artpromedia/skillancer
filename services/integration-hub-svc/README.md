# Integration Hub Service

The Integration Hub Service provides a unified framework for connecting executive workspaces to external tools and services.

## Features

- **OAuth Management**: Secure OAuth 2.0 flow handling with token encryption
- **Connector Architecture**: Extensible connector pattern for adding new integrations
- **Data Caching**: Redis-based caching for widget data
- **Webhook Processing**: Receive and process real-time updates from providers
- **Token Refresh**: Automatic token refresh before expiration

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Hub Service                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   OAuth     │  │ Integration │  │   Webhook   │              │
│  │  Service    │  │   Service   │  │   Service   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                │                │                      │
│  ┌─────────────────────────────────────────────────┐            │
│  │              Connector Registry                  │            │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │            │
│  │  │ Slack  │  │ Google │  │ Notion │  │  Jira  │ │            │
│  │  └────────┘  └────────┘  └────────┘  └────────┘ │            │
│  └─────────────────────────────────────────────────┘            │
│         │                │                │                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Cache     │  │   Token     │  │    Rate     │              │
│  │  (Redis)    │  │  Storage    │  │   Limiter   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Connectors

### Common (All Executive Types)
- Slack
- Google Calendar
- Microsoft Teams
- Notion
- Asana

### CTO Integrations
- GitHub
- GitLab
- Jira
- Datadog

### CFO Integrations
- QuickBooks
- Xero
- Stripe

### And more...

## API Endpoints

### Discovery
- `GET /integrations` - List available integrations
- `GET /integrations/:slug` - Get integration details

### Connection
- `POST /workspaces/:workspaceId/integrations/:slug/connect` - Initiate OAuth
- `GET /oauth/callback/:slug` - OAuth callback handler
- `POST /workspaces/:workspaceId/integrations/:integrationId/disconnect` - Disconnect

### Status & Data
- `GET /workspaces/:workspaceId/integrations` - List connected integrations
- `GET /workspaces/:workspaceId/integrations/:integrationId/widgets/:widgetId/data` - Widget data
- `POST /workspaces/:workspaceId/integrations/:integrationId/sync` - Trigger sync

### Webhooks
- `POST /webhooks/:connectorSlug` - Receive provider webhooks

## Environment Variables

```env
# OAuth Secrets (per provider)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=

# Token Encryption
TOKEN_ENCRYPTION_KEY=  # 32-byte hex string

# Redis
REDIS_URL=redis://localhost:6379

# Service
PORT=3006
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```
