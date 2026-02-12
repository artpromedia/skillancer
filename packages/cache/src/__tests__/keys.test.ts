import { describe, it, expect } from 'vitest';

import { CacheKeys, CacheTags } from '../keys';

describe('CacheKeys', () => {
  describe('user keys', () => {
    it('should generate user key', () => {
      expect(CacheKeys.user('user123')).toBe('user:user123');
    });

    it('should generate user by email key (lowercase)', () => {
      expect(CacheKeys.userByEmail('Test@Example.com')).toBe('user:email:test@example.com');
    });

    it('should generate user sessions key', () => {
      expect(CacheKeys.userSessions('user123')).toBe('user:user123:sessions');
    });

    it('should generate user profile key', () => {
      expect(CacheKeys.userProfile('user123')).toBe('user:user123:profile');
    });

    it('should generate user permissions key', () => {
      expect(CacheKeys.userPermissions('user123')).toBe('user:user123:permissions');
    });
  });

  describe('market keys', () => {
    it('should generate job key', () => {
      expect(CacheKeys.job('job123')).toBe('market:job:job123');
    });

    it('should generate job bids key', () => {
      expect(CacheKeys.jobBids('job123')).toBe('market:job:job123:bids');
    });

    it('should generate job list key with filters', () => {
      expect(CacheKeys.jobList({ status: 'published', page: 1 })).toBe(
        'market:jobs:page=1&status=published'
      );
    });

    it('should generate job list key without filters', () => {
      expect(CacheKeys.jobList({})).toBe('market:jobs:all');
    });

    it('should generate job search key', () => {
      expect(CacheKeys.jobSearch('react developer', 1)).toBe('market:search:react%20developer:1');
    });
  });

  describe('system keys', () => {
    it('should generate rate limit key', () => {
      expect(CacheKeys.rateLimit('api', 'user123')).toBe('ratelimit:api:user123');
    });

    it('should generate rate limit by IP key', () => {
      expect(CacheKeys.rateLimitIp('192.168.1.1')).toBe('ratelimit:api:ip:192.168.1.1');
    });

    it('should generate feature flags key', () => {
      expect(CacheKeys.featureFlags()).toBe('features:production');
      expect(CacheKeys.featureFlags('staging')).toBe('features:staging');
    });

    it('should generate health status key', () => {
      expect(CacheKeys.healthStatus()).toBe('system:health');
    });
  });

  describe('session keys', () => {
    it('should generate session key', () => {
      expect(CacheKeys.session('sess123')).toBe('skillpod:session:sess123');
    });

    it('should generate active sessions key', () => {
      expect(CacheKeys.activeSessions('tenant123')).toBe(
        'skillpod:tenant:tenant123:sessions:active'
      );
    });
  });

  describe('tenant keys', () => {
    it('should generate tenant key', () => {
      expect(CacheKeys.tenant('tenant123')).toBe('tenant:tenant123');
    });

    it('should generate tenant settings key', () => {
      expect(CacheKeys.tenantSettings('tenant123')).toBe('tenant:tenant123:settings');
    });
  });
});

describe('CacheTags', () => {
  it('should generate user tag', () => {
    expect(CacheTags.users).toBe('tag:users');
    expect(CacheTags.user('123')).toBe('tag:user:123');
  });

  it('should generate job tag', () => {
    expect(CacheTags.jobs).toBe('tag:jobs');
    expect(CacheTags.job('456')).toBe('tag:job:456');
  });

  it('should generate tenant tag', () => {
    expect(CacheTags.tenants).toBe('tag:tenants');
    expect(CacheTags.tenant('789')).toBe('tag:tenant:789');
  });

  it('should generate feature tags', () => {
    expect(CacheTags.market).toBe('tag:market');
    expect(CacheTags.skillpod).toBe('tag:skillpod');
  });
});
