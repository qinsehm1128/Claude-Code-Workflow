/**
 * Core Services Exports
 *
 * Central export point for all CCW core services.
 */

// Session State Management
export {
  SessionStateService,
  loadSessionState,
  saveSessionState,
  clearSessionState,
  updateSessionState,
  incrementSessionLoad,
  getSessionStatePath,
  validateSessionId
} from './session-state-service.js';
export type {
  SessionState,
  SessionStateOptions,
  SessionStorageType
} from './session-state-service.js';

// Hook Context Service
export { HookContextService } from './hook-context-service.js';
export type { BuildContextOptions, ContextResult } from './hook-context-service.js';

// Session End Service
export { SessionEndService } from './session-end-service.js';
export type { EndTask, TaskResult } from './session-end-service.js';

// Mode Registry Service
export {
  ModeRegistryService,
  MODE_CONFIGS,
  EXCLUSIVE_MODES,
  STALE_MARKER_THRESHOLD,
  createModeRegistryService
} from './mode-registry-service.js';
export type {
  ModeConfig,
  ModeStatus,
  ModeRegistryOptions,
  CanStartResult,
  ExecutionMode
} from './mode-registry-service.js';

// Checkpoint Service
export { CheckpointService, createCheckpointService } from './checkpoint-service.js';
export type {
  CheckpointServiceOptions,
  Checkpoint,
  CheckpointMeta,
  CheckpointTrigger,
  WorkflowStateSnapshot,
  ModeStateSnapshot,
  MemoryContextSnapshot
} from './checkpoint-service.js';

// CLI Session Manager
export { CliSessionManager } from './cli-session-manager.js';
export type {
  CliSession,
  CreateCliSessionOptions,
  ExecuteInCliSessionOptions,
  CliSessionOutputEvent
} from './cli-session-manager.js';

// Flow Executor
export { FlowExecutor } from './flow-executor.js';
export type { ExecutionContext, NodeResult } from './flow-executor.js';

// CLI Launch Registry
export { getLaunchConfig } from './cli-launch-registry.js';
export type { CliLaunchConfig, CliTool, LaunchMode } from './cli-launch-registry.js';
