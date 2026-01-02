/**
 * Request Validation Hardening Middleware
 * Prevents common injection attacks and validates input
 */

import type { Request, Response, NextFunction } from 'express';

export interface ValidationConfig {
  maxBodySize?: number;
  maxUrlLength?: number;
  maxHeaderSize?: number;
  allowedContentTypes?: string[];
  sanitizeInput?: boolean;
  blockSqlInjection?: boolean;
  blockNoSqlInjection?: boolean;
  blockPathTraversal?: boolean;
  blockXxe?: boolean;
  blockCommandInjection?: boolean;
}

const DEFAULT_CONFIG: ValidationConfig = {
  maxBodySize: 10 * 1024 * 1024, // 10MB
  maxUrlLength: 2048,
  maxHeaderSize: 8192,
  allowedContentTypes: [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
  ],
  sanitizeInput: true,
  blockSqlInjection: true,
  blockNoSqlInjection: true,
  blockPathTraversal: true,
  blockXxe: true,
  blockCommandInjection: true,
};

// SQL Injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|DECLARE)\b)/i,
  /(\b(OR|AND)\b\s+[\d\w'"=]+\s*[=<>])/i,
  /(--|#|\/\*|\*\/)/,
  /(\bWHERE\b\s+\d+\s*=\s*\d+)/i,
  /('\s*(OR|AND)\s*'?\s*\d+\s*=\s*\d+)/i,
  /(SLEEP\s*\(\s*\d+\s*\))/i,
  /(BENCHMARK\s*\()/i,
  /(CHAR\s*\(\s*\d+\s*\))/i,
  /(\bLOAD_FILE\b)/i,
  /(\bINTO\s+OUTFILE\b)/i,
];

// NoSQL Injection patterns
const NOSQL_INJECTION_PATTERNS = [
  /\$where/i,
  /\$gt|\$gte|\$lt|\$lte|\$ne|\$in|\$nin|\$or|\$and|\$not|\$nor/,
  /\$regex/i,
  /\$expr/i,
  /{\s*"\$/,
  /\$function/i,
  /\$accumulator/i,
];

// Path Traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e%2f/i,
  /%2e%2e\//i,
  /\.\.%2f/i,
  /%2e%2e%5c/i,
  /\.\.%5c/i,
  /%252e%252e%252f/i,
  /\.\./,
];

// Command Injection patterns
const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$]/, // Command separators
  /\$\(.*\)/, // Command substitution
  /`.*`/, // Backtick execution
  /\|\s*\w+/, // Pipe to command
  />\s*\//, // Redirect to file
  /<\s*\//, // Read from file
  /\b(eval|exec|system|passthru|shell_exec|popen|proc_open)\b/i,
];

// XXE patterns
const XXE_PATTERNS = [/<!ENTITY/i, /<!DOCTYPE.*\[/i, /SYSTEM\s+["']/i, /PUBLIC\s+["']/i, /%[\w]+;/];

/**
 * Check string for SQL injection
 */
function detectSqlInjection(value: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Check object for NoSQL injection
 */
function detectNoSqlInjection(obj: unknown): boolean {
  if (typeof obj === 'string') {
    return NOSQL_INJECTION_PATTERNS.some((pattern) => pattern.test(obj));
  }
  if (typeof obj === 'object' && obj !== null) {
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$')) return true;
      if (detectNoSqlInjection((obj as Record<string, unknown>)[key])) return true;
    }
  }
  return false;
}

/**
 * Check for path traversal
 */
function detectPathTraversal(value: string): boolean {
  return PATH_TRAVERSAL_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Check for command injection
 */
function detectCommandInjection(value: string): boolean {
  return COMMAND_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Check for XXE
 */
function detectXxe(value: string): boolean {
  return XXE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Sanitize string input
 */
function sanitizeString(value: string): string {
  return value
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Deep sanitize object
 */
function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip keys starting with $ (potential NoSQL operators)
      if (!key.startsWith('$')) {
        sanitized[sanitizeString(key)] = sanitizeObject(value);
      }
    }
    return sanitized;
  }
  return obj;
}

/**
 * Validate all string values in an object
 */
function validateObject(
  obj: unknown,
  config: ValidationConfig,
  path: string = ''
): { valid: boolean; error?: string } {
  if (typeof obj === 'string') {
    if (config.blockSqlInjection && detectSqlInjection(obj)) {
      return { valid: false, error: `SQL injection detected at ${path}` };
    }
    if (config.blockPathTraversal && detectPathTraversal(obj)) {
      return { valid: false, error: `Path traversal detected at ${path}` };
    }
    if (config.blockCommandInjection && detectCommandInjection(obj)) {
      return { valid: false, error: `Command injection detected at ${path}` };
    }
    if (config.blockXxe && detectXxe(obj)) {
      return { valid: false, error: `XXE attack detected at ${path}` };
    }
  }

  if (config.blockNoSqlInjection && detectNoSqlInjection(obj)) {
    return { valid: false, error: `NoSQL injection detected at ${path}` };
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = validateObject(obj[i], config, `${path}[${i}]`);
      if (!result.valid) return result;
    }
  }

  if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const result = validateObject(value, config, `${path}.${key}`);
      if (!result.valid) return result;
    }
  }

  return { valid: true };
}

/**
 * Request Validation Middleware
 */
export function requestValidation(customConfig?: Partial<ValidationConfig>) {
  const config = { ...DEFAULT_CONFIG, ...customConfig };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check URL length
    if (config.maxUrlLength && req.originalUrl.length > config.maxUrlLength) {
      res.status(414).json({ error: 'URI Too Long' });
      return;
    }

    // Check path traversal in URL
    if (config.blockPathTraversal && detectPathTraversal(req.path)) {
      logSecurityEvent(req, 'path_traversal', 'URL path');
      res.status(400).json({ error: 'Invalid request path' });
      return;
    }

    // Validate Content-Type
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const contentType = req.headers['content-type']?.split(';')[0];
      if (
        contentType &&
        config.allowedContentTypes &&
        !config.allowedContentTypes.some((ct) => contentType.includes(ct))
      ) {
        res.status(415).json({ error: 'Unsupported Media Type' });
        return;
      }
    }

    // Validate query parameters
    if (Object.keys(req.query).length > 0) {
      const queryValidation = validateObject(req.query, config, 'query');
      if (!queryValidation.valid) {
        logSecurityEvent(req, 'injection_attempt', queryValidation.error || 'query');
        res.status(400).json({ error: 'Invalid query parameters' });
        return;
      }

      if (config.sanitizeInput) {
        req.query = sanitizeObject(req.query) as typeof req.query;
      }
    }

    // Validate request body
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyValidation = validateObject(req.body, config, 'body');
      if (!bodyValidation.valid) {
        logSecurityEvent(req, 'injection_attempt', bodyValidation.error || 'body');
        res.status(400).json({ error: 'Invalid request body' });
        return;
      }

      if (config.sanitizeInput) {
        req.body = sanitizeObject(req.body);
      }
    }

    // Validate URL parameters
    if (Object.keys(req.params).length > 0) {
      const paramsValidation = validateObject(req.params, config, 'params');
      if (!paramsValidation.valid) {
        logSecurityEvent(req, 'injection_attempt', paramsValidation.error || 'params');
        res.status(400).json({ error: 'Invalid URL parameters' });
        return;
      }
    }

    next();
  };
}

/**
 * File upload validation middleware
 */
export function fileUploadValidation(options: {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}) {
  const defaults = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
  };

  const config = { ...defaults, ...options };

  return (req: Request, res: Response, next: NextFunction): void => {
    const files = (req as any).files || (req as any).file;
    if (!files) {
      next();
      return;
    }

    const fileList = Array.isArray(files) ? files : [files];

    for (const file of fileList) {
      // Check file size
      if (file.size > config.maxFileSize) {
        res.status(413).json({ error: 'File too large' });
        return;
      }

      // Check MIME type
      if (!config.allowedMimeTypes.includes(file.mimetype)) {
        res.status(415).json({ error: 'File type not allowed' });
        return;
      }

      // Check extension
      const ext = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
      if (!config.allowedExtensions.includes(ext)) {
        res.status(415).json({ error: 'File extension not allowed' });
        return;
      }

      // Check for path traversal in filename
      if (detectPathTraversal(file.originalname)) {
        res.status(400).json({ error: 'Invalid filename' });
        return;
      }
    }

    next();
  };
}

/**
 * Log security event
 */
function logSecurityEvent(req: Request, type: string, details: string): void {
  console.warn(`[Security] ${type}: ${details}`, {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
    userAgent: req.headers['user-agent'],
  });
}

export default requestValidation;
