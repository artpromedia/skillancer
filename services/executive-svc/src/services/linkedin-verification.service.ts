/**
 * LinkedIn Verification Service
 *
 * Handles LinkedIn OAuth and profile verification:
 * - OAuth flow initiation and completion
 * - Profile data extraction and analysis
 * - Experience verification
 * - Periodic reverification
 */

import { prisma } from '@skillancer/database';
import type { ExecutiveProfile } from '@prisma/client';
import { getConfig } from '../config/index.js';

// Types
interface LinkedInTokens {
  access_token: string;
  expires_in: number;
  scope?: string;
}

interface LinkedInProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
  profilePicture?: {
    displayImage?: string;
  };
}

interface LinkedInPosition {
  title: string;
  company: string;
  startDate: { year: number; month?: number };
  endDate?: { year: number; month?: number };
  description?: string;
}

interface LinkedInAnalysis {
  score: number; // 0-100
  executivePositions: LinkedInPosition[];
  yearsAtExecutiveLevel: number;
  industries: string[];
  skills: string[];
  endorsementCount: number;
  connectionCount?: number;
  isConsistentWithApplication: boolean;
  inconsistencies: string[];
}

// LinkedIn OAuth scopes
const LINKEDIN_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social', // Optional: for posting
].join(' ');

/**
 * Initiate LinkedIn OAuth flow
 */
export async function initiateLinkedInVerification(
  executiveId: string
): Promise<{ authorizationUrl: string }> {
  const config = getConfig();

  if (!config.linkedinClientId || !config.linkedinClientSecret) {
    throw new Error('LinkedIn OAuth not configured');
  }

  // Generate state token for CSRF protection
  const state = Buffer.from(
    JSON.stringify({
      executiveId,
      timestamp: Date.now(),
    })
  ).toString('base64url');

  // Store state temporarily (in production, use Redis or similar)
  await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: {
      linkedinData: {
        pendingState: state,
        stateCreatedAt: new Date().toISOString(),
      },
    },
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.linkedinClientId,
    redirect_uri: config.linkedinRedirectUri,
    state,
    scope: LINKEDIN_SCOPES,
  });

  const authorizationUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

  return { authorizationUrl };
}

/**
 * Complete LinkedIn OAuth flow
 */
export async function completeLinkedInVerification(
  executiveId: string,
  authCode: string,
  state: string
): Promise<ExecutiveProfile> {
  const config = getConfig();

  // Verify state
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
    include: { user: true },
  });

  if (!profile) {
    throw new Error('Executive profile not found');
  }

  const storedData = profile.linkedinData as any;
  if (!storedData?.pendingState || storedData.pendingState !== state) {
    throw new Error('Invalid OAuth state');
  }

  // Check state expiry (10 minutes)
  const stateAge = Date.now() - new Date(storedData.stateCreatedAt).getTime();
  if (stateAge > 10 * 60 * 1000) {
    throw new Error('OAuth state expired');
  }

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(authCode);

  // Fetch LinkedIn profile
  const linkedinProfile = await fetchLinkedInProfile(tokens.access_token);

  // Fetch positions (if available with scope)
  const positions = await fetchLinkedInPositions(tokens.access_token);

  // Analyze profile
  const analysis = analyzeLinkedInProfile(linkedinProfile, positions, profile);

  // Calculate token expiry
  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  // Update profile with LinkedIn data
  const updated = await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: {
      linkedinVerified: true,
      linkedinData: {
        profile: linkedinProfile,
        positions,
        analysis,
        fetchedAt: new Date().toISOString(),
      } as any,
      linkedinAccessToken: tokens.access_token, // Should be encrypted in production
      linkedinTokenExpiry: tokenExpiry,
      linkedinLastVerified: new Date(),
    },
  });

  // Log vetting event
  await prisma.vettingEvent.create({
    data: {
      executiveId,
      eventType: 'STAGE_ADVANCED',
      actorType: 'system',
      description: `LinkedIn verified (score: ${analysis.score}/100)`,
      metadata: {
        profileId: linkedinProfile.id,
        score: analysis.score,
        yearsExecutive: analysis.yearsAtExecutiveLevel,
      },
    },
  });

  return updated;
}

/**
 * Exchange authorization code for access tokens
 */
async function exchangeCodeForTokens(code: string): Promise<LinkedInTokens> {
  const config = getConfig();

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.linkedinRedirectUri,
    client_id: config.linkedinClientId!,
    client_secret: config.linkedinClientSecret!,
  });

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn OAuth error: ${error}`);
  }

  return response.json();
}

/**
 * Fetch LinkedIn profile
 */
async function fetchLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  const response = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch LinkedIn profile');
  }

  const data = await response.json();

  return {
    id: data.sub,
    localizedFirstName: data.given_name,
    localizedLastName: data.family_name,
    profilePicture: data.picture ? { displayImage: data.picture } : undefined,
  };
}

/**
 * Fetch LinkedIn positions (experience)
 * Note: This requires additional LinkedIn API access (Marketing Developer Platform)
 */
async function fetchLinkedInPositions(accessToken: string): Promise<LinkedInPosition[]> {
  // The positions API is part of the Marketing Developer Platform
  // For basic verification, we rely on manual entry + name matching
  // This would be expanded with proper LinkedIn Partner API access

  // For now, return empty array - positions come from executive history
  return [];
}

/**
 * Analyze LinkedIn profile for verification
 */
function analyzeLinkedInProfile(
  linkedinProfile: LinkedInProfile,
  positions: LinkedInPosition[],
  executiveProfile: ExecutiveProfile & { user: any }
): LinkedInAnalysis {
  const inconsistencies: string[] = [];
  let score = 0;

  // Name matching (25 points)
  const linkedinName =
    `${linkedinProfile.localizedFirstName} ${linkedinProfile.localizedLastName}`.toLowerCase();
  const profileName =
    `${executiveProfile.user.firstName} ${executiveProfile.user.lastName}`.toLowerCase();

  if (linkedinName === profileName) {
    score += 25;
  } else if (linkedinName.includes(executiveProfile.user.firstName.toLowerCase())) {
    score += 15;
    inconsistencies.push('Name partially matches LinkedIn profile');
  } else {
    inconsistencies.push('Name does not match LinkedIn profile');
  }

  // Profile photo exists (10 points)
  if (linkedinProfile.profilePicture?.displayImage) {
    score += 10;
  }

  // Executive positions analysis
  const executiveTitles = positions.filter((p) =>
    /^(Chief|C[A-Z]O|VP|Vice President|Director|Head of|President)/i.test(p.title)
  );

  // Years at executive level (25 points)
  let totalExecutiveYears = 0;
  const currentYear = new Date().getFullYear();

  for (const pos of executiveTitles) {
    const startYear = pos.startDate.year;
    const endYear = pos.endDate?.year ?? currentYear;
    totalExecutiveYears += endYear - startYear;
  }

  if (totalExecutiveYears >= 10) {
    score += 25;
  } else if (totalExecutiveYears >= 5) {
    score += 20;
  } else if (totalExecutiveYears >= 3) {
    score += 15;
  } else {
    score += 5;
  }

  // Check claimed experience matches (20 points)
  if (Math.abs(totalExecutiveYears - executiveProfile.yearsExecutiveExp) <= 2) {
    score += 20;
  } else {
    score += 10;
    inconsistencies.push(
      `Claimed ${executiveProfile.yearsExecutiveExp} years executive experience, LinkedIn shows ~${totalExecutiveYears}`
    );
  }

  // If no positions available from API, give partial credit for having LinkedIn URL (20 points)
  if (positions.length === 0) {
    score += 20; // Partial credit - manual verification needed
  }

  // Extract industries from positions
  const industries = [
    ...new Set(positions.map((p) => extractIndustry(p.company)).filter((i): i is string => !!i)),
  ];

  return {
    score: Math.min(score, 100),
    executivePositions: executiveTitles,
    yearsAtExecutiveLevel: totalExecutiveYears,
    industries,
    skills: [], // Would come from LinkedIn skills API
    endorsementCount: 0, // Would come from LinkedIn endorsements API
    isConsistentWithApplication: inconsistencies.length === 0,
    inconsistencies,
  };
}

/**
 * Extract industry from company name (simplified)
 */
function extractIndustry(companyName: string): string | null {
  // This would ideally use a company database or API
  // For now, return null - industries come from executive profile
  return null;
}

/**
 * Schedule LinkedIn reverification
 */
export async function scheduleReverification(executiveId: string): Promise<void> {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
  });

  if (!profile || !profile.linkedinVerified) {
    return;
  }

  // Check if reverification is due (6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  if (profile.linkedinLastVerified && profile.linkedinLastVerified < sixMonthsAgo) {
    // Check if token is still valid
    if (profile.linkedinTokenExpiry && profile.linkedinTokenExpiry > new Date()) {
      // Try to refresh profile data
      try {
        await refreshLinkedInData(executiveId);
      } catch {
        // Token may be expired or revoked
        await handleLinkedInTokenExpired(executiveId);
      }
    } else {
      await handleLinkedInTokenExpired(executiveId);
    }
  }
}

/**
 * Refresh LinkedIn data using stored token
 */
async function refreshLinkedInData(executiveId: string): Promise<void> {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
  });

  if (!profile?.linkedinAccessToken) {
    throw new Error('No LinkedIn token available');
  }

  const linkedinProfile = await fetchLinkedInProfile(profile.linkedinAccessToken);
  const positions = await fetchLinkedInPositions(profile.linkedinAccessToken);

  const analysis = analyzeLinkedInProfile(
    linkedinProfile,
    positions,
    profile as ExecutiveProfile & { user: any }
  );

  await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: {
      linkedinData: {
        profile: linkedinProfile,
        positions,
        analysis,
        fetchedAt: new Date().toISOString(),
      } as any,
      linkedinLastVerified: new Date(),
    },
  });
}

/**
 * Handle expired LinkedIn token
 */
async function handleLinkedInTokenExpired(executiveId: string): Promise<void> {
  await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: {
      linkedinAccessToken: null,
      linkedinTokenExpiry: null,
    },
  });

  // Log event for admin attention
  await prisma.vettingEvent.create({
    data: {
      executiveId,
      eventType: 'NOTE_ADDED',
      actorType: 'system',
      description: 'LinkedIn verification expired - reconnection required',
    },
  });

  // TODO: Send email to executive requesting LinkedIn reconnection
}

/**
 * Check if LinkedIn profile still exists/accessible
 */
export async function checkLinkedInProfileStatus(
  executiveId: string
): Promise<{ exists: boolean; accessible: boolean }> {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
  });

  if (!profile?.linkedinAccessToken) {
    return { exists: true, accessible: false };
  }

  try {
    await fetchLinkedInProfile(profile.linkedinAccessToken);
    return { exists: true, accessible: true };
  } catch {
    return { exists: true, accessible: false };
  }
}
