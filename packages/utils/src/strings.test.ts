import { describe, it, expect } from 'vitest';
import {
  slugify,
  truncate,
  capitalize,
  titleCase,
  camelToSnake,
  snakeToCamel,
  sanitizeHtml,
  stripHtml,
  pluralize,
  generateInitials,
  maskEmail,
  maskPhone,
  kebabToCamel,
  camelToKebab,
  countWords,
  isAlphanumeric,
  pad,
  extractNumbers,
} from './strings';

describe('strings', () => {
  describe('slugify', () => {
    it('should convert text to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should handle special characters', () => {
      expect(slugify('Hello, World! @2024')).toBe('hello-world-2024');
    });

    it('should handle multiple spaces', () => {
      expect(slugify('Hello   World')).toBe('hello-world');
    });

    it('should trim leading/trailing hyphens', () => {
      expect(slugify('  Hello World  ')).toBe('hello-world');
    });

    it('should handle accented characters', () => {
      expect(slugify('Héllo Wörld')).toBe('hello-world');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
    });

    it('should not truncate short strings', () => {
      expect(truncate('Hi', 10)).toBe('Hi');
    });

    it('should use custom suffix', () => {
      expect(truncate('Hello World', 6, '…')).toBe('Hello…');
    });

    it('should handle empty strings', () => {
      expect(truncate('', 10)).toBe('');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should handle already capitalized', () => {
      expect(capitalize('Hello')).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
    });
  });

  describe('titleCase', () => {
    it('should convert to title case', () => {
      expect(titleCase('hello world')).toBe('Hello World');
    });

    it('should handle mixed case', () => {
      expect(titleCase('hELLO wORLD')).toBe('Hello World');
    });

    it('should handle multiple spaces', () => {
      expect(titleCase('hello   world')).toBe('Hello   World');
    });
  });

  describe('camelToSnake', () => {
    it('should convert camelCase to snake_case', () => {
      expect(camelToSnake('helloWorld')).toBe('hello_world');
    });

    it('should handle PascalCase', () => {
      expect(camelToSnake('HelloWorld')).toBe('hello_world');
    });

    it('should handle single word', () => {
      expect(camelToSnake('hello')).toBe('hello');
    });
  });

  describe('snakeToCamel', () => {
    it('should convert snake_case to camelCase', () => {
      expect(snakeToCamel('hello_world')).toBe('helloWorld');
    });

    it('should handle single word', () => {
      expect(snakeToCamel('hello')).toBe('hello');
    });
  });

  describe('kebabToCamel', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(kebabToCamel('hello-world')).toBe('helloWorld');
    });

    it('should handle single word', () => {
      expect(kebabToCamel('hello')).toBe('hello');
    });
  });

  describe('camelToKebab', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(camelToKebab('helloWorld')).toBe('hello-world');
    });

    it('should handle PascalCase', () => {
      expect(camelToKebab('HelloWorld')).toBe('hello-world');
    });
  });

  describe('sanitizeHtml', () => {
    it('should escape script tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should escape dangerous characters', () => {
      const input = '<p onclick="evil()">Hello</p>';
      const result = sanitizeHtml(input);
      expect(result).toContain('&lt;p');
    });
  });

  describe('stripHtml', () => {
    it('should remove all HTML tags', () => {
      expect(stripHtml('<p>Hello <strong>World</strong></p>')).toBe('Hello World');
    });

    it('should handle self-closing tags', () => {
      expect(stripHtml('Hello<br/>World')).toBe('HelloWorld');
    });

    it('should handle no HTML', () => {
      expect(stripHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('pluralize', () => {
    it('should use singular for 1', () => {
      expect(pluralize('item', 1)).toBe('item');
    });

    it('should use plural for 0', () => {
      expect(pluralize('item', 0)).toBe('items');
    });

    it('should use plural for more than 1', () => {
      expect(pluralize('item', 5)).toBe('items');
    });

    it('should use custom plural', () => {
      expect(pluralize('child', 2, 'children')).toBe('children');
    });
  });

  describe('generateInitials', () => {
    it('should generate initials from full name', () => {
      expect(generateInitials('John Doe')).toBe('JD');
    });

    it('should handle single name', () => {
      expect(generateInitials('John')).toBe('J');
    });

    it('should limit to max length', () => {
      expect(generateInitials('John Michael Doe', 2)).toBe('JM');
    });

    it('should handle extra whitespace', () => {
      expect(generateInitials('  John   Doe  ')).toBe('JD');
    });
  });

  describe('maskEmail', () => {
    it('should mask email address', () => {
      expect(maskEmail('test@example.com')).toBe('t***@example.com');
    });

    it('should handle short usernames', () => {
      expect(maskEmail('a@example.com')).toBe('a***@example.com');
    });

    it('should handle long usernames', () => {
      const result = maskEmail('longusername@example.com');
      expect(result).toContain('***');
      expect(result).toContain('@example.com');
    });
  });

  describe('maskPhone', () => {
    it('should mask phone number showing last 4 digits', () => {
      expect(maskPhone('1234567890')).toBe('***-***-7890');
    });

    it('should handle formatted phone', () => {
      const result = maskPhone('(123) 456-7890');
      expect(result).toContain('7890');
    });

    it('should handle short numbers', () => {
      expect(maskPhone('123')).toBe('****');
    });
  });

  describe('isAlphanumeric', () => {
    it('should return true for alphanumeric strings', () => {
      expect(isAlphanumeric('abc123')).toBe(true);
    });

    it('should return false for strings with spaces', () => {
      expect(isAlphanumeric('abc 123')).toBe(false);
    });

    it('should return false for strings with special chars', () => {
      expect(isAlphanumeric('abc-123')).toBe(false);
    });
  });

  describe('pad', () => {
    it('should pad start by default', () => {
      expect(pad('5', 3, '0')).toBe('005');
    });

    it('should pad end', () => {
      expect(pad('5', 3, '0', 'end')).toBe('500');
    });

    it('should return original if already at length', () => {
      expect(pad('123', 3, '0')).toBe('123');
    });
  });

  describe('extractNumbers', () => {
    it('should extract numbers from text', () => {
      expect(extractNumbers('I have 3 apples and 5 oranges')).toEqual([3, 5]);
    });

    it('should handle decimals', () => {
      expect(extractNumbers('Price: $12.99')).toEqual([12.99]);
    });

    it('should handle negative numbers', () => {
      expect(extractNumbers('Temperature: -5 degrees')).toEqual([-5]);
    });

    it('should return empty array for no numbers', () => {
      expect(extractNumbers('no numbers here')).toEqual([]);
    });
  });

  describe('countWords', () => {
    it('should count words correctly', () => {
      expect(countWords('Hello World')).toBe(2);
    });

    it('should handle multiple spaces', () => {
      expect(countWords('Hello   World   Test')).toBe(3);
    });

    it('should handle empty string', () => {
      expect(countWords('')).toBe(0);
    });

    it('should handle whitespace only', () => {
      expect(countWords('   ')).toBe(0);
    });
  });
});
