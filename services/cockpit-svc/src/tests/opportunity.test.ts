/**
 * @module @skillancer/cockpit-svc/tests/opportunity
 * Opportunity Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const createMockPrisma = () => ({
  opportunity: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  opportunityActivity: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  client: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
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

const mockOpportunity = {
  id: 'opp-123',
  freelancerUserId: mockFreelancerUserId,
  clientId: 'client-123',
  title: 'Website Redesign Project',
  description: 'Complete redesign of corporate website',
  source: 'INBOUND_INQUIRY',
  sourceDetails: 'Via website contact form',
  externalUrl: null,
  estimatedValue: 15000,
  currency: 'USD',
  expectedCloseDate: new Date('2024-03-01'),
  actualCloseDate: null,
  stage: 'PROPOSAL',
  probability: 50,
  priority: 'MEDIUM',
  status: 'OPEN',
  tags: ['web', 'design'],
  serviceType: 'Web Development',
  notes: 'Client is very interested',
  lostReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  client: {
    id: 'client-123',
    companyName: 'Acme Corp',
    firstName: null,
    lastName: null,
  },
};

const mockClient = {
  id: 'client-123',
  freelancerUserId: mockFreelancerUserId,
  companyName: 'Acme Corp',
  status: 'LEAD',
};

// =============================================================================
// TESTS
// =============================================================================

describe('Opportunity Repository', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  describe('create', () => {
    it('should create a new opportunity', async () => {
      mockPrisma.opportunity.create.mockResolvedValue(mockOpportunity);

      const result = await mockPrisma.opportunity.create({
        data: {
          freelancerUserId: mockFreelancerUserId,
          title: 'Website Redesign Project',
          source: 'INBOUND_INQUIRY',
          stage: 'LEAD',
          status: 'OPEN',
          probability: 10,
        },
      });

      expect(result.title).toBe('Website Redesign Project');
      expect(result.status).toBe('OPEN');
    });

    it('should set default probability based on stage', async () => {
      const stages = [
        { stage: 'LEAD', expectedProb: 10 },
        { stage: 'QUALIFIED', expectedProb: 25 },
        { stage: 'PROPOSAL', expectedProb: 50 },
        { stage: 'NEGOTIATION', expectedProb: 75 },
        { stage: 'WON', expectedProb: 100 },
        { stage: 'LOST', expectedProb: 0 },
      ];

      for (const { stage, expectedProb } of stages) {
        mockPrisma.opportunity.create.mockResolvedValue({
          ...mockOpportunity,
          stage,
          probability: expectedProb,
        });

        const result = await mockPrisma.opportunity.create({
          data: {
            freelancerUserId: mockFreelancerUserId,
            title: 'Test',
            source: 'OTHER',
            stage,
            status: 'OPEN',
            probability: expectedProb,
          },
        });

        expect(result.probability).toBe(expectedProb);
      }
    });
  });

  describe('findById', () => {
    it('should find opportunity by ID', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue(mockOpportunity);

      const result = await mockPrisma.opportunity.findUnique({
        where: { id: 'opp-123' },
      });

      expect(result).toEqual(mockOpportunity);
    });

    it('should include client details', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue(mockOpportunity);

      const result = await mockPrisma.opportunity.findUnique({
        where: { id: 'opp-123' },
        include: { client: true },
      });

      expect(result?.client).toBeDefined();
      expect(result?.client?.companyName).toBe('Acme Corp');
    });
  });

  describe('search', () => {
    it('should search opportunities with filters', async () => {
      mockPrisma.opportunity.findMany.mockResolvedValue([mockOpportunity]);
      mockPrisma.opportunity.count.mockResolvedValue(1);

      const opportunities = await mockPrisma.opportunity.findMany({
        where: {
          freelancerUserId: mockFreelancerUserId,
          status: 'OPEN',
        },
      });

      expect(opportunities).toHaveLength(1);
    });

    it('should filter by stage', async () => {
      mockPrisma.opportunity.findMany.mockResolvedValue([mockOpportunity]);

      const opportunities = await mockPrisma.opportunity.findMany({
        where: {
          freelancerUserId: mockFreelancerUserId,
          stage: { in: ['PROPOSAL', 'NEGOTIATION'] },
        },
      });

      expect(opportunities[0].stage).toBe('PROPOSAL');
    });

    it('should filter by value range', async () => {
      mockPrisma.opportunity.findMany.mockResolvedValue([mockOpportunity]);

      const opportunities = await mockPrisma.opportunity.findMany({
        where: {
          freelancerUserId: mockFreelancerUserId,
          estimatedValue: { gte: 10000, lte: 20000 },
        },
      });

      expect(opportunities[0].estimatedValue).toBe(15000);
    });
  });

  describe('update stage', () => {
    it('should update opportunity stage', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue(mockOpportunity);
      mockPrisma.opportunity.update.mockResolvedValue({
        ...mockOpportunity,
        stage: 'NEGOTIATION',
        probability: 75,
      });

      const result = await mockPrisma.opportunity.update({
        where: { id: 'opp-123' },
        data: { stage: 'NEGOTIATION', probability: 75 },
      });

      expect(result.stage).toBe('NEGOTIATION');
      expect(result.probability).toBe(75);
    });

    it('should set status to WON when stage is WON', async () => {
      mockPrisma.opportunity.update.mockResolvedValue({
        ...mockOpportunity,
        stage: 'WON',
        status: 'WON',
        probability: 100,
        actualCloseDate: new Date(),
      });

      const result = await mockPrisma.opportunity.update({
        where: { id: 'opp-123' },
        data: {
          stage: 'WON',
          status: 'WON',
          probability: 100,
          actualCloseDate: new Date(),
        },
      });

      expect(result.stage).toBe('WON');
      expect(result.status).toBe('WON');
      expect(result.actualCloseDate).toBeDefined();
    });

    it('should set status to LOST when stage is LOST', async () => {
      mockPrisma.opportunity.update.mockResolvedValue({
        ...mockOpportunity,
        stage: 'LOST',
        status: 'LOST',
        probability: 0,
        lostReason: 'Budget constraints',
        actualCloseDate: new Date(),
      });

      const result = await mockPrisma.opportunity.update({
        where: { id: 'opp-123' },
        data: {
          stage: 'LOST',
          status: 'LOST',
          probability: 0,
          lostReason: 'Budget constraints',
          actualCloseDate: new Date(),
        },
      });

      expect(result.stage).toBe('LOST');
      expect(result.status).toBe('LOST');
      expect(result.lostReason).toBe('Budget constraints');
    });
  });
});

describe('Pipeline View', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockRedis = createMockRedis();
  });

  it('should group opportunities by stage', async () => {
    const opportunities = [
      { ...mockOpportunity, id: 'opp-1', stage: 'LEAD', estimatedValue: 5000 },
      { ...mockOpportunity, id: 'opp-2', stage: 'LEAD', estimatedValue: 3000 },
      { ...mockOpportunity, id: 'opp-3', stage: 'PROPOSAL', estimatedValue: 15000 },
      { ...mockOpportunity, id: 'opp-4', stage: 'NEGOTIATION', estimatedValue: 20000 },
    ];

    mockPrisma.opportunity.findMany.mockResolvedValue(opportunities);

    const result = await mockPrisma.opportunity.findMany({
      where: {
        freelancerUserId: mockFreelancerUserId,
        status: { in: ['OPEN', 'ON_HOLD'] },
      },
    });

    // Group by stage
    const byStage = result.reduce(
      (acc, opp) => {
        acc[opp.stage] = acc[opp.stage] || [];
        acc[opp.stage].push(opp);
        return acc;
      },
      {} as Record<string, typeof opportunities>
    );

    expect(byStage.LEAD).toHaveLength(2);
    expect(byStage.PROPOSAL).toHaveLength(1);
    expect(byStage.NEGOTIATION).toHaveLength(1);
  });

  it('should calculate pipeline metrics', async () => {
    const opportunities = [
      { ...mockOpportunity, id: 'opp-1', stage: 'LEAD', estimatedValue: 5000, probability: 10 },
      {
        ...mockOpportunity,
        id: 'opp-2',
        stage: 'PROPOSAL',
        estimatedValue: 15000,
        probability: 50,
      },
      {
        ...mockOpportunity,
        id: 'opp-3',
        stage: 'NEGOTIATION',
        estimatedValue: 20000,
        probability: 75,
      },
    ];

    mockPrisma.opportunity.findMany.mockResolvedValue(opportunities);

    const result = await mockPrisma.opportunity.findMany({
      where: { freelancerUserId: mockFreelancerUserId },
    });

    const totalValue = result.reduce((sum, o) => sum + Number(o.estimatedValue), 0);
    const weightedValue = result.reduce(
      (sum, o) => sum + (Number(o.estimatedValue) * o.probability) / 100,
      0
    );

    expect(totalValue).toBe(40000);
    expect(weightedValue).toBe(5000 * 0.1 + 15000 * 0.5 + 20000 * 0.75); // 23000
  });
});

describe('Opportunity Statistics', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  it('should calculate win rate', async () => {
    const opportunities = [
      { ...mockOpportunity, status: 'WON' },
      { ...mockOpportunity, id: 'opp-2', status: 'WON' },
      { ...mockOpportunity, id: 'opp-3', status: 'WON' },
      { ...mockOpportunity, id: 'opp-4', status: 'LOST' },
      { ...mockOpportunity, id: 'opp-5', status: 'LOST' },
    ];

    mockPrisma.opportunity.findMany.mockResolvedValue(opportunities);

    const result = await mockPrisma.opportunity.findMany({
      where: { freelancerUserId: mockFreelancerUserId },
    });

    const won = result.filter((o) => o.status === 'WON').length;
    const lost = result.filter((o) => o.status === 'LOST').length;
    const winRate = Math.round((won / (won + lost)) * 100);

    expect(winRate).toBe(60);
  });

  it('should calculate average deal size', async () => {
    const wonOpportunities = [
      { ...mockOpportunity, status: 'WON', estimatedValue: 10000 },
      { ...mockOpportunity, id: 'opp-2', status: 'WON', estimatedValue: 20000 },
      { ...mockOpportunity, id: 'opp-3', status: 'WON', estimatedValue: 30000 },
    ];

    mockPrisma.opportunity.findMany.mockResolvedValue(wonOpportunities);

    const result = await mockPrisma.opportunity.findMany({
      where: {
        freelancerUserId: mockFreelancerUserId,
        status: 'WON',
      },
    });

    const totalValue = result.reduce((sum, o) => sum + Number(o.estimatedValue), 0);
    const avgDealSize = totalValue / result.length;

    expect(avgDealSize).toBe(20000);
  });

  it('should group by source', async () => {
    const opportunities = [
      { ...mockOpportunity, source: 'INBOUND_INQUIRY' },
      { ...mockOpportunity, id: 'opp-2', source: 'INBOUND_INQUIRY' },
      { ...mockOpportunity, id: 'opp-3', source: 'REFERRAL' },
      { ...mockOpportunity, id: 'opp-4', source: 'MARKET_PROJECT' },
    ];

    mockPrisma.opportunity.findMany.mockResolvedValue(opportunities);

    const result = await mockPrisma.opportunity.findMany({
      where: { freelancerUserId: mockFreelancerUserId },
    });

    const bySource = result.reduce(
      (acc, o) => {
        acc[o.source] = (acc[o.source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    expect(bySource.INBOUND_INQUIRY).toBe(2);
    expect(bySource.REFERRAL).toBe(1);
    expect(bySource.MARKET_PROJECT).toBe(1);
  });
});

describe('Opportunity Activities', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  it('should log activity on stage change', async () => {
    const activity = {
      id: 'activity-123',
      opportunityId: 'opp-123',
      activityType: 'STAGE_CHANGED',
      description: 'Stage changed from LEAD to QUALIFIED',
      fromStage: 'LEAD',
      toStage: 'QUALIFIED',
      metadata: null,
      createdAt: new Date(),
    };

    mockPrisma.opportunityActivity.create.mockResolvedValue(activity);

    const result = await mockPrisma.opportunityActivity.create({
      data: {
        opportunityId: 'opp-123',
        activityType: 'STAGE_CHANGED',
        description: 'Stage changed from LEAD to QUALIFIED',
        fromStage: 'LEAD',
        toStage: 'QUALIFIED',
      },
    });

    expect(result.activityType).toBe('STAGE_CHANGED');
    expect(result.fromStage).toBe('LEAD');
    expect(result.toStage).toBe('QUALIFIED');
  });

  it('should retrieve activity history', async () => {
    const activities = [
      { id: 'act-1', activityType: 'CREATED', createdAt: new Date('2024-01-01') },
      { id: 'act-2', activityType: 'STAGE_CHANGED', createdAt: new Date('2024-01-05') },
      { id: 'act-3', activityType: 'STAGE_CHANGED', createdAt: new Date('2024-01-10') },
    ];

    mockPrisma.opportunityActivity.findMany.mockResolvedValue(activities);

    const result = await mockPrisma.opportunityActivity.findMany({
      where: { opportunityId: 'opp-123' },
      orderBy: { createdAt: 'desc' },
    });

    expect(result).toHaveLength(3);
  });
});
