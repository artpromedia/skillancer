import { PrismaClient } from '@prisma/client';
import { RelationshipStrength } from '../types/talent-graph.types.js';
import type {
  WorkRelationshipCreateInput,
  WorkRelationshipUpdateInput,
  NetworkStats,
  ConnectionSuggestion,
} from '../types/talent-graph.types.js';

export class WorkRelationshipService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a work relationship
   */
  async createRelationship(input: WorkRelationshipCreateInput) {
    // Check if relationship already exists
    const existing = await this.prisma.workRelationship.findFirst({
      where: {
        userId: input.userId,
        relatedUserId: input.relatedUserId,
        company: input.company,
      },
    });

    if (existing) {
      throw new Error('Relationship already exists');
    }

    // Calculate initial strength based on duration
    let strength: RelationshipStrength = RelationshipStrength.WEAK;
    if (input.endDate) {
      const durationMonths = this.monthsBetween(input.startDate, input.endDate);
      if (durationMonths >= 24) {
        strength = RelationshipStrength.STRONG;
      } else if (durationMonths >= 6) {
        strength = RelationshipStrength.MODERATE;
      }
    }

    const relationship = await this.prisma.workRelationship.create({
      data: {
        userId: input.userId,
        relatedUserId: input.relatedUserId,
        relationshipType: input.relationshipType,
        company: input.company,
        startDate: input.startDate,
        endDate: input.endDate,
        projectName: input.projectName,
        skills: input.skills || [],
        strength,
        verified: false,
        notes: input.notes,
      },
      include: {
        relatedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return relationship;
  }

  /**
   * Get relationship by ID
   */
  async getRelationshipById(id: string) {
    const relationship = await this.prisma.workRelationship.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        relatedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return relationship;
  }

  /**
   * Get all relationships for a user
   */
  async getUserRelationships(
    userId: string,
    options?: {
      company?: string;
      relationshipType?: string;
      strength?: string;
      verified?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const { company, relationshipType, strength, verified, page = 1, limit = 50 } = options || {};

    const where: any = {
      OR: [{ userId }, { relatedUserId: userId }],
    };

    if (company) where.company = company;
    if (relationshipType) where.relationshipType = relationshipType;
    if (strength) where.strength = strength;
    if (verified !== undefined) where.verified = verified;

    const [relationships, total] = await Promise.all([
      this.prisma.workRelationship.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          relatedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.workRelationship.count({ where }),
    ]);

    return {
      relationships,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update relationship
   */
  async updateRelationship(id: string, input: WorkRelationshipUpdateInput) {
    const relationship = await this.prisma.workRelationship.update({
      where: { id },
      data: {
        relationshipType: input.relationshipType,
        strength: input.strength,
        endDate: input.endDate,
        projectName: input.projectName,
        skills: input.skills,
        endorsement: input.endorsement,
        notes: input.notes,
      },
      include: {
        relatedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return relationship;
  }

  /**
   * Verify a relationship (mutual confirmation)
   */
  async verifyRelationship(id: string, verifiedByUserId: string) {
    const relationship = await this.prisma.workRelationship.findUnique({
      where: { id },
    });

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    // Check if the verifier is the related user
    if (relationship.relatedUserId !== verifiedByUserId) {
      throw new Error('Only the related user can verify this relationship');
    }

    const updated = await this.prisma.workRelationship.update({
      where: { id },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Add endorsement
   */
  async addEndorsement(id: string, endorsement: string, endorserId: string) {
    const relationship = await this.prisma.workRelationship.findUnique({
      where: { id },
    });

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    if (relationship.relatedUserId !== endorserId) {
      throw new Error('Only the related user can endorse');
    }

    const updated = await this.prisma.workRelationship.update({
      where: { id },
      data: {
        endorsement,
        endorsedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Get network statistics for a user
   */
  async getNetworkStats(userId: string): Promise<NetworkStats> {
    const relationships = await this.prisma.workRelationship.findMany({
      where: {
        OR: [{ userId }, { relatedUserId: userId }],
      },
    });

    const companies = new Set<string>();
    let strongConnections = 0;

    for (const rel of relationships) {
      companies.add(rel.company);
      if (rel.strength === 'STRONG') {
        strongConnections++;
      }
    }

    const [introsMade, introsReceived, reunions] = await Promise.all([
      this.prisma.warmIntroduction.count({ where: { introducerId: userId } }),
      this.prisma.warmIntroduction.count({ where: { targetUserId: userId } }),
      this.prisma.teamReunionMember.count({
        where: { userId, status: { in: ['ACCEPTED', 'CONFIRMED'] } },
      }),
    ]);

    return {
      totalConnections: relationships.length,
      strongConnections,
      companiesWorkedWith: companies.size,
      introductionsMade: introsMade,
      introductionsReceived: introsReceived,
      teamReunionsJoined: reunions,
    };
  }

  /**
   * Get mutual connections between two users
   */
  async getMutualConnections(userId1: string, userId2: string) {
    // Get all connections for both users
    const [connections1, connections2] = await Promise.all([
      this.prisma.workRelationship.findMany({
        where: { OR: [{ userId: userId1 }, { relatedUserId: userId1 }] },
      }),
      this.prisma.workRelationship.findMany({
        where: { OR: [{ userId: userId2 }, { relatedUserId: userId2 }] },
      }),
    ]);

    // Extract related user IDs
    const getConnectedIds = (userId: string, rels: any[]) =>
      rels.map((r) => (r.userId === userId ? r.relatedUserId : r.userId));

    const ids1 = new Set(getConnectedIds(userId1, connections1));
    const ids2 = new Set(getConnectedIds(userId2, connections2));

    // Find intersection
    const mutualIds = [...ids1].filter((id) => ids2.has(id));

    // Get user details
    const mutualConnections = await this.prisma.user.findMany({
      where: { id: { in: mutualIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    return mutualConnections;
  }

  /**
   * Get connection suggestions
   */
  async getConnectionSuggestions(userId: string, limit = 10): Promise<ConnectionSuggestion[]> {
    // Get user's existing connections
    const existingConnections = await this.prisma.workRelationship.findMany({
      where: { OR: [{ userId }, { relatedUserId: userId }] },
    });

    const connectedIds = new Set<string>();
    const companies = new Set<string>();

    for (const rel of existingConnections) {
      connectedIds.add(rel.userId === userId ? rel.relatedUserId : rel.userId);
      companies.add(rel.company);
    }

    // Get user's skills from profile
    const userProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    const userSkills = new Set(userProfile?.profile?.skills || []);

    // Find 2nd degree connections (friends of friends)
    const secondDegree = await this.prisma.workRelationship.findMany({
      where: {
        OR: [{ userId: { in: [...connectedIds] } }, { relatedUserId: { in: [...connectedIds] } }],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            profile: true,
          },
        },
        relatedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            profile: true,
          },
        },
      },
    });

    // Build suggestion candidates
    const candidates = new Map<
      string,
      {
        user: any;
        mutualCount: number;
        sharedCompanies: Set<string>;
        sharedSkills: Set<string>;
      }
    >();

    for (const rel of secondDegree) {
      const candidateId = rel.userId === userId ? rel.relatedUserId : rel.userId;
      const candidate = rel.userId === userId ? rel.relatedUser : rel.user;

      // Skip if already connected or is self
      if (connectedIds.has(candidateId) || candidateId === userId) continue;

      if (!candidates.has(candidateId)) {
        candidates.set(candidateId, {
          user: candidate,
          mutualCount: 0,
          sharedCompanies: new Set(),
          sharedSkills: new Set(),
        });
      }

      const entry = candidates.get(candidateId)!;
      entry.mutualCount++;

      if (companies.has(rel.company)) {
        entry.sharedCompanies.add(rel.company);
      }

      const candidateSkills = candidate.profile?.skills || [];
      for (const skill of candidateSkills) {
        if (userSkills.has(skill)) {
          entry.sharedSkills.add(skill);
        }
      }
    }

    // Sort by relevance and return top suggestions
    const suggestions: ConnectionSuggestion[] = [...candidates.entries()]
      .map(([, data]) => ({
        userId: data.user.id,
        name: `${data.user.firstName} ${data.user.lastName}`,
        avatarUrl: data.user.avatarUrl,
        mutualConnections: data.mutualCount,
        sharedCompanies: [...data.sharedCompanies],
        sharedSkills: [...data.sharedSkills],
        suggestionReason: this.getSuggestionReason(data),
      }))
      .sort((a, b) => {
        const scoreA =
          a.mutualConnections * 3 + a.sharedCompanies.length * 2 + a.sharedSkills.length;
        const scoreB =
          b.mutualConnections * 3 + b.sharedCompanies.length * 2 + b.sharedSkills.length;
        return scoreB - scoreA;
      })
      .slice(0, limit);

    return suggestions;
  }

  /**
   * Delete relationship
   */
  async deleteRelationship(id: string, requesterId: string) {
    const relationship = await this.prisma.workRelationship.findUnique({
      where: { id },
    });

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    if (relationship.userId !== requesterId && relationship.relatedUserId !== requesterId) {
      throw new Error('Not authorized to delete this relationship');
    }

    await this.prisma.workRelationship.delete({ where: { id } });

    return { success: true };
  }

  // Helper methods
  private monthsBetween(start: Date, end: Date): number {
    const months = (end.getFullYear() - start.getFullYear()) * 12;
    return months + end.getMonth() - start.getMonth();
  }

  private getSuggestionReason(data: {
    mutualCount: number;
    sharedCompanies: Set<string>;
    sharedSkills: Set<string>;
  }): string {
    const reasons: string[] = [];

    if (data.mutualCount > 0) {
      reasons.push(`${data.mutualCount} mutual connection${data.mutualCount > 1 ? 's' : ''}`);
    }
    if (data.sharedCompanies.size > 0) {
      reasons.push(`worked at ${[...data.sharedCompanies].slice(0, 2).join(', ')}`);
    }
    if (data.sharedSkills.size > 0) {
      reasons.push(`shares skills in ${[...data.sharedSkills].slice(0, 2).join(', ')}`);
    }

    return reasons.join(' • ') || 'Suggested connection';
  }
}
