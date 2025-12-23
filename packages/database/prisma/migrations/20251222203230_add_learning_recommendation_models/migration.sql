/*
  Warnings:

  - The values [ISSUED,REFUNDED] on the enum `InvoiceStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `time_entry_id` on the `invoice_line_items` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `invoice_line_items` table. All the data in the column will be lost.
  - You are about to alter the column `quantity` on the `invoice_line_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to drop the column `due_at` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `issued_at` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `line_items` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `number` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `paid_at` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `tenant_id` on the `invoices` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[invoice_number]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[view_token]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `invoice_line_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amount_due` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_id` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `due_date` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `freelancer_user_id` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `invoice_number` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `issue_date` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `view_token` to the `invoices` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TenantBillingInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ProjectSource" AS ENUM ('MANUAL', 'SKILLANCER_MARKET', 'UPWORK', 'FIVERR', 'TOPTAL', 'FREELANCER', 'OTHER_PLATFORM');

-- CreateEnum
CREATE TYPE "CockpitProjectType" AS ENUM ('CLIENT_WORK', 'INTERNAL', 'PERSONAL', 'RETAINER', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "CockpitProjectStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CockpitBudgetType" AS ENUM ('HOURLY', 'FIXED', 'RETAINER', 'NO_BUDGET');

-- CreateEnum
CREATE TYPE "CockpitTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CockpitMilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectFileType" AS ENUM ('DELIVERABLE', 'ASSET', 'REFERENCE', 'CONTRACT', 'BRIEF', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectActivityType" AS ENUM ('PROJECT_CREATED', 'PROJECT_UPDATED', 'STATUS_CHANGED', 'TASK_CREATED', 'TASK_UPDATED', 'TASK_COMPLETED', 'TASK_DELETED', 'MILESTONE_CREATED', 'MILESTONE_UPDATED', 'MILESTONE_COMPLETED', 'TIME_LOGGED', 'FILE_UPLOADED', 'FILE_DELETED', 'NOTE_ADDED', 'PROGRESS_UPDATED');

-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('MANUAL', 'TIMER', 'IMPORT', 'COCKPIT', 'MARKET', 'SKILLPOD', 'CALENDAR');

-- CreateEnum
CREATE TYPE "TrackingMethod" AS ENUM ('TIMER', 'MANUAL', 'CALENDAR', 'SKILLPOD', 'IMPORTED');

-- CreateEnum
CREATE TYPE "TimeApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RoundingMethod" AS ENUM ('NONE', 'UP', 'DOWN', 'NEAREST');

-- CreateEnum
CREATE TYPE "TimerStatus" AS ENUM ('RUNNING', 'PAUSED', 'STOPPED');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'APPLE');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'ERROR');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('INTERNAL', 'GOOGLE', 'MICROSOFT', 'APPLE', 'BOOKING');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MEETING', 'CALL', 'FOCUS_TIME', 'DEADLINE', 'REMINDER', 'BLOCKED', 'OUT_OF_OFFICE', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('CONFIRMED', 'TENTATIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('DEFAULT', 'PUBLIC', 'PRIVATE', 'CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('VIDEO_CALL', 'PHONE', 'IN_PERSON', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'CASH', 'PAYPAL', 'STRIPE', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "FinancialTransactionSource" AS ENUM ('MANUAL', 'MARKET', 'BANK_IMPORT', 'RECURRING', 'INVOICE');

-- CreateEnum
CREATE TYPE "FinancialTransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'VOIDED');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "FinancialGoalType" AS ENUM ('INCOME', 'SAVINGS', 'EXPENSE_LIMIT', 'PROFIT');

-- CreateEnum
CREATE TYPE "FinancialGoalStatus" AS ENUM ('IN_PROGRESS', 'ACHIEVED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialPeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MileagePurpose" AS ENUM ('CLIENT_MEETING', 'BUSINESS_ERRAND', 'TRAVEL', 'OTHER');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('SOLE_PROPRIETOR', 'LLC_SINGLE', 'LLC_MULTI', 'S_CORP', 'C_CORP', 'PARTNERSHIP');

-- CreateEnum
CREATE TYPE "FilingStatus" AS ENUM ('SINGLE', 'MARRIED_FILING_JOINTLY', 'MARRIED_FILING_SEPARATELY', 'HEAD_OF_HOUSEHOLD', 'QUALIFYING_WIDOW');

-- CreateEnum
CREATE TYPE "AccountingMethod" AS ENUM ('CASH', 'ACCRUAL');

-- CreateEnum
CREATE TYPE "LineItemType" AS ENUM ('SERVICE', 'PRODUCT', 'EXPENSE', 'DISCOUNT', 'TIME', 'MILESTONE', 'RETAINER', 'OTHER');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "LateFeeType" AS ENUM ('PERCENTAGE', 'FIXED', 'DAILY_PERCENTAGE', 'DAILY_FIXED');

-- CreateEnum
CREATE TYPE "InvoicePaymentMethod" AS ENUM ('BANK_TRANSFER', 'CREDIT_CARD', 'STRIPE', 'PAYPAL', 'CHECK', 'CASH', 'CRYPTO', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoicePaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "TemplateLayout" AS ENUM ('CLASSIC', 'MODERN', 'MINIMAL', 'DETAILED', 'COMPACT');

-- CreateEnum
CREATE TYPE "InvoiceActivityType" AS ENUM ('CREATED', 'UPDATED', 'SENT', 'VIEWED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'REMINDER_SENT', 'LATE_FEE_APPLIED', 'STATUS_CHANGED', 'VOIDED', 'DOWNLOADED', 'COMMENT_ADDED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('UPWORK', 'FIVERR', 'TOPTAL', 'FREELANCER', 'NOTION', 'TRELLO', 'ASANA', 'JIRA', 'MONDAY', 'CLICKUP', 'TODOIST', 'SLACK', 'DISCORD', 'TEAMS', 'QUICKBOOKS', 'XERO', 'FRESHBOOKS', 'WAVE', 'PLAID', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'GITHUB', 'GITLAB', 'BITBUCKET', 'GOOGLE_CALENDAR', 'OUTLOOK_CALENDAR', 'ZAPIER', 'MAKE', 'CUSTOM_WEBHOOK');

-- CreateEnum
CREATE TYPE "IntegrationCategory" AS ENUM ('FREELANCE_PLATFORM', 'PRODUCTIVITY', 'COMMUNICATION', 'ACCOUNTING', 'BANKING', 'STORAGE', 'DEVELOPMENT', 'CALENDAR', 'AUTOMATION');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SyncFrequency" AS ENUM ('REALTIME', 'EVERY_5_MIN', 'EVERY_15_MIN', 'HOURLY', 'EVERY_6_HOURS', 'DAILY', 'WEEKLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "IntegrationSyncDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "IntegrationSyncType" AS ENUM ('FULL', 'INCREMENTAL', 'MANUAL', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "IntegrationSyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "MappingEntityType" AS ENUM ('CLIENT', 'PROJECT', 'TASK', 'TIME_ENTRY', 'INVOICE', 'EXPENSE', 'PAYMENT', 'CONTRACT', 'MESSAGE', 'FILE', 'MILESTONE');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "IntegrationAuthType" AS ENUM ('OAUTH2', 'API_KEY', 'BASIC', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CredentialSource" AS ENUM ('SKILLPOD', 'EXTERNAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('COURSE_COMPLETION', 'ASSESSMENT_PASS', 'CERTIFICATION', 'SKILL_BADGE', 'LEARNING_PATH', 'EXTERNAL_CERTIFICATION');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'PENDING_RENEWAL');

-- CreateEnum
CREATE TYPE "ProficiencyLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('ASSESSMENT', 'COURSE_COMPLETION', 'CERTIFICATION', 'PEER_ENDORSEMENT', 'CLIENT_REVIEW', 'PROJECT_COMPLETION');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('COURSE', 'TUTORIAL', 'VIDEO', 'ARTICLE', 'BOOK', 'PODCAST', 'PROJECT', 'CERTIFICATION', 'ASSESSMENT', 'WORKSHOP', 'BOOTCAMP', 'MENTORSHIP');

-- CreateEnum
CREATE TYPE "LearningStyle" AS ENUM ('SELF_PACED', 'INSTRUCTOR_LED', 'PROJECT_BASED', 'INTERACTIVE', 'MIXED');

-- CreateEnum
CREATE TYPE "DifficultyPreference" AS ENUM ('EASY', 'PROGRESSIVE', 'CHALLENGING');

-- CreateEnum
CREATE TYPE "GapType" AS ENUM ('MISSING_SKILL', 'LEVEL_GAP', 'OUTDATED_SKILL', 'TRENDING_SKILL', 'COMPETITIVE_ADVANTAGE');

-- CreateEnum
CREATE TYPE "GapPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "GapStatus" AS ENUM ('ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('JOB_VIEW', 'JOB_APPLICATION', 'JOB_REJECTION', 'JOB_ACCEPTANCE', 'CONTRACT_STARTED', 'CONTRACT_COMPLETED', 'CLIENT_FEEDBACK', 'SKILL_SEARCH', 'PROFILE_GAP', 'COMPETITOR_ANALYSIS', 'MARKET_TREND', 'CERTIFICATION_REQUIRED');

-- CreateEnum
CREATE TYPE "LearningRecommendationType" AS ENUM ('SKILL_GAP_FILL', 'CAREER_ADVANCEMENT', 'MARKET_DEMAND', 'TRENDING_SKILL', 'CERTIFICATION', 'REFRESH_KNOWLEDGE', 'COMPETITIVE_EDGE', 'PREREQUISITE', 'QUICK_WIN', 'DEEP_DIVE');

-- CreateEnum
CREATE TYPE "LearningRecommendationStatus" AS ENUM ('PENDING', 'VIEWED', 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LearningPathType" AS ENUM ('SKILL_MASTERY', 'ROLE_TRANSITION', 'CERTIFICATION_TRACK', 'MARKET_ALIGNMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LearningPathGenerationSource" AS ENUM ('SYSTEM_RECOMMENDED', 'USER_CREATED', 'ML_GENERATED', 'CURATOR_CREATED');

-- CreateEnum
CREATE TYPE "LearningPathStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "TrendDirection" AS ENUM ('RISING', 'STABLE', 'DECLINING');

-- CreateEnum
CREATE TYPE "TrendPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "CompetitionLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ClientSource" ADD VALUE 'UPWORK';
ALTER TYPE "ClientSource" ADD VALUE 'FIVERR';
ALTER TYPE "ClientSource" ADD VALUE 'TOPTAL';
ALTER TYPE "ClientSource" ADD VALUE 'FREELANCER';

-- AlterEnum
ALTER TYPE "EvidenceType" ADD VALUE 'ACTIVITY_LOG';

-- AlterEnum
BEGIN;
CREATE TYPE "InvoiceStatus_new" AS ENUM ('DRAFT', 'PENDING', 'SENT', 'VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOIDED', 'CANCELLED');
ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "InvoiceStatus_new" USING ("status"::text::"InvoiceStatus_new");
ALTER TYPE "InvoiceStatus" RENAME TO "InvoiceStatus_old";
ALTER TYPE "InvoiceStatus_new" RENAME TO "InvoiceStatus";
DROP TYPE "InvoiceStatus_old";
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "invoice_line_items" DROP CONSTRAINT "invoice_line_items_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_tenant_id_fkey";

-- DropIndex
DROP INDEX "invoice_line_items_type_idx";

-- DropIndex
DROP INDEX "invoices_number_idx";

-- DropIndex
DROP INDEX "invoices_number_key";

-- DropIndex
DROP INDEX "invoices_stripe_invoice_id_key";

-- DropIndex
DROP INDEX "invoices_tenant_id_idx";

-- AlterTable
ALTER TABLE "invoice_line_items" DROP COLUMN "time_entry_id",
DROP COLUMN "type",
ADD COLUMN     "is_taxable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "item_type" "LineItemType" NOT NULL DEFAULT 'SERVICE',
ADD COLUMN     "period_end" DATE,
ADD COLUMN     "period_start" DATE,
ADD COLUMN     "project_id" UUID,
ADD COLUMN     "task_id" UUID,
ADD COLUMN     "tax_rate" DECIMAL(5,2),
ADD COLUMN     "time_entry_ids" TEXT[],
ADD COLUMN     "unit_type" VARCHAR(50),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "description" SET DATA TYPE TEXT,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,4),
ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "due_at",
DROP COLUMN "issued_at",
DROP COLUMN "line_items",
DROP COLUMN "number",
DROP COLUMN "paid_at",
DROP COLUMN "tax",
DROP COLUMN "tenant_id",
ADD COLUMN     "accent_color" VARCHAR(7),
ADD COLUMN     "accepted_payment_methods" TEXT[],
ADD COLUMN     "amount_due" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "client_id" UUID NOT NULL,
ADD COLUMN     "contract_id" UUID,
ADD COLUMN     "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_type" "DiscountType",
ADD COLUMN     "discount_value" DECIMAL(10,2),
ADD COLUMN     "due_date" DATE NOT NULL,
ADD COLUMN     "exchange_rate" DECIMAL(10,6),
ADD COLUMN     "footer_text" TEXT,
ADD COLUMN     "freelancer_user_id" UUID NOT NULL,
ADD COLUMN     "invoice_number" VARCHAR(50) NOT NULL,
ADD COLUMN     "is_recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "issue_date" DATE NOT NULL,
ADD COLUMN     "last_reminder_at" TIMESTAMP(3),
ADD COLUMN     "last_viewed_at" TIMESTAMP(3),
ADD COLUMN     "late_fee_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "late_fee_applied_at" TIMESTAMP(3),
ADD COLUMN     "late_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "late_fee_type" "LateFeeType",
ADD COLUMN     "late_fee_value" DECIMAL(10,2),
ADD COLUMN     "logo_url" VARCHAR(500),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "next_reminder_at" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paid_date" DATE,
ADD COLUMN     "payment_instructions" TEXT,
ADD COLUMN     "paypal_order_id" VARCHAR(255),
ADD COLUMN     "pdf_generated_at" TIMESTAMP(3),
ADD COLUMN     "pdf_url" VARCHAR(500),
ADD COLUMN     "project_id" UUID,
ADD COLUMN     "recurring_schedule_id" UUID,
ADD COLUMN     "reference_number" VARCHAR(100),
ADD COLUMN     "reminders_sent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sent_at" TIMESTAMP(3),
ADD COLUMN     "sent_to" TEXT[],
ADD COLUMN     "stripe_payment_intent_id" VARCHAR(255),
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax_label" VARCHAR(50),
ADD COLUMN     "tax_number" VARCHAR(100),
ADD COLUMN     "tax_rate" DECIMAL(5,2),
ADD COLUMN     "template_id" UUID,
ADD COLUMN     "terms" TEXT,
ADD COLUMN     "title" VARCHAR(255),
ADD COLUMN     "view_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "view_token" VARCHAR(64) NOT NULL,
ADD COLUMN     "void_reason" TEXT,
ADD COLUMN     "voided_at" TIMESTAMP(3),
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "stripe_invoice_id" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "skills" ADD COLUMN     "external_mappings" JSONB;

-- CreateTable
CREATE TABLE "tenant_billing_invoices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "number" VARCHAR(50) NOT NULL,
    "status" "TenantBillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "issued_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "stripe_invoice_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_invoice_line_items" (
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

    CONSTRAINT "contract_invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cockpit_projects" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "freelancer_user_id" UUID NOT NULL,
    "client_id" UUID,
    "source" "ProjectSource" NOT NULL DEFAULT 'MANUAL',
    "market_contract_id" UUID,
    "external_id" VARCHAR(255),
    "external_platform" VARCHAR(100),
    "external_url" VARCHAR(500),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "project_type" "CockpitProjectType" NOT NULL DEFAULT 'CLIENT_WORK',
    "category" VARCHAR(100),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CockpitProjectStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "priority" "CrmPriority" NOT NULL DEFAULT 'MEDIUM',
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "budget_type" "CockpitBudgetType",
    "budget_amount" DECIMAL(12,2),
    "hourly_rate" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "estimated_hours" DECIMAL(8,2),
    "tracked_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "billable_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "total_billed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "color" VARCHAR(20),
    "notes" TEXT,
    "custom_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cockpit_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tasks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "parent_task_id" UUID,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "status" "CockpitTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "CrmPriority" NOT NULL DEFAULT 'MEDIUM',
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "estimated_minutes" INTEGER NOT NULL DEFAULT 0,
    "tracked_minutes" INTEGER NOT NULL DEFAULT 0,
    "milestone_id" UUID,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "CockpitMilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "market_milestone_id" UUID,
    "amount" DECIMAL(12,2),
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "deliverables" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cockpit_time_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "freelancer_user_id" UUID NOT NULL,
    "project_id" UUID,
    "task_id" UUID,
    "client_id" UUID,
    "market_contract_id" UUID,
    "market_time_entry_id" UUID,
    "description" TEXT,
    "date" DATE NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "duration_minutes" INTEGER NOT NULL,
    "category" VARCHAR(100),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "hourly_rate" DECIMAL(10,2),
    "amount" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "is_invoiced" BOOLEAN NOT NULL DEFAULT false,
    "invoice_id" UUID,
    "invoiced_at" TIMESTAMP(3),
    "tracking_method" "TrackingMethod" NOT NULL DEFAULT 'MANUAL',
    "timer_started_at" TIMESTAMP(3),
    "timer_paused_at" TIMESTAMP(3),
    "timer_paused_duration" INTEGER NOT NULL DEFAULT 0,
    "has_evidence" BOOLEAN NOT NULL DEFAULT false,
    "evidence_type" "EvidenceType",
    "evidence_url" VARCHAR(500),
    "activity_level" INTEGER,
    "approval_status" "TimeApprovalStatus",
    "approved_at" TIMESTAMP(3),
    "approved_by" UUID,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "source" "TimeEntrySource" NOT NULL DEFAULT 'COCKPIT',
    "synced_to_market" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMP(3),
    "sync_error" TEXT,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(3),
    "locked_reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cockpit_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_files" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "file_type" "ProjectFileType" NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "folder" VARCHAR(255),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "previous_version_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_activities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "activity_type" "ProjectActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "task_id" UUID,
    "milestone_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "freelancer_user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "project_type" "CockpitProjectType",
    "budget_type" "CockpitBudgetType",
    "default_hourly_rate" DECIMAL(10,2),
    "estimated_hours" DECIMAL(8,2),
    "task_structure" JSONB,
    "milestone_structure" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_tracking_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "default_hourly_rate" DECIMAL(10,2),
    "default_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "auto_stop_after_minutes" INTEGER,
    "idle_detection_minutes" INTEGER NOT NULL DEFAULT 5,
    "reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_time" VARCHAR(5),
    "rounding_method" "RoundingMethod" NOT NULL DEFAULT 'NONE',
    "rounding_minutes" INTEGER NOT NULL DEFAULT 15,
    "workday_start_time" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "workday_end_time" VARCHAR(5) NOT NULL DEFAULT '17:00',
    "work_days" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "target_hours_per_day" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "target_hours_per_week" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "custom_categories" TEXT[],
    "auto_sync_to_market" BOOLEAN NOT NULL DEFAULT true,
    "week_start_day" INTEGER NOT NULL DEFAULT 1,
    "require_description" BOOLEAN NOT NULL DEFAULT true,
    "require_project" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_tracking_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_timers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "project_id" UUID,
    "task_id" UUID,
    "description" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "paused_at" TIMESTAMP(3),
    "total_paused_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "hourly_rate" DECIMAL(10,2),
    "status" "TimerStatus" NOT NULL DEFAULT 'RUNNING',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_timers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "freelancer_user_id" UUID NOT NULL,
    "week_start_date" DATE NOT NULL,
    "week_end_date" DATE NOT NULL,
    "total_minutes" INTEGER NOT NULL,
    "billable_minutes" INTEGER NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" UUID,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "freelancer_user_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(7),
    "icon" VARCHAR(50),
    "default_billable" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "email" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255),
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_direction" "SyncDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
    "last_sync_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "selected_calendar_ids" TEXT[],
    "primary_calendar_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_calendars" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "connection_id" UUID NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(20),
    "timezone" VARCHAR(50),
    "access_role" VARCHAR(50),
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_events" BOOLEAN NOT NULL DEFAULT true,
    "create_events_here" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "source" "EventSource" NOT NULL DEFAULT 'INTERNAL',
    "external_calendar_id" UUID,
    "external_event_id" VARCHAR(255),
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "location" VARCHAR(500),
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "is_all_day" BOOLEAN NOT NULL DEFAULT false,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" VARCHAR(500),
    "recurrence_id" UUID,
    "original_start_time" TIMESTAMP(3),
    "event_type" "EventType" NOT NULL DEFAULT 'MEETING',
    "category" VARCHAR(100),
    "color" VARCHAR(20),
    "project_id" UUID,
    "client_id" UUID,
    "task_id" UUID,
    "attendees" JSONB,
    "organizer_email" VARCHAR(255),
    "meeting_url" VARCHAR(1000),
    "conference_type" VARCHAR(50),
    "status" "EventStatus" NOT NULL DEFAULT 'CONFIRMED',
    "visibility" "EventVisibility" NOT NULL DEFAULT 'DEFAULT',
    "track_time" BOOLEAN NOT NULL DEFAULT false,
    "time_entry_id" UUID,
    "auto_create_time_entry" BOOLEAN NOT NULL DEFAULT false,
    "reminders" JSONB,
    "last_sync_at" TIMESTAMP(3),
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "etag" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_schedules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "weekly_hours" JSONB NOT NULL,
    "date_overrides" JSONB,
    "buffer_before" INTEGER NOT NULL DEFAULT 0,
    "buffer_after" INTEGER NOT NULL DEFAULT 0,
    "min_notice_hours" INTEGER NOT NULL DEFAULT 24,
    "max_advance_days" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "event_title" VARCHAR(200) NOT NULL,
    "event_duration" INTEGER NOT NULL,
    "event_type" "EventType" NOT NULL DEFAULT 'MEETING',
    "location_type" "LocationType" NOT NULL DEFAULT 'VIDEO_CALL',
    "location_details" VARCHAR(500),
    "conference_type" VARCHAR(50),
    "schedule_id" UUID NOT NULL,
    "color" VARCHAR(20),
    "custom_questions" JSONB,
    "confirmation_email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_minutes" INTEGER[] DEFAULT ARRAY[1440, 60]::INTEGER[],
    "max_bookings_per_day" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "booking_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "booking_link_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "booker_name" VARCHAR(200) NOT NULL,
    "booker_email" VARCHAR(255) NOT NULL,
    "booker_phone" VARCHAR(50),
    "booker_timezone" VARCHAR(50) NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "custom_answers" JSONB,
    "notes" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" VARCHAR(20),
    "cancellation_reason" TEXT,
    "rescheduled_from" UUID,
    "rescheduled_to" UUID,
    "calendar_event_id" UUID,
    "meeting_url" VARCHAR(1000),
    "client_id" UUID,
    "confirmation_sent_at" TIMESTAMP(3),
    "reminders_sent_at" TIMESTAMP(3)[],
    "cancellation_token" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "account_type" "FinancialAccountType" NOT NULL,
    "is_connected" BOOLEAN NOT NULL DEFAULT false,
    "plaid_item_id" VARCHAR(255),
    "plaid_account_id" VARCHAR(255),
    "plaid_access_token" TEXT,
    "institution_name" VARCHAR(255),
    "institution_logo" VARCHAR(500),
    "account_number" VARCHAR(20),
    "current_balance" DECIMAL(14,2),
    "available_balance" DECIMAL(14,2),
    "balance_updated_at" TIMESTAMP(3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMP(3),
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "sync_error" TEXT,
    "auto_import_transactions" BOOLEAN NOT NULL DEFAULT true,
    "default_category" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "account_id" UUID,
    "type" "FinancialTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "original_amount" DECIMAL(14,2),
    "original_currency" VARCHAR(3),
    "exchange_rate" DECIMAL(10,6),
    "date" DATE NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "notes" TEXT,
    "category" VARCHAR(100) NOT NULL,
    "subcategory" VARCHAR(100),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "FinancialTransactionSource" NOT NULL DEFAULT 'MANUAL',
    "market_payment_id" UUID,
    "market_invoice_id" UUID,
    "invoice_id" UUID,
    "plaid_transaction_id" VARCHAR(255),
    "client_id" UUID,
    "project_id" UUID,
    "payment_method" VARCHAR(50),
    "vendor" VARCHAR(255),
    "is_deductible" BOOLEAN NOT NULL DEFAULT true,
    "deduction_category" VARCHAR(50),
    "has_receipt" BOOLEAN NOT NULL DEFAULT false,
    "receipt_url" VARCHAR(500),
    "receipt_file_name" VARCHAR(255),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_rule_id" UUID,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciled_at" TIMESTAMP(3),
    "tax_year" INTEGER,
    "included_in_tax_report" BOOLEAN NOT NULL DEFAULT false,
    "status" "FinancialTransactionStatus" NOT NULL DEFAULT 'CONFIRMED',
    "is_pending" BOOLEAN NOT NULL DEFAULT false,
    "is_split" BOOLEAN NOT NULL DEFAULT false,
    "parent_transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "description" VARCHAR(500) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "subcategory" VARCHAR(100),
    "vendor" VARCHAR(255),
    "is_deductible" BOOLEAN NOT NULL DEFAULT true,
    "account_id" UUID,
    "client_id" UUID,
    "project_id" UUID,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "day_of_month" INTEGER,
    "day_of_week" INTEGER,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "next_occurrence" DATE,
    "occurrence_count" INTEGER NOT NULL DEFAULT 0,
    "max_occurrences" INTEGER,
    "last_occurrence" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "auto_create" BOOLEAN NOT NULL DEFAULT true,
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "parent_id" UUID,
    "icon" VARCHAR(50),
    "color" VARCHAR(20),
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "irs_category" VARCHAR(50),
    "is_deductible" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_goals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "goal_type" "FinancialGoalType" NOT NULL,
    "target_amount" DECIMAL(14,2) NOT NULL,
    "current_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "period_type" "FinancialPeriodType",
    "start_date" DATE,
    "end_date" DATE,
    "category_filter" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "FinancialGoalStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "achieved_at" TIMESTAMP(3),
    "notify_at_percent" INTEGER[] DEFAULT ARRAY[50, 75, 90, 100]::INTEGER[],
    "notified_percents" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mileage_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "purpose" "MileagePurpose" NOT NULL,
    "miles" DECIMAL(8,2) NOT NULL,
    "rate_per_mile" DECIMAL(6,4) NOT NULL,
    "deduction_amount" DECIMAL(10,2) NOT NULL,
    "start_location" VARCHAR(255),
    "end_location" VARCHAR(255),
    "round_trip" BOOLEAN NOT NULL DEFAULT false,
    "client_id" UUID,
    "project_id" UUID,
    "vehicle_id" UUID,
    "tax_year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mileage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "business_type" "BusinessType" NOT NULL,
    "business_name" VARCHAR(255),
    "ein" VARCHAR(255),
    "filing_status" "FilingStatus" NOT NULL,
    "estimated_tax_rate" DECIMAL(5,2),
    "quarterly_payments" BOOLEAN NOT NULL DEFAULT true,
    "state_of_residence" VARCHAR(2),
    "state_income_tax_rate" DECIMAL(5,2),
    "fiscal_year_end" VARCHAR(5) NOT NULL DEFAULT '12-31',
    "accounting_method" "AccountingMethod" NOT NULL DEFAULT 'CASH',
    "has_home_office" BOOLEAN NOT NULL DEFAULT false,
    "home_office_square_feet" INTEGER,
    "total_home_square_feet" INTEGER,
    "has_business_vehicle" BOOLEAN NOT NULL DEFAULT false,
    "vehicle_info" JSONB,
    "mileage_rates" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "payment_date" DATE NOT NULL,
    "payment_method" "InvoicePaymentMethod" NOT NULL,
    "transaction_id" VARCHAR(255),
    "stripe_payment_id" VARCHAR(255),
    "paypal_transaction_id" VARCHAR(255),
    "notes" TEXT,
    "status" "InvoicePaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "is_refund" BOOLEAN NOT NULL DEFAULT false,
    "refunded_payment_id" UUID,
    "refund_reason" TEXT,
    "financial_transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "freelancer_user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "logo_url" VARCHAR(500),
    "accent_color" VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    "font_family" VARCHAR(50) NOT NULL DEFAULT 'Inter',
    "layout" "TemplateLayout" NOT NULL DEFAULT 'CLASSIC',
    "show_logo" BOOLEAN NOT NULL DEFAULT true,
    "show_payment_qr" BOOLEAN NOT NULL DEFAULT false,
    "business_name" VARCHAR(200),
    "business_address" JSONB,
    "business_email" VARCHAR(255),
    "business_phone" VARCHAR(50),
    "business_website" VARCHAR(255),
    "tax_number" VARCHAR(100),
    "default_notes" TEXT,
    "default_terms" TEXT,
    "default_footer" TEXT,
    "payment_instructions" TEXT,
    "default_due_days" INTEGER NOT NULL DEFAULT 30,
    "default_tax_rate" DECIMAL(5,2),
    "default_tax_label" VARCHAR(50),
    "default_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "default_late_fee" JSONB,
    "accepted_payment_methods" TEXT[] DEFAULT ARRAY['bank_transfer']::TEXT[],
    "stripe_enabled" BOOLEAN NOT NULL DEFAULT false,
    "paypal_enabled" BOOLEAN NOT NULL DEFAULT false,
    "custom_css" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_invoices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "freelancer_user_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "template_id" UUID,
    "line_items" JSONB NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax_rate" DECIMAL(5,2),
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "day_of_month" INTEGER,
    "day_of_week" INTEGER,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "next_invoice_date" DATE,
    "last_invoice_date" DATE,
    "invoice_count" INTEGER NOT NULL DEFAULT 0,
    "max_invoices" INTEGER,
    "due_days" INTEGER NOT NULL DEFAULT 30,
    "auto_send" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "project_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_activities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "invoice_id" UUID NOT NULL,
    "activity_type" "InvoiceActivityType" NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "actor_type" VARCHAR(50) NOT NULL,
    "actor_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "invoice_prefix" VARCHAR(20) NOT NULL DEFAULT 'INV',
    "next_invoice_number" INTEGER NOT NULL DEFAULT 1,
    "number_padding" INTEGER NOT NULL DEFAULT 4,
    "number_format" VARCHAR(100) NOT NULL DEFAULT '{prefix}-{year}{number}',
    "default_due_days" INTEGER NOT NULL DEFAULT 30,
    "default_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "default_template_id" UUID,
    "default_tax_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_tax_rate" DECIMAL(5,2),
    "default_tax_label" VARCHAR(50),
    "tax_number" VARCHAR(100),
    "default_late_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_late_fee_type" "LateFeeType",
    "default_late_fee_value" DECIMAL(10,2),
    "late_fee_grace_days" INTEGER NOT NULL DEFAULT 0,
    "auto_reminders" BOOLEAN NOT NULL DEFAULT true,
    "reminder_days" INTEGER[] DEFAULT ARRAY[7, 3, 1, 0, -3, -7]::INTEGER[],
    "stripe_account_id" VARCHAR(255),
    "paypal_email" VARCHAR(255),
    "bank_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "provider_account_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "token_type" TEXT,
    "scope" TEXT,
    "api_key" TEXT,
    "api_secret" TEXT,
    "webhook_secret" TEXT,
    "webhook_url" TEXT,
    "account_email" TEXT,
    "account_name" TEXT,
    "account_avatar" TEXT,
    "metadata" JSONB,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_frequency" "SyncFrequency" NOT NULL DEFAULT 'HOURLY',
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" "IntegrationSyncStatus",
    "last_sync_error" TEXT,
    "next_sync_at" TIMESTAMP(3),
    "sync_options" JSONB,
    "rate_limit_remaining" INTEGER,
    "rate_limit_reset_at" TIMESTAMP(3),
    "consecutive_errors" INTEGER NOT NULL DEFAULT 0,
    "last_error_at" TIMESTAMP(3),
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "paused_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_mappings" (
    "id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "entity_type" "MappingEntityType" NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_type" TEXT,
    "external_name" TEXT,
    "external_data" JSONB,
    "internal_id" UUID NOT NULL,
    "internal_type" TEXT NOT NULL,
    "sync_direction" "IntegrationSyncDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
    "last_sync_at" TIMESTAMP(3),
    "last_sync_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_sync_logs" (
    "id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "sync_type" "IntegrationSyncType" NOT NULL,
    "entity_type" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "status" "IntegrationSyncStatus" NOT NULL,
    "items_processed" INTEGER NOT NULL DEFAULT 0,
    "items_created" INTEGER NOT NULL DEFAULT 0,
    "items_updated" INTEGER NOT NULL DEFAULT 0,
    "items_deleted" INTEGER NOT NULL DEFAULT 0,
    "items_failed" INTEGER NOT NULL DEFAULT 0,
    "cursor" TEXT,
    "error_message" TEXT,
    "error_details" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "integration_id" UUID,
    "provider" "IntegrationProvider" NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_id" TEXT,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
    "processed_at" TIMESTAMP(3),
    "processing_error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "signature_valid" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_templates" (
    "id" UUID NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "IntegrationCategory" NOT NULL,
    "logo_url" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "capabilities" TEXT[],
    "auth_type" "IntegrationAuthType" NOT NULL,
    "oauth_config" JSONB,
    "api_key_config" JSONB,
    "sync_options_schema" JSONB,
    "setup_instructions" TEXT,
    "help_url" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_beta" BOOLEAN NOT NULL DEFAULT false,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verified_credentials" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "freelancer_profile_id" UUID,
    "source_credential_id" TEXT NOT NULL,
    "source" "CredentialSource" NOT NULL DEFAULT 'SKILLPOD',
    "credential_type" "CredentialType" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "skill_ids" TEXT[],
    "issue_date" TIMESTAMP(3) NOT NULL,
    "expiration_date" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL,
    "score" DECIMAL(5,2),
    "percentile" DECIMAL(5,2),
    "proficiency_level" "ProficiencyLevel",
    "verification_url" VARCHAR(1000) NOT NULL,
    "verification_code" VARCHAR(100) NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT true,
    "last_verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "image_url" VARCHAR(500),
    "badge_url" VARCHAR(500),
    "metadata" JSONB,
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verified_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_verifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "verification_type" "VerificationType" NOT NULL,
    "credential_id" UUID,
    "score" DECIMAL(5,2) NOT NULL,
    "max_score" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "percentile" DECIMAL(5,2),
    "proficiency_level" "ProficiencyLevel" NOT NULL,
    "confidence_score" DECIMAL(5,2) NOT NULL,
    "confidence_factors" JSONB NOT NULL,
    "proctored" BOOLEAN NOT NULL DEFAULT false,
    "assessment_duration" INTEGER,
    "question_breakdown" JSONB,
    "verified_at" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "show_on_profile" BOOLEAN NOT NULL DEFAULT true,
    "show_score" BOOLEAN NOT NULL DEFAULT true,
    "show_percentile" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_confidences" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "overall_confidence" DECIMAL(5,2) NOT NULL,
    "assessment_score" DECIMAL(5,2),
    "learning_score" DECIMAL(5,2),
    "experience_score" DECIMAL(5,2),
    "endorsement_score" DECIMAL(5,2),
    "project_score" DECIMAL(5,2),
    "assessments_passed" INTEGER NOT NULL DEFAULT 0,
    "courses_completed" INTEGER NOT NULL DEFAULT 0,
    "hours_learned" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "projects_completed" INTEGER NOT NULL DEFAULT 0,
    "endorsement_count" INTEGER NOT NULL DEFAULT 0,
    "years_experience" DECIMAL(4,1),
    "calculated_level" "ProficiencyLevel" NOT NULL,
    "claimed_level" "ProficiencyLevel",
    "level_match" BOOLEAN NOT NULL,
    "confidence_trend" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "last_activity_date" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_confidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_activities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "total_hours_learned" DECIMAL(10,2) NOT NULL,
    "total_courses" INTEGER NOT NULL,
    "completed_courses" INTEGER NOT NULL,
    "total_assessments" INTEGER NOT NULL,
    "passed_assessments" INTEGER NOT NULL,
    "total_credentials" INTEGER NOT NULL,
    "active_credentials" INTEGER NOT NULL,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_learning_date" TIMESTAMP(3),
    "hours_last_30_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "hours_last_90_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "hours_last_365_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "show_on_profile" BOOLEAN NOT NULL DEFAULT true,
    "show_hours" BOOLEAN NOT NULL DEFAULT true,
    "show_streak" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_learning_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "currentRole" TEXT,
    "targetRole" TEXT,
    "experienceLevel" "ProficiencyLevel" NOT NULL DEFAULT 'INTERMEDIATE',
    "yearsOfExperience" INTEGER NOT NULL DEFAULT 0,
    "primaryIndustry" TEXT,
    "targetIndustries" TEXT[],
    "preferredContentTypes" "ContentType"[],
    "preferredLearningStyle" "LearningStyle" NOT NULL DEFAULT 'SELF_PACED',
    "weeklyLearningHours" INTEGER NOT NULL DEFAULT 5,
    "preferredSessionLength" INTEGER NOT NULL DEFAULT 30,
    "preferredDifficulty" "DifficultyPreference" NOT NULL DEFAULT 'PROGRESSIVE',
    "careerGoals" TEXT[],
    "focusSkillIds" UUID[],
    "excludedSkillIds" UUID[],
    "priorityCategories" TEXT[],
    "learningVelocity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "lastActiveAt" TIMESTAMP(3),
    "skillVector" JSONB,
    "interestVector" JSONB,
    "learningPatternVector" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_learning_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_gaps" (
    "id" UUID NOT NULL,
    "learningProfileId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "gapType" "GapType" NOT NULL,
    "currentLevel" "ProficiencyLevel",
    "requiredLevel" "ProficiencyLevel" NOT NULL,
    "gapScore" DOUBLE PRECISION NOT NULL,
    "marketDemandScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "salaryImpact" DOUBLE PRECISION,
    "competitionLevel" "CompetitionLevel" NOT NULL DEFAULT 'MEDIUM',
    "jobFrequency" INTEGER NOT NULL DEFAULT 0,
    "priority" "GapPriority" NOT NULL DEFAULT 'MEDIUM',
    "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" "GapStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceEventIds" UUID[],
    "detectionMethod" TEXT NOT NULL,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_activity_signals" (
    "id" UUID NOT NULL,
    "learningProfileId" UUID NOT NULL,
    "signalType" "SignalType" NOT NULL,
    "signalSource" TEXT NOT NULL,
    "signalStrength" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sourceId" UUID,
    "sourceType" TEXT,
    "skillIds" UUID[],
    "requiredLevels" JSONB,
    "contextData" JSONB,
    "skillGapIndicators" JSONB,
    "competitorInsights" JSONB,
    "marketTrendData" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "processingResult" JSONB,
    "expiresAt" TIMESTAMP(3),
    "decayFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_activity_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_recommendations" (
    "id" UUID NOT NULL,
    "learningProfileId" UUID NOT NULL,
    "recommendationType" "LearningRecommendationType" NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "contentId" UUID,
    "contentSource" TEXT NOT NULL,
    "contentUrl" TEXT,
    "contentProvider" TEXT,
    "primarySkillId" UUID,
    "relatedSkillIds" UUID[],
    "targetLevel" "ProficiencyLevel",
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "urgencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "impactScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "generationMethod" TEXT NOT NULL,
    "generationModel" TEXT,
    "triggerEventId" UUID,
    "skillGapId" UUID,
    "reasoningExplanation" TEXT,
    "estimatedDuration" INTEGER,
    "estimatedDifficulty" "ProficiencyLevel",
    "prerequisites" UUID[],
    "status" "LearningRecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "viewedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "dismissReason" TEXT,
    "userFeedback" INTEGER,
    "userFeedbackText" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_learning_paths" (
    "id" UUID NOT NULL,
    "learningProfileId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pathType" "LearningPathType" NOT NULL,
    "targetRole" TEXT,
    "targetSkillIds" UUID[],
    "targetLevels" JSONB,
    "estimatedCareerImpact" TEXT,
    "generatedBy" "LearningPathGenerationSource" NOT NULL,
    "generationContext" JSONB,
    "milestones" JSONB NOT NULL,
    "totalDuration" INTEGER,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "status" "LearningPathStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentMilestoneIndex" INTEGER NOT NULL DEFAULT 0,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "progressPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "lastActivityAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "userNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_trends" (
    "id" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "trendPeriod" "TrendPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "demandScore" DOUBLE PRECISION NOT NULL,
    "demandDirection" "TrendDirection" NOT NULL,
    "demandChangePercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "jobPostingCount" INTEGER NOT NULL DEFAULT 0,
    "applicationCount" INTEGER NOT NULL DEFAULT 0,
    "averageRate" DOUBLE PRECISION,
    "rateDirection" "TrendDirection",
    "rateChangePercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ratePercentile25" DOUBLE PRECISION,
    "ratePercentile50" DOUBLE PRECISION,
    "ratePercentile75" DOUBLE PRECISION,
    "competitionLevel" "CompetitionLevel" NOT NULL DEFAULT 'MEDIUM',
    "freelancerSupply" INTEGER NOT NULL DEFAULT 0,
    "supplyDemandRatio" DOUBLE PRECISION,
    "region" TEXT,
    "topLocations" TEXT[],
    "industry" TEXT,
    "topIndustries" TEXT[],
    "emergingCombinations" UUID[],
    "decliningCombinations" UUID[],
    "predictedDemand6Mo" DOUBLE PRECISION,
    "predictedDemand12Mo" DOUBLE PRECISION,
    "predictionConfidence" DOUBLE PRECISION,
    "dataPoints" INTEGER NOT NULL DEFAULT 0,
    "dataSources" TEXT[],
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_trends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_billing_invoices_number_key" ON "tenant_billing_invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_billing_invoices_stripe_invoice_id_key" ON "tenant_billing_invoices"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "tenant_billing_invoices_tenant_id_idx" ON "tenant_billing_invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_billing_invoices_status_idx" ON "tenant_billing_invoices"("status");

-- CreateIndex
CREATE INDEX "tenant_billing_invoices_number_idx" ON "tenant_billing_invoices"("number");

-- CreateIndex
CREATE INDEX "contract_invoice_line_items_invoice_id_idx" ON "contract_invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "contract_invoice_line_items_type_idx" ON "contract_invoice_line_items"("type");

-- CreateIndex
CREATE UNIQUE INDEX "cockpit_projects_market_contract_id_key" ON "cockpit_projects"("market_contract_id");

-- CreateIndex
CREATE INDEX "cockpit_projects_freelancer_user_id_idx" ON "cockpit_projects"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "cockpit_projects_client_id_idx" ON "cockpit_projects"("client_id");

-- CreateIndex
CREATE INDEX "cockpit_projects_status_idx" ON "cockpit_projects"("status");

-- CreateIndex
CREATE INDEX "cockpit_projects_due_date_idx" ON "cockpit_projects"("due_date");

-- CreateIndex
CREATE INDEX "cockpit_projects_is_archived_idx" ON "cockpit_projects"("is_archived");

-- CreateIndex
CREATE INDEX "cockpit_projects_is_favorite_idx" ON "cockpit_projects"("is_favorite");

-- CreateIndex
CREATE INDEX "cockpit_projects_market_contract_id_idx" ON "cockpit_projects"("market_contract_id");

-- CreateIndex
CREATE INDEX "project_tasks_project_id_idx" ON "project_tasks"("project_id");

-- CreateIndex
CREATE INDEX "project_tasks_parent_task_id_idx" ON "project_tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "project_tasks_status_idx" ON "project_tasks"("status");

-- CreateIndex
CREATE INDEX "project_tasks_due_date_idx" ON "project_tasks"("due_date");

-- CreateIndex
CREATE INDEX "project_tasks_milestone_id_idx" ON "project_tasks"("milestone_id");

-- CreateIndex
CREATE INDEX "project_tasks_order_index_idx" ON "project_tasks"("order_index");

-- CreateIndex
CREATE INDEX "project_milestones_project_id_idx" ON "project_milestones"("project_id");

-- CreateIndex
CREATE INDEX "project_milestones_status_idx" ON "project_milestones"("status");

-- CreateIndex
CREATE INDEX "project_milestones_due_date_idx" ON "project_milestones"("due_date");

-- CreateIndex
CREATE INDEX "project_milestones_market_milestone_id_idx" ON "project_milestones"("market_milestone_id");

-- CreateIndex
CREATE UNIQUE INDEX "cockpit_time_entries_market_time_entry_id_key" ON "cockpit_time_entries"("market_time_entry_id");

-- CreateIndex
CREATE INDEX "cockpit_time_entries_freelancer_user_id_idx" ON "cockpit_time_entries"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "cockpit_time_entries_project_id_idx" ON "cockpit_time_entries"("project_id");

-- CreateIndex
CREATE INDEX "cockpit_time_entries_task_id_idx" ON "cockpit_time_entries"("task_id");

-- CreateIndex
CREATE INDEX "cockpit_time_entries_client_id_idx" ON "cockpit_time_entries"("client_id");

-- CreateIndex
CREATE INDEX "cockpit_time_entries_date_idx" ON "cockpit_time_entries"("date");

-- CreateIndex
CREATE INDEX "cockpit_time_entries_market_contract_id_idx" ON "cockpit_time_entries"("market_contract_id");

-- CreateIndex
CREATE INDEX "cockpit_time_entries_is_invoiced_idx" ON "cockpit_time_entries"("is_invoiced");

-- CreateIndex
CREATE INDEX "cockpit_time_entries_is_billable_idx" ON "cockpit_time_entries"("is_billable");

-- CreateIndex
CREATE INDEX "cockpit_time_entries_source_idx" ON "cockpit_time_entries"("source");

-- CreateIndex
CREATE INDEX "project_files_project_id_idx" ON "project_files"("project_id");

-- CreateIndex
CREATE INDEX "project_files_file_type_idx" ON "project_files"("file_type");

-- CreateIndex
CREATE INDEX "project_files_folder_idx" ON "project_files"("folder");

-- CreateIndex
CREATE INDEX "project_activities_project_id_idx" ON "project_activities"("project_id");

-- CreateIndex
CREATE INDEX "project_activities_created_at_idx" ON "project_activities"("created_at");

-- CreateIndex
CREATE INDEX "project_activities_activity_type_idx" ON "project_activities"("activity_type");

-- CreateIndex
CREATE INDEX "project_templates_freelancer_user_id_idx" ON "project_templates"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "project_templates_category_idx" ON "project_templates"("category");

-- CreateIndex
CREATE UNIQUE INDEX "time_tracking_settings_user_id_key" ON "time_tracking_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "active_timers_user_id_key" ON "active_timers"("user_id");

-- CreateIndex
CREATE INDEX "active_timers_user_id_idx" ON "active_timers"("user_id");

-- CreateIndex
CREATE INDEX "active_timers_project_id_idx" ON "active_timers"("project_id");

-- CreateIndex
CREATE INDEX "active_timers_status_idx" ON "active_timers"("status");

-- CreateIndex
CREATE INDEX "timesheets_freelancer_user_id_idx" ON "timesheets"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "timesheets_status_idx" ON "timesheets"("status");

-- CreateIndex
CREATE INDEX "timesheets_week_start_date_idx" ON "timesheets"("week_start_date");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_freelancer_user_id_week_start_date_key" ON "timesheets"("freelancer_user_id", "week_start_date");

-- CreateIndex
CREATE INDEX "time_categories_freelancer_user_id_idx" ON "time_categories"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "time_categories_is_active_idx" ON "time_categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "time_categories_freelancer_user_id_name_key" ON "time_categories"("freelancer_user_id", "name");

-- CreateIndex
CREATE INDEX "calendar_connections_user_id_idx" ON "calendar_connections"("user_id");

-- CreateIndex
CREATE INDEX "calendar_connections_sync_status_idx" ON "calendar_connections"("sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_user_id_provider_provider_account_id_key" ON "calendar_connections"("user_id", "provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "external_calendars_connection_id_idx" ON "external_calendars"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_calendars_connection_id_external_id_key" ON "external_calendars"("connection_id", "external_id");

-- CreateIndex
CREATE INDEX "calendar_events_user_id_idx" ON "calendar_events"("user_id");

-- CreateIndex
CREATE INDEX "calendar_events_start_time_idx" ON "calendar_events"("start_time");

-- CreateIndex
CREATE INDEX "calendar_events_end_time_idx" ON "calendar_events"("end_time");

-- CreateIndex
CREATE INDEX "calendar_events_project_id_idx" ON "calendar_events"("project_id");

-- CreateIndex
CREATE INDEX "calendar_events_client_id_idx" ON "calendar_events"("client_id");

-- CreateIndex
CREATE INDEX "calendar_events_deleted_at_idx" ON "calendar_events"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_external_calendar_id_external_event_id_key" ON "calendar_events"("external_calendar_id", "external_event_id");

-- CreateIndex
CREATE INDEX "availability_schedules_user_id_idx" ON "availability_schedules"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_links_slug_key" ON "booking_links"("slug");

-- CreateIndex
CREATE INDEX "booking_links_user_id_idx" ON "booking_links"("user_id");

-- CreateIndex
CREATE INDEX "booking_links_slug_idx" ON "booking_links"("slug");

-- CreateIndex
CREATE INDEX "booking_links_is_active_idx" ON "booking_links"("is_active");

-- CreateIndex
CREATE INDEX "bookings_booking_link_id_idx" ON "bookings"("booking_link_id");

-- CreateIndex
CREATE INDEX "bookings_user_id_idx" ON "bookings"("user_id");

-- CreateIndex
CREATE INDEX "bookings_start_time_idx" ON "bookings"("start_time");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_cancellation_token_idx" ON "bookings"("cancellation_token");

-- CreateIndex
CREATE INDEX "financial_accounts_user_id_idx" ON "financial_accounts"("user_id");

-- CreateIndex
CREATE INDEX "financial_accounts_plaid_item_id_idx" ON "financial_accounts"("plaid_item_id");

-- CreateIndex
CREATE INDEX "financial_accounts_is_active_idx" ON "financial_accounts"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_market_payment_id_key" ON "financial_transactions"("market_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_plaid_transaction_id_key" ON "financial_transactions"("plaid_transaction_id");

-- CreateIndex
CREATE INDEX "financial_transactions_user_id_idx" ON "financial_transactions"("user_id");

-- CreateIndex
CREATE INDEX "financial_transactions_account_id_idx" ON "financial_transactions"("account_id");

-- CreateIndex
CREATE INDEX "financial_transactions_type_idx" ON "financial_transactions"("type");

-- CreateIndex
CREATE INDEX "financial_transactions_date_idx" ON "financial_transactions"("date");

-- CreateIndex
CREATE INDEX "financial_transactions_category_idx" ON "financial_transactions"("category");

-- CreateIndex
CREATE INDEX "financial_transactions_client_id_idx" ON "financial_transactions"("client_id");

-- CreateIndex
CREATE INDEX "financial_transactions_project_id_idx" ON "financial_transactions"("project_id");

-- CreateIndex
CREATE INDEX "financial_transactions_tax_year_idx" ON "financial_transactions"("tax_year");

-- CreateIndex
CREATE INDEX "financial_transactions_status_idx" ON "financial_transactions"("status");

-- CreateIndex
CREATE INDEX "financial_transactions_is_reconciled_idx" ON "financial_transactions"("is_reconciled");

-- CreateIndex
CREATE INDEX "recurring_transactions_user_id_idx" ON "recurring_transactions"("user_id");

-- CreateIndex
CREATE INDEX "recurring_transactions_next_occurrence_idx" ON "recurring_transactions"("next_occurrence");

-- CreateIndex
CREATE INDEX "recurring_transactions_is_active_idx" ON "recurring_transactions"("is_active");

-- CreateIndex
CREATE INDEX "transaction_categories_user_id_idx" ON "transaction_categories"("user_id");

-- CreateIndex
CREATE INDEX "transaction_categories_type_idx" ON "transaction_categories"("type");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_categories_user_id_name_type_key" ON "transaction_categories"("user_id", "name", "type");

-- CreateIndex
CREATE INDEX "financial_goals_user_id_idx" ON "financial_goals"("user_id");

-- CreateIndex
CREATE INDEX "financial_goals_goal_type_idx" ON "financial_goals"("goal_type");

-- CreateIndex
CREATE INDEX "financial_goals_status_idx" ON "financial_goals"("status");

-- CreateIndex
CREATE INDEX "mileage_logs_user_id_idx" ON "mileage_logs"("user_id");

-- CreateIndex
CREATE INDEX "mileage_logs_date_idx" ON "mileage_logs"("date");

-- CreateIndex
CREATE INDEX "mileage_logs_tax_year_idx" ON "mileage_logs"("tax_year");

-- CreateIndex
CREATE INDEX "mileage_logs_client_id_idx" ON "mileage_logs"("client_id");

-- CreateIndex
CREATE INDEX "mileage_logs_project_id_idx" ON "mileage_logs"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_profiles_user_id_key" ON "tax_profiles"("user_id");

-- CreateIndex
CREATE INDEX "invoice_payments_invoice_id_idx" ON "invoice_payments"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_payments_payment_date_idx" ON "invoice_payments"("payment_date");

-- CreateIndex
CREATE INDEX "invoice_templates_freelancer_user_id_idx" ON "invoice_templates"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "recurring_invoices_freelancer_user_id_idx" ON "recurring_invoices"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "recurring_invoices_client_id_idx" ON "recurring_invoices"("client_id");

-- CreateIndex
CREATE INDEX "recurring_invoices_next_invoice_date_idx" ON "recurring_invoices"("next_invoice_date");

-- CreateIndex
CREATE INDEX "recurring_invoices_is_active_idx" ON "recurring_invoices"("is_active");

-- CreateIndex
CREATE INDEX "invoice_activities_invoice_id_idx" ON "invoice_activities"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_activities_created_at_idx" ON "invoice_activities"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_settings_user_id_key" ON "invoice_settings"("user_id");

-- CreateIndex
CREATE INDEX "integrations_user_id_idx" ON "integrations"("user_id");

-- CreateIndex
CREATE INDEX "integrations_provider_idx" ON "integrations"("provider");

-- CreateIndex
CREATE INDEX "integrations_status_idx" ON "integrations"("status");

-- CreateIndex
CREATE INDEX "integrations_next_sync_at_idx" ON "integrations"("next_sync_at");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_user_id_provider_provider_account_id_key" ON "integrations"("user_id", "provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "integration_mappings_integration_id_idx" ON "integration_mappings"("integration_id");

-- CreateIndex
CREATE INDEX "integration_mappings_internal_id_idx" ON "integration_mappings"("internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_mappings_integration_id_entity_type_external_id_key" ON "integration_mappings"("integration_id", "entity_type", "external_id");

-- CreateIndex
CREATE INDEX "integration_sync_logs_integration_id_idx" ON "integration_sync_logs"("integration_id");

-- CreateIndex
CREATE INDEX "integration_sync_logs_started_at_idx" ON "integration_sync_logs"("started_at");

-- CreateIndex
CREATE INDEX "integration_sync_logs_status_idx" ON "integration_sync_logs"("status");

-- CreateIndex
CREATE INDEX "webhook_events_integration_id_idx" ON "webhook_events"("integration_id");

-- CreateIndex
CREATE INDEX "webhook_events_provider_idx" ON "webhook_events"("provider");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- CreateIndex
CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_templates_provider_key" ON "integration_templates"("provider");

-- CreateIndex
CREATE INDEX "verified_credentials_user_id_idx" ON "verified_credentials"("user_id");

-- CreateIndex
CREATE INDEX "verified_credentials_freelancer_profile_id_idx" ON "verified_credentials"("freelancer_profile_id");

-- CreateIndex
CREATE INDEX "verified_credentials_status_idx" ON "verified_credentials"("status");

-- CreateIndex
CREATE INDEX "verified_credentials_credential_type_idx" ON "verified_credentials"("credential_type");

-- CreateIndex
CREATE UNIQUE INDEX "verified_credentials_user_id_source_credential_id_key" ON "verified_credentials"("user_id", "source_credential_id");

-- CreateIndex
CREATE INDEX "skill_verifications_user_id_idx" ON "skill_verifications"("user_id");

-- CreateIndex
CREATE INDEX "skill_verifications_skill_id_idx" ON "skill_verifications"("skill_id");

-- CreateIndex
CREATE INDEX "skill_verifications_proficiency_level_idx" ON "skill_verifications"("proficiency_level");

-- CreateIndex
CREATE INDEX "skill_verifications_is_active_idx" ON "skill_verifications"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "skill_verifications_user_id_skill_id_verification_type_key" ON "skill_verifications"("user_id", "skill_id", "verification_type");

-- CreateIndex
CREATE INDEX "skill_confidences_user_id_idx" ON "skill_confidences"("user_id");

-- CreateIndex
CREATE INDEX "skill_confidences_overall_confidence_idx" ON "skill_confidences"("overall_confidence");

-- CreateIndex
CREATE INDEX "skill_confidences_calculated_level_idx" ON "skill_confidences"("calculated_level");

-- CreateIndex
CREATE UNIQUE INDEX "skill_confidences_user_id_skill_id_key" ON "skill_confidences"("user_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_activities_user_id_key" ON "learning_activities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_learning_profiles_userId_key" ON "user_learning_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_learning_profiles_userId_idx" ON "user_learning_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_learning_profiles_lastActiveAt_idx" ON "user_learning_profiles"("lastActiveAt");

-- CreateIndex
CREATE INDEX "user_learning_profiles_experienceLevel_idx" ON "user_learning_profiles"("experienceLevel");

-- CreateIndex
CREATE INDEX "skill_gaps_learningProfileId_idx" ON "skill_gaps"("learningProfileId");

-- CreateIndex
CREATE INDEX "skill_gaps_skillId_idx" ON "skill_gaps"("skillId");

-- CreateIndex
CREATE INDEX "skill_gaps_priority_idx" ON "skill_gaps"("priority");

-- CreateIndex
CREATE INDEX "skill_gaps_status_idx" ON "skill_gaps"("status");

-- CreateIndex
CREATE INDEX "skill_gaps_marketDemandScore_idx" ON "skill_gaps"("marketDemandScore");

-- CreateIndex
CREATE UNIQUE INDEX "skill_gaps_learningProfileId_skillId_key" ON "skill_gaps"("learningProfileId", "skillId");

-- CreateIndex
CREATE INDEX "market_activity_signals_learningProfileId_idx" ON "market_activity_signals"("learningProfileId");

-- CreateIndex
CREATE INDEX "market_activity_signals_signalType_idx" ON "market_activity_signals"("signalType");

-- CreateIndex
CREATE INDEX "market_activity_signals_processed_idx" ON "market_activity_signals"("processed");

-- CreateIndex
CREATE INDEX "market_activity_signals_createdAt_idx" ON "market_activity_signals"("createdAt");

-- CreateIndex
CREATE INDEX "market_activity_signals_expiresAt_idx" ON "market_activity_signals"("expiresAt");

-- CreateIndex
CREATE INDEX "learning_recommendations_learningProfileId_idx" ON "learning_recommendations"("learningProfileId");

-- CreateIndex
CREATE INDEX "learning_recommendations_status_idx" ON "learning_recommendations"("status");

-- CreateIndex
CREATE INDEX "learning_recommendations_recommendationType_idx" ON "learning_recommendations"("recommendationType");

-- CreateIndex
CREATE INDEX "learning_recommendations_overallScore_idx" ON "learning_recommendations"("overallScore");

-- CreateIndex
CREATE INDEX "learning_recommendations_createdAt_idx" ON "learning_recommendations"("createdAt");

-- CreateIndex
CREATE INDEX "learning_recommendations_expiresAt_idx" ON "learning_recommendations"("expiresAt");

-- CreateIndex
CREATE INDEX "user_learning_paths_learningProfileId_idx" ON "user_learning_paths"("learningProfileId");

-- CreateIndex
CREATE INDEX "user_learning_paths_status_idx" ON "user_learning_paths"("status");

-- CreateIndex
CREATE INDEX "user_learning_paths_pathType_idx" ON "user_learning_paths"("pathType");

-- CreateIndex
CREATE INDEX "user_learning_paths_createdAt_idx" ON "user_learning_paths"("createdAt");

-- CreateIndex
CREATE INDEX "market_trends_skillId_idx" ON "market_trends"("skillId");

-- CreateIndex
CREATE INDEX "market_trends_trendPeriod_idx" ON "market_trends"("trendPeriod");

-- CreateIndex
CREATE INDEX "market_trends_periodStart_idx" ON "market_trends"("periodStart");

-- CreateIndex
CREATE INDEX "market_trends_demandScore_idx" ON "market_trends"("demandScore");

-- CreateIndex
CREATE INDEX "market_trends_demandDirection_idx" ON "market_trends"("demandDirection");

-- CreateIndex
CREATE UNIQUE INDEX "market_trends_skillId_trendPeriod_periodStart_region_indust_key" ON "market_trends"("skillId", "trendPeriod", "periodStart", "region", "industry");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_view_token_key" ON "invoices"("view_token");

-- CreateIndex
CREATE INDEX "invoices_freelancer_user_id_idx" ON "invoices"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

-- CreateIndex
CREATE INDEX "invoices_project_id_idx" ON "invoices"("project_id");

-- CreateIndex
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE INDEX "invoices_issue_date_idx" ON "invoices"("issue_date");

-- CreateIndex
CREATE INDEX "invoices_view_token_idx" ON "invoices"("view_token");

-- CreateIndex
CREATE INDEX "invoices_invoice_number_idx" ON "invoices"("invoice_number");

-- AddForeignKey
ALTER TABLE "tenant_billing_invoices" ADD CONSTRAINT "tenant_billing_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_invoice_line_items" ADD CONSTRAINT "contract_invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "contract_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cockpit_projects" ADD CONSTRAINT "cockpit_projects_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cockpit_projects" ADD CONSTRAINT "cockpit_projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cockpit_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cockpit_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cockpit_time_entries" ADD CONSTRAINT "cockpit_time_entries_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cockpit_time_entries" ADD CONSTRAINT "cockpit_time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cockpit_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cockpit_time_entries" ADD CONSTRAINT "cockpit_time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cockpit_time_entries" ADD CONSTRAINT "cockpit_time_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cockpit_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cockpit_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_tracking_settings" ADD CONSTRAINT "time_tracking_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cockpit_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_categories" ADD CONSTRAINT "time_categories_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_calendars" ADD CONSTRAINT "external_calendars_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_external_calendar_id_fkey" FOREIGN KEY ("external_calendar_id") REFERENCES "external_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cockpit_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_schedules" ADD CONSTRAINT "availability_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "availability_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_link_id_fkey" FOREIGN KEY ("booking_link_id") REFERENCES "booking_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cockpit_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_parent_transaction_id_fkey" FOREIGN KEY ("parent_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_recurring_rule_id_fkey" FOREIGN KEY ("recurring_rule_id") REFERENCES "recurring_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_logs" ADD CONSTRAINT "mileage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_logs" ADD CONSTRAINT "mileage_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_logs" ADD CONSTRAINT "mileage_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cockpit_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_profiles" ADD CONSTRAINT "tax_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cockpit_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "invoice_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurring_schedule_id_fkey" FOREIGN KEY ("recurring_schedule_id") REFERENCES "recurring_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "invoice_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_activities" ADD CONSTRAINT "invoice_activities_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_settings" ADD CONSTRAINT "invoice_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_mappings" ADD CONSTRAINT "integration_mappings_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_sync_logs" ADD CONSTRAINT "integration_sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_credentials" ADD CONSTRAINT "verified_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_verifications" ADD CONSTRAINT "skill_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_verifications" ADD CONSTRAINT "skill_verifications_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_verifications" ADD CONSTRAINT "skill_verifications_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "verified_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_confidences" ADD CONSTRAINT "skill_confidences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_confidences" ADD CONSTRAINT "skill_confidences_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_activities" ADD CONSTRAINT "learning_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_learning_profiles" ADD CONSTRAINT "user_learning_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_gaps" ADD CONSTRAINT "skill_gaps_learningProfileId_fkey" FOREIGN KEY ("learningProfileId") REFERENCES "user_learning_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_gaps" ADD CONSTRAINT "skill_gaps_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_activity_signals" ADD CONSTRAINT "market_activity_signals_learningProfileId_fkey" FOREIGN KEY ("learningProfileId") REFERENCES "user_learning_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_recommendations" ADD CONSTRAINT "learning_recommendations_learningProfileId_fkey" FOREIGN KEY ("learningProfileId") REFERENCES "user_learning_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_recommendations" ADD CONSTRAINT "learning_recommendations_primarySkillId_fkey" FOREIGN KEY ("primarySkillId") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_recommendations" ADD CONSTRAINT "learning_recommendations_skillGapId_fkey" FOREIGN KEY ("skillGapId") REFERENCES "skill_gaps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_learning_paths" ADD CONSTRAINT "user_learning_paths_learningProfileId_fkey" FOREIGN KEY ("learningProfileId") REFERENCES "user_learning_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_trends" ADD CONSTRAINT "market_trends_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
