/**
 * CJS-compatible re-export of @prisma/client enums and runtime values.
 * This file uses createRequire to safely import from the CJS @prisma/client
 * module, avoiding ESM/CJS named export interop issues.
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PrismaClientModule = require('@prisma/client');

// Core exports
export const PrismaClient = PrismaClientModule.PrismaClient;
export const Prisma = PrismaClientModule.Prisma;

// Auth/Trust enums
export const MfaMethod = PrismaClientModule.MfaMethod;
export const TrustTier = PrismaClientModule.TrustTier;
export const TrustTrend = PrismaClientModule.TrustTrend;

// Compliance enums
export const ComplianceEventType = PrismaClientModule.ComplianceEventType;
export const ComplianceSeverity = PrismaClientModule.ComplianceSeverity;
export const ThresholdContextType = PrismaClientModule.ThresholdContextType;

// HIPAA enums
export const HipaaComplianceLevel = PrismaClientModule.HipaaComplianceLevel;
export const BaaStatus = PrismaClientModule.BaaStatus;
export const PhiAccessType = PrismaClientModule.PhiAccessType;
export const PhiCategory = PrismaClientModule.PhiCategory;
export const HipaaTrainingType = PrismaClientModule.HipaaTrainingType;
export const TrainingStatus = PrismaClientModule.TrainingStatus;
export const BreachIncidentType = PrismaClientModule.BreachIncidentType;
export const BreachSeverity = PrismaClientModule.BreachSeverity;
export const BreachStatus = PrismaClientModule.BreachStatus;
export const PhiFieldType = PrismaClientModule.PhiFieldType;

// Contract Management V2 enums
export const ContractSourceType = PrismaClientModule.ContractSourceType;
export const ContractTypeV2 = PrismaClientModule.ContractTypeV2;
export const RateTypeV2 = PrismaClientModule.RateTypeV2;
export const ContractStatusV2 = PrismaClientModule.ContractStatusV2;
export const MilestoneStatusV2 = PrismaClientModule.MilestoneStatusV2;
export const TimeEntryStatusV2 = PrismaClientModule.TimeEntryStatusV2;
export const EvidenceType = PrismaClientModule.EvidenceType;
export const AmendmentStatus = PrismaClientModule.AmendmentStatus;
export const TerminationType = PrismaClientModule.TerminationType;
export const ContractActivityType = PrismaClientModule.ContractActivityType;
export const SignatureType = PrismaClientModule.SignatureType;
export const ContractInvoiceStatus = PrismaClientModule.ContractInvoiceStatus;
export const ContractDisputeReason = PrismaClientModule.ContractDisputeReason;
export const ContractDisputeStatus = PrismaClientModule.ContractDisputeStatus;
export const ContractDisputeResolution = PrismaClientModule.ContractDisputeResolution;

// Escrow V2 enums
export const EscrowAccountStatusV2 = PrismaClientModule.EscrowAccountStatusV2;
export const EscrowTransactionTypeV2 = PrismaClientModule.EscrowTransactionTypeV2;
export const EscrowTransactionStatusV2 = PrismaClientModule.EscrowTransactionStatusV2;
export const InvoiceLineItemType = PrismaClientModule.InvoiceLineItemType;

// Cockpit Client & Project enums
export const ClientStatus = PrismaClientModule.ClientStatus;
export const ClientType = PrismaClientModule.ClientType;
export const ClientSource = PrismaClientModule.ClientSource;
export const InteractionType = PrismaClientModule.InteractionType;
export const CrmDocumentType = PrismaClientModule.CrmDocumentType;
export const CrmPriority = PrismaClientModule.CrmPriority;
export const ReminderType = PrismaClientModule.ReminderType;
export const ReminderStatus = PrismaClientModule.ReminderStatus;
export const CockpitProjectStatus = PrismaClientModule.CockpitProjectStatus;
export const CockpitProjectType = PrismaClientModule.CockpitProjectType;
export const CockpitBudgetType = PrismaClientModule.CockpitBudgetType;
export const CockpitTaskStatus = PrismaClientModule.CockpitTaskStatus;

// Cockpit Integration enums
export const IntegrationProvider = PrismaClientModule.IntegrationProvider;
export const IntegrationStatus = PrismaClientModule.IntegrationStatus;
export const SyncFrequency = PrismaClientModule.SyncFrequency;
export const IntegrationSyncStatus = PrismaClientModule.IntegrationSyncStatus;
export const MappingEntityType = PrismaClientModule.MappingEntityType;
export const WebhookEventStatus = PrismaClientModule.WebhookEventStatus;

// Cockpit Financial enums
export const FinancialAccountType = PrismaClientModule.FinancialAccountType;
export const FinancialTransactionType = PrismaClientModule.FinancialTransactionType;
export const FinancialTransactionSource = PrismaClientModule.FinancialTransactionSource;
export const FinancialTransactionStatus = PrismaClientModule.FinancialTransactionStatus;
export const RecurrenceFrequency = PrismaClientModule.RecurrenceFrequency;
export const FinancialGoalType = PrismaClientModule.FinancialGoalType;
export const FinancialGoalStatus = PrismaClientModule.FinancialGoalStatus;
export const FinancialPeriodType = PrismaClientModule.FinancialPeriodType;
export const MileagePurpose = PrismaClientModule.MileagePurpose;
export const BusinessType = PrismaClientModule.BusinessType;
export const FilingStatus = PrismaClientModule.FilingStatus;
export const AccountingMethod = PrismaClientModule.AccountingMethod;

// Cockpit Invoice enums
export const InvoiceStatus = PrismaClientModule.InvoiceStatus;
export const LineItemType = PrismaClientModule.LineItemType;
export const DiscountType = PrismaClientModule.DiscountType;
export const LateFeeType = PrismaClientModule.LateFeeType;
export const InvoicePaymentMethod = PrismaClientModule.InvoicePaymentMethod;
export const InvoicePaymentStatus = PrismaClientModule.InvoicePaymentStatus;
export const TemplateLayout = PrismaClientModule.TemplateLayout;
export const InvoiceActivityType = PrismaClientModule.InvoiceActivityType;

// Notification enums
export const UnsubscribeType = PrismaClientModule.UnsubscribeType;
export const NotificationCategory = PrismaClientModule.NotificationCategory;

// Market enums
export const UserStatus = PrismaClientModule.UserStatus;
export const VerificationLevel = PrismaClientModule.VerificationLevel;
export const SkillLevel = PrismaClientModule.SkillLevel;

// Re-export everything else via default for any missed enums
export default PrismaClientModule;
