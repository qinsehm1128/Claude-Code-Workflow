/**
 * ModeWorkflowMap - Mode to Workflow Mapping
 *
 * Maps execution modes to their corresponding workflow types and provides
 * workflow activation configuration for each mode.
 *
 * Mode -> Workflow Mappings:
 *   - autopilot  -> unified-execute-with-file (autonomous multi-step execution)
 *   - ralph      -> team-planex (research and analysis)
 *   - ultrawork  -> test-fix (ultra-focused work with test feedback)
 *   - swarm      -> parallel-agents (multi-agent parallel execution)
 *   - pipeline   -> lite-plan (sequential pipeline execution)
 *   - team       -> team-iterdev (team collaboration)
 *   - ultraqa    -> test-fix (QA-focused test cycles)
 */

import { ExecutionMode, MODE_CONFIGS } from './services/mode-registry-service.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Workflow types supported by the system
 */
export type WorkflowType =
  | 'unified-execute-with-file'
  | 'team-planex'
  | 'test-fix'
  | 'parallel-agents'
  | 'lite-plan'
  | 'team-iterdev';

/**
 * Configuration for workflow activation
 */
export interface WorkflowActivationConfig {
  /** The workflow type to activate */
  workflowType: WorkflowType;
  /** Whether this workflow requires session persistence */
  requiresPersistence: boolean;
  /** Default execution mode for the workflow */
  defaultExecutionMode: 'analysis' | 'write' | 'auto';
  /** Whether parallel execution is supported */
  supportsParallel: boolean;
  /** Maximum concurrent tasks (for parallel workflows) */
  maxConcurrentTasks?: number;
  /** Description of the workflow */
  description: string;
  /** Required context keys for activation */
  requiredContext?: string[];
}

/**
 * Context passed during workflow activation
 */
export interface WorkflowActivationContext {
  /** Session ID for the workflow */
  sessionId: string;
  /** Project root path */
  projectPath: string;
  /** User prompt or task description */
  prompt?: string;
  /** Additional context data */
  metadata?: Record<string, unknown>;
}

/**
 * Result of workflow activation
 */
export interface WorkflowActivationResult {
  /** Whether activation was successful */
  success: boolean;
  /** The session ID (may be new or existing) */
  sessionId: string;
  /** The activated workflow type */
  workflowType: WorkflowType;
  /** Error message if activation failed */
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Mode to Workflow mapping configuration
 *
 * Each mode maps to a specific workflow type with its activation config.
 */
export const MODE_WORKFLOW_MAP: Record<ExecutionMode, WorkflowActivationConfig> = {
  /**
   * Autopilot Mode -> unified-execute-with-file
   * Autonomous execution of multi-step tasks with file-based state persistence.
   */
  autopilot: {
    workflowType: 'unified-execute-with-file',
    requiresPersistence: true,
    defaultExecutionMode: 'write',
    supportsParallel: false,
    description: 'Autonomous multi-step task execution with file-based state',
    requiredContext: ['prompt']
  },

  /**
   * Ralph Mode -> team-planex
   * Research and Analysis Learning Pattern Handler for iterative exploration.
   */
  ralph: {
    workflowType: 'team-planex',
    requiresPersistence: true,
    defaultExecutionMode: 'analysis',
    supportsParallel: false,
    description: 'Research and analysis pattern handler for iterative exploration'
  },

  /**
   * Ultrawork Mode -> test-fix
   * Ultra-focused work mode with test-feedback loop.
   */
  ultrawork: {
    workflowType: 'test-fix',
    requiresPersistence: true,
    defaultExecutionMode: 'write',
    supportsParallel: false,
    description: 'Ultra-focused work mode with test-driven feedback loop'
  },

  /**
   * Swarm Mode -> parallel-agents
   * Multi-agent parallel execution for distributed task processing.
   */
  swarm: {
    workflowType: 'parallel-agents',
    requiresPersistence: true,
    defaultExecutionMode: 'write',
    supportsParallel: true,
    maxConcurrentTasks: 5,
    description: 'Multi-agent parallel execution for distributed tasks'
  },

  /**
   * Pipeline Mode -> lite-plan
   * Sequential pipeline execution for stage-based workflows.
   */
  pipeline: {
    workflowType: 'lite-plan',
    requiresPersistence: true,
    defaultExecutionMode: 'write',
    supportsParallel: false,
    description: 'Sequential pipeline execution for stage-based workflows'
  },

  /**
   * Team Mode -> team-iterdev
   * Team collaboration mode for iterative development.
   */
  team: {
    workflowType: 'team-iterdev',
    requiresPersistence: true,
    defaultExecutionMode: 'write',
    supportsParallel: true,
    maxConcurrentTasks: 3,
    description: 'Team collaboration mode for iterative development'
  },

  /**
   * UltraQA Mode -> test-fix
   * QA-focused test cycles with iterative quality improvements.
   */
  ultraqa: {
    workflowType: 'test-fix',
    requiresPersistence: true,
    defaultExecutionMode: 'write',
    supportsParallel: false,
    description: 'QA-focused test cycles with iterative quality improvements'
  }
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the workflow type for a given execution mode
 *
 * @param mode - The execution mode
 * @returns The corresponding workflow type, or undefined if not found
 */
export function getWorkflowForMode(mode: ExecutionMode): WorkflowType | undefined {
  const config = MODE_WORKFLOW_MAP[mode];
  return config?.workflowType;
}

/**
 * Get the activation configuration for a given execution mode
 *
 * @param mode - The execution mode
 * @returns The activation configuration, or undefined if not found
 */
export function getActivationConfig(mode: ExecutionMode): WorkflowActivationConfig | undefined {
  return MODE_WORKFLOW_MAP[mode];
}

/**
 * Get all modes that map to a specific workflow type
 *
 * @param workflowType - The workflow type to filter by
 * @returns Array of execution modes that use this workflow
 */
export function getModesForWorkflow(workflowType: WorkflowType): ExecutionMode[] {
  return (Object.entries(MODE_WORKFLOW_MAP) as [ExecutionMode, WorkflowActivationConfig][])
    .filter(([, config]) => config.workflowType === workflowType)
    .map(([mode]) => mode);
}

/**
 * Check if a mode supports parallel execution
 *
 * @param mode - The execution mode
 * @returns true if the mode supports parallel execution
 */
export function isParallelMode(mode: ExecutionMode): boolean {
  const config = MODE_WORKFLOW_MAP[mode];
  return config?.supportsParallel ?? false;
}

/**
 * Get the maximum concurrent tasks for a parallel mode
 *
 * @param mode - The execution mode
 * @returns Maximum concurrent tasks, or 1 if not a parallel mode
 */
export function getMaxConcurrentTasks(mode: ExecutionMode): number {
  const config = MODE_WORKFLOW_MAP[mode];
  if (!config?.supportsParallel) {
    return 1;
  }
  return config.maxConcurrentTasks ?? 3;
}

/**
 * Validate that required context is present for mode activation
 *
 * @param mode - The execution mode
 * @param context - The activation context
 * @returns Object with valid flag and missing keys if any
 */
export function validateActivationContext(
  mode: ExecutionMode,
  context: WorkflowActivationContext
): { valid: boolean; missingKeys: string[] } {
  const config = MODE_WORKFLOW_MAP[mode];
  const requiredKeys = config?.requiredContext ?? [];
  const missingKeys: string[] = [];

  for (const key of requiredKeys) {
    if (key === 'prompt' && !context.prompt) {
      missingKeys.push(key);
    } else if (key === 'sessionId' && !context.sessionId) {
      missingKeys.push(key);
    } else if (key === 'projectPath' && !context.projectPath) {
      missingKeys.push(key);
    } else if (key.startsWith('metadata.') && context.metadata) {
      const metaKey = key.substring('metadata.'.length);
      if (!(metaKey in context.metadata)) {
        missingKeys.push(key);
      }
    }
  }

  return {
    valid: missingKeys.length === 0,
    missingKeys
  };
}

/**
 * Activate a workflow for a given mode
 *
 * This function creates the necessary session state and returns
 * activation result. The actual workflow execution is handled
 * by the respective workflow handlers.
 *
 * @param mode - The execution mode to activate
 * @param context - The activation context
 * @returns Promise resolving to activation result
 */
export async function activateWorkflowForMode(
  mode: ExecutionMode,
  context: WorkflowActivationContext
): Promise<WorkflowActivationResult> {
  const config = MODE_WORKFLOW_MAP[mode];
  const modeConfig = MODE_CONFIGS[mode];

  // Validate mode exists
  if (!config) {
    return {
      success: false,
      sessionId: context.sessionId,
      workflowType: 'unified-execute-with-file', // Default fallback
      error: `Unknown mode: ${mode}`
    };
  }

  // Validate required context
  const validation = validateActivationContext(mode, context);
  if (!validation.valid) {
    return {
      success: false,
      sessionId: context.sessionId,
      workflowType: config.workflowType,
      error: `Missing required context: ${validation.missingKeys.join(', ')}`
    };
  }

  // Validate session ID
  if (!context.sessionId) {
    return {
      success: false,
      sessionId: '',
      workflowType: config.workflowType,
      error: 'Session ID is required for workflow activation'
    };
  }

  // Return success result
  // Note: Actual session state persistence is handled by ModeRegistryService
  return {
    success: true,
    sessionId: context.sessionId,
    workflowType: config.workflowType
  };
}

/**
 * Get a human-readable description for a mode's workflow
 *
 * @param mode - The execution mode
 * @returns Description string
 */
export function getWorkflowDescription(mode: ExecutionMode): string {
  const config = MODE_WORKFLOW_MAP[mode];
  const modeConfig = MODE_CONFIGS[mode];
  return config?.description ?? modeConfig?.description ?? `Workflow for ${mode} mode`;
}

/**
 * List all available mode-to-workflow mappings
 *
 * @returns Array of mode-workflow mapping entries
 */
export function listModeWorkflowMappings(): Array<{
  mode: ExecutionMode;
  workflowType: WorkflowType;
  description: string;
  supportsParallel: boolean;
}> {
  return (Object.entries(MODE_WORKFLOW_MAP) as [ExecutionMode, WorkflowActivationConfig][])
    .map(([mode, config]) => ({
      mode,
      workflowType: config.workflowType,
      description: config.description,
      supportsParallel: config.supportsParallel
    }));
}
