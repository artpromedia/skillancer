-- ==================== Analytics ClickHouse Schema ====================
-- Infrastructure/clickhouse/schemas/analytics.sql

-- Page Views Table
CREATE TABLE IF NOT EXISTS analytics.page_views
(
    event_id UUID,
    event_type LowCardinality(String),
    timestamp DateTime64(3),
    received_at DateTime64(3),
    event_date Date,
    event_hour UInt8,
    event_day_of_week UInt8,
    user_id String,
    anonymous_id String,
    session_id String,
    user_identifier String,
    is_identified UInt8,
    platform LowCardinality(String),
    device_type LowCardinality(String),
    browser LowCardinality(String),
    os LowCardinality(String),
    country LowCardinality(String),
    page_path String,
    page_url String,
    page_title String,
    referrer String,
    utm_source LowCardinality(String),
    utm_medium LowCardinality(String),
    utm_campaign LowCardinality(String),
    properties String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, platform, user_identifier, timestamp)
TTL event_date + INTERVAL 2 YEAR;

-- Learning Events Table
CREATE TABLE IF NOT EXISTS analytics.learning_events
(
    event_id UUID,
    event_type LowCardinality(String),
    timestamp DateTime64(3),
    event_date Date,
    user_id String,
    anonymous_id String,
    session_id String,
    course_id String,
    course_title String,
    course_category LowCardinality(String),
    lesson_id String,
    lesson_title String,
    lesson_type LowCardinality(String),
    duration UInt32,
    progress Float32,
    score Float32,
    passed UInt8,
    properties String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_type, user_id, course_id, timestamp)
TTL event_date + INTERVAL 2 YEAR;

-- Video Events Table
CREATE TABLE IF NOT EXISTS analytics.video_events
(
    event_id UUID,
    event_type LowCardinality(String),
    timestamp DateTime64(3),
    event_date Date,
    user_id String,
    session_id String,
    video_id String,
    lesson_id String,
    course_id String,
    position UInt32,
    duration UInt32,
    percent_complete Float32,
    quality LowCardinality(String),
    playback_speed Float32,
    properties String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, video_id, user_id, timestamp)
TTL event_date + INTERVAL 1 YEAR;

-- Marketplace Events Table
CREATE TABLE IF NOT EXISTS analytics.marketplace_events
(
    event_id UUID,
    event_type LowCardinality(String),
    timestamp DateTime64(3),
    event_date Date,
    user_id String,
    session_id String,
    job_id String,
    job_title String,
    job_category LowCardinality(String),
    client_id String,
    proposal_id String,
    contract_id String,
    contract_value Decimal(14, 2),
    currency LowCardinality(String),
    view_source LowCardinality(String),
    properties String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_type, user_id, timestamp)
TTL event_date + INTERVAL 2 YEAR;

-- Conversion Events Table
CREATE TABLE IF NOT EXISTS analytics.conversion_events
(
    event_id UUID,
    event_type LowCardinality(String),
    timestamp DateTime64(3),
    event_date Date,
    user_id String,
    anonymous_id String,
    step_number UInt8,
    step_name String,
    subscription_plan LowCardinality(String),
    subscription_value Decimal(10, 2),
    referral_source String,
    properties String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_type, user_id, timestamp)
TTL event_date + INTERVAL 3 YEAR;

-- Search Events Table
CREATE TABLE IF NOT EXISTS analytics.search_events
(
    event_id UUID,
    event_type LowCardinality(String),
    timestamp DateTime64(3),
    event_date Date,
    user_id String,
    session_id String,
    search_type LowCardinality(String),
    query String,
    results_count UInt32,
    result_position UInt16,
    result_id String,
    response_time UInt32,
    properties String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, search_type, user_id, timestamp)
TTL event_date + INTERVAL 1 YEAR;

-- Daily User Metrics (Aggregation)
CREATE TABLE IF NOT EXISTS analytics.daily_user_metrics
(
    date Date,
    user_id String,
    platform LowCardinality(String),
    sessions UInt32,
    page_views UInt32,
    unique_pages UInt32,
    lessons_completed UInt32,
    video_minutes UInt32,
    jobs_viewed UInt32,
    proposals_submitted UInt32,
    revenue Decimal(14, 2)
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, user_id, platform);

-- Hourly Platform Metrics
CREATE TABLE IF NOT EXISTS analytics.hourly_platform_metrics
(
    datetime DateTime,
    platform LowCardinality(String),
    unique_users UInt32,
    new_users UInt32,
    sessions UInt32,
    total_events UInt64,
    page_views UInt32,
    course_enrollments UInt32,
    proposals_submitted UInt32,
    gmv Decimal(14, 2)
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(toDate(datetime))
ORDER BY (datetime, platform);

-- User Cohorts
CREATE TABLE IF NOT EXISTS analytics.user_cohorts
(
    user_id String,
    cohort_date Date,
    cohort_week Date,
    cohort_month Date,
    signup_source LowCardinality(String),
    account_type LowCardinality(String),
    lifetime_value Decimal(14, 2) DEFAULT 0,
    total_sessions UInt32 DEFAULT 0,
    last_active_date Date,
    is_churned UInt8 DEFAULT 0
)
ENGINE = ReplacingMergeTree(last_active_date)
ORDER BY (user_id);

-- Retention Cohorts
CREATE TABLE IF NOT EXISTS analytics.retention_cohorts
(
    cohort_date Date,
    cohort_size UInt32,
    period_number UInt16,
    period_type LowCardinality(String),
    retained_users UInt32,
    retention_rate Float32,
    segment LowCardinality(String) DEFAULT 'all'
)
ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(cohort_date)
ORDER BY (cohort_date, period_type, period_number, segment);

-- Funnel Metrics
CREATE TABLE IF NOT EXISTS analytics.funnel_metrics
(
    date Date,
    funnel_name LowCardinality(String),
    step_number UInt8,
    step_name String,
    users_entered UInt32,
    users_completed UInt32,
    completion_rate Float32,
    segment LowCardinality(String) DEFAULT 'all'
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, funnel_name, step_number, segment);
