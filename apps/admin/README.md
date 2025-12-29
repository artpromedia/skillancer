# @skillancer/admin

Internal admin dashboard for Skillancer platform operations.

## Features

- **User Management**: Search, view, suspend, and manage user accounts
- **Content Moderation**: Review and moderate jobs, profiles, and content
- **Disputes**: Manage and resolve disputes between users
- **Financial Operations**: Monitor payments, process refunds, handle payouts
- **SkillPod Admin**: Monitor sessions, violations, and platform health
- **Reports & Analytics**: Generate and view platform reports
- **Platform Settings**: Configure feature flags, commissions, and integrations

## Getting Started

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev
```

The admin dashboard runs on [http://localhost:3010](http://localhost:3010).

## Security

- All admin actions are audit logged
- Role-based access control (RBAC)
- IP whitelisting supported
- Session timeout enforced
- MFA required for sensitive operations

## Roles

| Role | Description |
|------|-------------|
| Super Admin | Full access to all features |
| Operations | User management, disputes, payments |
| Moderator | Content moderation only |
| Support | Read-only + support tools |
| Finance | Financial operations only |
| Analytics | Reports and analytics only |

## Environment Variables

```env
ADMIN_JWT_SECRET=your-secret
ADMIN_API_URL=http://localhost:4000/admin
ADMIN_IP_WHITELIST=10.0.0.0/8,192.168.0.0/16
```
