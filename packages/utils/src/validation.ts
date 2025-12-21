/* eslint-disable no-useless-escape */
/**
 * @module @skillancer/utils/validation
 * Validation utilities for common data types
 */

/**
 * Result of password strength validation
 */
export interface PasswordStrengthResult {
  /** Whether the password meets all requirements */
  valid: boolean;
  /** Array of error messages for failed requirements */
  errors: string[];
  /** Password strength score (0-4) */
  score: number;
}

/**
 * Check if a string is a valid email address
 * @param email - The email string to validate
 * @returns True if valid email format
 * @example
 * isValidEmail('user@example.com') // true
 * isValidEmail('invalid-email') // false
 */
export function isValidEmail(email: string): boolean {
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Check if a string is a valid phone number
 * Supports international formats
 * @param phone - The phone string to validate
 * @returns True if valid phone format
 * @example
 * isValidPhone('+1-555-123-4567') // true
 * isValidPhone('555-123-4567') // true
 * isValidPhone('abc') // false
 */
export function isValidPhone(phone: string): boolean {
  // Remove all non-digit characters except + at start
  const cleaned = phone.replace(/[^\d+]/g, '');
  // Valid phone: 7-15 digits, optionally starting with +
  const phoneRegex = /^\+?\d{7,15}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Check if a string is a valid URL
 * @param url - The URL string to validate
 * @returns True if valid URL
 * @example
 * isValidUrl('https://example.com') // true
 * isValidUrl('http://localhost:3000') // true
 * isValidUrl('not a url') // false
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a string is a valid UUID (v1-v5)
 * @param uuid - The UUID string to validate
 * @returns True if valid UUID format
 * @example
 * isValidUuid('550e8400-e29b-41d4-a716-446655440000') // true
 * isValidUuid('not-a-uuid') // false
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Check if a string is a valid URL slug
 * @param slug - The slug string to validate
 * @returns True if valid slug format
 * @example
 * isValidSlug('my-article-title') // true
 * isValidSlug('My Article') // false
 */
export function isValidSlug(slug: string): boolean {
  // Lowercase letters, numbers, and hyphens only
  // Must start and end with alphanumeric
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length <= 100;
}

/**
 * Validate password strength
 * @param password - The password to validate
 * @returns Validation result with errors and score
 * @example
 * isStrongPassword('weak') // { valid: false, errors: [...], score: 1 }
 * isStrongPassword('Str0ng!Pass') // { valid: true, errors: [], score: 4 }
 */
export function isStrongPassword(password: string): PasswordStrengthResult {
  const errors: string[] = [];
  let score = 0;

  // Minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score++;
  }

  // Uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score++;
  }

  // Lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score++;
  }

  // Number
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score++;
  }

  // Special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score++;
  }

  return {
    valid: errors.length === 0,
    errors,
    score: Math.min(score, 4),
  };
}

/**
 * Check if a string is a valid credit card number using Luhn algorithm
 * @param cardNumber - The card number to validate
 * @returns True if valid card number
 * @example
 * isValidCreditCard('4111111111111111') // true (test Visa)
 * isValidCreditCard('1234567890123456') // false
 */
export function isValidCreditCard(cardNumber: string): boolean {
  // Remove spaces and dashes
  const cleaned = cardNumber.replace(/[\s-]/g, '');

  // Must be 13-19 digits
  if (!/^\d{13,19}$/.test(cleaned)) {
    return false;
  }

  // Luhn algorithm
  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    const char = cleaned[i] ?? '0';
    let digit = parseInt(char, 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Check if a string is a valid IPv4 address
 * @param ip - The IP address to validate
 * @returns True if valid IPv4 address
 * @example
 * isValidIPv4('192.168.1.1') // true
 * isValidIPv4('256.1.1.1') // false
 */
export function isValidIPv4(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  return ipv4Regex.test(ip);
}

/**
 * Check if a string is a valid hex color
 * @param color - The color string to validate
 * @returns True if valid hex color
 * @example
 * isValidHexColor('#fff') // true
 * isValidHexColor('#ffffff') // true
 * isValidHexColor('ffffff') // false (missing #)
 */
export function isValidHexColor(color: string): boolean {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
}

/**
 * Check if a string is a valid JSON
 * @param str - The string to validate
 * @returns True if valid JSON
 * @example
 * isValidJson('{"key": "value"}') // true
 * isValidJson('{invalid}') // false
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a string matches a date format (YYYY-MM-DD)
 * @param dateStr - The date string to validate
 * @returns True if valid date format
 * @example
 * isValidDateFormat('2024-01-15') // true
 * isValidDateFormat('01/15/2024') // false
 */
export function isValidDateFormat(dateStr: string): boolean {
  const dateRegex = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
  if (!dateRegex.test(dateStr)) return false;

  // Validate actual date
  const parts = dateStr.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 0;
  const day = parts[2] ?? 0;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * Check if a value is empty (null, undefined, empty string, or whitespace)
 * @param value - The value to check
 * @returns True if empty
 */
export function isEmptyString(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

/**
 * Check if a string is a valid username
 * Rules: 3-30 chars, alphanumeric, underscores, and hyphens
 * @param username - The username to validate
 * @returns True if valid username
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
}
