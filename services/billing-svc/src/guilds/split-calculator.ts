/**
 * Split Calculator Service
 * Sprint M8: Guild & Agency Accounts
 *
 * Utility service for calculating revenue splits
 */

import { logger } from '../lib/logger.js';

// =============================================================================
// TYPES
// =============================================================================

export interface SplitMember {
  memberId: string;
  role: string;
  allocation: number; // Percentage of project work
  hourlyRate?: number;
  hoursWorked?: number;
}

export interface SplitConfiguration {
  method: 'EQUAL' | 'BY_ALLOCATION' | 'BY_HOURS' | 'BY_ROLE' | 'CUSTOM';
  platformFeePercent: number;
  guildFeePercent: number;
  minimumPayout?: number;
  roleWeights?: Record<string, number>;
  customSplits?: Record<string, number>;
}

export interface CalculatedSplit {
  memberId: string;
  role: string;
  percentage: number;
  grossAmount: number;
  netAmount: number;
  breakdown: {
    baseAmount: number;
    roleBonus: number;
    hourlyBonus: number;
    adjustments: number;
  };
}

export interface SplitSummary {
  totalAmount: number;
  platformFee: number;
  guildFee: number;
  distributableAmount: number;
  memberSplits: CalculatedSplit[];
  validationErrors: string[];
}

// =============================================================================
// DEFAULT ROLE WEIGHTS
// =============================================================================

const DEFAULT_ROLE_WEIGHTS: Record<string, number> = {
  Lead: 1.5,
  Senior: 1.3,
  Developer: 1.0,
  Designer: 1.0,
  Junior: 0.8,
  Support: 0.7,
};

// =============================================================================
// SERVICE
// =============================================================================

export class SplitCalculatorService {
  private log = logger.child({ service: 'SplitCalculatorService' });

  /**
   * Calculate splits based on configuration
   */
  calculateSplits(
    totalAmount: number,
    members: SplitMember[],
    config: SplitConfiguration
  ): SplitSummary {
    const validationErrors: string[] = [];

    // Validate inputs
    if (totalAmount <= 0) {
      validationErrors.push('Total amount must be positive');
    }
    if (members.length === 0) {
      validationErrors.push('At least one member required');
    }

    // Calculate fees
    const platformFee = totalAmount * (config.platformFeePercent / 100);
    const guildFee = totalAmount * (config.guildFeePercent / 100);
    const distributableAmount = totalAmount - platformFee - guildFee;

    if (distributableAmount <= 0) {
      validationErrors.push('Fees exceed total amount');
    }

    // Calculate splits based on method
    let memberSplits: CalculatedSplit[];

    switch (config.method) {
      case 'EQUAL':
        memberSplits = this.calculateEqualSplits(members, distributableAmount);
        break;
      case 'BY_ALLOCATION':
        memberSplits = this.calculateAllocationSplits(members, distributableAmount);
        break;
      case 'BY_HOURS':
        memberSplits = this.calculateHoursSplits(members, distributableAmount);
        break;
      case 'BY_ROLE':
        memberSplits = this.calculateRoleSplits(
          members,
          distributableAmount,
          config.roleWeights ?? DEFAULT_ROLE_WEIGHTS
        );
        break;
      case 'CUSTOM':
        memberSplits = this.calculateCustomSplits(
          members,
          distributableAmount,
          config.customSplits ?? {}
        );
        break;
      default:
        memberSplits = this.calculateAllocationSplits(members, distributableAmount);
    }

    // Apply minimum payout
    if (config.minimumPayout) {
      for (const split of memberSplits) {
        if (split.netAmount < config.minimumPayout && split.netAmount > 0) {
          validationErrors.push(
            `${split.memberId} payout (${split.netAmount}) below minimum (${config.minimumPayout})`
          );
        }
      }
    }

    // Validate total percentages
    const totalPercentage = memberSplits.reduce((sum, s) => sum + s.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      validationErrors.push(`Percentages total ${totalPercentage}%, expected 100%`);
    }

    return {
      totalAmount,
      platformFee,
      guildFee,
      distributableAmount,
      memberSplits,
      validationErrors,
    };
  }

  /**
   * Equal splits
   */
  private calculateEqualSplits(
    members: SplitMember[],
    distributableAmount: number
  ): CalculatedSplit[] {
    const percentage = 100 / members.length;
    const amount = distributableAmount / members.length;

    return members.map((m) => ({
      memberId: m.memberId,
      role: m.role,
      percentage: Math.round(percentage * 100) / 100,
      grossAmount: Math.round(amount * 100) / 100,
      netAmount: Math.round(amount * 100) / 100,
      breakdown: {
        baseAmount: Math.round(amount * 100) / 100,
        roleBonus: 0,
        hourlyBonus: 0,
        adjustments: 0,
      },
    }));
  }

  /**
   * Allocation-based splits
   */
  private calculateAllocationSplits(
    members: SplitMember[],
    distributableAmount: number
  ): CalculatedSplit[] {
    const totalAllocation = members.reduce((sum, m) => sum + m.allocation, 0);

    return members.map((m) => {
      const percentage = totalAllocation > 0 ? (m.allocation / totalAllocation) * 100 : 0;
      const amount = distributableAmount * (percentage / 100);

      return {
        memberId: m.memberId,
        role: m.role,
        percentage: Math.round(percentage * 100) / 100,
        grossAmount: Math.round(amount * 100) / 100,
        netAmount: Math.round(amount * 100) / 100,
        breakdown: {
          baseAmount: Math.round(amount * 100) / 100,
          roleBonus: 0,
          hourlyBonus: 0,
          adjustments: 0,
        },
      };
    });
  }

  /**
   * Hours-based splits
   */
  private calculateHoursSplits(
    members: SplitMember[],
    distributableAmount: number
  ): CalculatedSplit[] {
    // Calculate weighted hours (hours * hourly rate)
    let totalWeightedHours = 0;
    const memberWeights = members.map((m) => {
      const hours = m.hoursWorked ?? 0;
      const rate = m.hourlyRate ?? 50; // Default rate
      const weight = hours * rate;
      totalWeightedHours += weight;
      return { member: m, weight, hours };
    });

    return memberWeights.map(({ member, weight, hours }) => {
      const percentage = totalWeightedHours > 0 ? (weight / totalWeightedHours) * 100 : 0;
      const amount = distributableAmount * (percentage / 100);
      const hourlyBonus = hours * (member.hourlyRate ?? 0) * 0.1; // 10% hourly bonus

      return {
        memberId: member.memberId,
        role: member.role,
        percentage: Math.round(percentage * 100) / 100,
        grossAmount: Math.round(amount * 100) / 100,
        netAmount: Math.round(amount * 100) / 100,
        breakdown: {
          baseAmount: Math.round((amount - hourlyBonus) * 100) / 100,
          roleBonus: 0,
          hourlyBonus: Math.round(hourlyBonus * 100) / 100,
          adjustments: 0,
        },
      };
    });
  }

  /**
   * Role-weighted splits
   */
  private calculateRoleSplits(
    members: SplitMember[],
    distributableAmount: number,
    roleWeights: Record<string, number>
  ): CalculatedSplit[] {
    // Calculate weighted allocations
    let totalWeight = 0;
    const memberWeights = members.map((m) => {
      const roleWeight = roleWeights[m.role] ?? 1.0;
      const weight = m.allocation * roleWeight;
      totalWeight += weight;
      return { member: m, weight, roleWeight };
    });

    return memberWeights.map(({ member, weight, roleWeight }) => {
      const percentage = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
      const amount = distributableAmount * (percentage / 100);

      // Calculate role bonus portion
      const basePercentage =
        (member.allocation / members.reduce((s, m) => s + m.allocation, 0)) * 100;
      const roleBonus = amount * (1 - basePercentage / percentage);

      return {
        memberId: member.memberId,
        role: member.role,
        percentage: Math.round(percentage * 100) / 100,
        grossAmount: Math.round(amount * 100) / 100,
        netAmount: Math.round(amount * 100) / 100,
        breakdown: {
          baseAmount: Math.round((amount - roleBonus) * 100) / 100,
          roleBonus: Math.round(roleBonus * 100) / 100,
          hourlyBonus: 0,
          adjustments: 0,
        },
      };
    });
  }

  /**
   * Custom splits
   */
  private calculateCustomSplits(
    members: SplitMember[],
    distributableAmount: number,
    customSplits: Record<string, number>
  ): CalculatedSplit[] {
    return members.map((m) => {
      const percentage = customSplits[m.memberId] ?? 0;
      const amount = distributableAmount * (percentage / 100);

      return {
        memberId: m.memberId,
        role: m.role,
        percentage,
        grossAmount: Math.round(amount * 100) / 100,
        netAmount: Math.round(amount * 100) / 100,
        breakdown: {
          baseAmount: Math.round(amount * 100) / 100,
          roleBonus: 0,
          hourlyBonus: 0,
          adjustments: 0,
        },
      };
    });
  }

  /**
   * Preview split before creation
   */
  previewSplit(
    totalAmount: number,
    members: SplitMember[],
    config: SplitConfiguration
  ): SplitSummary {
    return this.calculateSplits(totalAmount, members, config);
  }

  /**
   * Suggest optimal split configuration
   */
  suggestSplitMethod(members: SplitMember[]): {
    recommendedMethod: SplitConfiguration['method'];
    reason: string;
  } {
    // If all same allocation, suggest equal
    const allocations = members.map((m) => m.allocation);
    const allSameAllocation = allocations.every((a) => a === allocations[0]);

    if (allSameAllocation) {
      return {
        recommendedMethod: 'EQUAL',
        reason: 'All members have equal allocation',
      };
    }

    // If hours tracked, suggest by hours
    const hasHours = members.some((m) => m.hoursWorked && m.hoursWorked > 0);
    if (hasHours) {
      return {
        recommendedMethod: 'BY_HOURS',
        reason: 'Hours tracked - fair distribution by effort',
      };
    }

    // If varied roles, suggest by role
    const uniqueRoles = new Set(members.map((m) => m.role));
    if (uniqueRoles.size > 1) {
      return {
        recommendedMethod: 'BY_ROLE',
        reason: 'Mixed team roles - weight by seniority',
      };
    }

    // Default to allocation
    return {
      recommendedMethod: 'BY_ALLOCATION',
      reason: 'Varied allocations - distribute proportionally',
    };
  }

  /**
   * Validate split configuration
   */
  validateConfiguration(
    members: SplitMember[],
    config: SplitConfiguration
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.platformFeePercent < 0 || config.platformFeePercent > 30) {
      errors.push('Platform fee must be between 0% and 30%');
    }

    if (config.guildFeePercent < 0 || config.guildFeePercent > 50) {
      errors.push('Guild fee must be between 0% and 50%');
    }

    if (config.platformFeePercent + config.guildFeePercent >= 100) {
      errors.push('Combined fees must be less than 100%');
    }

    if (config.method === 'CUSTOM' && config.customSplits) {
      const total = Object.values(config.customSplits).reduce((s, v) => s + v, 0);
      if (Math.abs(total - 100) > 0.01) {
        errors.push('Custom splits must total 100%');
      }

      for (const member of members) {
        if (config.customSplits[member.memberId] === undefined) {
          errors.push(`Missing custom split for ${member.memberId}`);
        }
      }
    }

    if (config.method === 'BY_HOURS') {
      const hasHours = members.every((m) => m.hoursWorked !== undefined);
      if (!hasHours) {
        errors.push('All members must have hours tracked for BY_HOURS method');
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export const splitCalculatorService = new SplitCalculatorService();
