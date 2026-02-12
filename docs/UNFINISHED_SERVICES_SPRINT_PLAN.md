# Comprehensive Sprint Plan: Fixing 5 Unfinished Services

> **Total Errors: 270** across 5 services  
> **Generated:** Based on full build diagnostics and source code analysis  
> **Approach:** Schema-first, layer-by-layer, zero shortcuts

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Error Inventory](#error-inventory)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Sprint 1: Prisma Schema Completion](#sprint-1-prisma-schema-completion)
5. [Sprint 2: Schema Revision & Alignment](#sprint-2-schema-revision--alignment)
6. [Sprint 3: Service Code Fixes — financial-svc](#sprint-3-service-code-fixes--financial-svc)
7. [Sprint 4: Service Code Fixes — intelligence-svc](#sprint-4-service-code-fixes--intelligence-svc)
8. [Sprint 5: Service Code Fixes — talent-graph-svc](#sprint-5-service-code-fixes--talent-graph-svc)
9. [Sprint 6: Service Code Fixes — executive-svc](#sprint-6-service-code-fixes--executive-svc)
10. [Sprint 7: Service Code Fixes — copilot-svc](#sprint-7-service-code-fixes--copilot-svc)
11. [Sprint 8: Type System & Plugin Infrastructure](#sprint-8-type-system--plugin-infrastructure)
12. [Sprint 9: Integration Testing & Build Validation](#sprint-9-integration-testing--build-validation)
13. [Sprint 10: Deployment Pipeline & Production Readiness](#sprint-10-deployment-pipeline--production-readiness)
14. [Risk Register](#risk-register)
15. [Decision Log](#decision-log)

---

## Executive Summary

Five services were excluded from the initial Hetzner deployment because they contain build-breaking TypeScript errors rooted in **Prisma schema–code misalignment**. The errors fall into six distinct root cause categories:

| Category                     | Description                                                           | Error Count |
| ---------------------------- | --------------------------------------------------------------------- | ----------- |
| **A. Missing Prisma Models** | Service code references models that don't exist in any `.prisma` file | ~82         |
| **B. Field Name Mismatches** | Code uses different field names than what the schema defines          | ~95         |
| **C. Missing Enum Values**   | Code references enum members that don't exist in the Prisma enum      | ~18         |
| **D. Missing Relations**     | Code tries to `include` relations that aren't defined on the model    | ~25         |
| **E. Fastify Plugin Types**  | Fastify JWT/plugin type augmentation issues                           | ~14         |
| **F. Local Type Mismatches** | Local TypeScript types diverge from Prisma-generated types            | ~36         |

This plan takes a **schema-first approach**: we fix the database schema layer completely before touching service code. This ensures we only do code alignment once against a stable, correct schema.

---

## Error Inventory

### Per-Service Breakdown

| Service              | Files with Errors | Error Count | Primary Issues                                                                           |
| -------------------- | ----------------- | ----------- | ---------------------------------------------------------------------------------------- |
| **executive-svc**    | 2                 | 16          | Missing IntegrationType model, field name mismatches                                     |
| **copilot-svc**      | 4                 | 11          | Missing CopilotInteraction model, Fastify JWT types                                      |
| **financial-svc**    | 3                 | 76          | Missing SkillancerCard/TaxVaultDeposit/TaxVaultWithdrawal models, field mismatches       |
| **intelligence-svc** | 4                 | 53          | Missing SuccessPrediction/EngagementRiskAlert models, EngagementOutcome field mismatches |
| **talent-graph-svc** | 3                 | 114         | Missing WarmIntroduction model, WorkRelationship field mismatches, enum mismatches       |

### Per-File Error Map

```
executive-svc/
├── src/services/integration-hub.service.ts       → 15 errors (A, B, C)
└── src/services/executive-engagement.service.ts  →  1 error  (F)

copilot-svc/
├── src/plugins/auth.ts                           →  6 errors (E)
├── src/index.ts                                  →  2 errors (E)
├── src/routes/copilot.routes.ts                  →  1 error  (E)
└── src/services/copilot.service.ts               →  2 errors (A)

financial-svc/
├── src/services/invoice-financing.service.ts     → 26 errors (B, C, D)
├── src/services/skillancer-card.service.ts       → 40 errors (A, B)
└── src/services/tax-vault.service.ts             → 27 errors (A, B)

intelligence-svc/
├── src/services/outcome.service.ts               → 24 errors (B, D)
├── src/services/prediction.service.ts            → 17 errors (A, B)
├── src/services/risk-alert.service.ts            → 12 errors (A)
├── src/plugins/rate-limit.ts                     →  1 error  (E)
└── src/index.ts                                  →  2 errors (E)

talent-graph-svc/
├── src/services/team-reunion.service.ts          → 31 errors (B, C, D)
├── src/services/work-relationship.service.ts     → 42 errors (B, C, D, F)
└── src/services/warm-introduction.service.ts     → 41 errors (A, B, D)
```

---

## Root Cause Analysis

### Category A: Missing Prisma Models (7 models to create)

These models are referenced in service code via `this.prisma.<modelName>` but have **no corresponding `model` block in any `.prisma` file**:

| #   | Model Name            | Used By                                       | Occurrences | Description                                                  |
| --- | --------------------- | --------------------------------------------- | ----------- | ------------------------------------------------------------ |
| 1   | `CopilotInteraction`  | copilot-svc/copilot.service.ts                | 2           | Logs AI interactions (type, input, response, tokens, timing) |
| 2   | `SkillancerCard`      | financial-svc/skillancer-card.service.ts      | 14          | Virtual/physical debit card for freelancers                  |
| 3   | `TaxVaultDeposit`     | financial-svc/tax-vault.service.ts            | 5           | Individual tax vault deposit records                         |
| 4   | `TaxVaultWithdrawal`  | financial-svc/tax-vault.service.ts            | 5           | Individual tax vault withdrawal records                      |
| 5   | `SuccessPrediction`   | intelligence-svc/prediction.service.ts        | 7           | ML prediction of engagement success probability              |
| 6   | `EngagementRiskAlert` | intelligence-svc/risk-alert.service.ts        | 12          | Risk alerts for engagements                                  |
| 7   | `WarmIntroduction`    | talent-graph-svc/warm-introduction.service.ts | 13          | Warm intro requests between users                            |

### Category B: Schema Field Mismatches (code vs schema)

The following models exist in the schema but the service code uses **different field names**:

#### WorkRelationship (schema in `main.prisma`)

| Code Uses       | Schema Has    | Resolution                                                            |
| --------------- | ------------- | --------------------------------------------------------------------- |
| `userId`        | `userId1`     | Revise schema: rename to `userId` + add `user` relation               |
| `relatedUserId` | `userId2`     | Revise schema: rename to `relatedUserId` + add `relatedUser` relation |
| `company`       | `companyName` | Revise schema: rename to `company`                                    |
| `strength`      | _(missing)_   | Add field: `strength WorkRelationshipStrength?`                       |
| `verified`      | `confirmed`   | Code fix: use `confirmed`                                             |
| `skills`        | _(missing)_   | Add field: `skills String[]`                                          |

#### TeamReunion (schema in `main.prisma`)

| Code Uses           | Schema Has      | Resolution                                          |
| ------------------- | --------------- | --------------------------------------------------- |
| `company`           | `companyName`   | Revise schema: rename to `company`                  |
| `status`            | _(missing)_     | Add field: `status TeamReunionStatus` + create enum |
| `creator` (include) | _(no relation)_ | Add relation: `creator User @relation(...)`         |

#### TeamReunionMember (schema in `main.prisma`)

| Code Uses               | Schema Has      | Resolution                                            |
| ----------------------- | --------------- | ----------------------------------------------------- |
| `teamReunionId`         | `reunionId`     | Code fix: use `reunionId` (schema mapping is correct) |
| `proposedRole`          | _(missing)_     | Add field: `proposedRole String?`                     |
| `user` (include)        | _(no relation)_ | Add relation: `user User @relation(...)`              |
| `teamReunion` (include) | `reunion`       | Code fix: use `reunion`                               |
| `CONFIRMED`             | _(not in enum)_ | Add to enum or code fix: use `JOINED`                 |
| `ACCEPTED`              | _(not in enum)_ | Add to enum or code fix: use `JOINED`                 |

#### EngagementOutcome (schema in `main.prisma`)

| Code Uses             | Schema Has     | Resolution                                                |
| --------------------- | -------------- | --------------------------------------------------------- |
| `contractId`          | `engagementId` | Add field: `contractId String?` for backward compat       |
| `clientId`            | _(missing)_    | Add field: `clientId String?` + relation                  |
| `freelancerId`        | _(missing)_    | Add field: `freelancerId String?` + relation              |
| `rating`              | _(missing)_    | Add field: `rating String?`                               |
| `score`               | `successScore` | Add field: `score Int?` or code fix to use `successScore` |
| `metrics`             | _(missing)_    | Add field: `metrics Json?`                                |
| `createdAt` (orderBy) | `calculatedAt` | Add field: `createdAt DateTime @default(now())`           |

#### TaxVault (schema in `financial.prisma`)

| Code Uses            | Schema Has        | Resolution                      |
| -------------------- | ----------------- | ------------------------------- |
| `currentBalance`     | `balance`         | Code fix: use `balance`         |
| `targetPercentage`   | `savingsRate`     | Code fix: use `savingsRate`     |
| `totalDeposits`      | _(missing)_       | Add computed field or aggregate |
| `totalWithdrawals`   | _(missing)_       | Add computed field or aggregate |
| `autosaveEnabled`    | `autoSaveEnabled` | Code fix: use `autoSaveEnabled` |
| `deposits` (include) | `transactions`    | Code fix: use `transactions`    |

#### InvoiceFinancing (schema in `financial.prisma`)

| Code Uses        | Schema Has        | Resolution                          |
| ---------------- | ----------------- | ----------------------------------- |
| `userId` (where) | `tenantId`        | Code fix: use `tenantId`            |
| `feePercentage`  | _(missing)_       | Add field: `feePercentage Decimal?` |
| `feeAmount`      | `fees`            | Code fix: use `fees`                |
| `repaidAmount`   | `repaymentAmount` | Code fix: use `repaymentAmount`     |
| `user` (include) | _(no relation)_   | Add relation to User                |

### Category C: Missing Enum Values

| Enum                         | Missing Values                       | Resolution                                                     |
| ---------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `InvoiceFinancingStatus`     | `PENDING_REVIEW`, `PARTIALLY_REPAID` | Add to enum                                                    |
| `TeamReunionMemberStatus`    | `CONFIRMED`, `ACCEPTED`              | Add to enum (or map CONFIRMED→JOINED, ACCEPTED→JOINED in code) |
| `WorkRelationshipType`       | `COWORKER`, `COLLABORATOR`           | Add to enum                                                    |
| `ExecutiveIntegrationStatus` | `REQUIRES_REAUTH`                    | Add to enum                                                    |

### Category D: Missing Relations (no `@relation` in schema)

| Model               | Missing Relation          | Target                                  |
| ------------------- | ------------------------- | --------------------------------------- |
| `EngagementOutcome` | `client`, `freelancer`    | `User`                                  |
| `WorkRelationship`  | `user`, `relatedUser`     | `User`                                  |
| `TeamReunion`       | `creator`                 | `User`                                  |
| `TeamReunionMember` | `user`                    | `User`                                  |
| `InvoiceFinancing`  | `user`                    | `User`                                  |
| `TaxVault`          | `deposits`, `withdrawals` | `TaxVaultDeposit`, `TaxVaultWithdrawal` |

### Category E: Fastify Plugin Type Issues

| Service          | File              | Error                                        | Resolution                                                                          |
| ---------------- | ----------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| copilot-svc      | auth.ts           | `jwtVerify` / `user` not on `FastifyRequest` | Type augmentation exists but not being picked up — `tsconfig` or import order issue |
| copilot-svc      | index.ts          | Plugin registration overload mismatch        | Cast plugins or fix generics                                                        |
| copilot-svc      | copilot.routes.ts | `request.user` not typed                     | Import `AuthenticatedUser` type or use declaration merge                            |
| intelligence-svc | rate-limit.ts     | Plugin type assignment                       | Fix `fp()` callback signature                                                       |
| intelligence-svc | index.ts          | Plugin registration overload                 | Same pattern as copilot-svc                                                         |

### Category F: Local Type Mismatches

| Service          | Type Issue                                                    | Resolution                         |
| ---------------- | ------------------------------------------------------------- | ---------------------------------- |
| executive-svc    | `ExecutiveTimeEntryInput` missing `executiveId`               | Add field to local type definition |
| talent-graph-svc | `RelationshipType` (local) vs `WorkRelationshipType` (Prisma) | Align local enum or cast           |
| talent-graph-svc | `RelationshipStrength` (local) not in schema                  | Add `strength` field to schema     |
| financial-svc    | `FinancingStatus.PENDING_REVIEW` etc not matching Prisma enum | Align after schema enum update     |

---

## Sprint 1: Prisma Schema Completion

**Goal:** Create all 7 missing Prisma models so that `prisma generate` produces the corresponding TypeScript types.

**Estimated effort:** 1–2 days  
**Files to create/modify:**

- `packages/database/prisma/schemas/copilot.prisma` (add CopilotInteraction)
- `packages/database/prisma/schemas/financial.prisma` (add SkillancerCard, TaxVaultDeposit, TaxVaultWithdrawal)
- `packages/database/prisma/schemas/main.prisma` (add SuccessPrediction, EngagementRiskAlert, WarmIntroduction)

### Task 1.1: Create `CopilotInteraction` model

**File:** `packages/database/prisma/schemas/copilot.prisma`

Based on usage in `copilot.service.ts` lines 329 and 750:

```prisma
model CopilotInteraction {
  id               String   @id @default(uuid())
  userId           String   @map("user_id") @db.Uuid
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  interactionType  String   @map("interaction_type")
  inputContext     Json     @map("input_context")
  response         String?  @db.Text
  suggestions      String[]
  confidence       Int      @default(0)
  tokensUsed       Int      @default(0) @map("tokens_used")
  processingTimeMs Int      @default(0) @map("processing_time_ms")

  createdAt        DateTime @default(now()) @map("created_at")

  @@index([userId, interactionType])
  @@index([createdAt])
  @@map("copilot_interactions")
}
```

**User model update:** Add reverse relation `copilotInteractions CopilotInteraction[]` to User model in `main.prisma`.

### Task 1.2: Create `SkillancerCard` model

**File:** `packages/database/prisma/schemas/financial.prisma`

Based on usage in `skillancer-card.service.ts`:

```prisma
model SkillancerCard {
  id               String   @id @default(cuid())
  userId           String   @map("user_id")

  cardType         String   @map("card_type")  // VIRTUAL, PHYSICAL
  status           String   @default("PENDING")

  maskedNumber     String   @map("masked_number")
  nickname         String?

  spendingLimit    Decimal? @db.Decimal(12, 2) @map("spending_limit")
  allowedCategories String[] @map("allowed_categories")

  cashbackRate     Decimal  @db.Decimal(5, 2) @default(0) @map("cashback_rate")
  cashbackEarned   Decimal  @db.Decimal(12, 2) @default(0) @map("cashback_earned")

  activatedAt      DateTime? @map("activated_at")
  frozenAt         DateTime? @map("frozen_at")
  cancelledAt      DateTime? @map("cancelled_at")

  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  transactions     CardTransaction[] @relation("SkillancerCardTransactions")

  @@index([userId, status])
  @@map("skillancer_cards")
}
```

> **Note:** `CardTransaction` already exists in `financial.prisma`. We need to evaluate whether to add a foreign key from `CardTransaction` to `SkillancerCard` or if the existing `IssuedCard` relation suffices. Decision: The `skillancer-card.service.ts` uses `SkillancerCard` as a separate concept from Stripe `IssuedCard`, so we create it as a standalone model. The `CardTransaction` model already has a `cardId` field pointing to `IssuedCard` — the `SkillancerCard` transactions will need a separate relation or we reuse CardTransaction with a polymorphic approach.

### Task 1.3: Create `TaxVaultDeposit` and `TaxVaultWithdrawal` models

**File:** `packages/database/prisma/schemas/financial.prisma`

Based on usage in `tax-vault.service.ts`:

```prisma
model TaxVaultDeposit {
  id           String   @id @default(cuid())
  userId       String   @map("user_id")
  vaultId      String   @map("vault_id")

  amount       Decimal  @db.Decimal(12, 2)
  source       String?  // earning_id, manual, auto
  description  String?
  balanceAfter Decimal  @db.Decimal(12, 2) @map("balance_after")

  createdAt    DateTime @default(now()) @map("created_at")

  vault        TaxVault @relation("TaxVaultDeposits", fields: [vaultId], references: [id])

  @@index([userId, createdAt])
  @@map("tax_vault_deposits")
}

model TaxVaultWithdrawal {
  id           String   @id @default(cuid())
  userId       String   @map("user_id")
  vaultId      String   @map("vault_id")

  amount       Decimal  @db.Decimal(12, 2)
  reason       String   // TAX_PAYMENT, QUARTERLY_ESTIMATE, etc.
  description  String?
  balanceAfter Decimal  @db.Decimal(12, 2) @map("balance_after")

  createdAt    DateTime @default(now()) @map("created_at")

  vault        TaxVault @relation("TaxVaultWithdrawals", fields: [vaultId], references: [id])

  @@index([userId, createdAt])
  @@map("tax_vault_withdrawals")
}
```

**TaxVault model update:** Replace `transactions TaxVaultTransaction[]` with:

```prisma
deposits     TaxVaultDeposit[]    @relation("TaxVaultDeposits")
withdrawals  TaxVaultWithdrawal[] @relation("TaxVaultWithdrawals")
```

### Task 1.4: Create `SuccessPrediction` model

**File:** `packages/database/prisma/schemas/main.prisma`

Based on usage in `prediction.service.ts`:

```prisma
model SuccessPrediction {
  id                  String   @id @default(uuid())
  contractId          String   @map("contract_id")
  clientId            String   @map("client_id") @db.Uuid
  freelancerId        String   @map("freelancer_id") @db.Uuid

  successProbability  Decimal  @db.Decimal(5, 2) @map("success_probability")
  confidence          String   // LOW, MEDIUM, HIGH, VERY_HIGH

  riskFactors         Json     @map("risk_factors")
  recommendations     String[]

  projectType         String?  @map("project_type")
  budget              Decimal? @db.Decimal(12, 2)
  duration            Int?     // days
  complexity          String?  // LOW, MEDIUM, HIGH

  similarProjectsAnalyzed Int @default(0) @map("similar_projects_analyzed")

  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  @@index([contractId])
  @@index([freelancerId])
  @@index([clientId])
  @@map("success_predictions")
}
```

### Task 1.5: Create `EngagementRiskAlert` model

**File:** `packages/database/prisma/schemas/main.prisma`

Based on usage in `risk-alert.service.ts`:

```prisma
model EngagementRiskAlert {
  id               String   @id @default(uuid())
  contractId       String   @map("contract_id")

  riskCategory     String   @map("risk_category")  // COMMUNICATION, TIMELINE, BUDGET, etc.
  riskLevel        String   @map("risk_level")      // LOW, MEDIUM, HIGH, CRITICAL

  title            String
  description      String   @db.Text
  indicators       String[]
  suggestedActions String[] @map("suggested_actions")

  autoGenerated    Boolean  @default(false) @map("auto_generated")

  acknowledged     Boolean  @default(false)
  acknowledgedBy   String?  @map("acknowledged_by")
  acknowledgedAt   DateTime? @map("acknowledged_at")

  resolved         Boolean  @default(false)
  resolvedBy       String?  @map("resolved_by")
  resolvedAt       DateTime? @map("resolved_at")
  resolution       String?  @db.Text

  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@index([contractId, resolved])
  @@index([riskLevel])
  @@map("engagement_risk_alerts")
}
```

### Task 1.6: Create `WarmIntroduction` model

**File:** `packages/database/prisma/schemas/main.prisma`

Based on usage in `warm-introduction.service.ts`:

```prisma
model WarmIntroduction {
  id              String   @id @default(uuid())
  requesterId     String   @map("requester_id") @db.Uuid
  targetUserId    String   @map("target_user_id") @db.Uuid
  introducerId    String   @map("introducer_id") @db.Uuid

  purpose         String   @db.Text
  message         String?  @db.Text
  context         String?  @db.Text

  status          String   @default("PENDING") // PENDING, ACCEPTED, DECLINED, COMPLETED, EXPIRED

  introducerMessage String? @db.Text @map("introducer_message")

  acceptedAt      DateTime? @map("accepted_at")
  declinedAt      DateTime? @map("declined_at")
  completedAt     DateTime? @map("completed_at")
  expiresAt       DateTime? @map("expires_at")

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  requester       User     @relation("WarmIntroRequester", fields: [requesterId], references: [id])
  target          User     @relation("WarmIntroTarget", fields: [targetUserId], references: [id])
  introducer      User     @relation("WarmIntroIntroducer", fields: [introducerId], references: [id])

  @@index([requesterId])
  @@index([targetUserId])
  @@index([introducerId])
  @@index([status])
  @@map("warm_introductions")
}
```

**User model update:** Add reverse relations:

```prisma
warmIntrosRequested    WarmIntroduction[] @relation("WarmIntroRequester")
warmIntrosReceived     WarmIntroduction[] @relation("WarmIntroTarget")
warmIntrosIntroduced   WarmIntroduction[] @relation("WarmIntroIntroducer")
```

### Task 1.7: Validation

```bash
cd packages/database
npx prisma validate
npx prisma generate
```

Verify no errors. Run `pnpm build --filter=database` if applicable.

---

## Sprint 2: Schema Revision & Alignment

**Goal:** Fix existing Prisma models that have **field name and structure mismatches** with the service code. Add missing fields, relations, and enum values.

**Estimated effort:** 2–3 days  
**Principle:** Where models were created by us (this session), revise the schema to match code semantics. Where models are long-established production tables, fix the code instead.

### Task 2.1: Revise `WorkRelationship` model

**File:** `packages/database/prisma/schemas/main.prisma`

**Changes:**

1. Rename `userId1` → `userId` and `userId2` → `relatedUserId`
2. Rename `companyName` → `company`
3. Add `strength` field (String, nullable)
4. Add `skills` field (String[])
5. Add `projectName` field (String, nullable)
6. Add `notes` field (String, nullable)
7. Add `user` and `relatedUser` relations to User
8. Keep `confirmed` (code has `verified` — we'll fix the code in Sprint 5)

**Revised model:**

```prisma
model WorkRelationship {
  id               String   @id @default(uuid())
  userId           String   @map("user_id") @db.Uuid
  relatedUserId    String   @map("related_user_id") @db.Uuid

  relationshipType WorkRelationshipType @map("relationship_type")
  company          String?
  startDate        DateTime? @map("start_date")
  endDate          DateTime? @map("end_date")
  projectName      String?  @map("project_name")

  strength         String?  // STRONG, MODERATE, WEAK
  collaborationScore Int?   @map("collaboration_score")
  endorsements     Int      @default(0)
  skills           String[]
  notes            String?  @db.Text

  confirmed        Boolean  @default(false)

  user             User     @relation("WorkRelationshipsAsUser", fields: [userId], references: [id])
  relatedUser      User     @relation("WorkRelationshipsAsRelated", fields: [relatedUserId], references: [id])

  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@unique([userId, relatedUserId])
  @@index([userId])
  @@index([relatedUserId])
  @@index([relationshipType])
  @@map("work_relationships")
}
```

**Enum update — add missing values:**

```prisma
enum WorkRelationshipType {
  MANAGER
  PEER
  DIRECT_REPORT
  CLIENT
  VENDOR
  MENTOR
  MENTEE
  COWORKER
  COLLABORATOR
}
```

**User model update:** Add reverse relations:

```prisma
workRelationships        WorkRelationship[] @relation("WorkRelationshipsAsUser")
workRelationshipsRelated WorkRelationship[] @relation("WorkRelationshipsAsRelated")
```

### Task 2.2: Revise `TeamReunion` model

**File:** `packages/database/prisma/schemas/main.prisma`

**Changes:**

1. Rename `companyName` → `company`
2. Add `status` field with `TeamReunionStatus` enum
3. Add `projectName`, `projectDescription`, `proposedBudget`, `proposedTimeline`, `requiredSkills` fields
4. Add `creator` relation to User

**Revised model:**

```prisma
model TeamReunion {
  id                   String   @id @default(uuid())
  name                 String
  description          String?  @db.Text
  creatorId            String   @map("creator_id") @db.Uuid
  creator              User     @relation("TeamReunionCreator", fields: [creatorId], references: [id])

  company              String?
  industry             String?
  yearsWorkedTogether  Int?     @map("years_worked_together")

  projectName          String?  @map("project_name")
  projectDescription   String?  @db.Text @map("project_description")
  proposedBudget       Decimal? @db.Decimal(12, 2) @map("proposed_budget")
  proposedTimeline     String?  @map("proposed_timeline")
  requiredSkills       String[] @map("required_skills")

  status               TeamReunionStatus @default(PROPOSED)
  isActive             Boolean  @default(true) @map("is_active")

  members              TeamReunionMember[]

  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  @@index([creatorId])
  @@index([isActive])
  @@index([status])
  @@map("team_reunions")
}

enum TeamReunionStatus {
  PROPOSED
  CONFIRMED
  ACTIVE
  COMPLETED
  CANCELLED
}
```

**User model update:** Add `teamReunionsCreated TeamReunion[] @relation("TeamReunionCreator")`

### Task 2.3: Revise `TeamReunionMember` model

**File:** `packages/database/prisma/schemas/main.prisma`

**Changes:**

1. Add `proposedRole` field
2. Add `user` relation to User
3. Add `CONFIRMED` and `ACCEPTED` to enum (needed by code)

**Revised model:**

```prisma
model TeamReunionMember {
  id           String   @id @default(uuid())
  reunionId    String   @map("reunion_id")
  reunion      TeamReunion @relation(fields: [reunionId], references: [id], onDelete: Cascade)

  userId       String   @map("user_id") @db.Uuid
  user         User     @relation("TeamReunionMembers", fields: [userId], references: [id])

  role         String?
  proposedRole String?  @map("proposed_role")
  relationship String?

  status       TeamReunionMemberStatus @default(INVITED)
  invitedAt    DateTime @default(now()) @map("invited_at")
  joinedAt     DateTime? @map("joined_at")

  createdAt    DateTime @default(now()) @map("created_at")

  @@unique([reunionId, userId])
  @@index([userId])
  @@index([status])
  @@map("team_reunion_members")
}

enum TeamReunionMemberStatus {
  INVITED
  ACCEPTED
  CONFIRMED
  JOINED
  DECLINED
}
```

**User model update:** Add `teamReunionMemberships TeamReunionMember[] @relation("TeamReunionMembers")`

### Task 2.4: Revise `EngagementOutcome` model

**File:** `packages/database/prisma/schemas/main.prisma`

**Changes:**

1. Add `contractId` field (alias for lookup compatibility)
2. Add `clientId` and `freelancerId` with User relations
3. Add `rating`, `score`, `metrics` fields
4. Add `createdAt` field (code uses it for ordering)
5. Add `outcomeType` field

**Revised model:**

```prisma
model EngagementOutcome {
  id                     String   @id @default(uuid())
  engagementId           String   @unique @map("engagement_id") @db.Uuid
  contractId             String?  @map("contract_id")

  clientId               String?  @map("client_id") @db.Uuid
  freelancerId           String?  @map("freelancer_id") @db.Uuid
  client                 User?    @relation("OutcomeClient", fields: [clientId], references: [id])
  freelancer             User?    @relation("OutcomeFreelancer", fields: [freelancerId], references: [id])

  outcomeType            String?  @map("outcome_type")
  rating                 String?
  score                  Int?

  successScore           Int?     @map("success_score")
  clientSatisfaction     Int?     @map("client_satisfaction")
  freelancerSatisfaction Int?     @map("freelancer_satisfaction")

  totalRevenue           Decimal? @db.Decimal(12, 2) @map("total_revenue")
  totalHours             Decimal? @db.Decimal(8, 2) @map("total_hours")
  avgHourlyRate          Decimal? @db.Decimal(10, 2) @map("avg_hourly_rate")

  deliverablesCompleted  Int?     @map("deliverables_completed")
  deliverablesTotal      Int?     @map("deliverables_total")
  onTimeDelivery         Boolean? @map("on_time_delivery")

  responseTimeAvg        Int?     @map("response_time_avg")
  communicationRating    Int?     @map("communication_rating")

  renewed                Boolean  @default(false)
  referralGiven          Boolean  @default(false) @map("referral_given")

  metrics                Json?
  insights               Json?
  recommendations        String[] @db.Text

  clientFeedback         String?  @db.Text @map("client_feedback")
  freelancerFeedback     String?  @db.Text @map("freelancer_feedback")
  lessonsLearned         String[] @map("lessons_learned")

  createdAt              DateTime @default(now()) @map("created_at")
  calculatedAt           DateTime @default(now()) @map("calculated_at")
  updatedAt              DateTime @updatedAt @map("updated_at")

  @@index([contractId])
  @@index([clientId])
  @@index([freelancerId])
  @@index([successScore])
  @@map("engagement_outcomes")
}
```

**User model update:** Add:

```prisma
outcomeAsClient     EngagementOutcome[] @relation("OutcomeClient")
outcomeAsFreelancer EngagementOutcome[] @relation("OutcomeFreelancer")
```

### Task 2.5: Update `InvoiceFinancing` — add missing fields and enum values

**File:** `packages/database/prisma/schemas/financial.prisma`

**Changes:**

1. Add `feePercentage Decimal?` field
2. Add `PENDING_REVIEW` and `PARTIALLY_REPAID` to `InvoiceFinancingStatus` enum
3. Add `user` relation (via `tenantId` → we'll also consider adding `userId`)

**Enum update:**

```prisma
enum InvoiceFinancingStatus {
  PENDING
  PENDING_REVIEW
  UNDER_REVIEW
  APPROVED
  REJECTED
  FUNDED
  PARTIALLY_REPAID
  REPAID
  DEFAULTED
}
```

**Field additions to InvoiceFinancing:**

```prisma
feePercentage    Decimal? @db.Decimal(5, 2) @map("fee_percentage")
userId           String?  @map("user_id")
user             User?    @relation(fields: [userId], references: [id])
```

### Task 2.6: Update `TaxVault` — add deposit/withdrawal relations

Already handled in Sprint 1 Task 1.3. The `TaxVault` model needs its relation fields updated to point to the new `TaxVaultDeposit` and `TaxVaultWithdrawal` models.

### Task 2.7: Update `ExecutiveIntegrationStatus` enum

**File:** `packages/database/prisma/schemas/executive.prisma`

Add `REQUIRES_REAUTH` to enum:

```prisma
enum ExecutiveIntegrationStatus {
  PENDING
  CONNECTED
  DISCONNECTED
  ERROR
  REQUIRES_REAUTH
}
```

### Task 2.8: Regenerate Prisma Client

```bash
cd packages/database
npx prisma validate
npx prisma generate
```

### Task 2.9: Generate Migration (dev only)

```bash
npx prisma migrate dev --name add_missing_models_and_fields
```

Review the generated SQL to ensure no data-destructive changes.

---

## Sprint 3: Service Code Fixes — financial-svc

**Goal:** Fix all 76 errors across 3 files  
**Estimated effort:** 2–3 days  
**Prerequisite:** Sprint 1 + Sprint 2 complete, Prisma client regenerated

### Task 3.1: Fix `invoice-financing.service.ts` (26 errors)

After Sprint 2 schema changes, many errors will auto-resolve. Remaining code fixes:

| Line(s)                | Error                                         | Fix                                                          |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| 20                     | `invoiceFinancingRequests` not on UserInclude | Remove include or use correct relation name                  |
| 39, 319, 320           | `userId` not on InvoiceFinancingWhereInput    | Use `tenantId` OR use new `userId` field after schema update |
| 55, 291, 322, 325, 329 | `PARTIALLY_REPAID` not assignable             | ✅ Fixed by enum update                                      |
| 60, 338, 339           | `_sum` possibly undefined                     | Add null-coalescing: `result._sum?.field ?? 0`               |
| 73                     | `invoiceFinancingRequests` not on User result | Use separate query or correct include                        |
| 133, 205, 349, 364     | `PENDING_REVIEW` not assignable               | ✅ Fixed by enum update                                      |
| 148, 354               | `user` not on InvoiceFinancingInclude         | ✅ Fixed by adding relation in Sprint 2                      |
| 209, 211, 216          | `feePercentage` not on result/update          | ✅ Fixed by adding field in Sprint 2                         |
| 282                    | `repaidAmount` → use `repaymentAmount`        | Code fix                                                     |
| 283, 330, 339          | `feeAmount` → use `fees`                      | Code fix                                                     |

### Task 3.2: Fix `skillancer-card.service.ts` (40 errors)

After `SkillancerCard` model creation (Sprint 1), the `prisma.skillancerCard` errors resolve. Remaining:

| Pattern                                       | Count | Fix                                          |
| --------------------------------------------- | ----- | -------------------------------------------- |
| `prisma.skillancerCard` not found             | 14    | ✅ Resolved by new model                     |
| `transactionType` not on CardTransaction      | 5     | Use existing `type` field in CardTransaction |
| `transactionDate` not on CardTransaction      | 2     | Use `createdAt` or `settledAt`               |
| `cashbackAmount` not on CardTransaction       | 1     | Compute from card's `cashbackRate` × amount  |
| `monthlySpend._sum` possibly undefined        | 1     | Null-coalescing                              |
| `pendingTransactions._sum` possibly undefined | 1     | Null-coalescing                              |

**Note:** The `SkillancerCard` model needs careful integration with `CardTransaction`. The existing `CardTransaction` has a `cardId` FK to `IssuedCard`. Options:

- **Option A:** Add a separate `skillancerCardId` FK to `CardTransaction` (parallel to `cardId`)
- **Option B:** Create a separate `SkillancerCardTransaction` model
- **Option C:** Make `SkillancerCard` transactions go through a different path

**Recommendation:** Option A — add `skillancerCardId` FK. This keeps the transaction model unified.

### Task 3.3: Fix `tax-vault.service.ts` (27 errors)

After Sprint 1 model creation + Sprint 2 relation updates:

| Pattern                                            | Count | Fix                              |
| -------------------------------------------------- | ----- | -------------------------------- |
| `taxVaultDeposit` / `taxVaultWithdrawal` not found | 10    | ✅ Resolved by new models        |
| `currentBalance` → `balance`                       | 5     | Code fix: find-replace           |
| `targetPercentage` → `savingsRate`                 | 6     | Code fix: find-replace           |
| `totalDeposits` / `totalWithdrawals`               | 2     | Compute via aggregate queries    |
| `autosaveEnabled` → `autoSaveEnabled`              | 1     | Code fix: fix casing             |
| `deposits` (include) → `deposits` relation         | 1     | ✅ Resolved by new relation name |

### Task 3.4: Validate

```bash
cd services/financial-svc
pnpm build
```

Target: **0 errors**.

---

## Sprint 4: Service Code Fixes — intelligence-svc

**Goal:** Fix all 53 errors across 4 files  
**Estimated effort:** 2 days  
**Prerequisite:** Sprint 1 + Sprint 2 complete

### Task 4.1: Fix `outcome.service.ts` (24 errors)

After Sprint 2 `EngagementOutcome` revision:

| Pattern                                     | Count | Fix                                         |
| ------------------------------------------- | ----- | ------------------------------------------- |
| `contractId` not on where/create            | 3     | ✅ Resolved by adding field                 |
| `clientId` / `freelancerId` not on where    | 3     | ✅ Resolved by adding fields                |
| `client` / `freelancer` include type errors | 1     | ✅ Resolved by adding relations             |
| `createdAt` not on orderBy                  | 3     | ✅ Resolved by adding field                 |
| `rating` not on result                      | 3     | ✅ Resolved by adding field                 |
| `score` not on result / aggregation         | 4     | ✅ Resolved by adding field                 |
| `metrics` not on result                     | 2     | ✅ Resolved by adding field                 |
| `AND`/`OR`/`NOT` circular type errors       | 3     | May need explicit typing of `having` clause |
| `score` in AggregateInputType               | 1     | Use correct field name in `_avg`            |

**Remaining manual fixes:**

- Circular type errors in `having` clause (line 377): Explicitly type the groupBy/having object or use `Prisma.sql` raw query
- Aggregate input: use `score` (now valid) or `successScore` in `_avg`

### Task 4.2: Fix `prediction.service.ts` (17 errors)

After Sprint 1 `SuccessPrediction` model creation:

| Pattern                                              | Count | Fix                      |
| ---------------------------------------------------- | ----- | ------------------------ |
| `successPrediction` not found                        | 7     | ✅ Resolved by new model |
| `freelancerId` / `clientId` not on EngagementOutcome | 4     | ✅ Resolved by Sprint 2  |
| `createdAt` not on EngagementOutcome orderBy         | 3     | ✅ Resolved by Sprint 2  |
| `rating` not on EngagementOutcome                    | 3     | ✅ Resolved by Sprint 2  |

### Task 4.3: Fix `risk-alert.service.ts` (12 errors)

After Sprint 1 `EngagementRiskAlert` model creation:

All 12 errors are `prisma.engagementRiskAlert` not found → **all resolved by new model**.

### Task 4.4: Fix `rate-limit.ts` and `index.ts` (3 errors)

These are Fastify plugin type issues — handled in Sprint 8.

### Task 4.5: Validate

```bash
cd services/intelligence-svc
pnpm build
```

Target: **≤3 errors** (Fastify plugin types deferred to Sprint 8).

---

## Sprint 5: Service Code Fixes — talent-graph-svc

**Goal:** Fix all 114 errors across 3 files  
**Estimated effort:** 3–4 days (largest service)  
**Prerequisite:** Sprint 1 + Sprint 2 complete

### Task 5.1: Fix `work-relationship.service.ts` (42 errors)

After Sprint 2 `WorkRelationship` revision:

| Pattern                                               | Count | Fix                                                                       |
| ----------------------------------------------------- | ----- | ------------------------------------------------------------------------- |
| `userId` not on where → was `userId1`                 | 8     | ✅ Resolved by schema rename                                              |
| `relatedUserId` not on where                          | 7     | ✅ Resolved by schema rename                                              |
| `company` not on result                               | 4     | ✅ Resolved by schema rename                                              |
| `user`/`relatedUser` include errors                   | 2     | ✅ Resolved by adding relations                                           |
| `RelationshipType` vs `WorkRelationshipType`          | 2     | Code fix: import Prisma enum or cast                                      |
| `strength` not on result                              | 1     | ✅ Resolved by adding field                                               |
| `verified` not on update                              | 1     | Code fix: use `confirmed`                                                 |
| `endorsement` → `endorsements`                        | 1     | Code fix: fix field name                                                  |
| `warmIntroduction` not found                          | 2     | ✅ Resolved by Sprint 1 WarmIntroduction model                            |
| `ACCEPTED`/`CONFIRMED` not in TeamReunionMemberStatus | 2     | ✅ Resolved by Sprint 2 enum update                                       |
| `userId` / `relatedUser` / `user` on result           | 6     | ✅ Resolved by schema renames                                             |
| `skills` on FreelancerProfile                         | 1     | Check if FreelancerProfile has `skills` field; if not, use separate query |
| `company` on result for grouping                      | 4     | ✅ Resolved by schema rename                                              |

**Manual code fixes needed:**

1. `RelationshipType` → `WorkRelationshipType`: Either import from Prisma or cast with `as any`
2. `verified` → `confirmed`: Simple rename
3. `endorsement` → `endorsements`: Simple rename (singular→plural)
4. `skills` on profile query: Verify FreelancerProfile schema

### Task 5.2: Fix `warm-introduction.service.ts` (41 errors)

After Sprint 1 `WarmIntroduction` model + Sprint 2 `WorkRelationship` revision:

| Pattern                                    | Count | Fix                                      |
| ------------------------------------------ | ----- | ---------------------------------------- |
| `warmIntroduction` not found               | 13    | ✅ Resolved by new model                 |
| `userId` on WorkRelationship where         | 7     | ✅ Resolved by schema rename             |
| `relatedUserId` on WorkRelationship where  | 5     | ✅ Resolved by schema rename             |
| `userId` on WorkRelationship result        | 5     | ✅ Resolved by schema rename             |
| `relatedUserId` on result                  | 3     | ✅ Resolved by schema rename             |
| `user`/`relatedUser` on result             | 4     | ✅ Resolved by adding relations          |
| `company` on result                        | 2     | ✅ Resolved by schema rename             |
| `COLLABORATOR` not in WorkRelationshipType | 1     | ✅ Resolved by Sprint 2 enum update      |
| Type conversion `as ConnectionRecord[]`    | 1     | May still need minor interface alignment |

### Task 5.3: Fix `team-reunion.service.ts` (31 errors)

After Sprint 2 `TeamReunion`/`TeamReunionMember` revision:

| Pattern                                        | Count | Fix                                             |
| ---------------------------------------------- | ----- | ----------------------------------------------- |
| `company` on TeamReunion create → now valid    | 1     | ✅ Resolved                                     |
| `creator` include → now valid                  | 1     | ✅ Resolved                                     |
| `CONFIRMED` in member status                   | 3     | ✅ Resolved by enum update                      |
| `ACCEPTED` in member status                    | 2     | ✅ Resolved by enum update                      |
| `user` include on TeamReunionMember            | 2     | ✅ Resolved by adding relation                  |
| `teamReunionId` → `reunionId`                  | 5     | Code fix: find-replace                          |
| `company` on TeamReunion result                | 1     | ✅ Resolved by schema rename                    |
| `userId` / `relatedUserId` on WorkRelationship | 2     | ✅ Resolved by schema rename                    |
| `status` on TeamReunion create/update          | 5     | ✅ Resolved by adding field                     |
| `teamReunion` include → `reunion`              | 2     | Code fix: use `reunion`                         |
| `proposedRole` on member result                | 1     | ✅ Resolved by adding field                     |
| `strength` on orderBy                          | 1     | ✅ Resolved by adding field to WorkRelationship |
| Type cast `as RelationshipWithUsers[]`         | 1     | Update local type interface                     |
| Map callback type mismatch                     | 1     | Update mapper function signature                |

**Manual code fixes needed (after schema):**

1. `teamReunionId` → `reunionId` (5 occurrences): find-replace
2. `teamReunion` (include) → `reunion` (2 occurrences): find-replace
3. Update `RelationshipWithUsers` local type to match Prisma output
4. Fix mapper function that expects `teamReunion` property

### Task 5.4: Validate

```bash
cd services/talent-graph-svc
pnpm build
```

Target: **0 errors**.

---

## Sprint 6: Service Code Fixes — executive-svc

**Goal:** Fix remaining 16 errors across 2 files  
**Estimated effort:** 1 day  
**Prerequisite:** Sprint 2 complete (ExecutiveIntegrationStatus enum update)

### Task 6.1: Fix `integration-hub.service.ts` (15 errors)

| Line          | Error                                              | Fix                                                                               |
| ------------- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| 69, 81, 92    | `prisma.integrationType` doesn't exist             | Remove: there is no IntegrationType model. Use inline type config or a simple map |
| 109, 114, 115 | `integrationType` field on IntegrationConnectInput | Use `integrationTypeSlug` (matches local type definition)                         |
| 167, 189      | `integrationType` as relation include              | Remove: `integrationType` is a String field, not a relation                       |
| 200 (×2)      | `apiKey` doesn't exist on integration              | Remove or use `config` Json field to store API keys                               |
| 223           | `tokenExpiresAt` → `tokenExpiry`                   | Code fix                                                                          |
| 238           | `REQUIRES_REAUTH` not valid enum                   | ✅ Resolved by Sprint 2 enum update                                               |
| 253           | `lastSyncStatus` doesn't exist                     | Remove or use `status` field                                                      |
| 272           | `cachedData` doesn't exist                         | Remove or use `config` Json field                                                 |

**Key design decisions:**

- The service tries to manage "integration types" as a database entity. Since no `IntegrationType` model exists, refactor to use a hardcoded registry (Map or config file) of supported integrations.
- `apiKey`, `lastSyncStatus`, `cachedData` don't exist on `ExecutiveIntegration`. Store these in the `config` Json field or add them to the schema.

**Recommendation:** Add fields to `executive.prisma` `ExecutiveIntegration` model:

```prisma
lastSyncStatus   String?    @map("last_sync_status")
lastSyncAt       DateTime?  @map("last_sync_at")
cachedData       Json?      @map("cached_data")
```

### Task 6.2: Fix `executive-engagement.service.ts` (1 error)

| Line | Error                                           | Fix                                                    |
| ---- | ----------------------------------------------- | ------------------------------------------------------ |
| 235  | `ExecutiveTimeEntryInput` missing `executiveId` | Add `executiveId: string` to the local type definition |

**File:** Find the `ExecutiveTimeEntryInput` type (likely in `services/executive-svc/src/types/`) and add the `executiveId` field.

### Task 6.3: Validate

```bash
cd services/executive-svc
pnpm build
```

Target: **0 errors**.

---

## Sprint 7: Service Code Fixes — copilot-svc

**Goal:** Fix all 11 errors across 4 files  
**Estimated effort:** 1 day  
**Prerequisite:** Sprint 1 complete (CopilotInteraction model), Sprint 8 patterns established

### Task 7.1: Fix `copilot.service.ts` (2 errors)

| Line | Error                          | Fix                               |
| ---- | ------------------------------ | --------------------------------- |
| 329  | `copilotInteraction` not found | ✅ Resolved by Sprint 1 new model |
| 750  | `copilotInteraction` not found | ✅ Resolved by Sprint 1 new model |

### Task 7.2: Fix auth & plugin issues (9 errors)

See Sprint 8 for unified approach.

### Task 7.3: Validate

```bash
cd services/copilot-svc
pnpm build
```

Target: **0 errors** (after Sprint 8 plugin fixes).

---

## Sprint 8: Type System & Plugin Infrastructure

**Goal:** Fix all Fastify plugin type issues across copilot-svc and intelligence-svc  
**Estimated effort:** 1–2 days  
**Services affected:** copilot-svc (9 errors), intelligence-svc (3 errors)

### Task 8.1: Diagnose `@fastify/jwt` type augmentation issue

The `copilot-svc/src/plugins/auth.ts` already has correct type augmentations:

```typescript
declare module '@fastify/jwt' {
  interface FastifyJWT { user: AuthenticatedUser; }
}
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (...) => Promise<void>;
    optionalAuth: (...) => Promise<void>;
  }
}
```

**But the build still reports `jwtVerify` and `user` don't exist on `FastifyRequest`.**

Root cause candidates:

1. `@fastify/jwt` package not installed or wrong version
2. `tsconfig.json` `skipLibCheck` masking the issue
3. Declaration merging not being picked up due to `isolatedModules` or module resolution
4. Missing `@types/` package

**Investigation steps:**

```bash
cd services/copilot-svc
cat package.json | grep fastify
cat tsconfig.json
```

**Fix approach:**

1. Ensure `@fastify/jwt` is in `dependencies` (not just `devDependencies`)
2. Ensure `tsconfig.json` has `"moduleResolution": "node16"` or `"bundler"`
3. If the augmentation still doesn't work, move it to a separate `fastify.d.ts` file and include it in `tsconfig.json` `files` or `include`

### Task 8.2: Fix plugin registration overloads (copilot-svc index.ts)

**Lines 40, 43:**

```typescript
await fastify.register(authPlugin); // line 40 — overload error
await fastify.register(rateLimitPlugin); // line 43 — overload error
```

**Fix:** Ensure plugin exports match `FastifyPluginAsync` signature. If needed, cast:

```typescript
await fastify.register(authPlugin as any);
await fastify.register(rateLimitPlugin as any);
```

Or better: Fix the plugin's export signature to match what `fastify-plugin` expects.

### Task 8.3: Fix `copilot.routes.ts` `request.user`

**Line 33:** `user` doesn't exist on `FastifyRequest`

**Fix:** Import the authenticated user type and use the helper:

```typescript
const user = getAuthenticatedUser(request);
```

(This helper is already defined in the file — ensure it's used consistently.)

### Task 8.4: Fix intelligence-svc `rate-limit.ts` plugin type

**Line 321:** Plugin callback type mismatch.

Same pattern as copilot-svc. Fix the `fp()` call signature or cast appropriately.

### Task 8.5: Fix intelligence-svc `index.ts` plugin registration

Same pattern as copilot-svc Task 8.2.

### Task 8.6: Validate both services

```bash
cd services/copilot-svc && pnpm build
cd services/intelligence-svc && pnpm build
```

Target: **0 errors in both services**.

---

## Sprint 9: Integration Testing & Build Validation

**Goal:** Ensure all 5 services build cleanly and pass basic integration tests  
**Estimated effort:** 2–3 days

### Task 9.1: Full monorepo build

```bash
# From root
pnpm build
```

All 5 services should compile with 0 errors.

### Task 9.2: Prisma migration dry-run

```bash
cd packages/database
npx prisma migrate dev --create-only --name unfinished_services_schema
```

Review generated SQL:

- Verify no `DROP TABLE` or `DROP COLUMN` on existing production tables
- Verify new tables match expectations
- Verify altered tables have safe `ALTER TABLE ADD COLUMN` statements

### Task 9.3: Lint all 5 services

```bash
pnpm lint --filter=executive-svc --filter=copilot-svc --filter=financial-svc --filter=intelligence-svc --filter=talent-graph-svc
```

Fix any lint errors introduced by code changes.

### Task 9.4: Run existing tests

```bash
pnpm test --filter=executive-svc --filter=copilot-svc --filter=financial-svc --filter=intelligence-svc --filter=talent-graph-svc
```

If tests exist, ensure they pass. If no tests exist, add basic smoke tests:

- Service instantiation
- Route registration
- Health endpoint response

### Task 9.5: Write integration tests for new Prisma models

For each new model, write at minimum:

1. Create operation
2. Read by ID
3. List with filtering
4. Update operation
5. Delete operation

### Task 9.6: Type-check entire workspace

```bash
pnpm typecheck
```

Ensure no regressions in the 8 already-deployed services.

---

## Sprint 10: Deployment Pipeline & Production Readiness

**Goal:** Add 5 services to the deployment pipeline and verify production readiness  
**Estimated effort:** 2–3 days

### Task 10.1: Verify Dockerfiles

Ensure each service has a valid `Dockerfile`:

```bash
ls services/executive-svc/Dockerfile
ls services/copilot-svc/Dockerfile
ls services/financial-svc/Dockerfile
ls services/intelligence-svc/Dockerfile
ls services/talent-graph-svc/Dockerfile
```

If missing, create using the pattern from existing deployed services.

### Task 10.2: Update `deploy-hetzner.yml`

Add the 5 services to the GitHub Actions deployment matrix:

```yaml
strategy:
  matrix:
    service:
      # Existing 8 services...
      - executive-svc
      - copilot-svc
      - financial-svc
      - intelligence-svc
      - talent-graph-svc
```

### Task 10.3: Create Kubernetes manifests

For each new service, create K8s deployment + service YAML in `infrastructure/kubernetes/`:

- Deployment with health checks
- Service with ClusterIP
- Ingress rules (if API-facing)
- Environment variable ConfigMap/Secret references

### Task 10.4: Database migration in production

**Critical path:**

1. Back up production database
2. Run migration in staging first
3. Verify no data loss
4. Apply to production
5. Verify all services start correctly

### Task 10.5: Staged rollout

Deploy services one at a time:

1. executive-svc (smallest error count, most fixes already applied)
2. copilot-svc (small error count, isolated service)
3. financial-svc (medium complexity)
4. intelligence-svc (medium complexity)
5. talent-graph-svc (largest, most changes)

Monitor health endpoints and error rates between each deployment.

### Task 10.6: Smoke test in production

For each deployed service:

- Health endpoint responds 200
- Basic API calls succeed
- No error spikes in logs
- Database connections healthy

---

## Risk Register

| #   | Risk                                                        | Probability | Impact   | Mitigation                                                                         |
| --- | ----------------------------------------------------------- | ----------- | -------- | ---------------------------------------------------------------------------------- |
| 1   | Schema changes break existing 8 services                    | Medium      | Critical | Run full `pnpm build` after every schema change; test all services                 |
| 2   | Migration data loss on production tables                    | Low         | Critical | Only ADD columns/tables, never DROP; use `--create-only` review                    |
| 3   | `WorkRelationship` field renames cause runtime errors       | Medium      | High     | These are NEW tables (just created); no production data exists                     |
| 4   | `EngagementOutcome` field additions break existing queries  | Low         | Medium   | New fields are nullable/optional; existing data unaffected                         |
| 5   | Fastify JWT issues persist after type fixes                 | Medium      | Medium   | Fallback: use `as any` casts with TODO for proper fix                              |
| 6   | New models have wrong field types for actual business logic | Medium      | Medium   | Review with product team before finalizing Sprint 1                                |
| 7   | `SkillancerCard` conflicts with existing `IssuedCard` model | Medium      | Medium   | Clear ownership boundary; SkillancerCard = platform card, IssuedCard = Stripe card |
| 8   | Too many User model reverse relations cause perf issues     | Low         | Low      | Relations are lazy-loaded; only fetched when explicitly included                   |

---

## Decision Log

| #   | Decision                                                                   | Rationale                                                                                          | Date           |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------- |
| 1   | Schema-first approach (fix schema before code)                             | Prevents double-work; code aligns to stable schema once                                            | Sprint Plan v1 |
| 2   | Revise recently-created models rather than rewriting service code          | Models were created without full code analysis; service code reflects actual business requirements | Sprint Plan v1 |
| 3   | Add missing enum values rather than rewriting enum usage                   | Less code churn; enums should cover all valid business states                                      | Sprint Plan v1 |
| 4   | Use `@map()` on all new fields for PostgreSQL naming conventions           | Consistency with existing schema patterns                                                          | Sprint Plan v1 |
| 5   | Separate `SkillancerCard` from `IssuedCard`                                | Different lifecycle: IssuedCard = Stripe Issuing, SkillancerCard = platform-managed                | Sprint Plan v1 |
| 6   | Keep `TaxVaultTransaction` alongside new Deposit/Withdrawal models         | TaxVaultTransaction is more generic; Deposit/Withdrawal provide typed access                       | Sprint Plan v1 |
| 7   | Add fields to `EngagementOutcome` rather than rewriting outcome.service.ts | Service code represents desired functionality; schema should support it                            | Sprint Plan v1 |
| 8   | Deploy services one-at-a-time in production                                | Allows isolated debugging; prevents cascading failures                                             | Sprint Plan v1 |

---

## Sprint Timeline Summary

| Sprint | Focus                                      | Duration | Dependencies |
| ------ | ------------------------------------------ | -------- | ------------ |
| **1**  | Create 7 missing Prisma models             | 1–2 days | None         |
| **2**  | Revise existing models + enums + relations | 2–3 days | Sprint 1     |
| **3**  | financial-svc code fixes (76 errors)       | 2–3 days | Sprint 2     |
| **4**  | intelligence-svc code fixes (53 errors)    | 2 days   | Sprint 2     |
| **5**  | talent-graph-svc code fixes (114 errors)   | 3–4 days | Sprint 2     |
| **6**  | executive-svc code fixes (16 errors)       | 1 day    | Sprint 2     |
| **7**  | copilot-svc code fixes (2 model errors)    | 0.5 days | Sprint 1     |
| **8**  | Fastify plugin type fixes (14 errors)      | 1–2 days | Sprint 7     |
| **9**  | Integration testing & validation           | 2–3 days | Sprints 3–8  |
| **10** | Deployment pipeline & production           | 2–3 days | Sprint 9     |

**Total estimated duration: 17–24 working days (3.5–5 weeks)**

---

## Quick Reference: Error Resolution After Schema Fixes

After completing Sprints 1 and 2 (schema work only), the error landscape changes dramatically:

| Service          | Current Errors | Auto-Resolved by Schema                        | Manual Code Fixes Needed          |
| ---------------- | -------------- | ---------------------------------------------- | --------------------------------- |
| executive-svc    | 16             | 1 (REQUIRES_REAUTH enum)                       | 15                                |
| copilot-svc      | 11             | 2 (CopilotInteraction)                         | 9 (mostly Fastify types)          |
| financial-svc    | 76             | ~35 (new models + enum values + relations)     | ~41 (field renames in code)       |
| intelligence-svc | 53             | ~42 (new models + EngagementOutcome fields)    | ~11 (Fastify types + aggregation) |
| talent-graph-svc | 114            | ~85 (schema renames + new model + enum values) | ~29 (field renames + type casts)  |
| **TOTAL**        | **270**        | **~165 (61%)**                                 | **~105 (39%)**                    |

Schema work resolves **61% of all errors** before touching a single service file.
