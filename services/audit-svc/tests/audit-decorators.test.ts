/**
 * @module @skillancer/audit-svc/tests/audit-decorators.test
 * Unit tests for audit decorators
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the audit log service
vi.mock('../src/services/audit-log.service.js', () => ({
  queueAuditLog: vi.fn().mockResolvedValue('job-123'),
}));

import {
  Audited,
  AuditDataChange,
  AuditAccess,
  AuditSecurity,
  setAuditContext,
  getAuditContext,
  clearAuditContext,
} from '../src/decorators/audit.decorators.js';
import { queueAuditLog } from '../src/services/audit-log.service.js';
import { AuditCategory, ActorType } from '../src/types/index.js';

describe('Audit Decorators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Audit Context', () => {
    it('should set and get audit context', () => {
      const context = {
        actorId: 'user-123',
        actorType: ActorType.USER,
        ipAddress: '192.168.1.1',
      };

      setAuditContext('corr-123', context);
      const retrieved = getAuditContext('corr-123');

      expect(retrieved).toEqual(context);
    });

    it('should clear audit context', () => {
      setAuditContext('corr-456', { actorId: 'user-456' });
      clearAuditContext('corr-456');

      const retrieved = getAuditContext('corr-456');
      expect(retrieved).toBeUndefined();
    });

    it('should return undefined for non-existent context', () => {
      const retrieved = getAuditContext('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('@Audited decorator', () => {
    it('should log successful method calls', async () => {
      class TestService {
        @Audited({
          eventType: 'TEST_ACTION',
          category: AuditCategory.DATA_MODIFICATION,
          action: 'Performed test action',
          resourceType: 'test',
          resourceIdParam: 0,
        })
        async doSomething(resourceId: string): Promise<{ id: string; name: string }> {
          return { id: resourceId, name: 'Test' };
        }
      }

      const service = new TestService();
      const result = await service.doSomething('res-123');

      expect(result).toEqual({ id: 'res-123', name: 'Test' });

      // Wait for async audit logging
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(queueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TEST_ACTION',
          eventCategory: AuditCategory.DATA_MODIFICATION,
          action: 'Performed test action',
          resource: expect.objectContaining({
            type: 'test',
            id: 'res-123',
          }),
          outcome: expect.objectContaining({
            status: 'SUCCESS',
          }),
        })
      );
    });

    it('should log failed method calls', async () => {
      class TestService {
        @Audited({
          eventType: 'FAILING_ACTION',
          category: AuditCategory.DATA_MODIFICATION,
          action: 'Failed action',
          resourceType: 'test',
        })
        async failingMethod(): Promise<void> {
          throw new Error('Something went wrong');
        }
      }

      const service = new TestService();

      await expect(service.failingMethod()).rejects.toThrow('Something went wrong');

      // Wait for async audit logging
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(queueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'FAILING_ACTION',
          outcome: expect.objectContaining({
            status: 'FAILURE',
            errorMessage: 'Something went wrong',
          }),
        })
      );
    });

    it('should capture result when configured', async () => {
      class TestService {
        @Audited({
          eventType: 'CREATE_ITEM',
          category: AuditCategory.DATA_MODIFICATION,
          action: 'Created item',
          resourceType: 'item',
          resourceIdFromResult: 'id',
          captureResult: true,
        })
        async createItem(data: { name: string }): Promise<{ id: string; name: string }> {
          return { id: 'new-id-123', name: data.name };
        }
      }

      const service = new TestService();
      await service.createItem({ name: 'Test Item' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(queueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: expect.objectContaining({
            id: 'new-id-123',
          }),
          changes: expect.objectContaining({
            after: expect.objectContaining({
              name: 'Test Item',
            }),
          }),
        })
      );
    });

    it('should respect condition function', async () => {
      class TestService {
        @Audited({
          eventType: 'CONDITIONAL_ACTION',
          category: AuditCategory.DATA_ACCESS,
          action: 'Conditional action',
          resourceType: 'test',
          condition: (_args, result) => (result as { shouldLog: boolean })?.shouldLog === true,
        })
        async conditionalMethod(shouldLog: boolean): Promise<{ shouldLog: boolean }> {
          return { shouldLog };
        }
      }

      const service = new TestService();

      // This should NOT be logged
      await service.conditionalMethod(false);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(queueAuditLog).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // This SHOULD be logged
      await service.conditionalMethod(true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(queueAuditLog).toHaveBeenCalled();
    });
  });

  describe('@AuditDataChange decorator', () => {
    it('should capture before and after state', async () => {
      const mockGetCurrentState = vi.fn().mockResolvedValue({
        name: 'Old Name',
        status: 'active',
      });

      class TestService {
        @AuditDataChange({
          eventType: 'ITEM_UPDATED',
          category: AuditCategory.DATA_MODIFICATION,
          action: 'Updated item',
          resourceType: 'item',
          resourceIdParam: 0,
          getCurrentState: mockGetCurrentState,
        })
        async updateItem(
          id: string,
          updates: { name: string }
        ): Promise<{ id: string; name: string; status: string }> {
          return { id, name: updates.name, status: 'active' };
        }
      }

      const service = new TestService();
      await service.updateItem('item-123', { name: 'New Name' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockGetCurrentState).toHaveBeenCalled();
      expect(queueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ITEM_UPDATED',
          changes: expect.objectContaining({
            before: expect.objectContaining({
              name: 'Old Name',
            }),
            after: expect.objectContaining({
              name: 'New Name',
            }),
            diff: expect.arrayContaining([
              expect.objectContaining({
                field: 'name',
                oldValue: 'Old Name',
                newValue: 'New Name',
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('@AuditAccess decorator', () => {
    it('should use ACCESS category automatically', async () => {
      class TestService {
        @AuditAccess({
          eventType: 'DATA_VIEWED',
          resourceType: 'sensitive-data',
          resourceIdParam: 0,
        })
        async viewData(id: string): Promise<{ data: string }> {
          return { data: 'sensitive info' };
        }
      }

      const service = new TestService();
      await service.viewData('data-123');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(queueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventCategory: AuditCategory.ACCESS,
          action: expect.stringContaining('sensitive-data'),
        })
      );
    });
  });

  describe('@AuditSecurity decorator', () => {
    it('should use SECURITY category and EXTENDED retention', async () => {
      class TestService {
        @AuditSecurity({
          eventType: 'PASSWORD_CHANGED',
          action: 'Changed password',
          resourceType: 'user',
          resourceIdParam: 0,
        })
        async changePassword(userId: string): Promise<void> {
          // Password change logic
        }
      }

      const service = new TestService();
      await service.changePassword('user-123');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(queueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventCategory: AuditCategory.SECURITY,
          retentionPolicy: 'EXTENDED',
          complianceTags: expect.arrayContaining(['SECURITY']),
        })
      );
    });
  });
});
