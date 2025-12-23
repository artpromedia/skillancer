-- CreateEnum
CREATE TYPE "MarketContractType" AS ENUM ('HOURLY', 'FIXED_PRICE', 'RETAINER');

-- CreateEnum
CREATE TYPE "MarketContractLinkStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "MarketMilestoneLinkStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'PAID', 'DISPUTED');

-- CreateEnum
CREATE TYPE "MarketTimeLinkStatus" AS ENUM ('PENDING', 'APPROVED', 'DISPUTED', 'PAID');

-- CreateEnum
CREATE TYPE "MarketTimeSource" AS ENUM ('MARKET', 'COCKPIT');

-- CreateEnum
CREATE TYPE "MarketPaymentLinkType" AS ENUM ('MILESTONE', 'HOURLY', 'BONUS', 'RETAINER', 'REFUND');

-- CreateEnum
CREATE TYPE "MarketPaymentLinkStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MarketContractSyncStatus" AS ENUM ('SYNCED', 'PENDING', 'ERROR', 'CONFLICT');

-- CreateTable
CREATE TABLE "market_contract_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "freelancer_user_id" UUID NOT NULL,
    "market_contract_id" TEXT NOT NULL,
    "market_job_id" TEXT,
    "market_client_id" TEXT NOT NULL,
    "project_id" UUID,
    "client_id" UUID,
    "contract_title" VARCHAR(255) NOT NULL,
    "contract_type" "MarketContractType" NOT NULL,
    "contract_status" "MarketContractLinkStatus" NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "hourly_rate" DECIMAL(10,2),
    "fixed_price" DECIMAL(14,2),
    "budget_cap" DECIMAL(14,2),
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "sync_status" "MarketContractSyncStatus" NOT NULL DEFAULT 'SYNCED',
    "sync_error" TEXT,
    "auto_create_project" BOOLEAN NOT NULL DEFAULT true,
    "auto_sync_time" BOOLEAN NOT NULL DEFAULT true,
    "auto_record_payments" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_contract_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_milestone_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_link_id" UUID NOT NULL,
    "market_milestone_id" TEXT NOT NULL,
    "project_milestone_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "MarketMilestoneLinkStatus" NOT NULL,
    "due_date" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_milestone_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_time_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_link_id" UUID NOT NULL,
    "market_time_log_id" TEXT NOT NULL,
    "time_entry_id" UUID,
    "source" "MarketTimeSource" NOT NULL DEFAULT 'MARKET',
    "date" DATE NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "MarketTimeLinkStatus" NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_time_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_payment_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_link_id" UUID NOT NULL,
    "market_payment_id" TEXT NOT NULL,
    "market_invoice_id" TEXT,
    "transaction_id" UUID,
    "invoice_payment_id" UUID,
    "payment_type" "MarketPaymentLinkType" NOT NULL,
    "gross_amount" DECIMAL(14,2) NOT NULL,
    "platform_fee" DECIMAL(14,2) NOT NULL,
    "net_amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "MarketPaymentLinkStatus" NOT NULL,
    "paid_at" TIMESTAMP(3),
    "milestone_link_id" UUID,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_client_cache" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "market_user_id" TEXT NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "company_name" VARCHAR(200),
    "email" VARCHAR(255),
    "avatar_url" VARCHAR(500),
    "country" VARCHAR(100),
    "timezone" VARCHAR(50),
    "total_contracts" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "avg_rating" DECIMAL(3,2),
    "cockpit_client_id" UUID,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_client_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "market_contract_links_market_contract_id_key" ON "market_contract_links"("market_contract_id");

-- CreateIndex
CREATE INDEX "market_contract_links_freelancer_user_id_idx" ON "market_contract_links"("freelancer_user_id");

-- CreateIndex
CREATE INDEX "market_contract_links_project_id_idx" ON "market_contract_links"("project_id");

-- CreateIndex
CREATE INDEX "market_contract_links_contract_status_idx" ON "market_contract_links"("contract_status");

-- CreateIndex
CREATE UNIQUE INDEX "market_milestone_links_contract_link_id_market_milestone_id_key" ON "market_milestone_links"("contract_link_id", "market_milestone_id");

-- CreateIndex
CREATE UNIQUE INDEX "market_time_links_market_time_log_id_key" ON "market_time_links"("market_time_log_id");

-- CreateIndex
CREATE UNIQUE INDEX "market_time_links_time_entry_id_key" ON "market_time_links"("time_entry_id");

-- CreateIndex
CREATE INDEX "market_time_links_contract_link_id_idx" ON "market_time_links"("contract_link_id");

-- CreateIndex
CREATE INDEX "market_time_links_date_idx" ON "market_time_links"("date");

-- CreateIndex
CREATE UNIQUE INDEX "market_payment_links_market_payment_id_key" ON "market_payment_links"("market_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "market_payment_links_transaction_id_key" ON "market_payment_links"("transaction_id");

-- CreateIndex
CREATE INDEX "market_payment_links_contract_link_id_idx" ON "market_payment_links"("contract_link_id");

-- CreateIndex
CREATE INDEX "market_payment_links_paid_at_idx" ON "market_payment_links"("paid_at");

-- CreateIndex
CREATE UNIQUE INDEX "market_client_cache_market_user_id_key" ON "market_client_cache"("market_user_id");

-- AddForeignKey
ALTER TABLE "market_contract_links" ADD CONSTRAINT "market_contract_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cockpit_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_contract_links" ADD CONSTRAINT "market_contract_links_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_milestone_links" ADD CONSTRAINT "market_milestone_links_contract_link_id_fkey" FOREIGN KEY ("contract_link_id") REFERENCES "market_contract_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_milestone_links" ADD CONSTRAINT "market_milestone_links_project_milestone_id_fkey" FOREIGN KEY ("project_milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_time_links" ADD CONSTRAINT "market_time_links_contract_link_id_fkey" FOREIGN KEY ("contract_link_id") REFERENCES "market_contract_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_time_links" ADD CONSTRAINT "market_time_links_time_entry_id_fkey" FOREIGN KEY ("time_entry_id") REFERENCES "cockpit_time_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_payment_links" ADD CONSTRAINT "market_payment_links_contract_link_id_fkey" FOREIGN KEY ("contract_link_id") REFERENCES "market_contract_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_payment_links" ADD CONSTRAINT "market_payment_links_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
