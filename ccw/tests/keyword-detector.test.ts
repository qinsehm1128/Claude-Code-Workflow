/**
 * Tests for KeywordDetector
 */

import { describe, it, expect } from 'vitest';
import {
  detectKeywords,
  hasKeyword,
  getAllKeywords,
  getPrimaryKeyword,
  getKeywordType,
  hasKeywordType,
  sanitizeText,
  removeCodeBlocks,
  KEYWORD_PATTERNS,
  KEYWORD_PRIORITY
} from '../src/core/hooks/keyword-detector.js';
import type { KeywordType, DetectedKeyword } from '../src/core/hooks/keyword-detector.js';

describe('removeCodeBlocks', () => {
  it('should remove fenced code blocks with ```', () => {
    const text = 'Hello ```code here``` world';
    expect(removeCodeBlocks(text)).toBe('Hello  world');
  });

  it('should remove fenced code blocks with ~~~', () => {
    const text = 'Hello ~~~code here~~~ world';
    expect(removeCodeBlocks(text)).toBe('Hello  world');
  });

  it('should remove inline code with backticks', () => {
    const text = 'Use the `forEach` method';
    expect(removeCodeBlocks(text)).toBe('Use the  method');
  });

  it('should handle multiline code blocks', () => {
    const text = 'Start\n```\nline1\nline2\n```\nEnd';
    expect(removeCodeBlocks(text)).toBe('Start\n\nEnd');
  });

  it('should handle multiple code blocks', () => {
    const text = 'Use `a` and `b` and ```c``` too';
    expect(removeCodeBlocks(text)).toBe('Use  and  and  too');
  });
});

describe('sanitizeText', () => {
  it('should remove XML tag blocks', () => {
    const text = 'Hello <tag>content</tag> world';
    expect(sanitizeText(text)).toBe('Hello  world');
  });

  it('should remove self-closing XML tags', () => {
    const text = 'Hello <br/> world';
    expect(sanitizeText(text)).toBe('Hello  world');
  });

  it('should remove URLs', () => {
    const text = 'Visit https://example.com for more';
    expect(sanitizeText(text)).toBe('Visit  for more');
  });

  it('should remove file paths with ./', () => {
    const text = 'Check ./src/file.ts for details';
    expect(sanitizeText(text)).toBe('Check  for details');
  });

  it('should remove file paths with /', () => {
    const text = 'Edit /home/user/file.ts';
    expect(sanitizeText(text)).toBe('Edit ');
  });

  it('should remove code blocks', () => {
    const text = 'See ```code``` below';
    expect(sanitizeText(text)).toBe('See  below');
  });

  it('should handle complex text', () => {
    const text = 'Use <config>api_key</config> from https://example.com and check ./config.ts';
    const sanitized = sanitizeText(text);
    expect(sanitized).not.toContain('<config>');
    expect(sanitized).not.toContain('https://');
    expect(sanitized).not.toContain('./config.ts');
  });
});

describe('detectKeywords', () => {
  describe('basic detection', () => {
    it('should detect "autopilot" keyword', () => {
      const keywords = detectKeywords('use autopilot mode');
      expect(keywords.some(k => k.type === 'autopilot')).toBe(true);
    });

    it('should detect "ultrawork" keyword', () => {
      const keywords = detectKeywords('run ultrawork now');
      expect(keywords.some(k => k.type === 'ultrawork')).toBe(true);
    });

    it('should detect "ultrawork" alias "ulw"', () => {
      const keywords = detectKeywords('use ulw for this');
      expect(keywords.some(k => k.type === 'ultrawork')).toBe(true);
    });

    it('should detect "plan this" keyword', () => {
      const keywords = detectKeywords('please plan this feature');
      expect(keywords.some(k => k.type === 'plan')).toBe(true);
    });

    it('should detect "tdd" keyword', () => {
      const keywords = detectKeywords('use tdd approach');
      expect(keywords.some(k => k.type === 'tdd')).toBe(true);
    });

    it('should detect "ultrathink" keyword', () => {
      const keywords = detectKeywords('ultrathink about this');
      expect(keywords.some(k => k.type === 'ultrathink')).toBe(true);
    });

    it('should detect "deepsearch" keyword', () => {
      const keywords = detectKeywords('deepsearch for the answer');
      expect(keywords.some(k => k.type === 'deepsearch')).toBe(true);
    });
  });

  describe('cancel keyword', () => {
    it('should detect "cancelomc" keyword', () => {
      const keywords = detectKeywords('cancelomc');
      expect(keywords.some(k => k.type === 'cancel')).toBe(true);
    });

    it('should detect "stopomc" keyword', () => {
      const keywords = detectKeywords('stopomc');
      expect(keywords.some(k => k.type === 'cancel')).toBe(true);
    });
  });

  describe('delegation keywords', () => {
    it('should detect "ask codex" keyword', () => {
      const keywords = detectKeywords('ask codex to help');
      expect(keywords.some(k => k.type === 'codex')).toBe(true);
    });

    it('should detect "use gemini" keyword', () => {
      const keywords = detectKeywords('use gemini for this');
      expect(keywords.some(k => k.type === 'gemini')).toBe(true);
    });

    it('should detect "delegate to gpt" keyword', () => {
      const keywords = detectKeywords('delegate to gpt');
      expect(keywords.some(k => k.type === 'codex')).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    it('should be case-insensitive', () => {
      const keywords = detectKeywords('AUTOPILOT and ULTRAWORK');
      expect(keywords.some(k => k.type === 'autopilot')).toBe(true);
      expect(keywords.some(k => k.type === 'ultrawork')).toBe(true);
    });
  });

  describe('team feature flag', () => {
    it('should skip team keywords when teamEnabled is false', () => {
      const keywords = detectKeywords('use team mode', { teamEnabled: false });
      expect(keywords.some(k => k.type === 'team')).toBe(false);
    });

    it('should detect team keywords when teamEnabled is true', () => {
      const keywords = detectKeywords('use team mode', { teamEnabled: true });
      expect(keywords.some(k => k.type === 'team')).toBe(true);
    });
  });

  describe('code block filtering', () => {
    it('should not detect keywords in code blocks', () => {
      const text = 'Do this:\n```\nautopilot\n```\nnot in code';
      const keywords = detectKeywords(text);
      expect(keywords.some(k => k.type === 'autopilot')).toBe(false);
    });

    it('should not detect keywords in inline code', () => {
      const text = 'Use the `autopilot` function';
      const keywords = detectKeywords(text);
      expect(keywords.some(k => k.type === 'autopilot')).toBe(false);
    });
  });

  describe('returned metadata', () => {
    it('should include keyword position', () => {
      const keywords = detectKeywords('please use autopilot now');
      const autopilot = keywords.find(k => k.type === 'autopilot');
      expect(autopilot?.position).toBe(11); // 'autopilot' starts at position 11
    });

    it('should include matched keyword string', () => {
      const keywords = detectKeywords('use AUTOPILOT');
      const autopilot = keywords.find(k => k.type === 'autopilot');
      expect(autopilot?.keyword).toBe('AUTOPILOT');
    });
  });
});

describe('hasKeyword', () => {
  it('should return true when keyword is present', () => {
    expect(hasKeyword('use autopilot')).toBe(true);
  });

  it('should return false when no keyword is present', () => {
    expect(hasKeyword('hello world')).toBe(false);
  });
});

describe('getAllKeywords', () => {
  describe('conflict resolution', () => {
    it('should return only "cancel" when cancel is present', () => {
      const types = getAllKeywords('cancelomc and autopilot');
      expect(types).toEqual(['cancel']);
    });

    it('should remove "autopilot" when "team" is present', () => {
      const types = getAllKeywords('use autopilot and team mode', { teamEnabled: true });
      expect(types).not.toContain('autopilot');
      expect(types).toContain('team');
    });
  });

  it('should return empty array when no keywords', () => {
    expect(getAllKeywords('hello world')).toEqual([]);
  });

  it('should return keywords in priority order', () => {
    const types = getAllKeywords('use plan this and tdd');
    // 'plan' has priority 9, 'tdd' has priority 10
    expect(types).toEqual(['plan', 'tdd']);
  });
});

describe('getPrimaryKeyword', () => {
  it('should return null when no keywords', () => {
    expect(getPrimaryKeyword('hello world')).toBeNull();
  });

  it('should return highest priority keyword', () => {
    const keyword = getPrimaryKeyword('use plan this and tdd');
    expect(keyword?.type).toBe('plan');
  });

  it('should return cancel as primary when present', () => {
    const keyword = getPrimaryKeyword('use autopilot and cancelomc');
    expect(keyword?.type).toBe('cancel');
  });

  it('should include original keyword metadata', () => {
    const keyword = getPrimaryKeyword('USE AUTOPILOT');
    expect(keyword?.keyword).toBe('AUTOPILOT');
    expect(keyword?.position).toBeDefined();
  });
});

describe('getKeywordType', () => {
  it('should return type for valid keyword', () => {
    expect(getKeywordType('autopilot')).toBe('autopilot');
  });

  it('should return null for invalid keyword', () => {
    expect(getKeywordType('notakeyword')).toBeNull();
  });
});

describe('hasKeywordType', () => {
  it('should return true for present keyword type', () => {
    expect(hasKeywordType('use autopilot', 'autopilot')).toBe(true);
  });

  it('should return false for absent keyword type', () => {
    expect(hasKeywordType('hello world', 'autopilot')).toBe(false);
  });

  it('should sanitize text before checking', () => {
    expect(hasKeywordType('use `autopilot` in code', 'autopilot')).toBe(false);
  });
});

describe('KEYWORD_PRIORITY', () => {
  it('should have cancel as highest priority', () => {
    expect(KEYWORD_PRIORITY[0]).toBe('cancel');
  });

  it('should have gemini as lowest priority', () => {
    expect(KEYWORD_PRIORITY[KEYWORD_PRIORITY.length - 1]).toBe('gemini');
  });
});

describe('KEYWORD_PATTERNS', () => {
  it('should have patterns for all keyword types', () => {
    const types: KeywordType[] = [
      'cancel', 'ralph', 'autopilot', 'ultrapilot', 'team', 'ultrawork',
      'swarm', 'pipeline', 'ralplan', 'plan', 'tdd',
      'ultrathink', 'deepsearch', 'analyze', 'codex', 'gemini'
    ];

    types.forEach(type => {
      expect(KEYWORD_PATTERNS[type]).toBeDefined();
      expect(KEYWORD_PATTERNS[type] instanceof RegExp).toBe(true);
    });
  });
});
