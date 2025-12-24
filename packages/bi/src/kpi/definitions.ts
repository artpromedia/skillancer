/**
 * @module @skillancer/bi/kpi
 * KPI definitions for all business areas
 */

import type { KPIDefinition } from './types.js';

// ==================== Revenue KPIs ====================

export const revenueKPIs: KPIDefinition[] = [
  {
    id: 'gmv',
    name: 'Gross Merchandise Value',
    description: 'Total value of all transactions on the platform',
    category: 'revenue',
    query: `SELECT sum(contract_value) as value FROM analytics.marketplace_events 
            WHERE event_type IN ('contract_created', 'contract_completed') 
            AND event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'sum',
    format: 'currency',
    decimals: 0,
    currency: 'USD',
    supportedGranularities: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    defaultGranularity: 'monthly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'growth_rate',
    thresholds: {
      warning: { operator: 'lt', value: 0.9 },
      critical: { operator: 'lt', value: 0.7 },
    },
    visibility: 'executive',
    relatedKPIs: ['platform_revenue', 'take_rate', 'avg_contract_value'],
    dimensions: ['platform', 'category', 'country', 'contract_type'],
    tags: ['north-star', 'financial', 'marketplace'],
  },
  {
    id: 'platform_revenue',
    name: 'Platform Revenue',
    description: 'Total revenue from platform fees and commissions',
    category: 'revenue',
    query: `SELECT sum(platform_fee) as value FROM analytics.marketplace_events 
            WHERE event_type = 'contract_payment_received' 
            AND event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'sum',
    format: 'currency',
    decimals: 0,
    currency: 'USD',
    supportedGranularities: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    defaultGranularity: 'monthly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'fixed',
    visibility: 'executive',
    relatedKPIs: ['gmv', 'take_rate'],
    dimensions: ['platform', 'payment_type'],
    tags: ['financial', 'core'],
  },
  {
    id: 'mrr',
    name: 'Monthly Recurring Revenue',
    description: 'Revenue from active subscriptions',
    category: 'revenue',
    query: `SELECT sum(subscription_value) as value FROM analytics.conversion_events 
            WHERE event_type = 'subscription_started' AND subscription_plan != 'free' 
            AND event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'sum',
    format: 'currency',
    decimals: 0,
    currency: 'USD',
    supportedGranularities: ['monthly', 'quarterly', 'yearly'],
    defaultGranularity: 'monthly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'growth_rate',
    visibility: 'executive',
    relatedKPIs: ['arr', 'subscription_churn_rate', 'arpu'],
    tags: ['financial', 'subscriptions', 'saas'],
  },
  {
    id: 'arpu',
    name: 'Average Revenue Per User',
    description: 'Average revenue generated per active user',
    category: 'revenue',
    query: `SELECT sum(platform_fee) / nullIf(uniq(user_id), 0) as value 
            FROM analytics.marketplace_events 
            WHERE event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'custom',
    format: 'currency',
    decimals: 2,
    currency: 'USD',
    supportedGranularities: ['monthly', 'quarterly', 'yearly'],
    defaultGranularity: 'monthly',
    comparisonType: 'previous_period',
    hasTarget: false,
    visibility: 'internal',
    tags: ['financial', 'efficiency'],
  },
];

// ==================== Growth KPIs ====================

export const growthKPIs: KPIDefinition[] = [
  {
    id: 'new_users',
    name: 'New User Signups',
    description: 'Number of new user registrations',
    category: 'growth',
    query: `SELECT count() as value FROM analytics.conversion_events 
            WHERE event_type = 'signup_completed' 
            AND event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'count',
    format: 'number',
    decimals: 0,
    supportedGranularities: ['daily', 'weekly', 'monthly'],
    defaultGranularity: 'weekly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'growth_rate',
    thresholds: {
      warning: { operator: 'lt', value: 0.85 },
      critical: { operator: 'lt', value: 0.7 },
    },
    visibility: 'internal',
    relatedKPIs: ['signup_conversion_rate', 'cac'],
    dimensions: ['platform', 'signup_source', 'country', 'account_type'],
    tags: ['growth', 'acquisition'],
  },
  {
    id: 'dau',
    name: 'Daily Active Users',
    description: 'Number of unique users active per day',
    category: 'growth',
    query: `SELECT uniq(user_identifier) as value FROM analytics.page_views 
            WHERE event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'distinct',
    format: 'number',
    decimals: 0,
    supportedGranularities: ['daily'],
    defaultGranularity: 'daily',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'growth_rate',
    visibility: 'internal',
    relatedKPIs: ['wau', 'mau', 'dau_mau_ratio'],
    dimensions: ['platform'],
    tags: ['growth', 'engagement'],
  },
  {
    id: 'mau',
    name: 'Monthly Active Users',
    description: 'Number of unique users active per month',
    category: 'growth',
    query: `SELECT uniq(user_identifier) as value FROM analytics.page_views 
            WHERE event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'distinct',
    format: 'number',
    decimals: 0,
    supportedGranularities: ['monthly'],
    defaultGranularity: 'monthly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'growth_rate',
    visibility: 'executive',
    relatedKPIs: ['dau', 'wau', 'dau_mau_ratio'],
    dimensions: ['platform', 'country'],
    tags: ['growth', 'engagement', 'north-star'],
  },
  {
    id: 'activation_rate',
    name: 'Activation Rate',
    description: 'Percentage of signups that complete activation milestone',
    category: 'growth',
    query: `SELECT countIf(event_type = 'onboarding_completed') / 
            nullIf(countIf(event_type = 'signup_completed'), 0) * 100 as value 
            FROM analytics.conversion_events 
            WHERE event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'custom',
    format: 'percent',
    decimals: 1,
    supportedGranularities: ['weekly', 'monthly'],
    defaultGranularity: 'weekly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'fixed',
    visibility: 'internal',
    relatedKPIs: ['signup_conversion_rate', 'time_to_activation'],
    dimensions: ['platform', 'signup_source', 'account_type'],
    tags: ['growth', 'activation', 'funnel'],
  },
];

// ==================== Retention KPIs ====================

export const retentionKPIs: KPIDefinition[] = [
  {
    id: 'day7_retention',
    name: 'Day 7 Retention',
    description: 'Percentage of users returning 7 days after signup',
    category: 'retention',
    query: `SELECT 0 as value`, // Simplified - actual query would be complex
    aggregation: 'custom',
    format: 'percent',
    decimals: 1,
    supportedGranularities: ['weekly', 'monthly'],
    defaultGranularity: 'weekly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'fixed',
    thresholds: { warning: { operator: 'lt', value: 30 }, critical: { operator: 'lt', value: 20 } },
    visibility: 'internal',
    relatedKPIs: ['day1_retention', 'day30_retention', 'week4_retention'],
    dimensions: ['platform', 'signup_source', 'account_type'],
    tags: ['retention', 'cohort'],
  },
  {
    id: 'day30_retention',
    name: 'Day 30 Retention',
    description: 'Percentage of users returning 30 days after signup',
    category: 'retention',
    query: `SELECT 0 as value`, // Simplified
    aggregation: 'custom',
    format: 'percent',
    decimals: 1,
    supportedGranularities: ['monthly'],
    defaultGranularity: 'monthly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'fixed',
    thresholds: { warning: { operator: 'lt', value: 20 }, critical: { operator: 'lt', value: 10 } },
    visibility: 'executive',
    tags: ['retention', 'cohort', 'north-star'],
  },
  {
    id: 'churn_rate',
    name: 'Monthly Churn Rate',
    description: 'Percentage of active users who churned in the month',
    category: 'retention',
    query: `SELECT 0 as value`, // Simplified
    aggregation: 'custom',
    format: 'percent',
    decimals: 1,
    supportedGranularities: ['monthly'],
    defaultGranularity: 'monthly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'fixed',
    thresholds: { warning: { operator: 'gt', value: 10 }, critical: { operator: 'gt', value: 15 } },
    visibility: 'executive',
    relatedKPIs: ['subscription_churn_rate', 'net_revenue_retention'],
    tags: ['retention', 'churn'],
  },
];

// ==================== Marketplace KPIs ====================

export const marketplaceKPIs: KPIDefinition[] = [
  {
    id: 'jobs_posted',
    name: 'Jobs Posted',
    description: 'Number of new jobs posted on the marketplace',
    category: 'marketplace',
    query: `SELECT count() as value FROM analytics.marketplace_events 
            WHERE event_type = 'job_posted' 
            AND event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'count',
    format: 'number',
    decimals: 0,
    supportedGranularities: ['daily', 'weekly', 'monthly'],
    defaultGranularity: 'weekly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'growth_rate',
    visibility: 'internal',
    relatedKPIs: ['proposals_per_job', 'job_fill_rate', 'time_to_first_proposal'],
    dimensions: ['category', 'budget_type', 'experience_level', 'country'],
    tags: ['marketplace', 'supply'],
  },
  {
    id: 'proposals_submitted',
    name: 'Proposals Submitted',
    description: 'Number of proposals submitted by freelancers',
    category: 'marketplace',
    query: `SELECT count() as value FROM analytics.marketplace_events 
            WHERE event_type = 'proposal_submitted' 
            AND event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'count',
    format: 'number',
    decimals: 0,
    supportedGranularities: ['daily', 'weekly', 'monthly'],
    defaultGranularity: 'weekly',
    comparisonType: 'previous_period',
    hasTarget: false,
    visibility: 'internal',
    relatedKPIs: ['proposal_acceptance_rate', 'proposals_per_job'],
    dimensions: ['category', 'freelancer_tier'],
    tags: ['marketplace', 'demand'],
  },
  {
    id: 'job_fill_rate',
    name: 'Job Fill Rate',
    description: 'Percentage of posted jobs that result in a contract',
    category: 'marketplace',
    query: `SELECT 0 as value`, // Simplified
    aggregation: 'custom',
    format: 'percent',
    decimals: 1,
    supportedGranularities: ['weekly', 'monthly'],
    defaultGranularity: 'monthly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'fixed',
    thresholds: { warning: { operator: 'lt', value: 50 }, critical: { operator: 'lt', value: 30 } },
    visibility: 'executive',
    dimensions: ['category', 'budget_type'],
    tags: ['marketplace', 'conversion', 'north-star'],
  },
  {
    id: 'avg_contract_value',
    name: 'Average Contract Value',
    description: 'Average value of contracts created',
    category: 'marketplace',
    query: `SELECT avg(contract_value) as value FROM analytics.marketplace_events 
            WHERE event_type = 'contract_created' 
            AND event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'avg',
    format: 'currency',
    decimals: 0,
    currency: 'USD',
    supportedGranularities: ['weekly', 'monthly'],
    defaultGranularity: 'monthly',
    comparisonType: 'previous_period',
    hasTarget: false,
    visibility: 'internal',
    dimensions: ['category', 'contract_type'],
    tags: ['marketplace', 'financial'],
  },
];

// ==================== Learning KPIs ====================

export const learningKPIs: KPIDefinition[] = [
  {
    id: 'course_enrollments',
    name: 'Course Enrollments',
    description: 'Number of course enrollments',
    category: 'learning',
    query: `SELECT count() as value FROM analytics.learning_events 
            WHERE event_type = 'course_enrolled' 
            AND event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'count',
    format: 'number',
    decimals: 0,
    supportedGranularities: ['daily', 'weekly', 'monthly'],
    defaultGranularity: 'weekly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'growth_rate',
    visibility: 'internal',
    relatedKPIs: ['course_completion_rate', 'avg_course_rating'],
    dimensions: ['course_category', 'difficulty', 'price_tier'],
    tags: ['learning', 'engagement'],
  },
  {
    id: 'course_completion_rate',
    name: 'Course Completion Rate',
    description: 'Percentage of enrolled courses that are completed',
    category: 'learning',
    query: `SELECT 0 as value`, // Simplified
    aggregation: 'custom',
    format: 'percent',
    decimals: 1,
    supportedGranularities: ['monthly', 'quarterly'],
    defaultGranularity: 'monthly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'fixed',
    thresholds: { warning: { operator: 'lt', value: 40 }, critical: { operator: 'lt', value: 25 } },
    visibility: 'executive',
    dimensions: ['course_category', 'difficulty'],
    tags: ['learning', 'quality', 'north-star'],
  },
  {
    id: 'learning_minutes',
    name: 'Learning Minutes',
    description: 'Total minutes spent learning on the platform',
    category: 'learning',
    query: `SELECT sum(duration) as value FROM analytics.video_events 
            WHERE event_type = 'video_complete' 
            AND event_date BETWEEN {start_date} AND {end_date}`,
    aggregation: 'sum',
    format: 'duration',
    decimals: 0,
    supportedGranularities: ['daily', 'weekly', 'monthly'],
    defaultGranularity: 'weekly',
    comparisonType: 'previous_period',
    hasTarget: true,
    targetType: 'growth_rate',
    visibility: 'internal',
    dimensions: ['course_category'],
    tags: ['learning', 'engagement'],
  },
];

// Export all KPIs
export const allKPIs: KPIDefinition[] = [
  ...revenueKPIs,
  ...growthKPIs,
  ...retentionKPIs,
  ...marketplaceKPIs,
  ...learningKPIs,
];

export function getKPIById(id: string): KPIDefinition | undefined {
  return allKPIs.find((kpi) => kpi.id === id);
}

export function getKPIsByCategory(category: string): KPIDefinition[] {
  return allKPIs.filter((kpi) => kpi.category === category);
}

export function getKPIsByTag(tag: string): KPIDefinition[] {
  return allKPIs.filter((kpi) => kpi.tags.includes(tag));
}

export function getNorthStarKPIs(): KPIDefinition[] {
  return getKPIsByTag('north-star');
}
