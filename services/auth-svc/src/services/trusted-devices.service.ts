/**
 * @module @skillancer/auth-svc/services/trusted-devices
 * Trusted Devices service for MFA bypass
 */

import crypto from 'crypto';

import { CacheService } from '@skillancer/cache';
import { prisma, type TrustedDevice } from '@skillancer/database';

import { getConfig } from '../config/index.js';
import { NotFoundError } from '../errors/index.js';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface TrustDeviceInfo {
  /** User agent string */
  userAgent: string;
  /** IP address of the device */
  ipAddress: string;
  /** Optional device name provided by user */
  deviceName?: string;
  /** Optional fingerprint from client-side detection */
  clientFingerprint?: string;
}

export interface TrustedDeviceResult {
  id: string;
  deviceName: string | null;
  deviceFingerprint: string;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  location: string | null;
  trustedAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

export interface TrustDeviceResult {
  /** The fingerprint acts as the device token for cookie storage */
  deviceToken: string;
  expiresAt: Date;
  device: TrustedDeviceResult;
}

export interface DeviceTrustVerification {
  trusted: boolean;
  device: TrustedDeviceResult | null;
  reason?: 'valid' | 'expired' | 'revoked' | 'not_found' | 'ip_mismatch';
}

// =============================================================================
// CACHE KEYS
// =============================================================================

const CacheKeys = {
  deviceTrust: (fingerprint: string) => `trusted_device:${fingerprint}`,
  userDevices: (userId: string) => `trusted_devices:user:${userId}`,
};

// =============================================================================
// TRUSTED DEVICES SERVICE
// =============================================================================

/**
 * Trusted Devices Service
 *
 * Manages device trust for MFA bypass functionality:
 * - Register trusted devices after successful MFA verification
 * - Verify device fingerprints to skip MFA
 * - Manage device list (view, revoke, rename)
 * - Handle device expiration and security policies
 */
export class TrustedDevicesService {
  private redis: Redis;
  private cache: CacheService;
  private config: ReturnType<typeof getConfig>['mfa'];

  constructor(redis: Redis) {
    this.redis = redis;
    this.cache = new CacheService(redis, 'trusted_devices');
    this.config = getConfig().mfa;
  }

  // ---------------------------------------------------------------------------
  // DEVICE FINGERPRINTING
  // ---------------------------------------------------------------------------

  /**
   * Generate a device fingerprint from device information
   */
  private generateDeviceFingerprint(deviceInfo: TrustDeviceInfo): string {
    // Combine various device attributes
    const fingerprintData = [
      deviceInfo.userAgent,
      deviceInfo.clientFingerprint || '',
      // We don't include IP in fingerprint as it can change
    ].join('|');

    // Hash to create consistent fingerprint
    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }

  /**
   * Parse user agent to extract browser name
   */
  private parseBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      return 'Chrome';
    } else if (userAgent.includes('Firefox')) {
      return 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      return 'Safari';
    } else if (userAgent.includes('Edg')) {
      return 'Edge';
    } else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
      return 'Internet Explorer';
    }
    return 'Unknown';
  }

  /**
   * Parse user agent to extract OS name
   */
  private parseOS(userAgent: string): string {
    if (userAgent.includes('Windows')) {
      return 'Windows';
    } else if (userAgent.includes('Mac OS')) {
      return 'macOS';
    } else if (userAgent.includes('Linux')) {
      return 'Linux';
    } else if (userAgent.includes('Android')) {
      return 'Android';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      return 'iOS';
    }
    return 'Unknown';
  }

  /**
   * Parse user agent to generate a friendly device name
   */
  private parseDeviceName(userAgent: string): string {
    const browser = this.parseBrowser(userAgent);
    const os = this.parseOS(userAgent);
    return `${browser} on ${os}`;
  }

  // ---------------------------------------------------------------------------
  // TRUST MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Trust a device after successful MFA verification
   */
  async trustDevice(
    userId: string,
    deviceInfo: TrustDeviceInfo,
    options: {
      trustDays?: number;
    } = {}
  ): Promise<TrustDeviceResult> {
    const trustDays = options.trustDays || 30;
    const fingerprint = this.generateDeviceFingerprint(deviceInfo);
    const expiresAt = new Date(Date.now() + trustDays * 24 * 60 * 60 * 1000);
    const deviceName = deviceInfo.deviceName || this.parseDeviceName(deviceInfo.userAgent);
    const browser = this.parseBrowser(deviceInfo.userAgent);
    const os = this.parseOS(deviceInfo.userAgent);

    // Check if this fingerprint already exists for user
    const existingDevice = await prisma.trustedDevice.findFirst({
      where: {
        userId,
        deviceFingerprint: fingerprint,
        revokedAt: null,
      },
    });

    let device: TrustedDevice;

    if (existingDevice) {
      // Update existing device trust
      device = await prisma.trustedDevice.update({
        where: { id: existingDevice.id },
        data: {
          expiresAt,
          lastUsedAt: new Date(),
          ipAddress: deviceInfo.ipAddress,
          browser,
          os,
        },
      });
    } else {
      // Create new trusted device
      device = await prisma.trustedDevice.create({
        data: {
          userId,
          deviceFingerprint: fingerprint,
          deviceName,
          browser,
          os,
          ipAddress: deviceInfo.ipAddress,
          expiresAt,
        },
      });
    }

    // Cache the device fingerprint for quick lookups
    await this.cacheDeviceFingerprint(userId, fingerprint, device);

    // Invalidate user devices cache
    await this.redis.del(CacheKeys.userDevices(userId));

    return {
      deviceToken: fingerprint, // Use fingerprint as the token
      expiresAt,
      device: this.formatDeviceResult(device, fingerprint),
    };
  }

  /**
   * Verify if a device fingerprint is valid and trusted
   */
  async verifyDeviceTrust(
    userId: string,
    deviceToken: string,
    deviceInfo: TrustDeviceInfo
  ): Promise<DeviceTrustVerification> {
    // The deviceToken is actually the fingerprint
    const fingerprint = deviceToken;

    // Check cache first
    const cacheKey = `${userId}:${fingerprint}`;
    const cachedData = await this.redis.get(CacheKeys.deviceTrust(cacheKey));

    let device: TrustedDevice | null = null;

    if (cachedData) {
      device = JSON.parse(cachedData) as TrustedDevice;
    } else {
      // Lookup in database
      device = await prisma.trustedDevice.findFirst({
        where: {
          userId,
          deviceFingerprint: fingerprint,
        },
      });

      if (device) {
        await this.cacheDeviceFingerprint(userId, fingerprint, device);
      }
    }

    if (!device) {
      return { trusted: false, device: null, reason: 'not_found' };
    }

    // Check if revoked
    if (device.revokedAt) {
      return {
        trusted: false,
        device: this.formatDeviceResult(device, fingerprint),
        reason: 'revoked',
      };
    }

    // Check if expired
    if (device.expiresAt && new Date(device.expiresAt) < new Date()) {
      return {
        trusted: false,
        device: this.formatDeviceResult(device, fingerprint),
        reason: 'expired',
      };
    }

    // Device is trusted - update last used
    await this.updateLastUsed(device.id, deviceInfo);

    return {
      trusted: true,
      device: this.formatDeviceResult(device, fingerprint),
      reason: 'valid',
    };
  }

  /**
   * Get all trusted devices for a user
   */
  async getUserDevices(
    userId: string,
    currentDeviceFingerprint?: string
  ): Promise<TrustedDeviceResult[]> {
    const devices = await prisma.trustedDevice.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return devices.map((d) => this.formatDeviceResult(d, currentDeviceFingerprint));
  }

  /**
   * Revoke a specific trusted device
   */
  async revokeDevice(userId: string, deviceId: string, reason?: string): Promise<void> {
    const device = await prisma.trustedDevice.findFirst({
      where: {
        id: deviceId,
        userId,
        revokedAt: null,
      },
    });

    if (!device) {
      throw new NotFoundError('Trusted device not found');
    }

    await prisma.trustedDevice.update({
      where: { id: deviceId },
      data: {
        revokedAt: new Date(),
        revokedReason: reason || 'User revoked',
      },
    });

    // Remove from cache
    const cacheKey = `${userId}:${device.deviceFingerprint}`;
    await this.redis.del(CacheKeys.deviceTrust(cacheKey));
    await this.redis.del(CacheKeys.userDevices(userId));
  }

  /**
   * Revoke all trusted devices for a user
   */
  async revokeAllDevices(userId: string, exceptDeviceId?: string): Promise<number> {
    const devices = await prisma.trustedDevice.findMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptDeviceId && { id: { not: exceptDeviceId } }),
      },
    });

    if (devices.length === 0) {
      return 0;
    }

    await prisma.trustedDevice.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptDeviceId && { id: { not: exceptDeviceId } }),
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'All devices revoked',
      },
    });

    // Remove all from cache
    const pipeline = this.redis.pipeline();
    for (const device of devices) {
      const cacheKey = `${userId}:${device.deviceFingerprint}`;
      pipeline.del(CacheKeys.deviceTrust(cacheKey));
    }
    pipeline.del(CacheKeys.userDevices(userId));
    await pipeline.exec();

    return devices.length;
  }

  /**
   * Rename a trusted device
   */
  async renameDevice(
    userId: string,
    deviceId: string,
    newName: string
  ): Promise<TrustedDeviceResult> {
    const device = await prisma.trustedDevice.findFirst({
      where: {
        id: deviceId,
        userId,
        revokedAt: null,
      },
    });

    if (!device) {
      throw new NotFoundError('Trusted device not found');
    }

    const updatedDevice = await prisma.trustedDevice.update({
      where: { id: deviceId },
      data: { deviceName: newName },
    });

    // Update cache
    await this.cacheDeviceFingerprint(userId, updatedDevice.deviceFingerprint, updatedDevice);
    await this.redis.del(CacheKeys.userDevices(userId));

    return this.formatDeviceResult(updatedDevice);
  }

  /**
   * Check if user has MFA bypass enabled (trusted devices setting)
   */
  async userHasTrustedDevicesEnabled(userId: string): Promise<boolean> {
    const mfaSettings = await prisma.userMfa.findUnique({
      where: { userId },
      select: { rememberDevices: true },
    });

    return mfaSettings?.rememberDevices ?? false;
  }

  /**
   * Update user's trusted devices preference
   */
  async updateTrustedDevicesPreference(userId: string, enabled: boolean): Promise<void> {
    await prisma.userMfa.update({
      where: { userId },
      data: { rememberDevices: enabled },
    });

    // If disabling, revoke all trusted devices
    if (!enabled) {
      await this.revokeAllDevices(userId);
    }
  }

  // ---------------------------------------------------------------------------
  // CLEANUP
  // ---------------------------------------------------------------------------

  /**
   * Clean up expired trusted devices (run periodically)
   */
  async cleanupExpiredDevices(): Promise<number> {
    const result = await prisma.trustedDevice.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'Expired',
      },
    });

    return result.count;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Cache device fingerprint for quick lookups
   */
  private async cacheDeviceFingerprint(
    userId: string,
    fingerprint: string,
    device: TrustedDevice
  ): Promise<void> {
    const ttl = device.expiresAt
      ? Math.floor((new Date(device.expiresAt).getTime() - Date.now()) / 1000)
      : 30 * 24 * 60 * 60; // 30 days default

    if (ttl > 0) {
      const cacheKey = `${userId}:${fingerprint}`;
      await this.redis.setex(CacheKeys.deviceTrust(cacheKey), ttl, JSON.stringify(device));
    }
  }

  /**
   * Update device last used timestamp
   */
  private updateLastUsed(deviceId: string, deviceInfo: TrustDeviceInfo): void {
    // Update asynchronously to not block verification
    prisma.trustedDevice
      .update({
        where: { id: deviceId },
        data: {
          lastUsedAt: new Date(),
          ipAddress: deviceInfo.ipAddress,
        },
      })
      .catch((err) => {
        console.error('Failed to update device last used:', err);
      });
  }

  /**
   * Format device for API response
   */
  private formatDeviceResult(
    device: TrustedDevice,
    currentDeviceFingerprint?: string
  ): TrustedDeviceResult {
    return {
      id: device.id,
      deviceName: device.deviceName,
      deviceFingerprint: device.deviceFingerprint.substring(0, 8) + '...', // Truncate for security
      browser: device.browser,
      os: device.os,
      ipAddress: device.ipAddress,
      location: device.location,
      trustedAt: device.trustedAt,
      lastUsedAt: device.lastUsedAt,
      expiresAt: device.expiresAt,
      isCurrent: currentDeviceFingerprint === device.deviceFingerprint,
    };
  }
}

// =============================================================================
// MODULE-LEVEL INSTANCE MANAGEMENT
// =============================================================================

let trustedDevicesServiceInstance: TrustedDevicesService | null = null;

/**
 * Initialize the TrustedDevicesService
 */
export function initializeTrustedDevicesService(redis: Redis): TrustedDevicesService {
  trustedDevicesServiceInstance = new TrustedDevicesService(redis);
  return trustedDevicesServiceInstance;
}

/**
 * Get the TrustedDevicesService instance
 */
export function getTrustedDevicesService(): TrustedDevicesService {
  if (!trustedDevicesServiceInstance) {
    throw new Error(
      'TrustedDevicesService not initialized. Call initializeTrustedDevicesService first.'
    );
  }
  return trustedDevicesServiceInstance;
}

/**
 * Reset the TrustedDevicesService instance (for testing)
 */
export function resetTrustedDevicesService(): void {
  trustedDevicesServiceInstance = null;
}

export default TrustedDevicesService;
