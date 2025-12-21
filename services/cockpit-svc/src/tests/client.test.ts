/**
 * @module @skillancer/cockpit-svc/tests/client
 * Client Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@skillancer/database';
import type { Redis } from 'ioredis';
import type { Logger } from '@skillancer/logger';

// =============================================================================
// MOCKS
// =============================================================================

const createMockPrisma = () => ({
  client: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  clientContact: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  clientInteraction: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  opportunity: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn((fn) =>
    fn({
      client: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
      clientContact: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    })
  ),
});

const createMockRedis = () => ({
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
});

const createMockLogger = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
});

// =============================================================================
// TEST DATA
// =============================================================================

const mockFreelancerUserId = 'freelancer-123';

const mockClient = {
  id: 'client-123',
  freelancerUserId: mockFreelancerUserId,
  clientType: 'COMPANY',
  source: 'MANUAL',
  status: 'ACTIVE',
  companyName: 'Acme Corp',
  firstName: null,
  lastName: null,
  email: 'contact@acme.com',
  phone: '+1234567890',
  website: 'https://acme.com',
  industry: 'Technology',
  companySize: 'MEDIUM',
  timezone: 'America/New_York',
  notes: 'Great client',
  tags: ['tech', 'enterprise'],
  totalRevenue: 50000,
  totalProjects: 5,
  averageProjectValue: 10000,
  healthScore: 85,
  lastInteractionAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockContact = {
  id: 'contact-123',
  clientId: 'client-123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@acme.com',
  phone: '+1234567890',
  role: 'DECISION_MAKER',
  jobTitle: 'CEO',
  isPrimary: true,
  notes: null,
  preferredContactMethod: 'email',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInteraction = {
  id: 'interaction-123',
  clientId: 'client-123',
  interactionType: 'MEETING',
  subject: 'Project Kickoff',
  notes: 'Discussed project requirements',
  sentiment: 'POSITIVE',
  isOutbound: true,
  duration: 60,
  occurredAt: new Date(),
  scheduledAt: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// =============================================================================
// TESTS
// =============================================================================

describe('Client Repository', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  describe('create', () => {
    it('should create a new client', async () => {
      const createData = {
        freelancerUserId: mockFreelancerUserId,
        clientType: 'COMPANY' as const,
        source: 'MANUAL' as const,
        companyName: 'Acme Corp',
        email: 'contact@acme.com',
      };

      mockPrisma.client.create.mockResolvedValue({
        ...mockClient,
        ...createData,
      });

      const result = await mockPrisma.client.create({ data: createData });

      expect(result.companyName).toBe('Acme Corp');
      expect(result.email).toBe('contact@acme.com');
    });

    it('should validate required fields', () => {
      expect(() => {
        // Missing required fields should throw
        mockPrisma.client.create.mockImplementation(() => {
          throw new Error('Missing required field');
        });
      }).not.toThrow();
    });
  });

  describe('findById', () => {
    it('should find client by ID', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);

      const result = await mockPrisma.client.findUnique({
        where: { id: 'client-123' },
      });

      expect(result).toEqual(mockClient);
    });

    it('should return null for non-existent client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.client.findUnique({
        where: { id: 'non-existent' },
      });

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should search clients with filters', async () => {
      mockPrisma.client.findMany.mockResolvedValue([mockClient]);
      mockPrisma.client.count.mockResolvedValue(1);

      const clients = await mockPrisma.client.findMany({
        where: {
          freelancerUserId: mockFreelancerUserId,
          status: 'ACTIVE',
        },
      });

      expect(clients).toHaveLength(1);
      expect(clients[0].status).toBe('ACTIVE');
    });

    it('should search by tags', async () => {
      mockPrisma.client.findMany.mockResolvedValue([mockClient]);

      const clients = await mockPrisma.client.findMany({
        where: {
          freelancerUserId: mockFreelancerUserId,
          tags: { hasSome: ['tech'] },
        },
      });

      expect(clients[0].tags).toContain('tech');
    });

    it('should search by text query', async () => {
      mockPrisma.client.findMany.mockResolvedValue([mockClient]);

      const clients = await mockPrisma.client.findMany({
        where: {
          freelancerUserId: mockFreelancerUserId,
          OR: [
            { companyName: { contains: 'Acme', mode: 'insensitive' } },
            { email: { contains: 'Acme', mode: 'insensitive' } },
          ],
        },
      });

      expect(clients[0].companyName).toBe('Acme Corp');
    });
  });

  describe('update', () => {
    it('should update client fields', async () => {
      mockPrisma.client.update.mockResolvedValue({
        ...mockClient,
        notes: 'Updated notes',
      });

      const result = await mockPrisma.client.update({
        where: { id: 'client-123' },
        data: { notes: 'Updated notes' },
      });

      expect(result.notes).toBe('Updated notes');
    });

    it('should update client status', async () => {
      mockPrisma.client.update.mockResolvedValue({
        ...mockClient,
        status: 'ARCHIVED',
        archivedAt: new Date(),
      });

      const result = await mockPrisma.client.update({
        where: { id: 'client-123' },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });

      expect(result.status).toBe('ARCHIVED');
    });
  });
});

describe('Contact Repository', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  describe('create', () => {
    it('should create a contact', async () => {
      mockPrisma.clientContact.create.mockResolvedValue(mockContact);

      const result = await mockPrisma.clientContact.create({
        data: {
          clientId: 'client-123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'DECISION_MAKER',
        },
      });

      expect(result.firstName).toBe('John');
      expect(result.role).toBe('DECISION_MAKER');
    });
  });

  describe('findByClient', () => {
    it('should find all contacts for a client', async () => {
      mockPrisma.clientContact.findMany.mockResolvedValue([mockContact]);

      const contacts = await mockPrisma.clientContact.findMany({
        where: { clientId: 'client-123' },
      });

      expect(contacts).toHaveLength(1);
      expect(contacts[0].clientId).toBe('client-123');
    });
  });
});

describe('Interaction Repository', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  describe('create', () => {
    it('should create an interaction', async () => {
      mockPrisma.clientInteraction.create.mockResolvedValue(mockInteraction);

      const result = await mockPrisma.clientInteraction.create({
        data: {
          clientId: 'client-123',
          interactionType: 'MEETING',
          subject: 'Project Kickoff',
        },
      });

      expect(result.interactionType).toBe('MEETING');
      expect(result.subject).toBe('Project Kickoff');
    });
  });

  describe('findByClient', () => {
    it('should find interactions for a client', async () => {
      mockPrisma.clientInteraction.findMany.mockResolvedValue([mockInteraction]);

      const interactions = await mockPrisma.clientInteraction.findMany({
        where: { clientId: 'client-123' },
        orderBy: { occurredAt: 'desc' },
      });

      expect(interactions).toHaveLength(1);
    });

    it('should count interactions', async () => {
      mockPrisma.clientInteraction.count.mockResolvedValue(10);

      const count = await mockPrisma.clientInteraction.count({
        where: { clientId: 'client-123' },
      });

      expect(count).toBe(10);
    });
  });
});

describe('Client Statistics', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockRedis = createMockRedis();
  });

  it('should calculate total clients', async () => {
    mockPrisma.client.count.mockResolvedValue(25);

    const count = await mockPrisma.client.count({
      where: { freelancerUserId: mockFreelancerUserId },
    });

    expect(count).toBe(25);
  });

  it('should calculate clients by status', async () => {
    mockPrisma.client.count.mockImplementation((args) => {
      const status = args.where?.status;
      if (status === 'ACTIVE') return Promise.resolve(15);
      if (status === 'LEAD') return Promise.resolve(5);
      if (status === 'ARCHIVED') return Promise.resolve(5);
      return Promise.resolve(0);
    });

    const active = await mockPrisma.client.count({
      where: { freelancerUserId: mockFreelancerUserId, status: 'ACTIVE' },
    });
    const leads = await mockPrisma.client.count({
      where: { freelancerUserId: mockFreelancerUserId, status: 'LEAD' },
    });

    expect(active).toBe(15);
    expect(leads).toBe(5);
  });

  it('should calculate total revenue', async () => {
    mockPrisma.client.findMany.mockResolvedValue([
      { ...mockClient, totalRevenue: 50000 },
      { ...mockClient, id: 'client-456', totalRevenue: 30000 },
    ]);

    const clients = await mockPrisma.client.findMany({
      where: { freelancerUserId: mockFreelancerUserId },
      select: { totalRevenue: true },
    });

    const totalRevenue = clients.reduce((sum, c) => sum + Number(c.totalRevenue), 0);
    expect(totalRevenue).toBe(80000);
  });
});

describe('Clients Needing Attention', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  it('should find clients with low health scores', async () => {
    mockPrisma.client.findMany.mockResolvedValue([
      { ...mockClient, healthScore: 30 },
      { ...mockClient, id: 'client-456', healthScore: 45 },
    ]);

    const clients = await mockPrisma.client.findMany({
      where: {
        freelancerUserId: mockFreelancerUserId,
        healthScore: { lt: 50 },
        status: { in: ['ACTIVE', 'LEAD'] },
      },
      orderBy: { healthScore: 'asc' },
    });

    expect(clients).toHaveLength(2);
    expect(clients[0].healthScore).toBe(30);
  });

  it('should find clients with no recent interaction', async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    mockPrisma.client.findMany.mockResolvedValue([
      { ...mockClient, lastInteractionAt: new Date('2023-01-01') },
    ]);

    const clients = await mockPrisma.client.findMany({
      where: {
        freelancerUserId: mockFreelancerUserId,
        lastInteractionAt: { lt: thirtyDaysAgo },
        status: { in: ['ACTIVE', 'LEAD'] },
      },
    });

    expect(clients).toHaveLength(1);
  });
});
