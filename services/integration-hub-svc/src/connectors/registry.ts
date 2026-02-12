// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/connectors/registry
 * Connector Registry - manages all available connectors
 */

import type { IntegrationConnector } from './base.connector.js';
import type { ExecutiveType } from '@skillancer/database';
import type { IntegrationCategory, ConnectorInfo } from '../types/index.js';

// Import connectors
import { SlackConnector } from './slack.connector.js';
import { GoogleCalendarConnector } from './google-calendar.connector.js';
import { NotionConnector } from './notion.connector.js';
import { JiraConnector } from './jira.connector.js';
import { GitHubConnector } from './github.connector.js';
import { GitLabConnector } from './gitlab.connector.js';
import { AWSConnector } from './aws.connector.js';
import { SnykConnector } from './snyk.connector.js';
// CFO Tool Suite connectors
import { QuickBooksConnector } from './quickbooks.connector.js';
import { XeroConnector } from './xero.connector.js';
import { StripeFinancialConnector } from './stripe-financial.connector.js';
import { PlaidCFOConnector } from './plaid-cfo.connector.js';

// ============================================================================
// CONNECTOR REGISTRY
// ============================================================================

class ConnectorRegistry {
  private connectors: Map<string, IntegrationConnector> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize the registry with all available connectors
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Register all connectors
    this.register(new SlackConnector());
    this.register(new GoogleCalendarConnector());
    this.register(new NotionConnector());
    this.register(new JiraConnector());

    // CTO Tool Suite connectors
    this.register(new GitHubConnector());
    this.register(new GitLabConnector());
    this.register(new AWSConnector());
    this.register(new SnykConnector());

    // CFO Tool Suite connectors
    this.register(new QuickBooksConnector());
    this.register(new XeroConnector());
    this.register(new StripeFinancialConnector());
    this.register(new PlaidCFOConnector());

    this.initialized = true;
    console.log(`📦 Registered ${this.connectors.size} integration connectors`);
  }

  /**
   * Register a connector
   */
  register(connector: IntegrationConnector): void {
    if (this.connectors.has(connector.slug)) {
      console.warn(`Connector ${connector.slug} is already registered`);
      return;
    }
    this.connectors.set(connector.slug, connector);
  }

  /**
   * Get a connector by slug
   */
  get(slug: string): IntegrationConnector | undefined {
    return this.connectors.get(slug);
  }

  /**
   * Get a connector by slug, throwing if not found
   */
  getOrThrow(slug: string): IntegrationConnector {
    const connector = this.connectors.get(slug);
    if (!connector) {
      throw new Error(`Connector not found: ${slug}`);
    }
    return connector;
  }

  /**
   * Check if a connector exists
   */
  has(slug: string): boolean {
    return this.connectors.has(slug);
  }

  /**
   * Get all connectors
   */
  getAll(): IntegrationConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Get all connector info
   */
  getAllInfo(): ConnectorInfo[] {
    return this.getAll().map((c) => c.getInfo());
  }

  /**
   * Get connectors by category
   */
  getByCategory(category: IntegrationCategory): IntegrationConnector[] {
    return this.getAll().filter((c) => c.category === category);
  }

  /**
   * Get connectors applicable to an executive type
   */
  getByExecutiveType(executiveType: ExecutiveType): IntegrationConnector[] {
    return this.getAll().filter((c) => c.applicableRoles.includes(executiveType));
  }

  /**
   * Get connectors grouped by category
   */
  getGroupedByCategory(): Map<IntegrationCategory, IntegrationConnector[]> {
    const grouped = new Map<IntegrationCategory, IntegrationConnector[]>();

    for (const connector of this.getAll()) {
      const existing = grouped.get(connector.category) || [];
      existing.push(connector);
      grouped.set(connector.category, existing);
    }

    return grouped;
  }
}

// Singleton instance
export const connectorRegistry = new ConnectorRegistry();

/**
 * Initialize the connector registry
 */
export async function initializeConnectorRegistry(): Promise<void> {
  await connectorRegistry.initialize();
}
