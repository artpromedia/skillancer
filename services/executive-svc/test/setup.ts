import { vi } from 'vitest';

// Mock @prisma/client for services that use it directly
vi.mock('@prisma/client', () => {
  const OKRStatus = {
    NOT_STARTED: 'NOT_STARTED',
    ON_TRACK: 'ON_TRACK',
    AT_RISK: 'AT_RISK',
    BEHIND: 'BEHIND',
    ACHIEVED: 'ACHIEVED',
  };

  const mockPrismaClient = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    objective: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    keyResult: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    keyResultUpdate: {
      create: vi.fn(),
    },
    oKRCheckIn: {
      create: vi.fn(),
    },
    engagement: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  return {
    PrismaClient: vi.fn(() => mockPrismaClient),
    OKRStatus,
  };
});

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.PORT = '3005';
process.env.HOST = 'localhost';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.COOKIE_SECRET = 'test-cookie-secret';
