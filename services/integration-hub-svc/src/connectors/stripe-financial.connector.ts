// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/connectors/stripe-financial
 * Stripe Financial Connector for CFO Tool Suite
 *
 * CFO-focused Stripe integration for:
 * - MRR metrics and subscription analytics
 * - Revenue breakdown by product
 * - Payment volume and success rates
 * - Churn analysis
 */

import type { ExecutiveType } from '@skillancer/database';
import type {
  ConnectorInfo,
  FetchOptions,
  FetchResult,
  IntegrationCategory,
  IntegrationTier,
  OAuthConfig,
  OAuthTokens,
  WidgetData,
  WidgetDefinition,
} from '../types/index.js';
import { BaseConnector } from './base.connector.js';

export class StripeFinancialConnector extends BaseConnector {
  readonly id = 'stripe-financial';
  readonly slug = 'stripe-financial';
  readonly name = 'Stripe (CFO)';
  readonly description =
    'Payment processing with CFO-focused metrics: MRR, churn, revenue analytics.';
  readonly logoUrl = '/integrations/stripe.svg';
  readonly category: IntegrationCategory = 'PAYMENTS';
  readonly applicableRoles: ExecutiveType[] = ['FRACTIONAL_CFO', 'FRACTIONAL_CRO'];
  readonly tier: IntegrationTier = 'professional';

  protected baseUrl = 'https://api.stripe.com/v1';

  readonly supportedWidgets: WidgetDefinition[] = [
    {
      id: 'mrr-metrics',
      name: 'MRR Metrics',
      description: 'Monthly recurring revenue and growth',
      category: 'financial',
      refreshInterval: 3600,
      requiredScopes: ['read_only'],
    },
    {
      id: 'subscription-analytics',
      name: 'Subscription Analytics',
      description: 'Active subscriptions, churn, ARPU',
      category: 'financial',
      refreshInterval: 3600,
      requiredScopes: ['read_only'],
    },
    {
      id: 'payment-volume',
      name: 'Payment Volume',
      description: 'Transaction volume and success rates',
      category: 'financial',
      refreshInterval: 1800,
      requiredScopes: ['read_only'],
    },
    {
      id: 'revenue-by-product',
      name: 'Revenue by Product',
      description: 'Revenue breakdown by product/price',
      category: 'financial',
      refreshInterval: 3600,
      requiredScopes: ['read_only'],
    },
    {
      id: 'refund-analytics',
      name: 'Refund Analytics',
      description: 'Refund rates and trends',
      category: 'financial',
      refreshInterval: 3600,
      requiredScopes: ['read_only'],
    },
  ];

  getOAuthConfig(): OAuthConfig {
    return {
      authorizationUrl: 'https://connect.stripe.com/oauth/authorize',
      tokenUrl: 'https://connect.stripe.com/oauth/token',
      revokeUrl: 'https://connect.stripe.com/oauth/deauthorize',
      clientId: process.env.STRIPE_CLIENT_ID || '',
      clientSecret: process.env.STRIPE_SECRET_KEY || '',
      scopes: ['read_only'],
      scopeDelimiter: ' ',
      pkceRequired: false,
    };
  }

  getAuthUrl(state: string, scopes?: string[], redirectUri?: string): string {
    const config = this.getOAuthConfig();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      scope: (scopes || config.scopes).join(' '),
      redirect_uri: redirectUri || this.getRedirectUri(),
      state,
    });
    return `${config.authorizationUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    const response = await this.httpPost(config.tokenUrl, {
      grant_type: 'authorization_code',
      code,
      client_secret: config.clientSecret,
    });

    return {
      accessToken: response.access_token as string,
      refreshToken: response.refresh_token as string,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Stripe tokens don't expire
      tokenType: 'Bearer',
      scopes: ['read_only'],
      metadata: {
        stripeUserId: response.stripe_user_id,
        livemode: response.livemode,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    const response = await this.httpPost(config.tokenUrl, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_secret: config.clientSecret,
    });

    return {
      accessToken: response.access_token as string,
      refreshToken: (response.refresh_token as string) || refreshToken,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      tokenType: 'Bearer',
      scopes: ['read_only'],
      metadata: { stripeUserId: response.stripe_user_id },
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    const config = this.getOAuthConfig();
    await this.httpPost(
      config.revokeUrl!,
      {
        client_id: config.clientId,
        stripe_user_id: accessToken,
      },
      {
        headers: { Authorization: `Bearer ${config.clientSecret}` },
      }
    );
  }

  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      await this.fetchData(tokens, '/balance');
      return true;
    } catch {
      return false;
    }
  }

  async fetchData<T>(
    tokens: OAuthTokens,
    endpoint: string,
    options?: FetchOptions
  ): Promise<FetchResult<T>> {
    const response = await this.httpGet(`${this.baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Stripe-Version': '2023-10-16',
      },
      ...options,
    });
    return { data: response as T, metadata: {} };
  }

  async getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    switch (widgetId) {
      case 'mrr-metrics':
        return this.getMRRMetricsWidget(tokens);
      case 'subscription-analytics':
        return this.getSubscriptionAnalyticsWidget(tokens);
      case 'payment-volume':
        return this.getPaymentVolumeWidget(tokens, params);
      case 'revenue-by-product':
        return this.getRevenueByProductWidget(tokens, params);
      case 'refund-analytics':
        return this.getRefundAnalyticsWidget(tokens, params);
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  // Core API Methods
  async getSubscriptions(tokens: OAuthTokens, status?: string): Promise<StripeSubscription[]> {
    let endpoint = '/subscriptions?limit=100';
    if (status) endpoint += `&status=${status}`;
    const result = await this.fetchData<StripeListResponse<StripeSubscription>>(tokens, endpoint);
    return result.data.data || [];
  }

  async getCharges(
    tokens: OAuthTokens,
    startDate: number,
    endDate: number
  ): Promise<StripeCharge[]> {
    const endpoint = `/charges?limit=100&created[gte]=${startDate}&created[lte]=${endDate}`;
    const result = await this.fetchData<StripeListResponse<StripeCharge>>(tokens, endpoint);
    return result.data.data || [];
  }

  async getRefunds(
    tokens: OAuthTokens,
    startDate: number,
    endDate: number
  ): Promise<StripeRefund[]> {
    const endpoint = `/refunds?limit=100&created[gte]=${startDate}&created[lte]=${endDate}`;
    const result = await this.fetchData<StripeListResponse<StripeRefund>>(tokens, endpoint);
    return result.data.data || [];
  }

  async getProducts(tokens: OAuthTokens): Promise<StripeProduct[]> {
    const result = await this.fetchData<StripeListResponse<StripeProduct>>(
      tokens,
      '/products?active=true&limit=100'
    );
    return result.data.data || [];
  }

  async getInvoices(tokens: OAuthTokens, status?: string, limit = 100): Promise<StripeInvoice[]> {
    let endpoint = `/invoices?limit=${limit}`;
    if (status) endpoint += `&status=${status}`;
    const result = await this.fetchData<StripeListResponse<StripeInvoice>>(tokens, endpoint);
    return result.data.data || [];
  }

  // MRR Calculation
  async calculateMRR(tokens: OAuthTokens): Promise<MRRData> {
    const subscriptions = await this.getSubscriptions(tokens, 'active');

    let currentMRR = 0;
    const byProduct: Record<string, number> = {};

    for (const sub of subscriptions) {
      for (const item of sub.items?.data || []) {
        const price = item.price;
        let monthlyAmount = 0;

        if (price.recurring?.interval === 'month') {
          monthlyAmount = ((price.unit_amount || 0) * (item.quantity || 1)) / 100;
        } else if (price.recurring?.interval === 'year') {
          monthlyAmount = ((price.unit_amount || 0) * (item.quantity || 1)) / 100 / 12;
        }

        currentMRR += monthlyAmount;

        const productId = price.product as string;
        byProduct[productId] = (byProduct[productId] || 0) + monthlyAmount;
      }
    }

    return {
      currentMRR,
      subscriptionCount: subscriptions.length,
      byProduct,
    };
  }

  // Widget Implementations
  private async getMRRMetricsWidget(tokens: OAuthTokens): Promise<WidgetData> {
    const mrrData = await this.calculateMRR(tokens);

    // Calculate previous month MRR for comparison (simplified)
    const previousMRR = mrrData.currentMRR * 0.95; // Placeholder
    const growth = previousMRR > 0 ? ((mrrData.currentMRR - previousMRR) / previousMRR) * 100 : 0;

    return {
      widgetId: 'mrr-metrics',
      data: {
        currentMRR: Math.round(mrrData.currentMRR * 100) / 100,
        previousMRR: Math.round(previousMRR * 100) / 100,
        growth: Math.round(growth * 10) / 10,
        arr: Math.round(mrrData.currentMRR * 12 * 100) / 100,
        subscriptionCount: mrrData.subscriptionCount,
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  private async getSubscriptionAnalyticsWidget(tokens: OAuthTokens): Promise<WidgetData> {
    const [active, canceled, trialing] = await Promise.all([
      this.getSubscriptions(tokens, 'active'),
      this.getSubscriptions(tokens, 'canceled'),
      this.getSubscriptions(tokens, 'trialing'),
    ]);

    const mrrData = await this.calculateMRR(tokens);
    const arpu = active.length > 0 ? mrrData.currentMRR / active.length : 0;

    // Calculate churn (simplified - last 30 days)
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const recentCanceled = canceled.filter((s) => s.canceled_at && s.canceled_at > thirtyDaysAgo);
    const churnRate =
      active.length > 0
        ? (recentCanceled.length / (active.length + recentCanceled.length)) * 100
        : 0;

    return {
      widgetId: 'subscription-analytics',
      data: {
        active: active.length,
        trialing: trialing.length,
        canceled: canceled.length,
        recentCanceled: recentCanceled.length,
        arpu: Math.round(arpu * 100) / 100,
        churnRate: Math.round(churnRate * 10) / 10,
        netRevenueRetention: 100 - churnRate, // Simplified
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  private async getPaymentVolumeWidget(
    tokens: OAuthTokens,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    const days = (params?.days as number) || 30;
    const now = Math.floor(Date.now() / 1000);
    const startDate = now - days * 24 * 60 * 60;

    const charges = await this.getCharges(tokens, startDate, now);

    const successful = charges.filter((c) => c.status === 'succeeded');
    const failed = charges.filter((c) => c.status === 'failed');
    const totalVolume = successful.reduce((sum, c) => sum + (c.amount || 0) / 100, 0);
    const successRate = charges.length > 0 ? (successful.length / charges.length) * 100 : 0;

    return {
      widgetId: 'payment-volume',
      data: {
        totalVolume: Math.round(totalVolume * 100) / 100,
        transactionCount: charges.length,
        successfulCount: successful.length,
        failedCount: failed.length,
        successRate: Math.round(successRate * 10) / 10,
        averageTransaction:
          successful.length > 0 ? Math.round((totalVolume / successful.length) * 100) / 100 : 0,
        period: { days, startDate: new Date(startDate * 1000).toISOString() },
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  private async getRevenueByProductWidget(
    tokens: OAuthTokens,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    const [mrrData, products] = await Promise.all([
      this.calculateMRR(tokens),
      this.getProducts(tokens),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p.name]));
    const revenueByProduct = Object.entries(mrrData.byProduct)
      .map(([productId, revenue]) => ({
        productId,
        productName: productMap.get(productId) || 'Unknown',
        revenue: Math.round(revenue * 100) / 100,
        percentage:
          mrrData.currentMRR > 0 ? Math.round((revenue / mrrData.currentMRR) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      widgetId: 'revenue-by-product',
      data: {
        totalMRR: Math.round(mrrData.currentMRR * 100) / 100,
        productCount: revenueByProduct.length,
        products: revenueByProduct,
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  private async getRefundAnalyticsWidget(
    tokens: OAuthTokens,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    const days = (params?.days as number) || 30;
    const now = Math.floor(Date.now() / 1000);
    const startDate = now - days * 24 * 60 * 60;

    const [refunds, charges] = await Promise.all([
      this.getRefunds(tokens, startDate, now),
      this.getCharges(tokens, startDate, now),
    ]);

    const totalRefunded = refunds.reduce((sum, r) => sum + (r.amount || 0) / 100, 0);
    const totalCharged = charges
      .filter((c) => c.status === 'succeeded')
      .reduce((sum, c) => sum + (c.amount || 0) / 100, 0);
    const refundRate = totalCharged > 0 ? (totalRefunded / totalCharged) * 100 : 0;

    return {
      widgetId: 'refund-analytics',
      data: {
        totalRefunded: Math.round(totalRefunded * 100) / 100,
        refundCount: refunds.length,
        refundRate: Math.round(refundRate * 100) / 100,
        averageRefund:
          refunds.length > 0 ? Math.round((totalRefunded / refunds.length) * 100) / 100 : 0,
        period: { days },
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  private getRedirectUri(): string {
    return (
      process.env.STRIPE_REDIRECT_URI || 'https://app.skillancer.io/integrations/stripe/callback'
    );
  }

  getInfo(): ConnectorInfo {
    return {
      id: this.id,
      slug: this.slug,
      name: this.name,
      description: this.description,
      logoUrl: this.logoUrl,
      category: this.category,
      applicableRoles: this.applicableRoles,
      tier: this.tier,
      supportedWidgets: this.supportedWidgets,
      webhookEnabled: true,
      isBeta: false,
    };
  }
}

// Type Definitions
interface StripeListResponse<T> {
  data: T[];
  has_more: boolean;
}

interface StripeSubscription {
  id: string;
  status: string;
  canceled_at?: number;
  items?: { data: StripeSubscriptionItem[] };
}

interface StripeSubscriptionItem {
  id: string;
  quantity?: number;
  price: StripePrice;
}

interface StripePrice {
  id: string;
  product: string;
  unit_amount?: number;
  recurring?: { interval: string; interval_count: number };
}

interface StripeCharge {
  id: string;
  amount: number;
  status: string;
  created: number;
}

interface StripeRefund {
  id: string;
  amount: number;
  status: string;
  created: number;
}

interface StripeProduct {
  id: string;
  name: string;
  active: boolean;
}

interface StripeInvoice {
  id: string;
  status: string;
  total: number;
  created: number;
}

interface MRRData {
  currentMRR: number;
  subscriptionCount: number;
  byProduct: Record<string, number>;
}

export const stripeFinancialConnector = new StripeFinancialConnector();

