-- ============================================================================
-- SkillPod B2B Enterprise Schema Migration
-- Sprint M3: Product Packaging for Enterprise Customers
-- ============================================================================

-- ============================================================================
-- SKILLPOD TENANTS (B2B CUSTOMERS)
-- ============================================================================

CREATE TABLE skillpod_tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200),
    logo_url VARCHAR(500),
    domain VARCHAR(255),
    industry VARCHAR(100),
    company_size VARCHAR(50), -- small, medium, large, enterprise
    
    -- Plan & Status
    plan VARCHAR(50) NOT NULL DEFAULT 'TRIAL', -- STARTER, PRO, ENTERPRISE, TRIAL
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, CHURNED
    subscription_status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, PAST_DUE, CANCELED
    
    -- Limits
    max_users INTEGER NOT NULL DEFAULT 10,
    max_sessions INTEGER NOT NULL DEFAULT 100,
    max_policies INTEGER NOT NULL DEFAULT 5,
    max_storage_gb INTEGER NOT NULL DEFAULT 10,
    
    -- Features (JSON for flexibility)
    features JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Billing
    stripe_customer_id VARCHAR(100) UNIQUE,
    stripe_subscription_id VARCHAR(100),
    billing_email VARCHAR(255),
    billing_address JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Indexes
    CHECK (plan IN ('STARTER', 'PRO', 'ENTERPRISE', 'TRIAL'))
);

CREATE INDEX idx_skillpod_tenants_slug ON skillpod_tenants(slug);
CREATE INDEX idx_skillpod_tenants_plan ON skillpod_tenants(plan);
CREATE INDEX idx_skillpod_tenants_status ON skillpod_tenants(status);
CREATE INDEX idx_skillpod_tenants_deleted_at ON skillpod_tenants(deleted_at);

-- ============================================================================
-- SKILLPOD TENANT USERS
-- ============================================================================

CREATE TABLE skillpod_tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES skillpod_tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Link to main user table
    
    -- User details (for invited but not yet joined users)
    email VARCHAR(255) NOT NULL,
    name VARCHAR(200),
    
    -- Role & Status
    role VARCHAR(50) NOT NULL DEFAULT 'USER', -- SUPER_ADMIN, ADMIN, USER, VIEWER
    status VARCHAR(50) NOT NULL DEFAULT 'INVITED', -- ACTIVE, INVITED, DISABLED
    
    -- SSO Linking
    sso_linked BOOLEAN NOT NULL DEFAULT FALSE,
    sso_provider VARCHAR(50), -- okta, azure_ad, google, onelogin
    sso_external_id VARCHAR(255),
    
    -- Groups for policy assignment
    groups TEXT[] NOT NULL DEFAULT '{}',
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    joined_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    disabled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_skillpod_tenant_users_tenant ON skillpod_tenant_users(tenant_id);
CREATE INDEX idx_skillpod_tenant_users_user ON skillpod_tenant_users(user_id);
CREATE INDEX idx_skillpod_tenant_users_status ON skillpod_tenant_users(status);
CREATE INDEX idx_skillpod_tenant_users_sso ON skillpod_tenant_users(sso_external_id);

-- ============================================================================
-- SKILLPOD TRIALS
-- ============================================================================

CREATE TABLE skillpod_trials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES skillpod_tenants(id) ON DELETE CASCADE,
    
    -- Trial State
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, EXTENDED, CONVERTED, EXPIRED, CANCELED
    
    -- Dates
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    extended_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    
    -- Extensions
    extension_count INTEGER NOT NULL DEFAULT 0,
    extension_reason TEXT,
    
    -- Conversion Target
    target_plan VARCHAR(50) DEFAULT 'PRO',
    
    -- Engagement Tracking
    engagement_score INTEGER NOT NULL DEFAULT 0, -- 0-100
    conversion_likelihood VARCHAR(20) DEFAULT 'low', -- low, medium, high
    
    -- Metrics snapshot for analytics
    metrics_snapshot JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skillpod_trials_status ON skillpod_trials(status);
CREATE INDEX idx_skillpod_trials_expires_at ON skillpod_trials(expires_at);

-- ============================================================================
-- SKILLPOD SSO CONFIGURATIONS
-- ============================================================================

CREATE TABLE skillpod_sso_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES skillpod_tenants(id) ON DELETE CASCADE,
    
    -- SSO Type
    provider_type VARCHAR(50) NOT NULL, -- SAML, OIDC
    provider_name VARCHAR(100), -- okta, azure_ad, google, onelogin, custom
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- DRAFT, CONFIGURED, TESTING, ACTIVE, DISABLED
    
    -- SAML Configuration
    saml_entity_id VARCHAR(500),
    saml_sso_url VARCHAR(500),
    saml_certificate TEXT,
    saml_metadata_url VARCHAR(500),
    
    -- OIDC Configuration
    oidc_issuer VARCHAR(500),
    oidc_client_id VARCHAR(255),
    oidc_client_secret_encrypted TEXT, -- Encrypted
    oidc_discovery_url VARCHAR(500),
    
    -- Attribute Mapping
    attribute_mapping JSONB NOT NULL DEFAULT '{}',
    
    -- Settings
    auto_provision_users BOOLEAN NOT NULL DEFAULT TRUE,
    force_sso BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_domains TEXT[] NOT NULL DEFAULT '{}',
    
    -- Test Results
    last_test_at TIMESTAMPTZ,
    last_test_result JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ
);

CREATE INDEX idx_skillpod_sso_configs_tenant ON skillpod_sso_configs(tenant_id);
CREATE INDEX idx_skillpod_sso_configs_status ON skillpod_sso_configs(status);

-- ============================================================================
-- SKILLPOD API KEYS
-- ============================================================================

CREATE TABLE skillpod_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES skillpod_tenants(id) ON DELETE CASCADE,
    
    -- Key Identity
    name VARCHAR(200) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL, -- First 8 chars for display (skpd_xxx...)
    key_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of full key
    
    -- Scopes
    scopes TEXT[] NOT NULL DEFAULT '{read}',
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REVOKED, EXPIRED
    
    -- Security
    allowed_ips TEXT[],
    rate_limit_per_minute INTEGER DEFAULT 500,
    
    -- Usage
    last_used_at TIMESTAMPTZ,
    request_count BIGINT NOT NULL DEFAULT 0,
    
    -- Expiration
    expires_at TIMESTAMPTZ,
    
    -- Audit
    created_by UUID REFERENCES skillpod_tenant_users(id),
    revoked_by UUID REFERENCES skillpod_tenant_users(id),
    revoked_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skillpod_api_keys_tenant ON skillpod_api_keys(tenant_id);
CREATE INDEX idx_skillpod_api_keys_key_hash ON skillpod_api_keys(key_hash);
CREATE INDEX idx_skillpod_api_keys_status ON skillpod_api_keys(status);
CREATE INDEX idx_skillpod_api_keys_prefix ON skillpod_api_keys(key_prefix);

-- ============================================================================
-- SKILLPOD WEBHOOKS
-- ============================================================================

CREATE TABLE skillpod_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES skillpod_tenants(id) ON DELETE CASCADE,
    
    -- Configuration
    url VARCHAR(500) NOT NULL,
    secret_hash VARCHAR(64), -- For signature verification
    events TEXT[] NOT NULL DEFAULT '{}',
    headers JSONB NOT NULL DEFAULT '{}',
    
    -- Status
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Health
    last_triggered_at TIMESTAMPTZ,
    last_response_code INTEGER,
    last_response_time_ms INTEGER,
    failure_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skillpod_webhooks_tenant ON skillpod_webhooks(tenant_id);
CREATE INDEX idx_skillpod_webhooks_enabled ON skillpod_webhooks(enabled);

-- ============================================================================
-- SKILLPOD WEBHOOK EVENTS (DELIVERY LOG)
-- ============================================================================

CREATE TABLE skillpod_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES skillpod_webhooks(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES skillpod_tenants(id) ON DELETE CASCADE,
    
    -- Event
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    
    -- Delivery Status
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, DELIVERED, FAILED, RETRYING
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    
    -- Response
    response_code INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,
    
    -- Error
    error_message TEXT,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ
);

CREATE INDEX idx_skillpod_webhook_events_webhook ON skillpod_webhook_events(webhook_id);
CREATE INDEX idx_skillpod_webhook_events_status ON skillpod_webhook_events(status);
CREATE INDEX idx_skillpod_webhook_events_created ON skillpod_webhook_events(created_at);

-- ============================================================================
-- SKILLPOD ENTERPRISE REPORTS
-- ============================================================================

CREATE TABLE skillpod_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES skillpod_tenants(id) ON DELETE CASCADE,
    
    -- Report Definition
    type VARCHAR(50) NOT NULL, -- usage, security, compliance, executive, user_activity, session_analytics, cost_analysis
    name VARCHAR(200),
    
    -- Parameters
    date_start DATE NOT NULL,
    date_end DATE NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}',
    format VARCHAR(20) NOT NULL DEFAULT 'json', -- json, csv, pdf, xlsx
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, GENERATING, COMPLETED, FAILED
    
    -- Output
    data JSONB,
    file_url VARCHAR(500),
    file_size_bytes BIGINT,
    
    -- Generation Info
    generated_at TIMESTAMPTZ,
    generation_time_ms INTEGER,
    error_message TEXT,
    
    -- Scheduling (for recurring reports)
    schedule_id UUID REFERENCES skillpod_report_schedules(id),
    
    -- Audit
    requested_by UUID REFERENCES skillpod_tenant_users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- For cleanup
);

CREATE INDEX idx_skillpod_reports_tenant ON skillpod_reports(tenant_id);
CREATE INDEX idx_skillpod_reports_type ON skillpod_reports(type);
CREATE INDEX idx_skillpod_reports_status ON skillpod_reports(status);
CREATE INDEX idx_skillpod_reports_created ON skillpod_reports(created_at);

-- ============================================================================
-- SKILLPOD REPORT SCHEDULES
-- ============================================================================

CREATE TABLE skillpod_report_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES skillpod_tenants(id) ON DELETE CASCADE,
    
    -- Schedule Definition
    name VARCHAR(200) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    frequency VARCHAR(20) NOT NULL, -- daily, weekly, monthly
    day_of_week INTEGER, -- 0-6 for weekly
    day_of_month INTEGER, -- 1-31 for monthly
    time_utc TIME NOT NULL DEFAULT '09:00:00',
    
    -- Report Configuration
    filters JSONB NOT NULL DEFAULT '{}',
    format VARCHAR(20) NOT NULL DEFAULT 'pdf',
    
    -- Distribution
    recipients TEXT[] NOT NULL DEFAULT '{}',
    
    -- Status
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Execution
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(50),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skillpod_report_schedules_tenant ON skillpod_report_schedules(tenant_id);
CREATE INDEX idx_skillpod_report_schedules_next_run ON skillpod_report_schedules(next_run_at);
CREATE INDEX idx_skillpod_report_schedules_enabled ON skillpod_report_schedules(enabled);

-- ============================================================================
-- SKILLPOD SECURITY POLICIES (ENTERPRISE)
-- ============================================================================

CREATE TABLE skillpod_enterprise_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES skillpod_tenants(id) ON DELETE CASCADE,
    
    -- Identity
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'custom', -- default, custom
    priority INTEGER NOT NULL DEFAULT 100,
    
    -- Rules (JSON for flexibility)
    rules JSONB NOT NULL DEFAULT '{}',
    -- Example: {
    --   "clipboard": "disabled",
    --   "file_transfer": "disabled",
    --   "watermark": "enabled",
    --   "session_recording": "enabled",
    --   "idle_timeout": 30,
    --   "max_duration": 480,
    --   "allowed_applications": ["vscode", "chrome"],
    --   "network_restrictions": { "allow_internet": false, "allowed_domains": [] }
    -- }
    
    -- Conditions (who this policy applies to)
    conditions JSONB NOT NULL DEFAULT '{}',
    -- Example: {
    --   "user_groups": ["contractors"],
    --   "ip_ranges": ["192.168.0.0/16"],
    --   "time_restrictions": { "days": [...], "hours": {...} }
    -- }
    
    -- Status
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skillpod_enterprise_policies_tenant ON skillpod_enterprise_policies(tenant_id);
CREATE INDEX idx_skillpod_enterprise_policies_priority ON skillpod_enterprise_policies(priority);
CREATE INDEX idx_skillpod_enterprise_policies_enabled ON skillpod_enterprise_policies(enabled);

-- ============================================================================
-- SKILLPOD BILLING EVENTS (USAGE TRACKING)
-- ============================================================================

CREATE TABLE skillpod_billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES skillpod_tenants(id) ON DELETE CASCADE,
    
    -- Event Type
    event_type VARCHAR(50) NOT NULL, -- session_started, user_added, overage_alert, etc.
    
    -- Usage Metrics
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(14, 4) NOT NULL,
    unit VARCHAR(50), -- users, sessions, hours, gb
    
    -- Context
    resource_id UUID,
    resource_type VARCHAR(50),
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Billing Period
    billing_period_start DATE,
    billing_period_end DATE,
    
    -- Timestamps
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skillpod_billing_events_tenant ON skillpod_billing_events(tenant_id);
CREATE INDEX idx_skillpod_billing_events_type ON skillpod_billing_events(event_type);
CREATE INDEX idx_skillpod_billing_events_recorded ON skillpod_billing_events(recorded_at);
CREATE INDEX idx_skillpod_billing_events_period ON skillpod_billing_events(billing_period_start, billing_period_end);

-- ============================================================================
-- SKILLPOD AUDIT LOG (ENTERPRISE)
-- ============================================================================

CREATE TABLE skillpod_enterprise_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES skillpod_tenants(id) ON DELETE CASCADE,
    
    -- Actor
    actor_id UUID REFERENCES skillpod_tenant_users(id),
    actor_type VARCHAR(50) NOT NULL, -- user, api_key, system
    actor_name VARCHAR(200),
    
    -- Action
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    resource_name VARCHAR(200),
    
    -- Details
    changes JSONB,
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    api_key_id UUID REFERENCES skillpod_api_keys(id),
    
    -- Result
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skillpod_enterprise_audit_tenant ON skillpod_enterprise_audit_log(tenant_id);
CREATE INDEX idx_skillpod_enterprise_audit_actor ON skillpod_enterprise_audit_log(actor_id);
CREATE INDEX idx_skillpod_enterprise_audit_action ON skillpod_enterprise_audit_log(action);
CREATE INDEX idx_skillpod_enterprise_audit_resource ON skillpod_enterprise_audit_log(resource_type, resource_id);
CREATE INDEX idx_skillpod_enterprise_audit_created ON skillpod_enterprise_audit_log(created_at);

-- Partition by month for large audit tables (optional, enable in production)
-- CREATE TABLE skillpod_enterprise_audit_log_2024_01 PARTITION OF skillpod_enterprise_audit_log
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- ============================================================================
-- SKILLPOD ONBOARDING PROGRESS
-- ============================================================================

CREATE TABLE skillpod_onboarding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES skillpod_tenants(id) ON DELETE CASCADE,
    
    -- Progress Tracking
    current_step INTEGER NOT NULL DEFAULT 1, -- 1-6
    steps_completed TEXT[] NOT NULL DEFAULT '{}',
    
    -- Step Data (collected during onboarding)
    company_info JSONB NOT NULL DEFAULT '{}',
    team_info JSONB NOT NULL DEFAULT '{}',
    security_preferences JSONB NOT NULL DEFAULT '{}',
    policy_selections TEXT[] NOT NULL DEFAULT '{}',
    plan_selection VARCHAR(50),
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, ABANDONED
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skillpod_onboarding_tenant ON skillpod_onboarding(tenant_id);
CREATE INDEX idx_skillpod_onboarding_status ON skillpod_onboarding(status);

-- ============================================================================
-- ADD UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_skillpod_tenants_updated_at BEFORE UPDATE ON skillpod_tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skillpod_tenant_users_updated_at BEFORE UPDATE ON skillpod_tenant_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skillpod_trials_updated_at BEFORE UPDATE ON skillpod_trials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skillpod_sso_configs_updated_at BEFORE UPDATE ON skillpod_sso_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skillpod_api_keys_updated_at BEFORE UPDATE ON skillpod_api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skillpod_webhooks_updated_at BEFORE UPDATE ON skillpod_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skillpod_report_schedules_updated_at BEFORE UPDATE ON skillpod_report_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skillpod_enterprise_policies_updated_at BEFORE UPDATE ON skillpod_enterprise_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skillpod_onboarding_updated_at BEFORE UPDATE ON skillpod_onboarding
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
