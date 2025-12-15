/**
 * @module @skillancer/audit-svc/tests/audit-compliance.service.test
 * Unit tests for compliance service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../src/repositories/audit-log.repository.js', () => ({
  countAuditLogs: vi.fn(),
  countUniqueActors: vi.fn(),
  countUniqueResources: vi.fn(),
  aggregateByCategory: vi.fn(),
  findAuditLogs: vi.fn(),
  anonymizeActorData: vi.fn(),
  countByRetentionPolicy: vi.fn(),
  getOldestLogByPolicy: vi.fn(),
  getNewestLogByPolicy: vi.fn(),
}));

vi.mock('../src/services/audit-query.service.js', () => ({
  searchAuditLogs: vi.fn(),
  getComplianceReport: vi.fn(),
}));

import {
  generateFullComplianceReport,
  generateDsarReport,
  anonymizeUserAuditData,
  getRetentionPolicySummary,
} from '../src/services/audit-compliance.service.js';
import * as repo from '../src/repositories/audit-log.repository.js';
import * as queryService from '../src/services/audit-query.service.js';

describe('Audit Compliance Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateFullComplianceReport', () => {
    it('should generate a comprehensive compliance report', async () => {
      // Setup mocks
      vi.mocked(queryService.getComplianceReport).mockResolvedValue({
        tag: 'GDPR',
        period: { start: new Date(), end: new Date() },
        totalEvents: 1000,
        eventsByCategory: { DATA_ACCESS: 500, DATA_MODIFICATION: 500 },
        eventsByOutcome: { SUCCESS: 950, FAILURE: 50 },
        generatedAt: new Date(),
      });

      vi.mocked(repo.countAuditLogs).mockImplementation(async (filters) => {
        if ((filters as { outcomeStatus?: string }).outcomeStatus === 'SUCCESS') return 950;
        if ((filters as { outcomeStatus?: string }).outcomeStatus === 'FAILURE') return 50;
        return 1000;
      });

      vi.mocked(repo.countUniqueActors).mockResolvedValue(100);
      vi.mocked(repo.countUniqueResources).mockResolvedValue(500);
      vi.mocked(repo.aggregateByCategory).mockResolvedValue([
        { _id: 'DATA_ACCESS', count: 500 },
        { _id: 'DATA_MODIFICATION', count: 500 },
      ]);

      vi.mocked(queryService.searchAuditLogs).mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
        filters: {},
      });

      const report = await generateFullComplianceReport('GDPR', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(report.tag).toBe('GDPR');
      expect(report.summary.totalEvents).toBe(1000);
      expect(report.summary.successfulEvents).toBe(950);
      expect(report.summary.failedEvents).toBe(50);
      expect(report.summary.uniqueActors).toBe(100);
      expect(report.summary.uniqueResources).toBe(500);
      expect(report.summary.complianceScore).toBe(95);
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should include violations when requested', async () => {
      vi.mocked(queryService.getComplianceReport).mockResolvedValue({
        tag: 'SOC2',
        period: { start: new Date(), end: new Date() },
        totalEvents: 100,
        eventsByCategory: {},
        eventsByOutcome: {},
        generatedAt: new Date(),
      });

      vi.mocked(repo.countAuditLogs).mockImplementation(async (filters) => {
        if ((filters as { outcomeStatus?: string }).outcomeStatus === 'SUCCESS') return 90;
        if ((filters as { outcomeStatus?: string }).outcomeStatus === 'FAILURE') return 10;
        return 100;
      });

      vi.mocked(repo.countUniqueActors).mockResolvedValue(10);
      vi.mocked(repo.countUniqueResources).mockResolvedValue(20);
      vi.mocked(repo.aggregateByCategory).mockResolvedValue([]);

      // Mock failed events for violations
      vi.mocked(queryService.searchAuditLogs).mockResolvedValue({
        data: [
          {
            id: 'log-1',
            timestamp: new Date(),
            eventType: 'UNAUTHORIZED_ACCESS',
            eventCategory: 'SECURITY',
            action: 'Unauthorized access attempt',
            resource: { type: 'user', id: 'user-123' },
            actor: { id: 'attacker', type: 'ANONYMOUS' },
            outcome: {
              status: 'FAILURE',
              errorCode: 'UNAUTHORIZED',
              errorMessage: 'Access denied',
            },
          },
        ] as never[],
        pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
        filters: {},
      });

      const report = await generateFullComplianceReport('SOC2', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        includeViolations: true,
      });

      expect(report.violations).toBeDefined();
      expect(report.violations!.length).toBeGreaterThan(0);
    });

    it('should not include breakdowns when disabled', async () => {
      vi.mocked(queryService.getComplianceReport).mockResolvedValue({
        tag: 'HIPAA',
        period: { start: new Date(), end: new Date() },
        totalEvents: 50,
        eventsByCategory: {},
        eventsByOutcome: {},
        generatedAt: new Date(),
      });

      vi.mocked(repo.countAuditLogs).mockResolvedValue(50);
      vi.mocked(repo.countUniqueActors).mockResolvedValue(5);
      vi.mocked(repo.countUniqueResources).mockResolvedValue(10);
      vi.mocked(repo.aggregateByCategory).mockResolvedValue([]);
      vi.mocked(queryService.searchAuditLogs).mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
        filters: {},
      });

      const report = await generateFullComplianceReport('HIPAA', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        includeBreakdowns: false,
      });

      expect(report.breakdowns).toBeUndefined();
    });
  });

  describe('generateDsarReport', () => {
    it('should generate a DSAR report for a user', async () => {
      vi.mocked(queryService.searchAuditLogs).mockResolvedValue({
        data: [
          {
            id: 'log-1',
            timestamp: new Date('2024-01-15'),
            eventType: 'LOGIN_SUCCESS',
            eventCategory: 'AUTHENTICATION',
            action: 'User logged in',
            resource: { type: 'session', id: 'sess-123' },
            actor: { id: 'user-123', type: 'USER' },
            outcome: { status: 'SUCCESS' },
            request: { ipAddress: '192.168.1.1' },
          },
          {
            id: 'log-2',
            timestamp: new Date('2024-01-16'),
            eventType: 'PROFILE_UPDATED',
            eventCategory: 'USER_MANAGEMENT',
            action: 'Updated profile',
            resource: { type: 'user', id: 'user-123' },
            actor: { id: 'user-123', type: 'USER' },
            outcome: { status: 'SUCCESS' },
          },
        ] as never[],
        pagination: { page: 1, pageSize: 10000, total: 2, totalPages: 1 },
        filters: {},
      });

      const report = await generateDsarReport('user-123');

      expect(report.userId).toBe('user-123');
      expect(report.totalLogs).toBe(2);
      expect(report.dataCategories).toContain('AUTHENTICATION');
      expect(report.dataCategories).toContain('USER_MANAGEMENT');
      expect(report.logs.length).toBe(2);
    });

    it('should include metadata when requested', async () => {
      vi.mocked(queryService.searchAuditLogs).mockResolvedValue({
        data: [
          {
            id: 'log-1',
            timestamp: new Date('2024-01-15'),
            eventType: 'LOGIN_SUCCESS',
            eventCategory: 'AUTHENTICATION',
            action: 'User logged in',
            resource: { type: 'session', id: 'sess-123' },
            actor: { id: 'user-456', type: 'USER' },
            outcome: { status: 'SUCCESS' },
            request: { ipAddress: '10.0.0.1' },
          },
        ] as never[],
        pagination: { page: 1, pageSize: 10000, total: 1, totalPages: 1 },
        filters: {},
      });

      const report = await generateDsarReport('user-456', { includeMetadata: true });

      expect(report.logs[0].ipAddress).toBe('10.0.0.1');
    });

    it('should not include metadata by default', async () => {
      vi.mocked(queryService.searchAuditLogs).mockResolvedValue({
        data: [
          {
            id: 'log-1',
            timestamp: new Date('2024-01-15'),
            eventType: 'LOGIN_SUCCESS',
            eventCategory: 'AUTHENTICATION',
            action: 'User logged in',
            resource: { type: 'session', id: 'sess-123' },
            actor: { id: 'user-789', type: 'USER' },
            outcome: { status: 'SUCCESS' },
            request: { ipAddress: '10.0.0.2' },
          },
        ] as never[],
        pagination: { page: 1, pageSize: 10000, total: 1, totalPages: 1 },
        filters: {},
      });

      const report = await generateDsarReport('user-789');

      expect(report.logs[0].ipAddress).toBeUndefined();
    });
  });

  describe('anonymizeUserAuditData', () => {
    it('should anonymize user data and return count', async () => {
      vi.mocked(repo.anonymizeActorData).mockResolvedValue(42);

      const result = await anonymizeUserAuditData('user-to-delete');

      expect(repo.anonymizeActorData).toHaveBeenCalledWith('user-to-delete');
      expect(result.anonymizedCount).toBe(42);
    });
  });

  describe('getRetentionPolicySummary', () => {
    it('should return summary of all retention policies', async () => {
      vi.mocked(repo.countByRetentionPolicy).mockImplementation(async (policy) => {
        const counts: Record<string, number> = {
          SHORT: 100,
          STANDARD: 500,
          EXTENDED: 200,
          PERMANENT: 50,
        };
        return counts[policy] ?? 0;
      });

      vi.mocked(repo.getOldestLogByPolicy).mockResolvedValue(new Date('2023-01-01'));
      vi.mocked(repo.getNewestLogByPolicy).mockResolvedValue(new Date('2024-01-01'));

      const summary = await getRetentionPolicySummary();

      expect(summary.totalLogs).toBe(850);
      expect(summary.policies.length).toBe(4);
      expect(summary.policies.find((p) => p.policy === 'SHORT')?.count).toBe(100);
      expect(summary.policies.find((p) => p.policy === 'STANDARD')?.count).toBe(500);
    });
  });
});
