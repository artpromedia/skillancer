/**
 * @module @skillancer/api-gateway/routes/bff/dashboard
 * Dashboard aggregation endpoints
 */

import { requireAuth } from '../../plugins/auth.js';
import { fetchFromServices, ServiceError } from '../../utils/service-client.js';

import type { FastifyInstance } from 'fastify';

interface DashboardData {
  user: UserProfile | null;
  stats: UserStats | null;
  recentActivity: ActivityItem[];
  notifications: NotificationItem[];
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
}

interface UserStats {
  totalEarnings?: number;
  activeProjects?: number;
  completedProjects?: number;
  rating?: number;
  reviewCount?: number;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export function dashboardRoutes(
  app: FastifyInstance,
  _opts: { prefix?: string },
  done: (err?: Error) => void
): void {
  /**
   * Get aggregated dashboard data
   * Fetches data from multiple services in parallel
   */
  app.get<{
    Reply: { success: boolean; data: DashboardData };
  }>(
    '/dashboard',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['bff'],
        summary: 'Get dashboard data',
        description:
          'Aggregates user profile, stats, activity, and notifications from multiple services',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      avatar: { type: 'string' },
                      role: { type: 'string' },
                    },
                  },
                  stats: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      totalEarnings: { type: 'number' },
                      activeProjects: { type: 'number' },
                      completedProjects: { type: 'number' },
                      rating: { type: 'number' },
                      reviewCount: { type: 'number' },
                    },
                  },
                  recentActivity: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        type: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        timestamp: { type: 'string' },
                      },
                    },
                  },
                  notifications: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        type: { type: 'string' },
                        title: { type: 'string' },
                        message: { type: 'string' },
                        read: { type: 'boolean' },
                        createdAt: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const userId = request.user?.userId;

      if (!userId) {
        return {
          success: false,
          data: {
            user: null,
            stats: null,
            recentActivity: [],
            notifications: [],
          },
        };
      }

      // Fetch data from multiple services in parallel
      const data = await fetchFromServices<{
        user: UserProfile | null;
        stats: UserStats | null;
        activity: { items: ActivityItem[] } | null;
        notifications: { items: NotificationItem[] } | null;
      }>([
        {
          key: 'user',
          serviceName: 'auth',
          path: `/api/auth/users/${userId}/profile`,
          defaultValue: null,
        },
        {
          key: 'stats',
          serviceName: 'market',
          path: `/users/${userId}/stats`,
          defaultValue: null,
        },
        {
          key: 'activity',
          serviceName: 'market',
          path: `/users/${userId}/activity?limit=10`,
          defaultValue: { items: [] },
        },
        {
          key: 'notifications',
          serviceName: 'notification',
          path: `/users/${userId}/notifications?unread=true&limit=5`,
          defaultValue: { items: [] },
        },
      ]);

      return {
        success: true,
        data: {
          user: data.user,
          stats: data.stats,
          recentActivity: data.activity?.items ?? [],
          notifications: data.notifications?.items ?? [],
        },
      };
    }
  );

  /**
   * Get user's quick stats
   */
  app.get(
    '/dashboard/quick-stats',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['bff'],
        summary: 'Get quick stats for dashboard widgets',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const userId = request.user?.userId;

      if (!userId) {
        return { success: false, data: null };
      }

      try {
        const data = await fetchFromServices<{
          marketStats: unknown;
          skillpodStats: unknown;
          billingStats: unknown;
        }>([
          {
            key: 'marketStats',
            serviceName: 'market',
            path: `/users/${userId}/quick-stats`,
            defaultValue: {},
          },
          {
            key: 'skillpodStats',
            serviceName: 'skillpod',
            path: `/users/${userId}/progress-summary`,
            defaultValue: {},
          },
          {
            key: 'billingStats',
            serviceName: 'billing',
            path: `/users/${userId}/balance-summary`,
            defaultValue: {},
          },
        ]);

        return {
          success: true,
          data: {
            market: data.marketStats,
            learning: data.skillpodStats,
            billing: data.billingStats,
          },
        };
      } catch (error) {
        request.log.error({ error }, 'Failed to fetch quick stats');
        return {
          success: false,
          data: null,
          error: error instanceof ServiceError ? error.message : 'Failed to fetch stats',
        };
      }
    }
  );

  done();
}
