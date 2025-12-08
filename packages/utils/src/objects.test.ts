import { describe, it, expect } from 'vitest';
import {
  pick,
  omit,
  deepMerge,
  isEmpty,
  removeUndefined,
  removeUndefinedOnly,
  deepClone,
  flatten,
  unflatten,
  get,
  set,
  has,
  mapKeys,
  mapValues,
  isPlainObject,
  deepEqual,
} from './objects';

describe('objects', () => {
  describe('pick', () => {
    it('should pick specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });

    it('should handle non-existent keys', () => {
      const obj = { a: 1, b: 2 };
      expect(pick(obj, ['a', 'c' as keyof typeof obj])).toEqual({ a: 1 });
    });

    it('should return empty object for empty keys', () => {
      const obj = { a: 1, b: 2 };
      expect(pick(obj, [])).toEqual({});
    });

    it('should handle nested objects', () => {
      const obj = { a: { nested: 1 }, b: 2 };
      const picked = pick(obj, ['a']);
      expect(picked).toEqual({ a: { nested: 1 } });
    });
  });

  describe('omit', () => {
    it('should omit specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
    });

    it('should handle non-existent keys', () => {
      const obj = { a: 1, b: 2 };
      expect(omit(obj, ['c' as keyof typeof obj])).toEqual({ a: 1, b: 2 });
    });

    it('should return full object for empty keys', () => {
      const obj = { a: 1, b: 2 };
      expect(omit(obj, [])).toEqual({ a: 1, b: 2 });
    });
  });

  describe('deepMerge', () => {
    it('should merge simple objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      expect(deepMerge(target, source)).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should deep merge nested objects', () => {
      const target = { a: { x: 1, y: 2 }, b: 3 };
      const source = { a: { y: 3, z: 4 }, c: 5 } as unknown as Partial<typeof target>;
      expect(deepMerge(target, source)).toEqual({
        a: { x: 1, y: 3, z: 4 },
        b: 3,
        c: 5,
      });
    });

    it('should handle arrays by replacing', () => {
      const target = { arr: [1, 2, 3] };
      const source = { arr: [4, 5] };
      expect(deepMerge(target, source)).toEqual({ arr: [4, 5] });
    });

    it('should not mutate original objects', () => {
      const target = { a: { x: 1 } };
      const source = { a: { y: 2 } } as unknown as Partial<typeof target>;
      const result = deepMerge(target, source);

      expect(target).toEqual({ a: { x: 1 } });
      expect(source).toEqual({ a: { y: 2 } });
      expect(result).toEqual({ a: { x: 1, y: 2 } });
    });

    it('should handle null and undefined', () => {
      const target = { a: 1, b: null };
      const source = { b: 2, c: undefined } as unknown as Partial<typeof target>;
      expect(deepMerge(target, source)).toEqual({ a: 1, b: 2, c: undefined });
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty object', () => {
      expect(isEmpty({})).toBe(true);
    });

    it('should return false for non-empty object', () => {
      expect(isEmpty({ a: 1 })).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(isEmpty([])).toBe(true);
    });

    it('should return false for non-empty array', () => {
      expect(isEmpty([1])).toBe(false);
    });

    it('should return true for null', () => {
      expect(isEmpty(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isEmpty(undefined)).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isEmpty('')).toBe(true);
    });

    it('should return false for non-empty string', () => {
      expect(isEmpty('hello')).toBe(false);
    });
  });

  describe('removeUndefined', () => {
    it('should remove undefined values', () => {
      const obj = { a: 1, b: undefined, c: 3 };
      expect(removeUndefined(obj)).toEqual({ a: 1, c: 3 });
    });

    it('should remove null values', () => {
      const obj = { a: 1, b: null, c: undefined };
      expect(removeUndefined(obj)).toEqual({ a: 1 });
    });
  });

  describe('removeUndefinedOnly', () => {
    it('should remove only undefined values', () => {
      const obj = { a: 1, b: undefined, c: 3 };
      expect(removeUndefinedOnly(obj)).toEqual({ a: 1, c: 3 });
    });

    it('should keep null values', () => {
      const obj = { a: 1, b: null, c: undefined };
      expect(removeUndefinedOnly(obj)).toEqual({ a: 1, b: null });
    });
  });

  describe('deepClone', () => {
    it('should clone simple object', () => {
      const obj = { a: 1, b: 2 };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
    });

    it('should clone nested objects', () => {
      const obj = { a: { b: { c: 1 } } };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned.a).not.toBe(obj.a);
      expect(cloned.a.b).not.toBe(obj.a.b);
    });

    it('should clone arrays', () => {
      const obj = { arr: [1, 2, { x: 3 }] };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned.arr).not.toBe(obj.arr);
      expect(cloned.arr[2]).not.toBe(obj.arr[2]);
    });

    it('should handle Date objects', () => {
      const obj = { date: new Date('2024-01-01') };
      const cloned = deepClone(obj);

      expect(cloned.date).toEqual(obj.date);
      expect(cloned.date).not.toBe(obj.date);
    });

    it('should handle primitives', () => {
      expect(deepClone(1)).toBe(1);
      expect(deepClone('string')).toBe('string');
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
    });
  });

  describe('flatten', () => {
    it('should flatten nested object', () => {
      const obj = { a: { b: { c: 1 } } };
      expect(flatten(obj)).toEqual({ 'a.b.c': 1 });
    });

    it('should handle multiple keys', () => {
      const obj = { a: { b: 1, c: 2 }, d: 3 };
      expect(flatten(obj)).toEqual({
        'a.b': 1,
        'a.c': 2,
        d: 3,
      });
    });

    it('should handle empty object', () => {
      expect(flatten({})).toEqual({});
    });
  });

  describe('unflatten', () => {
    it('should unflatten to nested object', () => {
      const obj = { 'a.b.c': 1 };
      expect(unflatten(obj)).toEqual({ a: { b: { c: 1 } } });
    });

    it('should handle multiple keys', () => {
      const obj = { 'a.b': 1, 'a.c': 2, d: 3 };
      expect(unflatten(obj)).toEqual({
        a: { b: 1, c: 2 },
        d: 3,
      });
    });

    it('should be inverse of flatten', () => {
      const original = { a: { b: { c: 1 } }, d: { e: 2 } };
      const flattened = flatten(original);
      const unflattened = unflatten(flattened);
      expect(unflattened).toEqual(original);
    });
  });

  describe('get', () => {
    it('should get nested value', () => {
      const obj = { a: { b: { c: 1 } } };
      expect(get(obj, 'a.b.c')).toBe(1);
    });

    it('should return default for missing path', () => {
      const obj = { a: 1 };
      expect(get(obj, 'b.c.d', 'default')).toBe('default');
    });

    it('should handle array indexes', () => {
      const obj = { arr: [{ x: 1 }, { x: 2 }] };
      expect(get(obj, 'arr.1.x')).toBe(2);
    });

    it('should return undefined for missing path without default', () => {
      const obj = { a: 1 };
      expect(get(obj, 'b.c')).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should set nested value', () => {
      const obj = { a: {} };
      set(obj, 'a.b.c', 1);
      expect(obj).toEqual({ a: { b: { c: 1 } } });
    });

    it('should create intermediate objects', () => {
      const obj = {};
      set(obj, 'a.b.c', 1);
      expect(obj).toEqual({ a: { b: { c: 1 } } });
    });

    it('should handle array indexes', () => {
      const obj: Record<string, unknown> = { arr: [] };
      set(obj, 'arr.0', 1);
      expect(obj).toEqual({ arr: [1] });
    });

    it('should overwrite existing values', () => {
      const obj = { a: { b: 1 } };
      set(obj, 'a.b', 2);
      expect(obj).toEqual({ a: { b: 2 } });
    });
  });

  describe('has', () => {
    it('should return true for existing path', () => {
      const obj = { a: { b: 1 } };
      expect(has(obj, 'a.b')).toBe(true);
    });

    it('should return false for missing path', () => {
      const obj = { a: 1 };
      expect(has(obj, 'b.c')).toBe(false);
    });

    it('should return true for null value', () => {
      const obj = { a: null };
      expect(has(obj, 'a')).toBe(true);
    });

    it('should return true for undefined value', () => {
      const obj = { a: undefined };
      expect(has(obj, 'a')).toBe(true);
    });
  });

  describe('mapKeys', () => {
    it('should transform keys', () => {
      const obj = { a: 1, b: 2 };
      expect(mapKeys(obj, (key) => key.toUpperCase())).toEqual({
        A: 1,
        B: 2,
      });
    });
  });

  describe('mapValues', () => {
    it('should transform values', () => {
      const obj = { a: 1, b: 2 };
      expect(mapValues(obj, (value) => (value as number) * 2)).toEqual({
        a: 2,
        b: 4,
      });
    });

    it('should pass key to callback', () => {
      const obj = { a: 1, b: 2 };
      expect(mapValues(obj, (value, key) => `${key}:${value}`)).toEqual({
        a: 'a:1',
        b: 'b:2',
      });
    });
  });

  describe('isPlainObject', () => {
    it('should return true for plain objects', () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ a: 1 })).toBe(true);
    });

    it('should return false for arrays', () => {
      expect(isPlainObject([])).toBe(false);
    });

    it('should return false for null', () => {
      expect(isPlainObject(null)).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isPlainObject('string')).toBe(false);
      expect(isPlainObject(123)).toBe(false);
    });
  });

  describe('deepEqual', () => {
    it('should return true for equal objects', () => {
      expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
    });

    it('should return true for nested equal objects', () => {
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    });

    it('should return false for different values', () => {
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('should return false for different keys', () => {
      expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    });

    it('should handle arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
    });
  });
});
