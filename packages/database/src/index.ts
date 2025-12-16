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
  // Review types
  Review,
  ReviewType,
  ReviewStatus,
  ReviewResponse,
  ReviewHelpfulVote,
  ReviewReport,
  ReviewReportReason,
  ReportStatus,
  ReviewInvitation,
  ReviewInvitationStatus,
  UserRatingAggregation,
  // Trust Score types
  TrustScore,
  TrustScoreHistory,
  SkillPodComplianceRecord,
  TrustScoreThreshold,
  Notification,
  NotificationType,
  NotificationChannel,
  AuditLog,
  UserMfa,
  MfaChallenge,
  // Product and Pricing types
  Product,
  ProductType,
  Price,
  PriceBillingInterval,
  PriceTier,
  PriceUsageType,
  // Coupon types
  Coupon,
  CouponDiscountType,
  CouponDuration,
  CouponRedemption,
  // Subscription types
  Subscription,
  SubscriptionProduct,
  BillingInterval,
  SubscriptionStatus,
  SubscriptionInvoice,
  SubscriptionInvoiceStatus,
  UsageRecord,
  UsageAction,
  // Payout and Transaction types
  PayoutAccount,
  PayoutAccountType,
  PayoutAccountStatus,
  PaymentTransaction,
  TransactionType,
  TransactionStatus,
  Payout,
  PayoutStatus,
  // HIPAA Compliance types
  HipaaCompliance,
  HipaaComplianceLevel,
  BaaStatus,
  PhiAccessLog,
  PhiAccessType,
  PhiCategory,
  HipaaTraining,
  HipaaTrainingType,
  TrainingStatus,
  BreachIncident,
  BreachIncidentType,
  BreachSeverity,
  BreachStatus,
  BreachTimeline,
  PhiToken,
  PhiFieldType,
  // Kill Switch types
  KillSwitchEvent,
  KillSwitchAction,
  AccessRevocation,
  RevocationScope,
} from '@prisma/client';

// Prisma namespace is already exported via client.ts

// Enums (re-exported from Prisma - using value import for runtime access)
export {
  MfaMethod,
  TrustTier,
  TrustTrend,
  ComplianceEventType,
  ComplianceSeverity,
  ThresholdContextType,
  // HIPAA enums
  HipaaComplianceLevel as HipaaComplianceLevelEnum,
  BaaStatus as BaaStatusEnum,
  PhiAccessType as PhiAccessTypeEnum,
  PhiCategory as PhiCategoryEnum,
  HipaaTrainingType as HipaaTrainingTypeEnum,
  TrainingStatus as TrainingStatusEnum,
  BreachIncidentType as BreachIncidentTypeEnum,
  BreachSeverity as BreachSeverityEnum,
  BreachStatus as BreachStatusEnum,
  PhiFieldType as PhiFieldTypeEnum,
} from '@prisma/client';
