/**
 * @module @skillancer/cockpit-svc/services/client
 * Client Service - Core CRM client management
 */

import { CrmError, CrmErrorCode } from '../errors/crm.errors.js';
import {
  ClientRepository,
  ContactRepository,
  InteractionRepository,
  ReminderRepository,
} from '../repositories/index.js';

import type { ClientHealthScoreService } from './client-health-score.service.js';
import type { ClientSearchService } from './client-search.service.js';
import type {
  CreateClientParams,
  UpdateClientParams,
  ClientSearchParams,
  ClientWithMetrics,
  ClientWithDetails,
  ClientSearchResult,
  ClientStats,
  CreateContactParams,
  UpdateContactParams,
  ClientContactSummary,
  CreateInteractionParams,
  InteractionSearchParams,
  ClientInteractionSummary,
  MarketSyncResult,
  ClientAddress,
} from '../types/crm.types.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Cache TTLs
const CLIENT_CACHE_TTL = 300; // 5 minutes
const CLIENT_STATS_CACHE_TTL = 60; // 1 minute

export class ClientService {
  private readonly clientRepository: ClientRepository;
  private readonly contactRepository: ContactRepository;
  private readonly interactionRepository: InteractionRepository;
  private readonly reminderRepository: ReminderRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly healthScoreService: ClientHealthScoreService,
    private readonly searchService: ClientSearchService
  ) {
    this.clientRepository = new ClientRepository(prisma);
    this.contactRepository = new ContactRepository(prisma);
    this.interactionRepository = new InteractionRepository(prisma);
    this.reminderRepository = new ReminderRepository(prisma);
  }

  /**
   * Create a new client
   */
  async createClient(params: CreateClientParams) {
    // Check for duplicate by email
    if (params.email) {
      const existing = await this.clientRepository.findByEmail(
        params.freelancerUserId,
        params.email
      );
      if (existing) {
        throw new CrmError(CrmErrorCode.DUPLICATE_CLIENT_EMAIL);
      }
    }

    // Create client
    const client = await this.clientRepository.create({
      freelancerUserId: params.freelancerUserId,
      clientType: params.clientType || 'INDIVIDUAL',
      source: params.source || 'MANUAL',
      platformUserId: params.platformUserId,
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email,
      phone: params.phone,
      alternateEmail: params.alternateEmail,
      alternatePhone: params.alternatePhone,
      companyName: params.companyName,
      companyWebsite: params.companyWebsite,
      companySize: params.companySize,
      industry: params.industry,
      jobTitle: params.jobTitle,
      department: params.department,
      address: params.address,
      timezone: params.timezone,
      avatarUrl: params.avatarUrl,
      bio: params.bio,
      linkedinUrl: params.linkedinUrl,
      twitterUrl: params.twitterUrl,
      preferredContactMethod: params.preferredContactMethod,
      communicationPreferences: params.communicationPreferences,
      tags: params.tags || [],
      customFields: params.customFields,
      internalNotes: params.notes,
      status: 'LEAD',
    });

    // Index for search
    await this.searchService.indexClient(client);

    // Calculate initial health score
    await this.healthScoreService.calculateAndUpdate(client.id);

    this.logger.info(
      {
        clientId: client.id,
        freelancerUserId: params.freelancerUserId,
        source: client.source,
      },
      'Client created'
    );

    return client;
  }

  /**
   * Import a client from Skillancer Market
   */
  async importFromMarket(freelancerUserId: string, platformUserId: string) {
    // Check if already imported
    const existing = await this.clientRepository.findByPlatformUser(
      freelancerUserId,
      platformUserId
    );
    if (existing) {
      return existing;
    }

    // Get user from platform
    const platformUser = await this.prisma.user.findUnique({
      where: { id: platformUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        timezone: true,
        profile: {
          select: {
            title: true,
            bio: true,
            linkedinUrl: true,
            twitterUrl: true,
            country: true,
            city: true,
          },
        },
      },
    });

    if (!platformUser) {
      throw new CrmError(CrmErrorCode.PLATFORM_USER_NOT_FOUND);
    }

    // Get contract history - find contracts where this user is the client
    const contracts = await this.prisma.contract.findMany({
      where: {
        freelancerId: freelancerUserId,
        clientId: platformUserId,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    // Calculate metrics
    const totalProjects = contracts.length;
    const activeProjects = contracts.filter((c) => c.status === 'ACTIVE').length;

    // Create client
    const client = await this.clientRepository.create({
      freelancerUserId,
      clientType: 'INDIVIDUAL',
      source: 'SKILLANCER_MARKET',
      platformUserId,
      firstName: platformUser.firstName,
      lastName: platformUser.lastName,
      email: platformUser.email,
      avatarUrl: platformUser.avatarUrl,
      timezone: platformUser.timezone,
      bio: platformUser.profile?.bio,
      linkedinUrl: platformUser.profile?.linkedinUrl,
      twitterUrl: platformUser.profile?.twitterUrl,
      status: activeProjects > 0 ? 'ACTIVE' : 'INACTIVE',
      totalProjects,
      activeProjects,
      lastProjectAt: contracts[0]?.createdAt,
    });

    // Index for search
    await this.searchService.indexClient(client);

    // Calculate health score
    await this.healthScoreService.calculateAndUpdate(client.id);

    this.logger.info({ clientId: client.id, platformUserId }, 'Client imported from market');

    return client;
  }

  /**
   * Sync all clients from Skillancer Market
   */
  async syncFromMarket(freelancerUserId: string): Promise<MarketSyncResult> {
    // Get all contracts for this freelancer
    const contracts = await this.prisma.contract.findMany({
      where: { freelancerId: freelancerUserId },
      select: { clientId: true },
      distinct: ['clientId'],
    });

    // Get unique client user IDs
    const clientUserIds = [...new Set(contracts.map((c) => c.clientId))];

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const clientUserId of clientUserIds) {
      try {
        const existing = await this.clientRepository.findByPlatformUser(
          freelancerUserId,
          clientUserId
        );

        if (existing) {
          await this.refreshClientMetrics(existing.id);
          updated++;
        } else {
          await this.importFromMarket(freelancerUserId, clientUserId);
          imported++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to sync client ${clientUserId}: ${message}`);
        this.logger.error({ clientUserId, error: message }, 'Failed to sync client');
      }
    }

    this.logger.info(
      { freelancerUserId, imported, updated, errors: errors.length },
      'Market sync completed'
    );

    return { imported, updated, errors };
  }

  /**
   * Update a client
   */
  async updateClient(clientId: string, freelancerUserId: string, updates: UpdateClientParams) {
    const client = await this.clientRepository.findById(clientId);
    if (!client) {
      throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
    }

    if (client.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    // Check email uniqueness if changing
    if (updates.email && updates.email !== client.email) {
      const existing = await this.clientRepository.findByEmail(freelancerUserId, updates.email);
      if (existing) {
        throw new CrmError(CrmErrorCode.DUPLICATE_CLIENT_EMAIL);
      }
    }

    const updatedClient = await this.clientRepository.update(clientId, {
      ...(updates.clientType !== undefined && { clientType: updates.clientType }),
      ...(updates.source !== undefined && { source: updates.source }),
      ...(updates.firstName !== undefined && { firstName: updates.firstName }),
      ...(updates.lastName !== undefined && { lastName: updates.lastName }),
      ...(updates.email !== undefined && { email: updates.email }),
      ...(updates.phone !== undefined && { phone: updates.phone }),
      ...(updates.alternateEmail !== undefined && { alternateEmail: updates.alternateEmail }),
      ...(updates.alternatePhone !== undefined && { alternatePhone: updates.alternatePhone }),
      ...(updates.companyName !== undefined && { companyName: updates.companyName }),
      ...(updates.companyWebsite !== undefined && { companyWebsite: updates.companyWebsite }),
      ...(updates.companySize !== undefined && { companySize: updates.companySize }),
      ...(updates.industry !== undefined && { industry: updates.industry }),
      ...(updates.jobTitle !== undefined && { jobTitle: updates.jobTitle }),
      ...(updates.department !== undefined && { department: updates.department }),
      ...(updates.address !== undefined && { address: updates.address }),
      ...(updates.timezone !== undefined && { timezone: updates.timezone }),
      ...(updates.avatarUrl !== undefined && { avatarUrl: updates.avatarUrl }),
      ...(updates.bio !== undefined && { bio: updates.bio }),
      ...(updates.linkedinUrl !== undefined && { linkedinUrl: updates.linkedinUrl }),
      ...(updates.twitterUrl !== undefined && { twitterUrl: updates.twitterUrl }),
      ...(updates.preferredContactMethod !== undefined && {
        preferredContactMethod: updates.preferredContactMethod,
      }),
      ...(updates.communicationPreferences !== undefined && {
        communicationPreferences: updates.communicationPreferences,
      }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
      ...(updates.customFields !== undefined && { customFields: updates.customFields }),
      ...(updates.notes !== undefined && { internalNotes: updates.notes }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.nextFollowUpAt !== undefined && { nextFollowUpAt: updates.nextFollowUpAt }),
    });

    // Re-index for search
    await this.searchService.indexClient(updatedClient);

    // Invalidate cache
    await this.invalidateClientCache(clientId);

    return updatedClient;
  }

  /**
   * Search clients
   */
  async searchClients(params: ClientSearchParams): Promise<ClientSearchResult> {
    // Use Elasticsearch for text search
    if (params.query) {
      return this.searchService.search(params);
    }

    // Use database for filtered queries
    return this.clientRepository.search(params);
  }

  /**
   * Get a client by ID
   */
  async getClientById(clientId: string, freelancerUserId: string): Promise<ClientWithDetails> {
    // Try cache first
    const cacheKey = `client:${clientId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const cachedClient = JSON.parse(cached) as ClientWithDetails;
      // Verify ownership
      if (cachedClient.id) {
        return cachedClient;
      }
    }

    const client = await this.clientRepository.findByIdWithDetails(clientId);
    if (!client) {
      throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
    }

    if (client.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    // Get recent interactions
    const { interactions: recentInteractions } = await this.interactionRepository.findByClient(
      clientId,
      { limit: 10 }
    );

    // Get upcoming reminders
    const upcomingReminders = await this.reminderRepository.findUpcoming(clientId, 5);

    // Build response
    const response: ClientWithDetails = {
      id: client.id,
      displayName: this.getClientDisplayName(client),
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      alternateEmail: client.alternateEmail,
      alternatePhone: client.alternatePhone,
      companyName: client.companyName,
      companyWebsite: client.companyWebsite,
      companySize: client.companySize,
      industry: client.industry,
      jobTitle: client.jobTitle,
      department: client.department,
      address: client.address as ClientAddress | null,
      timezone: client.timezone,
      avatarUrl: client.avatarUrl,
      bio: client.bio,
      linkedinUrl: client.linkedinUrl,
      twitterUrl: client.twitterUrl,
      preferredContactMethod: client.preferredContactMethod,
      communicationPreferences: client.communicationPreferences as Record<string, unknown> | null,
      customFields: client.customFields as Record<string, unknown> | null,
      internalNotes: client.internalNotes,
      clientType: client.clientType,
      source: client.source,
      status: client.status,
      healthScore: client.healthScore,
      healthScoreUpdatedAt: client.healthScoreUpdatedAt,
      lifetimeValue: Number(client.lifetimeValue),
      totalProjects: client.totalProjects,
      activeProjects: client.activeProjects,
      avgRating: client.avgRating ? Number(client.avgRating) : null,
      lastContactAt: client.lastContactAt,
      lastProjectAt: client.lastProjectAt,
      nextFollowUpAt: client.nextFollowUpAt,
      platformUserId: client.platformUserId,
      tags: client.tags,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      archivedAt: client.archivedAt,
      contacts: client.contacts.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        jobTitle: c.jobTitle,
        role: c.role,
        isPrimary: c.isPrimary,
        isActive: c.isActive,
      })),
      recentInteractions: recentInteractions.map((i) => ({
        id: i.id,
        interactionType: i.interactionType,
        subject: i.subject,
        description: i.description,
        occurredAt: i.occurredAt,
        duration: i.duration,
        outcome: i.outcome,
        sentiment: i.sentiment,
        followUpRequired: i.followUpRequired,
        followUpDate: i.followUpDate,
        createdAt: i.createdAt,
      })),
      upcomingReminders: upcomingReminders.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        reminderType: r.reminderType,
        dueAt: r.dueAt,
        status: r.status,
        isRecurring: r.isRecurring,
        completedAt: r.completedAt,
        snoozedUntil: r.snoozedUntil,
      })),
    };

    // Cache the result
    await this.redis.setex(cacheKey, CLIENT_CACHE_TTL, JSON.stringify(response));

    return response;
  }

  /**
   * Archive a client
   */
  async archiveClient(clientId: string, freelancerUserId: string): Promise<void> {
    const client = await this.clientRepository.findById(clientId);
    if (!client || client.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
    }

    await this.clientRepository.update(clientId, {
      status: 'ARCHIVED',
      archivedAt: new Date(),
    });

    // Remove from search index
    await this.searchService.removeClient(clientId);

    // Invalidate cache
    await this.invalidateClientCache(clientId);

    this.logger.info({ clientId }, 'Client archived');
  }

  /**
   * Restore an archived client
   */
  async restoreClient(clientId: string, freelancerUserId: string) {
    const client = await this.clientRepository.findById(clientId);
    if (!client || client.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
    }

    const restored = await this.clientRepository.update(clientId, {
      status: 'INACTIVE',
      archivedAt: null,
    });

    // Re-index for search
    await this.searchService.indexClient(restored);

    // Invalidate cache
    await this.invalidateClientCache(clientId);

    this.logger.info({ clientId }, 'Client restored');

    return restored;
  }

  /**
   * Add an interaction to a client
   */
  async addInteraction(params: CreateInteractionParams) {
    const client = await this.clientRepository.findById(params.clientId);
    if (!client || client.freelancerUserId !== params.freelancerUserId) {
      throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
    }

    const interaction = await this.interactionRepository.create({
      clientId: params.clientId,
      freelancerUserId: params.freelancerUserId,
      interactionType: params.interactionType,
      subject: params.subject,
      description: params.description,
      occurredAt: params.occurredAt || new Date(),
      duration: params.duration,
      outcome: params.outcome,
      nextSteps: params.nextSteps,
      followUpRequired: params.followUpRequired || false,
      followUpDate: params.followUpDate,
      attachments: params.attachments,
      sentiment: params.sentiment,
      opportunityId: params.opportunityId,
      projectId: params.projectId,
    });

    // Update client's last contact
    await this.clientRepository.update(params.clientId, {
      lastContactAt: interaction.occurredAt,
    });

    // Create follow-up reminder if needed
    if (params.followUpRequired && params.followUpDate) {
      await this.reminderRepository.create({
        clientId: params.clientId,
        freelancerUserId: params.freelancerUserId,
        title: `Follow up: ${params.subject || 'Previous conversation'}`,
        description: params.nextSteps,
        reminderType: 'FOLLOW_UP',
        dueAt: params.followUpDate,
        notifyBefore: 60, // 1 hour before
      });
    }

    // Recalculate health score
    await this.healthScoreService.calculateAndUpdate(params.clientId);

    // Invalidate cache
    await this.invalidateClientCache(params.clientId);

    this.logger.info(
      { interactionId: interaction.id, clientId: params.clientId, type: params.interactionType },
      'Interaction added'
    );

    return interaction;
  }

  /**
   * Get interactions for a client
   */
  async getClientInteractions(
    clientId: string,
    freelancerUserId: string,
    params: Omit<InteractionSearchParams, 'clientId'>
  ) {
    const client = await this.clientRepository.findById(clientId);
    if (!client || client.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
    }

    return this.interactionRepository.findByClient(clientId, params);
  }

  /**
   * Add a contact to a client
   */
  async addContact(params: CreateContactParams) {
    const client = await this.clientRepository.findById(params.clientId);
    if (!client || client.freelancerUserId !== params.freelancerUserId) {
      throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
    }

    // If setting as primary, unset other primary contacts
    if (params.isPrimary) {
      await this.contactRepository.clearPrimary(params.clientId);
    }

    const contact = await this.contactRepository.create({
      clientId: params.clientId,
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email,
      phone: params.phone,
      jobTitle: params.jobTitle,
      department: params.department,
      role: params.role || 'OTHER',
      isPrimary: params.isPrimary || false,
      notes: params.notes,
    });

    // Invalidate cache
    await this.invalidateClientCache(params.clientId);

    this.logger.info({ contactId: contact.id, clientId: params.clientId }, 'Contact added');

    return contact;
  }

  /**
   * Update a contact
   */
  async updateContact(contactId: string, freelancerUserId: string, updates: UpdateContactParams) {
    const contact = await this.contactRepository.findById(contactId);
    if (!contact) {
      throw new CrmError(CrmErrorCode.CONTACT_NOT_FOUND);
    }

    const client = await this.clientRepository.findById(contact.clientId);
    if (!client || client.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    // If setting as primary, unset other primary contacts
    if (updates.isPrimary) {
      await this.contactRepository.clearPrimary(contact.clientId);
    }

    const updatedContact = await this.contactRepository.update(contactId, updates);

    // Invalidate cache
    await this.invalidateClientCache(contact.clientId);

    return updatedContact;
  }

  /**
   * Delete a contact
   */
  async deleteContact(contactId: string, freelancerUserId: string) {
    const contact = await this.contactRepository.findById(contactId);
    if (!contact) {
      throw new CrmError(CrmErrorCode.CONTACT_NOT_FOUND);
    }

    const client = await this.clientRepository.findById(contact.clientId);
    if (!client || client.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    await this.contactRepository.delete(contactId);

    // Invalidate cache
    await this.invalidateClientCache(contact.clientId);

    this.logger.info({ contactId }, 'Contact deleted');
  }

  /**
   * Get client statistics
   */
  async getClientStats(freelancerUserId: string): Promise<ClientStats> {
    // Try cache first
    const cacheKey = `client:stats:${freelancerUserId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ClientStats;
    }

    const clients = await this.clientRepository.findByFreelancer(freelancerUserId);

    const stats: ClientStats = {
      total: clients.length,
      byStatus: {},
      bySource: {},
      totalLifetimeValue: 0,
      avgHealthScore: 0,
      needsAttention: 0,
      recentlyActive: 0,
    };

    let healthScoreSum = 0;
    let healthScoreCount = 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const client of clients) {
      // Count by status
      stats.byStatus[client.status] = (stats.byStatus[client.status] || 0) + 1;

      // Count by source
      stats.bySource[client.source] = (stats.bySource[client.source] || 0) + 1;

      // Sum lifetime value
      stats.totalLifetimeValue += Number(client.lifetimeValue || 0);

      // Health score
      if (client.healthScore !== null) {
        healthScoreSum += client.healthScore;
        healthScoreCount++;
        if (client.healthScore < 50) {
          stats.needsAttention++;
        }
      }

      // Recently active
      if (client.lastContactAt && client.lastContactAt >= thirtyDaysAgo) {
        stats.recentlyActive++;
      }
    }

    stats.avgHealthScore = healthScoreCount > 0 ? Math.round(healthScoreSum / healthScoreCount) : 0;

    // Cache the result
    await this.redis.setex(cacheKey, CLIENT_STATS_CACHE_TTL, JSON.stringify(stats));

    return stats;
  }

  /**
   * Get clients needing attention
   */
  async getClientsNeedingAttention(freelancerUserId: string) {
    return this.healthScoreService.getClientsNeedingAttention(freelancerUserId);
  }

  /**
   * Refresh client metrics from Market data
   */
  private async refreshClientMetrics(clientId: string): Promise<void> {
    const client = await this.clientRepository.findById(clientId);
    if (!client || !client.platformUserId) return;

    // Get updated contract data
    const contracts = await this.prisma.contract.findMany({
      where: {
        freelancerId: client.freelancerUserId,
        clientId: client.platformUserId,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    const totalProjects = contracts.length;
    const activeProjects = contracts.filter((c) => c.status === 'ACTIVE').length;

    await this.clientRepository.update(clientId, {
      totalProjects,
      activeProjects,
      status: activeProjects > 0 ? 'ACTIVE' : 'INACTIVE',
    });

    // Recalculate health score
    await this.healthScoreService.calculateAndUpdate(clientId);
  }

  /**
   * Get client display name
   */
  private getClientDisplayName(client: {
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  }): string {
    if (client.companyName) {
      return client.companyName;
    }
    const parts = [client.firstName, client.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Unknown Client';
  }

  /**
   * Invalidate client cache
   */
  private async invalidateClientCache(clientId: string): Promise<void> {
    await this.redis.del(`client:${clientId}`);
    // Also invalidate stats cache for the freelancer
    const client = await this.clientRepository.findById(clientId);
    if (client) {
      await this.redis.del(`client:stats:${client.freelancerUserId}`);
    }
  }
}
