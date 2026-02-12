/**
 * @module @skillancer/utils/ids
 * ID generation utilities
 */

import { nanoid, customAlphabet } from 'nanoid';
import { v4 as uuidv4, validate as validateUuid } from 'uuid';

// Custom alphabet for human-readable IDs (no confusing characters like 0/O, 1/l)
const READABLE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const readableNanoId = customAlphabet(READABLE_ALPHABET, 10);

// Word lists for slug IDs
const ADJECTIVES = [
  'happy',
  'sunny',
  'swift',
  'brave',
  'calm',
  'eager',
  'fair',
  'gentle',
  'kind',
  'lively',
  'merry',
  'neat',
  'proud',
  'quick',
  'royal',
  'smart',
  'tall',
  'warm',
  'wise',
  'young',
  'blue',
  'green',
  'red',
  'golden',
  'silver',
  'cosmic',
  'bright',
  'bold',
  'cool',
  'fresh',
  'grand',
  'prime',
];

const NOUNS = [
  'fox',
  'owl',
  'bear',
  'wolf',
  'hawk',
  'deer',
  'lynx',
  'dove',
  'swan',
  'eagle',
  'tiger',
  'lion',
  'panda',
  'koala',
  'otter',
  'whale',
  'moon',
  'star',
  'cloud',
  'river',
  'ocean',
  'forest',
  'mountain',
  'valley',
  'breeze',
  'storm',
  'flame',
  'wave',
  'stone',
  'leaf',
  'bloom',
  'frost',
];

/**
 * Generate a UUID v4
 * @returns UUID string in format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * @example
 * generateUuid() // '550e8400-e29b-41d4-a716-446655440000'
 */
export function generateUuid(): string {
  return uuidv4();
}

/**
 * Generate a short unique ID using nanoid
 * @param length - Length of the ID (default: 21)
 * @returns Unique ID string
 * @example
 * generateNanoId() // 'V1StGXR8_Z5jdHi6B-myT'
 * generateNanoId(10) // 'IRFa-VaY2b'
 */
export function generateNanoId(length: number = 21): string {
  return nanoid(length);
}

/**
 * Generate a human-readable slug ID
 * Format: adjective-noun-xxx (e.g., "happy-fox-3k2")
 * @returns Human-readable unique ID
 * @example
 * generateSlugId() // 'happy-blue-dog'
 * generateSlugId() // 'swift-golden-eagle'
 */
export function generateSlugId(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const suffix = readableNanoId(3);

  return `${adjective}-${noun}-${suffix}`;
}

/**
 * Generate a numeric ID (useful for order numbers, etc.)
 * @param length - Length of the ID (default: 8)
 * @returns Numeric string ID
 * @example
 * generateNumericId() // '84729156'
 */
export function generateNumericId(length: number = 8): string {
  const numericAlphabet = customAlphabet('0123456789', length);
  return numericAlphabet();
}

/**
 * Generate a prefixed ID for resources
 * @param prefix - Prefix for the ID (e.g., 'usr', 'ord', 'inv')
 * @param length - Length of the random part (default: 12)
 * @returns Prefixed ID
 * @example
 * generatePrefixedId('usr') // 'usr_3k2f8h4m9n1p'
 * generatePrefixedId('ord', 8) // 'ord_4j7n2m5k'
 */
export function generatePrefixedId(prefix: string, length: number = 12): string {
  return `${prefix}_${readableNanoId(length)}`;
}

/**
 * Validate a UUID string
 * @param id - The string to validate
 * @returns True if valid UUID
 * @example
 * isUuid('550e8400-e29b-41d4-a716-446655440000') // true
 * isUuid('not-a-uuid') // false
 */
export function isUuid(id: string): boolean {
  return validateUuid(id);
}

/**
 * Validate a nanoid string
 * @param id - The string to validate
 * @param expectedLength - Expected length (default: 21)
 * @returns True if valid nanoid format
 * @example
 * isNanoId('V1StGXR8_Z5jdHi6B-myT') // true
 */
export function isNanoId(id: string, expectedLength: number = 21): boolean {
  if (id.length !== expectedLength) return false;
  // NanoId uses A-Za-z0-9_-
  return /^[A-Za-z0-9_-]+$/.test(id);
}

/**
 * Generate a cryptographically secure random string
 * @param length - Length of the string (default: 32)
 * @returns Random string
 */
export function generateSecureToken(length: number = 32): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const secureAlphabet = customAlphabet(alphabet, length);
  return secureAlphabet();
}

/**
 * Generate an API key
 * Format: sk_live_xxxxxxxxxxxx or sk_test_xxxxxxxxxxxx
 * @param isLive - Whether this is a live key (default: true)
 * @returns API key string
 * @example
 * generateApiKey() // 'sk_live_4j7n2m5k8f3h9p'
 * generateApiKey(false) // 'sk_test_4j7n2m5k8f3h9p'
 */
export function generateApiKey(isLive: boolean = true): string {
  const prefix = isLive ? 'sk_live' : 'sk_test';
  return `${prefix}_${generateSecureToken(24)}`;
}

/**
 * Generate a short code (e.g., for verification codes)
 * @param length - Length of the code (default: 6)
 * @param numbersOnly - Whether to use only numbers (default: true)
 * @returns Short code string
 * @example
 * generateShortCode() // '847291'
 * generateShortCode(4, false) // 'A3K7'
 */
export function generateShortCode(length: number = 6, numbersOnly: boolean = true): string {
  const alphabet = numbersOnly ? '0123456789' : '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const generator = customAlphabet(alphabet, length);
  return generator();
}

/**
 * Extract prefix from a prefixed ID
 * @param id - The prefixed ID
 * @returns The prefix, or null if no prefix found
 * @example
 * extractIdPrefix('usr_3k2f8h4m9n1p') // 'usr'
 * extractIdPrefix('no-prefix') // null
 */
export function extractIdPrefix(id: string): string | null {
  const match = id.match(/^([a-z]+)_/);
  return match && match[1] ? match[1] : null;
}
