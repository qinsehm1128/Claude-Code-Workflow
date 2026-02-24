import { CliTool, ExecutionMode } from './flow';

// ========================================
// Orchestrator Specific Types
// ========================================

/**
 * Strategy for session management during step execution.
 * - 'reuse_default': Use the default session specified in the plan or orchestrator settings.
 * - 'new_session': Create a new session for this step.
 * - 'specific_session': Use a specific session identified by `targetSessionKey`.
 */
export type SessionStrategy = 'reuse_default' | 'new_session' | 'specific_session';

/**
 * Strategy for handling errors within a step or plan.
 * - 'pause_on_error': Pause the orchestration and wait for user intervention.
 * - 'skip': Skip the failing step and proceed with the next.
 * - 'stop': Stop the entire orchestration.
 */
export type ErrorHandlingStrategy = 'pause_on_error' | 'skip' | 'stop';

/**
 * Defines error handling configuration.
 */
export interface ErrorHandling {
  strategy: ErrorHandlingStrategy;
  maxRetries: number;
  retryDelayMs: number;
}

/**
 * Overall status of an orchestration plan.
 */
export type OrchestrationStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Status of an individual orchestration step.
 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'paused' | 'cancelled';

/**
 * Defines the type of execution for an orchestration step.
 * - 'frontend-cli': Execute a command directly in the frontend CLI (e.g., via a pseudo-terminal).
 * - 'backend-flow': Execute a sub-flow defined on the backend.
 * - 'slash-command': Execute a predefined slash command (e.g., /workflow:plan).
 */
export type ExecutionType = 'frontend-cli' | 'backend-flow' | 'slash-command';

/**
 * Metadata about the orchestration plan for display and analysis.
 */
export interface OrchestrationMetadata {
  totalSteps: number;
  hasParallelGroups: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
  // Add any other relevant metadata here
}

/**
 * Source from which the orchestration plan was created.
 */
export type OrchestrationSource = 'flow' | 'queue' | 'manual';

/**
 * Represents a single executable step within an orchestration plan.
 * This is a generalized step that can originate from a flow node, a queue item, or manual input.
 */
export interface OrchestrationStep {
  /**
   * Unique identifier for the step.
   * For flow-based plans, this might correspond to the node ID.
   * For queue-based, it could be item_id or a generated ID.
   */
  id: string;

  /**
   * Display name for the step.
   */
  name: string;

  /**
   * The core instruction for the step.
   * This could be a prompt for a CLI tool, a slash command string, etc.
   */
  instruction: string;

  /**
   * Optional CLI tool to use for execution, if applicable.
   */
  tool?: CliTool;

  /**
   * Optional execution mode (e.g., 'analysis', 'write'), if applicable.
   */
  mode?: ExecutionMode;

  /**
   * Session management strategy for this specific step.
   * Overrides the plan's `defaultSessionStrategy` if provided.
   */
  sessionStrategy?: SessionStrategy;

  /**
   * When `sessionStrategy` is 'specific_session', this key identifies the target session.
   */
  targetSessionKey?: string;

  /**
   * A logical key for resuming or chaining related executions.
   */
  resumeKey?: string;

  /**
   * An array of step IDs that this step depends on.
   * This forms the DAG for execution ordering.
   */
  dependsOn: string[];

  /**
   * An optional condition (e.g., a JavaScript expression) that must evaluate to true for the step to execute.
   */
  condition?: string;

  /**
   * References to outputs from previous steps, used for context injection.
   * E.g., `["analysisResult", "fileContent"]`
   */
  contextRefs?: string[];

  /**
   * The name under which this step's output should be stored,
   * allowing subsequent steps to reference it via `contextRefs`.
   */
  outputName?: string;

  /**
   * Error handling configuration for this specific step.
   * Overrides the plan's `defaultErrorHandling` if provided.
   */
  errorHandling?: ErrorHandling;

  /**
   * The underlying type of execution this step represents.
   */
  executionType: ExecutionType;

  /**
   * Instruction type for native CLI session execution.
   * - prompt: raw text conversation input
   * - skill: CLI-specific skill invocation (prefix determined by CLI tool)
   * - command: CLI native command
   */
  instructionType?: 'prompt' | 'skill' | 'command';

  /**
   * Skill name for instructionType='skill'.
   * The actual prefix (/ or $) is assembled by the backend InstructionAssembler.
   */
  skillName?: string;

  /**
   * For flow-based plans, the ID of the source FlowNode.
   */
  sourceNodeId?: string;

  /**
   * For queue-based plans, the ID of the source QueueItem.
   */
  sourceItemId?: string;
}

/**
 * Represents a complete, executable orchestration plan.
 * This plan is a directed acyclic graph (DAG) of `OrchestrationStep`s.
 */
export interface OrchestrationPlan {
  /**
   * Unique identifier for the plan.
   */
  id: string;

  /**
   * Display name for the plan.
   */
  name: string;

  /**
   * The source from which this plan was generated.
   */
  source: OrchestrationSource;

  /**
   * Optional ID of the source artifact (e.g., Flow ID, Queue ID).
   */
  sourceId?: string;

  /**
   * The ordered list of steps to be executed.
   * The actual execution order will be derived from `dependsOn` relationships,
   * but this array provides a stable definition of all steps.
   */
  steps: OrchestrationStep[];

  /**
   * Global variables that can be used within the plan (e.g., for instruction interpolation).
   */
  variables: Record<string, unknown>;

  /**
   * Default session strategy for steps in this plan if not overridden at the step level.
   */
  defaultSessionStrategy: SessionStrategy;

  /**
   * Default error handling for steps in this plan if not overridden at the step level.
   */
  defaultErrorHandling: ErrorHandling;

  /**
   * Status of the overall plan.
   */
  status: OrchestrationStatus;

  /**
   * Timestamp when the plan was created.
   */
  createdAt: string;

  /**
   * Timestamp when the plan was last updated.
   */
  updatedAt: string;

  /**
   * Analytical metadata about the plan.
   */
  metadata: OrchestrationMetadata;
}

/**
 * Defines the parameters for manually creating an orchestration plan.
 */
export interface ManualOrchestrationParams {
  prompt: string;
  tool?: CliTool;
  mode?: ExecutionMode;
  sessionStrategy?: SessionStrategy;
  targetSessionKey?: string;
  outputName?: string;
  errorHandling?: ErrorHandling;
}
