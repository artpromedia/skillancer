/**
 * @module @skillancer/market-svc/services/smartmatch/scoring-functions
 * Individual scoring functions for SmartMatch algorithm
 */

import type {
  ScoreFactor,
  FreelancerWorkPattern,
  FreelancerSuccessMetrics,
  RateIntelligence,
  RelatedSkillMatch,
  ClearanceLevel,
  ExperienceLevel,
  VerificationLevel,
  DurationType,
} from '../../types/smartmatch.types.js';

// =============================================================================
// COMPLIANCE SCORING
// =============================================================================

export interface ComplianceProfile {
  complianceTypes: string[];
  clearanceLevels: ClearanceLevel[];
  compliances: Array<{ type: string; isExpiringSoon: boolean }>;
}

export interface ComplianceScoreResult {
  score: number;
  factors: ScoreFactor[];
}

const CLEARANCE_HIERARCHY: ClearanceLevel[] = [
  'PUBLIC_TRUST',
  'CONFIDENTIAL',
  'SECRET',
  'TOP_SECRET',
  'TOP_SECRET_SCI',
];

export function hasSufficientClearance(
  freelancerLevels: ClearanceLevel[],
  required: ClearanceLevel
): boolean {
  const requiredIndex = CLEARANCE_HIERARCHY.indexOf(required);
  return freelancerLevels.some((level) => CLEARANCE_HIERARCHY.indexOf(level) >= requiredIndex);
}

export function scoreCompliance(
  profile: ComplianceProfile,
  required: string[],
  preferred: string[],
  requiredClearance?: ClearanceLevel
): ComplianceScoreResult {
  const factors: ScoreFactor[] = [];
  let score = 100;

  // Check required compliance
  for (const req of required) {
    const hasCompliance = profile.complianceTypes.includes(req);

    if (hasCompliance) {
      factors.push({
        name: `${req} Compliance`,
        value: 'Verified',
        impact: 'POSITIVE',
        description: `Has verified ${req} compliance`,
      });
    } else {
      score = 0; // Missing required = automatic 0
      factors.push({
        name: `${req} Compliance`,
        value: 'Missing',
        impact: 'NEGATIVE',
        description: `Missing required ${req} compliance`,
      });
    }
  }

  // Check required clearance
  if (requiredClearance) {
    const hasClearance = hasSufficientClearance(profile.clearanceLevels, requiredClearance);

    if (hasClearance) {
      factors.push({
        name: 'Security Clearance',
        value: requiredClearance,
        impact: 'POSITIVE',
        description: `Has ${requiredClearance} or higher clearance`,
      });
    } else {
      score = 0;
      factors.push({
        name: 'Security Clearance',
        value: 'Insufficient',
        impact: 'NEGATIVE',
        description: `Does not have required ${requiredClearance} clearance`,
      });
    }
  }

  // Bonus for preferred compliance
  if (score > 0 && preferred.length > 0) {
    const metPreferred = preferred.filter((p) => profile.complianceTypes.includes(p));

    if (metPreferred.length > 0) {
      const bonus = (metPreferred.length / preferred.length) * 15;
      score = Math.min(100, score + bonus);

      factors.push({
        name: 'Preferred Compliance',
        value: `${metPreferred.length}/${preferred.length}`,
        impact: 'POSITIVE',
        description: `Has ${metPreferred.length} of ${preferred.length} preferred compliance certifications`,
      });
    }
  }

  // Check for expiring compliance
  const expiring = profile.compliances.filter((c) => c.isExpiringSoon);
  if (expiring.length > 0) {
    score -= expiring.length * 5;
    factors.push({
      name: 'Expiring Compliance',
      value: expiring.length,
      impact: 'NEGATIVE',
      description: `${expiring.length} compliance certification(s) expiring soon`,
    });
  }

  return { score: Math.max(0, score), factors };
}

// =============================================================================
// SKILLS SCORING
// =============================================================================

export interface SkillEndorsementInfo {
  skill: string;
  count: number;
}

export interface SkillsScoreResult {
  score: number;
  factors: ScoreFactor[];
}

export function scoreSkills(
  freelancerSkills: string[],
  requiredSkills: string[],
  endorsementCounts: SkillEndorsementInfo[],
  relatedSkillsMap: Map<string, RelatedSkillMatch | null>
): SkillsScoreResult {
  const factors: ScoreFactor[] = [];
  let score = 0;

  if (requiredSkills.length === 0) {
    return { score: 100, factors: [] };
  }

  // Normalize skills for comparison
  const normalizedFreelancerSkills = freelancerSkills.map((s) => s.toLowerCase());

  let exactMatches = 0;
  let relatedMatches = 0;
  let endorsedMatches = 0;

  for (const required of requiredSkills) {
    const normalizedRequired = required.toLowerCase();

    // Check exact match
    if (normalizedFreelancerSkills.includes(normalizedRequired)) {
      exactMatches++;

      // Check if skill is endorsed
      const endorsement = endorsementCounts.find(
        (e) => e.skill.toLowerCase() === normalizedRequired
      );

      if (endorsement && endorsement.count > 0) {
        endorsedMatches++;
        factors.push({
          name: `${required} (Endorsed)`,
          value: `${endorsement.count} endorsements`,
          impact: 'POSITIVE',
          description: `Skill endorsed by ${endorsement.count} client(s)`,
        });
      } else {
        factors.push({
          name: required,
          value: 'Exact match',
          impact: 'POSITIVE',
          description: 'Has this exact skill',
        });
      }
    } else {
      // Check related skills
      const relatedSkill = relatedSkillsMap.get(normalizedRequired);

      if (relatedSkill) {
        relatedMatches++;
        factors.push({
          name: required,
          value: `Related: ${relatedSkill.skill}`,
          impact: 'NEUTRAL',
          description: `Has related skill: ${relatedSkill.skill} (${Math.round(relatedSkill.strength * 100)}% relevance)`,
        });
      } else {
        factors.push({
          name: required,
          value: 'Missing',
          impact: 'NEGATIVE',
          description: 'Does not have this skill or related skills',
        });
      }
    }
  }

  // Calculate score
  const totalRequired = requiredSkills.length;
  const exactMatchScore = (exactMatches / totalRequired) * 70;
  const relatedMatchScore = (relatedMatches / totalRequired) * 20;
  const endorsementBonus = (endorsedMatches / totalRequired) * 10;

  score = exactMatchScore + relatedMatchScore + endorsementBonus;

  // Depth bonus: having more skills than required
  const extraSkills = freelancerSkills.length - requiredSkills.length;
  if (extraSkills > 0 && score > 50) {
    const depthBonus = Math.min(10, extraSkills * 2);
    score = Math.min(100, score + depthBonus);

    factors.push({
      name: 'Skill Depth',
      value: `+${extraSkills} additional skills`,
      impact: 'POSITIVE',
      description: 'Has additional relevant skills',
    });
  }

  return { score: Math.round(score), factors };
}

// =============================================================================
// EXPERIENCE SCORING
// =============================================================================

export interface ExperienceScoreResult {
  score: number;
  factors: ScoreFactor[];
}

function meetsExperienceLevel(years: number, required: ExperienceLevel): boolean {
  switch (required) {
    case 'ENTRY':
      return years >= 0;
    case 'INTERMEDIATE':
      return years >= 2;
    case 'EXPERT':
      return years >= 5;
    case 'ANY':
      return true;
    default:
      return true;
  }
}

export function scoreExperience(
  yearsOfExperience: number | null,
  totalProjects: number,
  requiredLevel?: ExperienceLevel
): ExperienceScoreResult {
  const factors: ScoreFactor[] = [];
  let score = 50; // Base score

  // Years of experience
  if (yearsOfExperience !== null) {
    factors.push({
      name: 'Years of Experience',
      value: yearsOfExperience,
      impact: yearsOfExperience >= 3 ? 'POSITIVE' : 'NEUTRAL',
      description: `${yearsOfExperience} years of professional experience`,
    });

    if (requiredLevel) {
      const levelMet = meetsExperienceLevel(yearsOfExperience, requiredLevel);
      if (levelMet) {
        score += 30;
      } else {
        score -= 20;
        factors.push({
          name: 'Experience Level',
          value: `Below ${requiredLevel}`,
          impact: 'NEGATIVE',
          description: `Experience level below required ${requiredLevel}`,
        });
      }
    } else {
      // No specific requirement, score based on years
      score += Math.min(30, yearsOfExperience * 5);
    }
  }

  // Platform experience (total projects)
  if (totalProjects > 0) {
    const projectBonus = Math.min(20, totalProjects * 2);
    score += projectBonus;

    factors.push({
      name: 'Platform Projects',
      value: totalProjects,
      impact: totalProjects >= 5 ? 'POSITIVE' : 'NEUTRAL',
      description: `Completed ${totalProjects} projects on Skillancer`,
    });
  }

  return { score: Math.min(100, Math.max(0, score)), factors };
}

// =============================================================================
// TRUST SCORING
// =============================================================================

export interface TrustScoreResult {
  score: number;
  factors: ScoreFactor[];
}

const VERIFICATION_BONUS: Record<VerificationLevel, number> = {
  NONE: 0,
  EMAIL: 5,
  BASIC: 10,
  ENHANCED: 15,
  PREMIUM: 20,
};

export function scoreTrust(
  trustScore: number,
  verificationLevel: VerificationLevel,
  minRequired?: number
): TrustScoreResult {
  const factors: ScoreFactor[] = [];

  // Direct trust score mapping
  let score = trustScore;

  factors.push({
    name: 'Trust Score',
    value: trustScore,
    impact: trustScore >= 70 ? 'POSITIVE' : trustScore >= 50 ? 'NEUTRAL' : 'NEGATIVE',
    description: `Platform trust score of ${trustScore}/100`,
  });

  // Verification level bonus
  score += VERIFICATION_BONUS[verificationLevel];
  factors.push({
    name: 'Verification Level',
    value: verificationLevel,
    impact: verificationLevel !== 'NONE' ? 'POSITIVE' : 'NEUTRAL',
    description: `${verificationLevel} identity verification`,
  });

  // Check minimum requirement
  if (minRequired && trustScore < minRequired) {
    score = Math.max(0, score - 30);
    factors.push({
      name: 'Below Minimum',
      value: `${trustScore} < ${minRequired}`,
      impact: 'NEGATIVE',
      description: `Trust score below job requirement of ${minRequired}`,
    });
  }

  return { score: Math.min(100, score), factors };
}

// =============================================================================
// RATE SCORING
// =============================================================================

export interface RateScoreResult {
  score: number;
  factors: ScoreFactor[];
}

function calculateRatePercentile(rate: number, marketRate: RateIntelligence): number {
  if (rate <= marketRate.minHourlyRate) return 1;
  if (rate >= marketRate.maxHourlyRate) return 99;

  if (rate <= marketRate.percentile25) {
    return (
      Math.round(
        ((rate - marketRate.minHourlyRate) / (marketRate.percentile25 - marketRate.minHourlyRate)) *
          24
      ) + 1
    );
  }

  if (rate <= marketRate.medianHourlyRate) {
    return (
      Math.round(
        ((rate - marketRate.percentile25) /
          (marketRate.medianHourlyRate - marketRate.percentile25)) *
          25
      ) + 25
    );
  }

  if (rate <= marketRate.percentile75) {
    return (
      Math.round(
        ((rate - marketRate.medianHourlyRate) /
          (marketRate.percentile75 - marketRate.medianHourlyRate)) *
          25
      ) + 50
    );
  }

  return (
    Math.round(
      ((rate - marketRate.percentile75) / (marketRate.maxHourlyRate - marketRate.percentile75)) * 24
    ) + 75
  );
}

export function scoreRate(
  freelancerRate: number | null,
  budgetMin?: number,
  budgetMax?: number,
  marketRate?: RateIntelligence | null,
  primarySkill?: string
): RateScoreResult {
  const factors: ScoreFactor[] = [];
  let score = 70; // Default score for unknown rate

  if (freelancerRate === null) {
    factors.push({
      name: 'Rate',
      value: 'Not specified',
      impact: 'NEUTRAL',
      description: 'Freelancer has not specified their rate',
    });
    return { score, factors };
  }

  factors.push({
    name: 'Hourly Rate',
    value: `$${freelancerRate}/hr`,
    impact: 'NEUTRAL',
    description: "Freelancer's hourly rate",
  });

  // Compare to budget
  if (budgetMin !== undefined && budgetMax !== undefined) {
    if (freelancerRate >= budgetMin && freelancerRate <= budgetMax) {
      score = 100;
      factors.push({
        name: 'Budget Fit',
        value: 'Within range',
        impact: 'POSITIVE',
        description: 'Rate is within project budget range',
      });
    } else if (freelancerRate < budgetMin) {
      score = 85; // Under budget is okay
      factors.push({
        name: 'Budget Fit',
        value: 'Below range',
        impact: 'POSITIVE',
        description: 'Rate is below project budget (good value)',
      });
    } else {
      // Over budget
      const overagePercent = ((freelancerRate - budgetMax) / budgetMax) * 100;
      score = Math.max(0, 80 - overagePercent);
      factors.push({
        name: 'Budget Fit',
        value: `${Math.round(overagePercent)}% over`,
        impact: 'NEGATIVE',
        description: `Rate is ${Math.round(overagePercent)}% above project budget`,
      });
    }
  }

  // Compare to market rate
  if (marketRate && primarySkill) {
    const percentile = calculateRatePercentile(freelancerRate, marketRate);

    factors.push({
      name: 'Market Position',
      value: `${percentile}th percentile`,
      impact: percentile <= 75 ? 'POSITIVE' : 'NEUTRAL',
      description: `Rate is at ${percentile}th percentile for ${primarySkill}`,
    });

    // Adjust score based on market position
    if (percentile > 90) {
      score = Math.max(score - 15, 0);
    } else if (percentile < 25) {
      score = Math.min(score + 5, 100);
    }
  }

  return { score: Math.round(score), factors };
}

// =============================================================================
// AVAILABILITY SCORING
// =============================================================================

export interface AvailabilityScoreResult {
  score: number;
  factors: ScoreFactor[];
}

const TIMEZONE_OFFSETS: Record<string, number> = {
  'America/New_York': -5,
  'America/Los_Angeles': -8,
  'Europe/London': 0,
  'Europe/Paris': 1,
  'Asia/Tokyo': 9,
  'Asia/Singapore': 8,
  'Australia/Sydney': 11,
  UTC: 0,
};

function getTimezoneOffset(tz: string): number {
  return TIMEZONE_OFFSETS[tz] || 0;
}

function calculateTimezoneOverlap(
  tz1: string,
  tz2: string,
  workStart?: string | null,
  workEnd?: string | null
): number {
  const defaultStart = 9;
  const defaultEnd = 17;

  const start1 = workStart ? parseInt(workStart.split(':')[0], 10) : defaultStart;
  const end1 = workEnd ? parseInt(workEnd.split(':')[0], 10) : defaultEnd;

  // Get timezone offsets
  const offset1 = getTimezoneOffset(tz1);
  const offset2 = getTimezoneOffset(tz2);
  const offsetDiff = Math.abs(offset1 - offset2);

  // Calculate overlap
  const adjustedStart1 = start1 + offsetDiff;
  const adjustedEnd1 = end1 + offsetDiff;

  const overlapStart = Math.max(defaultStart, adjustedStart1);
  const overlapEnd = Math.min(defaultEnd, adjustedEnd1);

  return Math.max(0, overlapEnd - overlapStart);
}

export function scoreAvailability(
  workPattern: FreelancerWorkPattern | null,
  startDate?: Date,
  hoursPerWeek?: number,
  clientTimezone?: string,
  _durationType?: DurationType
): AvailabilityScoreResult {
  const factors: ScoreFactor[] = [];
  let score = 60; // Base score

  if (!workPattern) {
    factors.push({
      name: 'Availability',
      value: 'Unknown',
      impact: 'NEUTRAL',
      description: 'Work pattern not specified',
    });
    return { score, factors };
  }

  // Check capacity
  if (workPattern.currentActiveProjects >= workPattern.maxConcurrentProjects) {
    score = 20;
    factors.push({
      name: 'Capacity',
      value: 'At maximum',
      impact: 'NEGATIVE',
      description: `Currently handling ${workPattern.currentActiveProjects} projects (max: ${workPattern.maxConcurrentProjects})`,
    });
  } else {
    const availableSlots = workPattern.maxConcurrentProjects - workPattern.currentActiveProjects;
    score += 20;
    factors.push({
      name: 'Capacity',
      value: `${availableSlots} slots available`,
      impact: 'POSITIVE',
      description: `Can take on ${availableSlots} more project(s)`,
    });
  }

  // Check hours per week
  if (hoursPerWeek && workPattern.weeklyHoursAvailable) {
    if (workPattern.weeklyHoursAvailable >= hoursPerWeek) {
      score += 15;
      factors.push({
        name: 'Weekly Hours',
        value: `${workPattern.weeklyHoursAvailable}hrs available`,
        impact: 'POSITIVE',
        description: `Has ${workPattern.weeklyHoursAvailable} hours/week available (${hoursPerWeek} needed)`,
      });
    } else {
      score -= 15;
      factors.push({
        name: 'Weekly Hours',
        value: `${workPattern.weeklyHoursAvailable}hrs available`,
        impact: 'NEGATIVE',
        description: `Only ${workPattern.weeklyHoursAvailable} hours/week available (${hoursPerWeek} needed)`,
      });
    }
  }

  // Check timezone overlap
  if (clientTimezone && workPattern.timezone) {
    const overlapHours = calculateTimezoneOverlap(
      workPattern.timezone,
      clientTimezone,
      workPattern.workingHoursStart,
      workPattern.workingHoursEnd
    );

    if (overlapHours >= 4) {
      score += 10;
      factors.push({
        name: 'Timezone Overlap',
        value: `${overlapHours} hours`,
        impact: 'POSITIVE',
        description: `${overlapHours} hours of working time overlap`,
      });
    } else if (overlapHours > 0) {
      factors.push({
        name: 'Timezone Overlap',
        value: `${overlapHours} hours`,
        impact: 'NEUTRAL',
        description: `Limited timezone overlap (${overlapHours} hours)`,
      });
    } else {
      score -= 10;
      factors.push({
        name: 'Timezone Overlap',
        value: 'No overlap',
        impact: 'NEGATIVE',
        description: 'No working hours overlap with client timezone',
      });
    }
  }

  // Check last activity
  if (workPattern.lastActiveAt) {
    const daysSinceActive = Math.floor(
      (Date.now() - new Date(workPattern.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceActive <= 1) {
      score += 5;
      factors.push({
        name: 'Recent Activity',
        value: 'Active today',
        impact: 'POSITIVE',
        description: 'Active on platform today',
      });
    } else if (daysSinceActive > 14) {
      score -= 10;
      factors.push({
        name: 'Recent Activity',
        value: `${daysSinceActive} days ago`,
        impact: 'NEGATIVE',
        description: `Last active ${daysSinceActive} days ago`,
      });
    }
  }

  return { score: Math.min(100, Math.max(0, score)), factors };
}

// =============================================================================
// SUCCESS HISTORY SCORING
// =============================================================================

export interface SuccessHistoryScoreResult {
  score: number;
  factors: ScoreFactor[];
}

export function scoreSuccessHistory(metrics: FreelancerSuccessMetrics): SuccessHistoryScoreResult {
  const factors: ScoreFactor[] = [];
  let score = 50; // Base score for new freelancers

  // Completion rate
  if (metrics.totalProjects > 0) {
    const completionRate = (metrics.completedProjects / metrics.totalProjects) * 100;

    if (completionRate >= 95) {
      score += 30;
      factors.push({
        name: 'Completion Rate',
        value: `${Math.round(completionRate)}%`,
        impact: 'POSITIVE',
        description: `Excellent completion rate of ${Math.round(completionRate)}%`,
      });
    } else if (completionRate >= 80) {
      score += 15;
      factors.push({
        name: 'Completion Rate',
        value: `${Math.round(completionRate)}%`,
        impact: 'NEUTRAL',
        description: `Good completion rate of ${Math.round(completionRate)}%`,
      });
    } else {
      score -= 20;
      factors.push({
        name: 'Completion Rate',
        value: `${Math.round(completionRate)}%`,
        impact: 'NEGATIVE',
        description: `Below average completion rate of ${Math.round(completionRate)}%`,
      });
    }
  }

  // Client satisfaction
  if (metrics.avgRating > 0) {
    if (metrics.avgRating >= 4.8) {
      score += 25;
      factors.push({
        name: 'Client Rating',
        value: metrics.avgRating.toFixed(1),
        impact: 'POSITIVE',
        description: `Exceptional ${metrics.avgRating.toFixed(1)}/5 rating from ${metrics.reviewCount} reviews`,
      });
    } else if (metrics.avgRating >= 4.0) {
      score += 15;
      factors.push({
        name: 'Client Rating',
        value: metrics.avgRating.toFixed(1),
        impact: 'POSITIVE',
        description: `Strong ${metrics.avgRating.toFixed(1)}/5 rating from ${metrics.reviewCount} reviews`,
      });
    } else {
      score -= 10;
      factors.push({
        name: 'Client Rating',
        value: metrics.avgRating.toFixed(1),
        impact: 'NEGATIVE',
        description: `${metrics.avgRating.toFixed(1)}/5 rating from ${metrics.reviewCount} reviews`,
      });
    }
  }

  // Repeat client rate
  if (metrics.repeatClientRate > 0) {
    score += Math.min(15, metrics.repeatClientRate * 20);
    factors.push({
      name: 'Repeat Clients',
      value: `${Math.round(metrics.repeatClientRate * 100)}%`,
      impact: 'POSITIVE',
      description: `${Math.round(metrics.repeatClientRate * 100)}% of clients return for more work`,
    });
  }

  // On-time delivery
  if (metrics.onTimeDeliveryRate > 0) {
    if (metrics.onTimeDeliveryRate >= 0.95) {
      score += 10;
      factors.push({
        name: 'On-Time Delivery',
        value: `${Math.round(metrics.onTimeDeliveryRate * 100)}%`,
        impact: 'POSITIVE',
        description: `Delivers on time ${Math.round(metrics.onTimeDeliveryRate * 100)}% of the time`,
      });
    } else if (metrics.onTimeDeliveryRate < 0.7) {
      score -= 15;
      factors.push({
        name: 'On-Time Delivery',
        value: `${Math.round(metrics.onTimeDeliveryRate * 100)}%`,
        impact: 'NEGATIVE',
        description: `Below average on-time delivery rate`,
      });
    }
  }

  return { score: Math.min(100, Math.max(0, score)), factors };
}

// =============================================================================
// RESPONSIVENESS SCORING
// =============================================================================

export interface ResponsivenessScoreResult {
  score: number;
  factors: ScoreFactor[];
}

export function scoreResponsiveness(
  workPattern: FreelancerWorkPattern | null
): ResponsivenessScoreResult {
  const factors: ScoreFactor[] = [];
  let score = 50;

  if (!workPattern) {
    return { score, factors: [] };
  }

  // Average response time
  if (workPattern.avgResponseTimeMinutes !== null) {
    const responseHours = workPattern.avgResponseTimeMinutes / 60;

    if (responseHours <= 1) {
      score = 100;
      factors.push({
        name: 'Response Time',
        value: `${workPattern.avgResponseTimeMinutes} minutes`,
        impact: 'POSITIVE',
        description: 'Typically responds within an hour',
      });
    } else if (responseHours <= 4) {
      score = 85;
      factors.push({
        name: 'Response Time',
        value: `${Math.round(responseHours)} hours`,
        impact: 'POSITIVE',
        description: 'Typically responds within a few hours',
      });
    } else if (responseHours <= 24) {
      score = 65;
      factors.push({
        name: 'Response Time',
        value: `${Math.round(responseHours)} hours`,
        impact: 'NEUTRAL',
        description: 'Typically responds within a day',
      });
    } else {
      score = 40;
      factors.push({
        name: 'Response Time',
        value: `${Math.round(responseHours / 24)} days`,
        impact: 'NEGATIVE',
        description: 'Slow response time',
      });
    }
  }

  return { score, factors };
}
