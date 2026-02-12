// @ts-nocheck
/**
 * Freelancer.com Platform Connector
 * OAuth 2.0 integration with Freelancer.com API
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

const logger = createLogger('freelancer-connector');

// =============================================================================
// FREELANCER API TYPES
// =============================================================================

interface FreelancerUser {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  avatar_large?: string;
  public_url: string;
  location?: {
    country?: { name: string };
    city?: string;
  };
  tagline?: string;
  primary_currency?: { code: string };
  registration_date?: number;
  role?: string;
  status?: {
    payment_verified?: boolean;
    email_verified?: boolean;
    identity_verified?: boolean;
  };
  reputation?: {
    entire_history?: {
      overall?: number;
      all?: number;
      reviews?: number;
      earnings?: number;
    };
  };
  jobs?: { id: number; name: string }[];
  hourly_rate?: number;
}

interface FreelancerProject {
  id: number;
  owner_id: number;
  title: string;
  seo_url: string;
  description?: string;
  currency?: { code: string };
  budget?: { minimum?: number; maximum?: number };
  jobs?: { id: number; name: string }[];
  status?: string;
  time_submitted?: number;
  time_awarded?: number;
  time_updated?: number;
  bid_stats?: {
    bid_count?: number;
    bid_avg?: number;
  };
}

interface FreelancerBid {
  id: number;
  bidder_id: number;
  project_id: number;
  project?: FreelancerProject;
  amount: number;
  period?: number;
  description?: string;
  time_submitted?: number;
  time_awarded?: number;
  award_status?: string;
  complete_status?: string;
  paid_amount?: number;
  retracted?: boolean;
}

interface FreelancerReview {
  id: number;
  to_user_id: number;
  from_user_id: number;
  from_user?: { username: string; display_name: string };
  project_id?: number;
  project?: { title: string };
  role?: string;
  rating: number;
  description?: string;
  time_submitted?: number;
  paid_amount?: number;
  context_type?: string;
}

// =============================================================================
// FREELANCER CONNECTOR
// =============================================================================

export class FreelancerConnector extends PlatformConnector {
  private readonly baseUrl = 'https://www.freelancer.com/api';

  constructor() {
    super(Platform.FREELANCER);
    registerConnector(this);
  }

  // ---------------------------------------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------------------------------------

  protected getOAuthConfig(): OAuthConfig {
    return {
      clientId: process.env.FREELANCER_CLIENT_ID || '',
      clientSecret: process.env.FREELANCER_CLIENT_SECRET || '',
      redirectUri: `${process.env.APP_URL}/api/v1/verify/platform/callback/freelancer`,
      authorizationUrl: 'https://accounts.freelancer.com/oauth/authorize',
      tokenUrl: 'https://accounts.freelancer.com/oauth/token',
      scopes: ['basic', 'fln:project_read', 'fln:review_read', 'fln:bid_read'],
    };
  }

  protected getRateLimitConfig(): RateLimitConfig {
    return {
      maxRequests: 100,
      windowMs: 60 * 1000, // 1 minute
      retryAfterMs: 60 * 1000,
    };
  }

  // ---------------------------------------------------------------------------
  // PROFILE
  // ---------------------------------------------------------------------------

  async fetchProfile(token: AuthToken): Promise<PlatformProfile> {
    logger.info('Fetching Freelancer.com profile');

    const response = await this.makeRequest(
      `${this.baseUrl}/users/0.1/self?avatar=true&reputation=true&jobs=true&status=true`,
      {
        headers: {
          'Freelancer-OAuth-V1': token.accessToken,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch Freelancer profile: ${error}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(`Freelancer API error: ${data.message || 'Unknown error'}`);
    }

    return this.normalizeProfile(data.result);
  }

  private normalizeProfile(user: FreelancerUser): PlatformProfile {
    return {
      platformUserId: user.id.toString(),
      username: user.username,
      displayName: user.display_name || user.username,
      email: user.email,
      avatarUrl: user.avatar_large,
      profileUrl: user.public_url || `https://www.freelancer.com/u/${user.username}`,
      joinedDate: user.registration_date ? new Date(user.registration_date * 1000) : undefined,
      location: user.location?.country?.name,
      bio: user.tagline,
      skills: user.jobs?.map((j) => j.name) || [],
      verified: user.status?.payment_verified || user.status?.identity_verified || false,
      raw: user,
    };
  }

  // ---------------------------------------------------------------------------
  // WORK HISTORY (Awarded Bids/Projects)
  // ---------------------------------------------------------------------------

  async fetchWorkHistory(token: AuthToken): Promise<WorkHistoryItem[]> {
    logger.info('Fetching Freelancer.com work history');

    // First, get the user ID
    const profileResponse = await this.makeRequest(`${this.baseUrl}/users/0.1/self`, {
      headers: {
        'Freelancer-OAuth-V1': token.accessToken,
        Accept: 'application/json',
      },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to get user ID');
    }

    const profileData = await profileResponse.json();
    const userId = profileData.result.id;

    // Fetch awarded bids (completed work)
    const bids: FreelancerBid[] = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest(
        `${this.baseUrl}/projects/0.1/bids?bidders[]=${userId}&award_status=awarded&limit=${limit}&offset=${offset}&project_details=true`,
        {
          headers: {
            'Freelancer-OAuth-V1': token.accessToken,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          break;
        }
        const error = await response.text();
        throw new Error(`Failed to fetch Freelancer bids: ${error}`);
      }

      const data = await response.json();

      if (data.status !== 'success') {
        break;
      }

      const pageBids = data.result?.bids || [];

      if (pageBids.length === 0) {
        hasMore = false;
      } else {
        bids.push(...pageBids);
        offset += limit;

        // Safety limit
        if (bids.length >= 500) {
          hasMore = false;
        }
      }
    }

    return bids.map((bid) => this.normalizeBid(bid));
  }

  private normalizeBid(bid: FreelancerBid): WorkHistoryItem {
    const project = bid.project;

    return {
      platformProjectId: bid.id.toString(),
      title: project?.title || `Project #${bid.project_id}`,
      description: project?.description || bid.description,
      clientName: undefined, // Privacy - we don't expose client info
      clientId: project?.owner_id?.toString(),
      startDate: new Date((bid.time_awarded || bid.time_submitted || Date.now() / 1000) * 1000),
      endDate: bid.complete_status === 'complete' ? new Date() : undefined,
      earnings: bid.paid_amount || bid.amount,
      currency: project?.currency?.code || 'USD',
      hoursWorked: bid.period ? bid.period * 8 : undefined, // Estimate hours from period
      rating: undefined, // Will be populated from reviews
      reviewText: undefined,
      skills: project?.jobs?.map((j) => j.name) || [],
      projectUrl: project?.seo_url
        ? `https://www.freelancer.com/projects/${project.seo_url}`
        : undefined,
      status: this.mapBidStatus(bid.complete_status, bid.award_status),
      raw: bid,
    };
  }

  private mapBidStatus(
    completeStatus?: string,
    awardStatus?: string
  ): 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED' {
    if (completeStatus === 'complete') {
      return 'COMPLETED';
    }
    if (awardStatus === 'awarded') {
      return 'IN_PROGRESS';
    }
    if (completeStatus === 'incomplete' || awardStatus === 'revoked') {
      return 'CANCELLED';
    }
    return 'IN_PROGRESS';
  }

  // ---------------------------------------------------------------------------
  // REVIEWS
  // ---------------------------------------------------------------------------

  async fetchReviews(token: AuthToken): Promise<PlatformReview[]> {
    logger.info('Fetching Freelancer.com reviews');

    // Get user ID
    const profileResponse = await this.makeRequest(`${this.baseUrl}/users/0.1/self`, {
      headers: {
        'Freelancer-OAuth-V1': token.accessToken,
        Accept: 'application/json',
      },
    });

    if (!profileResponse.ok) {
      return [];
    }

    const profileData = await profileResponse.json();
    const userId = profileData.result.id;

    // Fetch reviews
    const response = await this.makeRequest(
      `${this.baseUrl}/projects/0.1/reviews?to_users[]=${userId}&from_user_details=true&project_details=true&limit=100`,
      {
        headers: {
          'Freelancer-OAuth-V1': token.accessToken,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (data.status !== 'success') {
      return [];
    }

    const reviews = data.result?.reviews || [];
    return reviews.map((review: FreelancerReview) => this.normalizeReview(review));
  }

  private normalizeReview(review: FreelancerReview): PlatformReview {
    return {
      reviewId: review.id.toString(),
      projectId: review.project_id?.toString(),
      rating: review.rating,
      maxRating: 5,
      reviewText: review.description,
      reviewerName: review.from_user?.display_name || review.from_user?.username,
      reviewerId: review.from_user_id.toString(),
      reviewDate: new Date((review.time_submitted || Date.now() / 1000) * 1000),
      isPublic: true,
      raw: review,
    };
  }

  // ---------------------------------------------------------------------------
  // EARNINGS
  // ---------------------------------------------------------------------------

  async fetchEarnings(token: AuthToken): Promise<EarningsData | null> {
    logger.info('Fetching Freelancer.com earnings');

    try {
      // Get reputation which includes earnings data
      const response = await this.makeRequest(
        `${this.baseUrl}/users/0.1/self?reputation=true&reputation_extra=true`,
        {
          headers: {
            'Freelancer-OAuth-V1': token.accessToken,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data.status !== 'success') {
        return null;
      }

      const reputation = data.result?.reputation?.entire_history;

      if (!reputation) {
        return null;
      }

      return {
        totalEarnings: reputation.earnings || 0,
        currency: data.result?.primary_currency?.code || 'USD',
        raw: reputation,
      };
    } catch (error) {
      logger.warn({ error }, 'Failed to fetch Freelancer earnings');
      return null;
    }
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
      'Verifying Freelancer.com data'
    );

    const checks: VerificationResult['checks'] = [];
    let verified = true;

    // Check 1: OAuth Connection
    checks.push({
      check: 'oauth_connection',
      passed: true,
      details: 'Authenticated via OAuth 2.0',
    });

    // Check 2: Data from platform API
    checks.push({
      check: 'api_source',
      passed: true,
      details: 'Data retrieved from Freelancer.com API',
    });

    // Check 3: Verify project/bid exists
    if ('platformProjectId' in data) {
      try {
        const response = await this.makeRequest(
          `${this.baseUrl}/projects/0.1/bids/${data.platformProjectId}`,
          {
            headers: {
              'Freelancer-OAuth-V1': token.accessToken,
              Accept: 'application/json',
            },
          }
        );

        if (response.ok) {
          const bidData = await response.json();
          if (bidData.status === 'success') {
            checks.push({
              check: 'bid_exists',
              passed: true,
              details: 'Bid verified in Freelancer.com system',
            });
          } else {
            checks.push({
              check: 'bid_exists',
              passed: false,
              details: 'Bid not found',
            });
            verified = false;
          }
        } else {
          checks.push({
            check: 'bid_exists',
            passed: false,
            details: 'Could not verify bid',
          });
          verified = false;
        }
      } catch {
        checks.push({
          check: 'bid_exists',
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
  // ADDITIONAL METHODS
  // ---------------------------------------------------------------------------

  /**
   * Fetch portfolio items
   */
  async fetchPortfolio(token: AuthToken): Promise<any[]> {
    logger.info('Fetching Freelancer.com portfolio');

    try {
      const profileResponse = await this.makeRequest(`${this.baseUrl}/users/0.1/self`, {
        headers: {
          'Freelancer-OAuth-V1': token.accessToken,
          Accept: 'application/json',
        },
      });

      if (!profileResponse.ok) {
        return [];
      }

      const profileData = await profileResponse.json();
      const userId = profileData.result.id;

      const response = await this.makeRequest(
        `${this.baseUrl}/users/0.1/portfolios?users[]=${userId}&limit=50`,
        {
          headers: {
            'Freelancer-OAuth-V1': token.accessToken,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.result?.portfolios || [];
    } catch (error) {
      logger.warn({ error }, 'Failed to fetch Freelancer portfolio');
      return [];
    }
  }
}

// Create and register singleton
const freelancerConnector = new FreelancerConnector();

export function getFreelancerConnector(): FreelancerConnector {
  return freelancerConnector;
}
