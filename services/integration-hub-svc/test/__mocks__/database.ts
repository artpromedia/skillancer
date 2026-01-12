import { vi } from 'vitest';

export const prisma = {
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  integrationType: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  workspaceIntegration: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  executiveWorkspace: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  integrationSyncLog: {
    create: vi.fn(),
    update: vi.fn(),
  },
};
