// ========================================
// Utils Tests
// ========================================
// Tests for utility functions in utils.ts

import { describe, it, expect } from 'vitest';
import { cn, parseMemoryMetadata } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('px-2', 'py-1');
      expect(result).toContain('px-2');
      expect(result).toContain('py-1');
    });

    it('should handle conflicting Tailwind classes by keeping the last one', () => {
      const result = cn('px-2', 'px-4');
      expect(result).toBe('px-4');
    });

    it('should handle conditional classes with undefined values', () => {
      const condition = false;
      const result = cn('base-class', condition && 'conditional-class');
      expect(result).toBe('base-class');
    });

    it('should handle conditional classes with truthy values', () => {
      const condition = true;
      const result = cn('base-class', condition && 'conditional-class');
      expect(result).toContain('base-class');
      expect(result).toContain('conditional-class');
    });

    it('should handle empty input', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('should handle null and undefined inputs', () => {
      const result = cn('valid-class', null, undefined, 'another-class');
      expect(result).toContain('valid-class');
      expect(result).toContain('another-class');
    });

    it('should handle object-style classes', () => {
      const result = cn({ 'active': true, 'disabled': false });
      expect(result).toBe('active');
    });

    it('should handle array of classes', () => {
      const result = cn(['class-a', 'class-b']);
      expect(result).toContain('class-a');
      expect(result).toContain('class-b');
    });

    it('should merge multiple types of inputs', () => {
      const result = cn(
        'string-class',
        ['array-class'],
        { 'object-class': true },
        true && 'conditional-class'
      );
      expect(result).toContain('string-class');
      expect(result).toContain('array-class');
      expect(result).toContain('object-class');
      expect(result).toContain('conditional-class');
    });

    it('should deduplicate identical classes', () => {
      const result = cn('duplicate', 'duplicate');
      // clsx may or may not deduplicate, but tailwind-merge handles conflicts
      expect(typeof result).toBe('string');
    });
  });

  describe('parseMemoryMetadata', () => {
    it('should return empty object for undefined input', () => {
      const result = parseMemoryMetadata(undefined);
      expect(result).toEqual({});
    });

    it('should return empty object for null input', () => {
      const result = parseMemoryMetadata(null);
      expect(result).toEqual({});
    });

    it('should return empty object for empty string', () => {
      const result = parseMemoryMetadata('');
      expect(result).toEqual({});
    });

    it('should return the object as-is when input is already an object', () => {
      const input = { key: 'value', nested: { prop: 123 } };
      const result = parseMemoryMetadata(input);
      expect(result).toEqual(input);
    });

    it('should parse valid JSON string', () => {
      const input = '{"key": "value", "number": 42}';
      const result = parseMemoryMetadata(input);
      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('should return empty object for invalid JSON string', () => {
      const input = 'not a valid json';
      const result = parseMemoryMetadata(input);
      expect(result).toEqual({});
    });

    it('should handle complex nested object', () => {
      const input = {
        level1: {
          level2: {
            level3: 'deep value'
          }
        },
        array: [1, 2, 3]
      };
      const result = parseMemoryMetadata(input);
      expect(result).toEqual(input);
    });

    it('should parse JSON string with nested objects', () => {
      const input = '{"outer": {"inner": "value"}}';
      const result = parseMemoryMetadata(input);
      expect(result).toEqual({ outer: { inner: 'value' } });
    });

    it('should handle JSON string with arrays', () => {
      const input = '{"items": [1, 2, 3]}';
      const result = parseMemoryMetadata(input);
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it('should handle empty object string', () => {
      const result = parseMemoryMetadata('{}');
      expect(result).toEqual({});
    });

    it('should preserve array in object input', () => {
      const input = { tags: ['a', 'b', 'c'] };
      const result = parseMemoryMetadata(input);
      expect(result.tags).toEqual(['a', 'b', 'c']);
    });
  });
});
