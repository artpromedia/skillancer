/*
  Warnings:

  - You are about to drop the column `oauth_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `oauth_provider` on the `users` table. All the data in the column will be lost.
  - Added the required column `family` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MfaRecoveryStatus" AS ENUM ('PENDING', 'VERIFIED', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('BASIC', 'GOVERNMENT_ID', 'ADDRESS', 'ENHANCED', 'PREMIUM');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'NEEDS_REVIEW', 'APPROVED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID', 'RESIDENCE_PERMIT', 'UTILITY_BILL', 'BANK_STATEMENT', 'TAX_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FreelancerAvailability" AS ENUM ('AVAILABLE', 'PARTIALLY', 'BUSY', 'NOT_AVAILABLE', 'ON_VACATION');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('SOLO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "HiringFrequency" AS ENUM ('ONE_TIME', 'OCCASIONAL', 'REGULAR', 'FREQUENT');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FIXED_PRICE', 'HOURLY', 'RETAINER', 'CONTRACT');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'APPLE');

-- CreateEnum
CREATE TYPE "SubscriptionProduct" AS ENUM ('SKILLPOD', 'COCKPIT');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAUSED');

-- CreateEnum
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "UsageAction" AS ENUM ('INCREMENT', 'SET');

-- DropIndex
DROP INDEX "users_oauth_provider_oauth_id_key";

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "family" VARCHAR(36) NOT NULL,
ADD COLUMN     "replaced_by" VARCHAR(500);

-- AlterTable
ALTER TABLE "user_mfa" ADD COLUMN     "enforced_at" TIMESTAMP(3),
ADD COLUMN     "enforced_by" VARCHAR(50),
ADD COLUMN     "phone_verified_at" TIMESTAMP(3),
ADD COLUMN     "recovery_email" VARCHAR(255),
ADD COLUMN     "recovery_email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remember_devices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "totp_verified_at" TIMESTAMP(3),
ADD COLUMN     "trusted_device_max_days" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "oauth_id",
DROP COLUMN "oauth_provider",
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email_verified_at" TIMESTAMP(3),
ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_login_ip" VARCHAR(45),
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "password_changed_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_expires" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" VARCHAR(255);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "device_fingerprint" VARCHAR(255) NOT NULL,
    "device_name" VARCHAR(100),
    "browser" VARCHAR(100),
    "os" VARCHAR(100),
    "ip_address" VARCHAR(45),
    "location" VARCHAR(200),
    "trusted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_recovery_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "status" "MfaRecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verification_method" VARCHAR(50),
    "verified_at" TIMESTAMP(3),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_inquiries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "persona_inquiry_id" VARCHAR(100) NOT NULL,
    "persona_template_id" VARCHAR(100) NOT NULL,
    "verification_type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verification_level" "VerificationLevel",
    "failure_reasons" TEXT[],
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "inquiry_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "document_country" VARCHAR(2) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMP(3),
    "document_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_verification_badges" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "level" "VerificationLevel" NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_on_profile" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_verification_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freelancer_profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_profile_id" UUID NOT NULL,
    "headline" VARCHAR(200),
    "specializations" TEXT[],
    "availability" "FreelancerAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "hours_per_week" INTEGER,
    "available_from" TIMESTAMP(3),
    "hourly_rate_min" DECIMAL(10,2),
    "hourly_rate_max" DECIMAL(10,2),
    "preferred_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "preferred_job_types" "JobType"[],
    "preferred_durations" TEXT[],
    "preferred_project_min" DECIMAL(10,2),
    "preferred_project_max" DECIMAL(10,2),
    "remote_only" BOOLEAN NOT NULL DEFAULT true,
    "willing_to_travel" BOOLEAN NOT NULL DEFAULT false,
    "travel_radius" INTEGER,
    "industries" TEXT[],
    "allow_direct_contact" BOOLEAN NOT NULL DEFAULT true,
    "response_time" VARCHAR(50),
    "total_projects" INTEGER NOT NULL DEFAULT 0,
    "completed_jobs" INTEGER NOT NULL DEFAULT 0,
    "total_earnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "avg_rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "repeat_client_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profile_views_count" INTEGER NOT NULL DEFAULT 0,
    "proposals_sent" INTEGER NOT NULL DEFAULT 0,
    "search_rank" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freelancer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_profile_id" UUID NOT NULL,
    "company_name" VARCHAR(200),
    "company_size" "CompanySize",
    "company_website" VARCHAR(500),
    "company_logo_url" VARCHAR(500),
    "industry" VARCHAR(100),
    "company_bio" TEXT,
    "typical_budget_min" DECIMAL(10,2),
    "typical_budget_max" DECIMAL(10,2),
    "preferred_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "typical_project_types" "JobType"[],
    "hiring_frequency" "HiringFrequency",
    "team_size" INTEGER,
    "has_hr_department" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "payment_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "payment_verified_at" TIMESTAMP(3),
    "total_jobs_posted" INTEGER NOT NULL DEFAULT 0,
    "total_hires" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "avg_rating_given" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "avg_project_duration" INTEGER NOT NULL DEFAULT 0,
    "rehire_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "last_job_posted_at" TIMESTAMP(3),
    "last_hire_at" TIMESTAMP(3),
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profile_views_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "token_type" VARCHAR(50),
    "scope" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "user_agent" VARCHAR(500),
    "ip_address" VARCHAR(45),
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "tenant_id" UUID,
    "stripe_subscription_id" VARCHAR(100) NOT NULL,
    "stripe_customer_id" VARCHAR(100) NOT NULL,
    "stripe_price_id" VARCHAR(100) NOT NULL,
    "stripe_product_id" VARCHAR(100),
    "product" "SubscriptionProduct" NOT NULL,
    "plan" VARCHAR(50) NOT NULL,
    "billing_interval" "BillingInterval" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "pending_plan" VARCHAR(50),
    "pending_price_id" VARCHAR(100),
    "pending_change_at" TIMESTAMP(3),
    "usage_this_period" INTEGER NOT NULL DEFAULT 0,
    "usage_limit" INTEGER,
    "unit_amount" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_invoices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "subscription_id" UUID NOT NULL,
    "stripe_invoice_id" VARCHAR(100) NOT NULL,
    "number" VARCHAR(100),
    "amount_due" INTEGER NOT NULL,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "amount_remaining" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "status" "SubscriptionInvoiceStatus" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "pdf_url" VARCHAR(500),
    "hosted_invoice_url" VARCHAR(500),
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_payment_attempt" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "subscription_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "action" "UsageAction" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "session_id" VARCHAR(100),
    "pod_id" VARCHAR(100),
    "description" VARCHAR(500),
    "stripe_usage_record_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trusted_devices_user_id_idx" ON "trusted_devices"("user_id");

-- CreateIndex
CREATE INDEX "trusted_devices_expires_at_idx" ON "trusted_devices"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_user_id_device_fingerprint_key" ON "trusted_devices"("user_id", "device_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_recovery_requests_token_hash_key" ON "mfa_recovery_requests"("token_hash");

-- CreateIndex
CREATE INDEX "mfa_recovery_requests_user_id_idx" ON "mfa_recovery_requests"("user_id");

-- CreateIndex
CREATE INDEX "mfa_recovery_requests_token_hash_idx" ON "mfa_recovery_requests"("token_hash");

-- CreateIndex
CREATE INDEX "mfa_recovery_requests_expires_at_idx" ON "mfa_recovery_requests"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "verification_inquiries_persona_inquiry_id_key" ON "verification_inquiries"("persona_inquiry_id");

-- CreateIndex
CREATE INDEX "verification_inquiries_user_id_idx" ON "verification_inquiries"("user_id");

-- CreateIndex
CREATE INDEX "verification_inquiries_persona_inquiry_id_idx" ON "verification_inquiries"("persona_inquiry_id");

-- CreateIndex
CREATE INDEX "verification_inquiries_status_idx" ON "verification_inquiries"("status");

-- CreateIndex
CREATE INDEX "verification_inquiries_verification_type_idx" ON "verification_inquiries"("verification_type");

-- CreateIndex
CREATE INDEX "verification_documents_inquiry_id_idx" ON "verification_documents"("inquiry_id");

-- CreateIndex
CREATE INDEX "verification_documents_document_type_idx" ON "verification_documents"("document_type");

-- CreateIndex
CREATE INDEX "user_verification_badges_user_id_idx" ON "user_verification_badges"("user_id");

-- CreateIndex
CREATE INDEX "user_verification_badges_level_idx" ON "user_verification_badges"("level");

-- CreateIndex
CREATE INDEX "user_verification_badges_is_active_idx" ON "user_verification_badges"("is_active");

-- CreateIndex
CREATE INDEX "user_verification_badges_expires_at_idx" ON "user_verification_badges"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "freelancer_profiles_user_profile_id_key" ON "freelancer_profiles"("user_profile_id");

-- CreateIndex
CREATE INDEX "freelancer_profiles_availability_idx" ON "freelancer_profiles"("availability");

-- CreateIndex
CREATE INDEX "freelancer_profiles_hourly_rate_min_hourly_rate_max_idx" ON "freelancer_profiles"("hourly_rate_min", "hourly_rate_max");

-- CreateIndex
CREATE INDEX "freelancer_profiles_search_rank_idx" ON "freelancer_profiles"("search_rank");

-- CreateIndex
CREATE INDEX "freelancer_profiles_last_active_at_idx" ON "freelancer_profiles"("last_active_at");

-- CreateIndex
CREATE INDEX "freelancer_profiles_is_verified_idx" ON "freelancer_profiles"("is_verified");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_user_profile_id_key" ON "client_profiles"("user_profile_id");

-- CreateIndex
CREATE INDEX "client_profiles_company_size_idx" ON "client_profiles"("company_size");

-- CreateIndex
CREATE INDEX "client_profiles_industry_idx" ON "client_profiles"("industry");

-- CreateIndex
CREATE INDEX "client_profiles_is_verified_idx" ON "client_profiles"("is_verified");

-- CreateIndex
CREATE INDEX "client_profiles_last_active_at_idx" ON "client_profiles"("last_active_at");

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_token_idx" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_email_idx" ON "email_verification_tokens"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "subscriptions_stripe_subscription_id_idx" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_stripe_customer_id_idx" ON "subscriptions"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_product_idx" ON "subscriptions"("product");

-- CreateIndex
CREATE INDEX "subscriptions_current_period_end_idx" ON "subscriptions"("current_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_invoices_stripe_invoice_id_key" ON "subscription_invoices"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "subscription_invoices_subscription_id_idx" ON "subscription_invoices"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_invoices_stripe_invoice_id_idx" ON "subscription_invoices"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "subscription_invoices_status_idx" ON "subscription_invoices"("status");

-- CreateIndex
CREATE INDEX "subscription_invoices_paid_at_idx" ON "subscription_invoices"("paid_at");

-- CreateIndex
CREATE INDEX "usage_records_subscription_id_idx" ON "usage_records"("subscription_id");

-- CreateIndex
CREATE INDEX "usage_records_subscription_id_timestamp_idx" ON "usage_records"("subscription_id", "timestamp");

-- CreateIndex
CREATE INDEX "usage_records_timestamp_idx" ON "usage_records"("timestamp");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens"("family");

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_inquiries" ADD CONSTRAINT "verification_inquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "verification_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verification_badges" ADD CONSTRAINT "user_verification_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verification_badges" ADD CONSTRAINT "user_verification_badges_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "verification_inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelancer_profiles" ADD CONSTRAINT "freelancer_profiles_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
