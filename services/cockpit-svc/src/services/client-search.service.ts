/**
 * @module @skillancer/cockpit-svc/services/client-search
 * Client Search Service - Elasticsearch integration for client search
 */

import { Client as ElasticsearchClient } from '@elastic/elasticsearch';

import type {
  ClientSearchParams,
  ClientSearchResult,
  ClientWithMetrics,
  SearchFacets,
} from '../types/crm.types.js';
import type { Client } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

const INDEX_NAME = 'skillancer_crm_clients';

export class ClientSearchService {
  private readonly esClient: ElasticsearchClient;

  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
    elasticsearchUrl?: string
  ) {
    this.esClient = new ElasticsearchClient({
      node: elasticsearchUrl || process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    });
  }

  /**
   * Initialize the search index
   */
  async initializeIndex(): Promise<void> {
    try {
      const exists = await this.esClient.indices.exists({ index: INDEX_NAME });

      if (!exists) {
        await this.esClient.indices.create({
          index: INDEX_NAME,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  client_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'asciifolding', 'edge_ngram_filter'],
                  },
                },
                filter: {
                  edge_ngram_filter: {
                    type: 'edge_ngram',
                    min_gram: 1,
                    max_gram: 20,
                  },
                },
              },
            },
            mappings: {
              properties: {
                id: { type: 'keyword' },
                freelancerUserId: { type: 'keyword' },
                displayName: {
                  type: 'text',
                  analyzer: 'client_analyzer',
                  search_analyzer: 'standard',
                },
                firstName: { type: 'text', analyzer: 'client_analyzer' },
                lastName: { type: 'text', analyzer: 'client_analyzer' },
                email: { type: 'keyword' },
                phone: { type: 'keyword' },
                companyName: {
                  type: 'text',
                  analyzer: 'client_analyzer',
                  search_analyzer: 'standard',
                },
                clientType: { type: 'keyword' },
                source: { type: 'keyword' },
                status: { type: 'keyword' },
                industry: { type: 'keyword' },
                tags: { type: 'keyword' },
                healthScore: { type: 'integer' },
                lifetimeValue: { type: 'float' },
                totalProjects: { type: 'integer' },
                activeProjects: { type: 'integer' },
                lastContactAt: { type: 'date' },
                createdAt: { type: 'date' },
              },
            },
          },
        });

        this.logger.info('Client search index created');
      }
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to initialize search index'
      );
    }
  }

  /**
   * Index a client for search
   */
  async indexClient(client: Client): Promise<void> {
    try {
      await this.esClient.index({
        index: INDEX_NAME,
        id: client.id,
        body: {
          id: client.id,
          freelancerUserId: client.freelancerUserId,
          displayName: this.getClientDisplayName(client),
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          phone: client.phone,
          companyName: client.companyName,
          clientType: client.clientType,
          source: client.source,
          status: client.status,
          industry: client.industry,
          tags: client.tags,
          healthScore: client.healthScore,
          lifetimeValue: Number(client.lifetimeValue),
          totalProjects: client.totalProjects,
          activeProjects: client.activeProjects,
          lastContactAt: client.lastContactAt,
          createdAt: client.createdAt,
        },
        refresh: true,
      });
    } catch (error) {
      this.logger.error(
        {
          clientId: client.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to index client'
      );
    }
  }

  /**
   * Remove a client from search index
   */
  async removeClient(clientId: string): Promise<void> {
    try {
      await this.esClient.delete({
        index: INDEX_NAME,
        id: clientId,
        refresh: true,
      });
    } catch (error) {
      // Ignore not found errors
      if ((error as { meta?: { statusCode?: number } }).meta?.statusCode !== 404) {
        this.logger.error(
          {
            clientId,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Failed to remove client from index'
        );
      }
    }
  }

  /**
   * Search clients using Elasticsearch
   */
  async search(params: ClientSearchParams): Promise<ClientSearchResult> {
    const {
      freelancerUserId,
      query,
      status,
      tags,
      source,
      hasActiveProjects,
      healthScoreMin,
      healthScoreMax,
      lastContactBefore,
      lastContactAfter,
      sortBy = 'created',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = params;

    try {
      // Build the query
      const must: object[] = [{ term: { freelancerUserId } }];

      // Text search
      if (query) {
        must.push({
          multi_match: {
            query,
            fields: ['displayName^3', 'companyName^2', 'firstName', 'lastName', 'email'],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        });
      }

      // Filters
      const filter: object[] = [];

      if (status && status.length > 0) {
        filter.push({ terms: { status } });
      } else {
        filter.push({ bool: { must_not: { term: { status: 'ARCHIVED' } } } });
      }

      if (tags && tags.length > 0) {
        filter.push({ terms: { tags } });
      }

      if (source && source.length > 0) {
        filter.push({ terms: { source } });
      }

      if (hasActiveProjects !== undefined) {
        if (hasActiveProjects) {
          filter.push({ range: { activeProjects: { gt: 0 } } });
        } else {
          filter.push({ term: { activeProjects: 0 } });
        }
      }

      if (healthScoreMin !== undefined || healthScoreMax !== undefined) {
        const range: { gte?: number; lte?: number } = {};
        if (healthScoreMin !== undefined) range.gte = healthScoreMin;
        if (healthScoreMax !== undefined) range.lte = healthScoreMax;
        filter.push({ range: { healthScore: range } });
      }

      if (lastContactBefore || lastContactAfter) {
        const range: { lt?: string; gt?: string } = {};
        if (lastContactBefore) range.lt = lastContactBefore.toISOString();
        if (lastContactAfter) range.gt = lastContactAfter.toISOString();
        filter.push({ range: { lastContactAt: range } });
      }

      // Sort
      const sort = this.getSort(sortBy, sortOrder);

      const response = await this.esClient.search({
        index: INDEX_NAME,
        query: {
          bool: {
            must,
            filter,
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        sort: sort as any,
        from: (page - 1) * limit,
        size: limit,
        aggs: {
          status: { terms: { field: 'status' } },
          source: { terms: { field: 'source' } },
          tags: { terms: { field: 'tags', size: 20 } },
        },
      });

      // Extract results
      const hits = response.hits.hits as Array<{
        _source: {
          id: string;
          displayName: string;
          firstName: string | null;
          lastName: string | null;
          email: string | null;
          phone: string | null;
          companyName: string | null;
          clientType: string;
          source: string;
          status: string;
          avatarUrl?: string | null;
          healthScore: number | null;
          lifetimeValue: number;
          totalProjects: number;
          activeProjects: number;
          lastContactAt: string | null;
          lastProjectAt?: string | null;
          nextFollowUpAt?: string | null;
          tags: string[];
          createdAt: string;
        };
      }>;

      const clients: ClientWithMetrics[] = hits.map((hit) => ({
        id: hit._source.id,
        displayName: hit._source.displayName,
        firstName: hit._source.firstName,
        lastName: hit._source.lastName,
        email: hit._source.email,
        phone: hit._source.phone,
        companyName: hit._source.companyName,
        clientType: hit._source.clientType as ClientWithMetrics['clientType'],
        source: hit._source.source as ClientWithMetrics['source'],
        status: hit._source.status as ClientWithMetrics['status'],
        avatarUrl: hit._source.avatarUrl || null,
        healthScore: hit._source.healthScore,
        lifetimeValue: hit._source.lifetimeValue,
        totalProjects: hit._source.totalProjects,
        activeProjects: hit._source.activeProjects,
        lastContactAt: hit._source.lastContactAt ? new Date(hit._source.lastContactAt) : null,
        lastProjectAt: hit._source.lastProjectAt ? new Date(hit._source.lastProjectAt) : null,
        nextFollowUpAt: hit._source.nextFollowUpAt ? new Date(hit._source.nextFollowUpAt) : null,
        tags: hit._source.tags,
        createdAt: new Date(hit._source.createdAt),
      }));

      // Extract facets
      const aggs = response.aggregations as {
        status?: { buckets: Array<{ key: string; doc_count: number }> };
        source?: { buckets: Array<{ key: string; doc_count: number }> };
        tags?: { buckets: Array<{ key: string; doc_count: number }> };
      };

      const facets: SearchFacets = {
        status: (aggs.status?.buckets || []).map((b) => ({
          value: b.key as ClientWithMetrics['status'],
          count: b.doc_count,
        })),
        source: (aggs.source?.buckets || []).map((b) => ({
          value: b.key as ClientWithMetrics['source'],
          count: b.doc_count,
        })),
        tags: (aggs.tags?.buckets || []).map((b) => ({
          value: b.key,
          count: b.doc_count,
        })),
      };

      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total?.value || 0;

      return {
        clients,
        total,
        facets,
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Search failed'
      );

      // Return empty results on error
      return {
        clients: [],
        total: 0,
        facets: {
          status: [],
          source: [],
          tags: [],
        },
      };
    }
  }

  /**
   * Get sort configuration
   */
  private getSort(sortBy: string, sortOrder: 'asc' | 'desc'): Array<Record<string, unknown>> {
    switch (sortBy) {
      case 'name':
        return [{ 'displayName.keyword': sortOrder }];
      case 'lastContact':
        return [{ lastContactAt: { order: sortOrder, missing: '_last' } }];
      case 'lifetimeValue':
        return [{ lifetimeValue: sortOrder }];
      case 'healthScore':
        return [{ healthScore: { order: sortOrder, missing: '_last' } }];
      case 'created':
      default:
        return [{ createdAt: sortOrder }];
    }
  }

  /**
   * Get client display name
   */
  private getClientDisplayName(client: {
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  }): string {
    if (client.companyName) {
      return client.companyName;
    }
    const parts = [client.firstName, client.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Unknown Client';
  }
}
