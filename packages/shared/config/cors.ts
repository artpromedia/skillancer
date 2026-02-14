/**
 * Shared CORS configuration for all Skillancer services.
 * Defines allowed origins per environment to prevent CSRF attacks.
 */

const ALLOWED_ORIGINS: Record<string, string[]> = {
  production: [
    'https://skillancer.com',
    'https://www.skillancer.com',
    'https://app.skillancer.com',
    'https://admin.skillancer.com',
    'https://cockpit.skillancer.com',
  ],
  staging: [
    'https://staging.skillancer.com',
    'https://staging-app.skillancer.com',
    'https://staging-admin.skillancer.com',
  ],
  development: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3010',
  ],
  test: ['http://localhost:3000', 'http://localhost:3001'],
};

export function getAllowedOrigins(env?: string): string[] {
  const environment = env || process.env.NODE_ENV || 'development';
  return ALLOWED_ORIGINS[environment] ?? ALLOWED_ORIGINS.development ?? [];
}

export function isOriginAllowed(origin: string, env?: string): boolean {
  const allowed = getAllowedOrigins(env);
  return allowed.includes(origin);
}

export const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
export const CORS_HEADERS = ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Correlation-ID'];
export const CORS_MAX_AGE = 86400; // 24 hours
