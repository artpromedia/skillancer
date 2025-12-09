/**
 * @module @skillancer/api-gateway/tests/errors
 * Error classes tests
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  ValidationError,
  InternalServerError,
  BadGatewayError,
  ServiceUnavailableError,
  GatewayTimeoutError,
  isAppError,
} from '../utils/errors.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with required properties', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 500);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AppError');
    });

    it('should include optional details', () => {
      const details = { field: 'email', reason: 'invalid' };
      const error = new AppError('Test error', 'TEST_ERROR', 400, details);

      expect(error.details).toEqual(details);
    });

    it('should serialize to JSON correctly', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 400, { extra: 'data' });
      const json = error.toJSON();

      expect(json).toEqual({
        error: 'AppError',
        code: 'TEST_ERROR',
        message: 'Test error',
        statusCode: 400,
        details: { extra: 'data' },
      });
    });
  });

  describe('Client Errors (4xx)', () => {
    describe('BadRequestError', () => {
      it('should have correct status code', () => {
        const error = new BadRequestError();

        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('BAD_REQUEST');
        expect(error.name).toBe('BadRequestError');
      });

      it('should accept custom message and details', () => {
        const error = new BadRequestError('Invalid input', { field: 'name' });

        expect(error.message).toBe('Invalid input');
        expect(error.details).toEqual({ field: 'name' });
      });
    });

    describe('UnauthorizedError', () => {
      it('should have correct status code', () => {
        const error = new UnauthorizedError();

        expect(error.statusCode).toBe(401);
        expect(error.code).toBe('UNAUTHORIZED');
        expect(error.name).toBe('UnauthorizedError');
      });

      it('should accept custom message', () => {
        const error = new UnauthorizedError('Token expired');

        expect(error.message).toBe('Token expired');
      });
    });

    describe('ForbiddenError', () => {
      it('should have correct status code', () => {
        const error = new ForbiddenError();

        expect(error.statusCode).toBe(403);
        expect(error.code).toBe('FORBIDDEN');
        expect(error.name).toBe('ForbiddenError');
      });
    });

    describe('NotFoundError', () => {
      it('should have correct status code', () => {
        const error = new NotFoundError();

        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
        expect(error.name).toBe('NotFoundError');
      });
    });

    describe('ConflictError', () => {
      it('should have correct status code', () => {
        const error = new ConflictError();

        expect(error.statusCode).toBe(409);
        expect(error.code).toBe('CONFLICT');
        expect(error.name).toBe('ConflictError');
      });
    });

    describe('TooManyRequestsError', () => {
      it('should have correct status code', () => {
        const error = new TooManyRequestsError();

        expect(error.statusCode).toBe(429);
        expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(error.name).toBe('TooManyRequestsError');
      });

      it('should include retry after', () => {
        const error = new TooManyRequestsError('Slow down', 60);

        expect(error.retryAfter).toBe(60);
        expect(error.details).toEqual({ retryAfter: 60 });
      });
    });

    describe('ValidationError', () => {
      it('should have correct status code', () => {
        const errors = [
          { field: 'email', message: 'Invalid email' },
          { field: 'name', message: 'Required' },
        ];
        const error = new ValidationError(errors);

        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.name).toBe('ValidationError');
        expect(error.details).toEqual({ errors });
      });
    });
  });

  describe('Server Errors (5xx)', () => {
    describe('InternalServerError', () => {
      it('should have correct status code', () => {
        const error = new InternalServerError();

        expect(error.statusCode).toBe(500);
        expect(error.code).toBe('INTERNAL_SERVER_ERROR');
        expect(error.name).toBe('InternalServerError');
      });
    });

    describe('BadGatewayError', () => {
      it('should have correct status code', () => {
        const error = new BadGatewayError();

        expect(error.statusCode).toBe(502);
        expect(error.code).toBe('BAD_GATEWAY');
        expect(error.name).toBe('BadGatewayError');
      });

      it('should include service name', () => {
        const error = new BadGatewayError('Connection failed', 'auth-service');

        expect(error.details).toEqual({ serviceName: 'auth-service' });
      });
    });

    describe('ServiceUnavailableError', () => {
      it('should have correct status code', () => {
        const error = new ServiceUnavailableError();

        expect(error.statusCode).toBe(503);
        expect(error.code).toBe('SERVICE_UNAVAILABLE');
        expect(error.name).toBe('ServiceUnavailableError');
      });

      it('should include service name', () => {
        const error = new ServiceUnavailableError('Circuit open', 'market-service');

        expect(error.details).toEqual({ serviceName: 'market-service' });
      });
    });

    describe('GatewayTimeoutError', () => {
      it('should have correct status code', () => {
        const error = new GatewayTimeoutError();

        expect(error.statusCode).toBe(504);
        expect(error.code).toBe('GATEWAY_TIMEOUT');
        expect(error.name).toBe('GatewayTimeoutError');
      });

      it('should include service name', () => {
        const error = new GatewayTimeoutError('Request timed out', 'billing-service');

        expect(error.details).toEqual({ serviceName: 'billing-service' });
      });
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      const appError = new AppError('test', 'TEST', 500);
      const badRequest = new BadRequestError();
      const notFound = new NotFoundError();

      expect(isAppError(appError)).toBe(true);
      expect(isAppError(badRequest)).toBe(true);
      expect(isAppError(notFound)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('test');
      const typeError = new TypeError('test');

      expect(isAppError(error)).toBe(false);
      expect(isAppError(typeError)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError('error string')).toBe(false);
      expect(isAppError({ message: 'error object' })).toBe(false);
    });
  });
});
