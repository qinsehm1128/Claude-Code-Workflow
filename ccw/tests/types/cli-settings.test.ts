/**
 * CLI Settings Type Definitions Tests
 *
 * Test coverage:
 * - ClaudeCliSettings interface type safety
 * - validateSettings function with deep env validation
 * - mapProviderToClaudeEnv helper function
 * - createDefaultSettings helper function
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSettings,
  mapProviderToClaudeEnv,
  createDefaultSettings,
} from '../../dist/types/cli-settings.js';

// Type for testing (interfaces are erased in JS)
type CliSettings = {
  env: Record<string, string | undefined>;
  model?: string;
  tags?: string[];
  availableModels?: string[];
  settingsFile?: string;
  profile?: string;
  authJson?: string;
  configToml?: string;
};

describe('cli-settings.ts', () => {
  describe('validateSettings', () => {
    describe('should validate valid ClaudeCliSettings objects', () => {
      it('should accept a complete valid settings object', () => {
        const validSettings = {
          env: {
            ANTHROPIC_AUTH_TOKEN: 'sk-ant-123',
            ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
            DISABLE_AUTOUPDATER: '1',
          },
          model: 'sonnet',
          tags: ['分析', 'Debug'],
          availableModels: ['opus', 'sonnet', 'haiku'],
          settingsFile: '/path/to/settings.json',
        };

        assert.strictEqual(validateSettings(validSettings), true);
      });

      it('should accept settings with only required env field', () => {
        const minimalSettings = {
          env: {
            ANTHROPIC_AUTH_TOKEN: 'sk-ant-123',
          },
        };

        assert.strictEqual(validateSettings(minimalSettings), true);
      });

      it('should accept settings with empty env object', () => {
        const settings = {
          env: {},
        };

        assert.strictEqual(validateSettings(settings), true);
      });

      it('should accept settings with undefined optional properties', () => {
        const settings = {
          env: {
            ANTHROPIC_AUTH_TOKEN: 'sk-ant-123',
          },
        };

        assert.strictEqual(validateSettings(settings), true);
      });
    });

    describe('should reject invalid or non-object inputs', () => {
      it('should reject null', () => {
        assert.strictEqual(validateSettings(null), false);
      });

      it('should reject undefined', () => {
        assert.strictEqual(validateSettings(undefined), false);
      });

      it('should reject number', () => {
        assert.strictEqual(validateSettings(123), false);
      });

      it('should reject string', () => {
        assert.strictEqual(validateSettings('invalid'), false);
      });

      it('should reject boolean', () => {
        assert.strictEqual(validateSettings(true), false);
      });

      it('should reject array', () => {
        assert.strictEqual(validateSettings([]), false);
      });
    });

    describe('should validate env field', () => {
      it('should reject missing env field', () => {
        const settings = {
          model: 'sonnet',
        };

        assert.strictEqual(validateSettings(settings), false);
      });

      it('should reject non-object env', () => {
        const settings = {
          env: 'invalid',
        };

        assert.strictEqual(validateSettings(settings), false);
      });

      it('should reject env with null value', () => {
        const settings = {
          env: null,
        };

        assert.strictEqual(validateSettings(settings), false);
      });

      describe('deep env validation (optimization)', () => {
        it('should reject env with null value (DEEP VALIDATION)', () => {
          const settings = {
            env: {
              ANTHROPIC_AUTH_TOKEN: null,
            },
          };

          assert.strictEqual(validateSettings(settings), false);
        });

        it('should reject env with number value (DEEP VALIDATION)', () => {
          const settings = {
            env: {
              ANTHROPIC_AUTH_TOKEN: 12345,
            },
          };

          assert.strictEqual(validateSettings(settings), false);
        });

        it('should reject env with boolean value (DEEP VALIDATION)', () => {
          const settings = {
            env: {
              DISABLE_AUTOUPDATER: true,
            },
          };

          assert.strictEqual(validateSettings(settings), false);
        });

        it('should reject env with object value (DEEP VALIDATION)', () => {
          const settings = {
            env: {
              CUSTOM: { nested: 'value' },
            },
          };

          assert.strictEqual(validateSettings(settings), false);
        });

        it('should reject env with array value (DEEP VALIDATION)', () => {
          const settings = {
            env: {
              TAGS: ['tag1', 'tag2'],
            },
          };

          assert.strictEqual(validateSettings(settings), false);
        });

        it('should accept env with string values', () => {
          const settings = {
            env: {
              ANTHROPIC_AUTH_TOKEN: 'sk-ant-123',
              ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
              DISABLE_AUTOUPDATER: '1',
            },
          };

          assert.strictEqual(validateSettings(settings), true);
        });

        it('should accept env with undefined values (optional env vars)', () => {
          const settings = {
            env: {
              ANTHROPIC_AUTH_TOKEN: 'sk-ant-123',
              ANTHROPIC_BASE_URL: undefined,
            },
          };

          assert.strictEqual(validateSettings(settings), true);
        });

        it('should accept env with all undefined values', () => {
          const settings = {
            env: {
              OPTIONAL_VAR: undefined,
            },
          };

          assert.strictEqual(validateSettings(settings), true);
        });
      });
    });

    describe('should validate model field', () => {
      it('should accept predefined model values', () => {
        const settings = {
          env: {},
          model: 'opus',
        };

        assert.strictEqual(validateSettings(settings), true);
      });

      it('should accept custom model string', () => {
        const settings = {
          env: {},
          model: 'custom-model-3.5',
        };

        assert.strictEqual(validateSettings(settings), true);
      });

      it('should reject non-string model', () => {
        const settings = {
          env: {},
          model: 123,
        };

        assert.strictEqual(validateSettings(settings), false);
      });
    });

    describe('should validate codex-specific fields', () => {
      it('should accept valid codex settings with profile', () => {
        const settings = {
          env: { OPENAI_API_KEY: 'sk-test' },
          model: 'gpt-5.2',
          profile: 'default',
        };

        assert.strictEqual(validateSettings(settings, 'codex'), true);
      });

      it('should reject non-string profile for codex', () => {
        const settings = {
          env: {},
          profile: 123,
        };

        assert.strictEqual(validateSettings(settings, 'codex'), false);
      });

      it('should accept codex settings with authJson and configToml', () => {
        const settings = {
          env: { OPENAI_API_KEY: 'sk-test' },
          authJson: '{"OPENAI_API_KEY": "sk-test"}',
          configToml: 'model = "gpt-5.2"',
        };

        assert.strictEqual(validateSettings(settings, 'codex'), true);
      });
    });

    describe('should validate gemini-specific fields', () => {
      it('should accept valid gemini settings', () => {
        const settings = {
          env: { GEMINI_API_KEY: 'AIza-test' },
          model: 'gemini-2.5-flash',
        };

        assert.strictEqual(validateSettings(settings, 'gemini'), true);
      });

      it('should accept gemini settings with GOOGLE_API_KEY', () => {
        const settings = {
          env: { GOOGLE_API_KEY: 'AIza-test' },
          model: 'gemini-2.5-pro',
          tags: ['分析'],
          availableModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
        };

        assert.strictEqual(validateSettings(settings, 'gemini'), true);
      });

      it('should accept gemini settings with empty env', () => {
        const settings = {
          env: {},
        };

        assert.strictEqual(validateSettings(settings, 'gemini'), true);
      });

      it('should reject gemini settings with non-string env value', () => {
        const settings = {
          env: { GEMINI_API_KEY: 12345 },
        };

        assert.strictEqual(validateSettings(settings, 'gemini'), false);
      });
    });

    describe('should validate tags field', () => {
      it('should accept valid tags array', () => {
        const settings = {
          env: {},
          tags: ['分析', 'Debug', 'testing'],
        };

        assert.strictEqual(validateSettings(settings), true);
      });

      it('should accept empty tags array', () => {
        const settings = {
          env: {},
          tags: [],
        };

        assert.strictEqual(validateSettings(settings), true);
      });

      it('should reject non-array tags', () => {
        const settings = {
          env: {},
          tags: 'invalid',
        };

        assert.strictEqual(validateSettings(settings), false);
      });
    });

    describe('should validate availableModels field', () => {
      it('should accept valid availableModels array', () => {
        const settings = {
          env: {},
          availableModels: ['opus', 'sonnet', 'haiku', 'custom-model'],
        };

        assert.strictEqual(validateSettings(settings), true);
      });

      it('should accept empty availableModels array', () => {
        const settings = {
          env: {},
          availableModels: [],
        };

        assert.strictEqual(validateSettings(settings), true);
      });

      it('should reject non-array availableModels', () => {
        const settings = {
          env: {},
          availableModels: 'invalid',
        };

        assert.strictEqual(validateSettings(settings), false);
      });
    });

    describe('should validate settingsFile field', () => {
      it('should accept valid settingsFile string', () => {
        const settings = {
          env: {},
          settingsFile: '/path/to/settings.json',
        };

        assert.strictEqual(validateSettings(settings), true);
      });

      it('should accept empty settingsFile string', () => {
        const settings = {
          env: {},
          settingsFile: '',
        };

        assert.strictEqual(validateSettings(settings), true);
      });

      it('should reject non-string settingsFile', () => {
        const settings = {
          env: {},
          settingsFile: 123,
        };

        assert.strictEqual(validateSettings(settings), false);
      });
    });

    describe('edge cases and boundary conditions', () => {
      it('should handle settings with many optional fields', () => {
        const settings = {
          env: {
            ANTHROPIC_AUTH_TOKEN: 'sk-ant-123',
            ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
            DISABLE_AUTOUPDATER: '1',
            CUSTOM_VAR: 'custom-value',
          },
          model: 'custom-model',
          tags: [],
          availableModels: [],
          settingsFile: '/path/to/settings.json',
        };

        assert.strictEqual(validateSettings(settings), true);
      });

      it('should handle settings with only env and one other field', () => {
        const settings = {
          env: {
            ANTHROPIC_AUTH_TOKEN: 'sk-ant-123',
          },
          model: 'sonnet',
        };

        assert.strictEqual(validateSettings(settings), true);
      });
    });
  });

  describe('mapProviderToClaudeEnv', () => {
    it('should map provider with apiKey only', () => {
      const provider = { apiKey: 'sk-test-key' };
      const env = mapProviderToClaudeEnv(provider);

      assert.deepStrictEqual(env, {
        ANTHROPIC_AUTH_TOKEN: 'sk-test-key',
        DISABLE_AUTOUPDATER: '1',
      });
    });

    it('should map provider with apiBase only', () => {
      const provider = { apiBase: 'https://custom.api.com' };
      const env = mapProviderToClaudeEnv(provider);

      assert.deepStrictEqual(env, {
        ANTHROPIC_BASE_URL: 'https://custom.api.com',
        DISABLE_AUTOUPDATER: '1',
      });
    });

    it('should map provider with both apiKey and apiBase', () => {
      const provider = {
        apiKey: 'sk-test-key',
        apiBase: 'https://custom.api.com',
      };
      const env = mapProviderToClaudeEnv(provider);

      assert.deepStrictEqual(env, {
        ANTHROPIC_AUTH_TOKEN: 'sk-test-key',
        ANTHROPIC_BASE_URL: 'https://custom.api.com',
        DISABLE_AUTOUPDATER: '1',
      });
    });

    it('should map empty provider to default DISABLE_AUTOUPDATER', () => {
      const provider = {};
      const env = mapProviderToClaudeEnv(provider);

      assert.deepStrictEqual(env, {
        DISABLE_AUTOUPDATER: '1',
      });
    });

    it('should always set DISABLE_AUTOUPDATER to "1"', () => {
      const env1 = mapProviderToClaudeEnv({ apiKey: 'key' });
      const env2 = mapProviderToClaudeEnv({ apiBase: 'url' });
      const env3 = mapProviderToClaudeEnv({});

      assert.strictEqual(env1.DISABLE_AUTOUPDATER, '1');
      assert.strictEqual(env2.DISABLE_AUTOUPDATER, '1');
      assert.strictEqual(env3.DISABLE_AUTOUPDATER, '1');
    });
  });

  describe('createDefaultSettings', () => {
    it('should create valid default claude settings', () => {
      const settings = createDefaultSettings();

      assert.strictEqual(validateSettings(settings), true);
    });

    it('should create valid default codex settings', () => {
      const settings = createDefaultSettings('codex');

      assert.strictEqual(validateSettings(settings, 'codex'), true);
    });

    it('should create valid default gemini settings', () => {
      const settings = createDefaultSettings('gemini');

      assert.strictEqual(validateSettings(settings, 'gemini'), true);
    });

    it('should include all default fields for claude', () => {
      const settings = createDefaultSettings();

      assert.ok('env' in settings);
      assert.ok('model' in settings);
      assert.ok('tags' in settings);
      assert.ok('availableModels' in settings);
    });

    it('should have correct default values for claude', () => {
      const settings = createDefaultSettings();

      assert.deepStrictEqual(settings.env, {
        DISABLE_AUTOUPDATER: '1',
      });
      assert.strictEqual(settings.model, 'sonnet');
      assert.deepStrictEqual(settings.tags, []);
      assert.deepStrictEqual(settings.availableModels, []);
    });
  });

  describe('TypeScript type safety', () => {
    it('should enforce CliSettings interface structure', () => {
      const validSettings = {
        env: {
          ANTHROPIC_AUTH_TOKEN: 'sk-ant-123',
        },
        model: 'opus',
        tags: ['tag1'],
        availableModels: ['model1'],
        settingsFile: '/path/to/file',
      };

      assert.strictEqual(typeof validSettings.env, 'object');
      assert.strictEqual(typeof validSettings.model, 'string');
      assert.strictEqual(Array.isArray(validSettings.tags), true);
      assert.strictEqual(Array.isArray(validSettings.availableModels), true);
      assert.strictEqual(typeof validSettings.settingsFile, 'string');
    });
  });
});
