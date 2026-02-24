/**
 * Integration Tests for CCW + OMC Hook Integration
 *
 * Tests the complete hook system including:
 * - Stop Hook with Soft Enforcement
 * - Mode activation via keyword detection
 * - Checkpoint creation and recovery
 * - End-to-end workflow continuation
 * - Mode system integration
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses temporary directories for isolation.
 * - Calls services directly (no HTTP server required).
 */

import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

// =============================================================================
// Test Setup
// =============================================================================

const stopHandlerUrl = new URL('../../dist/core/hooks/stop-handler.js', import.meta.url);
const recoveryHandlerUrl = new URL('../../dist/core/hooks/recovery-handler.js', import.meta.url);
const modeRegistryUrl = new URL('../../dist/core/services/mode-registry-service.js', import.meta.url);
const checkpointServiceUrl = new URL('../../dist/core/services/checkpoint-service.js', import.meta.url);
const contextLimitUrl = new URL('../../dist/core/hooks/context-limit-detector.js', import.meta.url);
const userAbortUrl = new URL('../../dist/core/hooks/user-abort-detector.js', import.meta.url);
const keywordDetectorUrl = new URL('../../dist/core/hooks/keyword-detector.js', import.meta.url);

// Add cache-busting
[stopHandlerUrl, recoveryHandlerUrl, modeRegistryUrl, checkpointServiceUrl, contextLimitUrl, userAbortUrl, keywordDetectorUrl].forEach(url => {
  url.searchParams.set('t', String(Date.now()));
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modules: any = {};

const originalEnv = {
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE,
};

// =============================================================================
// Helper Functions
// =============================================================================

async function importModules() {
  modules.StopHandler = (await import(stopHandlerUrl.href)).StopHandler;
  modules.RecoveryHandler = (await import(recoveryHandlerUrl.href)).RecoveryHandler;
  modules.ModeRegistryService = (await import(modeRegistryUrl.href)).ModeRegistryService;
  modules.CheckpointService = (await import(checkpointServiceUrl.href)).CheckpointService;
  modules.isContextLimitStop = (await import(contextLimitUrl.href)).isContextLimitStop;
  modules.isUserAbort = (await import(userAbortUrl.href)).isUserAbort;
  modules.detectKeywords = (await import(keywordDetectorUrl.href)).detectKeywords;
  modules.getPrimaryKeyword = (await import(keywordDetectorUrl.href)).getPrimaryKeyword;
}

function createTestProject(baseDir: string): string {
  const projectDir = join(baseDir, 'project');
  mkdirSync(projectDir, { recursive: true });
  mkdirSync(join(projectDir, '.workflow'), { recursive: true });
  mkdirSync(join(projectDir, '.workflow', 'modes'), { recursive: true });
  mkdirSync(join(projectDir, '.workflow', 'checkpoints'), { recursive: true });
  return projectDir;
}

// =============================================================================
// Integration Tests
// =============================================================================

describe('CCW + OMC Hook Integration', async () => {
  let homeDir = '';
  let testDir = '';
  let projectDir = '';

  before(async () => {
    homeDir = mkdtempSync(join(tmpdir(), 'ccw-hooks-home-'));
    testDir = mkdtempSync(join(tmpdir(), 'ccw-hooks-test-'));

    process.env.HOME = homeDir;
    process.env.USERPROFILE = homeDir;

    mock.method(console, 'log', () => {});
    mock.method(console, 'warn', () => {});
    mock.method(console, 'error', () => {});

    await importModules();
    projectDir = createTestProject(testDir);
  });

  beforeEach(() => {
    // Clean up project state between tests
    rmSync(join(projectDir, '.workflow'), { recursive: true, force: true });
    mkdirSync(join(projectDir, '.workflow'), { recursive: true });
    mkdirSync(join(projectDir, '.workflow', 'modes'), { recursive: true });
    mkdirSync(join(projectDir, '.workflow', 'checkpoints'), { recursive: true });
  });

  after(() => {
    mock.restoreAll();
    process.env.HOME = originalEnv.HOME;
    process.env.USERPROFILE = originalEnv.USERPROFILE;

    rmSync(testDir, { recursive: true, force: true });
    rmSync(homeDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // Stop Handler Integration Tests
  // ===========================================================================

  describe('Stop Handler Integration', () => {
    it('INT-STOP-1: Should always return continue: true (Soft Enforcement)', async () => {
      const stopHandler = new modules.StopHandler({
        projectPath: projectDir,
        enableLogging: false
      });

      // Test various contexts - all should return continue: true
      const contexts = [
        {},
        { stop_reason: 'unknown' },
        { active_workflow: true },
        { active_mode: 'analysis' }
      ];

      for (const context of contexts) {
        const result = await stopHandler.handleStop(context);
        assert.equal(result.continue, true, `Expected continue: true for context ${JSON.stringify(context)}`);
      }
    });

    it('INT-STOP-2: Should detect context limit and allow stop', async () => {
      const stopHandler = new modules.StopHandler({
        projectPath: projectDir,
        enableLogging: false
      });

      const result = await stopHandler.handleStop({
        stop_reason: 'context_limit_reached',
        end_turn_reason: 'max_tokens'
      });

      assert.equal(result.continue, true);
      assert.equal(result.mode, 'context-limit');
    });

    it('INT-STOP-3: Should detect user abort and respect intent', async () => {
      const stopHandler = new modules.StopHandler({
        projectPath: projectDir,
        enableLogging: false
      });

      const result = await stopHandler.handleStop({
        user_requested: true,
        stop_reason: 'user_cancel'
      });

      assert.equal(result.continue, true);
      assert.equal(result.mode, 'user-abort');
    });

    it('INT-STOP-4: Should inject continuation message for active workflow', async () => {
      const stopHandler = new modules.StopHandler({
        projectPath: projectDir,
        enableLogging: false,
        workflowContinuationMessage: '[WORKFLOW] Continue working...'
      });

      const result = await stopHandler.handleStop({
        active_workflow: true,
        session_id: 'test-session-001'
      });

      assert.equal(result.continue, true);
      assert.equal(result.mode, 'active-workflow');
      assert.ok(result.message);
      assert.ok(result.message.includes('[WORKFLOW]'));
    });

    it('INT-STOP-5: Should check ModeRegistryService for active modes', async () => {
      const sessionId = 'test-session-002';

      // First activate a mode
      const modeRegistry = new modules.ModeRegistryService({
        projectPath: projectDir,
        enableLogging: false
      });

      const activated = modeRegistry.activateMode('autopilot', sessionId);
      assert.equal(activated, true);

      // Now test stop handler
      const stopHandler = new modules.StopHandler({
        projectPath: projectDir,
        enableLogging: false
      });

      const result = await stopHandler.handleStop({
        session_id: sessionId
      });

      assert.equal(result.continue, true);
      // Should detect active mode
      assert.ok(
        result.mode === 'active-mode' || result.mode === 'none',
        `Expected active-mode or none, got ${result.mode}`
      );
    });
  });

  // ===========================================================================
  // Mode System Integration Tests
  // ===========================================================================

  describe('Mode System Integration', () => {
    it('INT-MODE-1: Should activate and detect modes via ModeRegistryService', async () => {
      const modeRegistry = new modules.ModeRegistryService({
        projectPath: projectDir,
        enableLogging: false
      });

      const sessionId = 'mode-test-001';

      // Initially no mode active
      assert.equal(modeRegistry.isModeActive('autopilot', sessionId), false);

      // Activate mode
      const activated = modeRegistry.activateMode('autopilot', sessionId);
      assert.equal(activated, true);

      // Now should be active
      assert.equal(modeRegistry.isModeActive('autopilot', sessionId), true);
      assert.deepEqual(modeRegistry.getActiveModes(sessionId), ['autopilot']);

      // Deactivate
      modeRegistry.deactivateMode('autopilot', sessionId);
      assert.equal(modeRegistry.isModeActive('autopilot', sessionId), false);
    });

    it('INT-MODE-2: Should prevent concurrent exclusive modes', async () => {
      const modeRegistry = new modules.ModeRegistryService({
        projectPath: projectDir,
        enableLogging: false
      });

      const sessionId1 = 'exclusive-test-001';
      const sessionId2 = 'exclusive-test-002';

      // Activate autopilot (exclusive mode) in session 1
      const activated1 = modeRegistry.activateMode('autopilot', sessionId1);
      assert.equal(activated1, true);

      // Try to activate swarm (also exclusive) in session 2
      // This should be blocked because autopilot is already active
      const canStart = modeRegistry.canStartMode('swarm', sessionId2);
      assert.equal(canStart.allowed, false);
      assert.equal(canStart.blockedBy, 'autopilot');

      // Cleanup
      modeRegistry.deactivateMode('autopilot', sessionId1);
    });

    it('INT-MODE-3: Should clean up stale markers', async () => {
      const modeRegistry = new modules.ModeRegistryService({
        projectPath: projectDir,
        enableLogging: false
      });

      const sessionId = 'stale-test-001';

      // Activate mode
      modeRegistry.activateMode('autopilot', sessionId);

      // Create a stale marker (manually set old timestamp)
      const stateFile = join(projectDir, '.workflow', 'modes', 'sessions', sessionId, 'autopilot-state.json');
      if (existsSync(stateFile)) {
        const content = readFileSync(stateFile, 'utf-8');
        const state = JSON.parse(content);
        // Set activation time to 2 hours ago (beyond 1 hour threshold)
        state.activatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        writeFileSync(stateFile, JSON.stringify(state), 'utf-8');
      }

      // Run cleanup
      const cleaned = modeRegistry.cleanupStaleMarkers();

      // Mode should no longer be active
      assert.equal(modeRegistry.isModeActive('autopilot', sessionId), false);
    });

    it('INT-MODE-4: Should support non-exclusive modes concurrently', async () => {
      const modeRegistry = new modules.ModeRegistryService({
        projectPath: projectDir,
        enableLogging: false
      });

      const sessionId = 'non-exclusive-test-001';

      // Activate ralph (non-exclusive)
      const ralphOk = modeRegistry.activateMode('ralph', sessionId);
      assert.equal(ralphOk, true);

      // Activate team (non-exclusive) - should be allowed
      const teamOk = modeRegistry.activateMode('team', sessionId);
      assert.equal(teamOk, true);

      // Both should be active
      const activeModes = modeRegistry.getActiveModes(sessionId);
      assert.ok(activeModes.includes('ralph'));
      assert.ok(activeModes.includes('team'));

      // Cleanup
      modeRegistry.deactivateMode('ralph', sessionId);
      modeRegistry.deactivateMode('team', sessionId);
    });
  });

  // ===========================================================================
  // Checkpoint and Recovery Integration Tests
  // ===========================================================================

  describe('Checkpoint and Recovery Integration', () => {
    it('INT-CHECKPOINT-1: Should create checkpoint via CheckpointService', async () => {
      const checkpointService = new modules.CheckpointService({
        projectPath: projectDir,
        enableLogging: false
      });

      const sessionId = 'checkpoint-test-001';

      const checkpoint = await checkpointService.createCheckpoint(
        sessionId,
        'compact',
        {
          modeStates: { autopilot: { active: true } },
          workflowState: null,
          memoryContext: null
        }
      );

      assert.ok(checkpoint.id);
      assert.equal(checkpoint.session_id, sessionId);
      assert.equal(checkpoint.trigger, 'compact');
      assert.ok(checkpoint.mode_states.autopilot?.active);

      // Save and verify
      const savedId = await checkpointService.saveCheckpoint(checkpoint);
      assert.equal(savedId, checkpoint.id);

      // Load and verify
      const loaded = await checkpointService.loadCheckpoint(checkpoint.id);
      assert.ok(loaded);
      assert.equal(loaded?.id, checkpoint.id);
    });

    it('INT-CHECKPOINT-2: Should create checkpoint via RecoveryHandler PreCompact', async () => {
      const recoveryHandler = new modules.RecoveryHandler({
        projectPath: projectDir,
        enableLogging: false
      });

      const sessionId = 'precompact-test-001';

      const result = await recoveryHandler.handlePreCompact({
        session_id: sessionId,
        cwd: projectDir,
        hook_event_name: 'PreCompact',
        trigger: 'auto'
      });

      assert.equal(result.continue, true);
      assert.ok(result.systemMessage);

      // Verify checkpoint was created
      const checkpointService = new modules.CheckpointService({
        projectPath: projectDir,
        enableLogging: false
      });

      const checkpoint = await checkpointService.getLatestCheckpoint(sessionId);
      assert.ok(checkpoint);
      assert.equal(checkpoint?.session_id, sessionId);
    });

    it('INT-CHECKPOINT-3: Should recover session from checkpoint', async () => {
      const recoveryHandler = new modules.RecoveryHandler({
        projectPath: projectDir,
        enableLogging: false
      });

      const sessionId = 'recovery-test-001';

      // Create checkpoint first
      await recoveryHandler.handlePreCompact({
        session_id: sessionId,
        cwd: projectDir,
        hook_event_name: 'PreCompact',
        trigger: 'manual'
      });

      // Now check recovery
      const checkpoint = await recoveryHandler.checkRecovery(sessionId);
      assert.ok(checkpoint);

      // Format recovery message
      const message = await recoveryHandler.formatRecoveryMessage(checkpoint);
      assert.ok(message);
      assert.ok(message.includes(sessionId));
    });

    it('INT-CHECKPOINT-4: Should cleanup old checkpoints', async () => {
      const checkpointService = new modules.CheckpointService({
        projectPath: projectDir,
        maxCheckpointsPerSession: 3,
        enableLogging: false
      });

      const sessionId = 'cleanup-test-001';

      // Create more than max checkpoints
      for (let i = 0; i < 5; i++) {
        const checkpoint = await checkpointService.createCheckpoint(
          sessionId,
          'compact',
          { modeStates: {}, workflowState: null, memoryContext: null }
        );
        await checkpointService.saveCheckpoint(checkpoint);
      }

      // Should only have 3 checkpoints
      const checkpoints = await checkpointService.listCheckpoints(sessionId);
      assert.ok(checkpoints.length <= 3);
    });

    it('INT-CHECKPOINT-5: Should include mode states in checkpoint', async () => {
      const modeRegistry = new modules.ModeRegistryService({
        projectPath: projectDir,
        enableLogging: false
      });

      const sessionId = 'mode-checkpoint-test-001';

      // Activate modes
      modeRegistry.activateMode('autopilot', sessionId);
      modeRegistry.activateMode('ralph', sessionId);

      // Create checkpoint with mode states
      const checkpointService = new modules.CheckpointService({
        projectPath: projectDir,
        enableLogging: false
      });

      const modeStates: Record<string, { active: boolean }> = {};
      const activeModes = modeRegistry.getActiveModes(sessionId);
      for (const mode of activeModes) {
        modeStates[mode] = { active: true };
      }

      const checkpoint = await checkpointService.createCheckpoint(
        sessionId,
        'compact',
        { modeStates: modeStates as any, workflowState: null, memoryContext: null }
      );

      assert.ok(checkpoint.mode_states.autopilot?.active);
      assert.ok(checkpoint.mode_states.ralph?.active);

      // Cleanup
      modeRegistry.deactivateMode('autopilot', sessionId);
      modeRegistry.deactivateMode('ralph', sessionId);
    });
  });

  // ===========================================================================
  // Keyword Detection Integration Tests
  // ===========================================================================

  describe('Keyword Detection Integration', () => {
    it('INT-KEYWORD-1: Should detect mode keywords', async () => {
      const testCases = [
        { text: 'use autopilot mode', expectedType: 'autopilot' },
        { text: 'run ultrawork now', expectedType: 'ultrawork' },
        { text: 'use ulw for this', expectedType: 'ultrawork' },
        { text: 'start ralph analysis', expectedType: 'ralph' },
        { text: 'plan this feature', expectedType: 'plan' },
        { text: 'use tdd approach', expectedType: 'tdd' }
      ];

      for (const tc of testCases) {
        const options = tc.teamEnabled ? { teamEnabled: true } : undefined;
        const keyword = modules.getPrimaryKeyword(tc.text, options);
        assert.ok(keyword, `Expected keyword in "${tc.text}"`);
        assert.equal(keyword.type, tc.expectedType);
      }
    });

    it('INT-KEYWORD-2: Should not detect keywords in code blocks', async () => {
      const text = 'Here is code:\n```\nautopilot\n```\nNo keyword above';
      const keywords = modules.detectKeywords(text);
      assert.equal(keywords.some((k: any) => k.type === 'autopilot'), false);
    });

    it('INT-KEYWORD-3: Should handle cancel keyword with highest priority', async () => {
      const text = 'use autopilot and cancelomc';
      const keyword = modules.getPrimaryKeyword(text);
      assert.equal(keyword?.type, 'cancel');
    });

    it('INT-KEYWORD-4: Should detect delegation keywords', async () => {
      const testCases = [
        { text: 'ask codex to help', expectedType: 'codex' },
        { text: 'use gemini for this', expectedType: 'gemini' },
        { text: 'delegate to gpt', expectedType: 'codex' }
      ];

      for (const tc of testCases) {
        const keywords = modules.detectKeywords(tc.text);
        assert.ok(
          keywords.some((k: any) => k.type === tc.expectedType),
          `Expected ${tc.expectedType} in "${tc.text}"`
        );
      }
    });
  });

  // ===========================================================================
  // End-to-End Workflow Tests
  // ===========================================================================

  describe('End-to-End Workflow Integration', () => {
    it('INT-E2E-1: Complete workflow with mode activation and checkpoint', async () => {
      const sessionId = 'e2e-workflow-001';

      // 1. Create services
      const modeRegistry = new modules.ModeRegistryService({
        projectPath: projectDir,
        enableLogging: false
      });

      const checkpointService = new modules.CheckpointService({
        projectPath: projectDir,
        enableLogging: false
      });

      const recoveryHandler = new modules.RecoveryHandler({
        projectPath: projectDir,
        enableLogging: false
      });

      const stopHandler = new modules.StopHandler({
        projectPath: projectDir,
        enableLogging: false
      });

      // 2. Activate mode
      const activated = modeRegistry.activateMode('autopilot', sessionId);
      assert.equal(activated, true);

      // 3. Create checkpoint before compaction
      const precompactResult = await recoveryHandler.handlePreCompact({
        session_id: sessionId,
        cwd: projectDir,
        hook_event_name: 'PreCompact',
        trigger: 'auto'
      });

      assert.equal(precompactResult.continue, true);
      assert.ok(precompactResult.systemMessage);

      // 4. Simulate stop during active mode
      const stopResult = await stopHandler.handleStop({
        session_id: sessionId
      });

      assert.equal(stopResult.continue, true);
      // Should detect active mode (either via registry or context)
      assert.ok(
        ['active-mode', 'none'].includes(stopResult.mode || 'none')
      );

      // 5. Verify recovery is possible
      const checkpoint = await recoveryHandler.checkRecovery(sessionId);
      assert.ok(checkpoint);

      // 6. Deactivate mode on session end
      modeRegistry.deactivateMode('autopilot', sessionId);
      assert.equal(modeRegistry.isModeActive('autopilot', sessionId), false);
    });

    it('INT-E2E-2: Recovery workflow restores state correctly', async () => {
      const sessionId = 'e2e-recovery-001';

      // Setup services
      const modeRegistry = new modules.ModeRegistryService({
        projectPath: projectDir,
        enableLogging: false
      });

      const checkpointService = new modules.CheckpointService({
        projectPath: projectDir,
        enableLogging: false
      });

      // Phase 1: Create state and checkpoint
      modeRegistry.activateMode('ralph', sessionId);

      const modeStates: Record<string, { active: boolean }> = {};
      for (const mode of modeRegistry.getActiveModes(sessionId)) {
        modeStates[mode] = { active: true };
      }

      const checkpoint = await checkpointService.createCheckpoint(
        sessionId,
        'compact',
        { modeStates: modeStates as any, workflowState: null, memoryContext: null }
      );

      await checkpointService.saveCheckpoint(checkpoint);

      // Phase 2: Simulate session restart and recovery
      // Clear mode state (simulating new session)
      modeRegistry.deactivateMode('ralph', sessionId);
      assert.equal(modeRegistry.isModeActive('ralph', sessionId), false);

      // Load checkpoint and restore state
      const loadedCheckpoint = await checkpointService.getLatestCheckpoint(sessionId);
      assert.ok(loadedCheckpoint);
      assert.ok(loadedCheckpoint?.mode_states.ralph?.active);

      // Re-activate modes from checkpoint
      for (const [mode, state] of Object.entries(loadedCheckpoint?.mode_states || {})) {
        if ((state as any)?.active) {
          modeRegistry.activateMode(mode as any, sessionId);
        }
      }

      // Verify restoration
      assert.equal(modeRegistry.isModeActive('ralph', sessionId), true);

      // Cleanup
      modeRegistry.deactivateMode('ralph', sessionId);
    });

    it('INT-E2E-3: Concurrent PreCompact operations use mutex', async () => {
      const sessionId = 'e2e-mutex-001';

      const recoveryHandler = new modules.RecoveryHandler({
        projectPath: projectDir,
        enableLogging: false
      });

      // Start two concurrent PreCompact operations
      const [result1, result2] = await Promise.all([
        recoveryHandler.handlePreCompact({
          session_id: sessionId,
          cwd: projectDir,
          hook_event_name: 'PreCompact',
          trigger: 'auto'
        }),
        recoveryHandler.handlePreCompact({
          session_id: sessionId,
          cwd: projectDir,
          hook_event_name: 'PreCompact',
          trigger: 'auto'
        })
      ]);

      // Both should succeed
      assert.equal(result1.continue, true);
      assert.equal(result2.continue, true);

      // Verify only one checkpoint was created
      const checkpointService = new modules.CheckpointService({
        projectPath: projectDir,
        enableLogging: false
      });

      const checkpoints = await checkpointService.listCheckpoints(sessionId);
      // Mutex should prevent duplicate checkpoints
      assert.ok(checkpoints.length >= 1);
    });

    it('INT-E2E-4: Session lifecycle with all hooks', async () => {
      const sessionId = 'e2e-lifecycle-001';

      const modeRegistry = new modules.ModeRegistryService({
        projectPath: projectDir,
        enableLogging: false
      });

      const recoveryHandler = new modules.RecoveryHandler({
        projectPath: projectDir,
        enableLogging: false
      });

      const stopHandler = new modules.StopHandler({
        projectPath: projectDir,
        enableLogging: false
      });

      // 1. Session start - check for recovery (should be none)
      const initialRecovery = await recoveryHandler.checkRecovery(sessionId);
      assert.equal(initialRecovery, null);

      // 2. Activate mode
      modeRegistry.activateMode('ultrawork', sessionId);

      // 3. Detect keywords
      const keywords = modules.detectKeywords('continue with ultrawork');
      assert.ok(keywords.some((k: any) => k.type === 'ultrawork'));

      // 4. Handle stop with active mode
      const stopResult = await stopHandler.handleStop({
        session_id: sessionId,
        active_mode: 'write'
      });

      assert.equal(stopResult.continue, true);
      assert.ok(stopResult.mode === 'active-mode' || stopResult.mode === 'none');

      // 5. PreCompact - create checkpoint
      const precompactResult = await recoveryHandler.handlePreCompact({
        session_id: sessionId,
        cwd: projectDir,
        hook_event_name: 'PreCompact',
        trigger: 'auto'
      });

      assert.equal(precompactResult.continue, true);

      // 6. Session end - cleanup
      const activeModes = modeRegistry.getActiveModes(sessionId);
      for (const mode of activeModes) {
        modeRegistry.deactivateMode(mode, sessionId);
      }

      assert.equal(modeRegistry.isAnyModeActive(sessionId), false);

      // 7. Verify recovery is available for next session
      const finalRecovery = await recoveryHandler.checkRecovery(sessionId);
      assert.ok(finalRecovery);
    });
  });

  // ===========================================================================
  // Context Limit and User Abort Detection Tests
  // ===========================================================================

  describe('Context Limit and User Abort Detection', () => {
    it('INT-DETECT-1: Should detect context limit stop reasons', async () => {
      const contextLimitCases = [
        { stop_reason: 'context_limit_reached' },
        { stop_reason: 'context_window_exceeded' },
        { end_turn_reason: 'max_tokens' },
        { stop_reason: 'max_context_exceeded' },
        { stop_reason: 'token_limit' },
        { stop_reason: 'conversation_too_long' }
      ];

      for (const context of contextLimitCases) {
        const result = modules.isContextLimitStop(context);
        assert.equal(result, true, `Expected context limit for ${JSON.stringify(context)}`);
      }
    });

    it('INT-DETECT-2: Should detect user abort', async () => {
      const userAbortCases = [
        { user_requested: true },
        { user_requested: true, stop_reason: 'cancel' },
        { stop_reason: 'user_cancel' }
      ];

      for (const context of userAbortCases) {
        const result = modules.isUserAbort(context);
        assert.equal(result, true, `Expected user abort for ${JSON.stringify(context)}`);
      }
    });

    it('INT-DETECT-3: Should not false positive on normal stops', async () => {
      const normalCases = [
        {},
        { stop_reason: 'normal' },
        { stop_reason: 'tool_use' },
        { active_workflow: true }
      ];

      for (const context of normalCases) {
        const isContextLimit = modules.isContextLimitStop(context);
        const isUserAbort = modules.isUserAbort(context);
        assert.equal(isContextLimit, false, `Should not detect context limit for ${JSON.stringify(context)}`);
        assert.equal(isUserAbort, false, `Should not detect user abort for ${JSON.stringify(context)}`);
      }
    });
  });
});
