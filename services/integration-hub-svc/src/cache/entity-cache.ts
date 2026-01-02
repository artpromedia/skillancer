// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/cache/entity-cache
 * Entity Cache
 *
 * Caches individual entities (repos, accounts, invoices)
 * separate from widget data for efficient sharing
 */

import { smartCache } from './smart-cache.service.js';
import { logger } from '@skillancer/logger';

// Entity types for each provider
export type EntityType =
  // GitHub
  | 'github:repo'
  | 'github:commit'
  | 'github:pr'
  | 'github:issue'
  // GitLab
  | 'gitlab:project'
  | 'gitlab:mr'
  // QuickBooks
  | 'quickbooks:account'
  | 'quickbooks:invoice'
  | 'quickbooks:bill'
  | 'quickbooks:customer'
  | 'quickbooks:vendor'
  // Xero
  | 'xero:account'
  | 'xero:invoice'
  | 'xero:contact'
  // Stripe
  | 'stripe:customer'
  | 'stripe:subscription'
  | 'stripe:invoice'
  | 'stripe:product'
  // AWS
  | 'aws:cost'
  | 'aws:service'
  // Generic
  | 'entity';

export interface EntityMeta {
  type: EntityType;
  id: string;
  integrationId: string;
  dependentWidgets: string[];
  updatedAt: number;
}

// Track which widgets depend on which entities
const entityWidgetDependencies: Map<string, Set<string>> = new Map();

export class EntityCache {
  private readonly TTL_BY_TYPE: Record<string, number> = {
    'github:repo': 3600, // 1 hour
    'github:commit': 86400, // 24 hours (immutable)
    'github:pr': 300, // 5 minutes
    'quickbooks:account': 3600, // 1 hour
    'quickbooks:invoice': 600, // 10 minutes
    'stripe:subscription': 300, // 5 minutes
    'aws:cost': 3600, // 1 hour
    default: 600, // 10 minutes
  };

  /**
   * Get entity from cache
   */
  async getEntity<T>(type: EntityType, id: string): Promise<T | null> {
    const key = this.buildKey(type, id);
    const result = await smartCache.get<T>(key);
    return result?.data || null;
  }

  /**
   * Get multiple entities
   */
  async getEntities<T>(type: EntityType, ids: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    await Promise.all(
      ids.map(async (id) => {
        const entity = await this.getEntity<T>(type, id);
        if (entity) {
          results.set(id, entity);
        }
      })
    );

    return results;
  }

  /**
   * Set entity in cache
   */
  async setEntity<T>(
    type: EntityType,
    id: string,
    data: T,
    integrationId: string,
    dependentWidgets?: string[]
  ): Promise<void> {
    const key = this.buildKey(type, id);
    const ttl = this.TTL_BY_TYPE[type] || this.TTL_BY_TYPE.default;

    await smartCache.set(key, data, {
      ttl,
      tags: [`entity:${type}`, `integration:${integrationId}`],
    });

    // Track widget dependencies
    if (dependentWidgets?.length) {
      const existing = entityWidgetDependencies.get(key) || new Set();
      dependentWidgets.forEach((w) => existing.add(w));
      entityWidgetDependencies.set(key, existing);
    }
  }

  /**
   * Set multiple entities
   */
  async setEntities<T>(
    type: EntityType,
    entities: Array<{ id: string; data: T }>,
    integrationId: string
  ): Promise<void> {
    await Promise.all(
      entities.map(({ id, data }) => this.setEntity(type, id, data, integrationId))
    );
  }

  /**
   * Invalidate entity and notify dependent widgets
   */
  async invalidateEntity(type: EntityType, id: string): Promise<string[]> {
    const key = this.buildKey(type, id);

    // Get dependent widgets before deleting
    const dependentWidgets = Array.from(entityWidgetDependencies.get(key) || []);

    await smartCache.delete(key);
    entityWidgetDependencies.delete(key);

    logger.debug('Entity invalidated', { type, id, dependentWidgets });

    return dependentWidgets;
  }

  /**
   * Invalidate all entities by type
   */
  async invalidateByType(type: EntityType): Promise<void> {
    await smartCache.invalidateByTag(`entity:${type}`);
  }

  /**
   * Invalidate entities by pattern
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    await smartCache.invalidateByPattern(`entity:${pattern}`);
  }

  /**
   * Register widget dependency on entity
   */
  registerDependency(type: EntityType, entityId: string, widgetId: string): void {
    const key = this.buildKey(type, entityId);
    const existing = entityWidgetDependencies.get(key) || new Set();
    existing.add(widgetId);
    entityWidgetDependencies.set(key, existing);
  }

  /**
   * Get widgets dependent on entity
   */
  getDependentWidgets(type: EntityType, entityId: string): string[] {
    const key = this.buildKey(type, entityId);
    return Array.from(entityWidgetDependencies.get(key) || []);
  }

  /**
   * Get or fetch entity with caching
   */
  async getOrFetch<T>(
    type: EntityType,
    id: string,
    integrationId: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const key = this.buildKey(type, id);
    const ttl = this.TTL_BY_TYPE[type] || this.TTL_BY_TYPE.default;

    return smartCache.getOrFetch(key, fetcher, {
      ttl,
      tags: [`entity:${type}`, `integration:${integrationId}`],
    });
  }

  /**
   * Batch get or fetch
   */
  async batchGetOrFetch<T>(
    type: EntityType,
    ids: string[],
    integrationId: string,
    fetcher: (ids: string[]) => Promise<Map<string, T>>
  ): Promise<Map<string, T>> {
    // Check cache for all IDs
    const cached = await this.getEntities<T>(type, ids);
    const missingIds = ids.filter((id) => !cached.has(id));

    if (missingIds.length === 0) {
      return cached;
    }

    // Fetch missing entities
    const fetched = await fetcher(missingIds);

    // Cache fetched entities
    await this.setEntities(
      type,
      Array.from(fetched.entries()).map(([id, data]) => ({ id, data })),
      integrationId
    );

    // Combine results
    for (const [id, data] of fetched) {
      cached.set(id, data);
    }

    return cached;
  }

  // ==================== Helpers ====================

  private buildKey(type: EntityType, id: string): string {
    return `entity:${type}:${id}`;
  }
}

// Singleton instance
export const entityCache = new EntityCache();

