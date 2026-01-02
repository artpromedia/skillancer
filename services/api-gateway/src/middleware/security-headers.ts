/**
 * Comprehensive Security Headers Middleware
 * Implements all recommended security headers for SOC 2 compliance
 */

import type { Request, Response, NextFunction } from 'express';

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: CSPConfig;
  hstsMaxAge?: number;
  hstsIncludeSubDomains?: boolean;
  hstsPreload?: boolean;
  frameOptions?: 'DENY' | 'SAMEORIGIN';
  contentTypeNosniff?: boolean;
  xssProtection?: boolean;
  referrerPolicy?: ReferrerPolicy;
  permissionsPolicy?: PermissionsPolicyConfig;
  cacheControl?: CacheControlConfig;
}

export interface CSPConfig {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
  frameSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  workerSrc?: string[];
  childSrc?: string[];
  formAction?: string[];
  frameAncestors?: string[];
  baseUri?: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  reportUri?: string;
}

export type ReferrerPolicy =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';

export interface PermissionsPolicyConfig {
  accelerometer?: string[];
  ambientLightSensor?: string[];
  autoplay?: string[];
  camera?: string[];
  documentDomain?: string[];
  encryptedMedia?: string[];
  fullscreen?: string[];
  geolocation?: string[];
  gyroscope?: string[];
  magnetometer?: string[];
  microphone?: string[];
  midi?: string[];
  payment?: string[];
  pictureInPicture?: string[];
  usb?: string[];
  xrSpatialTracking?: string[];
}

export interface CacheControlConfig {
  noStore?: boolean;
  noCache?: boolean;
  mustRevalidate?: boolean;
  private?: boolean;
  maxAge?: number;
}

const DEFAULT_CONFIG: SecurityHeadersConfig = {
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust for your needs
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    connectSrc: ["'self'", 'https://api.skillancer.com'],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: true,
    blockAllMixedContent: true,
  },
  hstsMaxAge: 31536000, // 1 year
  hstsIncludeSubDomains: true,
  hstsPreload: true,
  frameOptions: 'DENY',
  contentTypeNosniff: true,
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    accelerometer: [],
    camera: [],
    geolocation: [],
    gyroscope: [],
    magnetometer: [],
    microphone: [],
    payment: ["'self'"],
    usb: [],
  },
  cacheControl: {
    noStore: true,
    noCache: true,
    mustRevalidate: true,
    private: true,
  },
};

/**
 * Build Content-Security-Policy header value
 */
function buildCSP(config: CSPConfig): string {
  const directives: string[] = [];

  if (config.defaultSrc) directives.push(`default-src ${config.defaultSrc.join(' ')}`);
  if (config.scriptSrc) directives.push(`script-src ${config.scriptSrc.join(' ')}`);
  if (config.styleSrc) directives.push(`style-src ${config.styleSrc.join(' ')}`);
  if (config.imgSrc) directives.push(`img-src ${config.imgSrc.join(' ')}`);
  if (config.fontSrc) directives.push(`font-src ${config.fontSrc.join(' ')}`);
  if (config.connectSrc) directives.push(`connect-src ${config.connectSrc.join(' ')}`);
  if (config.frameSrc) directives.push(`frame-src ${config.frameSrc.join(' ')}`);
  if (config.objectSrc) directives.push(`object-src ${config.objectSrc.join(' ')}`);
  if (config.mediaSrc) directives.push(`media-src ${config.mediaSrc.join(' ')}`);
  if (config.workerSrc) directives.push(`worker-src ${config.workerSrc.join(' ')}`);
  if (config.childSrc) directives.push(`child-src ${config.childSrc.join(' ')}`);
  if (config.formAction) directives.push(`form-action ${config.formAction.join(' ')}`);
  if (config.frameAncestors) directives.push(`frame-ancestors ${config.frameAncestors.join(' ')}`);
  if (config.baseUri) directives.push(`base-uri ${config.baseUri.join(' ')}`);
  if (config.upgradeInsecureRequests) directives.push('upgrade-insecure-requests');
  if (config.blockAllMixedContent) directives.push('block-all-mixed-content');
  if (config.reportUri) directives.push(`report-uri ${config.reportUri}`);

  return directives.join('; ');
}

/**
 * Build Permissions-Policy header value
 */
function buildPermissionsPolicy(config: PermissionsPolicyConfig): string {
  const policies: string[] = [];

  const policyMap: Record<keyof PermissionsPolicyConfig, string> = {
    accelerometer: 'accelerometer',
    ambientLightSensor: 'ambient-light-sensor',
    autoplay: 'autoplay',
    camera: 'camera',
    documentDomain: 'document-domain',
    encryptedMedia: 'encrypted-media',
    fullscreen: 'fullscreen',
    geolocation: 'geolocation',
    gyroscope: 'gyroscope',
    magnetometer: 'magnetometer',
    microphone: 'microphone',
    midi: 'midi',
    payment: 'payment',
    pictureInPicture: 'picture-in-picture',
    usb: 'usb',
    xrSpatialTracking: 'xr-spatial-tracking',
  };

  for (const [key, headerName] of Object.entries(policyMap)) {
    const value = config[key as keyof PermissionsPolicyConfig];
    if (value !== undefined) {
      if (value.length === 0) {
        policies.push(`${headerName}=()`);
      } else {
        policies.push(`${headerName}=(${value.join(' ')})`);
      }
    }
  }

  return policies.join(', ');
}

/**
 * Build Cache-Control header value
 */
function buildCacheControl(config: CacheControlConfig): string {
  const directives: string[] = [];

  if (config.noStore) directives.push('no-store');
  if (config.noCache) directives.push('no-cache');
  if (config.mustRevalidate) directives.push('must-revalidate');
  if (config.private) directives.push('private');
  if (config.maxAge !== undefined) directives.push(`max-age=${config.maxAge}`);

  return directives.join(', ');
}

/**
 * Security Headers Middleware
 */
export function securityHeaders(customConfig?: Partial<SecurityHeadersConfig>) {
  const config: SecurityHeadersConfig = {
    ...DEFAULT_CONFIG,
    ...customConfig,
    contentSecurityPolicy: {
      ...DEFAULT_CONFIG.contentSecurityPolicy,
      ...customConfig?.contentSecurityPolicy,
    },
    permissionsPolicy: {
      ...DEFAULT_CONFIG.permissionsPolicy,
      ...customConfig?.permissionsPolicy,
    },
    cacheControl: {
      ...DEFAULT_CONFIG.cacheControl,
      ...customConfig?.cacheControl,
    },
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Content-Security-Policy
    if (config.contentSecurityPolicy) {
      res.setHeader('Content-Security-Policy', buildCSP(config.contentSecurityPolicy));
    }

    // Strict-Transport-Security (HSTS)
    if (config.hstsMaxAge) {
      let hsts = `max-age=${config.hstsMaxAge}`;
      if (config.hstsIncludeSubDomains) hsts += '; includeSubDomains';
      if (config.hstsPreload) hsts += '; preload';
      res.setHeader('Strict-Transport-Security', hsts);
    }

    // X-Frame-Options
    if (config.frameOptions) {
      res.setHeader('X-Frame-Options', config.frameOptions);
    }

    // X-Content-Type-Options
    if (config.contentTypeNosniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-XSS-Protection (legacy but still useful)
    if (config.xssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Referrer-Policy
    if (config.referrerPolicy) {
      res.setHeader('Referrer-Policy', config.referrerPolicy);
    }

    // Permissions-Policy
    if (config.permissionsPolicy) {
      res.setHeader('Permissions-Policy', buildPermissionsPolicy(config.permissionsPolicy));
    }

    // Cache-Control for sensitive endpoints
    if (config.cacheControl && isSensitiveEndpoint(req.path)) {
      res.setHeader('Cache-Control', buildCacheControl(config.cacheControl));
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // Additional security headers
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    next();
  };
}

/**
 * Check if endpoint handles sensitive data
 */
function isSensitiveEndpoint(path: string): boolean {
  const sensitivePatterns = [
    '/auth',
    '/login',
    '/logout',
    '/password',
    '/mfa',
    '/session',
    '/user',
    '/account',
    '/admin',
    '/api/v1/users',
    '/api/v1/billing',
    '/api/v1/payments',
  ];

  return sensitivePatterns.some((pattern) => path.startsWith(pattern));
}

/**
 * CORS hardening middleware
 */
export function corsHardening(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, X-Correlation-ID'
      );
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

export default securityHeaders;
