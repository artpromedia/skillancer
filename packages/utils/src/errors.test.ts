import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  BadGatewayError,
  TimeoutError,
  isAppError,
  formatError,
  withErrorHandling,
  assert,
  assertDefined,
} from './errors';

describe('errors', () => {
  describe('AppError', () => {
    it('should create error with message', () => {
      const error = new AppError('Something went wrong', 'TEST_ERROR');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('TEST_ERROR');
    });

    it('should create error with custom status code', () => {
      const error = new AppError('Bad request', 'BAD_REQUEST', 400);
      expect(error.statusCode).toBe(400);
    });

    it('should create error with code', () => {
      const error = new AppError('Error', 'CUSTOM_ERROR', 500);
      expect(error.code).toBe('CUSTOM_ERROR');
    });

    it('should create error with details', () => {
      const error = new AppError('Error', 'TEST', 500, { field: 'value' });
      expect(error.details).toEqual({ field: 'value' });
    });

    it('should be instance of Error', () => {
      const error = new AppError('Error', 'TEST');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('ValidationError');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should include field errors', () => {
      const fieldErrors = { email: 'Invalid email', name: 'Required' };
      const error = new ValidationError('Validation failed', fieldErrors);
      expect(error.details).toEqual(fieldErrors);
    });

    it('should be instance of AppError', () => {
      const error = new ValidationError('Error');
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error', () => {
      const error = new NotFoundError('User');
      expect(error.message).toBe('User not found');
      expect(error.name).toBe('NotFoundError');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create with resource name and id', () => {
      const error = new NotFoundError('User', 'user-123');
      expect(error.message).toBe("User with id 'user-123' not found");
    });
  });

  describe('UnauthorizedError', () => {
    it('should create unauthorized error with default message', () => {
      const error = new UnauthorizedError();
      expect(error.message).toBe('Authentication required');
      expect(error.name).toBe('UnauthorizedError');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create with custom message', () => {
      const error = new UnauthorizedError('Invalid token');
      expect(error.message).toBe('Invalid token');
    });
  });

  describe('ForbiddenError', () => {
    it('should create forbidden error with default message', () => {
      const error = new ForbiddenError();
      expect(error.message).toBe('Access denied');
      expect(error.name).toBe('ForbiddenError');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create with custom message', () => {
      const error = new ForbiddenError('Custom access denied');
      expect(error.message).toBe('Custom access denied');
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('Resource already exists');
      expect(error.message).toBe('Resource already exists');
      expect(error.name).toBe('ConflictError');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError();
      expect(error.message).toBe('Too many requests');
      expect(error.name).toBe('RateLimitError');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should include retry after ms', () => {
      const error = new RateLimitError('Please wait', 60000);
      expect(error.retryAfterMs).toBe(60000);
      expect(error.details).toEqual({ retryAfterMs: 60000 });
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error', () => {
      const error = new ServiceUnavailableError();
      expect(error.message).toBe('Service temporarily unavailable');
      expect(error.name).toBe('ServiceUnavailableError');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should create with custom message', () => {
      const error = new ServiceUnavailableError('Database connection failed');
      expect(error.message).toBe('Database connection failed');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError', () => {
      expect(isAppError(new AppError('Error', 'TEST'))).toBe(true);
    });

    it('should return true for ValidationError', () => {
      expect(isAppError(new ValidationError('Error'))).toBe(true);
    });

    it('should return true for NotFoundError', () => {
      expect(isAppError(new NotFoundError('Error'))).toBe(true);
    });

    it('should return false for standard Error', () => {
      expect(isAppError(new Error('Error'))).toBe(false);
    });

    it('should return false for non-error', () => {
      expect(isAppError('not an error')).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
    });
  });

  describe('formatError', () => {
    it('should format AppError', () => {
      const error = new ValidationError('Invalid input', { email: 'Required' });
      const formatted = formatError(error);

      expect(formatted.message).toBe('Invalid input');
      expect(formatted.statusCode).toBe(400);
      expect(formatted.code).toBe('VALIDATION_ERROR');
    });

    it('should format standard Error', () => {
      const error = new Error('Standard error');
      const formatted = formatError(error);

      expect(formatted.message).toBe('Standard error');
      expect(formatted.statusCode).toBe(500);
      expect(formatted.code).toBe('INTERNAL_ERROR');
    });

    it('should format unknown error', () => {
      const formatted = formatError('string error');

      expect(formatted.message).toBe('string error');
      expect(formatted.statusCode).toBe(500);
      expect(formatted.code).toBe('UNKNOWN_ERROR');
    });

    it('should format error without stack', () => {
      const error = new AppError('Error', 'TEST');
      const formatted = formatError(error);

      expect('stack' in formatted).toBe(false);
    });
  });

  describe('AppError.toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new AppError('Test error', 'TEST', 400, { key: 'value' });
      const json = error.toJSON();

      expect(json.name).toBe('AppError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe('TEST');
      expect(json.statusCode).toBe(400);
      expect(json.details).toEqual({ key: 'value' });
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('AppError.from', () => {
    it('should return AppError as-is', () => {
      const original = new AppError('Original', 'ORIG');
      const result = AppError.from(original);
      expect(result).toBe(original);
    });

    it('should convert Error to AppError', () => {
      const error = new Error('Standard error');
      const result = AppError.from(error);

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('Standard error');
    });

    it('should convert unknown to AppError', () => {
      const result = AppError.from('string error');
      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('string error');
    });
  });

  describe('BadGatewayError', () => {
    it('should create with default message', () => {
      const error = new BadGatewayError();
      expect(error.message).toBe('Bad gateway');
      expect(error.statusCode).toBe(502);
    });
  });

  describe('TimeoutError', () => {
    it('should create with default message', () => {
      const error = new TimeoutError();
      expect(error.message).toBe('Request timed out');
      expect(error.statusCode).toBe(504);
    });
  });

  describe('withErrorHandling', () => {
    it('should wrap sync function and transform errors', () => {
      const fn = () => {
        throw new Error('Original error');
      };
      const wrapped = withErrorHandling(fn);

      expect(() => wrapped()).toThrow(AppError);
    });

    it('should wrap async function and transform errors', async () => {
      const fn = async () => {
        throw new Error('Async error');
      };
      const wrapped = withErrorHandling(fn);

      await expect(wrapped()).rejects.toBeInstanceOf(AppError);
    });

    it('should use custom transformer', () => {
      const fn = () => {
        throw new Error('Original');
      };
      const transformer = () => new ValidationError('Transformed');
      const wrapped = withErrorHandling(fn, transformer);

      expect(() => wrapped()).toThrow(ValidationError);
    });
  });

  describe('assert', () => {
    it('should not throw if condition is true', () => {
      expect(() => assert(true, 'Should not throw')).not.toThrow();
    });

    it('should throw if condition is false', () => {
      expect(() => assert(false, 'Condition failed')).toThrow(ValidationError);
    });

    it('should use custom error class', () => {
      expect(() => assert(false, 'Not found', NotFoundError)).toThrow(NotFoundError);
    });
  });

  describe('assertDefined', () => {
    it('should return value if defined', () => {
      expect(assertDefined('value')).toBe('value');
      expect(assertDefined(0)).toBe(0);
      expect(assertDefined(false)).toBe(false);
    });

    it('should throw if null', () => {
      expect(() => assertDefined(null)).toThrow(ValidationError);
    });

    it('should throw if undefined', () => {
      expect(() => assertDefined(undefined)).toThrow(ValidationError);
    });

    it('should use custom message', () => {
      expect(() => assertDefined(null, 'Custom message')).toThrow('Custom message');
    });
  });
});
