import { vi } from 'vitest';

export const prisma = {
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn().mockResolvedValue(100),
  },
  skill: {
    findUnique: vi.fn(),
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
  marketDataPoint: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
};
