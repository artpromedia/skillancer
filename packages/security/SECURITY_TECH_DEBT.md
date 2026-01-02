# Security Package Technical Debt

## Overview

The security package has 57 TypeScript errors that need to be addressed. Type checking has been temporarily bypassed to allow other packages to build.

## Error Categories

### 1. Export Mismatches in index.ts

The main export file references types that don't exist in submodules:

- `AuditActor`, `AuditTarget`, `AuditResult` - not exported from `./audit`
- `AnonymizationMethod`, `ConsentRecord`, `DSRProcessingResult`, `RetentionPolicyResult`, `DataClassificationResult` - not exported from `./data-protection`
- `LoginRiskAnalysis`, `LoginRiskLevel`, `BlockedIP`, `KnownDevice` - not exported from `./threat-detection`

### 2. Type Compatibility Issues

- `ThreatType` vs `SecurityEventType` naming mismatches
- Set iteration requires `downlevelIteration` or `target: es2015+`
- Constructor argument count mismatches

### 3. API Inconsistencies

- `removeKnownDevice` vs `removeDevice` method naming
- `blocked` property doesn't exist on threat analysis result
- Property mismatches in `RequestAnalysis` interface

### 4. External Type Issues

- `@types/glob` IOptions compatibility with minimatch
- PDFKit default import requires `esModuleInterop`

## Recommended Actions

1. **Create missing type exports** in each submodule
2. **Update tsconfig.json** to target ES2015+ or enable `downlevelIteration`
3. **Refactor threat type mapping** to maintain consistency between internal and audit types
4. **Add `esModuleInterop: true`** to tsconfig for PDFKit compatibility
5. **Review and align API interfaces** between services

## Priority

Medium - the package is functional but has type safety gaps that should be resolved before next major release.

## To Restore Strict Type Checking

```bash
# Run strict typecheck
pnpm --filter @skillancer/security typecheck:strict
```
