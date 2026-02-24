// ========================================
// Orchestrator Module
// ========================================
// Barrel exports for the orchestration system.
//
// OrchestrationPlanBuilder: Builds plans from Flow, Queue, or Manual input
// SequentialRunner: Manages PTY session lifecycle and step-by-step dispatch

export { OrchestrationPlanBuilder } from './OrchestrationPlanBuilder';
export {
  start,
  executeStep,
  onStepAdvanced,
  stop,
  stopAll,
  interpolateInstruction,
} from './SequentialRunner';
export type { StartOptions } from './SequentialRunner';
