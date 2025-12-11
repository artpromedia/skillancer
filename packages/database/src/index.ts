/**
 * @module @skillancer/database
 * Prisma client and database utilities for Skillancer
 */

// Core client
export * from './client';

// Extensions
export * from './extensions/soft-delete';
export * from './extensions/audit-log';

// Migration utilities
export * from './migration-lock';

// Types (re-exported from Prisma)
export type {
  User,
  UserStatus,
  VerificationLevel,
  RefreshToken,
  UserProfile,
  UserSkill,
  SkillLevel,
  Skill,
  PortfolioItem,
  Tenant,
  TenantMember,
  TenantPlan,
  TenantRole,
  Job,
  JobSkill,
  JobStatus,
  JobVisibility,
  BudgetType,
  JobDuration,
  ExperienceLevel,
  Bid,
  BidStatus,
  Contract,
  ContractStatus,
  Milestone,
  MilestoneStatus,
  Service,
  ServiceSkill,
  ServiceStatus,
  Session,
  SessionStatus,
  SessionType,
  Message,
  MessageType,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  PaymentMethodType,
  PaymentMethodStatus,
  StripeCustomer,
  Invoice,
  InvoiceStatus,
  Review,
  ReviewStatus,
  TrustScore,
  Notification,
  NotificationType,
  NotificationChannel,
  AuditLog,
  UserMfa,
  MfaChallenge,
  // Subscription types
  Subscription,
  SubscriptionProduct,
  BillingInterval,
  SubscriptionStatus,
  SubscriptionInvoice,
  SubscriptionInvoiceStatus,
  UsageRecord,
  UsageAction,
  // Profile types
  FreelancerProfile,
  ClientProfile,
} from '@prisma/client';

// Prisma namespace for types like JsonValue
// export { Prisma } from '@prisma/client';

// Enums (re-exported from Prisma - using value import for runtime access)
export {
  MfaMethod,
  FreelancerAvailability,
  CompanySize,
  HiringFrequency,
  JobType,
} from '@prisma/client';
