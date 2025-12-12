/*
  Warnings:

  - The values [PUBLISHED,FLAGGED] on the enum `ReviewStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `client_name` on the `portfolio_items` table. All the data in the column will be lost.
  - You are about to drop the column `completed_at` on the `portfolio_items` table. All the data in the column will be lost.
  - You are about to drop the column `display_order` on the `portfolio_items` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `portfolio_items` table. All the data in the column will be lost.
  - You are about to drop the column `is_confidential` on the `portfolio_items` table. All the data in the column will be lost.
  - You are about to drop the column `is_featured` on the `portfolio_items` table. All the data in the column will be lost.
  - You are about to drop the column `skills` on the `portfolio_items` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail_url` on the `portfolio_items` table. All the data in the column will be lost.
  - You are about to drop the column `video_url` on the `portfolio_items` table. All the data in the column will be lost.
  - You are about to drop the column `family` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `replaced_by` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `comment` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `communication` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `expertise` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `professionalism` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `quality` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `reported_at` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `would_recommend` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `calculated_at` on the `trust_scores` table. All the data in the column will be lost.
  - You are about to drop the column `communication_score` on the `trust_scores` table. All the data in the column will be lost.
  - You are about to drop the column `completion_rate` on the `trust_scores` table. All the data in the column will be lost.
  - You are about to drop the column `quality_score` on the `trust_scores` table. All the data in the column will be lost.
  - You are about to drop the column `response_time` on the `trust_scores` table. All the data in the column will be lost.
  - You are about to alter the column `overall_score` on the `trust_scores` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,2)` to `Integer`.
  - You are about to drop the column `enforced_at` on the `user_mfa` table. All the data in the column will be lost.
  - You are about to drop the column `enforced_by` on the `user_mfa` table. All the data in the column will be lost.
  - You are about to drop the column `phone_verified_at` on the `user_mfa` table. All the data in the column will be lost.
  - You are about to drop the column `recovery_email` on the `user_mfa` table. All the data in the column will be lost.
  - You are about to drop the column `recovery_email_verified` on the `user_mfa` table. All the data in the column will be lost.
  - You are about to drop the column `remember_devices` on the `user_mfa` table. All the data in the column will be lost.
  - You are about to drop the column `totp_verified_at` on the `user_mfa` table. All the data in the column will be lost.
  - You are about to drop the column `trusted_device_max_days` on the `user_mfa` table. All the data in the column will be lost.
  - You are about to drop the column `email_verified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `email_verified_at` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `failed_login_attempts` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `last_login_ip` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `locked_until` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `password_changed_at` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `password_reset_expires` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `password_reset_token` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `certifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `client_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `education` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `email_verification_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `freelancer_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mfa_recovery_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `oauth_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `trusted_devices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_verification_badges` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification_inquiries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_history` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[response_id]` on the table `reviews` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[contract_id,review_type]` on the table `reviews` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[oauth_provider,oauth_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `category_ratings` to the `reviews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `overall_rating` to the `reviews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `review_type` to the `reviews` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PayoutAccountType" AS ENUM ('EXPRESS', 'STANDARD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PayoutAccountStatus" AS ENUM ('PENDING', 'ONBOARDING', 'ACTIVE', 'RESTRICTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'PAID', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PAYMENT', 'REFUND', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'SUBSCRIPTION', 'PAYOUT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('CLIENT_TO_FREELANCER', 'FREELANCER_TO_CLIENT');

-- CreateEnum
CREATE TYPE "ReviewReportReason" AS ENUM ('INAPPROPRIATE_CONTENT', 'FALSE_INFORMATION', 'HARASSMENT', 'SPAM', 'CONFLICT_OF_INTEREST', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewInvitationStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('EMERGING', 'ESTABLISHED', 'TRUSTED', 'HIGHLY_TRUSTED', 'ELITE');

-- CreateEnum
CREATE TYPE "TrustTrend" AS ENUM ('RISING', 'STABLE', 'DECLINING');

-- CreateEnum
CREATE TYPE "ComplianceEventType" AS ENUM ('DATA_TRANSFER_ATTEMPT', 'UNAUTHORIZED_APP', 'POLICY_VIOLATION', 'SESSION_ANOMALY', 'SCREENSHOT_ATTEMPT', 'SCREEN_SHARE_ATTEMPT');

-- CreateEnum
CREATE TYPE "ComplianceSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ThresholdContextType" AS ENUM ('JOB', 'TENANT', 'POD_TEMPLATE', 'GLOBAL');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SKILLPOD', 'COCKPIT', 'MARKET_PREMIUM');

-- CreateEnum
CREATE TYPE "PriceBillingInterval" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "PriceTier" AS ENUM ('FREE', 'STARTER', 'BASIC', 'PRO', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "PriceUsageType" AS ENUM ('METERED', 'LICENSED');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "CouponDuration" AS ENUM ('ONCE', 'REPEATING', 'FOREVER');

-- AlterEnum
BEGIN;
CREATE TYPE "ReviewStatus_new" AS ENUM ('PENDING', 'REVEALED', 'HIDDEN');
ALTER TABLE "reviews" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "reviews" ALTER COLUMN "status" TYPE "ReviewStatus_new" USING ("status"::text::"ReviewStatus_new");
ALTER TYPE "ReviewStatus" RENAME TO "ReviewStatus_old";
ALTER TYPE "ReviewStatus_new" RENAME TO "ReviewStatus";
DROP TYPE "ReviewStatus_old";
ALTER TABLE "reviews" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "certifications" DROP CONSTRAINT "certifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "client_profiles" DROP CONSTRAINT "client_profiles_user_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "education" DROP CONSTRAINT "education_user_id_fkey";

-- DropForeignKey
ALTER TABLE "freelancer_profiles" DROP CONSTRAINT "freelancer_profiles_user_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "oauth_accounts" DROP CONSTRAINT "oauth_accounts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "trusted_devices" DROP CONSTRAINT "trusted_devices_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_sessions" DROP CONSTRAINT "user_sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_verification_badges" DROP CONSTRAINT "user_verification_badges_inquiry_id_fkey";

-- DropForeignKey
ALTER TABLE "user_verification_badges" DROP CONSTRAINT "user_verification_badges_user_id_fkey";

-- DropForeignKey
ALTER TABLE "verification_documents" DROP CONSTRAINT "verification_documents_inquiry_id_fkey";

-- DropForeignKey
ALTER TABLE "verification_inquiries" DROP CONSTRAINT "verification_inquiries_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_history" DROP CONSTRAINT "work_history_user_id_fkey";

-- DropIndex
DROP INDEX "portfolio_items_is_featured_idx";

-- DropIndex
DROP INDEX "refresh_tokens_family_idx";

-- DropIndex
DROP INDEX "reviews_contract_id_idx";

-- DropIndex
DROP INDEX "reviews_rating_idx";

-- DropIndex
DROP INDEX "reviews_reviewer_id_contract_id_key";

-- AlterTable
ALTER TABLE "portfolio_items" DROP COLUMN "client_name",
DROP COLUMN "completed_at",
DROP COLUMN "display_order",
DROP COLUMN "images",
DROP COLUMN "is_confidential",
DROP COLUMN "is_featured",
DROP COLUMN "skills",
DROP COLUMN "thumbnail_url",
DROP COLUMN "video_url";

-- AlterTable
ALTER TABLE "refresh_tokens" DROP COLUMN "family",
DROP COLUMN "replaced_by";

-- AlterTable
ALTER TABLE "reviews" DROP COLUMN "comment",
DROP COLUMN "communication",
DROP COLUMN "expertise",
DROP COLUMN "professionalism",
DROP COLUMN "quality",
DROP COLUMN "rating",
DROP COLUMN "reported_at",
DROP COLUMN "would_recommend",
ADD COLUMN     "category_ratings" JSONB NOT NULL,
ADD COLUMN     "content" TEXT,
ADD COLUMN     "helpful_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_moderated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "moderated_at" TIMESTAMP(3),
ADD COLUMN     "moderated_by" UUID,
ADD COLUMN     "moderation_reason" VARCHAR(500),
ADD COLUMN     "not_helpful_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "original_content" TEXT,
ADD COLUMN     "overall_rating" SMALLINT NOT NULL,
ADD COLUMN     "private_feedback" TEXT,
ADD COLUMN     "response_id" UUID,
ADD COLUMN     "revealed_at" TIMESTAMP(3),
ADD COLUMN     "review_type" "ReviewType" NOT NULL;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "cancellation_reason" VARCHAR(500),
ADD COLUMN     "paused_at" TIMESTAMP(3),
ADD COLUMN     "price_id" UUID,
ADD COLUMN     "product_id" UUID,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "resume_at" TIMESTAMP(3),
ADD COLUMN     "trial_start" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "trust_scores" DROP COLUMN "calculated_at",
DROP COLUMN "communication_score",
DROP COLUMN "completion_rate",
DROP COLUMN "quality_score",
DROP COLUMN "response_time",
ADD COLUMN     "activity_score" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "activity_weight" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "calculation_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "compliance_score" INTEGER NOT NULL DEFAULT 70,
ADD COLUMN     "compliance_weight" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "factors" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "last_calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "previous_score" INTEGER,
ADD COLUMN     "review_score" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "review_weight" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "score_change_amount" INTEGER,
ADD COLUMN     "tenure_score" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "tenure_weight" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "tier" "TrustTier" NOT NULL DEFAULT 'EMERGING',
ADD COLUMN     "trend" "TrustTrend" NOT NULL DEFAULT 'STABLE',
ADD COLUMN     "verification_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verification_weight" INTEGER NOT NULL DEFAULT 20,
ALTER COLUMN "overall_score" SET DEFAULT 50,
ALTER COLUMN "overall_score" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "user_mfa" DROP COLUMN "enforced_at",
DROP COLUMN "enforced_by",
DROP COLUMN "phone_verified_at",
DROP COLUMN "recovery_email",
DROP COLUMN "recovery_email_verified",
DROP COLUMN "remember_devices",
DROP COLUMN "totp_verified_at",
DROP COLUMN "trusted_device_max_days";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "email_verified",
DROP COLUMN "email_verified_at",
DROP COLUMN "failed_login_attempts",
DROP COLUMN "last_login_ip",
DROP COLUMN "locked_until",
DROP COLUMN "password_changed_at",
DROP COLUMN "password_reset_expires",
DROP COLUMN "password_reset_token",
ADD COLUMN     "oauth_id" VARCHAR(255),
ADD COLUMN     "oauth_provider" VARCHAR(50);

-- DropTable
DROP TABLE "certifications";

-- DropTable
DROP TABLE "client_profiles";

-- DropTable
DROP TABLE "education";

-- DropTable
DROP TABLE "email_verification_tokens";

-- DropTable
DROP TABLE "freelancer_profiles";

-- DropTable
DROP TABLE "mfa_recovery_requests";

-- DropTable
DROP TABLE "oauth_accounts";

-- DropTable
DROP TABLE "trusted_devices";

-- DropTable
DROP TABLE "user_sessions";

-- DropTable
DROP TABLE "user_verification_badges";

-- DropTable
DROP TABLE "verification_documents";

-- DropTable
DROP TABLE "verification_inquiries";

-- DropTable
DROP TABLE "work_history";

-- DropEnum
DROP TYPE "CompanySize";

-- DropEnum
DROP TYPE "DocumentStatus";

-- DropEnum
DROP TYPE "DocumentType";

-- DropEnum
DROP TYPE "FreelancerAvailability";

-- DropEnum
DROP TYPE "HiringFrequency";

-- DropEnum
DROP TYPE "JobType";

-- DropEnum
DROP TYPE "MfaRecoveryStatus";

-- DropEnum
DROP TYPE "OAuthProvider";

-- DropEnum
DROP TYPE "VerificationStatus";

-- DropEnum
DROP TYPE "VerificationType";

-- CreateTable
CREATE TABLE "payout_accounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "stripe_connect_account_id" VARCHAR(100),
    "account_type" "PayoutAccountType" NOT NULL DEFAULT 'EXPRESS',
    "status" "PayoutAccountStatus" NOT NULL DEFAULT 'PENDING',
    "details_submitted" BOOLEAN NOT NULL DEFAULT false,
    "charges_enabled" BOOLEAN NOT NULL DEFAULT false,
    "payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "currently_due" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eventually_due" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "past_due" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "default_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "payout_schedule" JSONB,
    "country" VARCHAR(2),
    "business_type" VARCHAR(50),
    "external_account_type" VARCHAR(20),
    "external_account_last4" VARCHAR(4),
    "external_account_bank" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "payout_account_id" UUID NOT NULL,
    "stripe_transfer_id" VARCHAR(100),
    "stripe_payout_id" VARCHAR(100),
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "description" VARCHAR(500),
    "failure_code" VARCHAR(50),
    "failure_message" VARCHAR(500),
    "processed_at" TIMESTAMP(3),
    "arrived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "stripe_payment_intent_id" VARCHAR(100),
    "stripe_charge_id" VARCHAR(100),
    "payment_method_id" UUID,
    "type" "TransactionType" NOT NULL DEFAULT 'PAYMENT',
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "platform_fee" DECIMAL(12,2),
    "stripe_fee" DECIMAL(12,2),
    "net_amount" DECIMAL(12,2),
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "description" VARCHAR(500),
    "metadata" JSONB,
    "failure_code" VARCHAR(50),
    "failure_message" VARCHAR(500),
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_responses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "content" TEXT NOT NULL,
    "is_moderated" BOOLEAN NOT NULL DEFAULT false,
    "moderated_at" TIMESTAMP(3),
    "original_content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_helpful_votes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "review_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_helpful" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_helpful_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "review_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" "ReviewReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolution" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_rating_aggregations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "freelancer_total_reviews" INTEGER NOT NULL DEFAULT 0,
    "freelancer_average_rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "freelancer_rating_breakdown" JSONB NOT NULL DEFAULT '{}',
    "freelancer_quality_avg" DECIMAL(3,2),
    "freelancer_communication_avg" DECIMAL(3,2),
    "freelancer_expertise_avg" DECIMAL(3,2),
    "freelancer_professionalism_avg" DECIMAL(3,2),
    "freelancer_repeat_rate" DECIMAL(5,2),
    "client_total_reviews" INTEGER NOT NULL DEFAULT 0,
    "client_average_rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "client_rating_breakdown" JSONB NOT NULL DEFAULT '{}',
    "client_clarity_avg" DECIMAL(3,2),
    "client_responsiveness_avg" DECIMAL(3,2),
    "client_payment_avg" DECIMAL(3,2),
    "client_professionalism_avg" DECIMAL(3,2),
    "client_repeat_rate" DECIMAL(5,2),
    "last_calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_rating_aggregations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_invitations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "review_type" "ReviewType" NOT NULL,
    "status" "ReviewInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_score_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "trust_score_id" UUID NOT NULL,
    "overall_score" INTEGER NOT NULL,
    "review_score" INTEGER NOT NULL,
    "compliance_score" INTEGER NOT NULL,
    "verification_score" INTEGER NOT NULL,
    "tenure_score" INTEGER NOT NULL,
    "activity_score" INTEGER NOT NULL,
    "tier" "TrustTier" NOT NULL,
    "trigger_event" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_score_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skillpod_compliance_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "event_type" "ComplianceEventType" NOT NULL,
    "severity" "ComplianceSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "resolution_notes" TEXT,
    "score_impact" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skillpod_compliance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_score_thresholds" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "context_type" "ThresholdContextType" NOT NULL,
    "context_id" UUID,
    "minimum_score" INTEGER NOT NULL,
    "minimum_tier" "TrustTier",
    "require_verification" BOOLEAN NOT NULL DEFAULT false,
    "minimum_verification_level" "VerificationLevel",
    "require_mfa" BOOLEAN NOT NULL DEFAULT false,
    "minimum_reviews" INTEGER,
    "minimum_completed_jobs" INTEGER,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trust_score_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "badge_id" VARCHAR(50) NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "stripe_product_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "product_type" "ProductType" NOT NULL,
    "features" JSONB DEFAULT '[]',
    "limits" JSONB DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "product_id" UUID NOT NULL,
    "stripe_price_id" VARCHAR(100) NOT NULL,
    "nickname" VARCHAR(100),
    "unit_amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "billing_interval" "PriceBillingInterval" NOT NULL,
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "tier" "PriceTier" NOT NULL,
    "trial_period_days" INTEGER,
    "usage_type" "PriceUsageType",
    "tiered_pricing" JSONB,
    "is_per_seat" BOOLEAN NOT NULL DEFAULT false,
    "included_seats" INTEGER,
    "max_seats" INTEGER,
    "additional_seat_price" DECIMAL(10,2),
    "features" JSONB DEFAULT '[]',
    "limits" JSONB DEFAULT '{}',
    "is_popular" BOOLEAN NOT NULL DEFAULT false,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "stripe_coupon_id" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "discount_type" "CouponDiscountType" NOT NULL,
    "amount_off" DECIMAL(10,2),
    "percent_off" DECIMAL(5,2),
    "currency" VARCHAR(3),
    "duration" "CouponDuration" NOT NULL,
    "duration_months" INTEGER,
    "max_redemptions" INTEGER,
    "current_redemptions" INTEGER NOT NULL DEFAULT 0,
    "valid_product_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minimum_amount" DECIMAL(10,2),
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "coupon_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subscription_id" UUID,
    "discount_amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_analytics" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "metric_type" VARCHAR(100) NOT NULL,
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "value" DECIMAL(20,4) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_exports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "status" VARCHAR(50) NOT NULL,
    "requested_by" VARCHAR(100) NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "format" VARCHAR(20) NOT NULL,
    "include_fields" TEXT[],
    "file_url" VARCHAR(500),
    "file_size" INTEGER,
    "record_count" INTEGER,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_baselines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "actor_id" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "avg_count" DECIMAL(10,2) NOT NULL,
    "std_dev" DECIMAL(10,2) NOT NULL,
    "min_count" INTEGER NOT NULL,
    "max_count" INTEGER NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_accounts_user_id_key" ON "payout_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_accounts_stripe_connect_account_id_key" ON "payout_accounts"("stripe_connect_account_id");

-- CreateIndex
CREATE INDEX "payout_accounts_user_id_idx" ON "payout_accounts"("user_id");

-- CreateIndex
CREATE INDEX "payout_accounts_status_idx" ON "payout_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_stripe_transfer_id_key" ON "payouts"("stripe_transfer_id");

-- CreateIndex
CREATE INDEX "payouts_payout_account_id_idx" ON "payouts"("payout_account_id");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE INDEX "payouts_reference_type_reference_id_idx" ON "payouts"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_stripe_payment_intent_id_key" ON "payment_transactions"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "payment_transactions_user_id_idx" ON "payment_transactions"("user_id");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateIndex
CREATE INDEX "payment_transactions_type_idx" ON "payment_transactions"("type");

-- CreateIndex
CREATE INDEX "payment_transactions_reference_type_reference_id_idx" ON "payment_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "review_helpful_votes_review_id_idx" ON "review_helpful_votes"("review_id");

-- CreateIndex
CREATE INDEX "review_helpful_votes_user_id_idx" ON "review_helpful_votes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_helpful_votes_review_id_user_id_key" ON "review_helpful_votes"("review_id", "user_id");

-- CreateIndex
CREATE INDEX "review_reports_review_id_idx" ON "review_reports"("review_id");

-- CreateIndex
CREATE INDEX "review_reports_status_idx" ON "review_reports"("status");

-- CreateIndex
CREATE INDEX "review_reports_reporter_id_idx" ON "review_reports"("reporter_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_rating_aggregations_user_id_key" ON "user_rating_aggregations"("user_id");

-- CreateIndex
CREATE INDEX "review_invitations_user_id_idx" ON "review_invitations"("user_id");

-- CreateIndex
CREATE INDEX "review_invitations_status_idx" ON "review_invitations"("status");

-- CreateIndex
CREATE INDEX "review_invitations_expires_at_idx" ON "review_invitations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_invitations_contract_id_review_type_key" ON "review_invitations"("contract_id", "review_type");

-- CreateIndex
CREATE INDEX "trust_score_history_trust_score_id_idx" ON "trust_score_history"("trust_score_id");

-- CreateIndex
CREATE INDEX "trust_score_history_created_at_idx" ON "trust_score_history"("created_at");

-- CreateIndex
CREATE INDEX "skillpod_compliance_records_user_id_idx" ON "skillpod_compliance_records"("user_id");

-- CreateIndex
CREATE INDEX "skillpod_compliance_records_event_type_idx" ON "skillpod_compliance_records"("event_type");

-- CreateIndex
CREATE INDEX "skillpod_compliance_records_created_at_idx" ON "skillpod_compliance_records"("created_at");

-- CreateIndex
CREATE INDEX "trust_score_thresholds_context_type_context_id_idx" ON "trust_score_thresholds"("context_type", "context_id");

-- CreateIndex
CREATE INDEX "user_badges_user_id_idx" ON "user_badges"("user_id");

-- CreateIndex
CREATE INDEX "user_badges_badge_id_idx" ON "user_badges"("badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_id_key" ON "user_badges"("user_id", "badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_stripe_product_id_key" ON "products"("stripe_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_product_type_idx" ON "products"("product_type");

-- CreateIndex
CREATE INDEX "products_is_active_idx" ON "products"("is_active");

-- CreateIndex
CREATE INDEX "products_slug_idx" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "prices_stripe_price_id_key" ON "prices"("stripe_price_id");

-- CreateIndex
CREATE INDEX "prices_product_id_idx" ON "prices"("product_id");

-- CreateIndex
CREATE INDEX "prices_tier_idx" ON "prices"("tier");

-- CreateIndex
CREATE INDEX "prices_is_active_idx" ON "prices"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_stripe_coupon_id_key" ON "coupons"("stripe_coupon_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_code_idx" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_is_active_idx" ON "coupons"("is_active");

-- CreateIndex
CREATE INDEX "coupons_valid_until_idx" ON "coupons"("valid_until");

-- CreateIndex
CREATE INDEX "coupon_redemptions_user_id_idx" ON "coupon_redemptions"("user_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_subscription_id_idx" ON "coupon_redemptions"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_coupon_id_user_id_subscription_id_key" ON "coupon_redemptions"("coupon_id", "user_id", "subscription_id");

-- CreateIndex
CREATE INDEX "audit_analytics_metric_type_idx" ON "audit_analytics"("metric_type");

-- CreateIndex
CREATE INDEX "audit_analytics_period_start_period_end_idx" ON "audit_analytics"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "audit_analytics_metric_type_period_start_idx" ON "audit_analytics"("metric_type", "period_start");

-- CreateIndex
CREATE INDEX "audit_exports_status_idx" ON "audit_exports"("status");

-- CreateIndex
CREATE INDEX "audit_exports_requested_by_idx" ON "audit_exports"("requested_by");

-- CreateIndex
CREATE INDEX "audit_exports_created_at_idx" ON "audit_exports"("created_at");

-- CreateIndex
CREATE INDEX "audit_baselines_actor_id_idx" ON "audit_baselines"("actor_id");

-- CreateIndex
CREATE INDEX "audit_baselines_event_type_idx" ON "audit_baselines"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "audit_baselines_actor_id_event_type_key" ON "audit_baselines"("actor_id", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_response_id_key" ON "reviews"("response_id");

-- CreateIndex
CREATE INDEX "reviews_reviewer_id_idx" ON "reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "reviews_created_at_idx" ON "reviews"("created_at");

-- CreateIndex
CREATE INDEX "reviews_overall_rating_idx" ON "reviews"("overall_rating");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_contract_id_review_type_key" ON "reviews"("contract_id", "review_type");

-- CreateIndex
CREATE INDEX "subscriptions_product_id_idx" ON "subscriptions"("product_id");

-- CreateIndex
CREATE INDEX "subscriptions_price_id_idx" ON "subscriptions"("price_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_oauth_provider_oauth_id_key" ON "users"("oauth_provider", "oauth_id");

-- AddForeignKey
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payout_account_id_fkey" FOREIGN KEY ("payout_account_id") REFERENCES "payout_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "review_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_rating_aggregations" ADD CONSTRAINT "user_rating_aggregations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_invitations" ADD CONSTRAINT "review_invitations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_invitations" ADD CONSTRAINT "review_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_score_history" ADD CONSTRAINT "trust_score_history_trust_score_id_fkey" FOREIGN KEY ("trust_score_id") REFERENCES "trust_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skillpod_compliance_records" ADD CONSTRAINT "skillpod_compliance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
