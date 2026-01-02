/**
 * Threat Detection Service
 *
 * Provides real-time threat detection including brute force detection,
 * impossible travel, IP reputation, device fingerprinting, and request analysis.
 */

import type { SecurityEventType } from '../audit/audit-schema';
import type { AuditService } from '../audit/audit-service';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

// ==================== Types ====================

export interface ThreatIndicator {
  type: ThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-100
  description: string;
  indicators: string[];
  recommendedAction: 'monitor' | 'challenge' | 'block' | 'alert';
}

export type ThreatType =
  | 'brute_force'
  | 'credential_stuffing'
  | 'account_takeover'
  | 'session_hijacking'
  | 'impossible_travel'
  | 'unusual_activity'
  | 'bot_activity'
  | 'api_abuse'
  | 'data_exfiltration'
  | 'privilege_escalation'
  | 'injection_attempt'
  | 'xss_attempt'
  | 'csrf_attempt';

export interface LoginAttempt {
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
  location?: {
    country: string;
    region: string;
    city: string;
    lat: number;
    lng: number;
  };
  deviceFingerprint?: string;
}

export interface RiskAssessment {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  recommendations: string[];
  requiresMFA: boolean;
  requiresVerification: boolean;
  shouldBlock: boolean;
}

export interface RiskFactor {
  type: string;
  weight: number;
  description: string;
  value?: any;
}

export interface IPReputation {
  ipAddress: string;
  score: number; // 0-100, higher is worse
  isVPN: boolean;
  isProxy: boolean;
  isTor: boolean;
  isDatacenter: boolean;
  isKnownAttacker: boolean;
  abuseReports: number;
  country: string;
  asn: string;
  organization: string;
}

export interface DeviceFingerprint {
  id: string;
  userId: string;
  fingerprint: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  firstSeen: Date;
  lastSeen: Date;
  trustScore: number;
  isVerified: boolean;
}

export interface RequestAnalysis {
  path: string;
  method: string;
  body?: string;
  query?: Record<string, string>;
  headers: Record<string, string>;
  ipAddress: string;
  userId?: string;
}

// Type aliases for compatibility
export type LoginRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface LoginRiskAnalysis {
  score: number;
  level: LoginRiskLevel;
  factors: RiskFactor[];
  recommendations: string[];
  requiresMFA: boolean;
  requiresVerification: boolean;
  shouldBlock: boolean;
  reasons: string[];
}

export interface BlockedIP {
  ipAddress: string;
  reason: string;
  blockedAt: Date;
  expiresAt?: Date;
  blockedBy?: string;
}

export interface KnownDevice {
  id: string;
  userId: string;
  fingerprint: string;
  userAgent: string;
  firstSeen: Date;
  lastSeen: Date;
  trustScore: number;
  isVerified: boolean;
}

export interface Logger {
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
  security?(meta: Record<string, any>): void;
}

// ==================== Threat Detection Service ====================

export class ThreatDetectionService {
  private readonly BRUTE_FORCE_THRESHOLD = 5;
  private readonly BRUTE_FORCE_WINDOW = 300; // 5 minutes
  private readonly RATE_LIMIT_WINDOW = 60; // 1 minute
  private readonly IMPOSSIBLE_TRAVEL_SPEED = 500; // km/h

  constructor(
    private redis: Redis,
    private alertQueue: Queue,
    private auditService: AuditService,
    private logger: Logger
  ) {}

  // ==================== Login Analysis ====================

  async analyzeLogin(attempt: LoginAttempt): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    let totalWeight = 0;

    // Check for brute force
    const bruteForceRisk = await this.checkBruteForce(attempt);
    if (bruteForceRisk) {
      factors.push(bruteForceRisk);
      totalWeight += bruteForceRisk.weight;
    }

    // Check IP reputation
    const ipRisk = await this.checkIPReputation(attempt.ipAddress);
    if (ipRisk) {
      factors.push(ipRisk);
      totalWeight += ipRisk.weight;
    }

    // Check for impossible travel
    if (attempt.userId && attempt.location) {
      const travelRisk = await this.checkImpossibleTravel(attempt.userId, attempt.location);
      if (travelRisk) {
        factors.push(travelRisk);
        totalWeight += travelRisk.weight;
      }
    }

    // Check device fingerprint
    if (attempt.userId && attempt.deviceFingerprint) {
      const deviceRisk = await this.checkDeviceFingerprint(
        attempt.userId,
        attempt.deviceFingerprint
      );
      if (deviceRisk) {
        factors.push(deviceRisk);
        totalWeight += deviceRisk.weight;
      }
    }

    // Check for unusual time
    const timeRisk = await this.checkUnusualTime(attempt);
    if (timeRisk) {
      factors.push(timeRisk);
      totalWeight += timeRisk.weight;
    }

    // Calculate final score
    const score = Math.min(100, totalWeight);
    const level = this.scoreToLevel(score);

    const assessment: RiskAssessment = {
      score,
      level,
      factors,
      recommendations: this.generateRecommendations(factors),
      requiresMFA: score >= 50,
      requiresVerification: score >= 70,
      shouldBlock: score >= 90,
    };

    // Log high-risk attempts
    if (score >= 70) {
      await this.logSecurityEvent(attempt, assessment);
    }

    return assessment;
  }

  private async checkBruteForce(attempt: LoginAttempt): Promise<RiskFactor | null> {
    const key = `bruteforce:${attempt.email || attempt.ipAddress}`;

    // Increment attempt counter
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, this.BRUTE_FORCE_WINDOW);
    }

    if (attempts >= this.BRUTE_FORCE_THRESHOLD) {
      // Trigger brute force alert
      await this.triggerAlert(
        {
          type: 'brute_force',
          severity: attempts >= 10 ? 'high' : 'medium',
          confidence: 90,
          description: `${attempts} failed login attempts in ${this.BRUTE_FORCE_WINDOW} seconds`,
          indicators: [attempt.email || '', attempt.ipAddress],
          recommendedAction: attempts >= 10 ? 'block' : 'challenge',
        },
        attempt
      );

      return {
        type: 'brute_force',
        weight: Math.min(50, attempts * 5),
        description: `${attempts} failed attempts detected`,
        value: attempts,
      };
    }

    return null;
  }

  private async checkIPReputation(ipAddress: string): Promise<RiskFactor | null> {
    // Check cache first
    const cached = await this.redis.get(`ip:reputation:${ipAddress}`);
    if (cached) {
      const reputation: IPReputation = JSON.parse(cached);
      return this.evaluateIPReputation(reputation);
    }

    // In production, this would call an IP reputation service
    const reputation = await this.fetchIPReputation(ipAddress);

    // Cache for 1 hour
    await this.redis.setex(`ip:reputation:${ipAddress}`, 3600, JSON.stringify(reputation));

    return this.evaluateIPReputation(reputation);
  }

  private async fetchIPReputation(ipAddress: string): Promise<IPReputation> {
    // This would integrate with services like MaxMind, IPQualityScore, etc.
    // Placeholder implementation for development

    // Check for known bad patterns
    const isPrivate = this.isPrivateIP(ipAddress);
    const isTor = await this.checkTorExitNode(ipAddress);

    return {
      ipAddress,
      score: isTor ? 80 : 0,
      isVPN: false,
      isProxy: false,
      isTor,
      isDatacenter: false,
      isKnownAttacker: false,
      abuseReports: 0,
      country: 'US',
      asn: 'AS12345',
      organization: isPrivate ? 'Private Network' : 'Example ISP',
    };
  }

  private isPrivateIP(ipAddress: string): boolean {
    const parts = ipAddress.split('.').map(Number);
    if (parts.length !== 4) return false;

    // Check private ranges
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;

    return false;
  }

  private async checkTorExitNode(ipAddress: string): Promise<boolean> {
    // In production, this would check against Tor exit node list
    // For now, return false
    const torKey = `tor:exit:${ipAddress}`;
    const isTor = await this.redis.get(torKey);
    return isTor === 'true';
  }

  private evaluateIPReputation(reputation: IPReputation): RiskFactor | null {
    let weight = 0;
    const indicators: string[] = [];

    if (reputation.isKnownAttacker) {
      weight += 80;
      indicators.push('known_attacker');
    }
    if (reputation.isTor) {
      weight += 40;
      indicators.push('tor_exit_node');
    }
    if (reputation.isProxy) {
      weight += 20;
      indicators.push('proxy');
    }
    if (reputation.isVPN) {
      weight += 10;
      indicators.push('vpn');
    }
    if (reputation.isDatacenter) {
      weight += 15;
      indicators.push('datacenter');
    }
    if (reputation.abuseReports > 0) {
      weight += Math.min(30, reputation.abuseReports * 5);
      indicators.push(`abuse_reports:${reputation.abuseReports}`);
    }

    if (weight > 0) {
      return {
        type: 'ip_reputation',
        weight: Math.min(80, weight),
        description: `IP has risk indicators: ${indicators.join(', ')}`,
        value: reputation,
      };
    }

    return null;
  }

  private async checkImpossibleTravel(
    userId: string,
    currentLocation: { country: string; region: string; city: string; lat: number; lng: number }
  ): Promise<RiskFactor | null> {
    const lastLocationKey = `user:lastlocation:${userId}`;
    const lastLocationData = await this.redis.get(lastLocationKey);

    if (lastLocationData) {
      const lastLocation = JSON.parse(lastLocationData);
      const timeDiff = (Date.now() - lastLocation.timestamp) / 1000 / 3600; // hours
      const distance = this.calculateDistance(
        lastLocation.lat,
        lastLocation.lng,
        currentLocation.lat,
        currentLocation.lng
      );

      const speed = timeDiff > 0 ? distance / timeDiff : 0; // km/h

      if (speed > this.IMPOSSIBLE_TRAVEL_SPEED) {
        await this.triggerAlert(
          {
            type: 'impossible_travel',
            severity: 'high',
            confidence: 85,
            description: `Travel from ${lastLocation.city} to ${currentLocation.city} at ${Math.round(speed)} km/h`,
            indicators: [userId, lastLocation.city, currentLocation.city],
            recommendedAction: 'challenge',
          },
          { userId, ipAddress: '', userAgent: '', success: false, timestamp: new Date() }
        );

        return {
          type: 'impossible_travel',
          weight: 60,
          description: `Impossible travel detected: ${Math.round(distance)}km in ${timeDiff.toFixed(1)} hours`,
          value: { distance, timeDiff, speed },
        };
      }
    }

    // Update last location
    await this.redis.setex(
      lastLocationKey,
      86400,
      JSON.stringify({
        ...currentLocation,
        timestamp: Date.now(),
      })
    );

    return null;
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private async checkDeviceFingerprint(
    userId: string,
    fingerprint: string
  ): Promise<RiskFactor | null> {
    const knownDevicesKey = `user:devices:${userId}`;
    const knownDevices = await this.redis.smembers(knownDevicesKey);

    if (knownDevices.length > 0 && !knownDevices.includes(fingerprint)) {
      // New device detected
      const deviceCount = knownDevices.length;

      if (deviceCount >= 5) {
        return {
          type: 'unknown_device',
          weight: 30,
          description: 'Login from unrecognized device (user has many devices)',
          value: { fingerprint, knownDeviceCount: deviceCount },
        };
      }

      return {
        type: 'new_device',
        weight: 15,
        description: 'Login from new device',
        value: { fingerprint },
      };
    }

    // Add device to known devices
    await this.redis.sadd(knownDevicesKey, fingerprint);
    await this.redis.expire(knownDevicesKey, 90 * 24 * 3600); // 90 days

    return null;
  }

  private async checkUnusualTime(attempt: LoginAttempt): Promise<RiskFactor | null> {
    if (!attempt.userId) return null;

    const hour = attempt.timestamp.getHours();
    const historyKey = `user:loginhours:${attempt.userId}`;

    // Get login hour history
    const history = await this.redis.get(historyKey);
    const hourCounts: number[] = history ? JSON.parse(history) : new Array(24).fill(0);

    const totalLogins = hourCounts.reduce((a, b) => a + b, 0);

    if (totalLogins > 10) {
      const hourPercentage = (hourCounts[hour] / totalLogins) * 100;

      if (hourPercentage < 5) {
        return {
          type: 'unusual_time',
          weight: 15,
          description: `Login at unusual hour (${hour}:00)`,
          value: { hour, percentage: hourPercentage },
        };
      }
    }

    // Update history
    hourCounts[hour]++;
    await this.redis.setex(historyKey, 90 * 24 * 3600, JSON.stringify(hourCounts));

    return null;
  }

  private scoreToLevel(score: number): RiskAssessment['level'] {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private generateRecommendations(factors: RiskFactor[]): string[] {
    const recommendations: string[] = [];

    for (const factor of factors) {
      switch (factor.type) {
        case 'brute_force':
          recommendations.push('Implement account lockout');
          recommendations.push('Enable CAPTCHA');
          break;
        case 'ip_reputation':
          recommendations.push('Consider blocking or challenging this IP');
          break;
        case 'impossible_travel':
          recommendations.push('Require identity verification');
          recommendations.push('Force password reset');
          break;
        case 'unknown_device':
        case 'new_device':
          recommendations.push('Require MFA');
          recommendations.push('Send device verification email');
          break;
        case 'unusual_time':
          recommendations.push('Consider additional verification');
          break;
      }
    }

    return [...new Set(recommendations)];
  }

  // ==================== Request Analysis ====================

  async analyzeRequest(
    request: RequestAnalysis
  ): Promise<{ threats: ThreatIndicator[]; shouldBlock: boolean }> {
    const threats: ThreatIndicator[] = [];

    // Check for injection attempts
    const injectionThreat = this.detectInjection(request.body, request.query);
    if (injectionThreat) threats.push(injectionThreat);

    // Check for XSS attempts
    const xssThreat = this.detectXSS(request.body, request.query);
    if (xssThreat) threats.push(xssThreat);

    // Check rate limiting
    const rateLimitThreat = await this.checkRateLimit(request.ipAddress, request.path);
    if (rateLimitThreat) threats.push(rateLimitThreat);

    // Check for API abuse patterns
    const abuseThreat = await this.detectAPIAbuse(request);
    if (abuseThreat) threats.push(abuseThreat);

    const shouldBlock = threats.some((t) => t.recommendedAction === 'block');

    // Log threats
    for (const threat of threats) {
      if (threat.severity === 'high' || threat.severity === 'critical') {
        await this.auditService.logSecurityAlert(
          threat.type as SecurityEventType,
          threat.severity as 'medium' | 'high' | 'critical',
          {
            type: request.userId ? 'user' : 'anonymous',
            id: request.userId,
            ipAddress: request.ipAddress,
            userAgent: request.headers['user-agent'],
          },
          {
            indicators: threat.indicators,
            metadata: {
              path: request.path,
              method: request.method,
              threat,
            },
          }
        );
      }
    }

    return { threats, shouldBlock };
  }

  private detectInjection(body?: string, query?: Record<string, string>): ThreatIndicator | null {
    const patterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b.*\b(FROM|INTO|TABLE|WHERE)\b)/i,
      /(\bOR\b\s+[\d\w]+\s*=\s*[\d\w]+)/i,
      /(--|#|\/\*)/,
      /(\bEXEC\b|\bEXECUTE\b)/i,
      /(\bxp_\w+)/i,
      /(;\s*(DELETE|DROP|UPDATE|INSERT))/i,
      /('\s*OR\s*'.*'\s*=\s*')/i,
    ];

    const checkValue = (value: string): boolean => {
      return patterns.some((pattern) => pattern.test(value));
    };

    const suspicious: string[] = [];

    if (body && checkValue(body)) {
      suspicious.push('request_body');
    }

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (checkValue(value)) {
          suspicious.push(`query_param:${key}`);
        }
      }
    }

    if (suspicious.length > 0) {
      return {
        type: 'injection_attempt',
        severity: 'high',
        confidence: 80,
        description: 'Potential SQL injection attempt detected',
        indicators: suspicious,
        recommendedAction: 'block',
      };
    }

    return null;
  }

  private detectXSS(body?: string, query?: Record<string, string>): ThreatIndicator | null {
    const patterns = [
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<\s*img[^>]+onerror\s*=/gi,
      /<\s*svg[^>]+onload\s*=/gi,
      /eval\s*\(/gi,
      /document\.(cookie|location|write)/gi,
      /<\s*iframe/gi,
      /<\s*object/gi,
      /<\s*embed/gi,
    ];

    const checkValue = (value: string): boolean => {
      return patterns.some((pattern) => pattern.test(value));
    };

    const suspicious: string[] = [];

    if (body && checkValue(body)) {
      suspicious.push('request_body');
    }

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (checkValue(value)) {
          suspicious.push(`query_param:${key}`);
        }
      }
    }

    if (suspicious.length > 0) {
      return {
        type: 'xss_attempt',
        severity: 'high',
        confidence: 85,
        description: 'Potential XSS attack detected',
        indicators: suspicious,
        recommendedAction: 'block',
      };
    }

    return null;
  }

  private async checkRateLimit(ipAddress: string, path: string): Promise<ThreatIndicator | null> {
    const key = `ratelimit:${ipAddress}:${path}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, this.RATE_LIMIT_WINDOW);
    }

    // Different limits for different endpoints
    const limits: Record<string, number> = {
      '/api/auth/login': 10,
      '/api/auth/register': 5,
      '/api/auth/password-reset': 3,
      '/api/auth/verify': 5,
      default: 100,
    };

    const limit = limits[path] || limits['default'];

    if (count > limit * 2) {
      return {
        type: 'api_abuse',
        severity: 'high',
        confidence: 95,
        description: `Rate limit exceeded: ${count} requests in ${this.RATE_LIMIT_WINDOW}s (limit: ${limit})`,
        indicators: [ipAddress, path],
        recommendedAction: 'block',
      };
    }

    if (count > limit) {
      return {
        type: 'api_abuse',
        severity: 'medium',
        confidence: 90,
        description: `Rate limit exceeded: ${count} requests in ${this.RATE_LIMIT_WINDOW}s (limit: ${limit})`,
        indicators: [ipAddress, path],
        recommendedAction: 'challenge',
      };
    }

    return null;
  }

  private async detectAPIAbuse(request: RequestAnalysis): Promise<ThreatIndicator | null> {
    // Check for enumeration attempts
    if (request.path.match(/\/api\/users\/\d+/) && request.method === 'GET') {
      const key = `enumeration:${request.ipAddress}:users`;
      const count = await this.redis.incr(key);

      if (count === 1) {
        await this.redis.expire(key, 60);
      }

      if (count > 20) {
        return {
          type: 'data_exfiltration',
          severity: 'high',
          confidence: 75,
          description: 'Possible user enumeration attempt',
          indicators: [request.ipAddress, 'user_enumeration'],
          recommendedAction: 'block',
        };
      }
    }

    // Check for excessive data access
    if (request.path.includes('/export') || request.path.includes('/bulk')) {
      const key = `bulk_access:${request.userId || request.ipAddress}`;
      const count = await this.redis.incr(key);

      if (count === 1) {
        await this.redis.expire(key, 3600); // 1 hour
      }

      if (count > 10) {
        return {
          type: 'data_exfiltration',
          severity: 'medium',
          confidence: 70,
          description: 'Excessive bulk data access detected',
          indicators: [request.ipAddress, 'bulk_access'],
          recommendedAction: 'alert',
        };
      }
    }

    return null;
  }

  // ==================== Alert Management ====================

  private async triggerAlert(threat: ThreatIndicator, context: LoginAttempt): Promise<void> {
    await this.alertQueue.add('security-alert', {
      threat,
      context,
      timestamp: new Date().toISOString(),
    });

    if (this.logger.security) {
      this.logger.security({
        type: threat.type,
        severity: threat.severity,
        description: threat.description,
        indicators: threat.indicators,
        action: threat.recommendedAction,
      });
    } else {
      this.logger.warn('Security threat detected', {
        type: threat.type,
        severity: threat.severity,
        description: threat.description,
      });
    }
  }

  private async logSecurityEvent(attempt: LoginAttempt, assessment: RiskAssessment): Promise<void> {
    await this.auditService.logSecurityAlert(
      'suspicious_activity',
      assessment.level === 'critical' ? 'critical' : 'high',
      {
        type: attempt.userId ? 'user' : 'anonymous',
        id: attempt.userId,
        email: attempt.email,
        ipAddress: attempt.ipAddress,
        userAgent: attempt.userAgent,
      },
      {
        indicators: assessment.factors.map((f) => f.type),
        metadata: {
          riskScore: assessment.score,
          factors: assessment.factors,
        },
      }
    );
  }

  // ==================== IP Blocking ====================

  async blockIP(
    ipAddress: string,
    reason: string,
    duration: number,
    adminUserId?: string
  ): Promise<void> {
    const key = `blocked:ip:${ipAddress}`;
    await this.redis.setex(
      key,
      duration,
      JSON.stringify({
        reason,
        blockedAt: new Date().toISOString(),
        blockedBy: adminUserId,
        expiresAt: new Date(Date.now() + duration * 1000).toISOString(),
      })
    );

    await this.auditService.logAuthorization(
      'ip_blocked',
      true,
      {
        type: adminUserId ? 'admin' : 'system',
        id: adminUserId,
        ipAddress: 'system',
      },
      {
        type: 'ip_address',
        id: ipAddress,
      },
      { reason, duration }
    );
  }

  async unblockIP(ipAddress: string, adminUserId: string): Promise<void> {
    const key = `blocked:ip:${ipAddress}`;
    await this.redis.del(key);

    await this.auditService.logAuthorization(
      'ip_unblocked',
      true,
      {
        type: 'admin',
        id: adminUserId,
        ipAddress: 'system',
      },
      {
        type: 'ip_address',
        id: ipAddress,
      }
    );
  }

  async isIPBlocked(ipAddress: string): Promise<boolean> {
    const key = `blocked:ip:${ipAddress}`;
    const blocked = await this.redis.exists(key);
    return blocked === 1;
  }

  async getBlockedIPs(): Promise<
    {
      ipAddress: string;
      reason: string;
      blockedAt: Date;
      expiresAt: Date;
      blockedBy?: string;
    }[]
  > {
    const keys = await this.redis.keys('blocked:ip:*');
    const blocked = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        blocked.push({
          ipAddress: key.replace('blocked:ip:', ''),
          reason: parsed.reason,
          blockedAt: new Date(parsed.blockedAt),
          expiresAt: new Date(parsed.expiresAt),
          blockedBy: parsed.blockedBy,
        });
      }
    }

    return blocked;
  }

  // ==================== Device Management ====================

  async getKnownDevices(userId: string): Promise<string[]> {
    const key = `user:devices:${userId}`;
    return this.redis.smembers(key);
  }

  async removeDevice(userId: string, fingerprint: string): Promise<void> {
    const key = `user:devices:${userId}`;
    await this.redis.srem(key, fingerprint);
  }

  async clearAllDevices(userId: string): Promise<void> {
    const key = `user:devices:${userId}`;
    await this.redis.del(key);
  }

  // ==================== Statistics ====================

  async getThreatStats(_hours: number = 24): Promise<{
    blockedIPs: number;
    bruteForceAttempts: number;
    injectionAttempts: number;
    xssAttempts: number;
  }> {
    const blockedIPs = (await this.redis.keys('blocked:ip:*')).length;
    const bruteForceKeys = await this.redis.keys('bruteforce:*');
    const bruteForceAttempts = bruteForceKeys.length;

    // These would need to be tracked separately
    return {
      blockedIPs,
      bruteForceAttempts,
      injectionAttempts: 0,
      xssAttempts: 0,
    };
  }
}

export default ThreatDetectionService;
