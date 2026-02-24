import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { OrchestrationPlanBuilder } from '../OrchestrationPlanBuilder';
import { Flow, FlowNode, FlowEdge, PromptTemplateNodeData } from '../../types/flow';
import { IssueQueue, QueueItem } from '../../lib/api';
import {
  OrchestrationStep,
  ManualOrchestrationParams,
} from '../../types/orchestrator';

// Mock buildQueueItemContext as it's an external dependency
vi.mock('../../lib/queue-prompt', () => ({
  buildQueueItemContext: vi.fn((item: QueueItem, issue: any) => `Instruction for ${item.item_id} from issue ${issue?.id}`),
}));

import { buildQueueItemContext } from '../../lib/queue-prompt';

describe('OrchestrationPlanBuilder', () => {
  const MOCKED_CREATED_AT = '2026-02-14T10:00:00.000Z';
  const MOCKED_UPDATED_AT = '2026-02-14T11:00:00.000Z';

  beforeAll(() => {
    // Mock Date.now() to ensure consistent IDs and timestamps
    vi.spyOn(Date, 'now').mockReturnValue(new Date(MOCKED_CREATED_AT).getTime());
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(MOCKED_CREATED_AT);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('fromFlow', () => {
    it('should correctly convert a simple linear flow into an OrchestrationPlan', () => {
      const flow: Flow = {
        id: 'flow-123',
        name: 'Test Flow',
        description: 'A simple linear flow',
        version: '1.0.0',
        created_at: MOCKED_CREATED_AT,
        updated_at: MOCKED_UPDATED_AT,
        nodes: [
          { id: 'nodeA', type: 'prompt-template', data: { label: 'Step A', instruction: 'Do A', outputName: 'outputA' } as PromptTemplateNodeData, position: { x: 0, y: 0 } },
          { id: 'nodeB', type: 'prompt-template', data: { label: 'Step B', instruction: 'Do B', contextRefs: ['outputA'] } as PromptTemplateNodeData, position: { x: 1, y: 1 } },
          { id: 'nodeC', type: 'prompt-template', data: { label: 'Step C', instruction: 'Do C' } as PromptTemplateNodeData, position: { x: 2, y: 2 } },
        ] as FlowNode[],
        edges: [
          { id: 'edge-ab', source: 'nodeA', target: 'nodeB' },
          { id: 'edge-bc', source: 'nodeB', target: 'nodeC' },
        ] as FlowEdge[],
        variables: { var1: 'value1' },
        metadata: {},
      };

      const plan = OrchestrationPlanBuilder.fromFlow(flow);

      expect(plan).toBeDefined();
      expect(plan.id).toBe('flow-123');
      expect(plan.name).toBe('Test Flow');
      expect(plan.source).toBe('flow');
      expect(plan.sourceId).toBe('flow-123');
      expect(plan.variables).toEqual({ var1: 'value1' });
      expect(plan.steps).toHaveLength(3);
      expect(plan.metadata.totalSteps).toBe(3);
      expect(plan.metadata.estimatedComplexity).toBe('medium'); // 3 steps is medium

      // Verify topological sort and dependencies
      expect(plan.steps[0].id).toBe('nodeA');
      expect(plan.steps[0].dependsOn).toEqual([]);
      expect(plan.steps[1].id).toBe('nodeB');
      expect(plan.steps[1].dependsOn).toEqual(['nodeA']);
      expect(plan.steps[2].id).toBe('nodeC');
      expect(plan.steps[2].dependsOn).toEqual(['nodeB']);

      // Verify step details
      expect(plan.steps[0].name).toBe('Step A');
      expect(plan.steps[0].instruction).toBe('Do A');
      expect(plan.steps[0].outputName).toBe('outputA');
      expect(plan.steps[0].executionType).toBe('frontend-cli');

      expect(plan.steps[1].name).toBe('Step B');
      expect(plan.steps[1].instruction).toBe('Do B');
      expect(plan.steps[1].contextRefs).toEqual(['outputA']);
    });

    it('should handle a more complex flow with branching and merging', () => {
      const flow: Flow = {
        id: 'flow-complex',
        name: 'Complex Flow',
        description: 'Branching and merging flow',
        version: '1.0.0',
        created_at: MOCKED_CREATED_AT,
        updated_at: MOCKED_UPDATED_AT,
        nodes: [
          { id: 'start', type: 'prompt-template', data: { label: 'Start', instruction: 'Start here' } as PromptTemplateNodeData, position: { x: 0, y: 0 } },
          { id: 'branchA', type: 'prompt-template', data: { label: 'Branch A', instruction: 'Path A' } as PromptTemplateNodeData, position: { x: 1, y: 1 } },
          { id: 'branchB', type: 'prompt-template', data: { label: 'Branch B', instruction: 'Path B' } as PromptTemplateNodeData, position: { x: 1, y: 2 } },
          { id: 'merge', type: 'prompt-template', data: { label: 'Merge', instruction: 'Merge results' } as PromptTemplateNodeData, position: { x: 2, y: 1 } },
          { id: 'end', type: 'prompt-template', data: { label: 'End', instruction: 'Finish' } as PromptTemplateNodeData, position: { x: 3, y: 1 } },
        ] as FlowNode[],
        edges: [
          { id: 'e-start-a', source: 'start', target: 'branchA' },
          { id: 'e-start-b', source: 'start', target: 'branchB' },
          { id: 'e-a-merge', source: 'branchA', target: 'merge' },
          { id: 'e-b-merge', source: 'branchB', target: 'merge' },
          { id: 'e-merge-end', source: 'merge', target: 'end' },
        ] as FlowEdge[],
        variables: {},
        metadata: {},
      };

      const plan = OrchestrationPlanBuilder.fromFlow(flow);

      expect(plan).toBeDefined();
      expect(plan.steps).toHaveLength(5);
      expect(plan.metadata.totalSteps).toBe(5);
      expect(plan.metadata.hasParallelGroups).toBe(true); // branchA and branchB can run in parallel
      expect(plan.metadata.estimatedComplexity).toBe('high'); // >5 steps, or parallel groups

      // Verify topological sort (order might vary for parallel steps, but dependencies must be correct)
      const startStep = plan.steps.find(s => s.id === 'start');
      const branchAStep = plan.steps.find(s => s.id === 'branchA');
      const branchBStep = plan.steps.find(s => s.id === 'branchB');
      const mergeStep = plan.steps.find(s => s.id === 'merge');
      const endStep = plan.steps.find(s => s.id === 'end');

      expect(startStep?.dependsOn).toEqual([]);
      expect(branchAStep?.dependsOn).toEqual(['start']);
      expect(branchBStep?.dependsOn).toEqual(['start']);
      expect(mergeStep?.dependsOn).toEqual(expect.arrayContaining(['branchA', 'branchB']));
      expect(endStep?.dependsOn).toEqual(['merge']);

      // Ensure 'merge' step comes after 'branchA' and 'branchB'
      const indexA = plan.steps.indexOf(branchAStep!);
      const indexB = plan.steps.indexOf(branchBStep!);
      const indexMerge = plan.steps.indexOf(mergeStep!);
      expect(indexMerge).toBeGreaterThan(indexA);
      expect(indexMerge).toBeGreaterThan(indexB);
    });

    it('should detect cycles and throw an error', () => {
      const flow: Flow = {
        id: 'flow-cycle',
        name: 'Cyclic Flow',
        description: 'A flow with a cycle',
        version: '1.0.0',
        created_at: MOCKED_CREATED_AT,
        updated_at: MOCKED_UPDATED_AT,
        nodes: [
          { id: 'nodeA', type: 'prompt-template', data: { label: 'A', instruction: 'Do A' } as PromptTemplateNodeData, position: { x: 0, y: 0 } },
          { id: 'nodeB', type: 'prompt-template', data: { label: 'B', instruction: 'Do B' } as PromptTemplateNodeData, position: { x: 1, y: 1 } },
        ] as FlowNode[],
        edges: [
          { id: 'e-ab', source: 'nodeA', target: 'nodeB' },
          { id: 'e-ba', source: 'nodeB', target: 'nodeA' }, // Cycle
        ] as FlowEdge[],
        variables: {},
        metadata: {},
      };

      expect(() => OrchestrationPlanBuilder.fromFlow(flow)).toThrow('Cycle detected in flow graph. Cannot build orchestration plan from cyclic flow.');
    });

    it('should correctly map sessionStrategy and executionType from node data', () => {
      const flow: Flow = {
        id: 'flow-delivery',
        name: 'Delivery Flow',
        description: 'Flow with different delivery types',
        version: '1.0.0',
        created_at: MOCKED_CREATED_AT,
        updated_at: MOCKED_UPDATED_AT,
        nodes: [
          { id: 'node1', type: 'prompt-template', data: { label: 'New Session', instruction: 'New', delivery: 'newExecution' } as PromptTemplateNodeData, position: { x: 0, y: 0 } },
          { id: 'node2', type: 'prompt-template', data: { label: 'Specific Session', instruction: 'Specific', delivery: 'sendToSession', targetSessionKey: 'sessionX' } as PromptTemplateNodeData, position: { x: 1, y: 1 } },
          { id: 'node3', type: 'prompt-template', data: { label: 'Slash Cmd', instruction: 'Slash', slashCommand: 'test:cmd', mode: 'mainprocess' } as PromptTemplateNodeData, position: { x: 2, y: 2 } },
          { id: 'node4', type: 'prompt-template', data: { label: 'Frontend CLI', instruction: 'CLI', tool: 'gemini', mode: 'analysis' } as PromptTemplateNodeData, position: { x: 3, y: 3 } },
        ] as FlowNode[],
        edges: [
          { id: 'e1', source: 'node1', target: 'node2' },
          { id: 'e2', source: 'node2', target: 'node3' },
          { id: 'e3', source: 'node3', target: 'node4' },
        ],
        variables: {},
        metadata: {},
      };

      const plan = OrchestrationPlanBuilder.fromFlow(flow);
      expect(plan.steps).toHaveLength(4);

      expect(plan.steps[0].id).toBe('node1');
      expect(plan.steps[0].sessionStrategy).toBe('new_session');
      expect(plan.steps[0].executionType).toBe('frontend-cli'); // default as no slash command/tool specified

      expect(plan.steps[1].id).toBe('node2');
      expect(plan.steps[1].sessionStrategy).toBe('specific_session');
      expect(plan.steps[1].targetSessionKey).toBe('sessionX');
      expect(plan.steps[1].executionType).toBe('frontend-cli');

      expect(plan.steps[2].id).toBe('node3');
      expect(plan.steps[2].executionType).toBe('slash-command');

      expect(plan.steps[3].id).toBe('node4');
      expect(plan.steps[3].tool).toBe('gemini');
      expect(plan.steps[3].mode).toBe('analysis');
      expect(plan.steps[3].executionType).toBe('frontend-cli');
    });
  });

  describe('fromQueue', () => {
    it('should correctly convert an IssueQueue with S* groups into an OrchestrationPlan', () => {
      const issue1 = { id: 'issue-1', title: 'Fix bug A', description: 'desc A' };
      const issue2 = { id: 'issue-2', title: 'Implement feature B', description: 'desc B' };
      const issue3 = { id: 'issue-3', title: 'Refactor C', description: 'desc C' };

      const item1: QueueItem = { item_id: 'qi-1', issue_id: 'issue-1', solution_id: 'sol-1', execution_group: 'S*group1', depends_on: [], status: 'pending', execution_order: 0, semantic_priority: 0 };
      const item2: QueueItem = { item_id: 'qi-2', issue_id: 'issue-1', solution_id: 'sol-1', execution_group: 'S*group1', depends_on: [], status: 'pending', execution_order: 1, semantic_priority: 0 };
      const item3: QueueItem = { item_id: 'qi-3', issue_id: 'issue-2', solution_id: 'sol-2', execution_group: 'S*group2', depends_on: [], status: 'pending', execution_order: 2, semantic_priority: 0 };
      const item4: QueueItem = { item_id: 'qi-4', issue_id: 'issue-3', solution_id: 'sol-3', execution_group: 'S*group3', depends_on: [], status: 'pending', execution_order: 3, semantic_priority: 0 };

      const queue: IssueQueue = {
        id: 'queue-abc',
        execution_groups: ['S*group1', 'S*group2', 'S*group3'],
        grouped_items: {
          'S*group1': [item1, item2],
          'S*group2': [item3],
          'S*group3': [item4],
        },
        conflicts: [],
      };

      const issues = new Map<string, any>();
      issues.set('issue-1', issue1);
      issues.set('issue-2', issue2);
      issues.set('issue-3', issue3);

      const plan = OrchestrationPlanBuilder.fromQueue(queue, issues);

      expect(plan).toBeDefined();
      expect(plan.source).toBe('queue');
      expect(plan.sourceId).toBe('queue-abc');
      expect(plan.steps).toHaveLength(4);
      expect(plan.metadata.totalSteps).toBe(4);
      // fromQueue uses explicit P*/S* prefix check for hasParallelGroups (not DAG heuristic).
      // All groups here are S* (sequential), so hasParallelGroups is false.
      expect(plan.metadata.hasParallelGroups).toBe(false);
      // estimateComplexity uses detectParallelGroups (DAG heuristic), which sees qi-1 and qi-2
      // sharing dependsOn=[] without mutual dependencies. But estimateComplexity also checks
      // step count (<=1 => low, >5 => high), so 4 steps with no DAG-detected parallelism
      // (fromQueue passes the already-computed hasParallelGroups=false to metadata, not the
      // DAG heuristic) means medium. Actually estimateComplexity is a separate static call
      // that does its own DAG-level check.
      // With 4 steps and qi-1/qi-2 sharing empty dependsOn: detectParallelGroups returns true,
      // so estimateComplexity returns 'high'.
      expect(plan.metadata.estimatedComplexity).toBe('high');

      // Verify sequential dependencies
      // S*group1 items have no dependencies (first group)
      expect(plan.steps.find(s => s.id === 'queue-item-qi-1')?.dependsOn).toEqual([]);
      expect(plan.steps.find(s => s.id === 'queue-item-qi-2')?.dependsOn).toEqual([]);

      // S*group2 items depend on all items from S*group1
      expect(plan.steps.find(s => s.id === 'queue-item-qi-3')?.dependsOn).toEqual(expect.arrayContaining(['queue-item-qi-1', 'queue-item-qi-2']));

      // S*group3 items depend on all items from S*group2
      expect(plan.steps.find(s => s.id === 'queue-item-qi-4')?.dependsOn).toEqual(['queue-item-qi-3']);

      // Verify instruction context via mock
      const mockedBuild = vi.mocked(buildQueueItemContext);
      expect(plan.steps[0].instruction).toBe('Instruction for qi-1 from issue issue-1');
      expect(mockedBuild).toHaveBeenCalledWith(item1, issue1);
    });

    it('should correctly convert an IssueQueue with P* groups into an OrchestrationPlan', () => {
      const issue1 = { id: 'issue-1', title: 'Fix bug A', description: 'desc A' };
      const issue2 = { id: 'issue-2', title: 'Implement feature B', description: 'desc B' };

      const item1: QueueItem = { item_id: 'qi-1', issue_id: 'issue-1', solution_id: 'sol-1', execution_group: 'P*group1', depends_on: [], status: 'pending', execution_order: 0, semantic_priority: 0 };
      const item2: QueueItem = { item_id: 'qi-2', issue_id: 'issue-2', solution_id: 'sol-2', execution_group: 'P*group1', depends_on: [], status: 'pending', execution_order: 1, semantic_priority: 0 };
      const item3: QueueItem = { item_id: 'qi-3', issue_id: 'issue-1', solution_id: 'sol-1', execution_group: 'S*group2', depends_on: [], status: 'pending', execution_order: 2, semantic_priority: 0 };

      const queue: IssueQueue = {
        id: 'queue-parallel',
        execution_groups: ['P*group1', 'S*group2'],
        grouped_items: {
          'P*group1': [item1, item2],
          'S*group2': [item3],
        },
        conflicts: [],
      };

      const issues = new Map<string, any>();
      issues.set('issue-1', issue1);
      issues.set('issue-2', issue2);

      const plan = OrchestrationPlanBuilder.fromQueue(queue, issues);

      expect(plan).toBeDefined();
      expect(plan.steps).toHaveLength(3);
      expect(plan.metadata.hasParallelGroups).toBe(true);
      expect(plan.metadata.estimatedComplexity).toBe('high');

      // P*group1 items have no dependencies (first group)
      expect(plan.steps.find(s => s.id === 'queue-item-qi-1')?.dependsOn).toEqual([]);
      expect(plan.steps.find(s => s.id === 'queue-item-qi-2')?.dependsOn).toEqual([]);

      // S*group2 items depend on all items from P*group1
      expect(plan.steps.find(s => s.id === 'queue-item-qi-3')?.dependsOn).toEqual(expect.arrayContaining(['queue-item-qi-1', 'queue-item-qi-2']));
    });
  });

  describe('fromManual', () => {
    it('should create a single-step OrchestrationPlan from manual input', () => {
      const params: ManualOrchestrationParams = {
        prompt: 'Analyze current directory',
        tool: 'gemini',
        mode: 'analysis',
        sessionStrategy: 'new_session',
        outputName: 'analysisResult',
        errorHandling: { strategy: 'stop', maxRetries: 1, retryDelayMs: 100 },
      };

      const plan = OrchestrationPlanBuilder.fromManual(params);

      expect(plan).toBeDefined();
      expect(plan.id).toMatch(/^manual-plan-/);
      expect(plan.name).toBe('Manual Orchestration');
      expect(plan.source).toBe('manual');
      expect(plan.steps).toHaveLength(1);
      expect(plan.metadata.totalSteps).toBe(1);
      expect(plan.metadata.hasParallelGroups).toBe(false);
      expect(plan.metadata.estimatedComplexity).toBe('low');

      const step = plan.steps[0];
      expect(step.id).toMatch(/^manual-step-/);
      expect(step.name).toBe('Manual Execution');
      expect(step.instruction).toBe('Analyze current directory');
      expect(step.tool).toBe('gemini');
      expect(step.mode).toBe('analysis');
      expect(step.sessionStrategy).toBe('new_session');
      expect(step.targetSessionKey).toBeUndefined();
      expect(step.dependsOn).toEqual([]);
      expect(step.outputName).toBe('analysisResult');
      expect(step.errorHandling).toEqual({ strategy: 'stop', maxRetries: 1, retryDelayMs: 100 });
      expect(step.executionType).toBe('frontend-cli');
    });

    it('should use default session strategy and error handling if not provided', () => {
      const params: ManualOrchestrationParams = {
        prompt: 'Simple command',
      };

      const plan = OrchestrationPlanBuilder.fromManual(params);
      const step = plan.steps[0];

      expect(step.sessionStrategy).toBe('reuse_default');
      expect(step.errorHandling).toBeUndefined(); // Should be undefined if not explicitly set for step
      expect(plan.defaultSessionStrategy).toBe('reuse_default');
      expect(plan.defaultErrorHandling).toEqual({ strategy: 'pause_on_error', maxRetries: 0, retryDelayMs: 0 });
    });
  });

  describe('Utility methods', () => {
    it('should correctly detect parallel groups', () => {
      // Linear steps, no parallel
      const linearSteps: OrchestrationStep[] = [
        { id: '1', name: 's1', instruction: 'i', dependsOn: [], executionType: 'frontend-cli' },
        { id: '2', name: 's2', instruction: 'i', dependsOn: ['1'], executionType: 'frontend-cli' },
        { id: '3', name: 's3', instruction: 'i', dependsOn: ['2'], executionType: 'frontend-cli' },
      ];
      expect((OrchestrationPlanBuilder as any).detectParallelGroups(linearSteps)).toBe(false);

      // Parallel steps (2 and 3 depend on 1, but not on each other)
      const parallelSteps: OrchestrationStep[] = [
        { id: '1', name: 's1', instruction: 'i', dependsOn: [], executionType: 'frontend-cli' },
        { id: '2', name: 's2', instruction: 'i', dependsOn: ['1'], executionType: 'frontend-cli' },
        { id: '3', name: 's3', instruction: 'i', dependsOn: ['1'], executionType: 'frontend-cli' },
      ];
      expect((OrchestrationPlanBuilder as any).detectParallelGroups(parallelSteps)).toBe(true);

      // Complex parallel scenario
      const complexParallelSteps: OrchestrationStep[] = [
        { id: 'A', name: 'sA', instruction: 'i', dependsOn: [], executionType: 'frontend-cli' },
        { id: 'B', name: 'sB', instruction: 'i', dependsOn: ['A'], executionType: 'frontend-cli' },
        { id: 'C', name: 'sC', instruction: 'i', dependsOn: ['A'], executionType: 'frontend-cli' },
        { id: 'D', name: 'sD', instruction: 'i', dependsOn: ['B', 'C'], executionType: 'frontend-cli' },
      ];
      expect((OrchestrationPlanBuilder as any).detectParallelGroups(complexParallelSteps)).toBe(true);

      // Parallel steps with some implicit dependencies (not strictly parallel)
      const nonStrictlyParallel: OrchestrationStep[] = [
        { id: '1', name: 's1', instruction: 'i', dependsOn: [], executionType: 'frontend-cli' },
        { id: '2', name: 's2', instruction: 'i', dependsOn: ['1'], executionType: 'frontend-cli' },
        { id: '3', name: 's3', instruction: 'i', dependsOn: ['1'], executionType: 'frontend-cli' },
        { id: '4', name: 's4', instruction: 'i', dependsOn: ['2'], executionType: 'frontend-cli' },
      ];
      expect((OrchestrationPlanBuilder as any).detectParallelGroups(nonStrictlyParallel)).toBe(true);
    });

    it('should correctly estimate complexity', () => {
      const stepsLow: OrchestrationStep[] = [
        { id: '1', name: 's1', instruction: 'i', dependsOn: [], executionType: 'frontend-cli' },
      ];
      expect((OrchestrationPlanBuilder as any).estimateComplexity(stepsLow)).toBe('low');

      const stepsMedium: OrchestrationStep[] = [
        { id: '1', name: 's1', instruction: 'i', dependsOn: [], executionType: 'frontend-cli' },
        { id: '2', name: 's2', instruction: 'i', dependsOn: ['1'], executionType: 'frontend-cli' },
        { id: '3', name: 's3', instruction: 'i', dependsOn: ['2'], executionType: 'frontend-cli' },
        { id: '4', name: 's4', instruction: 'i', dependsOn: ['3'], executionType: 'frontend-cli' },
        { id: '5', name: 's5', instruction: 'i', dependsOn: ['4'], executionType: 'frontend-cli' },
      ];
      expect((OrchestrationPlanBuilder as any).estimateComplexity(stepsMedium)).toBe('medium');

      const stepsHighByCount: OrchestrationStep[] = [
        { id: '1', name: 's1', instruction: 'i', dependsOn: [], executionType: 'frontend-cli' },
        { id: '2', name: 's2', instruction: 'i', dependsOn: ['1'], executionType: 'frontend-cli' },
        { id: '3', name: 's3', instruction: 'i', dependsOn: ['2'], executionType: 'frontend-cli' },
        { id: '4', name: 's4', instruction: 'i', dependsOn: ['3'], executionType: 'frontend-cli' },
        { id: '5', name: 's5', instruction: 'i', dependsOn: ['4'], executionType: 'frontend-cli' },
        { id: '6', name: 's6', instruction: 'i', dependsOn: ['5'], executionType: 'frontend-cli' },
      ];
      expect((OrchestrationPlanBuilder as any).estimateComplexity(stepsHighByCount)).toBe('high');

      const stepsHighByParallel: OrchestrationStep[] = [
        { id: '1', name: 's1', instruction: 'i', dependsOn: [], executionType: 'frontend-cli' },
        { id: '2', name: 's2', instruction: 'i', dependsOn: ['1'], executionType: 'frontend-cli' },
        { id: '3', name: 's3', instruction: 'i', dependsOn: ['1'], executionType: 'frontend-cli' },
      ];
      expect((OrchestrationPlanBuilder as any).estimateComplexity(stepsHighByParallel)).toBe('high');
    });
  });
});
