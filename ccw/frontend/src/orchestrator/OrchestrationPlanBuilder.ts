import {
  OrchestrationPlan,
  OrchestrationStep,
  SessionStrategy,
  ErrorHandling,
  ExecutionType,
  OrchestrationMetadata,
  ManualOrchestrationParams,
} from '../types/orchestrator';
import { Flow, FlowNode, PromptTemplateNodeData } from '../types/flow';
import { IssueQueue } from '../lib/api';
import { buildQueueItemContext } from '../lib/queue-prompt'; // Assuming this function is available

/**
 * Builds OrchestrationPlan objects from various sources (Flow, IssueQueue, Manual Input).
 * This class is responsible for transforming source data into a standardized OrchestrationPlan,
 * including dependency resolution, context mapping, and basic plan metadata generation.
 */
export class OrchestrationPlanBuilder {
  private static DEFAULT_SESSION_STRATEGY: SessionStrategy = 'reuse_default';
  private static DEFAULT_ERROR_HANDLING: ErrorHandling = {
    strategy: 'pause_on_error',
    maxRetries: 0,
    retryDelayMs: 0,
  };

  /**
   * Converts a Flow DAG into a topologically-sorted OrchestrationPlan.
   *
   * @param flow The Flow object to convert.
   * @returns An OrchestrationPlan.
   */
  public static fromFlow(flow: Flow): OrchestrationPlan {
    const steps: OrchestrationStep[] = [];
    const nodeMap = new Map<string, FlowNode>(flow.nodes.map((node) => [node.id, node]));
    const adjacencyList = new Map<string, string[]>(); // node.id -> list of dependent node.ids
    const inDegree = new Map<string, number>(); // node.id -> count of incoming edges

    // Initialize in-degrees and adjacency list
    for (const node of flow.nodes) {
      inDegree.set(node.id, 0);
      adjacencyList.set(node.id, []);
    }

    for (const edge of flow.edges) {
      // Ensure the edge target node exists before incrementing in-degree
      if (inDegree.has(edge.target)) {
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        // Ensure the adjacency list source node exists before adding
        adjacencyList.get(edge.source)?.push(edge.target);
      }
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const sortedNodeIds: string[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      sortedNodeIds.push(nodeId);

      for (const neighborId of adjacencyList.get(nodeId) || []) {
        inDegree.set(neighborId, (inDegree.get(neighborId) || 0) - 1);
        if (inDegree.get(neighborId) === 0) {
          queue.push(neighborId);
        }
      }
    }

    // Cycle detection
    if (sortedNodeIds.length !== flow.nodes.length) {
      // This should ideally be a more specific error or an exception
      console.error('Cycle detected in flow graph. Topological sort failed.');
      throw new Error('Cycle detected in flow graph. Cannot build orchestration plan from cyclic flow.');
    }

    // Convert sorted nodes to OrchestrationSteps
    for (const nodeId of sortedNodeIds) {
      const node = nodeMap.get(nodeId)!;
      const nodeData = node.data as PromptTemplateNodeData; // Assuming all nodes are PromptTemplateNodeData

      const dependsOn = flow.edges
        .filter((edge) => edge.target === node.id)
        .map((edge) => edge.source);

      // Map delivery to sessionStrategy
      let sessionStrategy: SessionStrategy | undefined;
      if (nodeData.delivery === 'newExecution') {
        sessionStrategy = 'new_session';
      } else if (nodeData.delivery === 'sendToSession' && nodeData.targetSessionKey) {
        sessionStrategy = 'specific_session';
      } else if (nodeData.delivery === 'sendToSession' && !nodeData.targetSessionKey) {
        // Fallback or explicit default if targetSessionKey is missing for sendToSession
        sessionStrategy = 'reuse_default';
      }

      // Determine execution type
      let executionType: ExecutionType = 'frontend-cli'; // Default
      if (nodeData.slashCommand) {
        executionType = 'slash-command';
      } else if (nodeData.tool && nodeData.mode) {
        executionType = 'frontend-cli';
      }

      // Resolve instructionType and skillName
      // Priority: explicit instructionType > slashCommand backward compat > default prompt
      let instructionType = nodeData.instructionType;
      let skillName = nodeData.skillName;
      if (!instructionType) {
        if (skillName) {
          instructionType = 'skill';
        } else if (nodeData.slashCommand) {
          // Backward compat: map slashCommand to skill type
          instructionType = 'skill';
          skillName = nodeData.slashCommand;
        } else {
          instructionType = 'prompt';
        }
      }

      steps.push({
        id: node.id,
        name: nodeData.label || `Step ${node.id}`,
        instruction: nodeData.instruction || '',
        tool: nodeData.tool,
        mode: nodeData.mode,
        sessionStrategy: sessionStrategy,
        targetSessionKey: nodeData.targetSessionKey,
        resumeKey: nodeData.resumeKey,
        dependsOn: dependsOn,
        condition: nodeData.condition,
        contextRefs: nodeData.contextRefs,
        outputName: nodeData.outputName,
        // Error handling can be added at node level if flow nodes support it
        errorHandling: undefined,
        executionType: executionType,
        sourceNodeId: node.id,
        instructionType,
        skillName,
      });
    }

    const metadata: OrchestrationMetadata = {
      totalSteps: steps.length,
      hasParallelGroups: OrchestrationPlanBuilder.detectParallelGroups(steps), // Implement this
      estimatedComplexity: OrchestrationPlanBuilder.estimateComplexity(steps), // Implement this
    };

    return {
      id: flow.id,
      name: flow.name,
      source: 'flow',
      sourceId: flow.id,
      steps: steps,
      variables: flow.variables,
      defaultSessionStrategy: OrchestrationPlanBuilder.DEFAULT_SESSION_STRATEGY,
      defaultErrorHandling: OrchestrationPlanBuilder.DEFAULT_ERROR_HANDLING,
      status: 'pending',
      createdAt: flow.created_at,
      updatedAt: flow.updated_at,
      metadata: metadata,
    };
  }

  /**
   * Converts an IssueQueue with execution groups into an OrchestrationPlan.
   *
   * @param queue The IssueQueue object.
   * @param issues A map of issue IDs to Issue objects, needed for context.
   * @returns An OrchestrationPlan.
   */
  public static fromQueue(queue: IssueQueue, issues: Map<string, any>): OrchestrationPlan {
    const steps: OrchestrationStep[] = [];
    const groupIdToSteps = new Map<string, string[]>(); // Maps group ID to list of step IDs in that group
    const allStepIds = new Set<string>();

    let previousGroupStepIds: string[] = [];

    for (const groupId of queue.execution_groups) {
      const groupItems = queue.grouped_items[groupId] || [];
      const currentGroupStepIds: string[] = [];
      const groupDependsOn: string[] = []; // Dependencies for the current group

      if (groupId.startsWith('S*') || groupId.startsWith('P*')) {
        // Sequential or parallel groups: depend on all steps from the previous group
        groupDependsOn.push(...previousGroupStepIds);
      }

      for (const item of groupItems) {
        const stepId = `queue-item-${item.item_id}`;
        allStepIds.add(stepId);
        currentGroupStepIds.push(stepId);

        // Fetch the associated issue
        const issue = issues.get(item.issue_id);
        const instruction = issue ? buildQueueItemContext(item, issue) : `Execute queue item ${item.item_id}`;

        // Queue items are typically frontend-cli executions
        const executionType: ExecutionType = 'frontend-cli';

        steps.push({
          id: stepId,
          name: `Queue Item: ${item.item_id}`,
          instruction: instruction,
          tool: undefined, // Queue items don't typically specify tool/mode directly
          mode: undefined,
          sessionStrategy: OrchestrationPlanBuilder.DEFAULT_SESSION_STRATEGY,
          targetSessionKey: undefined,
          resumeKey: undefined,
          dependsOn: groupDependsOn, // All items in the current group depend on the previous group's steps
          condition: undefined,
          contextRefs: undefined,
          outputName: `queueItemOutput_${item.item_id}`,
          errorHandling: undefined,
          executionType: executionType,
          sourceItemId: item.item_id,
        });
      }

      groupIdToSteps.set(groupId, currentGroupStepIds);
      previousGroupStepIds = currentGroupStepIds;
    }

    const metadata: OrchestrationMetadata = {
      totalSteps: steps.length,
      hasParallelGroups: queue.execution_groups.some((id) => id.startsWith('P*')),
      estimatedComplexity: OrchestrationPlanBuilder.estimateComplexity(steps),
    };

    return {
      id: queue.id || `queue-${Date.now()}`,
      name: `Queue Plan: ${queue.id || 'Untitled'}`,
      source: 'queue',
      sourceId: queue.id,
      steps: steps,
      variables: {}, // Queue plans might not have global variables in the same way flows do
      defaultSessionStrategy: OrchestrationPlanBuilder.DEFAULT_SESSION_STRATEGY,
      defaultErrorHandling: OrchestrationPlanBuilder.DEFAULT_ERROR_HANDLING,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: metadata,
    };
  }

  /**
   * Creates a single-step OrchestrationPlan from manual user input.
   *
   * @param params Parameters for the manual orchestration.
   * @returns An OrchestrationPlan.
   */
  public static fromManual(params: ManualOrchestrationParams): OrchestrationPlan {
    const stepId = `manual-step-${Date.now()}`;
    const manualStep: OrchestrationStep = {
      id: stepId,
      name: 'Manual Execution',
      instruction: params.prompt,
      tool: params.tool,
      mode: params.mode,
      sessionStrategy: params.sessionStrategy || OrchestrationPlanBuilder.DEFAULT_SESSION_STRATEGY,
      targetSessionKey: params.targetSessionKey,
      resumeKey: undefined,
      dependsOn: [],
      condition: undefined,
      contextRefs: undefined,
      outputName: params.outputName,
      errorHandling: params.errorHandling,
      executionType: 'frontend-cli', // Manual commands are typically frontend CLI
      sourceNodeId: undefined,
      sourceItemId: undefined,
    };

    const metadata: OrchestrationMetadata = {
      totalSteps: 1,
      hasParallelGroups: false,
      estimatedComplexity: 'low',
    };

    return {
      id: `manual-plan-${Date.now()}`,
      name: 'Manual Orchestration',
      source: 'manual',
      sourceId: undefined,
      steps: [manualStep],
      variables: {},
      defaultSessionStrategy: OrchestrationPlanBuilder.DEFAULT_SESSION_STRATEGY,
      defaultErrorHandling: OrchestrationPlanBuilder.DEFAULT_ERROR_HANDLING,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: metadata,
    };
  }

  /**
   * Helper function to detect if the plan contains parallel groups.
   * @param steps The steps of the orchestration plan.
   * @returns True if parallel groups are detected, false otherwise.
   */
  private static detectParallelGroups(steps: OrchestrationStep[]): boolean {
    // A simple heuristic: check if any two steps have the same 'dependsOn' set
    // but are not explicitly dependent on each other, implying they can run in parallel.
    // This is a basic check and might need refinement.
    const dependencySets = new Map<string, Set<string>>();
    for (const step of steps) {
      const depKey = JSON.stringify(step.dependsOn.sort());
      if (!dependencySets.has(depKey)) {
        dependencySets.set(depKey, new Set());
      }
      dependencySets.get(depKey)!.add(step.id);
    }

    for (const [, stepIds] of dependencySets.entries()) {
      if (stepIds.size > 1) {
        // If multiple steps share the same dependencies, they might be parallel
        // Need to ensure they don't have implicit dependencies among themselves
        let isParallelGroup = true;
        for (const id1 of stepIds) {
          for (const id2 of stepIds) {
            if (id1 !== id2) {
              const step1 = steps.find(s => s.id === id1);
              const step2 = steps.find(s => s.id === id2);
              // If step1 depends on step2 or vice-versa, they are not parallel
              if (step1?.dependsOn.includes(id2) || step2?.dependsOn.includes(id1)) {
                isParallelGroup = false;
                break;
              }
            }
          }
          if (!isParallelGroup) break;
        }
        if (isParallelGroup) return true;
      }
    }
    return false;
  }

  /**
   * Helper function to estimate the complexity of the orchestration plan.
   * @param steps The steps of the orchestration plan.
   * @returns 'low', 'medium', or 'high'.
   */
  private static estimateComplexity(steps: OrchestrationStep[]): 'low' | 'medium' | 'high' {
    if (steps.length <= 1) {
      return 'low';
    }
    // Heuristic: More steps or presence of parallel groups increases complexity
    if (steps.length > 5 || OrchestrationPlanBuilder.detectParallelGroups(steps)) {
      return 'high';
    }
    return 'medium';
  }
}
