# ADR-001: Monorepo Structure

## Status

**Accepted**

- Date: 2024-01-15
- Deciders: Engineering Team

## Context

Skillancer consists of multiple applications and services:

- Web application (Next.js)
- Admin dashboard (Next.js)
- Multiple backend services (Fastify)
- Shared libraries and configurations

We need to decide how to organize our codebase:

1. **Polyrepo**: Each component in its own repository
2. **Monorepo**: All components in a single repository

### Constraints

- Team size: 5-15 developers
- Services share common types, utilities, and configurations
- Deployments need to be independent per service
- Need consistent tooling across all projects

## Decision

**We will use a monorepo structure with pnpm workspaces and Turborepo.**

The repository structure:

```
skillancer/
├── apps/              # Deployable applications
│   ├── web/           # Main web app
│   └── admin/         # Admin dashboard
├── services/          # Backend microservices
│   ├── user/
│   ├── project/
│   └── ...
├── packages/          # Shared libraries
│   ├── config-*/      # Shared configurations
│   ├── ui/            # Component library
│   └── types/         # Shared TypeScript types
└── infrastructure/    # IaC and deployment
```

## Alternatives Considered

### Option A: Polyrepo

**Pros:**

- Complete isolation between projects
- Independent versioning per repository
- Simpler CI/CD per repository
- Clear ownership boundaries

**Cons:**

- Difficult to share code
- Version synchronization challenges
- Multiple PRs for cross-cutting changes
- Inconsistent tooling configuration

### Option B: Monorepo with Lerna/Nx (Considered)

**Pros:**

- Mature tooling
- Good documentation
- Wide adoption

**Cons:**

- Nx has a steeper learning curve
- Lerna's maintenance status was uncertain
- Additional complexity for our scale

### Option C: Monorepo with pnpm + Turborepo (Selected)

**Pros:**

- Efficient disk space (pnpm's hard links)
- Fast installations
- Turborepo's caching speeds up CI
- Simple configuration
- Growing community and support

**Cons:**

- Newer tooling (less documentation)
- Learning curve for pnpm workspaces

## Consequences

### Positive

1. **Code sharing**: Shared packages are easily consumable across all projects
2. **Atomic changes**: Cross-service changes in single PRs
3. **Consistent tooling**: One ESLint, Prettier, TypeScript config
4. **Faster CI**: Turborepo caching reduces build times by 60-80%
5. **Type safety**: Shared types ensure API contracts

### Negative

1. **Repository size**: Will grow larger over time
   - _Mitigation_: Use sparse checkout if needed
2. **CI complexity**: Need to determine affected packages
   - _Mitigation_: Turborepo handles this automatically
3. **Learning curve**: Team needs to learn pnpm/Turborepo
   - _Mitigation_: Documentation and team training

### Neutral

- Git history includes all projects
- Requires thoughtful package boundaries

## Implementation

1. ✅ Set up pnpm workspaces
2. ✅ Configure Turborepo
3. ✅ Establish package structure
4. ✅ Create shared configuration packages
5. ✅ Set up CI/CD with caching

## References

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Monorepo Tools Comparison](https://monorepo.tools/)
