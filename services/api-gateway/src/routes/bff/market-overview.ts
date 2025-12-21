// @ts-nocheck - Fastify type compatibility issues
/**
 * @module @skillancer/api-gateway/routes/bff/market-overview
 * Market overview aggregation endpoints
 */

import { optionalAuth } from '../../plugins/auth.js';
import { fetchFromServices, fetchFromService, ServiceError } from '../../utils/service-client.js';

import type { FastifyInstance } from 'fastify';

interface JobListing {
  id: string;
  title: string;
  description: string;
  budget: { min: number; max: number; currency: string };
  skills: string[];
  postedAt: string;
  proposals: number;
}

interface ServiceListing {
  id: string;
  title: string;
  description: string;
  price: { amount: number; currency: string };
  rating: number;
  reviewCount: number;
  seller: { id: string; name: string; avatar?: string };
}

interface FreelancerProfile {
  id: string;
  name: string;
  title: string;
  avatar?: string;
  rating: number;
  hourlyRate: { amount: number; currency: string };
  skills: string[];
}

interface MarketOverviewData {
  featuredJobs: JobListing[];
  popularServices: ServiceListing[];
  topFreelancers: FreelancerProfile[];
  categories: CategoryStats[];
  recommendations?: {
    jobs: JobListing[];
    services: ServiceListing[];
  };
}

interface CategoryStats {
  id: string;
  name: string;
  jobCount: number;
  serviceCount: number;
}

export function marketOverviewRoutes(
  app: FastifyInstance,
  _opts: { prefix?: string },
  done: (err?: Error) => void
): void {
  /**
   * Get market overview for homepage
   * Public endpoint with optional personalization for authenticated users
   */
  app.get<{
    Reply: { success: boolean; data: MarketOverviewData };
  }>(
    '/market-overview',
    {
      preHandler: [optionalAuth],
      schema: {
        tags: ['bff'],
        summary: 'Get market overview',
        description:
          'Aggregates featured jobs, popular services, top freelancers, and personalized recommendations',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  featuredJobs: { type: 'array' },
                  popularServices: { type: 'array' },
                  topFreelancers: { type: 'array' },
                  categories: { type: 'array' },
                  recommendations: {
                    type: 'object',
                    nullable: true,
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

      // Fetch public market data
      const publicData = await fetchFromServices<{
        featuredJobs: { items: JobListing[] } | null;
        popularServices: { items: ServiceListing[] } | null;
        topFreelancers: { items: FreelancerProfile[] } | null;
        categories: { items: CategoryStats[] } | null;
      }>([
        {
          key: 'featuredJobs',
          serviceName: 'market',
          path: '/jobs/featured?limit=6',
          defaultValue: { items: [] },
        },
        {
          key: 'popularServices',
          serviceName: 'market',
          path: '/services/popular?limit=6',
          defaultValue: { items: [] },
        },
        {
          key: 'topFreelancers',
          serviceName: 'market',
          path: '/freelancers/top?limit=6',
          defaultValue: { items: [] },
        },
        {
          key: 'categories',
          serviceName: 'market',
          path: '/categories/stats',
          defaultValue: { items: [] },
        },
      ]);

      const result: MarketOverviewData = {
        featuredJobs: publicData.featuredJobs?.items ?? [],
        popularServices: publicData.popularServices?.items ?? [],
        topFreelancers: publicData.topFreelancers?.items ?? [],
        categories: publicData.categories?.items ?? [],
      };

      // Add personalized recommendations for authenticated users
      if (userId) {
        try {
          const recommendations = await fetchFromServices<{
            recommendedJobs: { items: JobListing[] } | null;
            recommendedServices: { items: ServiceListing[] } | null;
          }>([
            {
              key: 'recommendedJobs',
              serviceName: 'market',
              path: `/users/${userId}/recommendations/jobs?limit=4`,
              defaultValue: { items: [] },
            },
            {
              key: 'recommendedServices',
              serviceName: 'market',
              path: `/users/${userId}/recommendations/services?limit=4`,
              defaultValue: { items: [] },
            },
          ]);

          result.recommendations = {
            jobs: recommendations.recommendedJobs?.items ?? [],
            services: recommendations.recommendedServices?.items ?? [],
          };
        } catch (error) {
          request.log.warn({ error }, 'Failed to fetch recommendations');
          // Continue without recommendations
        }
      }

      return {
        success: true,
        data: result,
      };
    }
  );

  /**
   * Search across all market entities
   */
  app.get<{
    Querystring: { q: string; type?: string; limit?: number };
  }>(
    '/market-search',
    {
      preHandler: [optionalAuth],
      schema: {
        tags: ['bff'],
        summary: 'Unified market search',
        description: 'Search across jobs, services, and freelancers',
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Search query' },
            type: {
              type: 'string',
              enum: ['all', 'jobs', 'services', 'freelancers'],
              default: 'all',
            },
            limit: { type: 'number', default: 10, maximum: 50 },
          },
          required: ['q'],
        },
      },
    },
    async (request) => {
      const { q, type = 'all', limit = 10 } = request.query;

      const searchTypes = type === 'all' ? ['jobs', 'services', 'freelancers'] : [type];

      const searches = searchTypes.map((searchType) => ({
        key: searchType as 'jobs' | 'services' | 'freelancers',
        serviceName: 'market',
        path: `/${searchType}/search?q=${encodeURIComponent(q)}&limit=${limit}`,
        defaultValue: { items: [], total: 0 },
      }));

      const results = await fetchFromServices<{
        jobs?: { items: JobListing[]; total: number };
        services?: { items: ServiceListing[]; total: number };
        freelancers?: { items: FreelancerProfile[]; total: number };
      }>(searches);

      return {
        success: true,
        data: {
          query: q,
          results: {
            jobs: results.jobs ?? { items: [], total: 0 },
            services: results.services ?? { items: [], total: 0 },
            freelancers: results.freelancers ?? { items: [], total: 0 },
          },
        },
      };
    }
  );

  /**
   * Get job details with related data
   */
  app.get<{
    Params: { jobId: string };
  }>(
    '/jobs/:jobId/details',
    {
      preHandler: [optionalAuth],
      schema: {
        tags: ['bff'],
        summary: 'Get job with related data',
        description: 'Fetches job details, client info, and similar jobs',
        params: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
          },
          required: ['jobId'],
        },
      },
    },
    async (request) => {
      const { jobId } = request.params;

      try {
        const data = await fetchFromServices<{
          job: JobListing & { clientId: string };
          client: { id: string; name: string; rating: number; jobsPosted: number } | null;
          similarJobs: { items: JobListing[] };
        }>([
          {
            key: 'job',
            serviceName: 'market',
            path: `/jobs/${jobId}`,
          },
          {
            key: 'similarJobs',
            serviceName: 'market',
            path: `/jobs/${jobId}/similar?limit=4`,
            defaultValue: { items: [] },
          },
        ]);

        // Fetch client info if we have the job
        let client = null;
        if (data.job?.clientId) {
          try {
            client = await fetchFromService('market', `/clients/${data.job.clientId}/public`);
          } catch {
            // Continue without client info
          }
        }

        return {
          success: true,
          data: {
            job: data.job,
            client,
            similarJobs: data.similarJobs?.items ?? [],
          },
        };
      } catch (error) {
        if (error instanceof ServiceError && error.statusCode === 404) {
          return {
            success: false,
            error: 'Job not found',
          };
        }
        throw error;
      }
    }
  );

  done();
}
