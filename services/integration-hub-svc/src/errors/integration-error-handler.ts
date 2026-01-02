/**
 * Integration Error Handler
 * Classifies and handles integration errors with recovery actions
 */

export enum IntegrationErrorType {
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface IntegrationError {
  type: IntegrationErrorType;
  message: string;
  provider: string;
  recoveryAction?: RecoveryAction;
  retryAfter?: number;
  reconnectUrl?: string;
  originalError?: unknown;
}

export type RecoveryAction = 'retry' | 'reconnect' | 'wait' | 'contact_support' | 'none';

export class IntegrationErrorHandler {
  /**
   * Classify error from HTTP response
   */
  static fromResponse(response: Response, provider: string): IntegrationError {
    const status = response.status;

    if (status === 401 || status === 403) {
      return {
        type: IntegrationErrorType.AUTH_EXPIRED,
        message: 'Authentication expired. Please reconnect.',
        provider,
        recoveryAction: 'reconnect',
        reconnectUrl: `/integrations/${provider}/connect`,
      };
    }

    if (status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      return {
        type: IntegrationErrorType.RATE_LIMITED,
        message: `Rate limited. Please wait ${retryAfter} seconds.`,
        provider,
        recoveryAction: 'wait',
        retryAfter,
      };
    }

    if (status === 404) {
      return {
        type: IntegrationErrorType.NOT_FOUND,
        message: 'Resource not found.',
        provider,
        recoveryAction: 'none',
      };
    }

    if (status >= 500) {
      return {
        type: IntegrationErrorType.PROVIDER_ERROR,
        message: `${provider} is experiencing issues. Please try again later.`,
        provider,
        recoveryAction: 'retry',
      };
    }

    return {
      type: IntegrationErrorType.UNKNOWN,
      message: `An error occurred (${status}).`,
      provider,
      recoveryAction: 'retry',
    };
  }

  /**
   * Classify error from exception
   */
  static fromException(error: unknown, provider: string): IntegrationError {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: IntegrationErrorType.NETWORK_ERROR,
        message: 'Network error. Check your connection.',
        provider,
        recoveryAction: 'retry',
        originalError: error,
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('token')) {
      return {
        type: IntegrationErrorType.AUTH_EXPIRED,
        message: 'Authentication required.',
        provider,
        recoveryAction: 'reconnect',
      };
    }

    if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('scope')) {
      return {
        type: IntegrationErrorType.PERMISSION_DENIED,
        message: 'Missing required permissions.',
        provider,
        recoveryAction: 'reconnect',
      };
    }

    return {
      type: IntegrationErrorType.UNKNOWN,
      message,
      provider,
      recoveryAction: 'retry',
      originalError: error,
    };
  }

  /**
   * Should auto-retry this error?
   */
  static shouldRetry(error: IntegrationError, attempt: number): boolean {
    if (attempt >= 3) return false;

    const retryableTypes = [
      IntegrationErrorType.NETWORK_ERROR,
      IntegrationErrorType.PROVIDER_ERROR,
    ];

    return retryableTypes.includes(error.type);
  }

  /**
   * Get retry delay with exponential backoff
   */
  static getRetryDelay(error: IntegrationError, attempt: number): number {
    if (error.retryAfter) {
      return error.retryAfter * 1000;
    }
    return Math.min(1000 * Math.pow(2, attempt), 30000);
  }
}

export default IntegrationErrorHandler;
