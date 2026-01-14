-- Complete MFA Implementation & Parent Data Rights
-- Adds missing fields to user_mfa, creates trusted_devices table, and parent-student relationships

-- =============================================================================
-- MFA IMPROVEMENTS
-- =============================================================================

-- Add missing fields to user_mfa table
ALTER TABLE "user_mfa" ADD COLUMN IF NOT EXISTS "totp_verified_at" TIMESTAMP(3);
ALTER TABLE "user_mfa" ADD COLUMN IF NOT EXISTS "phone_verified_at" TIMESTAMP(3);
ALTER TABLE "user_mfa" ADD COLUMN IF NOT EXISTS "recovery_email" VARCHAR(255);
ALTER TABLE "user_mfa" ADD COLUMN IF NOT EXISTS "recovery_email_verified" BOOLEAN NOT NULL DEFAULT false;

-- Create trusted_devices table for MFA bypass
CREATE TABLE IF NOT EXISTS "trusted_devices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "device_fingerprint" VARCHAR(64) NOT NULL,
    "device_name" VARCHAR(100) NOT NULL,
    "browser" VARCHAR(50),
    "os" VARCHAR(50),
    "ip_address" VARCHAR(45),
    "location" VARCHAR(100),
    "trusted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" VARCHAR(255),

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- Create indexes for trusted_devices
CREATE UNIQUE INDEX IF NOT EXISTS "trusted_devices_user_id_device_fingerprint_key" ON "trusted_devices"("user_id", "device_fingerprint");
CREATE INDEX IF NOT EXISTS "trusted_devices_user_id_idx" ON "trusted_devices"("user_id");
CREATE INDEX IF NOT EXISTS "trusted_devices_expires_at_idx" ON "trusted_devices"("expires_at");

-- =============================================================================
-- PARENT DATA RIGHTS (FERPA, COPPA, GDPR Compliance)
-- =============================================================================

-- Create enum types for parent relationships
DO $$ BEGIN
    CREATE TYPE "ParentRelationshipType" AS ENUM ('PARENT', 'GUARDIAN', 'LEGAL_CUSTODIAN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ParentRelationshipStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REVOKED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create parent_student_relationships table for FERPA/COPPA/GDPR compliance
CREATE TABLE IF NOT EXISTS "parent_student_relationships" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "parent_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "relationship_type" "ParentRelationshipType" NOT NULL DEFAULT 'PARENT',
    "status" "ParentRelationshipStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',

    -- Verification details
    "verified_at" TIMESTAMP(3),
    "verified_by" UUID,
    "verification_doc" VARCHAR(500),

    -- Consent and permissions
    "can_access_records" BOOLEAN NOT NULL DEFAULT true,
    "can_request_delete" BOOLEAN NOT NULL DEFAULT true,
    "can_receive_alerts" BOOLEAN NOT NULL DEFAULT true,

    -- Audit trail
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" VARCHAR(500),

    CONSTRAINT "parent_student_relationships_pkey" PRIMARY KEY ("id")
);

-- Create indexes for parent_student_relationships
CREATE UNIQUE INDEX IF NOT EXISTS "parent_student_relationships_parent_student_key" ON "parent_student_relationships"("parent_id", "student_id");
CREATE INDEX IF NOT EXISTS "parent_student_relationships_parent_id_idx" ON "parent_student_relationships"("parent_id");
CREATE INDEX IF NOT EXISTS "parent_student_relationships_student_id_idx" ON "parent_student_relationships"("student_id");
CREATE INDEX IF NOT EXISTS "parent_student_relationships_status_idx" ON "parent_student_relationships"("status");
