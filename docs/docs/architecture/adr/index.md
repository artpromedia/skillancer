# Architecture Decision Records

Architecture Decision Records (ADRs) document the key architectural decisions made during the development of Skillancer. Each ADR captures the context, decision, and consequences of significant technical choices.

## What is an ADR?

An ADR is a short text file describing a significant decision. It includes:

- **Context**: The situation and forces at play
- **Decision**: The change we're making
- **Consequences**: The results of the decision

## ADR Index

| ADR                                    | Title                        | Status   | Date       |
| -------------------------------------- | ---------------------------- | -------- | ---------- |
| [001](./001-monorepo-structure)        | Monorepo Structure           | Accepted | 2024-01-15 |
| [002](./002-fastify-backend)           | Fastify for Backend Services | Accepted | 2024-01-16 |
| [003](./003-prisma-orm)                | Prisma as ORM                | Accepted | 2024-01-18 |
| [004](./004-authentication-strategy)   | JWT Authentication Strategy  | Accepted | 2024-01-20 |
| [005](./005-event-driven-architecture) | Event-Driven Architecture    | Accepted | 2024-01-25 |

## ADR Status Definitions

- **Proposed**: Under discussion
- **Accepted**: Approved and in effect
- **Deprecated**: No longer recommended
- **Superseded**: Replaced by another ADR

## Creating a New ADR

1. Copy the [template](./template)
2. Number it sequentially (e.g., `006-topic-name.md`)
3. Fill in all sections
4. Submit a PR for review
5. Update the index above

## Guidelines

### When to Write an ADR

Write an ADR when:

- Choosing a framework or library
- Defining a system architecture pattern
- Making a security decision
- Selecting a deployment strategy
- Changing an existing architectural approach

### ADR Principles

1. **Immutable**: Once accepted, ADRs are not modified (create a new one to supersede)
2. **Concise**: Keep it short and focused
3. **Honest**: Document the real reasons and tradeoffs
4. **Timely**: Write ADRs when decisions are made, not after
