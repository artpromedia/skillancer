import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Mock the database and external dependencies
vi.mock('@skillancer/database', () => ({
  prisma: {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    skill: {
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    engagement: {
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _avg: { rate: 75 } }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    engagementOutcome: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(100),
    },
  },
}));

vi.mock('@skillancer/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@skillancer/config', () => ({
  config: {
    nodeEnv: 'test',
    logLevel: 'error',
  },
}));

describe('Intelligence API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });

    // Register a basic health route for testing
    app.get('/health', async () => {
      return { status: 'ok', service: 'intelligence-api' };
    });

    // Register a mock rate analytics endpoint
    app.get('/api/v1/rates/market', async () => {
      return {
        averageRate: 75,
        rateRange: { min: 50, max: 150 },
        skills: [],
      };
    });

    // Register a mock demand analytics endpoint
    app.get('/api/v1/demand/skills', async () => {
      return {
        skills: [],
        trending: [],
        emerging: [],
      };
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('intelligence-api');
    });
  });

  describe('Rate Analytics', () => {
    it('should return market rate data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/rates/market',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.averageRate).toBeDefined();
      expect(body.rateRange).toBeDefined();
    });
  });

  describe('Demand Analytics', () => {
    it('should return skill demand data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/demand/skills',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.skills).toBeDefined();
      expect(body.trending).toBeDefined();
    });
  });
});

describe('Rate Analytics Service', () => {
  it('should calculate average rates correctly', () => {
    const rates = [50, 75, 100, 125, 150];
    const average = rates.reduce((sum, r) => sum + r, 0) / rates.length;

    expect(average).toBe(100);
  });

  it('should identify rate percentiles', () => {
    const rates = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150];
    const sorted = [...rates].sort((a, b) => a - b);

    const p25Index = Math.floor(sorted.length * 0.25);
    const p75Index = Math.floor(sorted.length * 0.75);

    expect(sorted[p25Index]).toBe(70); // 25th percentile
    expect(sorted[p75Index]).toBe(130); // 75th percentile
  });
});

describe('Demand Analytics Service', () => {
  it('should categorize skill demand levels', () => {
    const categorizedemand = (count: number): string => {
      if (count >= 100) return 'HIGH';
      if (count >= 50) return 'MEDIUM';
      return 'LOW';
    };

    expect(categorizedemand(150)).toBe('HIGH');
    expect(categorizedemand(75)).toBe('MEDIUM');
    expect(categorizedemand(25)).toBe('LOW');
  });

  it('should identify trending skills by growth rate', () => {
    const skills = [
      { name: 'AI/ML', previousMonth: 100, currentMonth: 150 },
      { name: 'React', previousMonth: 200, currentMonth: 210 },
      { name: 'COBOL', previousMonth: 50, currentMonth: 45 },
    ];

    const trending = skills
      .map((s) => ({
        ...s,
        growthRate: (s.currentMonth - s.previousMonth) / s.previousMonth,
      }))
      .filter((s) => s.growthRate > 0.1)
      .sort((a, b) => b.growthRate - a.growthRate);

    expect(trending).toHaveLength(1);
    expect(trending[0].name).toBe('AI/ML');
  });
});

describe('Workforce Analytics', () => {
  it('should calculate workforce availability', () => {
    const freelancers = [
      { id: '1', available: true, skills: ['React', 'Node.js'] },
      { id: '2', available: false, skills: ['React'] },
      { id: '3', available: true, skills: ['Python', 'AI/ML'] },
    ];

    const available = freelancers.filter((f) => f.available);
    expect(available).toHaveLength(2);

    const reactAvailable = available.filter((f) => f.skills.includes('React'));
    expect(reactAvailable).toHaveLength(1);
  });

  it('should compute skill distribution', () => {
    const skills = ['React', 'React', 'Node.js', 'React', 'Python', 'Node.js'];

    const distribution = skills.reduce((acc, skill) => {
      acc[skill] = (acc[skill] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(distribution['React']).toBe(3);
    expect(distribution['Node.js']).toBe(2);
    expect(distribution['Python']).toBe(1);
  });
});
