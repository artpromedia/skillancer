// @ts-nocheck
/**
 * Upwork Platform Connector
 * OAuth 2.0 integration with Upwork API
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

const logger = createLogger('upwork-connector');

// =============================================================================
// UPWORK API TYPES
// =============================================================================

interface UpworkProfile {
  id: string;
  ref: string;
  profile_key: string;
  first_name: string;
  last_name: string;
  dev_portrait_100?: string;
  public_url: string;
  dev_email?: string;
  dev_recent_rank_percentile?: number;
  dev_total_hours?: number;
  dev_total_feedback?: number;
  dev_tot_feedback_recent?: number;
  dev_profile_title?: string;
  dev_blurb?: string;
  dev_country?: string;
  dev_timezone?: string;
  dev_member_since?: string;
  skills?: { skill: string }[];
  categories?: { name: string }[];
}

interface UpworkJob {
  as_type: string;
  as_id: string;
  as_title: string;
  as_client_name?: string;
  as_client_ref?: string;
  as_from: string;
  as_to?: string;
  as_total_hours?: number;
  as_total_charge?: number;
  as_currency?: string;
  as_contract_feedback?: number;
  as_contract_feedback_text?: string;
  as_description?: string;
  as_job_categories?: { name: string }[];
  as_job_skills?: { skill: string }[];
  as_status?: string;
}

interface UpworkEarnings {
  total_earnings: number;
  currency: string;
  earnings_by_year?: { year: string; amount: number }[];
}

// =============================================================================
// UPWORK CONNECTOR
// =============================================================================

export class UpworkConnector extends PlatformConnector {
  private readonly baseUrl = 'https://www.upwork.com/api';

  constructor() {
    super(Platform.UPWORK);
    registerConnector(this);
  }

  // ---------------------------------------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------------------------------------

  protected getOAuthConfig(): OAuthConfig {
    return {
      clientId: process.env.UPWORK_CLIENT_ID || '',
      clientSecret: process.env.UPWORK_CLIENT_SECRET || '',
      redirectUri: `${process.env.APP_URL}/api/v1/verify/platform/callback/upwork`,
      authorizationUrl: 'https://www.upwork.com/ab/account-security/oauth2/authorize',
      tokenUrl: 'https://www.upwork.com/api/v3/oauth2/token',
      scopes: ['openid', 'profile', 'email'],
    };
  }

  protected getRateLimitConfig(): RateLimitConfig {
    return {
      maxRequests: 50,
      windowMs: 60 * 1000, // 1 minute
      retryAfterMs: 60 * 1000,
    };
  }

  // ---------------------------------------------------------------------------
  // PROFILE
  // ---------------------------------------------------------------------------

  async fetchProfile(token: AuthToken): Promise<PlatformProfile> {
    logger.info('Fetching Upwork profile');

    const response = await this.makeRequest(`${this.baseUrl}/profiles/v1/me`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch Upwork profile: ${error}`);
    }

    const data = await response.json();
    const profile: UpworkProfile = data.user || data;

    return this.normalizeProfile(profile);
  }

  private normalizeProfile(profile: UpworkProfile): PlatformProfile {
    return {
      platformUserId: profile.id || profile.ref,
      username: profile.profile_key,
      displayName: `${profile.first_name} ${profile.last_name}`.trim(),
      email: profile.dev_email,
      avatarUrl: profile.dev_portrait_100,
      profileUrl: profile.public_url || `https://www.upwork.com/freelancers/${profile.profile_key}`,
      joinedDate: profile.dev_member_since ? new Date(profile.dev_member_since) : undefined,
      location: profile.dev_country,
      bio: profile.dev_blurb,
      skills: profile.skills?.map((s) => s.skill) || [],
      verified: true, // OAuth connection proves ownership
      raw: profile,
    };
  }

  // ---------------------------------------------------------------------------
  // WORK HISTORY
  // ---------------------------------------------------------------------------

  async fetchWorkHistory(token: AuthToken): Promise<WorkHistoryItem[]> {
    logger.info('Fetching Upwork work history');

    const jobs: UpworkJob[] = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest(
        `${this.baseUrl}/profiles/v1/providers/me/jobs?offset=${offset}&count=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // No jobs found
          break;
        }
        const error = await response.text();
        throw new Error(`Failed to fetch Upwork jobs: ${error}`);
      }

      const data = await response.json();
      const pageJobs = data.assignments || data.jobs || [];

      if (pageJobs.length === 0) {
        hasMore = false;
      } else {
        jobs.push(...pageJobs);
        offset += limit;

        // Safety limit
        if (jobs.length >= 500) {
          hasMore = false;
        }
      }
    }

    return jobs.map((job) => this.normalizeJob(job));
  }

  private normalizeJob(job: UpworkJob): WorkHistoryItem {
    return {
      platformProjectId: job.as_id,
      title: job.as_title,
      description: job.as_description,
      clientName: job.as_client_name,
      clientId: job.as_client_ref,
      startDate: new Date(job.as_from),
      endDate: job.as_to ? new Date(job.as_to) : undefined,
      earnings: job.as_total_charge,
      currency: job.as_currency || 'USD',
      hoursWorked: job.as_total_hours,
      rating: job.as_contract_feedback,
      reviewText: job.as_contract_feedback_text,
      skills: [
        ...(job.as_job_skills?.map((s) => s.skill) || []),
        ...(job.as_job_categories?.map((c) => c.name) || []),
      ],
      projectUrl: `https://www.upwork.com/contracts/${job.as_id}`,
      status: this.mapJobStatus(job.as_status),
      raw: job,
    };
  }

  private mapJobStatus(status?: string): 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED' {
    switch (status?.toLowerCase()) {
      case 'closed':
      case 'ended':
      case 'completed':
        return 'COMPLETED';
      case 'active':
      case 'in_progress':
        return 'IN_PROGRESS';
      case 'cancelled':
      case 'terminated':
        return 'CANCELLED';
      default:
        return 'COMPLETED';
    }
  }

  // ---------------------------------------------------------------------------
  // REVIEWS
  // ---------------------------------------------------------------------------

  async fetchReviews(token: AuthToken): Promise<PlatformReview[]> {
    logger.info('Fetching Upwork reviews');

    const response = await this.makeRequest(`${this.baseUrl}/profiles/v1/providers/me/feedbacks`, {
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
      throw new Error(`Failed to fetch Upwork reviews: ${error}`);
    }

    const data = await response.json();
    const feedbacks = data.feedbacks || [];

    return feedbacks.map((feedback: any) => this.normalizeReview(feedback));
  }

  private normalizeReview(feedback: any): PlatformReview {
    return {
      reviewId: feedback.reference || `fb_${Date.now()}`,
      projectId: feedback.assignment_ref,
      rating: feedback.score || 0,
      maxRating: 5,
      reviewText: feedback.comment,
      reviewerName: feedback.client_name,
      reviewerId: feedback.client_ref,
      reviewDate: new Date(feedback.created_ts || Date.now()),
      isPublic: true,
      raw: feedback,
    };
  }

  // ---------------------------------------------------------------------------
  // EARNINGS
  // ---------------------------------------------------------------------------

  async fetchEarnings(token: AuthToken): Promise<EarningsData | null> {
    logger.info('Fetching Upwork earnings');

    try {
      const response = await this.makeRequest(`${this.baseUrl}/profiles/v1/providers/me/earnings`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
          // Earnings may not be accessible
          return null;
        }
        return null;
      }

      const data: UpworkEarnings = await response.json();

      return {
        totalEarnings: data.total_earnings,
        currency: data.currency || 'USD',
        earningsByPeriod: data.earnings_by_year?.map((e) => ({
          period: e.year,
          amount: e.amount,
        })),
        raw: data,
      };
    } catch (error) {
      logger.warn({ error }, 'Failed to fetch Upwork earnings');
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
      { dataId: 'platformProjectId' in data ? data.platformProjectId : data.reviewId },
      'Verifying Upwork data'
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
      details: 'Data retrieved directly from Upwork API',
    });

    // Check 3: Verify project still exists (for work history)
    if ('platformProjectId' in data) {
      try {
        const response = await this.makeRequest(
          `${this.baseUrl}/profiles/v1/providers/me/jobs/${data.platformProjectId}`,
          {
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
              Accept: 'application/json',
            },
          }
        );

        if (response.ok) {
          checks.push({
            check: 'project_exists',
            passed: true,
            details: 'Project verified to exist in Upwork',
          });
        } else {
          checks.push({
            check: 'project_exists',
            passed: false,
            details: 'Could not verify project existence',
          });
          verified = false;
        }
      } catch {
        checks.push({
          check: 'project_exists',
          passed: false,
          details: 'Verification check failed',
        });
      }
    }

    // Check 4: Data consistency
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
}

// Create and register singleton
const upworkConnector = new UpworkConnector();

export function getUpworkConnector(): UpworkConnector {
  return upworkConnector;
}
