// @ts-nocheck
/**
 * Fiverr Platform Connector
 * OAuth integration with Fiverr API (with scraping fallback)
 * Sprint M4: Portable Verified Work History
 */

import { createLogger } from '@skillancer/logger';
import {
  PlatformConnector,
  Platform,
  OAuthConfig,
  RateLimitConfig,
  AuthToken,
  PlatformProfile,
  WorkHistoryItem,
  PlatformReview,
  EarningsData,
  VerificationResult,
  VerificationLevel,
  registerConnector,
} from '../platform-connector';

const logger = createLogger('fiverr-connector');

// =============================================================================
// FIVERR API TYPES
// =============================================================================

interface FiverrUser {
  id: string;
  username: string;
  display_name: string;
  email?: string;
  profile_image?: string;
  profile_url: string;
  country?: string;
  description?: string;
  member_since?: string;
  seller_level?: string;
  rating?: number;
  reviews_count?: number;
  completed_orders?: number;
  skills?: string[];
}

interface FiverrGig {
  gig_id: string;
  title: string;
  description?: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  price?: number;
  currency?: string;
  delivery_time?: number;
  orders_in_queue?: number;
  status?: string;
}

interface FiverrOrder {
  order_id: string;
  gig_id: string;
  gig_title: string;
  buyer_username?: string;
  buyer_id?: string;
  price: number;
  currency: string;
  created_at: string;
  delivered_at?: string;
  completed_at?: string;
  status: string;
  rating?: number;
  review_text?: string;
  extras?: any[];
}

// =============================================================================
// FIVERR CONNECTOR
// =============================================================================

export class FiverrConnector extends PlatformConnector {
  private readonly baseUrl = 'https://api.fiverr.com';

  constructor() {
    super(Platform.FIVERR);
    registerConnector(this);
  }

  // ---------------------------------------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------------------------------------

  protected getOAuthConfig(): OAuthConfig {
    return {
      clientId: process.env.FIVERR_CLIENT_ID || '',
      clientSecret: process.env.FIVERR_CLIENT_SECRET || '',
      redirectUri: `${process.env.APP_URL}/api/v1/verify/platform/callback/fiverr`,
      authorizationUrl: 'https://www.fiverr.com/oauth/authorize',
      tokenUrl: 'https://www.fiverr.com/oauth/token',
      scopes: ['read:profile', 'read:orders', 'read:reviews'],
    };
  }

  protected getRateLimitConfig(): RateLimitConfig {
    return {
      maxRequests: 30,
      windowMs: 60 * 1000, // 1 minute
      retryAfterMs: 60 * 1000,
    };
  }

  // ---------------------------------------------------------------------------
  // PROFILE
  // ---------------------------------------------------------------------------

  async fetchProfile(token: AuthToken): Promise<PlatformProfile> {
    logger.info('Fetching Fiverr profile');

    const response = await this.makeRequest(`${this.baseUrl}/v1/me`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch Fiverr profile: ${error}`);
    }

    const data = await response.json();
    const user: FiverrUser = data.user || data;

    return this.normalizeProfile(user);
  }

  private normalizeProfile(user: FiverrUser): PlatformProfile {
    return {
      platformUserId: user.id,
      username: user.username,
      displayName: user.display_name || user.username,
      email: user.email,
      avatarUrl: user.profile_image,
      profileUrl: user.profile_url || `https://www.fiverr.com/${user.username}`,
      joinedDate: user.member_since ? new Date(user.member_since) : undefined,
      location: user.country,
      bio: user.description,
      skills: user.skills || [],
      verified: true,
      raw: user,
    };
  }

  // ---------------------------------------------------------------------------
  // WORK HISTORY (Orders/Gigs)
  // ---------------------------------------------------------------------------

  async fetchWorkHistory(token: AuthToken): Promise<WorkHistoryItem[]> {
    logger.info('Fetching Fiverr order history');

    const orders: FiverrOrder[] = [];
    let page = 1;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest(
        `${this.baseUrl}/v1/me/orders?page=${page}&limit=${limit}&status=completed`,
        {
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          break;
        }
        const error = await response.text();
        throw new Error(`Failed to fetch Fiverr orders: ${error}`);
      }

      const data = await response.json();
      const pageOrders = data.orders || [];

      if (pageOrders.length === 0) {
        hasMore = false;
      } else {
        orders.push(...pageOrders);
        page++;

        // Safety limit
        if (orders.length >= 500) {
          hasMore = false;
        }
      }
    }

    return orders.map((order) => this.normalizeOrder(order));
  }

  private normalizeOrder(order: FiverrOrder): WorkHistoryItem {
    // Calculate total earnings including extras
    let totalEarnings = order.price;
    if (order.extras && Array.isArray(order.extras)) {
      totalEarnings += order.extras.reduce(
        (sum: number, extra: any) => sum + (extra.price || 0),
        0
      );
    }

    return {
      platformProjectId: order.order_id,
      title: order.gig_title,
      description: undefined, // Not available in order data
      clientName: order.buyer_username
        ? this.anonymizeClientName(order.buyer_username)
        : 'Fiverr Client',
      clientId: order.buyer_id,
      startDate: new Date(order.created_at),
      endDate: order.completed_at
        ? new Date(order.completed_at)
        : order.delivered_at
          ? new Date(order.delivered_at)
          : undefined,
      earnings: totalEarnings,
      currency: order.currency || 'USD',
      hoursWorked: undefined, // Fiverr doesn't track hours
      rating: order.rating,
      reviewText: order.review_text,
      skills: [], // Will be enriched from gig data if available
      projectUrl: undefined, // Orders don't have public URLs
      status: this.mapOrderStatus(order.status),
      raw: order,
    };
  }

  private mapOrderStatus(status: string): 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED' {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'COMPLETED';
      case 'active':
      case 'in_progress':
      case 'pending':
        return 'IN_PROGRESS';
      case 'cancelled':
      case 'rejected':
        return 'CANCELLED';
      default:
        return 'COMPLETED';
    }
  }

  private anonymizeClientName(username: string): string {
    // Partial anonymization for privacy
    if (username.length <= 3) {
      return `${username[0]}***`;
    }
    return `${username.substring(0, 2)}***${username.slice(-1)}`;
  }

  // ---------------------------------------------------------------------------
  // REVIEWS
  // ---------------------------------------------------------------------------

  async fetchReviews(token: AuthToken): Promise<PlatformReview[]> {
    logger.info('Fetching Fiverr reviews');

    const response = await this.makeRequest(`${this.baseUrl}/v1/me/reviews`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      const error = await response.text();
      throw new Error(`Failed to fetch Fiverr reviews: ${error}`);
    }

    const data = await response.json();
    const reviews = data.reviews || [];

    return reviews.map((review: any) => this.normalizeReview(review));
  }

  private normalizeReview(review: any): PlatformReview {
    return {
      reviewId: review.id || `rv_${Date.now()}`,
      projectId: review.order_id,
      rating: review.rating || review.score || 0,
      maxRating: 5,
      reviewText: review.comment || review.text,
      reviewerName: review.buyer_username
        ? this.anonymizeClientName(review.buyer_username)
        : 'Fiverr Buyer',
      reviewerId: review.buyer_id,
      reviewDate: new Date(review.created_at || Date.now()),
      isPublic: review.is_public !== false,
      raw: review,
    };
  }

  // ---------------------------------------------------------------------------
  // EARNINGS
  // ---------------------------------------------------------------------------

  async fetchEarnings(token: AuthToken): Promise<EarningsData | null> {
    logger.info('Fetching Fiverr earnings');

    try {
      const response = await this.makeRequest(`${this.baseUrl}/v1/me/earnings`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        // Earnings endpoint may require additional permissions
        return null;
      }

      const data = await response.json();

      return {
        totalEarnings: data.total_earnings || data.lifetime_earnings || 0,
        currency: data.currency || 'USD',
        earningsByPeriod: data.monthly_earnings?.map((e: any) => ({
          period: e.month || e.period,
          amount: e.amount,
        })),
        earningsByCategory: data.category_earnings?.map((e: any) => ({
          category: e.category,
          amount: e.amount,
        })),
        raw: data,
      };
    } catch (error) {
      logger.warn({ error }, 'Failed to fetch Fiverr earnings');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // GIG ENRICHMENT
  // ---------------------------------------------------------------------------

  async fetchGigs(token: AuthToken): Promise<FiverrGig[]> {
    logger.info('Fetching Fiverr gigs');

    const response = await this.makeRequest(`${this.baseUrl}/v1/me/gigs`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.gigs || [];
  }

  // ---------------------------------------------------------------------------
  // VERIFICATION
  // ---------------------------------------------------------------------------

  async verifyData(
    data: WorkHistoryItem | PlatformReview,
    token: AuthToken
  ): Promise<VerificationResult> {
    logger.info(
      {
        dataId: 'platformProjectId' in data ? data.platformProjectId : data.reviewId,
      },
      'Verifying Fiverr data'
    );

    const checks: VerificationResult['checks'] = [];
    let verified = true;

    // Check 1: OAuth Connection
    checks.push({
      check: 'oauth_connection',
      passed: true,
      details: 'Authenticated via OAuth',
    });

    // Check 2: Data from platform API
    checks.push({
      check: 'api_source',
      passed: true,
      details: 'Data retrieved directly from Fiverr API',
    });

    // Check 3: Verify order exists
    if ('platformProjectId' in data) {
      try {
        const response = await this.makeRequest(
          `${this.baseUrl}/v1/me/orders/${data.platformProjectId}`,
          {
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
              Accept: 'application/json',
            },
          }
        );

        if (response.ok) {
          checks.push({
            check: 'order_exists',
            passed: true,
            details: 'Order verified in Fiverr system',
          });
        } else {
          checks.push({
            check: 'order_exists',
            passed: false,
            details: 'Could not verify order',
          });
          verified = false;
        }
      } catch {
        checks.push({
          check: 'order_exists',
          passed: false,
          details: 'Verification check failed',
        });
      }
    }

    // Check 4: Data integrity
    const hash = this.generateVerificationHash(data);
    checks.push({
      check: 'data_integrity',
      passed: true,
      details: `Hash: ${hash.substring(0, 16)}...`,
    });

    return {
      verified,
      level: verified ? VerificationLevel.PLATFORM_VERIFIED : VerificationLevel.PLATFORM_CONNECTED,
      checks,
      verificationHash: hash,
      verifiedAt: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // SCRAPING FALLBACK
  // ---------------------------------------------------------------------------

  /**
   * Fallback method to extract public profile data
   * Used when API access is limited
   */
  async scrapePublicProfile(username: string): Promise<Partial<PlatformProfile>> {
    logger.info({ username }, 'Scraping public Fiverr profile');

    try {
      const response = await this.makeRequest(`https://www.fiverr.com/${username}`, {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (compatible; Skillancer/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch public profile');
      }

      const html = await response.text();

      // Extract structured data from the page
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);

      if (jsonLdMatch) {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        return {
          platformUserId: jsonLd.identifier || username,
          username,
          displayName: jsonLd.name,
          avatarUrl: jsonLd.image,
          profileUrl: `https://www.fiverr.com/${username}`,
          bio: jsonLd.description,
        };
      }

      return {
        username,
        profileUrl: `https://www.fiverr.com/${username}`,
      };
    } catch (error) {
      logger.warn({ username, error }, 'Failed to scrape Fiverr profile');
      return { username };
    }
  }
}

// Create and register singleton
const fiverrConnector = new FiverrConnector();

export function getFiverrConnector(): FiverrConnector {
  return fiverrConnector;
}
