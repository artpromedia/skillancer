/*
  Warnings:

  - You are about to drop the column `channel` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `sent_at` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `review_count` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `tiers` on the `services` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[freelancer_id,slug]` on the table `services` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `body` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `notifications` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `base_price` to the `services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deliverables` to the `services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `delivery_days` to the `services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `short_description` to the `services` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `category` on the `services` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ComplianceType" AS ENUM ('HIPAA', 'SOC2', 'PCI_DSS', 'GDPR', 'ISO_27001', 'FEDRAMP', 'NIST', 'CCPA', 'FERPA', 'GLBA', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ComplianceCategory" AS ENUM ('HEALTHCARE', 'FINANCE', 'GOVERNMENT', 'PRIVACY', 'SECURITY', 'INDUSTRY_SPECIFIC', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ClearanceLevel" AS ENUM ('PUBLIC_TRUST', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET', 'TOP_SECRET_SCI');

-- CreateEnum
CREATE TYPE "ComplianceVerificationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'VERIFIED', 'FAILED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "BidType" AS ENUM ('STANDARD', 'INVITED', 'FEATURED');

-- CreateEnum
CREATE TYPE "BidMessageType" AS ENUM ('MESSAGE', 'INTERVIEW_REQUEST', 'INTERVIEW_SCHEDULED', 'CLARIFICATION', 'COUNTER_OFFER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('DEVELOPMENT', 'DESIGN', 'WRITING', 'MARKETING', 'VIDEO', 'MUSIC', 'BUSINESS', 'DATA', 'LIFESTYLE', 'OTHER');

-- CreateEnum
CREATE TYPE "PackageTier" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('PENDING_REQUIREMENTS', 'PENDING_PAYMENT', 'IN_PROGRESS', 'DELIVERED', 'REVISION_REQUESTED', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ServicePaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "ServiceEscrowStatus" AS ENUM ('NOT_FUNDED', 'FUNDED', 'RELEASED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ServiceDeliveryStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "ServiceMessageType" AS ENUM ('TEXT', 'DELIVERY', 'REVISION_REQUEST', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ClipboardPolicy" AS ENUM ('BLOCKED', 'READ_ONLY', 'WRITE_ONLY', 'BIDIRECTIONAL', 'APPROVAL_REQUIRED');

-- CreateEnum
CREATE TYPE "FileTransferPolicy" AS ENUM ('BLOCKED', 'ALLOWED', 'APPROVAL_REQUIRED', 'LOGGED_ONLY');

-- CreateEnum
CREATE TYPE "PrintingPolicy" AS ENUM ('BLOCKED', 'LOCAL_ONLY', 'PDF_ONLY', 'ALLOWED', 'APPROVAL_REQUIRED');

-- CreateEnum
CREATE TYPE "UsbPolicy" AS ENUM ('BLOCKED', 'STORAGE_BLOCKED', 'WHITELIST_ONLY', 'ALLOWED');

-- CreateEnum
CREATE TYPE "PeripheralPolicy" AS ENUM ('BLOCKED', 'ALLOWED', 'SESSION_PROMPT');

-- CreateEnum
CREATE TYPE "NetworkPolicy" AS ENUM ('BLOCKED', 'RESTRICTED', 'MONITORED', 'UNRESTRICTED');

-- CreateEnum
CREATE TYPE "ViolationType" AS ENUM ('CLIPBOARD_COPY_ATTEMPT', 'CLIPBOARD_PASTE_BLOCKED', 'FILE_DOWNLOAD_BLOCKED', 'FILE_UPLOAD_BLOCKED', 'SCREEN_CAPTURE_ATTEMPT', 'USB_DEVICE_BLOCKED', 'NETWORK_ACCESS_BLOCKED', 'PRINT_BLOCKED', 'SESSION_TIMEOUT', 'IDLE_TIMEOUT', 'UNAUTHORIZED_PERIPHERAL', 'POLICY_BYPASS_ATTEMPT', 'SUSPICIOUS_ACTIVITY');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ViolationAction" AS ENUM ('LOGGED', 'WARNED', 'BLOCKED', 'SESSION_TERMINATED', 'USER_SUSPENDED', 'INCIDENT_CREATED');

-- CreateEnum
CREATE TYPE "TransferDirection" AS ENUM ('UPLOAD', 'DOWNLOAD');

-- CreateEnum
CREATE TYPE "TransferRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContainmentEventType" AS ENUM ('CLIPBOARD_COPY', 'CLIPBOARD_PASTE', 'FILE_DOWNLOAD', 'FILE_UPLOAD', 'PRINT_REQUEST', 'USB_CONNECT', 'USB_DISCONNECT', 'NETWORK_REQUEST', 'SCREEN_CAPTURE', 'PERIPHERAL_ACCESS', 'SESSION_START', 'SESSION_END', 'POLICY_CHANGE', 'WATERMARK_DISPLAYED');

-- CreateEnum
CREATE TYPE "ContainmentEventCategory" AS ENUM ('DATA_TRANSFER', 'DEVICE_ACCESS', 'NETWORK', 'SESSION', 'SECURITY', 'CONFIGURATION');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('CLIPBOARD_TEXT', 'CLIPBOARD_IMAGE', 'CLIPBOARD_FILE', 'FILE_DOWNLOAD', 'FILE_UPLOAD', 'USB_TRANSFER', 'PRINT', 'SCREEN_SHARE');

-- CreateEnum
CREATE TYPE "TransferAttemptDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "TransferAction" AS ENUM ('ALLOWED', 'BLOCKED', 'LOGGED', 'QUARANTINED', 'OVERRIDE_APPROVED');

-- CreateEnum
CREATE TYPE "CaptureType" AS ENUM ('SCREENSHOT', 'SCREEN_RECORDING', 'REMOTE_DESKTOP', 'PRINT_SCREEN_KEY', 'SNIPPING_TOOL', 'THIRD_PARTY_APP', 'BROWSER_EXTENSION', 'OS_NATIVE');

-- CreateEnum
CREATE TYPE "ExceptionScope" AS ENUM ('USER', 'GROUP', 'FILE_TYPE', 'DOMAIN', 'APPLICATION', 'TIME_WINDOW', 'IP_ADDRESS');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('CLIPBOARD', 'FILE_TRANSFER', 'USB', 'PRINT', 'SCREEN_CAPTURE', 'NETWORK');

-- CreateEnum
CREATE TYPE "OverrideRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('MESSAGES', 'PROJECTS', 'CONTRACTS', 'PAYMENTS', 'ACCOUNT', 'MARKETING', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "EmailFrequency" AS ENUM ('IMMEDIATE', 'HOURLY', 'DAILY', 'WEEKLY', 'NEVER');

-- CreateEnum
CREATE TYPE "DigestType" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "DigestStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "UnsubscribeType" AS ENUM ('ALL', 'CATEGORY', 'TYPE');

-- CreateEnum
CREATE TYPE "EscrowTransactionType" AS ENUM ('FUND', 'RELEASE', 'REFUND', 'PARTIAL_RELEASE', 'PARTIAL_REFUND', 'FEE_DEDUCTION');

-- CreateEnum
CREATE TYPE "EscrowTransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'REQUIRES_CAPTURE', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EscrowBalanceStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TimeLogStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BILLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('QUALITY_ISSUES', 'MISSED_DEADLINE', 'SCOPE_DISAGREEMENT', 'COMMUNICATION_ISSUES', 'NON_DELIVERY', 'PAYMENT_ISSUE', 'WORK_NOT_AS_DESCRIBED', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESPONDED', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('FULL_REFUND', 'PARTIAL_REFUND', 'FULL_RELEASE', 'PARTIAL_RELEASE', 'SPLIT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisputeRole" AS ENUM ('CLIENT', 'FREELANCER', 'MEDIATOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "HipaaComplianceLevel" AS ENUM ('NONE', 'BASIC', 'STANDARD', 'ENHANCED');

-- CreateEnum
CREATE TYPE "BaaStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'UNDER_REVIEW', 'SIGNED', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PhiAccessType" AS ENUM ('VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'SHARE');

-- CreateEnum
CREATE TYPE "PhiCategory" AS ENUM ('DEMOGRAPHIC', 'MEDICAL_RECORD', 'BILLING', 'GENETIC', 'MENTAL_HEALTH', 'SUBSTANCE_ABUSE', 'HIV_AIDS', 'OTHER');

-- CreateEnum
CREATE TYPE "HipaaTrainingType" AS ENUM ('AWARENESS', 'SECURITY', 'PRIVACY', 'BREACH', 'ANNUAL_REFRESH');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BreachIncidentType" AS ENUM ('UNAUTHORIZED_ACCESS', 'DATA_THEFT', 'LOST_DEVICE', 'HACKING', 'IMPROPER_DISPOSAL', 'UNAUTHORIZED_DISCLOSURE', 'OTHER');

-- CreateEnum
CREATE TYPE "BreachSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BreachStatus" AS ENUM ('INVESTIGATING', 'CONTAINED', 'NOTIFYING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PhiFieldType" AS ENUM ('SSN', 'DOB', 'PHONE', 'EMAIL', 'NAME', 'ADDRESS', 'MEDICAL_RECORD', 'INSURANCE_ID', 'OTHER');

-- CreateEnum
CREATE TYPE "KillSwitchScope" AS ENUM ('TENANT', 'USER', 'POD', 'SESSION');

-- CreateEnum
CREATE TYPE "KillSwitchReason" AS ENUM ('CONTRACT_TERMINATION', 'SECURITY_INCIDENT', 'POLICY_VIOLATION', 'DATA_BREACH_SUSPECTED', 'UNAUTHORIZED_ACCESS', 'MANUAL_TERMINATION', 'SCHEDULED_END', 'COMPLIANCE_REQUIREMENT');

-- CreateEnum
CREATE TYPE "KillSwitchStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL_FAILURE', 'FAILED');

-- CreateEnum
CREATE TYPE "KillSwitchActionType" AS ENUM ('TERMINATE_SESSION', 'TERMINATE_POD', 'REVOKE_TOKENS', 'PURGE_CACHE', 'PRESERVE_RECORDINGS', 'NOTIFY_USER', 'NOTIFY_ADMIN', 'BLOCK_RECONNECTION');

-- CreateEnum
CREATE TYPE "KillSwitchActionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RevocationScope" AS ENUM ('SKILLPOD_ONLY', 'ALL_PRODUCTS', 'TENANT_WIDE');

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('RECORDING', 'STOPPED', 'PROCESSING', 'COMPLETED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MarkerType" AS ENUM ('SESSION_START', 'SESSION_END', 'APPLICATION_OPEN', 'APPLICATION_CLOSE', 'FILE_ACCESS', 'CLIPBOARD_ACTIVITY', 'IDLE_START', 'IDLE_END', 'SECURITY_EVENT', 'USER_ADDED', 'ERROR');

-- CreateEnum
CREATE TYPE "RecordingAccessType" AS ENUM ('VIEW', 'DOWNLOAD', 'SHARE', 'EXPORT', 'DELETE');

-- CreateEnum
CREATE TYPE "DetectionSourceType" AS ENUM ('UPLOADED_IMAGE', 'WEB_CRAWL', 'MANUAL_REPORT', 'AUTOMATED_SCAN', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'CONFIRMED_LEAK', 'FALSE_POSITIVE', 'INCONCLUSIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('DEVELOPMENT', 'FINANCE', 'DESIGN', 'DATA_SCIENCE', 'GENERAL', 'SECURITY', 'DEVOPS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "OsType" AS ENUM ('UBUNTU', 'DEBIAN', 'CENTOS', 'AMAZON_LINUX', 'WINDOWS_SERVER', 'WINDOWS_DESKTOP');

-- CreateEnum
CREATE TYPE "RegistryType" AS ENUM ('ECR', 'DOCKER_HUB', 'KASM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PodStatus" AS ENUM ('PENDING', 'PROVISIONING', 'STARTING', 'RUNNING', 'STOPPING', 'STOPPED', 'HIBERNATING', 'TERMINATED', 'ERROR');

-- CreateEnum
CREATE TYPE "ScalingEventType" AS ENUM ('SCALE_UP', 'SCALE_DOWN', 'MANUAL_CHANGE', 'AUTO_SCALE', 'INITIAL_PROVISION');

-- CreateEnum
CREATE TYPE "MatchingEventType" AS ENUM ('SEARCH_RESULT', 'RECOMMENDATION', 'INVITATION_SENT', 'BID_SUBMITTED', 'BID_VIEWED', 'BID_SHORTLISTED', 'INTERVIEW_SCHEDULED', 'HIRED', 'PROJECT_COMPLETED');

-- CreateEnum
CREATE TYPE "MatchingOutcome" AS ENUM ('IGNORED', 'VIEWED', 'SHORTLISTED', 'INTERVIEWED', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SkillRelationType" AS ENUM ('PARENT_CHILD', 'SIBLING', 'COMPLEMENTARY', 'PREREQUISITE');

-- CreateEnum
CREATE TYPE "EndorsementType" AS ENUM ('WORKED_WITH', 'VERIFIED_SKILL', 'RECOMMENDATION');

-- CreateEnum
CREATE TYPE "RateSourceType" AS ENUM ('CONTRACT', 'BID', 'SERVICE_ORDER', 'PROFILE_RATE');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('HOURLY', 'FIXED', 'MILESTONE');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "RateChangeReason" AS ENUM ('MARKET_ADJUSTMENT', 'EXPERIENCE_INCREASE', 'SKILL_ADDITION', 'DEMAND_BASED', 'RECOMMENDATION_FOLLOWED', 'MANUAL_CHANGE');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('RATE_INCREASE', 'RATE_DECREASE', 'RATE_OPTIMIZATION', 'SKILL_BASED_ADJUSTMENT', 'DEMAND_BASED_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DemandLevel" AS ENUM ('VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "ContractSourceType" AS ENUM ('PROJECT_BID', 'SERVICE_ORDER', 'DIRECT_HIRE', 'RETAINER');

-- CreateEnum
CREATE TYPE "ContractTypeV2" AS ENUM ('STANDARD', 'ENTERPRISE', 'SERVICE', 'RETAINER');

-- CreateEnum
CREATE TYPE "RateTypeV2" AS ENUM ('HOURLY', 'FIXED', 'MILESTONE', 'RETAINER');

-- CreateEnum
CREATE TYPE "ContractStatusV2" AS ENUM ('DRAFT', 'PENDING_CLIENT_SIGNATURE', 'PENDING_FREELANCER_SIGNATURE', 'ACTIVE', 'PAUSED', 'COMPLETED', 'TERMINATED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "MilestoneStatusV2" AS ENUM ('PENDING', 'FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'PAID', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "TimeEntryStatusV2" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISPUTED', 'INVOICED', 'PAID');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('SCREENSHOT', 'SCREEN_RECORDING', 'SKILLPOD_SESSION', 'MANUAL_LOG');

-- CreateEnum
CREATE TYPE "AmendmentStatus" AS ENUM ('PROPOSED', 'PENDING_CLIENT', 'PENDING_FREELANCER', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TerminationType" AS ENUM ('COMPLETED', 'MUTUAL_AGREEMENT', 'CLIENT_TERMINATED', 'FREELANCER_TERMINATED', 'BREACH', 'DISPUTE_RESOLUTION');

-- CreateEnum
CREATE TYPE "ContractActivityType" AS ENUM ('CONTRACT_CREATED', 'CONTRACT_SENT', 'CONTRACT_SIGNED', 'CONTRACT_ACTIVATED', 'CONTRACT_PAUSED', 'CONTRACT_RESUMED', 'CONTRACT_TERMINATED', 'CONTRACT_COMPLETED', 'MILESTONE_CREATED', 'MILESTONE_FUNDED', 'MILESTONE_STARTED', 'MILESTONE_SUBMITTED', 'MILESTONE_APPROVED', 'MILESTONE_REJECTED', 'MILESTONE_REVISION_REQUESTED', 'MILESTONE_PAID', 'MILESTONE_CANCELLED', 'TIME_LOGGED', 'TIME_APPROVED', 'TIME_REJECTED', 'TIME_DISPUTED', 'INVOICE_CREATED', 'INVOICE_SENT', 'INVOICE_PAID', 'AMENDMENT_PROPOSED', 'AMENDMENT_APPROVED', 'AMENDMENT_REJECTED', 'AMENDMENT_WITHDRAWN', 'DISPUTE_OPENED', 'DISPUTE_RESPONDED', 'DISPUTE_ESCALATED', 'DISPUTE_RESOLVED', 'MESSAGE_SENT', 'FILE_SHARED', 'BUDGET_ALERT');

-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('DRAWN', 'TYPED', 'UPLOADED');

-- CreateEnum
CREATE TYPE "ContractInvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'PAID', 'OVERDUE', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ContractDisputeReason" AS ENUM ('QUALITY_ISSUES', 'MISSED_DEADLINE', 'SCOPE_DISAGREEMENT', 'PAYMENT_DISPUTE', 'COMMUNICATION_ISSUES', 'INCOMPLETE_WORK', 'UNAUTHORIZED_CHARGES', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractDisputeStatus" AS ENUM ('OPEN', 'PENDING_RESPONSE', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContractDisputeResolution" AS ENUM ('FULL_REFUND_TO_CLIENT', 'PARTIAL_REFUND', 'FULL_PAYMENT_TO_FREELANCER', 'SPLIT_PAYMENT', 'MUTUAL_CANCELLATION', 'NO_ACTION');

-- CreateEnum
CREATE TYPE "EscrowAccountStatusV2" AS ENUM ('ACTIVE', 'COMPLETED', 'DISPUTED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EscrowTransactionTypeV2" AS ENUM ('FUND', 'RELEASE', 'PARTIAL_RELEASE', 'REFUND', 'PARTIAL_REFUND', 'HOLD', 'UNHOLD', 'FEE_DEDUCTION');

-- CreateEnum
CREATE TYPE "EscrowTransactionStatusV2" AS ENUM ('PENDING', 'PROCESSING', 'REQUIRES_CAPTURE', 'CAPTURED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InvoiceLineItemType" AS ENUM ('MILESTONE', 'TIME_ENTRY', 'EXPENSE', 'ADJUSTMENT', 'BONUS', 'OTHER');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'PROJECT', 'CONTRACT', 'BID', 'SERVICE_ORDER', 'DISPUTE', 'SUPPORT', 'GROUP');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER', 'READONLY');

-- CreateEnum
CREATE TYPE "ConversationContentType" AS ENUM ('TEXT', 'RICH_TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'CODE', 'LINK_PREVIEW');

-- CreateEnum
CREATE TYPE "ConversationMessageType" AS ENUM ('USER', 'SYSTEM', 'BOT', 'NOTIFICATION');

-- CreateEnum
CREATE TYPE "SystemMessageEventType" AS ENUM ('PARTICIPANT_JOINED', 'PARTICIPANT_LEFT', 'PARTICIPANT_REMOVED', 'CONVERSATION_CREATED', 'CONVERSATION_RENAMED', 'CONTRACT_SIGNED', 'MILESTONE_COMPLETED', 'PAYMENT_RECEIVED', 'DEADLINE_REMINDER');

-- CreateEnum
CREATE TYPE "AttachmentProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "PresenceStatus" AS ENUM ('ONLINE', 'AWAY', 'BUSY', 'DO_NOT_DISTURB', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'AGENCY');

-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('SKILLANCER_MARKET', 'REFERRAL', 'WEBSITE', 'SOCIAL_MEDIA', 'COLD_OUTREACH', 'REPEAT_CLIENT', 'OTHER', 'MANUAL');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('LEAD', 'PROSPECT', 'ACTIVE', 'INACTIVE', 'CHURNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('SOLO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ContactRole" AS ENUM ('DECISION_MAKER', 'INFLUENCER', 'TECHNICAL', 'BILLING', 'PROJECT_MANAGER', 'OTHER');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('EMAIL', 'CALL', 'VIDEO_CALL', 'MEETING', 'MESSAGE', 'NOTE', 'TASK', 'OTHER');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "OpportunitySource" AS ENUM ('SKILLANCER_PROJECT', 'SKILLANCER_SERVICE', 'REFERRAL', 'INBOUND', 'OUTBOUND', 'REPEAT_CLIENT', 'UPSELL', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "CrmPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CrmDocumentType" AS ENUM ('CONTRACT', 'PROPOSAL', 'INVOICE', 'BRIEF', 'DELIVERABLE', 'REFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('FOLLOW_UP', 'CHECK_IN', 'DEADLINE', 'MEETING', 'BIRTHDAY', 'ANNIVERSARY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'COMPLETED', 'SNOOZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'URL', 'EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "CrmEntityType" AS ENUM ('CLIENT', 'PROJECT', 'OPPORTUNITY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BidStatus" ADD VALUE 'INTERVIEW_REQUESTED';
ALTER TYPE "BidStatus" ADD VALUE 'INTERVIEW_SCHEDULED';

-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'PENDING_FUNDING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MilestoneStatus" ADD VALUE 'RELEASED';
ALTER TYPE "MilestoneStatus" ADD VALUE 'DISPUTED';

-- AlterEnum
ALTER TYPE "ServiceStatus" ADD VALUE 'REJECTED';

-- DropIndex
DROP INDEX "notifications_read_at_idx";

-- DropIndex
DROP INDEX "services_slug_idx";

-- DropIndex
DROP INDEX "services_slug_key";

-- AlterTable
ALTER TABLE "bids" ADD COLUMN     "bid_type" "BidType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "boost_expires_at" TIMESTAMP(3),
ADD COLUMN     "boosted_at" TIMESTAMP(3),
ADD COLUMN     "interview_notes" TEXT,
ADD COLUMN     "interview_requested_at" TIMESTAMP(3),
ADD COLUMN     "interview_scheduled_at" TIMESTAMP(3),
ADD COLUMN     "is_boosted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_spam" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proposed_milestones" JSONB,
ADD COLUMN     "quality_factors" JSONB,
ADD COLUMN     "quality_score" INTEGER,
ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "shortlisted_at" TIMESTAMP(3),
ADD COLUMN     "spam_reason" VARCHAR(500),
ADD COLUMN     "viewed_by_client_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "platform_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 10,
ADD COLUMN     "secure_mode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "secure_mode_fee_percent" DECIMAL(5,2),
ADD COLUMN     "skillpod_id" UUID,
ADD COLUMN     "terms" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "milestones" ADD COLUMN     "deliverable_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "deliverables" TEXT,
ADD COLUMN     "escrow_funded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "escrow_funded_at" TIMESTAMP(3),
ADD COLUMN     "escrow_released_at" TIMESTAMP(3),
ADD COLUMN     "max_revisions" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "revision_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "submitted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "channel",
DROP COLUMN "message",
DROP COLUMN "sent_at",
ADD COLUMN     "action_label" VARCHAR(100),
ADD COLUMN     "action_url" VARCHAR(500),
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "category" "NotificationCategory" NOT NULL,
ADD COLUMN     "channels" TEXT[],
ADD COLUMN     "delivery_status" JSONB,
ADD COLUMN     "dismissed_at" TIMESTAMP(3),
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "group_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "group_key" VARCHAR(255),
ADD COLUMN     "icon_url" VARCHAR(500),
ADD COLUMN     "image_url" VARCHAR(500),
ADD COLUMN     "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_read" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
DROP COLUMN "type",
ADD COLUMN     "type" VARCHAR(100) NOT NULL,
ALTER COLUMN "data" DROP NOT NULL;

-- AlterTable
ALTER TABLE "services" DROP COLUMN "images",
DROP COLUMN "rating",
DROP COLUMN "review_count",
DROP COLUMN "tiers",
ADD COLUMN     "avg_rating" DECIMAL(3,2),
ADD COLUMN     "avg_response_hours" INTEGER,
ADD COLUMN     "base_price" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "completed_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN     "deliverables" JSONB NOT NULL,
ADD COLUMN     "delivery_days" INTEGER NOT NULL,
ADD COLUMN     "gallery_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requirements" JSONB,
ADD COLUMN     "revisions_included" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "short_description" VARCHAR(500) NOT NULL,
ADD COLUMN     "subcategory" VARCHAR(100),
ADD COLUMN     "thumbnail_url" VARCHAR(500),
ADD COLUMN     "video_url" VARCHAR(500),
ADD COLUMN     "view_count" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "category",
ADD COLUMN     "category" "ServiceCategory" NOT NULL,
ALTER COLUMN "faqs" DROP NOT NULL,
ALTER COLUMN "faqs" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "security_policy_id" UUID,
ADD COLUMN     "terminated_at" TIMESTAMP(3),
ADD COLUMN     "termination_reason" TEXT;

-- DropEnum
DROP TYPE "NotificationChannel";

-- DropEnum
DROP TYPE "NotificationType";

-- CreateTable
CREATE TABLE "freelancer_compliance" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "compliance_type" "ComplianceType" NOT NULL,
    "certification_name" VARCHAR(200),
    "certification_id" VARCHAR(100),
    "issuing_organization" VARCHAR(200),
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "verification_status" "ComplianceVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMP(3),
    "verified_by" VARCHAR(100),
    "verification_details" JSONB,
    "document_url" VARCHAR(500),
    "document_hash" VARCHAR(64),
    "self_attested" BOOLEAN NOT NULL DEFAULT false,
    "attested_at" TIMESTAMP(3),
    "training_completed" BOOLEAN NOT NULL DEFAULT false,
    "training_completed_at" TIMESTAMP(3),
    "training_provider" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "renewal_reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "renewal_reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freelancer_compliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_clearances" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "clearance_level" "ClearanceLevel" NOT NULL,
    "granted_by" VARCHAR(200) NOT NULL,
    "investigation_type" VARCHAR(50),
    "investigation_date" TIMESTAMP(3),
    "granted_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "last_reinvestigation" TIMESTAMP(3),
    "verification_status" "ComplianceVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMP(3),
    "verification_method" VARCHAR(100),
    "polygraph_completed" BOOLEAN NOT NULL DEFAULT false,
    "polygraph_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_clearances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_requirements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ComplianceCategory" NOT NULL,
    "requires_certification" BOOLEAN NOT NULL DEFAULT false,
    "requires_training" BOOLEAN NOT NULL DEFAULT false,
    "requires_attestation" BOOLEAN NOT NULL DEFAULT false,
    "requires_background_check" BOOLEAN NOT NULL DEFAULT false,
    "validity_period_days" INTEGER,
    "verification_required" BOOLEAN NOT NULL DEFAULT true,
    "verification_providers" TEXT[],
    "training_url" VARCHAR(500),
    "training_duration_hours" INTEGER,
    "certification_url" VARCHAR(500),
    "certification_cost" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "regulatory_body" VARCHAR(200),
    "jurisdiction" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_compliance_requirements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "requires_certification" BOOLEAN NOT NULL DEFAULT false,
    "requires_training" BOOLEAN NOT NULL DEFAULT false,
    "requires_attestation" BOOLEAN NOT NULL DEFAULT true,
    "attestation_questions" JSONB,
    "validity_period_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_compliance_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freelancer_compliance_attestations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "requirement_code" VARCHAR(50) NOT NULL,
    "tenant_requirement_id" UUID,
    "attested_at" TIMESTAMP(3) NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" VARCHAR(500),
    "digital_signature" VARCHAR(500),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freelancer_compliance_attestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_verification_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "compliance_id" UUID NOT NULL,
    "verification_method" VARCHAR(50) NOT NULL,
    "verification_provider" VARCHAR(100),
    "status" "ComplianceVerificationStatus" NOT NULL,
    "failure_reason" TEXT,
    "response_data" JSONB,
    "attempted_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "bid_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "message_type" "BidMessageType" NOT NULL DEFAULT 'MESSAGE',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_invitations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "job_id" UUID NOT NULL,
    "inviter_id" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "message" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "response_message" TEXT,
    "responded_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "viewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_questions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "job_id" UUID NOT NULL,
    "asker_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "answer" TEXT,
    "answered_at" TIMESTAMP(3),
    "answered_by" UUID,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "hidden_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_packages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "service_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "tier" "PackageTier" NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "delivery_days" INTEGER NOT NULL,
    "revisions_included" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "deliverables" JSONB NOT NULL,
    "max_revisions" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_add_ons" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "service_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "additional_days" INTEGER NOT NULL DEFAULT 0,
    "allow_quantity" BOOLEAN NOT NULL DEFAULT false,
    "max_quantity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_number" VARCHAR(20) NOT NULL,
    "service_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'PENDING_REQUIREMENTS',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "add_ons_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "platform_fee" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "payment_status" "ServicePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_intent_id" VARCHAR(100),
    "paid_at" TIMESTAMP(3),
    "escrow_status" "ServiceEscrowStatus" NOT NULL DEFAULT 'NOT_FUNDED',
    "escrow_released_at" TIMESTAMP(3),
    "delivery_days" INTEGER NOT NULL,
    "expected_delivery_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "revisions_included" INTEGER NOT NULL,
    "revisions_used" INTEGER NOT NULL DEFAULT 0,
    "requirement_answers" JSONB,
    "requirements_submitted_at" TIMESTAMP(3),
    "skillpod_enabled" BOOLEAN NOT NULL DEFAULT false,
    "pod_id" UUID,
    "completed_at" TIMESTAMP(3),
    "auto_completes_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "cancelled_by" UUID,
    "dispute_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "package_name" VARCHAR(100) NOT NULL,
    "package_tier" "PackageTier" NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "delivery_days" INTEGER NOT NULL,
    "revisions_included" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "deliverables" JSONB NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order_add_ons" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID NOT NULL,
    "add_on_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "additional_days" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_deliveries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID NOT NULL,
    "delivery_number" INTEGER NOT NULL,
    "message" TEXT,
    "files" JSONB NOT NULL,
    "status" "ServiceDeliveryStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "accepted_at" TIMESTAMP(3),
    "revision_requested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_revision_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "attachments" JSONB,
    "responded_at" TIMESTAMP(3),
    "response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_revision_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_reviews" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "communication_rating" INTEGER,
    "quality_rating" INTEGER,
    "delivery_rating" INTEGER,
    "value_rating" INTEGER,
    "title" VARCHAR(200),
    "content" TEXT,
    "seller_response" TEXT,
    "seller_responded_at" TIMESTAMP(3),
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_verified_purchase" BOOLEAN NOT NULL DEFAULT true,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "message_type" "ServiceMessageType" NOT NULL DEFAULT 'TEXT',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pod_security_policies" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "clipboard_policy" "ClipboardPolicy" NOT NULL DEFAULT 'BLOCKED',
    "clipboard_inbound" BOOLEAN NOT NULL DEFAULT false,
    "clipboard_outbound" BOOLEAN NOT NULL DEFAULT false,
    "clipboard_max_size" INTEGER,
    "clipboard_allowed_types" TEXT[],
    "file_download_policy" "FileTransferPolicy" NOT NULL DEFAULT 'BLOCKED',
    "file_upload_policy" "FileTransferPolicy" NOT NULL DEFAULT 'ALLOWED',
    "allowed_file_types" TEXT[],
    "blocked_file_types" TEXT[],
    "max_file_size" INTEGER,
    "printing_policy" "PrintingPolicy" NOT NULL DEFAULT 'BLOCKED',
    "allow_local_printing" BOOLEAN NOT NULL DEFAULT false,
    "allow_pdf_export" BOOLEAN NOT NULL DEFAULT false,
    "usb_policy" "UsbPolicy" NOT NULL DEFAULT 'BLOCKED',
    "allowed_usb_devices" TEXT[],
    "webcam_policy" "PeripheralPolicy" NOT NULL DEFAULT 'ALLOWED',
    "microphone_policy" "PeripheralPolicy" NOT NULL DEFAULT 'ALLOWED',
    "screen_capture_blocking" BOOLEAN NOT NULL DEFAULT true,
    "watermark_enabled" BOOLEAN NOT NULL DEFAULT true,
    "watermark_config" JSONB,
    "network_policy" "NetworkPolicy" NOT NULL DEFAULT 'RESTRICTED',
    "allowed_domains" TEXT[],
    "blocked_domains" TEXT[],
    "allow_internet" BOOLEAN NOT NULL DEFAULT false,
    "idle_timeout" INTEGER NOT NULL DEFAULT 15,
    "max_session_duration" INTEGER,
    "require_mfa" BOOLEAN NOT NULL DEFAULT true,
    "record_session" BOOLEAN NOT NULL DEFAULT true,
    "log_keystrokes" BOOLEAN NOT NULL DEFAULT false,
    "log_clipboard" BOOLEAN NOT NULL DEFAULT true,
    "log_file_access" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pod_security_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_violations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "violation_type" "ViolationType" NOT NULL,
    "severity" "ViolationSeverity" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "source_ip" VARCHAR(45),
    "user_agent" TEXT,
    "action" "ViolationAction" NOT NULL DEFAULT 'LOGGED',
    "action_details" JSONB,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_transfer_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_hash" VARCHAR(128),
    "direction" "TransferDirection" NOT NULL,
    "purpose" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "TransferRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejected_by" UUID,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "transfer_started_at" TIMESTAMP(3),
    "transfer_completed_at" TIMESTAMP(3),
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "max_downloads" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_transfer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "containment_audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" "ContainmentEventType" NOT NULL,
    "event_category" "ContainmentEventCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "source_ip" VARCHAR(45),
    "target_resource" VARCHAR(500),
    "allowed" BOOLEAN NOT NULL,
    "blocked_reason" TEXT,
    "policy_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "containment_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_transfer_attempts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "transfer_type" "TransferType" NOT NULL,
    "direction" "TransferAttemptDirection" NOT NULL,
    "content_type" VARCHAR(100),
    "content_size" INTEGER,
    "content_hash" VARCHAR(128),
    "file_name" VARCHAR(500),
    "action" "TransferAction" NOT NULL,
    "reason" TEXT,
    "policy_id" UUID,
    "policy_rule" VARCHAR(200),
    "override_approved" BOOLEAN NOT NULL DEFAULT false,
    "override_by" UUID,
    "override_reason" TEXT,
    "override_request_id" UUID,
    "source_application" VARCHAR(200),
    "target_application" VARCHAR(200),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_transfer_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screen_capture_attempts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "capture_type" "CaptureType" NOT NULL,
    "detection_method" VARCHAR(100) NOT NULL,
    "blocked" BOOLEAN NOT NULL,
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "active_application" VARCHAR(200),
    "active_window" VARCHAR(500),
    "process_name" VARCHAR(200),
    "process_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screen_capture_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_exceptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "policy_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "scope" "ExceptionScope" NOT NULL,
    "scope_value" VARCHAR(500),
    "exception_type" "ExceptionType" NOT NULL,
    "allowed_transfer_types" "TransferType"[],
    "allowed_directions" "TransferAttemptDirection"[],
    "max_file_size" INTEGER,
    "allowed_file_types" TEXT[],
    "allowed_domains" TEXT[],
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approval_workflow" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_override_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "attempt_id" UUID,
    "requested_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "transfer_type" "TransferType" NOT NULL,
    "direction" "TransferAttemptDirection" NOT NULL,
    "file_name" VARCHAR(500),
    "content_size" INTEGER,
    "status" "OverrideRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" UUID,
    "approval_notes" TEXT,
    "processed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_override_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "notification_type" VARCHAR(100) NOT NULL,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "email_frequency" "EmailFrequency" NOT NULL DEFAULT 'IMMEDIATE',
    "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT false,
    "quiet_hours_start" VARCHAR(5),
    "quiet_hours_end" VARCHAR(5),
    "quiet_hours_timezone" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "type" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "in_app_title" VARCHAR(200) NOT NULL,
    "in_app_body" TEXT NOT NULL,
    "email_subject" VARCHAR(200),
    "email_html_template" TEXT,
    "email_text_template" TEXT,
    "push_title" VARCHAR(200),
    "push_body" VARCHAR(500),
    "sms_template" VARCHAR(500),
    "default_priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "default_channels" TEXT[],
    "is_groupable" BOOLEAN NOT NULL DEFAULT false,
    "group_key_template" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_digests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "digest_type" "DigestType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "notification_ids" TEXT[],
    "summary" JSONB NOT NULL,
    "status" "DigestStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "email_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_unsubscribes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "unsubscribe_type" "UnsubscribeType" NOT NULL,
    "category" "NotificationCategory",
    "notification_type" VARCHAR(100),
    "source" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_unsubscribes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "milestone_id" UUID,
    "type" "EscrowTransactionType" NOT NULL,
    "status" "EscrowTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "platform_fee" DECIMAL(12,2) NOT NULL,
    "processing_fee" DECIMAL(12,2) NOT NULL,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "stripe_payment_intent_id" VARCHAR(100),
    "stripe_transfer_id" VARCHAR(100),
    "stripe_charge_id" VARCHAR(100),
    "stripe_refund_id" VARCHAR(100),
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID,
    "description" VARCHAR(500),
    "metadata" JSONB,
    "failure_code" VARCHAR(50),
    "failure_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_balances" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "total_funded" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_released" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_refunded" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "frozen_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "EscrowBalanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "description" VARCHAR(500),
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "duration" INTEGER,
    "hourly_rate" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2),
    "status" "TimeLogStatus" NOT NULL DEFAULT 'PENDING',
    "approved_at" TIMESTAMP(3),
    "approved_by" UUID,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" VARCHAR(500),
    "skillpod_session_id" UUID,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "milestone_id" UUID,
    "raised_by" UUID NOT NULL,
    "reason" "DisputeReason" NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disputed_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_by" UUID,
    "resolution" "DisputeResolution",
    "resolution_notes" TEXT,
    "client_refund_amount" DECIMAL(12,2),
    "freelancer_payout_amount" DECIMAL(12,2),
    "respond_by" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "escalated_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "dispute_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "sender_role" "DisputeRole" NOT NULL,
    "message" TEXT NOT NULL,
    "attachment_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proposed_resolution" "DisputeResolution",
    "proposed_client_amount" DECIMAL(12,2),
    "proposed_freelancer_amount" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hipaa_compliance" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "hipaa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "compliance_level" "HipaaComplianceLevel" NOT NULL DEFAULT 'NONE',
    "baa_status" "BaaStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "baa_signed_at" TIMESTAMP(3),
    "baa_expires_at" TIMESTAMP(3),
    "baa_document_url" TEXT,
    "encryption_enabled" BOOLEAN NOT NULL DEFAULT true,
    "encryption_key_id" TEXT,
    "mfa_required" BOOLEAN NOT NULL DEFAULT true,
    "session_timeout" INTEGER NOT NULL DEFAULT 15,
    "ip_whitelist" TEXT[],
    "enhanced_audit_enabled" BOOLEAN NOT NULL DEFAULT true,
    "audit_retention_years" INTEGER NOT NULL DEFAULT 6,
    "training_required" BOOLEAN NOT NULL DEFAULT true,
    "last_assessment_at" TIMESTAMP(3),
    "next_assessment_due" TIMESTAMP(3),
    "assessment_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hipaa_compliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phi_access_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "hipaa_compliance_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "access_type" "PhiAccessType" NOT NULL,
    "phi_category" "PhiCategory" NOT NULL,
    "record_count" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "ip_address" TEXT,
    "location" TEXT,
    "skillpod_session_id" UUID,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phi_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hipaa_training" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "training_type" "HipaaTrainingType" NOT NULL,
    "training_version" TEXT NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "quiz_score" INTEGER,
    "passing_score" INTEGER NOT NULL DEFAULT 80,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "certificate_url" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hipaa_training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breach_incidents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "incident_type" "BreachIncidentType" NOT NULL,
    "severity" "BreachSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "discovered_at" TIMESTAMP(3) NOT NULL,
    "discovered_by" UUID NOT NULL,
    "affected_records" INTEGER,
    "affected_users" INTEGER,
    "phi_involved" BOOLEAN NOT NULL DEFAULT false,
    "phi_categories" "PhiCategory"[],
    "status" "BreachStatus" NOT NULL DEFAULT 'INVESTIGATING',
    "contained_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "hhs_notified" BOOLEAN NOT NULL DEFAULT false,
    "hhs_notified_at" TIMESTAMP(3),
    "affected_notified" BOOLEAN NOT NULL DEFAULT false,
    "affected_notified_at" TIMESTAMP(3),
    "root_cause" TEXT,
    "remediation" TEXT,
    "preventive_measures" TEXT,
    "report_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "breach_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breach_timeline" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "breach_incident_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "performed_by" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breach_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phi_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "value_hash" TEXT NOT NULL,
    "encrypted_value" JSONB NOT NULL,
    "type" "PhiFieldType" NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "phi_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kill_switch_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "scope" "KillSwitchScope" NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "pod_id" UUID,
    "session_id" UUID,
    "triggered_by" UUID NOT NULL,
    "trigger_reason" "KillSwitchReason" NOT NULL,
    "trigger_details" TEXT,
    "status" "KillSwitchStatus" NOT NULL DEFAULT 'PENDING',
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "execution_time_ms" INTEGER,
    "sessions_terminated" INTEGER NOT NULL DEFAULT 0,
    "tokens_revoked" INTEGER NOT NULL DEFAULT 0,
    "cache_purged" BOOLEAN NOT NULL DEFAULT false,
    "recordings_preserved" BOOLEAN NOT NULL DEFAULT false,
    "errors" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kill_switch_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kill_switch_actions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "kill_switch_event_id" UUID NOT NULL,
    "action_type" "KillSwitchActionType" NOT NULL,
    "target" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "status" "KillSwitchActionStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kill_switch_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_revocations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "user_id" UUID NOT NULL,
    "revoked_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "scope" "RevocationScope" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "reinstated_by" UUID,
    "reinstated_at" TIMESTAMP(3),
    "reinstate_reason" TEXT,
    "kill_switch_event_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_revocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_recordings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "RecordingStatus" NOT NULL DEFAULT 'RECORDING',
    "storage_location" TEXT,
    "storage_bucket" TEXT,
    "storage_key" TEXT,
    "encryption_key_id" TEXT,
    "format" TEXT NOT NULL DEFAULT 'webm',
    "codec" TEXT NOT NULL DEFAULT 'vp9',
    "resolution" TEXT,
    "frame_rate" INTEGER,
    "duration_seconds" INTEGER,
    "file_size_bytes" BIGINT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processed_at" TIMESTAMP(3),
    "thumbnail_url" TEXT,
    "ocr_status" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "ocr_completed_at" TIMESTAMP(3),
    "retention_policy" TEXT,
    "expires_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMP(3),
    "last_viewed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recording_chunks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "recording_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "start_offset" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recording_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recording_markers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "recording_id" UUID NOT NULL,
    "marker_type" "MarkerType" NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "is_auto_detected" BOOLEAN NOT NULL DEFAULT false,
    "detection_source" TEXT,
    "confidence" DECIMAL(3,2),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recording_markers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recording_ocr_frames" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "recording_id" UUID NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "frame_number" INTEGER NOT NULL,
    "extracted_text" TEXT NOT NULL,
    "text_confidence" DECIMAL(3,2) NOT NULL,
    "text_regions" JSONB,
    "elasticsearch_id" TEXT,
    "indexed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recording_ocr_frames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recording_access_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "recording_id" UUID NOT NULL,
    "access_type" "RecordingAccessType" NOT NULL,
    "accessed_by" UUID NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "playback_start_time" INTEGER,
    "playback_end_time" INTEGER,
    "playback_duration" INTEGER,
    "access_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recording_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recording_retention_policies" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "retention_days" INTEGER NOT NULL,
    "compliance_tags" TEXT[],
    "auto_delete_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recording_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watermark_configurations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "visible_enabled" BOOLEAN NOT NULL DEFAULT true,
    "visible_config" JSONB NOT NULL,
    "invisible_enabled" BOOLEAN NOT NULL DEFAULT true,
    "invisible_config" JSONB NOT NULL,
    "apply_to_screen_share" BOOLEAN NOT NULL DEFAULT true,
    "apply_to_recordings" BOOLEAN NOT NULL DEFAULT true,
    "apply_to_exports" BOOLEAN NOT NULL DEFAULT true,
    "excluded_applications" TEXT[],
    "excluded_urls" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watermark_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watermark_instances" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "configuration_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "visible_hash" VARCHAR(64),
    "invisible_key" VARCHAR(64) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watermark_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watermark_detections" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "source_type" "DetectionSourceType" NOT NULL,
    "source_url" VARCHAR(2000),
    "source_description" TEXT,
    "watermark_instance_id" UUID,
    "detected_payload" JSONB,
    "confidence" DECIMAL(5,4) NOT NULL,
    "detection_method" VARCHAR(50) NOT NULL,
    "extracted_user_id" UUID,
    "extracted_session_id" UUID,
    "extracted_timestamp" TIMESTAMP(3),
    "image_hash" VARCHAR(64),
    "image_dimensions" VARCHAR(20),
    "manipulation_detected" BOOLEAN NOT NULL DEFAULT false,
    "manipulation_types" TEXT[],
    "investigation_status" "InvestigationStatus" NOT NULL DEFAULT 'PENDING',
    "investigated_by" UUID,
    "investigation_notes" TEXT,
    "reported_by" UUID,
    "reported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watermark_detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pod_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "short_description" VARCHAR(500),
    "category" "TemplateCategory" NOT NULL,
    "tags" TEXT[],
    "base_image_id" UUID NOT NULL,
    "kasm_image_id" VARCHAR(100),
    "ecr_image_uri" VARCHAR(500),
    "installed_tools" JSONB NOT NULL,
    "default_config" JSONB NOT NULL DEFAULT '{}',
    "default_resources" JSONB NOT NULL,
    "min_resources" JSONB NOT NULL,
    "max_resources" JSONB NOT NULL,
    "startup_script" TEXT,
    "environment_vars" JSONB,
    "icon_url" VARCHAR(500),
    "screenshot_urls" TEXT[],
    "documentation_url" VARCHAR(500),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "changelog" TEXT,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "avg_rating" DECIMAL(3,2),
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "estimated_launch_seconds" INTEGER NOT NULL DEFAULT 120,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pod_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "base_images" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(200) NOT NULL,
    "os_type" "OsType" NOT NULL,
    "os_version" VARCHAR(50) NOT NULL,
    "registry_type" "RegistryType" NOT NULL,
    "registry_uri" VARCHAR(500) NOT NULL,
    "image_tag" VARCHAR(100) NOT NULL,
    "image_digest" VARCHAR(100),
    "size_bytes" BIGINT NOT NULL,
    "architecture" VARCHAR(20) NOT NULL DEFAULT 'amd64',
    "kasm_compatible" BOOLEAN NOT NULL DEFAULT true,
    "kasm_image_id" VARCHAR(100),
    "pre_installed_tools" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_pulled_at" TIMESTAMP(3),
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "base_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pods" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "template_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "kasm_id" VARCHAR(100),
    "kasm_status" VARCHAR(50),
    "status" "PodStatus" NOT NULL DEFAULT 'PENDING',
    "current_resources" JSONB NOT NULL,
    "resource_limits" JSONB NOT NULL,
    "auto_scaling_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_scaling_config" JSONB,
    "security_policy_id" UUID,
    "watermark_config_id" UUID,
    "persistent_storage" BOOLEAN NOT NULL DEFAULT true,
    "storage_volume_id" VARCHAR(100),
    "connection_url" VARCHAR(500),
    "connection_token" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_accessed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "terminated_at" TIMESTAMP(3),
    "total_cost_cents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pod_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pod_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_mins" INTEGER NOT NULL DEFAULT 0,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pod_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pod_resource_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pod_id" UUID NOT NULL,
    "resources" JSONB NOT NULL,
    "utilization" JSONB,
    "scaling_event" "ScalingEventType",
    "scaling_reason" TEXT,
    "hourly_rate_cents" INTEGER NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pod_resource_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_ratings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "template_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_pools" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "instance_type" VARCHAR(50) NOT NULL,
    "min_instances" INTEGER NOT NULL,
    "max_instances" INTEGER NOT NULL,
    "current_instances" INTEGER NOT NULL DEFAULT 0,
    "warm_pool_size" INTEGER NOT NULL DEFAULT 0,
    "warm_instances" INTEGER NOT NULL DEFAULT 0,
    "scale_up_threshold" INTEGER NOT NULL DEFAULT 70,
    "scale_down_threshold" INTEGER NOT NULL DEFAULT 30,
    "scale_up_cooldown" INTEGER NOT NULL DEFAULT 300,
    "scale_down_cooldown" INTEGER NOT NULL DEFAULT 600,
    "hourly_rate_cents" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_resource_quotas" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "max_cpu" INTEGER NOT NULL,
    "used_cpu" INTEGER NOT NULL DEFAULT 0,
    "max_memory" INTEGER NOT NULL,
    "used_memory" INTEGER NOT NULL DEFAULT 0,
    "max_storage" INTEGER NOT NULL,
    "used_storage" INTEGER NOT NULL DEFAULT 0,
    "max_pods" INTEGER NOT NULL,
    "active_pods" INTEGER NOT NULL DEFAULT 0,
    "max_gpus" INTEGER NOT NULL DEFAULT 0,
    "used_gpus" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_resource_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freelancer_work_patterns" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "weekly_hours_available" INTEGER,
    "preferred_hours_per_week" INTEGER,
    "working_days" TEXT[],
    "working_hours_start" TEXT,
    "working_hours_end" TEXT,
    "timezone" TEXT,
    "avg_response_time_minutes" INTEGER,
    "avg_first_bid_time_hours" INTEGER,
    "preferred_project_duration" TEXT[],
    "preferred_budget_min" DECIMAL(12,2),
    "preferred_budget_max" DECIMAL(12,2),
    "preferred_location_type" TEXT[],
    "current_active_projects" INTEGER NOT NULL DEFAULT 0,
    "max_concurrent_projects" INTEGER NOT NULL DEFAULT 3,
    "unavailable_periods" JSONB,
    "last_active_at" TIMESTAMP(3),
    "last_bid_at" TIMESTAMP(3),
    "last_project_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freelancer_work_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matching_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "event_type" "MatchingEventType" NOT NULL,
    "project_id" UUID,
    "service_id" UUID,
    "client_user_id" UUID NOT NULL,
    "freelancer_user_id" UUID NOT NULL,
    "match_score" INTEGER,
    "match_rank" INTEGER,
    "match_factors" JSONB,
    "outcome" "MatchingOutcome",
    "outcome_at" TIMESTAMP(3),
    "was_hired" BOOLEAN,
    "project_successful" BOOLEAN,
    "client_satisfaction_score" INTEGER,
    "search_criteria" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matching_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_intelligence" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "skill_category" TEXT NOT NULL,
    "primary_skill" TEXT,
    "experience_level" "ExperienceLevel" NOT NULL,
    "region" TEXT,
    "sample_size" INTEGER NOT NULL,
    "avg_hourly_rate" DECIMAL(10,2) NOT NULL,
    "median_hourly_rate" DECIMAL(10,2) NOT NULL,
    "min_hourly_rate" DECIMAL(10,2) NOT NULL,
    "max_hourly_rate" DECIMAL(10,2) NOT NULL,
    "percentile25" DECIMAL(10,2) NOT NULL,
    "percentile75" DECIMAL(10,2) NOT NULL,
    "percentile90" DECIMAL(10,2) NOT NULL,
    "avg_fixed_project_rate" DECIMAL(12,2),
    "rate_change_pct_30d" DECIMAL(5,2),
    "rate_change_pct_90d" DECIMAL(5,2),
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_intelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_relationships" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "skill1" TEXT NOT NULL,
    "skill2" TEXT NOT NULL,
    "relationship_type" "SkillRelationType" NOT NULL,
    "strength" DECIMAL(3,2) NOT NULL,
    "bidirectional" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freelancer_skill_endorsements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "skill" TEXT NOT NULL,
    "endorsed_by_user_id" UUID NOT NULL,
    "endorsement_type" "EndorsementType" NOT NULL,
    "project_id" UUID,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freelancer_skill_endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_data_points" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "source_type" "RateSourceType" NOT NULL,
    "source_id" UUID NOT NULL,
    "primary_skill" TEXT NOT NULL,
    "secondary_skills" TEXT[],
    "skill_category" TEXT NOT NULL,
    "rate_type" "RateType" NOT NULL,
    "hourly_rate" DECIMAL(10,2),
    "fixed_rate" DECIMAL(12,2),
    "project_duration_days" INTEGER,
    "effective_hourly_rate" DECIMAL(10,2),
    "experience_level" "ExperienceLevel" NOT NULL,
    "freelancer_user_id" UUID NOT NULL,
    "client_user_id" UUID NOT NULL,
    "freelancer_country" TEXT,
    "freelancer_region" TEXT,
    "client_country" TEXT,
    "was_accepted" BOOLEAN NOT NULL,
    "project_completed" BOOLEAN,
    "client_rating" INTEGER,
    "compliance_required" TEXT[],
    "has_compliance_premium" BOOLEAN NOT NULL DEFAULT false,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_data_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_aggregates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "skill_category" TEXT NOT NULL,
    "primary_skill" TEXT,
    "experience_level" "ExperienceLevel" NOT NULL,
    "region" TEXT NOT NULL,
    "period_type" "PeriodType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "accepted_count" INTEGER NOT NULL,
    "completed_count" INTEGER NOT NULL,
    "hourly_rate_min" DECIMAL(10,2) NOT NULL,
    "hourly_rate_max" DECIMAL(10,2) NOT NULL,
    "hourly_rate_avg" DECIMAL(10,2) NOT NULL,
    "hourly_rate_median" DECIMAL(10,2) NOT NULL,
    "hourly_rate_std_dev" DECIMAL(10,2) NOT NULL,
    "hourly_rate_p10" DECIMAL(10,2) NOT NULL,
    "hourly_rate_p25" DECIMAL(10,2) NOT NULL,
    "hourly_rate_p75" DECIMAL(10,2) NOT NULL,
    "hourly_rate_p90" DECIMAL(10,2) NOT NULL,
    "fixed_rate_min" DECIMAL(12,2),
    "fixed_rate_max" DECIMAL(12,2),
    "fixed_rate_avg" DECIMAL(12,2),
    "fixed_rate_median" DECIMAL(12,2),
    "acceptance_rate_low" DECIMAL(5,4),
    "acceptance_rate_mid" DECIMAL(5,4),
    "acceptance_rate_high" DECIMAL(5,4),
    "avg_rating_low_price" DECIMAL(3,2),
    "avg_rating_mid_price" DECIMAL(3,2),
    "avg_rating_high_price" DECIMAL(3,2),
    "compliance_premium_pct" DECIMAL(5,2),
    "rate_change_from_previous" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freelancer_rate_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "previous_hourly_rate" DECIMAL(10,2),
    "new_hourly_rate" DECIMAL(10,2) NOT NULL,
    "change_reason" "RateChangeReason" NOT NULL,
    "market_position" TEXT,
    "percentile_at_change" INTEGER,
    "bids_before_change" INTEGER,
    "bids_after_change" INTEGER,
    "win_rate_before_change" DECIMAL(5,4),
    "win_rate_after_change" DECIMAL(5,4),
    "changed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freelancer_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_recommendations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "recommendation_type" "RecommendationType" NOT NULL,
    "current_rate" DECIMAL(10,2) NOT NULL,
    "current_percentile" INTEGER NOT NULL,
    "recommended_rate_min" DECIMAL(10,2) NOT NULL,
    "recommended_rate_max" DECIMAL(10,2) NOT NULL,
    "recommended_percentile" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "projected_win_rate_change" DECIMAL(5,4),
    "projected_earnings_change" DECIMAL(5,2),
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "viewed_at" TIMESTAMP(3),
    "action_taken" TEXT,
    "action_taken_at" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_demand_trends" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "skill" TEXT NOT NULL,
    "skill_category" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "project_count" INTEGER NOT NULL,
    "total_budget" DECIMAL(14,2) NOT NULL,
    "avg_budget" DECIMAL(12,2) NOT NULL,
    "active_freelancers" INTEGER NOT NULL,
    "total_bids" INTEGER NOT NULL,
    "avg_bids_per_project" DECIMAL(5,2) NOT NULL,
    "demand_supply_ratio" DECIMAL(5,2) NOT NULL,
    "demand_change_from_previous" DECIMAL(5,2),
    "rate_change_from_previous" DECIMAL(5,2),
    "demand_level" "DemandLevel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_demand_trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "contract_type" "ContractTypeV2" NOT NULL,
    "rate_type" "RateTypeV2" NOT NULL,
    "template_content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "clauses" JSONB NOT NULL,
    "default_payment_terms_days" INTEGER NOT NULL DEFAULT 7,
    "default_notice_period_days" INTEGER NOT NULL DEFAULT 14,
    "includes_nda" BOOLEAN NOT NULL DEFAULT false,
    "includes_ip_assignment" BOOLEAN NOT NULL DEFAULT true,
    "includes_non_compete" BOOLEAN NOT NULL DEFAULT false,
    "compliance_tags" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts_v2" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_number" VARCHAR(30) NOT NULL,
    "client_user_id" UUID NOT NULL,
    "freelancer_user_id" UUID NOT NULL,
    "tenant_id" UUID,
    "source_type" "ContractSourceType" NOT NULL,
    "project_id" UUID,
    "bid_id" UUID,
    "service_order_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL,
    "contract_type" "ContractTypeV2" NOT NULL,
    "rate_type" "RateTypeV2" NOT NULL,
    "hourly_rate" DECIMAL(10,2),
    "fixed_amount" DECIMAL(12,2),
    "retainer_amount" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "estimated_hours" INTEGER,
    "weekly_hour_limit" INTEGER,
    "budget_cap" DECIMAL(12,2),
    "budget_alert_threshold" DECIMAL(5,2),
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "estimated_duration_days" INTEGER,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 7,
    "notice_period_days" INTEGER NOT NULL DEFAULT 14,
    "includes_nda" BOOLEAN NOT NULL DEFAULT false,
    "includes_ip_assignment" BOOLEAN NOT NULL DEFAULT true,
    "includes_non_compete" BOOLEAN NOT NULL DEFAULT false,
    "custom_terms" TEXT,
    "compliance_requirements" TEXT[],
    "skillpod_required" BOOLEAN NOT NULL DEFAULT false,
    "skillpod_pod_id" UUID,
    "status" "ContractStatusV2" NOT NULL DEFAULT 'DRAFT',
    "client_signed_at" TIMESTAMP(3),
    "client_signature_id" UUID,
    "freelancer_signed_at" TIMESTAMP(3),
    "freelancer_signature_id" UUID,
    "document_url" VARCHAR(500),
    "document_version" INTEGER NOT NULL DEFAULT 1,
    "total_billed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_in_escrow" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_disputed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "terminated_at" TIMESTAMP(3),
    "terminated_by" UUID,
    "termination_reason" TEXT,
    "termination_type" "TerminationType",
    "completed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_milestones_v2" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "due_date" TIMESTAMP(3),
    "estimated_days" INTEGER,
    "deliverables" JSONB,
    "status" "MilestoneStatusV2" NOT NULL DEFAULT 'PENDING',
    "escrow_funded" BOOLEAN NOT NULL DEFAULT false,
    "escrow_funded_at" TIMESTAMP(3),
    "escrow_transaction_id" VARCHAR(100),
    "submitted_at" TIMESTAMP(3),
    "submission_note" TEXT,
    "submission_files" JSONB,
    "review_requested_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" UUID,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "rejection_count" INTEGER NOT NULL DEFAULT 0,
    "revision_requested_at" TIMESTAMP(3),
    "revision_note" TEXT,
    "paid_at" TIMESTAMP(3),
    "payment_transaction_id" VARCHAR(100),
    "auto_approve_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_milestones_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries_v2" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "freelancer_user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "duration_minutes" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "task_category" VARCHAR(100),
    "hourly_rate" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "evidence_type" "EvidenceType",
    "evidence_url" VARCHAR(500),
    "screenshots" JSONB,
    "skillpod_session_id" UUID,
    "auto_tracked" BOOLEAN NOT NULL DEFAULT false,
    "status" "TimeEntryStatusV2" NOT NULL DEFAULT 'PENDING',
    "approved_at" TIMESTAMP(3),
    "approved_by" UUID,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" VARCHAR(500),
    "disputed_at" TIMESTAMP(3),
    "dispute_id" UUID,
    "invoice_id" UUID,
    "invoiced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_amendments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "amendment_number" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "proposed_by" UUID NOT NULL,
    "proposed_at" TIMESTAMP(3) NOT NULL,
    "status" "AmendmentStatus" NOT NULL DEFAULT 'PROPOSED',
    "client_approved_at" TIMESTAMP(3),
    "client_rejected_at" TIMESTAMP(3),
    "client_response" TEXT,
    "freelancer_approved_at" TIMESTAMP(3),
    "freelancer_rejected_at" TIMESTAMP(3),
    "freelancer_response" TEXT,
    "effective_at" TIMESTAMP(3),
    "document_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_activities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "activity_type" "ContractActivityType" NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "actor_user_id" UUID,
    "actor_type" VARCHAR(20),
    "milestone_id" UUID,
    "time_entry_id" UUID,
    "invoice_id" UUID,
    "amendment_id" UUID,
    "dispute_id" UUID,
    "metadata" JSONB,
    "visible_to_client" BOOLEAN NOT NULL DEFAULT true,
    "visible_to_freelancer" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_signatures" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "signer_role" VARCHAR(20) NOT NULL,
    "signature_type" "SignatureType" NOT NULL,
    "signature_image" TEXT,
    "signature_text" VARCHAR(200),
    "signature_hash" VARCHAR(64) NOT NULL,
    "agreed_to_terms" BOOLEAN NOT NULL DEFAULT true,
    "terms_version" VARCHAR(20) NOT NULL,
    "acknowledgment_at" TIMESTAMP(3) NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" TEXT NOT NULL,
    "document_version" INTEGER NOT NULL,
    "document_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_invoices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "invoice_number" VARCHAR(30) NOT NULL,
    "client_user_id" UUID NOT NULL,
    "freelancer_user_id" UUID NOT NULL,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "platform_fee" DECIMAL(12,2) NOT NULL,
    "taxes" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "freelancer_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hours_logged" DECIMAL(8,2),
    "milestones_count" INTEGER,
    "status" "ContractInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issued_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "payment_transaction_id" VARCHAR(100),
    "stripe_payment_intent_id" VARCHAR(100),
    "payment_method" VARCHAR(50),
    "payout_id" UUID,
    "payout_status" VARCHAR(30),
    "paid_out_at" TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_sent_at" TIMESTAMP(3),
    "document_url" VARCHAR(500),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_disputes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "milestone_id" UUID,
    "time_entry_id" UUID,
    "raised_by" UUID NOT NULL,
    "reason" "ContractDisputeReason" NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disputed_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "ContractDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "respondent_user_id" UUID,
    "responded_at" TIMESTAMP(3),
    "response" TEXT,
    "response_evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolved_by" UUID,
    "resolution" "ContractDisputeResolution",
    "resolution_notes" TEXT,
    "client_refund_amount" DECIMAL(12,2),
    "freelancer_payout_amount" DECIMAL(12,2),
    "respond_by" TIMESTAMP(3),
    "escalated_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_dispute_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "dispute_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sender_type" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_dispute_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_accounts_v2" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "client_user_id" UUID NOT NULL,
    "freelancer_user_id" UUID NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pending_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "released_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refunded_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "disputed_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "EscrowAccountStatusV2" NOT NULL DEFAULT 'ACTIVE',
    "stripe_payment_method_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_accounts_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_transactions_v2" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "escrow_account_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "transactionType" "EscrowTransactionTypeV2" NOT NULL,
    "status" "EscrowTransactionStatusV2" NOT NULL DEFAULT 'PENDING',
    "milestone_id" UUID,
    "invoice_id" UUID,
    "dispute_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "platform_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "processing_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "stripe_payment_intent_id" VARCHAR(100),
    "stripe_transfer_id" VARCHAR(100),
    "stripe_refund_id" VARCHAR(100),
    "stripe_charge_id" VARCHAR(100),
    "failure_code" VARCHAR(50),
    "failure_message" TEXT,
    "description" VARCHAR(500),
    "metadata" JSONB,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_transactions_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "invoice_id" UUID NOT NULL,
    "type" "InvoiceLineItemType" NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "milestone_id" UUID,
    "time_entry_id" UUID,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "type" "ConversationType" NOT NULL,
    "job_id" UUID,
    "contract_id" UUID,
    "bid_id" UUID,
    "service_order_id" UUID,
    "dispute_id" UUID,
    "is_direct_message" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "description" TEXT,
    "avatar_url" VARCHAR(500),
    "created_by" UUID,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_muted" BOOLEAN NOT NULL DEFAULT false,
    "allow_file_sharing" BOOLEAN NOT NULL DEFAULT true,
    "allow_reactions" BOOLEAN NOT NULL DEFAULT true,
    "last_message_id" UUID,
    "last_message_at" TIMESTAMP(3),
    "last_message_preview" VARCHAR(200),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "can_send_messages" BOOLEAN NOT NULL DEFAULT true,
    "can_add_participants" BOOLEAN NOT NULL DEFAULT false,
    "can_remove_participants" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_settings" BOOLEAN NOT NULL DEFAULT false,
    "last_read_message_id" UUID,
    "last_read_at" TIMESTAMP(3),
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "muted_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "left_at" TIMESTAMP(3),
    "removed_at" TIMESTAMP(3),
    "removed_by" UUID,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_at" TIMESTAMP(3),
    "is_archived_by_user" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "conversation_id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "content" TEXT,
    "content_type" "ConversationContentType" NOT NULL DEFAULT 'TEXT',
    "rich_content" JSONB,
    "attachments" JSONB,
    "parent_message_id" UUID,
    "thread_count" INTEGER NOT NULL DEFAULT 0,
    "mentions" TEXT[],
    "mentions_everyone" BOOLEAN NOT NULL DEFAULT false,
    "message_type" "ConversationMessageType" NOT NULL DEFAULT 'USER',
    "system_event_type" "SystemMessageEventType",
    "system_event_data" JSONB,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMP(3),
    "edit_history" JSONB,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,
    "delivered_at" TIMESTAMP(3),
    "reaction_counts" JSONB,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_at" TIMESTAMP(3),
    "pinned_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_message_reactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_message_read_receipts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_message_read_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "message_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "thumbnail_url" VARCHAR(1000),
    "processing_status" "AttachmentProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "scan_status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "scan_result" VARCHAR(255),
    "scanned_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_presence" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "status" "PresenceStatus" NOT NULL DEFAULT 'OFFLINE',
    "status_message" VARCHAR(100),
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "last_active_at" TIMESTAMP(3),
    "current_conversation_id" UUID,
    "is_typing_in" UUID,
    "typing_started_at" TIMESTAMP(3),
    "device_type" VARCHAR(50),
    "device_id" VARCHAR(100),
    "push_tokens" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_presence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocklist" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "blocked_user_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "freelancer_user_id" UUID NOT NULL,
    "client_type" "ClientType" NOT NULL DEFAULT 'INDIVIDUAL',
    "source" "ClientSource" NOT NULL DEFAULT 'MANUAL',
    "platform_user_id" UUID,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "alternate_email" VARCHAR(255),
    "alternate_phone" VARCHAR(50),
    "company_name" VARCHAR(200),
    "company_website" VARCHAR(500),
    "company_size" "CompanySize",
    "industry" VARCHAR(100),
    "job_title" VARCHAR(100),
    "department" VARCHAR(100),
    "address" JSONB,
    "timezone" VARCHAR(50),
    "avatar_url" VARCHAR(500),
    "bio" TEXT,
    "linkedin_url" VARCHAR(500),
    "twitter_url" VARCHAR(500),
    "preferred_contact_method" VARCHAR(50),
    "communication_preferences" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "custom_fields" JSONB,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "lifetime_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_projects" INTEGER NOT NULL DEFAULT 0,
    "active_projects" INTEGER NOT NULL DEFAULT 0,
    "avg_rating" DECIMAL(3,2),
    "health_score" INTEGER,
    "health_score_updated_at" TIMESTAMP(3),
    "last_contact_at" TIMESTAMP(3),
    "last_project_at" TIMESTAMP(3),
    "next_follow_up_at" TIMESTAMP(3),
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "client_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "job_title" VARCHAR(100),
    "department" VARCHAR(100),
    "role" "ContactRole" NOT NULL DEFAULT 'OTHER',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_interactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "client_id" UUID NOT NULL,
    "freelancer_user_id" UUID NOT NULL,
    "interaction_type" "InteractionType" NOT NULL,
    "subject" VARCHAR(255),
    "description" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "opportunity_id" UUID,
    "project_id" UUID,
    "outcome" VARCHAR(500),
    "next_steps" TEXT,
    "follow_up_required" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_date" TIMESTAMP(3),
    "attachments" JSONB,
    "sentiment" "Sentiment",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "freelancer_user_id" UUID NOT NULL,
    "client_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "source" "OpportunitySource" NOT NULL,
    "source_details" VARCHAR(500),
    "external_url" VARCHAR(500),
    "estimated_value" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "expected_close_date" TIMESTAMP(3),
    "actual_close_date" TIMESTAMP(3),
    "stage" "OpportunityStage" NOT NULL DEFAULT 'LEAD',
    "probability" INTEGER NOT NULL DEFAULT 10,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "service_type" VARCHAR(100),
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "lost_reason" TEXT,
    "won_contract_id" UUID,
    "priority" "CrmPriority" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_activities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "opportunity_id" UUID NOT NULL,
    "activity_type" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "from_stage" "OpportunityStage",
    "to_stage" "OpportunityStage",
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "client_id" UUID NOT NULL,
    "freelancer_user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "document_type" "CrmDocumentType" NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "project_id" UUID,
    "contract_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_reminders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "client_id" UUID NOT NULL,
    "freelancer_user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "reminder_type" "ReminderType" NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" VARCHAR(255),
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "snoozed_until" TIMESTAMP(3),
    "notify_before" INTEGER,
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_custom_fields" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "freelancer_user_id" UUID NOT NULL,
    "entity_type" "CrmEntityType" NOT NULL,
    "field_name" VARCHAR(50) NOT NULL,
    "field_label" VARCHAR(100) NOT NULL,
    "field_type" "CustomFieldType" NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "default_value" VARCHAR(500),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "freelancer_compliance_user_id_idx" ON "freelancer_compliance"("user_id");

-- CreateIndex
CREATE INDEX "freelancer_compliance_compliance_type_idx" ON "freelancer_compliance"("compliance_type");

-- CreateIndex
CREATE INDEX "freelancer_compliance_verification_status_idx" ON "freelancer_compliance"("verification_status");

-- CreateIndex
CREATE INDEX "freelancer_compliance_expires_at_idx" ON "freelancer_compliance"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "freelancer_compliance_user_id_compliance_type_key" ON "freelancer_compliance"("user_id", "compliance_type");

-- CreateIndex
CREATE INDEX "security_clearances_user_id_idx" ON "security_clearances"("user_id");

-- CreateIndex
CREATE INDEX "security_clearances_clearance_level_idx" ON "security_clearances"("clearance_level");

-- CreateIndex
CREATE INDEX "security_clearances_verification_status_idx" ON "security_clearances"("verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "security_clearances_user_id_clearance_level_key" ON "security_clearances"("user_id", "clearance_level");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_requirements_code_key" ON "compliance_requirements"("code");

-- CreateIndex
CREATE INDEX "compliance_requirements_category_idx" ON "compliance_requirements"("category");

-- CreateIndex
CREATE INDEX "compliance_requirements_is_active_idx" ON "compliance_requirements"("is_active");

-- CreateIndex
CREATE INDEX "tenant_compliance_requirements_tenant_id_idx" ON "tenant_compliance_requirements"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_compliance_requirements_tenant_id_code_key" ON "tenant_compliance_requirements"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "freelancer_compliance_attestations_user_id_idx" ON "freelancer_compliance_attestations"("user_id");

-- CreateIndex
CREATE INDEX "freelancer_compliance_attestations_requirement_code_idx" ON "freelancer_compliance_attestations"("requirement_code");

-- CreateIndex
CREATE INDEX "freelancer_compliance_attestations_is_active_idx" ON "freelancer_compliance_attestations"("is_active");

-- CreateIndex
CREATE INDEX "compliance_verification_logs_compliance_id_idx" ON "compliance_verification_logs"("compliance_id");

-- CreateIndex
CREATE INDEX "compliance_verification_logs_attempted_at_idx" ON "compliance_verification_logs"("attempted_at");

-- CreateIndex
CREATE INDEX "bid_messages_bid_id_idx" ON "bid_messages"("bid_id");

-- CreateIndex
CREATE INDEX "bid_messages_sender_id_idx" ON "bid_messages"("sender_id");

-- CreateIndex
CREATE INDEX "bid_messages_created_at_idx" ON "bid_messages"("created_at");

-- CreateIndex
CREATE INDEX "project_invitations_job_id_idx" ON "project_invitations"("job_id");

-- CreateIndex
CREATE INDEX "project_invitations_inviter_id_idx" ON "project_invitations"("inviter_id");

-- CreateIndex
CREATE INDEX "project_invitations_invitee_id_idx" ON "project_invitations"("invitee_id");

-- CreateIndex
CREATE INDEX "project_invitations_status_idx" ON "project_invitations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "project_invitations_job_id_invitee_id_key" ON "project_invitations"("job_id", "invitee_id");

-- CreateIndex
CREATE INDEX "project_questions_job_id_idx" ON "project_questions"("job_id");

-- CreateIndex
CREATE INDEX "project_questions_asker_id_idx" ON "project_questions"("asker_id");

-- CreateIndex
CREATE INDEX "project_questions_is_public_idx" ON "project_questions"("is_public");

-- CreateIndex
CREATE INDEX "service_packages_service_id_idx" ON "service_packages"("service_id");

-- CreateIndex
CREATE INDEX "service_add_ons_service_id_idx" ON "service_add_ons"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_orders_order_number_key" ON "service_orders"("order_number");

-- CreateIndex
CREATE INDEX "service_orders_service_id_idx" ON "service_orders"("service_id");

-- CreateIndex
CREATE INDEX "service_orders_buyer_id_idx" ON "service_orders"("buyer_id");

-- CreateIndex
CREATE INDEX "service_orders_seller_id_idx" ON "service_orders"("seller_id");

-- CreateIndex
CREATE INDEX "service_orders_status_idx" ON "service_orders"("status");

-- CreateIndex
CREATE INDEX "service_orders_order_number_idx" ON "service_orders"("order_number");

-- CreateIndex
CREATE INDEX "service_order_items_order_id_idx" ON "service_order_items"("order_id");

-- CreateIndex
CREATE INDEX "service_order_add_ons_order_id_idx" ON "service_order_add_ons"("order_id");

-- CreateIndex
CREATE INDEX "service_deliveries_order_id_idx" ON "service_deliveries"("order_id");

-- CreateIndex
CREATE INDEX "service_revision_requests_order_id_idx" ON "service_revision_requests"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_reviews_order_id_key" ON "service_reviews"("order_id");

-- CreateIndex
CREATE INDEX "service_reviews_service_id_idx" ON "service_reviews"("service_id");

-- CreateIndex
CREATE INDEX "service_reviews_reviewer_id_idx" ON "service_reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "service_order_messages_order_id_idx" ON "service_order_messages"("order_id");

-- CreateIndex
CREATE INDEX "service_order_messages_sender_id_idx" ON "service_order_messages"("sender_id");

-- CreateIndex
CREATE INDEX "pod_security_policies_tenant_id_idx" ON "pod_security_policies"("tenant_id");

-- CreateIndex
CREATE INDEX "pod_security_policies_is_default_idx" ON "pod_security_policies"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "pod_security_policies_tenant_id_name_key" ON "pod_security_policies"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "security_violations_session_id_idx" ON "security_violations"("session_id");

-- CreateIndex
CREATE INDEX "security_violations_tenant_id_idx" ON "security_violations"("tenant_id");

-- CreateIndex
CREATE INDEX "security_violations_violation_type_idx" ON "security_violations"("violation_type");

-- CreateIndex
CREATE INDEX "security_violations_severity_idx" ON "security_violations"("severity");

-- CreateIndex
CREATE INDEX "security_violations_created_at_idx" ON "security_violations"("created_at");

-- CreateIndex
CREATE INDEX "file_transfer_requests_session_id_idx" ON "file_transfer_requests"("session_id");

-- CreateIndex
CREATE INDEX "file_transfer_requests_tenant_id_idx" ON "file_transfer_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "file_transfer_requests_requested_by_idx" ON "file_transfer_requests"("requested_by");

-- CreateIndex
CREATE INDEX "file_transfer_requests_status_idx" ON "file_transfer_requests"("status");

-- CreateIndex
CREATE INDEX "file_transfer_requests_created_at_idx" ON "file_transfer_requests"("created_at");

-- CreateIndex
CREATE INDEX "containment_audit_logs_session_id_idx" ON "containment_audit_logs"("session_id");

-- CreateIndex
CREATE INDEX "containment_audit_logs_tenant_id_idx" ON "containment_audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "containment_audit_logs_user_id_idx" ON "containment_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "containment_audit_logs_event_type_idx" ON "containment_audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "containment_audit_logs_event_category_idx" ON "containment_audit_logs"("event_category");

-- CreateIndex
CREATE INDEX "containment_audit_logs_created_at_idx" ON "containment_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "data_transfer_attempts_session_id_idx" ON "data_transfer_attempts"("session_id");

-- CreateIndex
CREATE INDEX "data_transfer_attempts_user_id_idx" ON "data_transfer_attempts"("user_id");

-- CreateIndex
CREATE INDEX "data_transfer_attempts_tenant_id_idx" ON "data_transfer_attempts"("tenant_id");

-- CreateIndex
CREATE INDEX "data_transfer_attempts_policy_id_idx" ON "data_transfer_attempts"("policy_id");

-- CreateIndex
CREATE INDEX "data_transfer_attempts_created_at_idx" ON "data_transfer_attempts"("created_at");

-- CreateIndex
CREATE INDEX "data_transfer_attempts_transfer_type_action_idx" ON "data_transfer_attempts"("transfer_type", "action");

-- CreateIndex
CREATE INDEX "screen_capture_attempts_session_id_idx" ON "screen_capture_attempts"("session_id");

-- CreateIndex
CREATE INDEX "screen_capture_attempts_user_id_idx" ON "screen_capture_attempts"("user_id");

-- CreateIndex
CREATE INDEX "screen_capture_attempts_tenant_id_idx" ON "screen_capture_attempts"("tenant_id");

-- CreateIndex
CREATE INDEX "screen_capture_attempts_created_at_idx" ON "screen_capture_attempts"("created_at");

-- CreateIndex
CREATE INDEX "screen_capture_attempts_capture_type_idx" ON "screen_capture_attempts"("capture_type");

-- CreateIndex
CREATE INDEX "policy_exceptions_policy_id_idx" ON "policy_exceptions"("policy_id");

-- CreateIndex
CREATE INDEX "policy_exceptions_scope_idx" ON "policy_exceptions"("scope");

-- CreateIndex
CREATE INDEX "policy_exceptions_exception_type_idx" ON "policy_exceptions"("exception_type");

-- CreateIndex
CREATE INDEX "policy_exceptions_is_active_idx" ON "policy_exceptions"("is_active");

-- CreateIndex
CREATE INDEX "transfer_override_requests_tenant_id_idx" ON "transfer_override_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "transfer_override_requests_requested_by_idx" ON "transfer_override_requests"("requested_by");

-- CreateIndex
CREATE INDEX "transfer_override_requests_status_idx" ON "transfer_override_requests"("status");

-- CreateIndex
CREATE INDEX "transfer_override_requests_created_at_idx" ON "transfer_override_requests"("created_at");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_notification_type_key" ON "notification_preferences"("user_id", "notification_type");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_type_key" ON "notification_templates"("type");

-- CreateIndex
CREATE INDEX "notification_templates_category_idx" ON "notification_templates"("category");

-- CreateIndex
CREATE INDEX "notification_templates_is_active_idx" ON "notification_templates"("is_active");

-- CreateIndex
CREATE INDEX "notification_digests_user_id_idx" ON "notification_digests"("user_id");

-- CreateIndex
CREATE INDEX "notification_digests_status_idx" ON "notification_digests"("status");

-- CreateIndex
CREATE INDEX "notification_digests_scheduled_for_idx" ON "notification_digests"("scheduled_for");

-- CreateIndex
CREATE INDEX "email_unsubscribes_email_idx" ON "email_unsubscribes"("email");

-- CreateIndex
CREATE INDEX "email_unsubscribes_user_id_idx" ON "email_unsubscribes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_unsubscribes_email_unsubscribe_type_category_notifica_key" ON "email_unsubscribes"("email", "unsubscribe_type", "category", "notification_type");

-- CreateIndex
CREATE INDEX "escrow_transactions_contract_id_idx" ON "escrow_transactions"("contract_id");

-- CreateIndex
CREATE INDEX "escrow_transactions_milestone_id_idx" ON "escrow_transactions"("milestone_id");

-- CreateIndex
CREATE INDEX "escrow_transactions_status_idx" ON "escrow_transactions"("status");

-- CreateIndex
CREATE INDEX "escrow_transactions_type_idx" ON "escrow_transactions"("type");

-- CreateIndex
CREATE INDEX "escrow_transactions_from_user_id_idx" ON "escrow_transactions"("from_user_id");

-- CreateIndex
CREATE INDEX "escrow_transactions_to_user_id_idx" ON "escrow_transactions"("to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_balances_contract_id_key" ON "escrow_balances"("contract_id");

-- CreateIndex
CREATE INDEX "time_logs_contract_id_idx" ON "time_logs"("contract_id");

-- CreateIndex
CREATE INDEX "time_logs_status_idx" ON "time_logs"("status");

-- CreateIndex
CREATE INDEX "time_logs_start_time_idx" ON "time_logs"("start_time");

-- CreateIndex
CREATE INDEX "disputes_contract_id_idx" ON "disputes"("contract_id");

-- CreateIndex
CREATE INDEX "disputes_milestone_id_idx" ON "disputes"("milestone_id");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "disputes_raised_by_idx" ON "disputes"("raised_by");

-- CreateIndex
CREATE INDEX "dispute_messages_dispute_id_idx" ON "dispute_messages"("dispute_id");

-- CreateIndex
CREATE INDEX "dispute_messages_sender_id_idx" ON "dispute_messages"("sender_id");

-- CreateIndex
CREATE UNIQUE INDEX "hipaa_compliance_tenant_id_key" ON "hipaa_compliance"("tenant_id");

-- CreateIndex
CREATE INDEX "phi_access_logs_hipaa_compliance_id_idx" ON "phi_access_logs"("hipaa_compliance_id");

-- CreateIndex
CREATE INDEX "phi_access_logs_user_id_idx" ON "phi_access_logs"("user_id");

-- CreateIndex
CREATE INDEX "phi_access_logs_timestamp_idx" ON "phi_access_logs"("timestamp");

-- CreateIndex
CREATE INDEX "hipaa_training_user_id_idx" ON "hipaa_training"("user_id");

-- CreateIndex
CREATE INDEX "hipaa_training_tenant_id_idx" ON "hipaa_training"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "hipaa_training_user_id_tenant_id_training_type_key" ON "hipaa_training"("user_id", "tenant_id", "training_type");

-- CreateIndex
CREATE INDEX "breach_incidents_tenant_id_idx" ON "breach_incidents"("tenant_id");

-- CreateIndex
CREATE INDEX "breach_incidents_status_idx" ON "breach_incidents"("status");

-- CreateIndex
CREATE INDEX "breach_timeline_breach_incident_id_idx" ON "breach_timeline"("breach_incident_id");

-- CreateIndex
CREATE UNIQUE INDEX "phi_tokens_token_key" ON "phi_tokens"("token");

-- CreateIndex
CREATE INDEX "phi_tokens_tenant_id_idx" ON "phi_tokens"("tenant_id");

-- CreateIndex
CREATE INDEX "phi_tokens_value_hash_idx" ON "phi_tokens"("value_hash");

-- CreateIndex
CREATE INDEX "kill_switch_events_tenant_id_idx" ON "kill_switch_events"("tenant_id");

-- CreateIndex
CREATE INDEX "kill_switch_events_user_id_idx" ON "kill_switch_events"("user_id");

-- CreateIndex
CREATE INDEX "kill_switch_events_status_idx" ON "kill_switch_events"("status");

-- CreateIndex
CREATE INDEX "kill_switch_events_initiated_at_idx" ON "kill_switch_events"("initiated_at");

-- CreateIndex
CREATE INDEX "kill_switch_actions_kill_switch_event_id_idx" ON "kill_switch_actions"("kill_switch_event_id");

-- CreateIndex
CREATE INDEX "access_revocations_user_id_idx" ON "access_revocations"("user_id");

-- CreateIndex
CREATE INDEX "access_revocations_tenant_id_idx" ON "access_revocations"("tenant_id");

-- CreateIndex
CREATE INDEX "access_revocations_is_active_idx" ON "access_revocations"("is_active");

-- CreateIndex
CREATE INDEX "session_recordings_session_id_idx" ON "session_recordings"("session_id");

-- CreateIndex
CREATE INDEX "session_recordings_tenant_id_idx" ON "session_recordings"("tenant_id");

-- CreateIndex
CREATE INDEX "session_recordings_user_id_idx" ON "session_recordings"("user_id");

-- CreateIndex
CREATE INDEX "session_recordings_status_idx" ON "session_recordings"("status");

-- CreateIndex
CREATE INDEX "session_recordings_expires_at_idx" ON "session_recordings"("expires_at");

-- CreateIndex
CREATE INDEX "recording_chunks_recording_id_idx" ON "recording_chunks"("recording_id");

-- CreateIndex
CREATE UNIQUE INDEX "recording_chunks_recording_id_chunk_index_key" ON "recording_chunks"("recording_id", "chunk_index");

-- CreateIndex
CREATE INDEX "recording_markers_recording_id_idx" ON "recording_markers"("recording_id");

-- CreateIndex
CREATE INDEX "recording_markers_marker_type_idx" ON "recording_markers"("marker_type");

-- CreateIndex
CREATE INDEX "recording_markers_timestamp_idx" ON "recording_markers"("timestamp");

-- CreateIndex
CREATE INDEX "recording_ocr_frames_recording_id_idx" ON "recording_ocr_frames"("recording_id");

-- CreateIndex
CREATE INDEX "recording_ocr_frames_timestamp_idx" ON "recording_ocr_frames"("timestamp");

-- CreateIndex
CREATE INDEX "recording_access_logs_recording_id_idx" ON "recording_access_logs"("recording_id");

-- CreateIndex
CREATE INDEX "recording_access_logs_accessed_by_idx" ON "recording_access_logs"("accessed_by");

-- CreateIndex
CREATE INDEX "recording_access_logs_created_at_idx" ON "recording_access_logs"("created_at");

-- CreateIndex
CREATE INDEX "recording_retention_policies_tenant_id_idx" ON "recording_retention_policies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "recording_retention_policies_tenant_id_name_key" ON "recording_retention_policies"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "watermark_configurations_tenant_id_idx" ON "watermark_configurations"("tenant_id");

-- CreateIndex
CREATE INDEX "watermark_configurations_is_default_idx" ON "watermark_configurations"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "watermark_configurations_tenant_id_name_key" ON "watermark_configurations"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "watermark_instances_session_id_idx" ON "watermark_instances"("session_id");

-- CreateIndex
CREATE INDEX "watermark_instances_configuration_id_idx" ON "watermark_instances"("configuration_id");

-- CreateIndex
CREATE INDEX "watermark_instances_invisible_key_idx" ON "watermark_instances"("invisible_key");

-- CreateIndex
CREATE INDEX "watermark_instances_is_active_idx" ON "watermark_instances"("is_active");

-- CreateIndex
CREATE INDEX "watermark_detections_watermark_instance_id_idx" ON "watermark_detections"("watermark_instance_id");

-- CreateIndex
CREATE INDEX "watermark_detections_extracted_user_id_idx" ON "watermark_detections"("extracted_user_id");

-- CreateIndex
CREATE INDEX "watermark_detections_extracted_session_id_idx" ON "watermark_detections"("extracted_session_id");

-- CreateIndex
CREATE INDEX "watermark_detections_investigation_status_idx" ON "watermark_detections"("investigation_status");

-- CreateIndex
CREATE INDEX "watermark_detections_created_at_idx" ON "watermark_detections"("created_at");

-- CreateIndex
CREATE INDEX "watermark_detections_source_type_idx" ON "watermark_detections"("source_type");

-- CreateIndex
CREATE INDEX "pod_templates_tenant_id_idx" ON "pod_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "pod_templates_category_idx" ON "pod_templates"("category");

-- CreateIndex
CREATE INDEX "pod_templates_is_public_is_active_idx" ON "pod_templates"("is_public", "is_active");

-- CreateIndex
CREATE INDEX "pod_templates_is_featured_idx" ON "pod_templates"("is_featured");

-- CreateIndex
CREATE UNIQUE INDEX "pod_templates_tenant_id_slug_key" ON "pod_templates"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "base_images_os_type_idx" ON "base_images"("os_type");

-- CreateIndex
CREATE INDEX "base_images_is_active_idx" ON "base_images"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pods_kasm_id_key" ON "pods"("kasm_id");

-- CreateIndex
CREATE INDEX "pods_tenant_id_idx" ON "pods"("tenant_id");

-- CreateIndex
CREATE INDEX "pods_owner_id_idx" ON "pods"("owner_id");

-- CreateIndex
CREATE INDEX "pods_status_idx" ON "pods"("status");

-- CreateIndex
CREATE INDEX "pods_kasm_id_idx" ON "pods"("kasm_id");

-- CreateIndex
CREATE INDEX "pod_sessions_pod_id_idx" ON "pod_sessions"("pod_id");

-- CreateIndex
CREATE INDEX "pod_sessions_user_id_idx" ON "pod_sessions"("user_id");

-- CreateIndex
CREATE INDEX "pod_sessions_started_at_idx" ON "pod_sessions"("started_at");

-- CreateIndex
CREATE INDEX "pod_resource_history_pod_id_idx" ON "pod_resource_history"("pod_id");

-- CreateIndex
CREATE INDEX "pod_resource_history_recorded_at_idx" ON "pod_resource_history"("recorded_at");

-- CreateIndex
CREATE INDEX "template_ratings_template_id_idx" ON "template_ratings"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_ratings_template_id_user_id_key" ON "template_ratings"("template_id", "user_id");

-- CreateIndex
CREATE INDEX "resource_pools_tenant_id_idx" ON "resource_pools"("tenant_id");

-- CreateIndex
CREATE INDEX "resource_pools_is_active_idx" ON "resource_pools"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_resource_quotas_tenant_id_key" ON "tenant_resource_quotas"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_resource_quotas_tenant_id_idx" ON "tenant_resource_quotas"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "freelancer_work_patterns_user_id_key" ON "freelancer_work_patterns"("user_id");

-- CreateIndex
CREATE INDEX "freelancer_work_patterns_timezone_idx" ON "freelancer_work_patterns"("timezone");

-- CreateIndex
CREATE INDEX "freelancer_work_patterns_last_active_at_idx" ON "freelancer_work_patterns"("last_active_at");

-- CreateIndex
CREATE INDEX "matching_events_project_id_idx" ON "matching_events"("project_id");

-- CreateIndex
CREATE INDEX "matching_events_freelancer_user_id_idx" ON "matching_events"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "matching_events_client_user_id_idx" ON "matching_events"("client_user_id");

-- CreateIndex
CREATE INDEX "matching_events_event_type_idx" ON "matching_events"("event_type");

-- CreateIndex
CREATE INDEX "matching_events_created_at_idx" ON "matching_events"("created_at");

-- CreateIndex
CREATE INDEX "rate_intelligence_skill_category_idx" ON "rate_intelligence"("skill_category");

-- CreateIndex
CREATE INDEX "rate_intelligence_primary_skill_idx" ON "rate_intelligence"("primary_skill");

-- CreateIndex
CREATE UNIQUE INDEX "rate_intelligence_skill_category_primary_skill_experience_l_key" ON "rate_intelligence"("skill_category", "primary_skill", "experience_level", "region", "period_start");

-- CreateIndex
CREATE INDEX "skill_relationships_skill1_idx" ON "skill_relationships"("skill1");

-- CreateIndex
CREATE INDEX "skill_relationships_skill2_idx" ON "skill_relationships"("skill2");

-- CreateIndex
CREATE UNIQUE INDEX "skill_relationships_skill1_skill2_key" ON "skill_relationships"("skill1", "skill2");

-- CreateIndex
CREATE INDEX "freelancer_skill_endorsements_user_id_skill_idx" ON "freelancer_skill_endorsements"("user_id", "skill");

-- CreateIndex
CREATE UNIQUE INDEX "freelancer_skill_endorsements_user_id_skill_endorsed_by_use_key" ON "freelancer_skill_endorsements"("user_id", "skill", "endorsed_by_user_id");

-- CreateIndex
CREATE INDEX "rate_data_points_primary_skill_idx" ON "rate_data_points"("primary_skill");

-- CreateIndex
CREATE INDEX "rate_data_points_skill_category_idx" ON "rate_data_points"("skill_category");

-- CreateIndex
CREATE INDEX "rate_data_points_experience_level_idx" ON "rate_data_points"("experience_level");

-- CreateIndex
CREATE INDEX "rate_data_points_freelancer_region_idx" ON "rate_data_points"("freelancer_region");

-- CreateIndex
CREATE INDEX "rate_data_points_occurred_at_idx" ON "rate_data_points"("occurred_at");

-- CreateIndex
CREATE INDEX "rate_data_points_was_accepted_idx" ON "rate_data_points"("was_accepted");

-- CreateIndex
CREATE INDEX "rate_data_points_source_type_source_id_idx" ON "rate_data_points"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "rate_aggregates_skill_category_idx" ON "rate_aggregates"("skill_category");

-- CreateIndex
CREATE INDEX "rate_aggregates_primary_skill_idx" ON "rate_aggregates"("primary_skill");

-- CreateIndex
CREATE INDEX "rate_aggregates_experience_level_idx" ON "rate_aggregates"("experience_level");

-- CreateIndex
CREATE INDEX "rate_aggregates_region_idx" ON "rate_aggregates"("region");

-- CreateIndex
CREATE INDEX "rate_aggregates_period_start_idx" ON "rate_aggregates"("period_start");

-- CreateIndex
CREATE UNIQUE INDEX "rate_aggregates_skill_category_primary_skill_experience_lev_key" ON "rate_aggregates"("skill_category", "primary_skill", "experience_level", "region", "period_type", "period_start");

-- CreateIndex
CREATE INDEX "freelancer_rate_history_user_id_idx" ON "freelancer_rate_history"("user_id");

-- CreateIndex
CREATE INDEX "freelancer_rate_history_changed_at_idx" ON "freelancer_rate_history"("changed_at");

-- CreateIndex
CREATE INDEX "rate_recommendations_user_id_idx" ON "rate_recommendations"("user_id");

-- CreateIndex
CREATE INDEX "rate_recommendations_status_idx" ON "rate_recommendations"("status");

-- CreateIndex
CREATE INDEX "rate_recommendations_created_at_idx" ON "rate_recommendations"("created_at");

-- CreateIndex
CREATE INDEX "skill_demand_trends_skill_idx" ON "skill_demand_trends"("skill");

-- CreateIndex
CREATE INDEX "skill_demand_trends_skill_category_idx" ON "skill_demand_trends"("skill_category");

-- CreateIndex
CREATE INDEX "skill_demand_trends_demand_level_idx" ON "skill_demand_trends"("demand_level");

-- CreateIndex
CREATE INDEX "skill_demand_trends_period_start_idx" ON "skill_demand_trends"("period_start");

-- CreateIndex
CREATE UNIQUE INDEX "skill_demand_trends_skill_period_start_key" ON "skill_demand_trends"("skill", "period_start");

-- CreateIndex
CREATE INDEX "contract_templates_tenant_id_idx" ON "contract_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "contract_templates_contract_type_idx" ON "contract_templates"("contract_type");

-- CreateIndex
CREATE INDEX "contract_templates_is_active_idx" ON "contract_templates"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_v2_contract_number_key" ON "contracts_v2"("contract_number");

-- CreateIndex
CREATE INDEX "contracts_v2_client_user_id_idx" ON "contracts_v2"("client_user_id");

-- CreateIndex
CREATE INDEX "contracts_v2_freelancer_user_id_idx" ON "contracts_v2"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "contracts_v2_tenant_id_idx" ON "contracts_v2"("tenant_id");

-- CreateIndex
CREATE INDEX "contracts_v2_status_idx" ON "contracts_v2"("status");

-- CreateIndex
CREATE INDEX "contracts_v2_contract_type_idx" ON "contracts_v2"("contract_type");

-- CreateIndex
CREATE INDEX "contracts_v2_start_date_idx" ON "contracts_v2"("start_date");

-- CreateIndex
CREATE INDEX "contracts_v2_contract_number_idx" ON "contracts_v2"("contract_number");

-- CreateIndex
CREATE INDEX "contract_milestones_v2_contract_id_idx" ON "contract_milestones_v2"("contract_id");

-- CreateIndex
CREATE INDEX "contract_milestones_v2_status_idx" ON "contract_milestones_v2"("status");

-- CreateIndex
CREATE INDEX "contract_milestones_v2_due_date_idx" ON "contract_milestones_v2"("due_date");

-- CreateIndex
CREATE INDEX "time_entries_v2_contract_id_idx" ON "time_entries_v2"("contract_id");

-- CreateIndex
CREATE INDEX "time_entries_v2_freelancer_user_id_idx" ON "time_entries_v2"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "time_entries_v2_date_idx" ON "time_entries_v2"("date");

-- CreateIndex
CREATE INDEX "time_entries_v2_status_idx" ON "time_entries_v2"("status");

-- CreateIndex
CREATE INDEX "time_entries_v2_invoice_id_idx" ON "time_entries_v2"("invoice_id");

-- CreateIndex
CREATE INDEX "contract_amendments_contract_id_idx" ON "contract_amendments"("contract_id");

-- CreateIndex
CREATE INDEX "contract_amendments_status_idx" ON "contract_amendments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_amendments_contract_id_amendment_number_key" ON "contract_amendments"("contract_id", "amendment_number");

-- CreateIndex
CREATE INDEX "contract_activities_contract_id_idx" ON "contract_activities"("contract_id");

-- CreateIndex
CREATE INDEX "contract_activities_activity_type_idx" ON "contract_activities"("activity_type");

-- CreateIndex
CREATE INDEX "contract_activities_created_at_idx" ON "contract_activities"("created_at");

-- CreateIndex
CREATE INDEX "contract_signatures_contract_id_idx" ON "contract_signatures"("contract_id");

-- CreateIndex
CREATE INDEX "contract_signatures_user_id_idx" ON "contract_signatures"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_invoices_invoice_number_key" ON "contract_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "contract_invoices_contract_id_idx" ON "contract_invoices"("contract_id");

-- CreateIndex
CREATE INDEX "contract_invoices_client_user_id_idx" ON "contract_invoices"("client_user_id");

-- CreateIndex
CREATE INDEX "contract_invoices_freelancer_user_id_idx" ON "contract_invoices"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "contract_invoices_status_idx" ON "contract_invoices"("status");

-- CreateIndex
CREATE INDEX "contract_invoices_issued_at_idx" ON "contract_invoices"("issued_at");

-- CreateIndex
CREATE INDEX "contract_invoices_due_at_idx" ON "contract_invoices"("due_at");

-- CreateIndex
CREATE INDEX "contract_disputes_contract_id_idx" ON "contract_disputes"("contract_id");

-- CreateIndex
CREATE INDEX "contract_disputes_status_idx" ON "contract_disputes"("status");

-- CreateIndex
CREATE INDEX "contract_disputes_raised_by_idx" ON "contract_disputes"("raised_by");

-- CreateIndex
CREATE INDEX "contract_dispute_messages_dispute_id_idx" ON "contract_dispute_messages"("dispute_id");

-- CreateIndex
CREATE INDEX "contract_dispute_messages_created_at_idx" ON "contract_dispute_messages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_accounts_v2_contract_id_key" ON "escrow_accounts_v2"("contract_id");

-- CreateIndex
CREATE INDEX "escrow_accounts_v2_client_user_id_idx" ON "escrow_accounts_v2"("client_user_id");

-- CreateIndex
CREATE INDEX "escrow_accounts_v2_freelancer_user_id_idx" ON "escrow_accounts_v2"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "escrow_accounts_v2_status_idx" ON "escrow_accounts_v2"("status");

-- CreateIndex
CREATE INDEX "escrow_transactions_v2_escrow_account_id_idx" ON "escrow_transactions_v2"("escrow_account_id");

-- CreateIndex
CREATE INDEX "escrow_transactions_v2_contract_id_idx" ON "escrow_transactions_v2"("contract_id");

-- CreateIndex
CREATE INDEX "escrow_transactions_v2_milestone_id_idx" ON "escrow_transactions_v2"("milestone_id");

-- CreateIndex
CREATE INDEX "escrow_transactions_v2_invoice_id_idx" ON "escrow_transactions_v2"("invoice_id");

-- CreateIndex
CREATE INDEX "escrow_transactions_v2_dispute_id_idx" ON "escrow_transactions_v2"("dispute_id");

-- CreateIndex
CREATE INDEX "escrow_transactions_v2_transactionType_idx" ON "escrow_transactions_v2"("transactionType");

-- CreateIndex
CREATE INDEX "escrow_transactions_v2_status_idx" ON "escrow_transactions_v2"("status");

-- CreateIndex
CREATE INDEX "escrow_transactions_v2_stripe_payment_intent_id_idx" ON "escrow_transactions_v2"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_line_items_type_idx" ON "invoice_line_items"("type");

-- CreateIndex
CREATE INDEX "conversations_job_id_idx" ON "conversations"("job_id");

-- CreateIndex
CREATE INDEX "conversations_contract_id_idx" ON "conversations"("contract_id");

-- CreateIndex
CREATE INDEX "conversations_bid_id_idx" ON "conversations"("bid_id");

-- CreateIndex
CREATE INDEX "conversations_service_order_id_idx" ON "conversations"("service_order_id");

-- CreateIndex
CREATE INDEX "conversations_dispute_id_idx" ON "conversations"("dispute_id");

-- CreateIndex
CREATE INDEX "conversations_type_idx" ON "conversations"("type");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE INDEX "conversations_created_by_idx" ON "conversations"("created_by");

-- CreateIndex
CREATE INDEX "conversation_participants_conversation_id_idx" ON "conversation_participants"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_participants_user_id_idx" ON "conversation_participants"("user_id");

-- CreateIndex
CREATE INDEX "conversation_participants_unread_count_idx" ON "conversation_participants"("unread_count");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "conversation_messages_conversation_id_idx" ON "conversation_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_messages_sender_user_id_idx" ON "conversation_messages"("sender_user_id");

-- CreateIndex
CREATE INDEX "conversation_messages_parent_message_id_idx" ON "conversation_messages"("parent_message_id");

-- CreateIndex
CREATE INDEX "conversation_messages_created_at_idx" ON "conversation_messages"("created_at");

-- CreateIndex
CREATE INDEX "conversation_messages_conversation_id_created_at_idx" ON "conversation_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "conversation_message_reactions_message_id_idx" ON "conversation_message_reactions"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_message_reactions_message_id_user_id_emoji_key" ON "conversation_message_reactions"("message_id", "user_id", "emoji");

-- CreateIndex
CREATE INDEX "conversation_message_read_receipts_message_id_idx" ON "conversation_message_read_receipts"("message_id");

-- CreateIndex
CREATE INDEX "conversation_message_read_receipts_user_id_idx" ON "conversation_message_read_receipts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_message_read_receipts_message_id_user_id_key" ON "conversation_message_read_receipts"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");

-- CreateIndex
CREATE INDEX "message_attachments_uploaded_by_idx" ON "message_attachments"("uploaded_by");

-- CreateIndex
CREATE UNIQUE INDEX "user_presence_user_id_key" ON "user_presence"("user_id");

-- CreateIndex
CREATE INDEX "user_presence_status_idx" ON "user_presence"("status");

-- CreateIndex
CREATE INDEX "user_presence_last_seen_at_idx" ON "user_presence"("last_seen_at");

-- CreateIndex
CREATE INDEX "user_blocklist_user_id_idx" ON "user_blocklist"("user_id");

-- CreateIndex
CREATE INDEX "user_blocklist_blocked_user_id_idx" ON "user_blocklist"("blocked_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocklist_user_id_blocked_user_id_key" ON "user_blocklist"("user_id", "blocked_user_id");

-- CreateIndex
CREATE INDEX "clients_freelancer_user_id_idx" ON "clients"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "clients_tags_idx" ON "clients"("tags");

-- CreateIndex
CREATE INDEX "clients_health_score_idx" ON "clients"("health_score");

-- CreateIndex
CREATE INDEX "clients_last_contact_at_idx" ON "clients"("last_contact_at");

-- CreateIndex
CREATE UNIQUE INDEX "clients_freelancer_user_id_email_key" ON "clients"("freelancer_user_id", "email");

-- CreateIndex
CREATE INDEX "client_contacts_client_id_idx" ON "client_contacts"("client_id");

-- CreateIndex
CREATE INDEX "client_interactions_client_id_idx" ON "client_interactions"("client_id");

-- CreateIndex
CREATE INDEX "client_interactions_freelancer_user_id_idx" ON "client_interactions"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "client_interactions_occurred_at_idx" ON "client_interactions"("occurred_at");

-- CreateIndex
CREATE INDEX "client_interactions_interaction_type_idx" ON "client_interactions"("interaction_type");

-- CreateIndex
CREATE INDEX "opportunities_freelancer_user_id_idx" ON "opportunities"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "opportunities_client_id_idx" ON "opportunities"("client_id");

-- CreateIndex
CREATE INDEX "opportunities_stage_idx" ON "opportunities"("stage");

-- CreateIndex
CREATE INDEX "opportunities_status_idx" ON "opportunities"("status");

-- CreateIndex
CREATE INDEX "opportunities_expected_close_date_idx" ON "opportunities"("expected_close_date");

-- CreateIndex
CREATE INDEX "opportunity_activities_opportunity_id_idx" ON "opportunity_activities"("opportunity_id");

-- CreateIndex
CREATE INDEX "opportunity_activities_created_at_idx" ON "opportunity_activities"("created_at");

-- CreateIndex
CREATE INDEX "client_documents_client_id_idx" ON "client_documents"("client_id");

-- CreateIndex
CREATE INDEX "client_documents_document_type_idx" ON "client_documents"("document_type");

-- CreateIndex
CREATE INDEX "client_reminders_client_id_idx" ON "client_reminders"("client_id");

-- CreateIndex
CREATE INDEX "client_reminders_freelancer_user_id_idx" ON "client_reminders"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "client_reminders_due_at_idx" ON "client_reminders"("due_at");

-- CreateIndex
CREATE INDEX "client_reminders_status_idx" ON "client_reminders"("status");

-- CreateIndex
CREATE INDEX "crm_custom_fields_freelancer_user_id_idx" ON "crm_custom_fields"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "crm_custom_fields_entity_type_idx" ON "crm_custom_fields"("entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "crm_custom_fields_freelancer_user_id_entity_type_field_name_key" ON "crm_custom_fields"("freelancer_user_id", "entity_type", "field_name");

-- CreateIndex
CREATE INDEX "bids_quality_score_idx" ON "bids"("quality_score");

-- CreateIndex
CREATE INDEX "bids_is_spam_idx" ON "bids"("is_spam");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_category_idx" ON "notifications"("user_id", "category");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_group_key_idx" ON "notifications"("group_key");

-- CreateIndex
CREATE INDEX "notifications_expires_at_idx" ON "notifications"("expires_at");

-- CreateIndex
CREATE INDEX "services_category_idx" ON "services"("category");

-- CreateIndex
CREATE INDEX "services_is_active_is_featured_idx" ON "services"("is_active", "is_featured");

-- CreateIndex
CREATE UNIQUE INDEX "services_freelancer_id_slug_key" ON "services"("freelancer_id", "slug");

-- CreateIndex
CREATE INDEX "sessions_security_policy_id_idx" ON "sessions"("security_policy_id");

-- AddForeignKey
ALTER TABLE "freelancer_compliance" ADD CONSTRAINT "freelancer_compliance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_clearances" ADD CONSTRAINT "security_clearances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_compliance_requirements" ADD CONSTRAINT "tenant_compliance_requirements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelancer_compliance_attestations" ADD CONSTRAINT "freelancer_compliance_attestations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_verification_logs" ADD CONSTRAINT "compliance_verification_logs_compliance_id_fkey" FOREIGN KEY ("compliance_id") REFERENCES "freelancer_compliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_messages" ADD CONSTRAINT "bid_messages_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_questions" ADD CONSTRAINT "project_questions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_questions" ADD CONSTRAINT "project_questions_asker_id_fkey" FOREIGN KEY ("asker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_add_ons" ADD CONSTRAINT "service_add_ons_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_items" ADD CONSTRAINT "service_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_items" ADD CONSTRAINT "service_order_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_add_ons" ADD CONSTRAINT "service_order_add_ons_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_add_ons" ADD CONSTRAINT "service_order_add_ons_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "service_add_ons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_deliveries" ADD CONSTRAINT "service_deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_revision_requests" ADD CONSTRAINT "service_revision_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_messages" ADD CONSTRAINT "service_order_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_messages" ADD CONSTRAINT "service_order_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_security_policy_id_fkey" FOREIGN KEY ("security_policy_id") REFERENCES "pod_security_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pod_security_policies" ADD CONSTRAINT "pod_security_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_violations" ADD CONSTRAINT "security_violations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_violations" ADD CONSTRAINT "security_violations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_transfer_requests" ADD CONSTRAINT "file_transfer_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_transfer_requests" ADD CONSTRAINT "file_transfer_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "containment_audit_logs" ADD CONSTRAINT "containment_audit_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "containment_audit_logs" ADD CONSTRAINT "containment_audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_transfer_attempts" ADD CONSTRAINT "data_transfer_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_transfer_attempts" ADD CONSTRAINT "data_transfer_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_transfer_attempts" ADD CONSTRAINT "data_transfer_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_transfer_attempts" ADD CONSTRAINT "data_transfer_attempts_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "pod_security_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_transfer_attempts" ADD CONSTRAINT "data_transfer_attempts_override_request_id_fkey" FOREIGN KEY ("override_request_id") REFERENCES "transfer_override_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_capture_attempts" ADD CONSTRAINT "screen_capture_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_capture_attempts" ADD CONSTRAINT "screen_capture_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_capture_attempts" ADD CONSTRAINT "screen_capture_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_exceptions" ADD CONSTRAINT "policy_exceptions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "pod_security_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_override_requests" ADD CONSTRAINT "transfer_override_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_digests" ADD CONSTRAINT "notification_digests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_unsubscribes" ADD CONSTRAINT "email_unsubscribes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_balances" ADD CONSTRAINT "escrow_balances_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hipaa_compliance" ADD CONSTRAINT "hipaa_compliance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phi_access_logs" ADD CONSTRAINT "phi_access_logs_hipaa_compliance_id_fkey" FOREIGN KEY ("hipaa_compliance_id") REFERENCES "hipaa_compliance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phi_access_logs" ADD CONSTRAINT "phi_access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hipaa_training" ADD CONSTRAINT "hipaa_training_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breach_incidents" ADD CONSTRAINT "breach_incidents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breach_timeline" ADD CONSTRAINT "breach_timeline_breach_incident_id_fkey" FOREIGN KEY ("breach_incident_id") REFERENCES "breach_incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kill_switch_actions" ADD CONSTRAINT "kill_switch_actions_kill_switch_event_id_fkey" FOREIGN KEY ("kill_switch_event_id") REFERENCES "kill_switch_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_revocations" ADD CONSTRAINT "access_revocations_kill_switch_event_id_fkey" FOREIGN KEY ("kill_switch_event_id") REFERENCES "kill_switch_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_recordings" ADD CONSTRAINT "session_recordings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_recordings" ADD CONSTRAINT "session_recordings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_recordings" ADD CONSTRAINT "session_recordings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_chunks" ADD CONSTRAINT "recording_chunks_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "session_recordings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_markers" ADD CONSTRAINT "recording_markers_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "session_recordings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_ocr_frames" ADD CONSTRAINT "recording_ocr_frames_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "session_recordings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_access_logs" ADD CONSTRAINT "recording_access_logs_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "session_recordings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_access_logs" ADD CONSTRAINT "recording_access_logs_accessed_by_fkey" FOREIGN KEY ("accessed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_retention_policies" ADD CONSTRAINT "recording_retention_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watermark_configurations" ADD CONSTRAINT "watermark_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watermark_instances" ADD CONSTRAINT "watermark_instances_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "watermark_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watermark_instances" ADD CONSTRAINT "watermark_instances_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watermark_detections" ADD CONSTRAINT "watermark_detections_watermark_instance_id_fkey" FOREIGN KEY ("watermark_instance_id") REFERENCES "watermark_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pod_templates" ADD CONSTRAINT "pod_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pod_templates" ADD CONSTRAINT "pod_templates_base_image_id_fkey" FOREIGN KEY ("base_image_id") REFERENCES "base_images"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pods" ADD CONSTRAINT "pods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pods" ADD CONSTRAINT "pods_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pods" ADD CONSTRAINT "pods_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "pod_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pods" ADD CONSTRAINT "pods_security_policy_id_fkey" FOREIGN KEY ("security_policy_id") REFERENCES "pod_security_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pod_sessions" ADD CONSTRAINT "pod_sessions_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "pods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pod_resource_history" ADD CONSTRAINT "pod_resource_history_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "pods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_ratings" ADD CONSTRAINT "template_ratings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "pod_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_ratings" ADD CONSTRAINT "template_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_pools" ADD CONSTRAINT "resource_pools_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_resource_quotas" ADD CONSTRAINT "tenant_resource_quotas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelancer_work_patterns" ADD CONSTRAINT "freelancer_work_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matching_events" ADD CONSTRAINT "matching_events_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matching_events" ADD CONSTRAINT "matching_events_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelancer_skill_endorsements" ADD CONSTRAINT "freelancer_skill_endorsements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelancer_skill_endorsements" ADD CONSTRAINT "freelancer_skill_endorsements_endorsed_by_user_id_fkey" FOREIGN KEY ("endorsed_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelancer_rate_history" ADD CONSTRAINT "freelancer_rate_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_recommendations" ADD CONSTRAINT "rate_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts_v2" ADD CONSTRAINT "contracts_v2_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts_v2" ADD CONSTRAINT "contracts_v2_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts_v2" ADD CONSTRAINT "contracts_v2_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts_v2" ADD CONSTRAINT "contracts_v2_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts_v2" ADD CONSTRAINT "contracts_v2_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_milestones_v2" ADD CONSTRAINT "contract_milestones_v2_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries_v2" ADD CONSTRAINT "time_entries_v2_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries_v2" ADD CONSTRAINT "time_entries_v2_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries_v2" ADD CONSTRAINT "time_entries_v2_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "contract_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_activities" ADD CONSTRAINT "contract_activities_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_activities" ADD CONSTRAINT "contract_activities_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_invoices" ADD CONSTRAINT "contract_invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_invoices" ADD CONSTRAINT "contract_invoices_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_invoices" ADD CONSTRAINT "contract_invoices_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_disputes" ADD CONSTRAINT "contract_disputes_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_disputes" ADD CONSTRAINT "contract_disputes_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_dispute_messages" ADD CONSTRAINT "contract_dispute_messages_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "contract_disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_dispute_messages" ADD CONSTRAINT "contract_dispute_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_accounts_v2" ADD CONSTRAINT "escrow_accounts_v2_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions_v2" ADD CONSTRAINT "escrow_transactions_v2_escrow_account_id_fkey" FOREIGN KEY ("escrow_account_id") REFERENCES "escrow_accounts_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions_v2" ADD CONSTRAINT "escrow_transactions_v2_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions_v2" ADD CONSTRAINT "escrow_transactions_v2_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "contract_milestones_v2"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions_v2" ADD CONSTRAINT "escrow_transactions_v2_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "contract_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions_v2" ADD CONSTRAINT "escrow_transactions_v2_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "contract_disputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "contract_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "contract_disputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "conversation_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_message_reactions" ADD CONSTRAINT "conversation_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_message_reactions" ADD CONSTRAINT "conversation_message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_message_read_receipts" ADD CONSTRAINT "conversation_message_read_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_message_read_receipts" ADD CONSTRAINT "conversation_message_read_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocklist" ADD CONSTRAINT "user_blocklist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocklist" ADD CONSTRAINT "user_blocklist_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_interactions" ADD CONSTRAINT "client_interactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_interactions" ADD CONSTRAINT "client_interactions_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_reminders" ADD CONSTRAINT "client_reminders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
