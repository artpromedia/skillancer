/**
 * @module @skillancer/service-template/tests/errors
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
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  DatabaseError,
  ExternalServiceError,
  isAppError,
  isOperationalError,
  wrapError,
} from '../utils/errors.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with all properties', () => {
      const error = new AppError('Test error', 500, 'TEST_ERROR', {
        details: { foo: 'bar' },
      });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error.isOperational).toBe(true);
    });

    it('should serialize to JSON', () => {
      const error = new AppError('Test', 400, 'TEST');
      const json = error.toJSON();

      expect(json.name).toBe('AppError');
      expect(json.message).toBe('Test');
      expect(json.statusCode).toBe(400);
      expect(json.code).toBe('TEST');
    });
  });

  describe('BadRequestError', () => {
    it('should have status 400', () => {
      const error = new BadRequestError('Invalid input');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
    });

    it('should use default message', () => {
      const error = new BadRequestError();
      expect(error.message).toBe('Bad request');
    });
  });

  describe('UnauthorizedError', () => {
    it('should have status 401', () => {
      const error = new UnauthorizedError();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('ForbiddenError', () => {
    it('should have status 403', () => {
      const error = new ForbiddenError();

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('NotFoundError', () => {
    it('should have status 404', () => {
      const error = new NotFoundError('User not found');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
    });
  });

  describe('ConflictError', () => {
    it('should have status 409', () => {
      const error = new ConflictError('Email already exists');

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('ValidationError', () => {
    it('should have status 422 and errors array', () => {
      const errors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' },
      ];
      const error = new ValidationError(errors);

      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.errors).toEqual(errors);
      expect(error.details).toEqual(errors);
    });
  });

  describe('TooManyRequestsError', () => {
    it('should have status 429 and retryAfter', () => {
      const error = new TooManyRequestsError('Rate limited', 60);

      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('InternalServerError', () => {
    it('should have status 500 and not be operational', () => {
      const error = new InternalServerError();

      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should have status 503', () => {
      const error = new ServiceUnavailableError();

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('DatabaseError', () => {
    it('should have status 500', () => {
      const error = new DatabaseError('Connection failed');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.isOperational).toBe(false);
    });
  });

  describe('ExternalServiceError', () => {
    it('should have status 502 and service name', () => {
      const error = new ExternalServiceError('payment-service', 'Connection refused');

      expect(error.statusCode).toBe(502);
      expect(error.serviceName).toBe('payment-service');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new BadRequestError())).toBe(true);
      expect(isAppError(new NotFoundError())).toBe(true);
    });

    it('should return false for regular errors', () => {
      expect(isAppError(new Error('test'))).toBe(false);
      expect(isAppError('string')).toBe(false);
      expect(isAppError(null)).toBe(false);
    });
  });

  describe('isOperationalError', () => {
    it('should return true for operational errors', () => {
      expect(isOperationalError(new BadRequestError())).toBe(true);
      expect(isOperationalError(new NotFoundError())).toBe(true);
    });

    it('should return false for non-operational errors', () => {
      expect(isOperationalError(new InternalServerError())).toBe(false);
      expect(isOperationalError(new DatabaseError('fail'))).toBe(false);
    });
  });

  describe('wrapError', () => {
    it('should return AppError as-is', () => {
      const error = new BadRequestError();
      expect(wrapError(error)).toBe(error);
    });

    it('should wrap regular Error', () => {
      const error = new Error('test');
      const wrapped = wrapError(error);

      expect(wrapped).toBeInstanceOf(InternalServerError);
      expect(wrapped.message).toBe('test');
    });

    it('should wrap string', () => {
      const wrapped = wrapError('string error');

      expect(wrapped).toBeInstanceOf(InternalServerError);
      expect(wrapped.message).toBe('string error');
    });
  });
});
