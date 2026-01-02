/**
 * @skillancer/types - CPO Dashboard Types
 * Widget and dashboard configuration types for CPO suite
 */

import { z } from 'zod';

// =============================================================================
// WIDGET DATA TYPES
// =============================================================================

// User Metrics Widget (DAU/WAU/MAU)
export const userMetricsDataSchema = z.object({
  dau: z.number(),
  wau: z.number(),
  mau: z.number(),
  dauTrend: z.number(), // Percentage change
  wauTrend: z.number(),
  mauTrend: z.number(),
  stickiness: z.number(), // DAU/MAU ratio as percentage
  date: z.string(),
  historicalData: z
    .array(
      z.object({
        date: z.string(),
        dau: z.number(),
        wau: z.number(),
        mau: z.number(),
      })
    )
    .optional(),
});
export type UserMetricsData = z.infer<typeof userMetricsDataSchema>;

// Feature Adoption Widget
export const featureAdoptionDataSchema = z.object({
  features: z.array(
    z.object({
      name: z.string(),
      eventName: z.string().optional(),
      adoptionRate: z.number(), // Percentage of users who have used the feature
      activeUsers: z.number(),
      trend: z.number(), // Percentage change
      targetAdoption: z.number().optional(),
      launchDate: z.string().optional(),
    })
  ),
  totalUsers: z.number(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
});
export type FeatureAdoptionData = z.infer<typeof featureAdoptionDataSchema>;

// Experiments Widget
export const experimentDataSchema = z.object({
  experiments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.enum(['draft', 'running', 'paused', 'complete', 'stopped']),
      startDate: z.string().optional(),
      daysRunning: z.number().optional(),
      primaryMetric: z
        .object({
          name: z.string(),
          controlValue: z.number(),
          treatmentValue: z.number(),
          lift: z.number(), // Percentage change
          confidence: z.number(), // Statistical confidence
          significant: z.boolean(),
        })
        .optional(),
      variants: z
        .array(
          z.object({
            name: z.string(),
            traffic: z.number(), // Percentage of traffic
            conversions: z.number().optional(),
          })
        )
        .optional(),
      source: z.string().optional(), // "launchdarkly", "statsig", "posthog"
    })
  ),
  summary: z.object({
    running: z.number(),
    needsAttention: z.number(),
    recentWinners: z.number(),
  }),
});
export type ExperimentData = z.infer<typeof experimentDataSchema>;

// Feature Roadmap Widget
export const roadmapFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['planned', 'in_progress', 'launched', 'blocked']),
  quarter: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  progress: z.number().optional(), // 0-100
  owner: z.string().optional(),
  theme: z.string().optional(),
  source: z.string().optional(), // "productboard", "aha", "linear"
});
export type RoadmapFeature = z.infer<typeof roadmapFeatureSchema>;

export const roadmapDataSchema = z.object({
  features: z.array(roadmapFeatureSchema),
  summary: z.object({
    total: z.number(),
    planned: z.number(),
    inProgress: z.number(),
    launched: z.number(),
    blocked: z.number(),
  }),
  currentQuarter: z.string(),
  themes: z
    .array(
      z.object({
        name: z.string(),
        featureCount: z.number(),
      })
    )
    .optional(),
});
export type RoadmapData = z.infer<typeof roadmapDataSchema>;

// User Feedback Widget
export const feedbackItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  source: z.enum(['interview', 'survey', 'support', 'nps', 'in-app', 'other']),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  themes: z.array(z.string()).optional(),
  company: z.string().optional(),
  user: z.string().optional(),
  date: z.string(),
  url: z.string().optional(), // Link to full feedback in source tool
});
export type FeedbackItem = z.infer<typeof feedbackItemSchema>;

export const userFeedbackDataSchema = z.object({
  recentFeedback: z.array(feedbackItemSchema),
  summary: z.object({
    total: z.number(),
    thisWeek: z.number(),
    trend: z.number(), // Percentage change from last week
  }),
  topThemes: z.array(
    z.object({
      theme: z.string(),
      count: z.number(),
      sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).optional(),
    })
  ),
  sentimentBreakdown: z
    .object({
      positive: z.number(),
      negative: z.number(),
      neutral: z.number(),
    })
    .optional(),
});
export type UserFeedbackData = z.infer<typeof userFeedbackDataSchema>;

// Research Insights Widget
export const researchInsightSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  projectName: z.string().optional(),
  evidenceCount: z.number().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published']).optional(),
  createdAt: z.string(),
  source: z.string().optional(), // "dovetail", "usertesting"
  url: z.string().optional(),
});
export type ResearchInsight = z.infer<typeof researchInsightSchema>;

export const researchInsightsDataSchema = z.object({
  insights: z.array(researchInsightSchema),
  summary: z.object({
    total: z.number(),
    recentProjects: z.number(),
    totalHighlights: z.number(),
  }),
  topTags: z
    .array(
      z.object({
        tag: z.string(),
        count: z.number(),
      })
    )
    .optional(),
});
export type ResearchInsightsData = z.infer<typeof researchInsightsDataSchema>;

// Prioritization Widget
export const prioritizationWidgetDataSchema = z.object({
  topFeatures: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      score: z.number(),
      rank: z.number(),
      tier: z.string().optional(),
      scoreBreakdown: z.record(z.number()).optional(), // e.g., { reach: 1000, impact: 2, ... }
    })
  ),
  framework: z.string(),
  totalFeatures: z.number(),
  lastUpdated: z.string().optional(),
});
export type PrioritizationWidgetData = z.infer<typeof prioritizationWidgetDataSchema>;

// Recent PRDs Widget
export const recentPRDDataSchema = z.object({
  prds: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.string(),
      owner: z.string().optional(),
      updatedAt: z.string(),
      commentCount: z.number().optional(),
    })
  ),
  summary: z.object({
    total: z.number(),
    draft: z.number(),
    inReview: z.number(),
    approved: z.number(),
  }),
});
export type RecentPRDData = z.infer<typeof recentPRDDataSchema>;

// =============================================================================
// DASHBOARD CONFIGURATION
// =============================================================================

export const widgetConfigSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  dataSources: z.array(z.string()), // Integration IDs
  refreshInterval: z.number().optional(), // Seconds
  config: z.record(z.unknown()).optional(),
});
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

export const dashboardLayoutRowSchema = z.object({
  row: z.number(),
  columns: z.array(
    z.object({
      widget: z.string(),
      span: z.number().min(1).max(12),
    })
  ),
});
export type DashboardLayoutRow = z.infer<typeof dashboardLayoutRowSchema>;

export const cpoDashboardConfigSchema = z.object({
  layout: z.array(dashboardLayoutRowSchema),
  widgets: z.record(widgetConfigSchema),
});
export type CPODashboardConfig = z.infer<typeof cpoDashboardConfigSchema>;

// =============================================================================
// DEFAULT CPO DASHBOARD CONFIGURATION
// =============================================================================

export const defaultCPODashboardConfig: CPODashboardConfig = {
  layout: [
    // Row 1: Key Metrics (3 equal columns)
    {
      row: 1,
      columns: [
        { widget: 'dau-wau-mau', span: 4 },
        { widget: 'feature-adoption', span: 4 },
        { widget: 'experiments', span: 4 },
      ],
    },
    // Row 2: Roadmap & Feedback (2 equal columns)
    {
      row: 2,
      columns: [
        { widget: 'feature-roadmap', span: 6 },
        { widget: 'user-feedback', span: 6 },
      ],
    },
    // Row 3: Prioritization (full width)
    {
      row: 3,
      columns: [{ widget: 'prioritization', span: 12 }],
    },
    // Row 4: Research & PRDs (2 equal columns)
    {
      row: 4,
      columns: [
        { widget: 'research-insights', span: 6 },
        { widget: 'recent-prds', span: 6 },
      ],
    },
  ],
  widgets: {
    'dau-wau-mau': {
      id: 'dau-wau-mau',
      type: 'user-metrics',
      title: 'User Metrics',
      dataSources: ['amplitude', 'mixpanel', 'posthog'],
      refreshInterval: 300,
    },
    'feature-adoption': {
      id: 'feature-adoption',
      type: 'feature-adoption',
      title: 'Feature Adoption',
      dataSources: ['amplitude', 'mixpanel'],
      refreshInterval: 300,
    },
    experiments: {
      id: 'experiments',
      type: 'experiments',
      title: 'Active Experiments',
      dataSources: ['launchdarkly', 'statsig', 'posthog'],
      refreshInterval: 300,
    },
    'feature-roadmap': {
      id: 'feature-roadmap',
      type: 'roadmap',
      title: 'Feature Roadmap',
      dataSources: ['productboard', 'aha', 'linear'],
      refreshInterval: 600,
    },
    'user-feedback': {
      id: 'user-feedback',
      type: 'user-feedback',
      title: 'User Feedback',
      dataSources: ['productboard', 'dovetail'],
      refreshInterval: 600,
    },
    prioritization: {
      id: 'prioritization',
      type: 'prioritization',
      title: 'Feature Prioritization',
      dataSources: ['internal'],
      refreshInterval: 0, // Manual refresh
    },
    'research-insights': {
      id: 'research-insights',
      type: 'research-insights',
      title: 'Research Insights',
      dataSources: ['dovetail', 'usertesting'],
      refreshInterval: 600,
    },
    'recent-prds': {
      id: 'recent-prds',
      type: 'recent-prds',
      title: 'Recent PRDs',
      dataSources: ['internal'],
      refreshInterval: 300,
    },
  },
};
