/**
 * @module @skillancer/service-client/clients/search-client
 * Meilisearch client for full-text search across the platform
 */

import { MeiliSearch, Index, SearchParams, SearchResponse } from 'meilisearch';

import type { Logger } from 'pino';

// ============================================================================
// Types
// ============================================================================

export interface SearchConfig {
  host: string;
  apiKey: string;
  timeout?: number;
}

export interface SearchableJob {
  id: string;
  title: string;
  description: string;
  skills: string[];
  category: string;
  subcategory?: string;
  budget: {
    min: number;
    max: number;
    type: 'FIXED' | 'HOURLY';
    currency: string;
  };
  clientId: string;
  clientName: string;
  clientCountry?: string;
  experienceLevel: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
  projectLength: string;
  status: 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  proposalCount: number;
  createdAt: number; // Unix timestamp
  updatedAt: number;
}

export interface SearchableFreelancer {
  id: string;
  userId: string;
  name: string;
  title: string;
  bio: string;
  skills: string[];
  hourlyRate: number;
  currency: string;
  country: string;
  city?: string;
  experienceLevel: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
  totalEarnings: number;
  completedJobs: number;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  isAvailable: boolean;
  languages: string[];
  education: string[];
  certifications: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SearchableSkill {
  id: string;
  name: string;
  slug: string;
  category: string;
  subcategory?: string;
  description?: string;
  aliases: string[];
  demandScore: number;
  freelancerCount: number;
  jobCount: number;
}

export interface JobSearchFilters {
  skills?: string[];
  category?: string;
  budgetMin?: number;
  budgetMax?: number;
  experienceLevel?: string[];
  projectLength?: string[];
  clientCountry?: string;
  status?: string[];
}

export interface FreelancerSearchFilters {
  skills?: string[];
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  country?: string;
  experienceLevel?: string[];
  minRating?: number;
  isVerified?: boolean;
  isAvailable?: boolean;
  languages?: string[];
}

// ============================================================================
// Search Client
// ============================================================================

export class SearchClient {
  private readonly client: MeiliSearch;
  private readonly logger?: Logger;

  // Index names
  private static readonly JOBS_INDEX = 'jobs';
  private static readonly FREELANCERS_INDEX = 'freelancers';
  private static readonly SKILLS_INDEX = 'skills';

  constructor(config: SearchConfig, logger?: Logger) {
    this.client = new MeiliSearch({
      host: config.host,
      apiKey: config.apiKey,
      timeout: config.timeout ?? 10000,
    });
    this.logger = logger;
  }

  // ==========================================================================
  // Index Management
  // ==========================================================================

  /**
   * Initialize all search indexes with settings
   */
  async initializeIndexes(): Promise<void> {
    // Jobs index
    await this.createOrUpdateIndex(SearchClient.JOBS_INDEX, {
      primaryKey: 'id',
      searchableAttributes: ['title', 'description', 'skills', 'category', 'subcategory'],
      filterableAttributes: [
        'skills',
        'category',
        'subcategory',
        'experienceLevel',
        'projectLength',
        'status',
        'clientCountry',
        'budget.type',
      ],
      sortableAttributes: ['createdAt', 'updatedAt', 'proposalCount', 'budget.max'],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
        'createdAt:desc',
      ],
    });

    // Freelancers index
    await this.createOrUpdateIndex(SearchClient.FREELANCERS_INDEX, {
      primaryKey: 'id',
      searchableAttributes: ['name', 'title', 'bio', 'skills', 'education', 'certifications'],
      filterableAttributes: [
        'skills',
        'country',
        'experienceLevel',
        'isVerified',
        'isAvailable',
        'languages',
        'hourlyRate',
        'rating',
      ],
      sortableAttributes: ['rating', 'completedJobs', 'hourlyRate', 'totalEarnings', 'createdAt'],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
        'rating:desc',
        'completedJobs:desc',
      ],
    });

    // Skills index
    await this.createOrUpdateIndex(SearchClient.SKILLS_INDEX, {
      primaryKey: 'id',
      searchableAttributes: ['name', 'aliases', 'description', 'category'],
      filterableAttributes: ['category', 'subcategory'],
      sortableAttributes: ['demandScore', 'freelancerCount', 'jobCount'],
    });

    this.logger?.info('Search indexes initialized');
  }

  private async createOrUpdateIndex(
    indexName: string,
    settings: {
      primaryKey: string;
      searchableAttributes?: string[];
      filterableAttributes?: string[];
      sortableAttributes?: string[];
      rankingRules?: string[];
    }
  ): Promise<void> {
    try {
      await this.client.createIndex(indexName, { primaryKey: settings.primaryKey });
    } catch (error) {
      // Index might already exist
    }

    const index = this.client.index(indexName);
    await index.updateSettings({
      searchableAttributes: settings.searchableAttributes,
      filterableAttributes: settings.filterableAttributes,
      sortableAttributes: settings.sortableAttributes,
      rankingRules: settings.rankingRules,
    });
  }

  // ==========================================================================
  // Job Search
  // ==========================================================================

  /**
   * Search for jobs
   */
  async searchJobs(
    query: string,
    filters?: JobSearchFilters,
    options?: { page?: number; limit?: number; sort?: string[] }
  ): Promise<SearchResponse<SearchableJob>> {
    const index = this.client.index<SearchableJob>(SearchClient.JOBS_INDEX);

    const searchParams: SearchParams = {
      limit: options?.limit ?? 20,
      offset: ((options?.page ?? 1) - 1) * (options?.limit ?? 20),
      sort: options?.sort,
      filter: this.buildJobFilters(filters),
    };

    return index.search(query, searchParams);
  }

  /**
   * Index a job document
   */
  async indexJob(job: SearchableJob): Promise<void> {
    const index = this.client.index(SearchClient.JOBS_INDEX);
    await index.addDocuments([job]);
    this.logger?.debug({ jobId: job.id }, 'Job indexed');
  }

  /**
   * Index multiple jobs
   */
  async indexJobs(jobs: SearchableJob[]): Promise<void> {
    if (jobs.length === 0) return;
    const index = this.client.index(SearchClient.JOBS_INDEX);
    await index.addDocuments(jobs);
    this.logger?.debug({ count: jobs.length }, 'Jobs indexed');
  }

  /**
   * Remove job from index
   */
  async removeJob(jobId: string): Promise<void> {
    const index = this.client.index(SearchClient.JOBS_INDEX);
    await index.deleteDocument(jobId);
    this.logger?.debug({ jobId }, 'Job removed from index');
  }

  private buildJobFilters(filters?: JobSearchFilters): string[] {
    const filterStrings: string[] = [];

    if (filters?.skills?.length) {
      filterStrings.push(`skills IN [${filters.skills.map((s) => `"${s}"`).join(', ')}]`);
    }
    if (filters?.category) {
      filterStrings.push(`category = "${filters.category}"`);
    }
    if (filters?.experienceLevel?.length) {
      filterStrings.push(
        `experienceLevel IN [${filters.experienceLevel.map((e) => `"${e}"`).join(', ')}]`
      );
    }
    if (filters?.status?.length) {
      filterStrings.push(`status IN [${filters.status.map((s) => `"${s}"`).join(', ')}]`);
    }
    if (filters?.budgetMin !== undefined) {
      filterStrings.push(`budget.max >= ${filters.budgetMin}`);
    }
    if (filters?.budgetMax !== undefined) {
      filterStrings.push(`budget.min <= ${filters.budgetMax}`);
    }

    return filterStrings;
  }

  // ==========================================================================
  // Freelancer Search
  // ==========================================================================

  /**
   * Search for freelancers
   */
  async searchFreelancers(
    query: string,
    filters?: FreelancerSearchFilters,
    options?: { page?: number; limit?: number; sort?: string[] }
  ): Promise<SearchResponse<SearchableFreelancer>> {
    const index = this.client.index<SearchableFreelancer>(SearchClient.FREELANCERS_INDEX);

    const searchParams: SearchParams = {
      limit: options?.limit ?? 20,
      offset: ((options?.page ?? 1) - 1) * (options?.limit ?? 20),
      sort: options?.sort,
      filter: this.buildFreelancerFilters(filters),
    };

    return index.search(query, searchParams);
  }

  /**
   * Index a freelancer profile
   */
  async indexFreelancer(freelancer: SearchableFreelancer): Promise<void> {
    const index = this.client.index(SearchClient.FREELANCERS_INDEX);
    await index.addDocuments([freelancer]);
    this.logger?.debug({ freelancerId: freelancer.id }, 'Freelancer indexed');
  }

  /**
   * Index multiple freelancers
   */
  async indexFreelancers(freelancers: SearchableFreelancer[]): Promise<void> {
    if (freelancers.length === 0) return;
    const index = this.client.index(SearchClient.FREELANCERS_INDEX);
    await index.addDocuments(freelancers);
    this.logger?.debug({ count: freelancers.length }, 'Freelancers indexed');
  }

  /**
   * Remove freelancer from index
   */
  async removeFreelancer(freelancerId: string): Promise<void> {
    const index = this.client.index(SearchClient.FREELANCERS_INDEX);
    await index.deleteDocument(freelancerId);
    this.logger?.debug({ freelancerId }, 'Freelancer removed from index');
  }

  private buildFreelancerFilters(filters?: FreelancerSearchFilters): string[] {
    const filterStrings: string[] = [];

    if (filters?.skills?.length) {
      filterStrings.push(`skills IN [${filters.skills.map((s) => `"${s}"`).join(', ')}]`);
    }
    if (filters?.country) {
      filterStrings.push(`country = "${filters.country}"`);
    }
    if (filters?.experienceLevel?.length) {
      filterStrings.push(
        `experienceLevel IN [${filters.experienceLevel.map((e) => `"${e}"`).join(', ')}]`
      );
    }
    if (filters?.isVerified !== undefined) {
      filterStrings.push(`isVerified = ${filters.isVerified}`);
    }
    if (filters?.isAvailable !== undefined) {
      filterStrings.push(`isAvailable = ${filters.isAvailable}`);
    }
    if (filters?.hourlyRateMin !== undefined) {
      filterStrings.push(`hourlyRate >= ${filters.hourlyRateMin}`);
    }
    if (filters?.hourlyRateMax !== undefined) {
      filterStrings.push(`hourlyRate <= ${filters.hourlyRateMax}`);
    }
    if (filters?.minRating !== undefined) {
      filterStrings.push(`rating >= ${filters.minRating}`);
    }
    if (filters?.languages?.length) {
      filterStrings.push(`languages IN [${filters.languages.map((l) => `"${l}"`).join(', ')}]`);
    }

    return filterStrings;
  }

  // ==========================================================================
  // Skill Search
  // ==========================================================================

  /**
   * Search for skills (autocomplete)
   */
  async searchSkills(
    query: string,
    options?: { limit?: number; category?: string }
  ): Promise<SearchResponse<SearchableSkill>> {
    const index = this.client.index<SearchableSkill>(SearchClient.SKILLS_INDEX);

    const searchParams: SearchParams = {
      limit: options?.limit ?? 10,
      filter: options?.category ? [`category = "${options.category}"`] : undefined,
    };

    return index.search(query, searchParams);
  }

  /**
   * Index a skill
   */
  async indexSkill(skill: SearchableSkill): Promise<void> {
    const index = this.client.index(SearchClient.SKILLS_INDEX);
    await index.addDocuments([skill]);
  }

  /**
   * Index multiple skills
   */
  async indexSkills(skills: SearchableSkill[]): Promise<void> {
    if (skills.length === 0) return;
    const index = this.client.index(SearchClient.SKILLS_INDEX);
    await index.addDocuments(skills);
    this.logger?.debug({ count: skills.length }, 'Skills indexed');
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Check if Meilisearch is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.client.health();
      return health.status === 'available';
    } catch {
      return false;
    }
  }

  /**
   * Get index stats
   */
  async getStats(): Promise<Record<string, { numberOfDocuments: number; isIndexing: boolean }>> {
    const stats: Record<string, { numberOfDocuments: number; isIndexing: boolean }> = {};

    for (const indexName of [
      SearchClient.JOBS_INDEX,
      SearchClient.FREELANCERS_INDEX,
      SearchClient.SKILLS_INDEX,
    ]) {
      try {
        const index = this.client.index(indexName);
        const indexStats = await index.getStats();
        stats[indexName] = {
          numberOfDocuments: indexStats.numberOfDocuments,
          isIndexing: indexStats.isIndexing,
        };
      } catch {
        stats[indexName] = { numberOfDocuments: 0, isIndexing: false };
      }
    }

    return stats;
  }
}

/**
 * Create search client from environment
 */
export function createSearchClient(logger?: Logger): SearchClient | null {
  const host = process.env.MEILISEARCH_HOST;
  const apiKey = process.env.MEILISEARCH_API_KEY;

  if (!host || !apiKey) {
    logger?.warn('[Search] Meilisearch not configured');
    return null;
  }

  return new SearchClient({ host, apiKey }, logger);
}
