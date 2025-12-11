/**
 * @module @skillancer/auth-svc/__tests__/trusted-devices.service.test
 * Unit tests for Trusted Devices Service
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/unbound-method */

import { prisma } from '@skillancer/database';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

import {
  TrustedDevicesService,
  initializeTrustedDevicesService,
  getTrustedDevicesService,
  resetTrustedDevicesService,
  type TrustDeviceInfo,
} from '../services/trusted-devices.service.js';

// Mock dependencies
vi.mock('@skillancer/database', () => ({
  prisma: {
    trustedDevice: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    userMfa: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@skillancer/cache', () => ({
  CacheService: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  })),
}));

vi.mock('../config/index.js', () => ({
  getConfig: () => ({
    mfa: {},
  }),
}));

// =============================================================================
// TEST SETUP
// =============================================================================

interface MockRedis {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  pipeline: ReturnType<typeof vi.fn>;
}

describe('TrustedDevicesService', () => {
  let mockRedis: MockRedis;
  let service: TrustedDevicesService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetTrustedDevicesService();

    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      pipeline: vi.fn().mockReturnValue({
        del: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      }),
    };

    // Initialize the service with mock redis
    service = initializeTrustedDevicesService(mockRedis);
  });

  afterEach(() => {
    vi.resetAllMocks();
    resetTrustedDevicesService();
  });

  // ===========================================================================
  // TRUST DEVICE
  // ===========================================================================

  describe('trustDevice', () => {
    const deviceInfo: TrustDeviceInfo = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      ipAddress: '192.168.1.1',
      deviceName: 'My Laptop',
    };

    it('should trust a new device', async () => {
      const now = new Date();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      (prisma.trustedDevice.findFirst as Mock).mockResolvedValue(null);
      (prisma.trustedDevice.create as Mock).mockResolvedValue({
        id: 'device-123',
        userId: 'user-123',
        deviceFingerprint: 'fingerprint-hash',
        deviceName: 'My Laptop',
        browser: 'Chrome',
        os: 'Windows',
        ipAddress: deviceInfo.ipAddress,
        location: null,
        trustedAt: now,
        lastUsedAt: now,
        expiresAt,
        revokedAt: null,
        revokedReason: null,
        createdAt: now,
      });

      const result = await service.trustDevice('user-123', deviceInfo);

      expect(result).toHaveProperty('deviceToken');
      expect(result).toHaveProperty('expiresAt');
      expect(result.device).toHaveProperty('id', 'device-123');
      expect(result.device).toHaveProperty('deviceName', 'My Laptop');
      expect(prisma.trustedDevice.create).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should update existing trusted device', async () => {
      const now = new Date();
      const existingDevice = {
        id: 'device-123',
        userId: 'user-123',
        deviceFingerprint: 'fingerprint-hash',
        deviceName: 'Old Name',
        browser: 'Chrome',
        os: 'Windows',
        ipAddress: '192.168.1.100',
        location: null,
        trustedAt: now,
        lastUsedAt: now,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        revokedReason: null,
      };

      (prisma.trustedDevice.findFirst as Mock).mockResolvedValue(existingDevice);
      (prisma.trustedDevice.update as Mock).mockResolvedValue({
        ...existingDevice,
        lastUsedAt: new Date(),
        ipAddress: deviceInfo.ipAddress,
      });

      await service.trustDevice('user-123', deviceInfo);

      expect(prisma.trustedDevice.update).toHaveBeenCalled();
      expect(prisma.trustedDevice.create).not.toHaveBeenCalled();
    });

    it('should use custom trust duration', async () => {
      const now = new Date();
      (prisma.trustedDevice.findFirst as Mock).mockResolvedValue(null);
      (prisma.trustedDevice.create as Mock).mockImplementation(({ data }) => ({
        id: 'device-123',
        ...data,
        trustedAt: now,
        lastUsedAt: now,
        revokedAt: null,
      }));

      const result = await service.trustDevice('user-123', deviceInfo, {
        trustDays: 7,
      });

      const expiresAt = new Date(result.expiresAt);
      const diffDays = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBe(7);
    });
  });

  // ===========================================================================
  // VERIFY DEVICE TRUST
  // ===========================================================================

  describe('verifyDeviceTrust', () => {
    const deviceInfo: TrustDeviceInfo = {
      userAgent: 'Mozilla/5.0',
      ipAddress: '192.168.1.1',
    };

    it('should verify trusted device', async () => {
      const now = new Date();
      const device = {
        id: 'device-123',
        userId: 'user-123',
        deviceFingerprint: 'valid-fingerprint',
        deviceName: 'My Device',
        browser: 'Chrome',
        os: 'Windows',
        ipAddress: '192.168.1.1',
        location: null,
        trustedAt: now,
        lastUsedAt: now,
        expiresAt: new Date(Date.now() + 1000000),
        revokedAt: null,
        revokedReason: null,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(device));
      (prisma.trustedDevice.update as Mock).mockResolvedValue(device);

      const result = await service.verifyDeviceTrust('user-123', 'valid-fingerprint', deviceInfo);

      expect(result.trusted).toBe(true);
      expect(result.reason).toBe('valid');
      expect(result.device).not.toBeNull();
    });

    it('should return not found for unknown fingerprint', async () => {
      mockRedis.get.mockResolvedValue(null);
      (prisma.trustedDevice.findFirst as Mock).mockResolvedValue(null);

      const result = await service.verifyDeviceTrust('user-123', 'unknown-fingerprint', deviceInfo);

      expect(result.trusted).toBe(false);
      expect(result.reason).toBe('not_found');
    });

    it('should return revoked for revoked device', async () => {
      const device = {
        id: 'device-123',
        userId: 'user-123',
        deviceFingerprint: 'revoked-fingerprint',
        deviceName: 'My Device',
        browser: 'Chrome',
        os: 'Windows',
        ipAddress: '192.168.1.1',
        location: null,
        trustedAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000000),
        revokedAt: new Date(),
        revokedReason: 'User revoked',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(device));

      const result = await service.verifyDeviceTrust('user-123', 'revoked-fingerprint', deviceInfo);

      expect(result.trusted).toBe(false);
      expect(result.reason).toBe('revoked');
    });

    it('should return expired for expired device', async () => {
      const device = {
        id: 'device-123',
        userId: 'user-123',
        deviceFingerprint: 'expired-fingerprint',
        deviceName: 'My Device',
        browser: 'Chrome',
        os: 'Windows',
        ipAddress: '192.168.1.1',
        location: null,
        trustedAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired
        revokedAt: null,
        revokedReason: null,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(device));

      const result = await service.verifyDeviceTrust('user-123', 'expired-fingerprint', deviceInfo);

      expect(result.trusted).toBe(false);
      expect(result.reason).toBe('expired');
    });
  });

  // ===========================================================================
  // GET USER DEVICES
  // ===========================================================================

  describe('getUserDevices', () => {
    it('should return user devices', async () => {
      const now = new Date();
      const devices = [
        {
          id: 'device-1',
          userId: 'user-123',
          deviceFingerprint: 'fingerprint-1',
          deviceName: 'Device 1',
          browser: 'Chrome',
          os: 'Windows',
          ipAddress: '192.168.1.1',
          location: 'New York, US',
          trustedAt: now,
          lastUsedAt: now,
          expiresAt: new Date(Date.now() + 1000000),
          revokedAt: null,
        },
        {
          id: 'device-2',
          userId: 'user-123',
          deviceFingerprint: 'fingerprint-2',
          deviceName: 'Device 2',
          browser: 'Safari',
          os: 'macOS',
          ipAddress: '192.168.1.2',
          location: null,
          trustedAt: now,
          lastUsedAt: now,
          expiresAt: new Date(Date.now() + 1000000),
          revokedAt: null,
        },
      ];

      (prisma.trustedDevice.findMany as Mock).mockResolvedValue(devices);

      const result = await service.getUserDevices('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'device-1');
      expect(result[1]).toHaveProperty('id', 'device-2');
    });

    it('should mark current device', async () => {
      const now = new Date();
      const devices = [
        {
          id: 'device-1',
          userId: 'user-123',
          deviceFingerprint: 'current-fingerprint',
          deviceName: 'Device 1',
          browser: 'Chrome',
          os: 'Windows',
          ipAddress: '192.168.1.1',
          location: null,
          trustedAt: now,
          lastUsedAt: now,
          expiresAt: new Date(Date.now() + 1000000),
          revokedAt: null,
        },
      ];

      (prisma.trustedDevice.findMany as Mock).mockResolvedValue(devices);

      const result = await service.getUserDevices('user-123', 'current-fingerprint');

      expect(result[0]?.isCurrent).toBe(true);
    });
  });

  // ===========================================================================
  // REVOKE DEVICE
  // ===========================================================================

  describe('revokeDevice', () => {
    it('should revoke a trusted device', async () => {
      const device = {
        id: 'device-123',
        userId: 'user-123',
        deviceFingerprint: 'fingerprint',
        revokedAt: null,
      };

      (prisma.trustedDevice.findFirst as Mock).mockResolvedValue(device);
      (prisma.trustedDevice.update as Mock).mockResolvedValue({
        ...device,
        revokedAt: new Date(),
        revokedReason: 'User revoked',
      });

      await service.revokeDevice('user-123', 'device-123');

      expect(prisma.trustedDevice.update).toHaveBeenCalledWith({
        where: { id: 'device-123' },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          revokedReason: 'User revoked',
        }),
      });
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should throw error for non-existent device', async () => {
      (prisma.trustedDevice.findFirst as Mock).mockResolvedValue(null);

      await expect(service.revokeDevice('user-123', 'non-existent')).rejects.toThrow(
        'Trusted device not found'
      );
    });
  });

  // ===========================================================================
  // REVOKE ALL DEVICES
  // ===========================================================================

  describe('revokeAllDevices', () => {
    it('should revoke all devices for user', async () => {
      const devices = [
        { id: 'device-1', deviceFingerprint: 'fingerprint-1' },
        { id: 'device-2', deviceFingerprint: 'fingerprint-2' },
      ];

      (prisma.trustedDevice.findMany as Mock).mockResolvedValue(devices);
      (prisma.trustedDevice.updateMany as Mock).mockResolvedValue({ count: 2 });

      const result = await service.revokeAllDevices('user-123');

      expect(result).toBe(2);
      expect(prisma.trustedDevice.updateMany).toHaveBeenCalled();
    });

    it('should exclude specified device', async () => {
      const devices = [{ id: 'device-1', deviceFingerprint: 'fingerprint-1' }];

      (prisma.trustedDevice.findMany as Mock).mockResolvedValue(devices);
      (prisma.trustedDevice.updateMany as Mock).mockResolvedValue({ count: 1 });

      await service.revokeAllDevices('user-123', 'device-2');

      expect(prisma.trustedDevice.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123',
          revokedAt: null,
          id: { not: 'device-2' },
        }),
      });
    });
  });

  // ===========================================================================
  // RENAME DEVICE
  // ===========================================================================

  describe('renameDevice', () => {
    it('should rename a device', async () => {
      const now = new Date();
      const device = {
        id: 'device-123',
        userId: 'user-123',
        deviceFingerprint: 'fingerprint',
        deviceName: 'Old Name',
        browser: 'Chrome',
        os: 'Windows',
        ipAddress: '192.168.1.1',
        location: null,
        trustedAt: now,
        lastUsedAt: now,
        expiresAt: new Date(Date.now() + 1000000),
        revokedAt: null,
      };

      (prisma.trustedDevice.findFirst as Mock).mockResolvedValue(device);
      (prisma.trustedDevice.update as Mock).mockResolvedValue({
        ...device,
        deviceName: 'New Name',
      });

      const result = await service.renameDevice('user-123', 'device-123', 'New Name');

      expect(result.deviceName).toBe('New Name');
      expect(prisma.trustedDevice.update).toHaveBeenCalledWith({
        where: { id: 'device-123' },
        data: { deviceName: 'New Name' },
      });
    });
  });

  // ===========================================================================
  // MODULE-LEVEL FUNCTIONS
  // ===========================================================================

  describe('module-level functions', () => {
    it('should throw if service not initialized', () => {
      resetTrustedDevicesService();
      expect(() => getTrustedDevicesService()).toThrow('TrustedDevicesService not initialized');
    });

    it('should return initialized service', () => {
      const service = getTrustedDevicesService();
      expect(service).toBeInstanceOf(TrustedDevicesService);
    });
  });
});
