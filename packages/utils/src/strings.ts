/**
 * @module @skillancer/utils/strings
 * String manipulation and formatting utilities
 */

/**
 * Convert a string to a URL-friendly slug
 * @param text - The text to slugify
 * @returns URL-friendly slug
 * @example
 * slugify('Hello World!') // 'hello-world'
 * slugify('Café au lait') // 'cafe-au-lait'
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Normalize unicode
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Truncate a string to a maximum length
 * @param text - The text to truncate
 * @param maxLength - Maximum length (including suffix)
 * @param suffix - Suffix to append when truncated (default: '...')
 * @returns Truncated string
 * @example
 * truncate('Hello World', 8) // 'Hello...'
 * truncate('Hi', 10) // 'Hi'
 * truncate('Hello World', 8, '…') // 'Hello W…'
 */
export function truncate(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (text.length <= maxLength) return text;
  const truncatedLength = maxLength - suffix.length;
  if (truncatedLength <= 0) return suffix.slice(0, maxLength);
  return text.slice(0, truncatedLength).trim() + suffix;
}

/**
 * Capitalize the first letter of a string
 * @param text - The text to capitalize
 * @returns String with first letter capitalized
 * @example
 * capitalize('hello') // 'Hello'
 * capitalize('HELLO') // 'HELLO'
 */
export function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Convert a string to title case
 * @param text - The text to convert
 * @returns Title cased string
 * @example
 * titleCase('hello world') // 'Hello World'
 * titleCase('THE QUICK BROWN FOX') // 'The Quick Brown Fox'
 */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => capitalize(word))
    .join(' ');
}

/**
 * Convert camelCase to snake_case
 * @param text - The camelCase text
 * @returns snake_case string
 * @example
 * camelToSnake('helloWorld') // 'hello_world'
 * camelToSnake('userID') // 'user_id'
 */
export function camelToSnake(text: string): string {
  return text
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Convert snake_case to camelCase
 * @param text - The snake_case text
 * @returns camelCase string
 * @example
 * snakeToCamel('hello_world') // 'helloWorld'
 * snakeToCamel('user_id') // 'userId'
 */
export function snakeToCamel(text: string): string {
  return text.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert kebab-case to camelCase
 * @param text - The kebab-case text
 * @returns camelCase string
 * @example
 * kebabToCamel('hello-world') // 'helloWorld'
 */
export function kebabToCamel(text: string): string {
  return text.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to kebab-case
 * @param text - The camelCase text
 * @returns kebab-case string
 * @example
 * camelToKebab('helloWorld') // 'hello-world'
 */
export function camelToKebab(text: string): string {
  return text
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

/**
 * Sanitize HTML by escaping dangerous characters
 * @param html - The HTML string to sanitize
 * @returns Escaped HTML string
 * @example
 * sanitizeHtml('<script>alert("xss")</script>') // '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function sanitizeHtml(html: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return html.replace(/[&<>"'/]/g, (char) => escapeMap[char] ?? char);
}

/**
 * Strip all HTML tags from a string
 * @param html - The HTML string
 * @returns Plain text without HTML tags
 * @example
 * stripHtml('<p>Hello <strong>World</strong></p>') // 'Hello World'
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim();
}

/**
 * Pluralize a word based on count
 * @param word - The word to pluralize
 * @param count - The count
 * @param plural - Custom plural form (optional)
 * @returns Pluralized word
 * @example
 * pluralize('item', 1) // 'item'
 * pluralize('item', 2) // 'items'
 * pluralize('child', 2, 'children') // 'children'
 */
export function pluralize(
  word: string,
  count: number,
  plural?: string
): string {
  if (count === 1) return word;
  if (plural) return plural;

  // Simple pluralization rules
  if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) {
    return word.slice(0, -1) + 'ies';
  }
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
    return word + 'es';
  }
  return word + 's';
}

/**
 * Generate initials from a name
 * @param name - Full name
 * @param maxLength - Maximum number of initials (default: 2)
 * @returns Uppercase initials
 * @example
 * generateInitials('John Doe') // 'JD'
 * generateInitials('John Michael Doe') // 'JM'
 * generateInitials('John Michael Doe', 3) // 'JMD'
 */
export function generateInitials(name: string, maxLength: number = 2): string {
  return name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, maxLength)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/**
 * Mask an email address for privacy
 * @param email - The email address
 * @returns Masked email
 * @example
 * maskEmail('john.doe@example.com') // 'j***@example.com'
 * maskEmail('ab@test.com') // 'a***@test.com'
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;

  const visibleChars = Math.min(1, localPart.length);
  const masked = localPart.slice(0, visibleChars) + '***';

  return `${masked}@${domain}`;
}

/**
 * Mask a phone number for privacy
 * @param phone - The phone number
 * @returns Masked phone number showing only last 4 digits
 * @example
 * maskPhone('555-123-4567') // '***-***-4567'
 * maskPhone('+1 (555) 123-4567') // '***-***-4567'
 */
export function maskPhone(phone: string): string {
  // Extract only digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';

  const lastFour = digits.slice(-4);
  return `***-***-${lastFour}`;
}

/**
 * Count words in a string
 * @param text - The text to count words in
 * @returns Number of words
 * @example
 * countWords('Hello World') // 2
 * countWords('  Multiple   spaces  ') // 2
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Check if a string contains only alphanumeric characters
 * @param text - The text to check
 * @returns True if alphanumeric only
 */
export function isAlphanumeric(text: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(text);
}

/**
 * Pad a string to a certain length
 * @param text - The text to pad
 * @param length - Target length
 * @param char - Character to pad with (default: ' ')
 * @param position - 'start' or 'end' (default: 'start')
 * @returns Padded string
 */
export function pad(
  text: string,
  length: number,
  char: string = ' ',
  position: 'start' | 'end' = 'start'
): string {
  if (text.length >= length) return text;
  const padding = char.repeat(length - text.length);
  return position === 'start' ? padding + text : text + padding;
}

/**
 * Extract numbers from a string
 * @param text - The text containing numbers
 * @returns Array of numbers found
 * @example
 * extractNumbers('I have 3 apples and 5 oranges') // [3, 5]
 */
export function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+\.?\d*/g);
  return matches ? matches.map(Number) : [];
}
