/**
 * @module @skillancer/bi/reports
 * Report definitions for all business areas
 */

import type { ReportDefinition } from './types.js';

export const reportDefinitions: ReportDefinition[] = [
  {
    id: 'executive_summary',
    name: 'Executive Summary',
    description: 'High-level overview of all key business metrics',
    template: 'executive_summary',
    kpiIds: ['gmv', 'platform_revenue', 'mau', 'job_fill_rate', 'course_completion_rate'],
    defaultFormat: 'pdf',
    supportedFormats: ['pdf', 'excel'],
    isSchedulable: true,
    visibility: 'executive',
  },
  {
    id: 'revenue_report',
    name: 'Revenue Report',
    description: 'Detailed revenue breakdown and trends',
    template: 'revenue_report',
    kpiIds: ['gmv', 'platform_revenue', 'mrr', 'arpu'],
    dimensions: ['platform', 'category', 'country'],
    defaultFormat: 'excel',
    supportedFormats: ['pdf', 'excel', 'csv'],
    isSchedulable: true,
    visibility: 'internal',
  },
  {
    id: 'growth_report',
    name: 'Growth Report',
    description: 'User acquisition and growth metrics',
    template: 'growth_report',
    kpiIds: ['new_users', 'dau', 'mau', 'activation_rate'],
    dimensions: ['platform', 'signup_source', 'country'],
    defaultFormat: 'pdf',
    supportedFormats: ['pdf', 'excel', 'csv'],
    isSchedulable: true,
    visibility: 'internal',
  },
  {
    id: 'marketplace_report',
    name: 'Marketplace Report',
    description: 'Marketplace supply and demand metrics',
    template: 'marketplace_report',
    kpiIds: ['jobs_posted', 'proposals_submitted', 'job_fill_rate', 'avg_contract_value'],
    dimensions: ['category', 'budget_type', 'experience_level'],
    defaultFormat: 'excel',
    supportedFormats: ['pdf', 'excel', 'csv'],
    isSchedulable: true,
    visibility: 'internal',
  },
  {
    id: 'learning_report',
    name: 'Learning Platform Report',
    description: 'SkillPod learning and engagement metrics',
    template: 'learning_report',
    kpiIds: ['course_enrollments', 'course_completion_rate', 'learning_minutes'],
    dimensions: ['course_category', 'difficulty', 'price_tier'],
    defaultFormat: 'pdf',
    supportedFormats: ['pdf', 'excel', 'csv'],
    isSchedulable: true,
    visibility: 'internal',
  },
  {
    id: 'retention_report',
    name: 'Retention & Churn Report',
    description: 'User retention cohort analysis and churn metrics',
    template: 'retention_report',
    kpiIds: ['day7_retention', 'day30_retention', 'churn_rate'],
    dimensions: ['platform', 'signup_source', 'account_type'],
    defaultFormat: 'pdf',
    supportedFormats: ['pdf', 'excel'],
    isSchedulable: true,
    visibility: 'executive',
  },
];

export function getReportById(id: string): ReportDefinition | undefined {
  return reportDefinitions.find((r) => r.id === id);
}

export function getSchedulableReports(): ReportDefinition[] {
  return reportDefinitions.filter((r) => r.isSchedulable);
}

export function getReportsByVisibility(visibility: string): ReportDefinition[] {
  return reportDefinitions.filter((r) => r.visibility === visibility);
}
