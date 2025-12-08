/**
 * @module @skillancer/database
 * Prisma client and database utilities for Skillancer
 */

// Core client
export * from './client';

// Extensions
export * from './extensions/soft-delete';
export * from './extensions/audit-log';

// Types (re-exported from Prisma)
export type {
  User,
  UserStatus,
  VerificationLevel,
  RefreshToken,
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
  Invoice,
  InvoiceStatus,
  Review,
  ReviewStatus,
  TrustScore,
  Notification,
  NotificationType,
  NotificationChannel,
  AuditLog,
} from '@prisma/client';
