/**
 * Express type augmentations for billing-svc
 * Adds user property to Request after authentication middleware
 */

declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
      sessionId?: string;
      tenantId?: string;
      role?: string;
    };
  }
}
