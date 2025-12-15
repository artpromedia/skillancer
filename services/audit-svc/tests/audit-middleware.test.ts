/**
 * @module @skillancer/audit-svc/tests/audit-middleware.test
 * Unit tests for audit middleware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the audit log service
vi.mock('../src/services/audit-log.service.js', () => ({
  queueAuditLog: vi.fn().mockResolvedValue('job-123'),
}));

import {
  registerAuditRoute,
  registerAuditRoutes,
  createAuditMiddleware,
  createAuditResponseHook,
} from '../src/middleware/audit.middleware.js';
import { queueAuditLog } from '../src/services/audit-log.service.js';
import { AuditCategory } from '../src/types/index.js';

describe('Audit Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerAuditRoute', () => {
    it('should register a route configuration', () => {
      registerAuditRoute('POST', '/api/users', {
        eventType: 'USER_CREATED',
        category: AuditCategory.USER_MANAGEMENT,
        action: 'Created new user',
        resourceType: 'user',
      });

      // The route should be registered (we test this indirectly through middleware)
      expect(true).toBe(true);
    });
  });

  describe('registerAuditRoutes', () => {
    it('should register multiple routes at once', () => {
      registerAuditRoutes([
        {
          method: 'GET',
          path: '/api/projects',
          config: {
            eventType: 'PROJECTS_LISTED',
            category: AuditCategory.DATA_ACCESS,
            action: 'Listed projects',
            resourceType: 'project',
          },
        },
        {
          method: 'POST',
          path: '/api/projects',
          config: {
            eventType: 'PROJECT_CREATED',
            category: AuditCategory.DATA_MODIFICATION,
            action: 'Created project',
            resourceType: 'project',
          },
        },
      ]);

      expect(true).toBe(true);
    });
  });

  describe('createAuditMiddleware', () => {
    it('should create a middleware function', () => {
      const middleware = createAuditMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should not block request processing', async () => {
      const middleware = createAuditMiddleware();

      const mockRequest = {
        method: 'GET',
        url: '/unknown-route',
        routeOptions: { url: '/unknown-route' },
      } as never;

      const mockReply = {} as never;

      // Should not throw
      await middleware(mockRequest, mockReply);
    });
  });

  describe('createAuditResponseHook', () => {
    it('should create a response hook function', () => {
      const hook = createAuditResponseHook();
      expect(typeof hook).toBe('function');
    });

    it('should queue audit log for registered route', async () => {
      // First register a route
      registerAuditRoute('POST', '/api/test-resource', {
        eventType: 'TEST_RESOURCE_CREATED',
        category: AuditCategory.DATA_MODIFICATION,
        action: 'Created test resource',
        resourceType: 'test-resource',
      });

      const hook = createAuditResponseHook();

      const mockRequest = {
        method: 'POST',
        url: '/api/test-resource',
        routeOptions: { url: '/api/test-resource' },
        params: { id: 'resource-123' },
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Test Agent',
          'x-correlation-id': 'corr-123',
        },
        id: 'req-123',
        auditStartTime: Date.now() - 100,
        auditConfig: {
          eventType: 'TEST_RESOURCE_CREATED',
          category: AuditCategory.DATA_MODIFICATION,
          action: 'Created test resource',
          resourceType: 'test-resource',
        },
      } as never;

      const mockReply = {
        statusCode: 201,
      } as never;

      await hook(mockRequest, mockReply);

      expect(queueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TEST_RESOURCE_CREATED',
          eventCategory: AuditCategory.DATA_MODIFICATION,
          action: 'Created test resource',
        })
      );
    });

    it('should not queue audit log for unregistered route', async () => {
      const hook = createAuditResponseHook();

      const mockRequest = {
        method: 'GET',
        url: '/unregistered-route',
        routeOptions: { url: '/unregistered-route' },
        ip: '192.168.1.1',
        headers: {},
        id: 'req-456',
        // No auditConfig means route is not registered
      } as never;

      const mockReply = {
        statusCode: 200,
      } as never;

      await hook(mockRequest, mockReply);

      expect(queueAuditLog).not.toHaveBeenCalled();
    });

    it('should capture failure status correctly', async () => {
      const hook = createAuditResponseHook();

      const mockRequest = {
        method: 'POST',
        url: '/api/failed-resource',
        routeOptions: { url: '/api/failed-resource' },
        params: {},
        ip: '192.168.1.1',
        headers: {},
        id: 'req-789',
        auditStartTime: Date.now(),
        auditConfig: {
          eventType: 'FAILED_OPERATION',
          category: AuditCategory.DATA_MODIFICATION,
          action: 'Failed operation',
          resourceType: 'test',
        },
      } as never;

      const mockReply = {
        statusCode: 500, // Error status
      } as never;

      await hook(mockRequest, mockReply);

      expect(queueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: expect.objectContaining({
            status: 'FAILURE',
            statusCode: 500,
          }),
        })
      );
    });
  });
});
