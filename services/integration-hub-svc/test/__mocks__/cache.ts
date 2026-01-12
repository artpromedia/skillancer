import { vi } from 'vitest';

export const cache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  has: vi.fn(),
  clear: vi.fn(),
};

export const createCache = vi.fn(() => cache);
