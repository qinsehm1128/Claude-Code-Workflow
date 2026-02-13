// ========================================
// A2UI Parser Unit Tests
// ========================================
// Tests for A2UI protocol parsing and validation

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { a2uiParser, A2UIParseError } from '../core/A2UIParser';

// Import component renderers to trigger auto-registration
import '../renderer/components';

describe('A2UIParser', () => {
  describe('parse()', () => {
    it('should parse valid surface update JSON', () => {
      const validJson = JSON.stringify({
        surfaceId: 'test-surface',
        components: [
          {
            id: 'comp-1',
            component: {
              Text: {
                text: { literalString: 'Hello, World!' },
                usageHint: 'h1',
              },
            },
          },
        ],
        initialState: { key: 'value' },
      });

      const result = a2uiParser.parse(validJson);

      expect(result).toEqual({
        surfaceId: 'test-surface',
        components: [
          {
            id: 'comp-1',
            component: {
              Text: {
                text: { literalString: 'Hello, World!' },
                usageHint: 'h1',
              },
            },
          },
        ],
        initialState: { key: 'value' },
      });
    });

    it('should throw A2UIParseError on invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => a2uiParser.parse(invalidJson)).toThrow(A2UIParseError);
      expect(() => a2uiParser.parse(invalidJson)).toThrow('Invalid JSON');
    });

    it('should throw A2UIParseError on validation failure', () => {
      const invalidSchema = JSON.stringify({
        surfaceId: 'test',
        // Missing required components array
      });

      expect(() => a2uiParser.parse(invalidSchema)).toThrow(A2UIParseError);
      expect(() => a2uiParser.parse(invalidSchema)).toThrow('A2UI validation failed');
    });

    it('should parse surface with all component types', () => {
      const complexJson = JSON.stringify({
        surfaceId: 'complex-surface',
        components: [
          {
            id: 'text-1',
            component: { Text: { text: { literalString: 'Text' } } },
          },
          {
            id: 'button-1',
            component: {
              Button: {
                onClick: { actionId: 'click' },
                content: { Text: { text: { literalString: 'Click me' } } },
                variant: 'primary',
              },
            },
          },
          {
            id: 'dropdown-1',
            component: {
              Dropdown: {
                options: [
                  { label: { literalString: 'Option 1' }, value: 'opt1' },
                  { label: { literalString: 'Option 2' }, value: 'opt2' },
                ],
                onChange: { actionId: 'change' },
              },
            },
          },
          {
            id: 'textfield-1',
            component: {
              TextField: {
                value: { literalString: 'input' },
                onChange: { actionId: 'input' },
              },
            },
          },
          {
            id: 'textarea-1',
            component: {
              TextArea: {
                onChange: { actionId: 'textarea' },
                rows: 5,
              },
            },
          },
          {
            id: 'checkbox-1',
            component: {
              Checkbox: {
                checked: { literalBoolean: true },
                onChange: { actionId: 'check' },
              },
            },
          },
          {
            id: 'codeblock-1',
            component: {
              CodeBlock: {
                code: { literalString: 'console.log("hello");' },
                language: 'javascript',
              },
            },
          },
          {
            id: 'progress-1',
            component: {
              Progress: {
                value: { literalNumber: 50 },
                max: 100,
              },
            },
          },
          {
            id: 'card-1',
            component: {
              Card: {
                title: { literalString: 'Card Title' },
                content: [
                  { Text: { text: { literalString: 'Card content' } } },
                ],
              },
            },
          },
          {
            id: 'clioutput-1',
            component: {
              CLIOutput: {
                output: { literalString: 'Command output' },
                language: 'bash',
                streaming: true,
              },
            },
          },
          {
            id: 'datetime-1',
            component: {
              DateTimeInput: {
                onChange: { actionId: 'datetime' },
                includeTime: true,
              },
            },
          },
        ],
      });

      const result = a2uiParser.parse(complexJson);
      expect(result.components).toHaveLength(11);
    });
  });

  describe('parseObject()', () => {
    it('should validate and return surface update object', () => {
      const validObject = {
        surfaceId: 'test-surface',
        components: [
          {
            id: 'comp-1',
            component: {
              Text: { text: { literalString: 'Test' } },
            },
          },
        ],
      };

      const result = a2uiParser.parseObject(validObject);
      expect(result).toEqual(validObject);
    });

    it('should throw A2UIParseError on invalid object', () => {
      const invalidObject = { surfaceId: 'test' }; // Missing components

      expect(() => a2uiParser.parseObject(invalidObject)).toThrow(A2UIParseError);
    });
  });

  describe('validate()', () => {
    it('should return true for valid surface update', () => {
      const validUpdate = {
        surfaceId: 'test',
        components: [
          {
            id: 'comp-1',
            component: { Text: { text: { literalString: 'Test' } } },
          },
        ],
      };

      expect(a2uiParser.validate(validUpdate)).toBe(true);
    });

    it('should return false for invalid surface update', () => {
      const invalidUpdate = { surfaceId: 'test' };

      expect(a2uiParser.validate(invalidUpdate)).toBe(false);
    });

    it('should work as type guard', () => {
      const unknownValue: unknown = {
        surfaceId: 'test',
        components: [
          {
            id: 'comp-1',
            component: { Text: { text: { literalString: 'Test' } } },
          },
        ],
      };

      if (a2uiParser.validate(unknownValue)) {
        // TypeScript should know this is SurfaceUpdate
        expect(unknownValue.surfaceId).toBe('test');
        expect(unknownValue.components).toBeDefined();
      } else {
        expect.fail('Should have validated successfully');
      }
    });
  });

  describe('safeParse()', () => {
    it('should return success with data for valid JSON', () => {
      const validJson = JSON.stringify({
        surfaceId: 'test',
        components: [{ id: '1', component: { Text: { text: { literalString: 'Test' } } } }],
      });

      const result = a2uiParser.safeParse(validJson);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.surfaceId).toBe('test');
      }
    });

    it('should return error for invalid JSON', () => {
      const invalidJson = '{ invalid }';

      const result = a2uiParser.safeParse(invalidJson);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('safeParseObject()', () => {
    it('should return success with data for valid object', () => {
      const validObject = {
        surfaceId: 'test',
        components: [{ id: '1', component: { Text: { text: { literalString: 'Test' } } } }],
      };

      const result = a2uiParser.safeParseObject(validObject);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.surfaceId).toBe('test');
      }
    });

    it('should return error for invalid object', () => {
      const invalidObject = { invalid: 'object' };

      const result = a2uiParser.safeParseObject(invalidObject);

      expect(result.success).toBe(false);
    });
  });

  describe('validateComponent()', () => {
    it('should return true for valid Text component', () => {
      const validComponent = { Text: { text: { literalString: 'Hello' } } };

      expect(a2uiParser.validateComponent(validComponent)).toBe(true);
    });

    it('should return true for valid Button component', () => {
      const validComponent = {
        Button: {
          onClick: { actionId: 'click' },
          content: { Text: { text: { literalString: 'Click' } } },
        },
      };

      expect(a2uiParser.validateComponent(validComponent)).toBe(true);
    });

    it('should return true for valid CLIOutput component', () => {
      const validComponent = {
        CLIOutput: {
          output: { literalString: 'Output' },
          language: 'bash',
          streaming: false,
        },
      };

      expect(a2uiParser.validateComponent(validComponent)).toBe(true);
    });

    it('should return true for valid DateTimeInput component', () => {
      const validComponent = {
        DateTimeInput: {
          onChange: { actionId: 'change' },
          includeTime: true,
        },
      };

      expect(a2uiParser.validateComponent(validComponent)).toBe(true);
    });

    it('should return false for invalid component', () => {
      const invalidComponent = { InvalidComponent: {} };

      expect(a2uiParser.validateComponent(invalidComponent)).toBe(false);
    });

    it('should work as type guard', () => {
      const unknownValue: unknown = { Text: { text: { literalString: 'Test' } } };

      if (a2uiParser.validateComponent(unknownValue)) {
        // TypeScript should know this is A2UIComponent
        expect('Text' in unknownValue).toBe(true);
      } else {
        expect.fail('Should have validated successfully');
      }
    });
  });

  describe('A2UIParseError', () => {
    it('should have correct name', () => {
      const error = new A2UIParseError('Test error');
      expect(error.name).toBe('A2UIParseError');
    });

    it('should store original error', () => {
      const originalError = new Error('Original');
      const parseError = new A2UIParseError('Parse failed', originalError);

      expect(parseError.originalError).toBe(originalError);
    });

    it('should provide details for Zod errors', () => {
      // Create a real ZodError with actual issues
      const zodError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          path: ['components', 0, 'id'],
          expected: 'string',
          message: 'Required',
        } as any,
        {
          code: 'invalid_format' as any,
          path: ['surfaceId'],
          message: 'Invalid format',
        } as any,
      ]);

      const parseError = new A2UIParseError('Validation failed', zodError);
      const details = parseError.getDetails();

      expect(details).toContain('components.0.id');
      expect(details).toContain('surfaceId');
      expect(details).toContain('Required');
      expect(details).toContain('Invalid format');
    });

    it('should provide message for Error original errors', () => {
      const originalError = new Error('Something went wrong');
      const parseError = new A2UIParseError('Parse failed', originalError);
      const details = parseError.getDetails();

      expect(details).toBe('Something went wrong');
    });

    it('should return basic message for unknown error types', () => {
      const parseError = new A2UIParseError('Unknown error', 'string error');
      const details = parseError.getDetails();

      expect(details).toBe('Unknown error');
    });
  });
});
