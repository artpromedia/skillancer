-- AlterTable
ALTER TABLE "portfolio_items" ADD COLUMN     "client_name" VARCHAR(200),
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "display_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "is_confidential" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "thumbnail_url" VARCHAR(500),
ADD COLUMN     "video_url" VARCHAR(500);

-- CreateTable
CREATE TABLE "work_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "company_name" VARCHAR(200) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "location" VARCHAR(200),
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "institution" VARCHAR(200) NOT NULL,
    "degree" VARCHAR(200),
    "field_of_study" VARCHAR(200),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "issuing_organization" VARCHAR(200) NOT NULL,
    "credential_id" VARCHAR(200),
    "credential_url" VARCHAR(500),
    "issue_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_history_user_id_idx" ON "work_history"("user_id");

-- CreateIndex
CREATE INDEX "education_user_id_idx" ON "education"("user_id");

-- CreateIndex
CREATE INDEX "certifications_user_id_idx" ON "certifications"("user_id");

-- CreateIndex
CREATE INDEX "certifications_is_verified_idx" ON "certifications"("is_verified");

-- CreateIndex
CREATE INDEX "portfolio_items_is_featured_idx" ON "portfolio_items"("is_featured");

-- AddForeignKey
ALTER TABLE "work_history" ADD CONSTRAINT "work_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education" ADD CONSTRAINT "education_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
