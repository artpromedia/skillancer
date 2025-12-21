/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
/**
 * @module @skillancer/utils/objects
 * Object manipulation utilities
 */

/**
 * Pick specified properties from an object
 * @param obj - The source object
 * @param keys - Array of keys to pick
 * @returns New object with only the specified properties
 * @example
 * pick({ a: 1, b: 2, c: 3 }, ['a', 'c']) // { a: 1, c: 3 }
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specified properties from an object
 * @param obj - The source object
 * @param keys - Array of keys to omit
 * @returns New object without the specified properties
 * @example
 * omit({ a: 1, b: 2, c: 3 }, ['b']) // { a: 1, c: 3 }
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj } as Omit<T, K>;
  for (const key of keys) {
    delete (result as Record<string, unknown>)[key as string];
  }
  return result;
}

/**
 * Deep merge multiple objects
 * @param target - The target object
 * @param sources - Source objects to merge
 * @returns Merged object
 * @example
 * deepMerge({ a: { b: 1 } }, { a: { c: 2 } }) // { a: { b: 1, c: 2 } }
 */
export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;

  const result = { ...target };

  for (const source of sources) {
    if (!source) continue;

    for (const key of Object.keys(source) as (keyof T)[]) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        result[key] = deepMerge(targetValue as object, sourceValue as object) as T[keyof T];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[keyof T];
      }
    }
  }

  return result;
}

/**
 * Check if a value is empty
 * @param value - The value to check
 * @returns True if the value is null, undefined, empty string, empty array, or empty object
 * @example
 * isEmpty(null) // true
 * isEmpty('') // true
 * isEmpty([]) // true
 * isEmpty({}) // true
 * isEmpty('hello') // false
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Remove undefined and null values from an object
 * @param obj - The source object
 * @returns New object without undefined/null values
 * @example
 * removeUndefined({ a: 1, b: undefined, c: null }) // { a: 1 }
 */
export function removeUndefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

/**
 * Remove undefined values only (keep null)
 * @param obj - The source object
 * @returns New object without undefined values
 */
export function removeUndefinedOnly<T extends object>(obj: T): T {
  const result = {} as T;

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

/**
 * Check if a value is a plain object (not array, Date, etc.)
 * @param value - The value to check
 * @returns True if plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep clone an object
 * @param obj - The object to clone
 * @returns Deep cloned object
 * @example
 * const original = { a: { b: 1 } };
 * const cloned = deepClone(original);
 * cloned.a.b = 2;
 * original.a.b // still 1
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;

  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags) as T;
  if (obj instanceof Map) return new Map(deepClone([...obj])) as T;
  if (obj instanceof Set) return new Set(deepClone([...obj])) as T;

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }

  const cloned = {} as T;
  for (const key of Object.keys(obj) as (keyof T)[]) {
    cloned[key] = deepClone(obj[key]);
  }

  return cloned;
}

/**
 * Get a value from an object by dot-notation path
 * @param obj - The source object
 * @param path - Dot-notation path (e.g., 'a.b.c')
 * @param defaultValue - Default value if path not found
 * @returns The value at the path, or defaultValue
 * @example
 * get({ a: { b: { c: 1 } } }, 'a.b.c') // 1
 * get({ a: 1 }, 'b.c', 'default') // 'default'
 */
export function get<T = unknown>(obj: unknown, path: string, defaultValue?: T): T | undefined {
  const keys = path.split('.');
  let result: unknown = obj;

  for (const key of keys) {
    if (result === null || result === undefined) {
      return defaultValue;
    }
    result = (result as Record<string, unknown>)[key];
  }

  return (result === undefined ? defaultValue : result) as T | undefined;
}

/**
 * Set a value in an object by dot-notation path
 * @param obj - The target object
 * @param path - Dot-notation path
 * @param value - Value to set
 * @returns Modified object
 * @example
 * set({}, 'a.b.c', 1) // { a: { b: { c: 1 } } }
 */
export function set<T extends object>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj as Record<string, unknown>;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i] as string;
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1] as string;
  current[lastKey] = value;
  return obj;
}

/**
 * Check if an object has a property at the given path
 * @param obj - The source object
 * @param path - Dot-notation path
 * @returns True if path exists
 */
export function has(obj: unknown, path: string): boolean {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(current, key)) {
      return false;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return true;
}

/**
 * Flatten a nested object into a single-level object with dot-notation keys
 * @param obj - The nested object
 * @param prefix - Prefix for keys (used internally)
 * @returns Flattened object
 * @example
 * flatten({ a: { b: 1, c: { d: 2 } } }) // { 'a.b': 1, 'a.c.d': 2 }
 */
export function flatten(
  obj: Record<string, unknown>,
  prefix: string = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(value)) {
      Object.assign(result, flatten(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Unflatten a flat object with dot-notation keys into a nested object
 * @param obj - The flat object
 * @returns Nested object
 * @example
 * unflatten({ 'a.b': 1, 'a.c.d': 2 }) // { a: { b: 1, c: { d: 2 } } }
 */
export function unflatten(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    set(result, key, value);
  }

  return result;
}

/**
 * Compare two values for deep equality
 * @param a - First value
 * @param b - Second value
 * @returns True if deeply equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Map object keys
 * @param obj - The source object
 * @param fn - Function to transform keys
 * @returns Object with transformed keys
 */
export function mapKeys<T extends object>(
  obj: T,
  fn: (key: string) => string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    result[fn(key)] = value;
  }

  return result;
}

/**
 * Map object values
 * @param obj - The source object
 * @param fn - Function to transform values
 * @returns Object with transformed values
 */
export function mapValues<T extends object, R>(
  obj: T,
  fn: (value: T[keyof T], key: string) => R
): Record<string, R> {
  const result: Record<string, R> = {};

  for (const [key, value] of Object.entries(obj)) {
    result[key] = fn(value as T[keyof T], key);
  }

  return result;
}
