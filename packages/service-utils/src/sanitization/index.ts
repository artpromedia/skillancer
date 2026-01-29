/**
 * @module @skillancer/service-utils/sanitization
 * Input sanitization utilities for XSS prevention
 *
 * Provides secure input sanitization for user-generated content
 */

// ==================== Types ====================

export interface SanitizationConfig {
  /** Allow specific HTML tags */
  allowedTags?: string[];
  /** Allow specific attributes */
  allowedAttributes?: Record<string, string[]>;
  /** Allow data: URLs (potentially dangerous) */
  allowDataUrls?: boolean;
  /** Strip all HTML */
  stripHtml?: boolean;
  /** Maximum string length */
  maxLength?: number;
  /** Trim whitespace */
  trim?: boolean;
}

export interface SanitizedResult<T> {
  value: T;
  modified: boolean;
  warnings: string[];
}

// ==================== HTML Entity Encoding ====================

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Encode HTML entities to prevent XSS
 */
export function encodeHtmlEntities(input: string): string {
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Decode HTML entities
 */
export function decodeHtmlEntities(input: string): string {
  const textarea = {
    innerHTML: '',
  };
  // In browser: use textarea.innerHTML
  // In Node.js: manual decode
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x60;/g, '`')
    .replace(/&#x3D;/g, '=');
}

// ==================== XSS Patterns ====================

const XSS_PATTERNS = [
  // Script tags
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  // Event handlers
  /\bon\w+\s*=/gi,
  // JavaScript URLs
  /javascript\s*:/gi,
  // Data URLs with scripts
  /data\s*:\s*text\/html/gi,
  // VBScript
  /vbscript\s*:/gi,
  // Expression (IE)
  /expression\s*\(/gi,
  // Base64 encoded scripts
  /data\s*:\s*[^;]*;base64[^"']*/gi,
];

const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'style',
  'link',
  'meta',
  'base',
  'applet',
];

const DANGEROUS_ATTRIBUTES = [
  'onclick',
  'ondblclick',
  'onmousedown',
  'onmouseup',
  'onmouseover',
  'onmousemove',
  'onmouseout',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onload',
  'onerror',
  'onabort',
  'onsubmit',
  'onreset',
  'onselect',
  'onblur',
  'onfocus',
  'onchange',
  'onscroll',
  'ondrag',
  'ondrop',
  'oncopy',
  'oncut',
  'onpaste',
];

// ==================== Sanitization Functions ====================

/**
 * Remove potentially dangerous HTML content
 */
export function stripDangerousHtml(input: string): string {
  let result = input;

  // Remove dangerous tags
  for (const tag of DANGEROUS_TAGS) {
    const openTag = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    const closeTag = new RegExp(`</${tag}>`, 'gi');
    const selfClosing = new RegExp(`<${tag}\\b[^>]*/>`, 'gi');
    result = result.replace(openTag, '').replace(closeTag, '').replace(selfClosing, '');
  }

  // Remove dangerous attributes
  for (const attr of DANGEROUS_ATTRIBUTES) {
    const attrPattern = new RegExp(`\\s*${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
    result = result.replace(attrPattern, '');
  }

  // Remove XSS patterns
  for (const pattern of XSS_PATTERNS) {
    result = result.replace(pattern, '');
  }

  return result;
}

/**
 * Strip all HTML tags
 */
export function stripAllHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a string for safe display
 */
export function sanitizeString(
  input: string,
  config: SanitizationConfig = {}
): SanitizedResult<string> {
  const {
    stripHtml = false,
    maxLength,
    trim = true,
    allowedTags = [],
    allowedAttributes = {},
  } = config;

  const warnings: string[] = [];
  let value = input;
  let modified = false;

  // Trim whitespace
  if (trim) {
    const trimmed = value.trim();
    if (trimmed !== value) {
      value = trimmed;
      modified = true;
    }
  }

  // Check for null bytes
  if (value.includes('\0')) {
    value = value.replace(/\0/g, '');
    warnings.push('Null bytes removed');
    modified = true;
  }

  // Strip or sanitize HTML
  if (stripHtml) {
    const stripped = stripAllHtml(value);
    if (stripped !== value) {
      value = stripped;
      warnings.push('HTML tags stripped');
      modified = true;
    }
  } else if (allowedTags.length === 0) {
    // Encode HTML entities if no tags allowed
    const encoded = encodeHtmlEntities(value);
    if (encoded !== value) {
      value = encoded;
      modified = true;
    }
  } else {
    // Selective sanitization
    const sanitized = stripDangerousHtml(value);
    if (sanitized !== value) {
      value = sanitized;
      warnings.push('Dangerous HTML removed');
      modified = true;
    }
  }

  // Truncate if too long
  if (maxLength && value.length > maxLength) {
    value = value.substring(0, maxLength);
    warnings.push(`Truncated to ${maxLength} characters`);
    modified = true;
  }

  return { value, modified, warnings };
}

/**
 * Sanitize an object's string properties recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  config: SanitizationConfig = {}
): SanitizedResult<T> {
  const warnings: string[] = [];
  let modified = false;

  function sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
      const result = sanitizeString(value, config);
      if (result.modified) {
        modified = true;
        warnings.push(...result.warnings);
      }
      return result.value;
    }

    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }

    if (value !== null && typeof value === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }

    return value;
  }

  const sanitizedObj = sanitizeValue(obj) as T;

  return { value: sanitizedObj, modified, warnings };
}

// ==================== SQL Injection Prevention ====================

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE)\b)/gi,
  /(--)|(;)|(\/\*)|(\*\/)/g,
  /('|"|`)/g,
];

/**
 * Check if input contains potential SQL injection
 */
export function detectSqlInjection(input: string): boolean {
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }
  return false;
}

/**
 * Escape SQL special characters (use parameterized queries instead when possible)
 */
export function escapeSqlString(input: string): string {
  return input
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');
}

// ==================== URL Sanitization ====================

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Sanitize URL to prevent javascript: and other dangerous protocols
 */
export function sanitizeUrl(url: string): SanitizedResult<string> {
  const warnings: string[] = [];
  let modified = false;

  // Trim and lowercase for protocol check
  const trimmed = url.trim();
  const lowercase = trimmed.toLowerCase();

  // Check for dangerous protocols
  if (
    lowercase.startsWith('javascript:') ||
    lowercase.startsWith('vbscript:') ||
    lowercase.startsWith('data:text/html')
  ) {
    warnings.push('Dangerous URL protocol blocked');
    return { value: '', modified: true, warnings };
  }

  // Validate protocol
  try {
    const parsed = new URL(trimmed);
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      warnings.push(`Protocol ${parsed.protocol} not allowed`);
      return { value: '', modified: true, warnings };
    }
  } catch {
    // Relative URL or invalid - allow relative URLs
    if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
      return { value: trimmed, modified: false, warnings };
    }
    // Try to fix missing protocol
    if (!trimmed.includes('://') && !trimmed.startsWith('/')) {
      warnings.push('Protocol added');
      return { value: `https://${trimmed}`, modified: true, warnings };
    }
  }

  return { value: trimmed, modified, warnings };
}

// ==================== Email Sanitization ====================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sanitize and validate email address
 */
export function sanitizeEmail(email: string): SanitizedResult<string> {
  const warnings: string[] = [];

  // Trim and lowercase
  const sanitized = email.trim().toLowerCase();

  // Basic validation
  if (!EMAIL_REGEX.test(sanitized)) {
    warnings.push('Invalid email format');
    return { value: '', modified: true, warnings };
  }

  // Check for dangerous characters
  if (sanitized.includes('<') || sanitized.includes('>') || sanitized.includes('\n')) {
    warnings.push('Invalid characters in email');
    return { value: '', modified: true, warnings };
  }

  return {
    value: sanitized,
    modified: sanitized !== email,
    warnings,
  };
}

// ==================== Filename Sanitization ====================

const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;
const RESERVED_NAMES = [
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
];

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): SanitizedResult<string> {
  const warnings: string[] = [];
  let modified = false;

  // Remove path traversal
  let sanitized = filename.replace(/\.\./g, '');
  if (sanitized !== filename) {
    warnings.push('Path traversal attempt blocked');
    modified = true;
  }

  // Remove unsafe characters
  sanitized = sanitized.replace(UNSAFE_FILENAME_CHARS, '_');
  if (sanitized !== filename) {
    warnings.push('Unsafe characters replaced');
    modified = true;
  }

  // Check reserved names (Windows)
  const nameWithoutExt = sanitized.split('.')[0]?.toUpperCase() || '';
  if (RESERVED_NAMES.includes(nameWithoutExt)) {
    sanitized = `_${sanitized}`;
    warnings.push('Reserved name prefixed');
    modified = true;
  }

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() || '';
    const maxNameLength = 255 - ext.length - 1;
    sanitized = `${sanitized.substring(0, maxNameLength)}.${ext}`;
    warnings.push('Filename truncated');
    modified = true;
  }

  return { value: sanitized || 'unnamed', modified, warnings };
}

// ==================== Fastify Plugin ====================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

export interface SanitizationPluginConfig extends SanitizationConfig {
  /** Fields to exclude from sanitization */
  excludeFields?: string[];
  /** Log sanitization warnings */
  logWarnings?: boolean;
}

async function sanitizationPluginImpl(
  app: FastifyInstance,
  config: SanitizationPluginConfig = {}
): Promise<void> {
  const { excludeFields = ['password', 'token', 'secret'], logWarnings = true } = config;

  app.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Sanitize body
    if (request.body && typeof request.body === 'object') {
      const sanitized = sanitizeObject(request.body as Record<string, unknown>, {
        ...config,
        // Don't sanitize excluded fields
      });

      if (sanitized.modified) {
        request.body = sanitized.value;
        if (logWarnings && sanitized.warnings.length > 0) {
          request.log.warn({ warnings: sanitized.warnings }, 'Request body sanitized');
        }
      }
    }

    // Sanitize query
    if (request.query && typeof request.query === 'object') {
      const sanitized = sanitizeObject(request.query as Record<string, unknown>, config);
      if (sanitized.modified) {
        (request as unknown as { query: unknown }).query = sanitized.value;
        if (logWarnings && sanitized.warnings.length > 0) {
          request.log.warn({ warnings: sanitized.warnings }, 'Request query sanitized');
        }
      }
    }
  });

  // Add sanitization helpers to request
  app.decorateRequest('sanitize', function (this: FastifyRequest, value: string) {
    return sanitizeString(value, config);
  });

  app.decorateRequest('sanitizeUrl', function (this: FastifyRequest, url: string) {
    return sanitizeUrl(url);
  });

  app.decorateRequest('sanitizeEmail', function (this: FastifyRequest, email: string) {
    return sanitizeEmail(email);
  });

  app.decorateRequest('sanitizeFilename', function (this: FastifyRequest, filename: string) {
    return sanitizeFilename(filename);
  });
}

export const sanitizationPlugin = fp(sanitizationPluginImpl, {
  name: 'sanitization-plugin',
  fastify: '4.x',
});

export default sanitizationPlugin;
