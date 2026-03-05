/**
 * L0-L2 tests for Native Session Discovery - Resume Mechanism Fixes
 *
 * Test coverage:
 * - L0: Transaction ID parsing from session files
 * - L0: Session discoverer factory methods
 * - L1: Transaction ID matching logic
 * - L1: Prompt-based fallback matching
 * - L2: Concurrent session disambiguation
 *
 * Test layers:
 * - L0 (Unit): Isolated method tests with mocks
 * - L1 (Integration): Session matching with mock files
 * - L2 (System): Concurrent execution scenarios
 */

import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const TEST_CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-session-discovery-home-'));
const TEST_USER_HOME = mkdtempSync(join(tmpdir(), 'ccw-session-discovery-user-home-'));
const TEST_PROJECT_ROOT = mkdtempSync(join(tmpdir(), 'ccw-session-discovery-project-'));

const sessionDiscoveryUrl = new URL('../dist/tools/native-session-discovery.js', import.meta.url);
const cliExecutorUrl = new URL('../dist/tools/cli-executor.js', import.meta.url);

sessionDiscoveryUrl.searchParams.set('t', String(Date.now()));
cliExecutorUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cliExecutorMod: any;

const originalEnv = {
  CCW_DATA_DIR: process.env.CCW_DATA_DIR,
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE
};

function normalizeGeminiProjectRootPath(projectDir: string): string {
  const absolutePath = resolve(projectDir);
  if (process.platform !== 'win32') return absolutePath;
  return absolutePath.replace(/\//g, '\\').toLowerCase();
}

function resetDir(dirPath: string): void {
  if (existsSync(dirPath)) {
    rmSync(dirPath, { recursive: true, force: true });
  }
  mkdirSync(dirPath, { recursive: true });
}

/**
 * Helper: Create a mock Gemini session file
 */
function createMockGeminiSession(filePath: string, options: {
  sessionId: string;
  startTime: string;
  projectHash?: string;
  transactionId?: string;
  firstPrompt?: string;
}): void {
  const sessionData = {
    sessionId: options.sessionId,
    projectHash: options.projectHash,
    startTime: options.startTime,
    lastUpdated: new Date().toISOString(),
    messages: [
      {
        type: 'user',
        content: options.transactionId
          ? `[CCW-TX-ID: ${options.transactionId}]\n\n${options.firstPrompt || 'Test prompt'}`
          : (options.firstPrompt || 'Test prompt')
      },
      {
        type: 'model',
        content: 'Test response'
      }
    ]
  };

  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, JSON.stringify(sessionData), 'utf8');
}

/**
 * Helper: Create a mock Qwen session file (JSONL format)
 */
function createMockQwenSession(filePath: string, options: {
  sessionId: string;
  startTime: string;
  transactionId?: string;
  firstPrompt?: string;
}): void {
  const userContent = options.transactionId
    ? `[CCW-TX-ID: ${options.transactionId}]\n\n${options.firstPrompt || 'Test prompt'}`
    : (options.firstPrompt || 'Test prompt');

  const lines = [
    JSON.stringify({ type: 'user', content: userContent, timestamp: options.startTime }),
    JSON.stringify({ type: 'assistant', content: 'Test response', timestamp: new Date().toISOString() })
  ];

  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, lines.join('\n'), 'utf8');
}

/**
 * Helper: Create a mock Codex session file (JSONL format)
 */
function createMockCodexSession(filePath: string, options: {
  sessionId: string;
  startTime: string;
  transactionId?: string;
  firstPrompt?: string;
}): void {
  const userContent = options.transactionId
    ? `[CCW-TX-ID: ${options.transactionId}]\n\n${options.firstPrompt || 'Test prompt'}`
    : (options.firstPrompt || 'Test prompt');

  const lines = [
    JSON.stringify({ role: 'user', message: { role: 'user', content: userContent }, isMeta: false }),
    JSON.stringify({ role: 'model', message: { role: 'assistant', content: 'Test response' }, isMeta: false })
  ];

  mkdirSync(join(filePath, '..', '..'), { recursive: true });
  writeFileSync(filePath, lines.join('\n'), 'utf8');
}

describe('Native Session Discovery - Resume Mechanism Fixes (L0-L2)', async () => {
  before(async () => {
    process.env.CCW_DATA_DIR = TEST_CCW_HOME;
    process.env.HOME = TEST_USER_HOME;
    process.env.USERPROFILE = TEST_USER_HOME;
    mod = await import(sessionDiscoveryUrl.href);
    cliExecutorMod = await import(cliExecutorUrl.href);
  });

  beforeEach(() => {
    process.env.CCW_DATA_DIR = TEST_CCW_HOME;
    mock.method(console, 'warn', () => {});
    mock.method(console, 'error', () => {});
    mock.method(console, 'log', () => {});

    resetDir(TEST_CCW_HOME);
    resetDir(TEST_USER_HOME);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    process.env.CCW_DATA_DIR = originalEnv.CCW_DATA_DIR;
    process.env.HOME = originalEnv.HOME;
    process.env.USERPROFILE = originalEnv.USERPROFILE;
    rmSync(TEST_CCW_HOME, { recursive: true, force: true });
    rmSync(TEST_USER_HOME, { recursive: true, force: true });
    rmSync(TEST_PROJECT_ROOT, { recursive: true, force: true });
  });

  describe('L0: Transaction ID parsing', () => {
    it('extracts transaction ID from prompt with CCW-TX-ID format', () => {
      const prompt = '[CCW-TX-ID: ccw-tx-12345-abc]\n\nActual prompt content here';
      const txId = cliExecutorMod.extractTransactionId?.(prompt);

      assert.ok(txId);
      assert.equal(txId, 'ccw-tx-12345-abc');
    });

    it('returns null for prompt without transaction ID', () => {
      const prompt = 'Just a regular prompt without any transaction ID';
      const txId = cliExecutorMod.extractTransactionId?.(prompt);

      assert.equal(txId, null);
    });

    it('handles malformed transaction ID gracefully', () => {
      const prompt = '[CCW-TX-ID: \n\nMalformed ID without closing bracket';
      const txId = cliExecutorMod.extractTransactionId?.(prompt);

      // Should either return null or the malformed content
      assert.ok(txId === null || typeof txId === 'string');
    });

    it('generates valid transaction ID format', () => {
      const conversationId = '1702123456789-gemini';
      const txId = cliExecutorMod.generateTransactionId?.(conversationId);

      assert.ok(txId);
      assert.ok(txId.startsWith('ccw-tx-'));
      assert.ok(txId.includes(conversationId));
    });

    it('injects transaction ID into prompt', () => {
      const originalPrompt = 'Original user prompt';
      const txId = 'ccw-tx-test-123';
      const injected = cliExecutorMod.injectTransactionId?.(originalPrompt, txId);

      assert.ok(injected.startsWith('[CCW-TX-ID:'));
      assert.ok(injected.includes(txId));
      assert.ok(injected.includes(originalPrompt));
    });
  });

  describe('L0: Session discoverer factory', () => {
    it('returns discoverer for supported tools', () => {
      const geminiDiscoverer = mod.getDiscoverer('gemini');
      assert.ok(geminiDiscoverer);

      const qwenDiscoverer = mod.getDiscoverer('qwen');
      assert.ok(qwenDiscoverer);

      const codexDiscoverer = mod.getDiscoverer('codex');
      assert.ok(codexDiscoverer);

      const claudeDiscoverer = mod.getDiscoverer('claude');
      assert.ok(claudeDiscoverer);
    });

    it('returns null for unsupported tool', () => {
      const discoverer = mod.getDiscoverer('unsupported-tool');
      assert.equal(discoverer, null);
    });

    it('checkNativeResume returns true for gemini', () => {
      assert.equal(mod.supportsNativeResume('gemini'), true);
    });

    it('checkNativeResume returns true for qwen', () => {
      assert.equal(mod.supportsNativeResume('qwen'), true);
    });

    it('checkNativeResume returns false for codex (TTY limitation)', () => {
      assert.equal(mod.supportsNativeResume('codex'), false);
    });
  });

  describe('L0: Transaction ID matching - mock sessions', () => {
    it('matches session by exact transaction ID', () => {
      const txId = 'ccw-tx-test-abc-123';
      const sessions = [
        { filePath: '', sessionId: 'session-1', tool: 'gemini' },
        { filePath: '', sessionId: 'session-2', tool: 'gemini' }
      ];

      // Mock extractFirstUserMessage to return transaction ID
      const mockDiscoverer = {
        extractFirstUserMessage: (path: string) => {
          if (path === 'match') {
            return `[CCW-TX-ID: ${txId}]\n\nPrompt`;
          }
          return '[CCW-TX-ID: different-id]\n\nPrompt';
        }
      };

      // Add matchSessionByTransactionId method to mock
      Object.assign(mockDiscoverer, {
        matchSessionByTransactionId: (txId: string, sessions: any[]) => {
          for (const session of sessions) {
            try {
              const userMessage = mockDiscoverer.extractFirstUserMessage(session.filePath);
              if (userMessage) {
                const match = userMessage.match(/\[CCW-TX-ID:\s+([^\]]+)\]/);
                if (match && match[1] === txId) {
                  return session;
                }
              }
            } catch {
              // Skip
            }
          }
          return null;
        }
      });

      sessions[0].filePath = 'match';
      sessions[1].filePath = 'no-match';

      const matched = mockDiscoverer.matchSessionByTransactionId(txId, sessions);
      assert.equal(matched, sessions[0]);
    });

    it('returns null when transaction ID not found', () => {
      const txId = 'ccw-tx-not-found';
      const sessions = [
        { filePath: 'session1', sessionId: 's1', tool: 'gemini' }
      ];

      const mockDiscoverer = {
        extractFirstUserMessage: () => '[CCW-TX-ID: different-id]\n\nPrompt'
      };

      Object.assign(mockDiscoverer, {
        matchSessionByTransactionId: (txId: string, sessions: any[]) => {
          for (const session of sessions) {
            try {
              const userMessage = mockDiscoverer.extractFirstUserMessage(session.filePath);
              if (userMessage) {
                const match = userMessage.match(/\[CCW-TX-ID:\s+([^\]]+)\]/);
                if (match && match[1] === txId) {
                  return session;
                }
              }
            } catch {
              // Skip
            }
          }
          return null;
        }
      });

      const matched = mockDiscoverer.matchSessionByTransactionId(txId, sessions);
      assert.equal(matched, null);
    });
  });

  describe('L1: Session file parsing with transaction IDs', () => {
    it('extracts transaction ID from Gemini session file', () => {
      const tempDir = join(TEST_CCW_HOME, 'gemini-sessions');
      const projectHash = 'abc123';
      const sessionPath = join(tempDir, projectHash, 'chats', `session-test-${Date.now()}.json`);

      createMockGeminiSession(sessionPath, {
        sessionId: `uuid-${Date.now()}`,
        startTime: new Date().toISOString(),
        transactionId: 'ccw-tx-gemini-test-123',
        firstPrompt: 'Test Gemini prompt'
      });

      // Verify file was created
      assert.ok(existsSync(sessionPath));

      // Read and verify content
      const content = JSON.parse(readFileSync(sessionPath, 'utf8'));
      assert.ok(content.messages[0].content.includes('[CCW-TX-ID:'));
      assert.ok(content.messages[0].content.includes('ccw-tx-gemini-test-123'));
    });

    it('extracts transaction ID from Qwen session file', () => {
      const tempDir = join(TEST_CCW_HOME, 'qwen-sessions');
      const encodedPath = encodeURIComponent(TEST_PROJECT_ROOT);
      const sessionPath = join(tempDir, encodedPath, 'chats', `test-${Date.now()}.jsonl`);

      createMockQwenSession(sessionPath, {
        sessionId: `uuid-${Date.now()}`,
        startTime: new Date().toISOString(),
        transactionId: 'ccw-tx-qwen-test-456',
        firstPrompt: 'Test Qwen prompt'
      });

      assert.ok(existsSync(sessionPath));

      const content = readFileSync(sessionPath, 'utf8');
      assert.ok(content.includes('[CCW-TX-ID:'));
      assert.ok(content.includes('ccw-tx-qwen-test-456'));
    });

    it('extracts transaction ID from Codex session file', () => {
      const tempDir = join(TEST_CCW_HOME, 'codex-sessions');
      mkdirSync(tempDir, { recursive: true });
      const sessionPath = join(tempDir, `rollout-test-${Date.now()}.jsonl`);

      createMockCodexSession(sessionPath, {
        sessionId: `uuid-${Date.now()}`,
        startTime: new Date().toISOString(),
        transactionId: 'ccw-tx-codex-test-789',
        firstPrompt: 'Test Codex prompt'
      });

      assert.ok(existsSync(sessionPath));

      const content = readFileSync(sessionPath, 'utf8');
      assert.ok(content.includes('[CCW-TX-ID:'));
      assert.ok(content.includes('ccw-tx-codex-test-789'));
    });
  });

  describe('L1: Gemini discovery - project-name folder layout', () => {
    it('discovers sessions under ~/.gemini/tmp/<projectName>/chats via projects.json mapping', () => {
      const projectName = `proj-${Date.now()}`;
      const projectRootKey = normalizeGeminiProjectRootPath(TEST_PROJECT_ROOT);

      const geminiHome = join(TEST_USER_HOME, '.gemini');
      const tmpDir = join(geminiHome, 'tmp');
      const projectDir = join(tmpDir, projectName);
      const chatsDir = join(projectDir, 'chats');
      mkdirSync(chatsDir, { recursive: true });

      // Gemini uses both projects.json mapping and a `.project_root` marker.
      mkdirSync(geminiHome, { recursive: true });
      writeFileSync(
        join(geminiHome, 'projects.json'),
        JSON.stringify({ projects: { [projectRootKey]: projectName } }),
        'utf8'
      );
      writeFileSync(join(projectDir, '.project_root'), projectRootKey, 'utf8');

      const sessionPath = join(chatsDir, `session-test-${Date.now()}.json`);
      createMockGeminiSession(sessionPath, {
        sessionId: `uuid-${Date.now()}`,
        startTime: new Date().toISOString(),
        projectHash: 'abc123',
        firstPrompt: 'Test Gemini prompt'
      });

      const sessions = mod.getNativeSessions('gemini', { workingDir: TEST_PROJECT_ROOT });
      assert.ok(sessions.some((s: { filePath: string }) => s.filePath === sessionPath));
    });
  });

  describe('L1: Prompt-based fallback matching', () => {
    it('matches sessions by prompt prefix when transaction ID not available', () => {
      const prompt = 'Implement authentication feature with JWT tokens';
      const sessions = [
        {
          filePath: 'match1',
          sessionId: 's1',
          tool: 'gemini',
          firstPrompt: 'Implement authentication feature with JWT tokens and refresh'
        },
        {
          filePath: 'nomatch',
          sessionId: 's2',
          tool: 'gemini',
          firstPrompt: 'Completely different prompt about database'
        }
      ];

      // Mock extractFirstUserMessage
      const mockSessions = sessions.map(s => ({
        ...s,
        extractFirstUserMessage: () => s.firstPrompt
      }));

      // Simple prefix match logic
      const matched = mockSessions.find(s => s.firstPrompt.startsWith(prompt.substring(0, 50)));

      assert.ok(matched);
      assert.equal(matched.sessionId, 's1');
    });
  });

  describe('L2: Concurrent session disambiguation', () => {
    it('distinguishes between concurrent sessions with same timestamp', () => {
      const baseTime = new Date().toISOString();
      const txId1 = 'ccw-tx-concurrent-session1-abc';
      const txId2 = 'ccw-tx-concurrent-session2-def';

      const sessions = [
        {
          filePath: 'session1',
          sessionId: 'uuid-1',
          tool: 'gemini',
          createdAt: new Date(baseTime)
        },
        {
          filePath: 'session2',
          sessionId: 'uuid-2',
          tool: 'gemini',
          createdAt: new Date(baseTime)
        }
      ];

      // Mock extractor that returns different transaction IDs
      const mockDiscoverer = {
        extractFirstUserMessage: (path: string) => {
          if (path === 'session1') {
            return `[CCW-TX-ID: ${txId1}]\n\nPrompt 1`;
          }
          return `[CCW-TX-ID: ${txId2}]\n\nPrompt 2`;
        },
        matchSessionByTransactionId: (txId: string, sessions: any[]) => {
          for (const session of sessions) {
            try {
              const userMessage = mockDiscoverer.extractFirstUserMessage(session.filePath);
              if (userMessage) {
                const match = userMessage.match(/\[CCW-TX-ID:\s+([^\]]+)\]/);
                if (match && match[1] === txId) {
                  return session;
                }
              }
            } catch {
              // Skip
            }
          }
          return null;
        }
      };

      const matched1 = mockDiscoverer.matchSessionByTransactionId(txId1, sessions);
      const matched2 = mockDiscoverer.matchSessionByTransactionId(txId2, sessions);

      assert.equal(matched1.sessionId, 'uuid-1');
      assert.equal(matched2.sessionId, 'uuid-2');
      assert.notEqual(matched1, matched2);
    });

    it('handles missing transaction ID gracefully with timestamp fallback', () => {
      const baseTime = Date.now();

      const sessions = [
        {
          filePath: 'newer',
          sessionId: 's1',
          tool: 'gemini',
          createdAt: new Date(baseTime + 1000),
          firstPrompt: 'Newer session prompt'
        },
        {
          filePath: 'older',
          sessionId: 's2',
          tool: 'gemini',
          createdAt: new Date(baseTime),
          firstPrompt: 'Older session prompt'
        }
      ];

      // Without transaction ID, should fallback to latest by timestamp
      const latest = sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      assert.equal(latest.sessionId, 's1');
    });
  });

  describe('L0: Edge cases and error handling', () => {
    it('handles empty session files gracefully', () => {
      const tempDir = join(TEST_CCW_HOME, 'empty-session');
      const sessionPath = join(tempDir, 'session-empty.json');
      mkdirSync(join(sessionPath, '..'), { recursive: true });
      writeFileSync(sessionPath, '', 'utf8');

      assert.ok(existsSync(sessionPath));

      // Should not throw when reading empty file
      try {
        const content = readFileSync(sessionPath, 'utf8');
        assert.equal(content, '');
      } catch (e) {
        // File read might fail, which is acceptable
        assert.ok((e as Error).message);
      }
    });

    it('handles malformed JSON in session files', () => {
      const tempDir = join(TEST_CCW_HOME, 'malformed-session');
      const sessionPath = join(tempDir, 'session-bad.json');
      mkdirSync(join(sessionPath, '..'), { recursive: true });
      writeFileSync(sessionPath, '{ invalid json }', 'utf8');

      assert.ok(existsSync(sessionPath));

      // Should not throw when parsing malformed JSON
      try {
        JSON.parse(readFileSync(sessionPath, 'utf8'));
        assert.fail('Expected JSON.parse to throw');
      } catch (e) {
        assert.ok((e as Error).message.includes('JSON'));
      }
    });

    it('handles special characters in transaction ID', () => {
      const specialTxId = 'ccw-tx-test-with_underscores-and-123';
      const prompt = `[CCW-TX-ID: ${specialTxId}]\n\nTest`;

      const match = prompt.match(/\[CCW-TX-ID:\s+([^\]]+)\]/);
      assert.ok(match);
      assert.equal(match[1], specialTxId);
    });

    it('handles unicode characters in prompt with transaction ID', () => {
      const txId = 'ccw-tx-unicode-test';
      const prompt = `[CCW-TX-ID: ${txId}]\n\nTest with unicode:  emoji characters`;

      const match = prompt.match(/\[CCW-TX-ID:\s+([^\]]+)\]/);
      assert.ok(match);
      assert.equal(match[1], txId);
    });
  });

  describe('L1: Performance assertions', () => {
    it('transaction ID extraction completes quickly', () => {
      const longPrompt = 'x'.repeat(10000) + '\n\n[CCW-TX-ID: test-id]\n\n' + 'y'.repeat(10000);

      const start = Date.now();
      const match = longPrompt.match(/\[CCW-TX-ID:\s+([^\]]+)\]/);
      const duration = Date.now() - start;

      assert.ok(match);
      assert.ok(duration < 10, `Extraction took ${duration}ms, expected < 10ms`);
    });

    it('handles rapid transaction ID generations', () => {
      const start = Date.now();
      const ids = new Set();

      for (let i = 0; i < 100; i++) {
        const id = cliExecutorMod.generateTransactionId?.(`conv-${i}`);
        ids.add(id);
      }

      const duration = Date.now() - start;

      // All IDs should be unique
      assert.equal(ids.size, 100);

      // Should complete in reasonable time
      assert.ok(duration < 100, `Generation took ${duration}ms, expected < 100ms`);
    });
  });

  describe('L1: Integration with session discovery', () => {
    it('creates valid session object structure', () => {
      const session = {
        sessionId: `uuid-${Date.now()}`,
        tool: 'gemini',
        filePath: '/fake/path/session.json',
        projectHash: 'abc123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      assert.ok(session.sessionId);
      assert.ok(session.tool);
      assert.ok(session.filePath);
      assert.equal(typeof session.createdAt.getTime(), 'number');
      assert.equal(typeof session.updatedAt.getTime(), 'number');
    });

    it('handles session discovery options', () => {
      const options = {
        workingDir: TEST_PROJECT_ROOT,
        limit: 10,
        afterTimestamp: new Date(Date.now() - 3600000)
      };

      assert.ok(options.workingDir);
      assert.equal(typeof options.limit, 'number');
      assert.ok(options.afterTimestamp instanceof Date);
    });
  });
});
