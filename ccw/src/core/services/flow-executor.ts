/**
 * Flow Execution Engine
 *
 * FlowExecutor: Executes flow definitions using DAG traversal with:
 * - Topological sorting for execution order
 * - NodeRunner for type-specific node execution
 * - Variable interpolation using {{variable}} syntax
 * - State persistence to status.json
 * - WebSocket broadcasts for real-time updates
 *
 * Integrates with:
 * - orchestrator-routes.ts for execution control endpoints
 * - websocket.ts for real-time broadcasts
 * - cli-executor for slash-command execution
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { broadcastToClients } from '../websocket.js';
import { executeCliTool } from '../../tools/cli-executor-core.js';
import { cliSessionMux } from './cli-session-mux.js';
import { appendCliSessionAudit } from './cli-session-audit.js';
import { assembleInstruction, type InstructionType } from './cli-instruction-assembler.js';
import type {
  Flow,
  FlowNode,
  FlowEdge,
  FlowNodeType,
  ExecutionState,
  ExecutionStatus as RouteExecutionStatus,
  NodeExecutionState,
  NodeExecutionStatus,
  ExecutionLog,
  PromptTemplateNodeData,
  CliTool,
  ExecutionMode,
} from '../routes/orchestrator-routes.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Execution context passed to node runners
 */
export interface ExecutionContext {
  executionId: string;
  flowId: string;
  workingDir: string;
  variables: Record<string, unknown>;
  nodeResults: Record<string, NodeResult>;
  fileContext: Array<{ path: string; content?: string; operation?: string }>;
}

/**
 * Result from executing a single node
 */
export interface NodeResult {
  success: boolean;
  output?: unknown;
  error?: string;
  branch?: 'true' | 'false';
  exitCode?: number;
}

/**
 * DAG adjacency list representation
 */
interface DAGNode {
  nodeId: string;
  node: FlowNode;
  incoming: string[];  // Dependencies (nodes that must run before this one)
  outgoing: string[];  // Dependents (nodes that run after this one)
}

/**
 * Options for FlowExecutor
 */
export interface FlowExecutorOptions {
  onNodeStarted?: (nodeId: string) => void;
  onNodeCompleted?: (nodeId: string, result: NodeResult) => void;
  onNodeFailed?: (nodeId: string, error: string) => void;
  onStateUpdate?: (state: ExecutionState) => void;
}

// ============================================================================
// Variable Interpolation
// ============================================================================

/**
 * Interpolate {{variable}} placeholders in a template string
 * Supports nested access: {{result.output}}, {{prevResult.exitCode}}
 *
 * @param template - String containing {{variable}} placeholders
 * @param variables - Object containing variable values
 * @returns Interpolated string with placeholders replaced
 */
export function interpolate(template: string, variables: Record<string, unknown>): string {
  if (!template || typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    const value = getNestedValue(variables, trimmedPath);

    if (value === undefined || value === null) {
      // Keep original placeholder if value not found
      return match;
    }

    // Convert to string
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

/**
 * Get nested value from object using dot notation
 * e.g., getNestedValue({a: {b: 1}}, 'a.b') returns 1
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Interpolate all string values in an object recursively
 */
export function interpolateObject<T>(obj: T, variables: Record<string, unknown>): T {
  if (typeof obj === 'string') {
    return interpolate(obj, variables) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => interpolateObject(item, variables)) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateObject(value, variables);
    }
    return result as T;
  }

  return obj;
}

// ============================================================================
// NodeRunner - Unified Prompt Template Execution
// ============================================================================

/**
 * Default CLI tool when not specified
 */
const DEFAULT_CLI_TOOL: CliTool = 'claude';

/**
 * NodeRunner executes unified prompt-template nodes
 * All nodes are interpreted through natural language instructions
 */
export class NodeRunner {
  private context: ExecutionContext;

  constructor(context: ExecutionContext) {
    this.context = context;
  }

  /**
   * Execute a node and return the result
   * All nodes are prompt-template type
   */
  async run(node: FlowNode): Promise<NodeResult> {
    // All nodes are prompt-template type
    if (node.type === 'prompt-template') {
      return this.runPromptTemplate(node);
    }

    // Fallback for any legacy node types
    return {
      success: false,
      error: `Unsupported node type: ${node.type}. Only 'prompt-template' is supported.`
    };
  }

  /**
   * Execute a prompt-template node
   * Interprets instruction field to build and execute CLI command
   */
  private async runPromptTemplate(node: FlowNode): Promise<NodeResult> {
    const data = node.data as PromptTemplateNodeData;

    // Construct instruction from slash command fields if set, otherwise use raw instruction
    let instruction: string;
    if (data.slashCommand) {
      const args = data.slashArgs
        ? interpolate(data.slashArgs, this.context.variables)
        : '';
      instruction = `/${data.slashCommand}${args ? ' ' + args : ''}`;
      // Append additional instruction if provided
      if (data.instruction) {
        const additional = interpolate(data.instruction, this.context.variables);
        instruction = `${instruction}\n\n${additional}`;
      }
    } else {
      instruction = interpolate(data.instruction, this.context.variables);
    }

    // Resolve context references
    if (data.contextRefs && data.contextRefs.length > 0) {
      const contextContent = this.resolveContextRefs(data.contextRefs);
      if (contextContent) {
        instruction = `${contextContent}\n\n${instruction}`;
      }
    }

    // Add file context if available
    if (this.context.fileContext.length > 0) {
      const fileContextStr = this.context.fileContext
        .filter(fc => fc.content)
        .map(fc => `=== File: ${fc.path} ===\n${fc.content}`)
        .join('\n\n');

      if (fileContextStr) {
        instruction = `${fileContextStr}\n\n${instruction}`;
      }
    }

    // Determine tool and mode
    const tool = data.tool || DEFAULT_CLI_TOOL;
    const mode = this.determineCliMode(data.mode);

    try {
      // Optional: route execution to a PTY session (tmux-like send)
      if (data.delivery === 'sendToSession') {
        const targetSessionKey = data.targetSessionKey;
        if (!targetSessionKey) {
          return {
            success: false,
            error: 'delivery=sendToSession requires targetSessionKey'
          };
        }

        const manager = cliSessionMux.findCliSessionManager(targetSessionKey)
          ?? cliSessionMux.getCliSessionManager(this.context.workingDir || process.cwd());
        if (!manager.hasSession(targetSessionKey)) {
          return {
            success: false,
            error: `Target session not found: ${targetSessionKey}`
          };
        }

        // Resolve instructionType and skillName for native CLI sessions
        let instructionType = data.instructionType;
        let skillName = data.skillName;
        if (!instructionType) {
          if (skillName) {
            instructionType = 'skill';
          } else if (data.slashCommand) {
            // Backward compat: map slashCommand to skill
            instructionType = 'skill';
            skillName = data.slashCommand;
          } else {
            instructionType = 'prompt';
          }
        }

        const routed = manager.execute(targetSessionKey, {
          tool,
          prompt: instruction,
          mode,
          resumeKey: data.resumeKey,
          resumeStrategy: data.resumeStrategy === 'promptConcat' ? 'promptConcat' : 'nativeResume',
          instructionType: instructionType as InstructionType,
          skillName,
        });

        // Best-effort: record audit event so Observability panel includes orchestrator-routed executions.
        try {
          const session = manager.getSession(targetSessionKey);
          appendCliSessionAudit({
            type: 'session_execute',
            timestamp: new Date().toISOString(),
            projectRoot: manager.getProjectRoot(),
            sessionKey: targetSessionKey,
            tool,
            resumeKey: data.resumeKey,
            workingDir: session?.workingDir,
            details: {
              executionId: routed.executionId,
              mode,
              resumeStrategy: data.resumeStrategy ?? 'nativeResume',
              delivery: 'sendToSession',
              flowId: this.context.flowId,
              nodeId: node.id
            }
          });
        } catch {
          // ignore
        }

        const outputKey = data.outputName || `${node.id}_output`;
        this.context.variables[outputKey] = {
          delivery: 'sendToSession',
          sessionKey: targetSessionKey,
          executionId: routed.executionId,
          command: routed.command
        };
        this.context.variables[`${node.id}_executionId`] = routed.executionId;
        this.context.variables[`${node.id}_command`] = routed.command;
        this.context.variables[`${node.id}_success`] = true;

        return {
          success: true,
          output: routed.command,
          exitCode: 0
        };
      }

      // Execute via CLI tool
      const result = await executeCliTool({
        tool,
        prompt: instruction,
        mode,
        cd: this.context.workingDir
      });

      // Store output using outputName if specified, otherwise use node.id
      const outputKey = data.outputName || `${node.id}_output`;
      this.context.variables[outputKey] = result.stdout;
      this.context.variables[`${node.id}_exitCode`] = result.execution?.exit_code ?? 0;
      this.context.variables[`${node.id}_success`] = result.success;

      // If outputName is specified, also store structured result
      if (data.outputName) {
        this.context.variables[data.outputName] = result.stdout;
      }

      return {
        success: result.success,
        output: result.stdout,
        exitCode: result.execution?.exit_code ?? 0
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Resolve context references to actual output values
   * Looks up outputName values from previous nodes
   */
  private resolveContextRefs(refs: string[]): string {
    const resolvedParts: string[] = [];

    for (const ref of refs) {
      const value = this.context.variables[ref];
      if (value !== undefined && value !== null) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        resolvedParts.push(`=== Context: ${ref} ===\n${valueStr}`);
      }
    }

    return resolvedParts.join('\n\n');
  }

  /**
   * Determine CLI mode from execution mode
   * Maps prompt-template modes to CLI executor modes
   */
  private determineCliMode(mode?: ExecutionMode): 'analysis' | 'write' {
    switch (mode) {
      case 'write':
      case 'mainprocess':
        return 'write';
      case 'analysis':
      case 'async':
      default:
        return 'analysis';
    }
  }
}

// ============================================================================
// FlowExecutor - Main Execution Engine
// ============================================================================

/**
 * FlowExecutor orchestrates the execution of a flow definition
 * using DAG traversal with topological sorting
 */
export class FlowExecutor {
  private flow: Flow;
  private executionId: string;
  private workflowDir: string;
  private options: FlowExecutorOptions;
  private state: ExecutionState;
  private dag: Map<string, DAGNode>;
  private pauseRequested: boolean = false;
  private stopRequested: boolean = false;

  constructor(
    flow: Flow,
    executionId: string,
    workflowDir: string,
    options: FlowExecutorOptions = {}
  ) {
    this.flow = flow;
    this.executionId = executionId;
    this.workflowDir = workflowDir;
    this.options = options;
    this.dag = new Map();

    // Initialize execution state
    this.state = this.createInitialState();
  }

  /**
   * Create initial execution state
   */
  private createInitialState(): ExecutionState {
    const nodeStates: Record<string, NodeExecutionState> = {};
    for (const node of this.flow.nodes) {
      nodeStates[node.id] = { status: 'pending' };
    }

    return {
      id: this.executionId,
      flowId: this.flow.id,
      status: 'pending',
      variables: { ...this.flow.variables },
      nodeStates,
      logs: []
    };
  }

  /**
   * Build DAG from flow nodes and edges
   * Returns adjacency list representation
   */
  buildDAG(): Map<string, DAGNode> {
    this.dag.clear();

    // Initialize DAG nodes
    for (const node of this.flow.nodes) {
      this.dag.set(node.id, {
        nodeId: node.id,
        node,
        incoming: [],
        outgoing: []
      });
    }

    // Add edges
    for (const edge of this.flow.edges) {
      const sourceNode = this.dag.get(edge.source);
      const targetNode = this.dag.get(edge.target);

      if (sourceNode && targetNode) {
        sourceNode.outgoing.push(edge.target);
        targetNode.incoming.push(edge.source);
      }
    }

    return this.dag;
  }

  /**
   * Perform topological sort using Kahn's algorithm
   * Returns nodes in execution order
   */
  topologicalSort(): FlowNode[] {
    if (this.dag.size === 0) {
      this.buildDAG();
    }

    const sorted: FlowNode[] = [];
    const inDegree = new Map<string, number>();
    const queue: string[] = [];

    // Calculate in-degrees
    for (const [nodeId, dagNode] of this.dag) {
      inDegree.set(nodeId, dagNode.incoming.length);
      if (dagNode.incoming.length === 0) {
        queue.push(nodeId);
      }
    }

    // Process nodes with zero in-degree
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const dagNode = this.dag.get(nodeId);

      if (dagNode) {
        sorted.push(dagNode.node);

        // Reduce in-degree of dependents
        for (const dependentId of dagNode.outgoing) {
          const currentDegree = inDegree.get(dependentId) || 0;
          const newDegree = currentDegree - 1;
          inDegree.set(dependentId, newDegree);

          if (newDegree === 0) {
            queue.push(dependentId);
          }
        }
      }
    }

    // Check for cycles
    if (sorted.length !== this.flow.nodes.length) {
      this.addLog('error', 'Flow contains cycles - cannot execute');
      throw new Error('Flow contains cycles - cannot perform topological sort');
    }

    return sorted;
  }

  /**
   * Get nodes ready for execution (all dependencies completed)
   */
  private getReadyNodes(sortedNodes: FlowNode[]): FlowNode[] {
    const ready: FlowNode[] = [];

    for (const node of sortedNodes) {
      const nodeState = this.state.nodeStates[node.id];

      // Skip if already completed, failed, or skipped
      if (nodeState.status !== 'pending') {
        continue;
      }

      // Check if all dependencies are completed
      const dagNode = this.dag.get(node.id);
      if (!dagNode) continue;

      const allDepsCompleted = dagNode.incoming.every(depId => {
        const depState = this.state.nodeStates[depId];
        return depState && (depState.status === 'completed' || depState.status === 'skipped');
      });

      // For conditional branches, check if we should skip
      if (allDepsCompleted) {
        const shouldSkip = this.shouldSkipNode(node);
        if (shouldSkip) {
          nodeState.status = 'skipped';
          continue;
        }
        ready.push(node);
      }
    }

    return ready;
  }

  /**
   * Check if a node should be skipped
   * With unified prompt-template model, conditional logic is handled
   * via natural language instructions interpreted by the LLM
   */
  private shouldSkipNode(_node: FlowNode): boolean {
    // With unified prompt-template nodes, branching decisions are made
    // by the LLM interpreting instructions. No special skip logic needed.
    return false;
  }

  /**
   * Main execution method
   * Executes the flow and returns final state
   */
  async execute(initialVariables?: Record<string, unknown>): Promise<ExecutionState> {
    // Merge initial variables
    if (initialVariables) {
      this.state.variables = { ...this.state.variables, ...initialVariables };
    }

    // Build DAG and get execution order
    this.buildDAG();
    const sortedNodes = this.topologicalSort();

    // Start execution
    this.state.status = 'running';
    this.state.startedAt = new Date().toISOString();
    this.addLog('info', `Starting execution of flow: ${this.flow.name}`);
    await this.persistState();
    this.broadcastStateUpdate();

    // Create execution context
    const context: ExecutionContext = {
      executionId: this.executionId,
      flowId: this.flow.id,
      workingDir: this.workflowDir,
      variables: this.state.variables,
      nodeResults: {},
      fileContext: []
    };

    try {
      // Main execution loop
      while (true) {
        // Check for pause/stop requests
        if (this.stopRequested) {
          this.state.status = 'failed';
          this.addLog('warn', 'Execution stopped by user');
          break;
        }

        if (this.pauseRequested) {
          this.state.status = 'paused';
          this.addLog('info', 'Execution paused');
          await this.persistState();
          this.broadcastStateUpdate();
          return this.state;
        }

        // Get nodes ready for execution
        const readyNodes = this.getReadyNodes(sortedNodes);

        // If no ready nodes and not all completed, check for completion
        if (readyNodes.length === 0) {
          const allCompleted = Object.values(this.state.nodeStates).every(
            s => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped'
          );

          if (allCompleted) {
            // Check if any nodes failed
            const anyFailed = Object.values(this.state.nodeStates).some(s => s.status === 'failed');
            this.state.status = anyFailed ? 'failed' : 'completed';
            break;
          }

          // Should not happen if DAG is valid
          throw new Error('Execution stuck: no ready nodes but not all completed');
        }

        // Execute ready nodes
        // For now, execute sequentially; parallel nodes handle their own forking
        for (const node of readyNodes) {
          if (this.stopRequested || this.pauseRequested) break;

          await this.executeNode(node, context);
        }
      }
    } catch (error) {
      this.state.status = 'failed';
      this.addLog('error', `Execution failed: ${(error as Error).message}`);
    }

    // Finalize
    this.state.completedAt = new Date().toISOString();
    this.addLog('info', `Execution ${this.state.status}: ${this.flow.name}`);
    await this.persistState();
    this.broadcastStateUpdate();

    return this.state;
  }

  /**
   * Execute a single node
   * All nodes are prompt-template type in the unified model
   */
  private async executeNode(node: FlowNode, context: ExecutionContext): Promise<void> {
    const nodeState = this.state.nodeStates[node.id];
    const now = new Date().toISOString();

    // Update state to running
    nodeState.status = 'running';
    nodeState.startedAt = now;
    this.state.currentNodeId = node.id;
    await this.persistState();

    // Broadcast node started
    this.broadcastNodeStarted(node.id);
    this.options.onNodeStarted?.(node.id);
    this.addLog('info', `Starting node: ${node.id} (${node.type})`, node.id);

    try {
      // Create node runner with current context
      const runner = new NodeRunner(context);

      // Execute the node (all nodes are prompt-template type)
      const result = await runner.run(node);

      // Update node state
      nodeState.status = result.success ? 'completed' : 'failed';
      nodeState.completedAt = new Date().toISOString();
      nodeState.result = result;

      if (!result.success && result.error) {
        nodeState.error = result.error;
      }

      // Store result in context
      context.nodeResults[node.id] = result;
      context.variables[`${node.id}_result`] = result;

      // Sync variables back to state
      this.state.variables = context.variables;

      await this.persistState();

      if (result.success) {
        this.broadcastNodeCompleted(node.id, result);
        this.options.onNodeCompleted?.(node.id, result);
        this.addLog('info', `Completed node: ${node.id}`, node.id);
      } else {
        // Handle error based on node's onError setting
        const nodeData = node.data as PromptTemplateNodeData;
        const onError = nodeData.onError || 'fail';

        this.addLog('error', `Node failed: ${node.id} - ${result.error}`, node.id);
        this.broadcastNodeFailed(node.id, result.error || 'Unknown error');
        this.options.onNodeFailed?.(node.id, result.error || 'Unknown error');

        if (onError === 'fail') {
          throw new Error(`Node ${node.id} failed: ${result.error}`);
        } else if (onError === 'pause') {
          this.pauseRequested = true;
        }
        // 'continue' - just move on to next node
      }
    } catch (error) {
      nodeState.status = 'failed';
      nodeState.completedAt = new Date().toISOString();
      nodeState.error = (error as Error).message;

      await this.persistState();
      this.broadcastNodeFailed(node.id, (error as Error).message);
      this.options.onNodeFailed?.(node.id, (error as Error).message);

      throw error;
    }
  }

  /**
   * Request pause (will pause at next safe point)
   */
  pause(): void {
    this.pauseRequested = true;
    this.addLog('info', 'Pause requested');
  }

  /**
   * Resume from paused state
   */
  async resume(additionalVariables?: Record<string, unknown>): Promise<ExecutionState> {
    if (this.state.status !== 'paused') {
      throw new Error('Cannot resume: execution is not paused');
    }

    this.pauseRequested = false;

    if (additionalVariables) {
      this.state.variables = { ...this.state.variables, ...additionalVariables };
    }

    // Continue execution
    return this.execute();
  }

  /**
   * Request stop (will stop at next safe point)
   */
  stop(): void {
    this.stopRequested = true;
    this.addLog('warn', 'Stop requested');
  }

  /**
   * Get current execution state
   */
  getState(): ExecutionState {
    return { ...this.state };
  }

  // ============================================================================
  // State Persistence
  // ============================================================================

  /**
   * Persist execution state to disk
   */
  private async persistState(): Promise<void> {
    const executionsDir = join(this.workflowDir, '.workflow', '.orchestrator', 'executions');
    const execDir = join(executionsDir, this.executionId);
    const statusPath = join(execDir, 'status.json');

    try {
      if (!existsSync(execDir)) {
        await mkdir(execDir, { recursive: true });
      }

      await writeFile(statusPath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[FlowExecutor] Failed to persist state: ${(error as Error).message}`);
    }
  }

  // ============================================================================
  // WebSocket Broadcasts
  // ============================================================================

  /**
   * Broadcast state update
   */
  private broadcastStateUpdate(): void {
    try {
      broadcastToClients({
        type: 'ORCHESTRATOR_STATE_UPDATE',
        execId: this.executionId,
        status: this.state.status,
        currentNodeId: this.state.currentNodeId,
        timestamp: new Date().toISOString()
      });
      this.options.onStateUpdate?.(this.state);
    } catch (error) {
      // Ignore broadcast errors
    }
  }

  /**
   * Broadcast node started event
   */
  private broadcastNodeStarted(nodeId: string): void {
    try {
      broadcastToClients({
        type: 'ORCHESTRATOR_NODE_STARTED',
        execId: this.executionId,
        nodeId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Ignore broadcast errors
    }
  }

  /**
   * Broadcast node completed event
   */
  private broadcastNodeCompleted(nodeId: string, result: NodeResult): void {
    try {
      broadcastToClients({
        type: 'ORCHESTRATOR_NODE_COMPLETED',
        execId: this.executionId,
        nodeId,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Ignore broadcast errors
    }
  }

  /**
   * Broadcast node failed event
   */
  private broadcastNodeFailed(nodeId: string, error: string): void {
    try {
      broadcastToClients({
        type: 'ORCHESTRATOR_NODE_FAILED',
        execId: this.executionId,
        nodeId,
        error,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Ignore broadcast errors
    }
  }

  // ============================================================================
  // Logging
  // ============================================================================

  /**
   * Add log entry to execution state
   */
  private addLog(level: ExecutionLog['level'], message: string, nodeId?: string): void {
    const log: ExecutionLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(nodeId && { nodeId })
    };

    this.state.logs.push(log);

    // Also broadcast log entry
    try {
      broadcastToClients({
        type: 'ORCHESTRATOR_LOG',
        execId: this.executionId,
        log
      });
    } catch (error) {
      // Ignore broadcast errors
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create and execute a flow
 * Convenience function for simple execution scenarios
 */
export async function executeFlow(
  flow: Flow,
  executionId: string,
  workflowDir: string,
  options?: FlowExecutorOptions & { variables?: Record<string, unknown> }
): Promise<ExecutionState> {
  const { variables, ...executorOptions } = options || {};
  const executor = new FlowExecutor(flow, executionId, workflowDir, executorOptions);
  return executor.execute(variables);
}

/**
 * Load flow from storage and execute
 */
export async function executeFlowById(
  flowId: string,
  executionId: string,
  workflowDir: string,
  options?: FlowExecutorOptions & { variables?: Record<string, unknown> }
): Promise<ExecutionState> {
  const flowsDir = join(workflowDir, '.workflow', '.orchestrator', 'flows');
  const flowPath = join(flowsDir, `${flowId}.json`);

  if (!existsSync(flowPath)) {
    throw new Error(`Flow not found: ${flowId}`);
  }

  const content = await readFile(flowPath, 'utf-8');
  const flow = JSON.parse(content) as Flow;

  return executeFlow(flow, executionId, workflowDir, options);
}
