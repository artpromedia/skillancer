-- Migration: Add Moat Features
-- This migration adds all competitive moat feature tables to the Skillancer platform

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Executive Suite Enums
CREATE TYPE "ExecutiveType" AS ENUM ('FRACTIONAL_CTO', 'FRACTIONAL_CFO', 'FRACTIONAL_CMO', 'FRACTIONAL_CISO', 'FRACTIONAL_COO', 'FRACTIONAL_CHRO', 'FRACTIONAL_CPO', 'FRACTIONAL_CRO', 'BOARD_ADVISOR', 'INTERIM_EXECUTIVE');

CREATE TYPE "ExecutiveVettingStatus" AS ENUM ('PENDING', 'APPLICATION_REVIEW', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'REFERENCE_CHECK', 'APPROVED', 'REJECTED', 'SUSPENDED');

CREATE TYPE "BackgroundCheckStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'EXPIRED');

CREATE TYPE "ExecutiveEngagementStatus" AS ENUM ('PROPOSAL', 'NEGOTIATING', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'TERMINATED');

CREATE TYPE "ExecutiveBillingCycle" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY');

CREATE TYPE "ExecutiveTier" AS ENUM ('BASIC', 'PRO', 'ENTERPRISE');

-- Integration Hub Enums
-- IntegrationCategory already defined in previous migration, extending with new values
DO $$ BEGIN
    ALTER TYPE "IntegrationCategory" ADD VALUE IF NOT EXISTS 'ANALYTICS';
    ALTER TYPE "IntegrationCategory" ADD VALUE IF NOT EXISTS 'DEVTOOLS';
    ALTER TYPE "IntegrationCategory" ADD VALUE IF NOT EXISTS 'SECURITY';
    ALTER TYPE "IntegrationCategory" ADD VALUE IF NOT EXISTS 'HR';
    ALTER TYPE "IntegrationCategory" ADD VALUE IF NOT EXISTS 'MARKETING';
    ALTER TYPE "IntegrationCategory" ADD VALUE IF NOT EXISTS 'CLOUD';
    ALTER TYPE "IntegrationCategory" ADD VALUE IF NOT EXISTS 'PROJECT_MANAGEMENT';
    ALTER TYPE "IntegrationCategory" ADD VALUE IF NOT EXISTS 'CRM';
EXCEPTION WHEN others THEN NULL;
END $$;

-- IntegrationTier - create if not exists
DO $$ BEGIN
    CREATE TYPE "IntegrationTier" AS ENUM ('BASIC', 'PRO', 'ENTERPRISE', 'ADDON');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- IntegrationStatus - extend if exists, create if not
DO $$ BEGIN
    CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'CONNECTED', 'EXPIRED', 'REVOKED', 'ERROR', 'REQUIRES_REAUTH');
EXCEPTION WHEN duplicate_object THEN
    ALTER TYPE "IntegrationStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_REAUTH';
END $$;

-- IntegrationAccessLevel - create if not exists
DO $$ BEGIN
    CREATE TYPE "IntegrationAccessLevel" AS ENUM ('READ_ONLY', 'READ_WRITE', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Financial Services Enums
CREATE TYPE "SkillancerCardStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'FROZEN', 'CANCELLED', 'EXPIRED');

CREATE TYPE "SkillancerCardType" AS ENUM ('VIRTUAL', 'PHYSICAL');

CREATE TYPE "InvoiceFinancingStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'FUNDED', 'COLLECTING', 'COLLECTED', 'DEFAULTED', 'CANCELLED');

CREATE TYPE "TaxVaultWithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED');

-- Talent Graph Enums
CREATE TYPE "WorkRelationshipType" AS ENUM ('WORKED_TOGETHER', 'MANAGED', 'MANAGED_BY', 'COLLABORATED', 'MENTORED', 'MENTORED_BY', 'REFERRED', 'REFERRED_BY');

CREATE TYPE "WarmIntroStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'COMPLETED');

-- Talent Pool Enums
CREATE TYPE "TalentPoolType" AS ENUM ('SKILLANCER_SELECT', 'VERIFIED_SPECIALISTS', 'SECURITY_CLEARED', 'HIPAA_CERTIFIED', 'STARTUP_VETERANS', 'ENTERPRISE_EXPERTS', 'RISING_STARS');

CREATE TYPE "PoolMembershipStatus" AS ENUM ('INVITED', 'APPLIED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'GRADUATED');

-- AI Copilot Enums
CREATE TYPE "CopilotInteractionType" AS ENUM ('PROPOSAL_GENERATION', 'RATE_SUGGESTION', 'JOB_POST_IMPROVEMENT', 'CONTRACT_REVIEW', 'MESSAGE_DRAFT', 'SCOPE_CLARIFICATION', 'MILESTONE_SUGGESTION', 'STATUS_UPDATE');

-- Client Guarantees Enums
CREATE TYPE "GuaranteeType" AS ENUM ('QUALITY_GUARANTEE', 'COMPLETION_INSURANCE', 'OUTCOME_WARRANTY', 'SATISFACTION_GUARANTEE');

CREATE TYPE "GuaranteeClaimStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'PAID', 'REPLACEMENT_ASSIGNED');

-- Certification Enums
CREATE TYPE "CertificationLevel" AS ENUM ('VERIFIED', 'CERTIFIED', 'EXPERT', 'INSTRUCTOR');

CREATE TYPE "CertificationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'EXPIRED', 'REVOKED');

-- Executive Addon Enums
CREATE TYPE "ExecutiveAddonType" AS ENUM ('TOOL_BUNDLE_CTO', 'TOOL_BUNDLE_CFO', 'TOOL_BUNDLE_CMO', 'TOOL_BUNDLE_CISO', 'TOOL_BUNDLE_COO', 'TOOL_BUNDLE_CHRO', 'TOOL_BUNDLE_CPO', 'EXTRA_SKILLPOD_HOURS', 'EXTRA_TEAM_MEMBER', 'CLIENT_WHITE_LABEL', 'PRIORITY_SUPPORT', 'API_ACCESS');

-- ============================================================================
-- EXECUTIVE SUITE TABLES
-- ============================================================================

CREATE TABLE "executive_profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "executive_type" "ExecutiveType" NOT NULL,
    "headline" VARCHAR(500) NOT NULL,
    "executive_summary" TEXT,
    "years_executive_exp" INTEGER NOT NULL,
    "industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "company_stages_expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "past_roles" JSONB,
    "notable_achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "board_experience" BOOLEAN NOT NULL DEFAULT false,
    "public_company_exp" BOOLEAN NOT NULL DEFAULT false,
    "vetting_status" "ExecutiveVettingStatus" NOT NULL DEFAULT 'PENDING',
    "vetting_started_at" TIMESTAMP(3),
    "vetting_completed_at" TIMESTAMP(3),
    "vetting_notes" TEXT,
    "interview_score" INTEGER,
    "interview_notes" TEXT,
    "background_check_status" "BackgroundCheckStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "background_check_date" TIMESTAMP(3),
    "background_check_expiry" TIMESTAMP(3),
    "references_provided" INTEGER NOT NULL DEFAULT 0,
    "references_verified" INTEGER NOT NULL DEFAULT 0,
    "reference_score" DECIMAL(3,2),
    "max_clients" INTEGER NOT NULL DEFAULT 5,
    "current_client_count" INTEGER NOT NULL DEFAULT 0,
    "hours_per_week_available" INTEGER NOT NULL DEFAULT 20,
    "available_from" TIMESTAMP(3),
    "monthly_retainer_min" DECIMAL(10,2),
    "monthly_retainer_max" DECIMAL(10,2),
    "hourly_rate_min" DECIMAL(10,2),
    "hourly_rate_max" DECIMAL(10,2),
    "equity_open_to" BOOLEAN NOT NULL DEFAULT false,
    "linkedin_url" VARCHAR(500),
    "linkedin_verified" BOOLEAN NOT NULL DEFAULT false,
    "executive_email_domain" VARCHAR(255),
    "email_domain_verified" BOOLEAN NOT NULL DEFAULT false,
    "featured_executive" BOOLEAN NOT NULL DEFAULT false,
    "searchable" BOOLEAN NOT NULL DEFAULT true,
    "profile_views" INTEGER NOT NULL DEFAULT 0,
    "response_rate" DECIMAL(5,2),
    "avg_response_time" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "executive_profiles_user_id_key" ON "executive_profiles"("user_id");
CREATE INDEX "executive_profiles_executive_type_idx" ON "executive_profiles"("executive_type");
CREATE INDEX "executive_profiles_vetting_status_idx" ON "executive_profiles"("vetting_status");
CREATE INDEX "executive_profiles_featured_executive_idx" ON "executive_profiles"("featured_executive");
CREATE INDEX "executive_profiles_industries_idx" ON "executive_profiles" USING GIN ("industries");

CREATE TABLE "executive_references" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "executive_profile_id" UUID NOT NULL,
    "reference_name" VARCHAR(255) NOT NULL,
    "reference_title" VARCHAR(255) NOT NULL,
    "reference_company" VARCHAR(255) NOT NULL,
    "reference_email" VARCHAR(255) NOT NULL,
    "reference_phone" VARCHAR(50),
    "relationship_type" VARCHAR(100) NOT NULL,
    "verification_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "verification_date" TIMESTAMP(3),
    "verification_notes" TEXT,
    "rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_references_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "executive_references_executive_profile_id_idx" ON "executive_references"("executive_profile_id");

CREATE TABLE "executive_engagements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "executive_profile_id" UUID NOT NULL,
    "client_tenant_id" UUID NOT NULL,
    "client_user_id" UUID NOT NULL,
    "role" "ExecutiveType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "ExecutiveEngagementStatus" NOT NULL DEFAULT 'PROPOSAL',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "expected_end_date" TIMESTAMP(3),
    "hours_per_week" INTEGER NOT NULL,
    "monthly_retainer" DECIMAL(10,2),
    "hourly_rate" DECIMAL(10,2),
    "billing_cycle" "ExecutiveBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "equity_percentage" DECIMAL(5,3),
    "skillpod_policy_id" UUID,
    "workspace_config" JSONB,
    "objectives" JSONB,
    "success_metrics" JSONB,
    "total_hours_logged" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMP(3),
    "approval_status" VARCHAR(50),
    "approved_by" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_engagements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "executive_engagements_executive_profile_id_idx" ON "executive_engagements"("executive_profile_id");
CREATE INDEX "executive_engagements_client_tenant_id_idx" ON "executive_engagements"("client_tenant_id");
CREATE INDEX "executive_engagements_status_idx" ON "executive_engagements"("status");

CREATE TABLE "executive_workspaces" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "engagement_id" UUID NOT NULL,
    "dashboard_layout" JSONB,
    "enabled_widgets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "widget_settings" JSONB,
    "client_logo_url" VARCHAR(500),
    "primary_color" VARCHAR(7),
    "pinned_documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "favorite_actions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quick_links" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_workspaces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "executive_workspaces_engagement_id_key" ON "executive_workspaces"("engagement_id");

CREATE TABLE "executive_time_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "engagement_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(4,2) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "invoice_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_time_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "executive_time_entries_engagement_id_idx" ON "executive_time_entries"("engagement_id");
CREATE INDEX "executive_time_entries_date_idx" ON "executive_time_entries"("date");

CREATE TABLE "executive_milestones" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "engagement_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "deliverables" JSONB,
    "success_criteria" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_milestones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "executive_milestones_engagement_id_idx" ON "executive_milestones"("engagement_id");

-- ============================================================================
-- INTEGRATION HUB TABLES
-- ============================================================================

CREATE TABLE "integration_types" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" "IntegrationCategory" NOT NULL,
    "applicable_roles" "ExecutiveType"[] DEFAULT ARRAY[]::"ExecutiveType"[],
    "oauth_provider" VARCHAR(100),
    "oauth_auth_url" VARCHAR(500),
    "oauth_token_url" VARCHAR(500),
    "oauth_scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "api_base_url" VARCHAR(500),
    "api_version" VARCHAR(20),
    "logo_url" VARCHAR(500),
    "icon_url" VARCHAR(500),
    "brand_color" VARCHAR(7),
    "tier" "IntegrationTier" NOT NULL DEFAULT 'PRO',
    "addon_price_monthly" DECIMAL(10,2),
    "supported_widgets" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_beta" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_types_slug_key" ON "integration_types"("slug");
CREATE INDEX "integration_types_category_idx" ON "integration_types"("category");
CREATE INDEX "integration_types_tier_idx" ON "integration_types"("tier");

CREATE TABLE "executive_integrations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "engagement_id" UUID NOT NULL,
    "integration_type_id" UUID NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "access_level" "IntegrationAccessLevel" NOT NULL DEFAULT 'READ_ONLY',
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "api_key" TEXT,
    "config" JSONB,
    "account_id" VARCHAR(255),
    "account_name" VARCHAR(255),
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" VARCHAR(50),
    "last_sync_error" TEXT,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_frequency" VARCHAR(20) NOT NULL DEFAULT 'HOURLY',
    "cached_data" JSONB,
    "cache_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "executive_integrations_engagement_integration_key" ON "executive_integrations"("engagement_id", "integration_type_id");
CREATE INDEX "executive_integrations_status_idx" ON "executive_integrations"("status");

CREATE TABLE "executive_tool_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "executive_profile_id" UUID NOT NULL,
    "bundle_type" VARCHAR(50) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_widgets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferred_integrations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_tool_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "executive_tool_configs_profile_bundle_key" ON "executive_tool_configs"("executive_profile_id", "bundle_type");

-- ============================================================================
-- FINANCIAL SERVICES TABLES
-- ============================================================================

CREATE TABLE "skillancer_cards" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "card_type" "SkillancerCardType" NOT NULL DEFAULT 'VIRTUAL',
    "status" "SkillancerCardStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "last4" VARCHAR(4),
    "expiry_month" INTEGER,
    "expiry_year" INTEGER,
    "stripe_card_id" VARCHAR(255),
    "stripe_cardholder_id" VARCHAR(255),
    "spending_limit_daily" DECIMAL(10,2) NOT NULL DEFAULT 5000,
    "spending_limit_monthly" DECIMAL(10,2) NOT NULL DEFAULT 25000,
    "spent_today" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "spent_this_month" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cashback_rate" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    "cashback_earned" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cashback_pending" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shipping_address" JSONB,
    "shipped_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skillancer_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skillancer_cards_stripe_card_id_key" ON "skillancer_cards"("stripe_card_id");
CREATE INDEX "skillancer_cards_user_id_idx" ON "skillancer_cards"("user_id");
CREATE INDEX "skillancer_cards_status_idx" ON "skillancer_cards"("status");

CREATE TABLE "card_transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "card_id" UUID NOT NULL,
    "stripe_transaction_id" VARCHAR(255),
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "merchant_name" VARCHAR(255),
    "merchant_category" VARCHAR(100),
    "merchant_category_code" VARCHAR(10),
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "decline_reason" VARCHAR(255),
    "expense_category" VARCHAR(100),
    "is_business_expense" BOOLEAN NOT NULL DEFAULT true,
    "tax_deductible" BOOLEAN NOT NULL DEFAULT false,
    "cashback_amount" DECIMAL(10,2),
    "receipt_url" VARCHAR(500),
    "notes" TEXT,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "card_transactions_stripe_transaction_id_key" ON "card_transactions"("stripe_transaction_id");
CREATE INDEX "card_transactions_card_id_idx" ON "card_transactions"("card_id");
CREATE INDEX "card_transactions_transaction_date_idx" ON "card_transactions"("transaction_date");

CREATE TABLE "invoice_financing" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "invoice_amount" DECIMAL(14,2) NOT NULL,
    "invoice_due_date" TIMESTAMP(3) NOT NULL,
    "client_name" VARCHAR(255) NOT NULL,
    "advance_percentage" DECIMAL(5,2) NOT NULL DEFAULT 80,
    "advance_amount" DECIMAL(14,2) NOT NULL,
    "fee_percentage" DECIMAL(5,3) NOT NULL,
    "fee_amount" DECIMAL(10,2) NOT NULL,
    "status" "InvoiceFinancingStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "approved_at" TIMESTAMP(3),
    "funded_at" TIMESTAMP(3),
    "collected_at" TIMESTAMP(3),
    "amount_collected" DECIMAL(14,2),
    "remainder_paid_at" TIMESTAMP(3),
    "risk_score" INTEGER,
    "risk_factors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_financing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_financing_user_id_idx" ON "invoice_financing"("user_id");
CREATE INDEX "invoice_financing_status_idx" ON "invoice_financing"("status");

CREATE TABLE "tax_vaults" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "auto_save_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_save_percentage" DECIMAL(5,2) NOT NULL DEFAULT 25,
    "auto_save_from_payouts" BOOLEAN NOT NULL DEFAULT true,
    "auto_save_from_contracts" BOOLEAN NOT NULL DEFAULT true,
    "estimated_federal_tax" DECIMAL(14,2),
    "estimated_state_tax" DECIMAL(14,2),
    "estimated_self_employment_tax" DECIMAL(14,2),
    "estimated_total_tax" DECIMAL(14,2),
    "tax_year" INTEGER NOT NULL DEFAULT 2024,
    "q1_paid_amount" DECIMAL(14,2),
    "q1_paid_date" TIMESTAMP(3),
    "q2_paid_amount" DECIMAL(14,2),
    "q2_paid_date" TIMESTAMP(3),
    "q3_paid_amount" DECIMAL(14,2),
    "q3_paid_date" TIMESTAMP(3),
    "q4_paid_amount" DECIMAL(14,2),
    "q4_paid_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_vaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_vaults_user_id_key" ON "tax_vaults"("user_id");

CREATE TABLE "tax_vault_deposits" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tax_vault_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "source_reference_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_vault_deposits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tax_vault_deposits_tax_vault_id_idx" ON "tax_vault_deposits"("tax_vault_id");

CREATE TABLE "tax_vault_withdrawals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tax_vault_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "purpose" VARCHAR(100) NOT NULL,
    "status" "TaxVaultWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "destination_account_id" UUID,
    "approved_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_vault_withdrawals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tax_vault_withdrawals_tax_vault_id_idx" ON "tax_vault_withdrawals"("tax_vault_id");

-- ============================================================================
-- TALENT GRAPH TABLES
-- ============================================================================

CREATE TABLE "work_relationships" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "related_user_id" UUID NOT NULL,
    "relationship_type" "WorkRelationshipType" NOT NULL,
    "strength" INTEGER NOT NULL DEFAULT 50,
    "project_id" UUID,
    "contract_id" UUID,
    "company_name" VARCHAR(255),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "duration_months" INTEGER,
    "would_work_again" BOOLEAN,
    "collaboration_rating" INTEGER,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by_contract_id" UUID,
    "last_interaction_at" TIMESTAMP(3),
    "interaction_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_relationships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_relationships_user_related_type_key" ON "work_relationships"("user_id", "related_user_id", "relationship_type");
CREATE INDEX "work_relationships_user_id_idx" ON "work_relationships"("user_id");
CREATE INDEX "work_relationships_related_user_id_idx" ON "work_relationships"("related_user_id");
CREATE INDEX "work_relationships_strength_idx" ON "work_relationships"("strength");

CREATE TABLE "warm_introductions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "requester_id" UUID NOT NULL,
    "introducer_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "message" TEXT,
    "context" TEXT,
    "status" "WarmIntroStatus" NOT NULL DEFAULT 'PENDING',
    "job_id" UUID,
    "opportunity_description" TEXT,
    "introducer_response" TEXT,
    "responded_at" TIMESTAMP(3),
    "introduction_made" BOOLEAN NOT NULL DEFAULT false,
    "introduction_made_at" TIMESTAMP(3),
    "resulted_in_engagement" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warm_introductions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "warm_introductions_requester_id_idx" ON "warm_introductions"("requester_id");
CREATE INDEX "warm_introductions_introducer_id_idx" ON "warm_introductions"("introducer_id");
CREATE INDEX "warm_introductions_target_id_idx" ON "warm_introductions"("target_id");
CREATE INDEX "warm_introductions_status_idx" ON "warm_introductions"("status");

CREATE TABLE "team_reunions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "created_by_id" UUID NOT NULL,
    "team_name" VARCHAR(255) NOT NULL,
    "original_project_id" UUID,
    "original_contract_id" UUID,
    "description" TEXT,
    "proposed_project" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'GATHERING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_reunions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "team_reunions_created_by_id_idx" ON "team_reunions"("created_by_id");

CREATE TABLE "team_reunion_members" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "team_reunion_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "original_role" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL DEFAULT 'INVITED',
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_reunion_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_reunion_members_reunion_user_key" ON "team_reunion_members"("team_reunion_id", "user_id");
CREATE INDEX "team_reunion_members_user_id_idx" ON "team_reunion_members"("user_id");

-- ============================================================================
-- OUTCOME INTELLIGENCE TABLES
-- ============================================================================

CREATE TABLE "engagement_outcomes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID,
    "executive_engagement_id" UUID,
    "client_id" UUID NOT NULL,
    "freelancer_id" UUID NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_on_time" BOOLEAN,
    "completed_on_budget" BOOLEAN,
    "client_rating" DECIMAL(3,2),
    "freelancer_rating" DECIMAL(3,2),
    "communication_score" INTEGER,
    "delivery_quality_score" INTEGER,
    "overall_success_score" INTEGER,
    "repeat_engagement" BOOLEAN NOT NULL DEFAULT false,
    "referral_generated" BOOLEAN NOT NULL DEFAULT false,
    "dispute_occurred" BOOLEAN NOT NULL DEFAULT false,
    "early_termination" BOOLEAN NOT NULL DEFAULT false,
    "termination_reason" VARCHAR(255),
    "original_budget" DECIMAL(14,2),
    "final_amount" DECIMAL(14,2),
    "budget_variance" DECIMAL(14,2),
    "original_duration" INTEGER,
    "actual_duration" INTEGER,
    "duration_variance" INTEGER,
    "feature_vector" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "engagement_outcomes_client_id_idx" ON "engagement_outcomes"("client_id");
CREATE INDEX "engagement_outcomes_freelancer_id_idx" ON "engagement_outcomes"("freelancer_id");
CREATE INDEX "engagement_outcomes_overall_success_score_idx" ON "engagement_outcomes"("overall_success_score");

CREATE TABLE "success_predictions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "job_id" UUID,
    "bid_id" UUID,
    "client_id" UUID NOT NULL,
    "freelancer_id" UUID NOT NULL,
    "overall_score" INTEGER NOT NULL,
    "confidence_level" DECIMAL(5,4) NOT NULL,
    "skill_match_score" INTEGER,
    "experience_match_score" INTEGER,
    "budget_alignment_score" INTEGER,
    "communication_prediction" INTEGER,
    "timeline_feasibility" INTEGER,
    "risk_factors" JSONB,
    "risk_level" VARCHAR(20) NOT NULL DEFAULT 'LOW',
    "recommendations" JSONB,
    "model_version" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "success_predictions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "success_predictions_job_id_idx" ON "success_predictions"("job_id");
CREATE INDEX "success_predictions_overall_score_idx" ON "success_predictions"("overall_score");

CREATE TABLE "engagement_risk_alerts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID,
    "executive_engagement_id" UUID,
    "alert_type" VARCHAR(100) NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detection_source" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "actions_taken" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_risk_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "engagement_risk_alerts_contract_id_idx" ON "engagement_risk_alerts"("contract_id");
CREATE INDEX "engagement_risk_alerts_severity_idx" ON "engagement_risk_alerts"("severity");
CREATE INDEX "engagement_risk_alerts_status_idx" ON "engagement_risk_alerts"("status");

-- ============================================================================
-- TALENT POOLS TABLES
-- ============================================================================

CREATE TABLE "talent_pools" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "pool_type" "TalentPoolType" NOT NULL,
    "entry_criteria" JSONB NOT NULL,
    "min_trust_score" INTEGER,
    "min_completed_projects" INTEGER,
    "min_rating" DECIMAL(3,2),
    "required_verifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "platform_fee_discount" DECIMAL(5,2),
    "featured_placement" BOOLEAN NOT NULL DEFAULT false,
    "priority_support" BOOLEAN NOT NULL DEFAULT false,
    "exclusive_job_access" BOOLEAN NOT NULL DEFAULT false,
    "badge_id" VARCHAR(100),
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "application_count" INTEGER NOT NULL DEFAULT 0,
    "acceptance_rate" DECIMAL(5,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_pools_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "talent_pools_slug_key" ON "talent_pools"("slug");
CREATE INDEX "talent_pools_pool_type_idx" ON "talent_pools"("pool_type");

CREATE TABLE "talent_pool_memberships" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pool_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "PoolMembershipStatus" NOT NULL DEFAULT 'APPLIED',
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" UUID,
    "approved_at" TIMESTAMP(3),
    "application_note" TEXT,
    "rejection_reason" TEXT,
    "pool_rating" DECIMAL(3,2),
    "projects_completed" INTEGER NOT NULL DEFAULT 0,
    "last_active_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_pool_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "talent_pool_memberships_pool_user_key" ON "talent_pool_memberships"("pool_id", "user_id");
CREATE INDEX "talent_pool_memberships_status_idx" ON "talent_pool_memberships"("status");

-- ============================================================================
-- AI COPILOT TABLES
-- ============================================================================

CREATE TABLE "copilot_interactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "interaction_type" "CopilotInteractionType" NOT NULL,
    "context_type" VARCHAR(50),
    "context_id" UUID,
    "user_input" TEXT,
    "context_data" JSONB,
    "ai_response" TEXT NOT NULL,
    "model_used" VARCHAR(100) NOT NULL,
    "tokens_used" INTEGER,
    "was_helpful" BOOLEAN,
    "was_used" BOOLEAN,
    "user_feedback" TEXT,
    "resulted_in_success" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_interactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "copilot_interactions_user_id_idx" ON "copilot_interactions"("user_id");
CREATE INDEX "copilot_interactions_interaction_type_idx" ON "copilot_interactions"("interaction_type");

CREATE TABLE "proposal_drafts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "generated_cover_letter" TEXT NOT NULL,
    "suggested_rate" DECIMAL(10,2),
    "suggested_milestones" JSONB,
    "key_points_highlighted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "match_score" INTEGER NOT NULL,
    "win_probability" DECIMAL(5,4),
    "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    "submitted_bid_id" UUID,
    "variant" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proposal_drafts_user_id_idx" ON "proposal_drafts"("user_id");
CREATE INDEX "proposal_drafts_job_id_idx" ON "proposal_drafts"("job_id");

-- ============================================================================
-- CLIENT GUARANTEES TABLES
-- ============================================================================

CREATE TABLE "client_guarantees" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "guarantee_type" "GuaranteeType" NOT NULL,
    "coverage_amount" DECIMAL(14,2) NOT NULL,
    "coverage_percentage" DECIMAL(5,2),
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "terms" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "claims_made" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_guarantees_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_guarantees_contract_id_idx" ON "client_guarantees"("contract_id");
CREATE INDEX "client_guarantees_guarantee_type_idx" ON "client_guarantees"("guarantee_type");

CREATE TABLE "guarantee_claims" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "guarantee_id" UUID NOT NULL,
    "claimant_id" UUID NOT NULL,
    "claim_reason" TEXT NOT NULL,
    "evidence" JSONB,
    "requested_amount" DECIMAL(14,2),
    "requested_action" VARCHAR(100),
    "status" "GuaranteeClaimStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "approved_amount" DECIMAL(14,2),
    "resolution_type" VARCHAR(100),
    "resolution_notes" TEXT,
    "replacement_freelancer_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guarantee_claims_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "guarantee_claims_guarantee_id_idx" ON "guarantee_claims"("guarantee_id");
CREATE INDEX "guarantee_claims_status_idx" ON "guarantee_claims"("status");

-- ============================================================================
-- CERTIFICATION TABLES
-- ============================================================================

CREATE TABLE "skillancer_certifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "level" "CertificationLevel" NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "requirements" JSONB NOT NULL,
    "required_assessments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required_projects" INTEGER,
    "required_experience" INTEGER,
    "portfolio_required" BOOLEAN NOT NULL DEFAULT false,
    "has_assessment" BOOLEAN NOT NULL DEFAULT true,
    "assessment_duration" INTEGER,
    "passing_score" INTEGER,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "retake_wait_days" INTEGER NOT NULL DEFAULT 14,
    "validity_months" INTEGER,
    "renewal_required" BOOLEAN NOT NULL DEFAULT false,
    "badge_image_url" VARCHAR(500),
    "certificate_template" VARCHAR(100),
    "total_certified" INTEGER NOT NULL DEFAULT 0,
    "active_holders" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skillancer_certifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skillancer_certifications_slug_key" ON "skillancer_certifications"("slug");
CREATE INDEX "skillancer_certifications_level_idx" ON "skillancer_certifications"("level");
CREATE INDEX "skillancer_certifications_category_idx" ON "skillancer_certifications"("category");

CREATE TABLE "certification_attempts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "certification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "CertificationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" INTEGER,
    "max_score" INTEGER,
    "percentage_score" DECIMAL(5,2),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "time_spent_minutes" INTEGER,
    "passed" BOOLEAN,
    "feedback" TEXT,
    "detailed_results" JSONB,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certification_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "certification_attempts_user_id_idx" ON "certification_attempts"("user_id");
CREATE INDEX "certification_attempts_certification_id_idx" ON "certification_attempts"("certification_id");

CREATE TABLE "user_certifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "certification_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "earned_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "last_renewed_at" TIMESTAMP(3),
    "certificate_number" VARCHAR(50) NOT NULL,
    "certificate_url" VARCHAR(500),
    "verification_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_certifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_certifications_certificate_number_key" ON "user_certifications"("certificate_number");
CREATE UNIQUE INDEX "user_certifications_user_certification_key" ON "user_certifications"("user_id", "certification_id");
CREATE INDEX "user_certifications_status_idx" ON "user_certifications"("status");

-- ============================================================================
-- EXECUTIVE SUBSCRIPTION TABLES
-- ============================================================================

CREATE TABLE "executive_subscriptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "tier" "ExecutiveTier" NOT NULL DEFAULT 'BASIC',
    "billing_cycle" "ExecutiveBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "stripe_subscription_id" VARCHAR(255),
    "stripe_customer_id" VARCHAR(255),
    "max_clients" INTEGER NOT NULL DEFAULT 3,
    "skillpod_hours_included" INTEGER NOT NULL DEFAULT 20,
    "skillpod_hours_used" INTEGER NOT NULL DEFAULT 0,
    "team_members_included" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "executive_subscriptions_user_id_key" ON "executive_subscriptions"("user_id");
CREATE UNIQUE INDEX "executive_subscriptions_stripe_subscription_id_key" ON "executive_subscriptions"("stripe_subscription_id");

CREATE TABLE "executive_addons" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "subscription_id" UUID NOT NULL,
    "addon_type" "ExecutiveAddonType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_per_unit" DECIMAL(10,2) NOT NULL,
    "stripe_item_id" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_addons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "executive_addons_subscription_id_idx" ON "executive_addons"("subscription_id");

CREATE TABLE "executive_usage_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "subscription_id" UUID NOT NULL,
    "usage_type" VARCHAR(50) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "billed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executive_usage_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "executive_usage_records_subscription_id_idx" ON "executive_usage_records"("subscription_id");
CREATE INDEX "executive_usage_records_period_idx" ON "executive_usage_records"("period_start", "period_end");

-- ============================================================================
-- BENCHMARKING TABLES
-- ============================================================================

CREATE TABLE "market_benchmarks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "skill" VARCHAR(100),
    "skill_category" VARCHAR(100),
    "experience_level" VARCHAR(50),
    "region" VARCHAR(100),
    "industry" VARCHAR(100),
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "rate_min" DECIMAL(10,2) NOT NULL,
    "rate_max" DECIMAL(10,2) NOT NULL,
    "rate_median" DECIMAL(10,2) NOT NULL,
    "rate_mean" DECIMAL(10,2) NOT NULL,
    "rate_25th_percentile" DECIMAL(10,2) NOT NULL,
    "rate_75th_percentile" DECIMAL(10,2) NOT NULL,
    "demand_score" INTEGER,
    "demand_trend" VARCHAR(20),
    "job_post_count" INTEGER,
    "avg_time_to_hire" INTEGER,
    "freelancer_count" INTEGER,
    "avg_availability" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_benchmarks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "market_benchmarks_skill_idx" ON "market_benchmarks"("skill");
CREATE INDEX "market_benchmarks_skill_category_idx" ON "market_benchmarks"("skill_category");
CREATE INDEX "market_benchmarks_period_idx" ON "market_benchmarks"("period_start", "period_end");

CREATE TABLE "insight_reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "report_type" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "summary" TEXT,
    "key_findings" JSONB,
    "full_report_url" VARCHAR(500),
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "requires_subscription" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insight_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "insight_reports_slug_key" ON "insight_reports"("slug");
CREATE INDEX "insight_reports_report_type_idx" ON "insight_reports"("report_type");
CREATE INDEX "insight_reports_published_at_idx" ON "insight_reports"("published_at");

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Executive Suite
ALTER TABLE "executive_profiles" ADD CONSTRAINT "executive_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "executive_references" ADD CONSTRAINT "executive_references_executive_profile_id_fkey" FOREIGN KEY ("executive_profile_id") REFERENCES "executive_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "executive_engagements" ADD CONSTRAINT "executive_engagements_executive_profile_id_fkey" FOREIGN KEY ("executive_profile_id") REFERENCES "executive_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "executive_engagements" ADD CONSTRAINT "executive_engagements_client_tenant_id_fkey" FOREIGN KEY ("client_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "executive_engagements" ADD CONSTRAINT "executive_engagements_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "executive_workspaces" ADD CONSTRAINT "executive_workspaces_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "executive_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "executive_time_entries" ADD CONSTRAINT "executive_time_entries_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "executive_engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "executive_milestones" ADD CONSTRAINT "executive_milestones_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "executive_engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "executive_tool_configs" ADD CONSTRAINT "executive_tool_configs_executive_profile_id_fkey" FOREIGN KEY ("executive_profile_id") REFERENCES "executive_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integration Hub
ALTER TABLE "executive_integrations" ADD CONSTRAINT "executive_integrations_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "executive_engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "executive_integrations" ADD CONSTRAINT "executive_integrations_integration_type_id_fkey" FOREIGN KEY ("integration_type_id") REFERENCES "integration_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Financial Services
ALTER TABLE "skillancer_cards" ADD CONSTRAINT "skillancer_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "skillancer_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_financing" ADD CONSTRAINT "invoice_financing_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_vaults" ADD CONSTRAINT "tax_vaults_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_vault_deposits" ADD CONSTRAINT "tax_vault_deposits_tax_vault_id_fkey" FOREIGN KEY ("tax_vault_id") REFERENCES "tax_vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_vault_withdrawals" ADD CONSTRAINT "tax_vault_withdrawals_tax_vault_id_fkey" FOREIGN KEY ("tax_vault_id") REFERENCES "tax_vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Talent Graph
ALTER TABLE "work_relationships" ADD CONSTRAINT "work_relationships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_relationships" ADD CONSTRAINT "work_relationships_related_user_id_fkey" FOREIGN KEY ("related_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warm_introductions" ADD CONSTRAINT "warm_introductions_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warm_introductions" ADD CONSTRAINT "warm_introductions_introducer_id_fkey" FOREIGN KEY ("introducer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warm_introductions" ADD CONSTRAINT "warm_introductions_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_reunions" ADD CONSTRAINT "team_reunions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_reunion_members" ADD CONSTRAINT "team_reunion_members_team_reunion_id_fkey" FOREIGN KEY ("team_reunion_id") REFERENCES "team_reunions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_reunion_members" ADD CONSTRAINT "team_reunion_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Outcome Intelligence
ALTER TABLE "engagement_outcomes" ADD CONSTRAINT "engagement_outcomes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "engagement_outcomes" ADD CONSTRAINT "engagement_outcomes_freelancer_id_fkey" FOREIGN KEY ("freelancer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "success_predictions" ADD CONSTRAINT "success_predictions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "success_predictions" ADD CONSTRAINT "success_predictions_freelancer_id_fkey" FOREIGN KEY ("freelancer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Talent Pools
ALTER TABLE "talent_pool_memberships" ADD CONSTRAINT "talent_pool_memberships_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "talent_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "talent_pool_memberships" ADD CONSTRAINT "talent_pool_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AI Copilot
ALTER TABLE "copilot_interactions" ADD CONSTRAINT "copilot_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Client Guarantees
ALTER TABLE "guarantee_claims" ADD CONSTRAINT "guarantee_claims_guarantee_id_fkey" FOREIGN KEY ("guarantee_id") REFERENCES "client_guarantees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guarantee_claims" ADD CONSTRAINT "guarantee_claims_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Certifications
ALTER TABLE "certification_attempts" ADD CONSTRAINT "certification_attempts_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "skillancer_certifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certification_attempts" ADD CONSTRAINT "certification_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_certifications" ADD CONSTRAINT "user_certifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_certifications" ADD CONSTRAINT "user_certifications_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "skillancer_certifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Executive Subscriptions
ALTER TABLE "executive_subscriptions" ADD CONSTRAINT "executive_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "executive_addons" ADD CONSTRAINT "executive_addons_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "executive_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "executive_usage_records" ADD CONSTRAINT "executive_usage_records_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "executive_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
