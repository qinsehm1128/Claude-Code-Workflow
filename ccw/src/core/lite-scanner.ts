import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

interface TaskMeta {
  type: string;
  agent: string | null;
  scope: string | null;
  module: string | null;
}

interface TaskContext {
  requirements: string[];
  focus_paths: string[];
  acceptance: string[];
  depends_on: string[];
}

interface TaskFlowControl {
  implementation_approach: Array<Record<string, unknown>>;
  pre_analysis?: Array<Record<string, unknown>>;
  target_files?: Array<{ path: string; [key: string]: unknown }>;
}

interface NormalizedTask {
  id: string;
  title: string;
  status: string;
  meta: TaskMeta;
  context: TaskContext;
  flow_control: TaskFlowControl;
  // New flat format pass-through fields (consumed by frontend normalizer)
  description?: string;
  convergence?: { criteria?: string[]; verification?: string; definition_of_done?: string };
  focus_paths?: string[];
  pre_analysis?: Array<Record<string, unknown>>;
  implementation?: unknown[];
  files?: Array<{ path: string; [key: string]: unknown }>;
  _raw: unknown;
}

interface Progress {
  total: number;
  completed: number;
  percentage: number;
}

interface DiagnosisItem {
  id: string;
  filename: string;
  [key: string]: unknown;
}

interface Diagnoses {
  manifest: unknown | null;
  items: DiagnosisItem[];
}

interface LiteSession {
  id: string;
  type: string;
  path: string;
  createdAt: string;
  plan: unknown | null;
  tasks: NormalizedTask[];
  diagnoses?: Diagnoses;
  progress: Progress;
}

// Multi-CLI specific session state from session-state.json
interface MultiCliSessionState {
  session_id: string;
  task_description: string;
  status: string;
  current_phase: number;
  phases: Record<string, { status: string; rounds_completed?: number }>;
  ace_context?: { relevant_files: string[]; detected_patterns: string[] };
  user_decisions?: Array<{ round: number; decision: string; selected: string }>;
  updated_at?: string;
}

// Discussion topic structure for frontend rendering
interface DiscussionTopic {
  title: string;
  description: string;
  scope: { included: string[]; excluded: string[] };
  keyQuestions: string[];
  status: string;
  tags: string[];
}

// Extended session interface for multi-cli-plan
interface MultiCliSession extends LiteSession {
  roundCount: number;
  topicTitle: string;
  status: string;
  metadata: {
    roundId: number;
    timestamp: string;
    currentPhase: number;
  };
  discussionTopic: DiscussionTopic;
  rounds: RoundSynthesis[];
  latestSynthesis: RoundSynthesis | null;
}

interface LiteTasks {
  litePlan: LiteSession[];
  liteFix: LiteSession[];
  multiCliPlan: LiteSession[];
}

interface LiteTaskDetail {
  id: string;
  type: string;
  path: string;
  plan: unknown | null;
  tasks: NormalizedTask[];
  explorations: unknown[];
  clarifications: unknown | null;
  diagnoses?: Diagnoses;
  // Multi-cli-plan specific
  rounds?: RoundSynthesis[];
  latestSynthesis?: RoundSynthesis | null;
}

/**
 * Scan lite-plan and lite-fix directories for task sessions
 * @param workflowDir - Path to .workflow directory
 * @returns Lite tasks data
 */
export async function scanLiteTasks(workflowDir: string): Promise<LiteTasks> {
  const litePlanDir = join(workflowDir, '.lite-plan');
  const liteFixDir = join(workflowDir, '.lite-fix');
  const multiCliDir = join(workflowDir, '.multi-cli-plan');

  const [litePlan, liteFix, multiCliPlan] = await Promise.all([
    scanLiteDir(litePlanDir, 'lite-plan'),
    scanLiteDir(liteFixDir, 'lite-fix'),
    scanMultiCliDir(multiCliDir),
  ]);

  return { litePlan, liteFix, multiCliPlan };
}

/**
 * Scan a lite task directory
 * @param dir - Directory path
 * @param type - Task type ('lite-plan' or 'lite-fix')
 * @returns Array of lite task sessions
 */
async function scanLiteDir(dir: string, type: string): Promise<LiteSession[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    const sessions = (await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const sessionPath = join(dir, entry.name);

          const [createdAt, plan, tasks, diagnoses] = await Promise.all([
            getCreatedTime(sessionPath),
            loadPlanJson(sessionPath),
            loadTaskJsons(sessionPath),
            type === 'lite-fix' ? loadDiagnoses(sessionPath) : Promise.resolve(undefined),
          ]);

          const session: LiteSession = {
            id: entry.name,
            type,
            path: sessionPath,
            createdAt,
            plan,
            tasks,
            diagnoses,
            progress: { total: 0, completed: 0, percentage: 0 },
          };

          session.progress = calculateProgress(session.tasks);
          return session;
        }),
    ))
      .filter((session): session is LiteSession => session !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return sessions;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return [];
    console.error(`Error scanning ${dir}:`, err?.message || String(err));
    return [];
  }
}

/**
 * Load session-state.json from multi-cli session directory
 * @param sessionPath - Session directory path
 * @returns Session state or null if not found
 */
async function loadSessionState(sessionPath: string): Promise<MultiCliSessionState | null> {
  const statePath = join(sessionPath, 'session-state.json');
  try {
    const content = await readFile(statePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Build discussion topic structure from session state and synthesis
 * @param state - Session state from session-state.json
 * @param synthesis - Latest round synthesis
 * @returns Discussion topic for frontend rendering
 */
function buildDiscussionTopic(
  state: MultiCliSessionState | null,
  synthesis: RoundSynthesis | null
): DiscussionTopic {
  const keyQuestions = synthesis?.clarification_questions || [];
  const solutions = synthesis?.solutions || [];

  return {
    title: state?.task_description || 'Discussion Topic',
    description: solutions[0]?.summary || '',
    scope: {
      included: state?.ace_context?.relevant_files || [],
      excluded: [],
    },
    keyQuestions,
    status: state?.status || 'analyzing',
    tags: solutions.map((s) => s.name).slice(0, 3),
  };
}

/**
 * Scan multi-cli-plan directory for sessions
 * @param dir - Directory path to .multi-cli-plan
 * @returns Array of multi-cli sessions with extended metadata
 */
async function scanMultiCliDir(dir: string): Promise<MultiCliSession[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    const sessions = (await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const sessionPath = join(dir, entry.name);

          const [createdAt, syntheses, sessionState, planJson] = await Promise.all([
            getCreatedTime(sessionPath),
            loadRoundSyntheses(sessionPath),
            loadSessionState(sessionPath),
            loadPlanJson(sessionPath),
          ]);

          // Extract data from syntheses
          const roundCount = syntheses.length;
          const latestSynthesis = syntheses.length > 0 ? syntheses[syntheses.length - 1] : null;

          // Calculate progress based on round count and convergence
          const progress = calculateMultiCliProgress(syntheses);

          // Build discussion topic for frontend
          const discussionTopic = buildDiscussionTopic(sessionState, latestSynthesis);

          // Determine status from session state or synthesis convergence
          const status = sessionState?.status ||
            (latestSynthesis?.convergence?.recommendation === 'converged' ? 'converged' : 'analyzing');

          // Use plan.json if available, otherwise extract from synthesis
          const plan = planJson || latestSynthesis;
          // Use tasks from plan.json if available, otherwise extract from synthesis
          const tasks = (planJson as any)?.tasks?.length > 0
            ? normalizePlanJsonTasks((planJson as any).tasks)
            : extractTasksFromSyntheses(syntheses);

          const session: MultiCliSession = {
            id: entry.name,
            type: 'multi-cli-plan',
            path: sessionPath,
            createdAt,
            plan,
            tasks,
            progress,
            // Extended multi-cli specific fields
            roundCount,
            topicTitle: sessionState?.task_description || 'Discussion Topic',
            status,
            metadata: {
              roundId: roundCount,
              timestamp: sessionState?.updated_at || createdAt,
              currentPhase: sessionState?.current_phase || 1,
            },
            discussionTopic,
            rounds: syntheses,
            latestSynthesis,
          };

          return session;
        }),
    ))
      .filter((session): session is MultiCliSession => session !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return sessions;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return [];
    console.error(`Error scanning ${dir}:`, err?.message || String(err));
    return [];
  }
}

// NEW Schema types for multi-cli synthesis
interface SolutionFileAction {
  file: string;
  line: number;
  action: 'modify' | 'create' | 'delete';
}

interface SolutionTask {
  id: string;
  name: string;
  depends_on: string[];
  files: SolutionFileAction[];
  key_point: string | null;
}

interface SolutionImplementationPlan {
  approach: string;
  tasks: SolutionTask[];
  execution_flow: string;
  milestones: string[];
}

interface SolutionDependencies {
  internal: string[];
  external: string[];
}

interface Solution {
  name: string;
  source_cli: string[];
  feasibility: number;  // 0-1
  effort: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  summary: string;
  implementation_plan: SolutionImplementationPlan;
  dependencies: SolutionDependencies;
  technical_concerns: string[];
}

interface SynthesisConvergence {
  score: number;
  new_insights: boolean;
  recommendation: 'converged' | 'continue' | 'user_input_needed';
}

interface SynthesisCrossVerification {
  agreements: string[];
  disagreements: string[];
  resolution: string;
}

interface RoundSynthesis {
  round: number;
  // NEW schema fields
  solutions?: Solution[];
  convergence?: SynthesisConvergence;
  cross_verification?: SynthesisCrossVerification;
  clarification_questions?: string[];
  // OLD schema fields (backward compatibility)
  converged?: boolean;
  tasks?: unknown[];
  synthesis?: unknown;
  [key: string]: unknown;
}

/**
 * Load all synthesis.json files from rounds subdirectories
 * @param sessionPath - Session directory path
 * @returns Array of synthesis objects sorted by round number
 */
async function loadRoundSyntheses(sessionPath: string): Promise<RoundSynthesis[]> {
  const roundsDir = join(sessionPath, 'rounds');
  const syntheses: RoundSynthesis[] = [];

  try {
    const roundEntries = await readdir(roundsDir, { withFileTypes: true });

    const roundDirs = roundEntries
      .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
      .map((entry) => ({
        name: entry.name,
        num: parseInt(entry.name, 10),
      }))
      .sort((a, b) => a.num - b.num);

    for (const roundDir of roundDirs) {
      const synthesisPath = join(roundsDir, roundDir.name, 'synthesis.json');
      try {
        const content = await readFile(synthesisPath, 'utf8');
        const synthesis = JSON.parse(content) as RoundSynthesis;
        synthesis.round = roundDir.num;
        syntheses.push(synthesis);
      } catch (e) {
        console.warn('Failed to parse synthesis file:', synthesisPath, (e as Error).message);
      }
    }
  } catch (e) {
    // Ignore ENOENT errors (directory doesn't exist), warn on others
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Failed to read rounds directory:', roundsDir, (e as Error).message);
    }
  }

  return syntheses;
}

// Extended Progress interface for multi-cli sessions
interface MultiCliProgress extends Progress {
  convergenceScore?: number;
  recommendation?: 'converged' | 'continue' | 'user_input_needed';
  solutionsCount?: number;
  avgFeasibility?: number;
}

/**
 * Calculate progress for multi-cli-plan sessions
 * Uses new convergence.score and convergence.recommendation when available
 * Falls back to old converged boolean for backward compatibility
 * @param syntheses - Array of round syntheses
 * @returns Progress info with convergence metrics
 */
function calculateMultiCliProgress(syntheses: RoundSynthesis[]): MultiCliProgress {
  if (syntheses.length === 0) {
    return { total: 0, completed: 0, percentage: 0 };
  }

  const latestSynthesis = syntheses[syntheses.length - 1];

  // NEW schema: Use convergence object
  if (latestSynthesis.convergence) {
    const { score, recommendation } = latestSynthesis.convergence;
    const isConverged = recommendation === 'converged';

    // Calculate solutions metrics
    const solutions = latestSynthesis.solutions || [];
    const solutionsCount = solutions.length;
    const avgFeasibility = solutionsCount > 0
      ? solutions.reduce((sum, s) => sum + (s.feasibility || 0), 0) / solutionsCount
      : 0;

    // Total is based on rounds, percentage derived from convergence score
    const total = syntheses.length;
    const completed = isConverged ? total : Math.max(0, total - 1);
    const percentage = isConverged ? 100 : Math.round(score * 100);

    return {
      total,
      completed,
      percentage,
      convergenceScore: score,
      recommendation,
      solutionsCount,
      avgFeasibility: Math.round(avgFeasibility * 100) / 100
    };
  }

  // OLD schema: Fallback to converged boolean
  const isConverged = latestSynthesis.converged === true;
  const total = syntheses.length;
  const completed = isConverged ? total : Math.max(0, total - 1);
  const percentage = isConverged ? 100 : Math.round((completed / Math.max(total, 1)) * 100);

  return { total, completed, percentage };
}

/**
 * Extract tasks from synthesis objects
 * NEW schema: Extract from solutions[].implementation_plan.tasks
 * OLD schema: Extract from tasks[] array directly
 * @param syntheses - Array of round syntheses
 * @returns Normalized tasks from latest synthesis
 */
function extractTasksFromSyntheses(syntheses: RoundSynthesis[]): NormalizedTask[] {
  if (syntheses.length === 0) return [];

  const latestSynthesis = syntheses[syntheses.length - 1];

  // NEW schema: Extract tasks from solutions
  if (latestSynthesis.solutions && Array.isArray(latestSynthesis.solutions)) {
    const allTasks: NormalizedTask[] = [];

    for (const solution of latestSynthesis.solutions) {
      const implPlan = solution.implementation_plan;
      if (!implPlan?.tasks || !Array.isArray(implPlan.tasks)) continue;

      for (const task of implPlan.tasks) {
        const normalizedTask = normalizeSolutionTask(task, solution);
        if (normalizedTask) {
          allTasks.push(normalizedTask);
        }
      }
    }

    // Sort by task ID
    return allTasks.sort((a, b) => {
      const aNum = parseInt(a.id?.replace(/\D/g, '') || '0');
      const bNum = parseInt(b.id?.replace(/\D/g, '') || '0');
      return aNum - bNum;
    });
  }

  // OLD schema: Extract from tasks array directly
  const tasks = latestSynthesis.tasks;
  if (!Array.isArray(tasks)) return [];

  return tasks
    .map((task) => normalizeTask(task))
    .filter((task): task is NormalizedTask => task !== null);
}

/**
 * Normalize a solution task from NEW schema to NormalizedTask
 * @param task - SolutionTask from new schema
 * @param solution - Parent solution for context
 * @returns Normalized task
 */
function normalizeSolutionTask(task: SolutionTask, solution: Solution): NormalizedTask | null {
  if (!task || !task.id) return null;

  return {
    id: task.id,
    title: task.name || 'Untitled Task',
    status: (task as unknown as { status?: string }).status || 'pending',
    meta: {
      type: 'implementation',
      agent: null,
      scope: solution.name || null,
      module: null
    },
    context: {
      requirements: task.key_point ? [task.key_point] : [],
      focus_paths: task.files?.map(f => f.file) || [],
      acceptance: [],
      depends_on: task.depends_on || []
    },
    flow_control: {
      implementation_approach: task.files?.map((f, i) => ({
        step: `Step ${i + 1}`,
        action: `${f.action} ${f.file}${f.line ? ` at line ${f.line}` : ''}`
      })) || []
    },
    _raw: {
      task,
      solution: {
        name: solution.name,
        source_cli: solution.source_cli,
        feasibility: solution.feasibility,
        effort: solution.effort,
        risk: solution.risk
      }
    }
  };
}

/**
 * Normalize tasks from plan.json format to NormalizedTask[]
 * plan.json tasks have: id, name, description, depends_on, status, files, key_point, acceptance_criteria
 * @param tasks - Tasks array from plan.json
 * @returns Normalized tasks
 */
function normalizePlanJsonTasks(tasks: unknown[]): NormalizedTask[] {
  if (!Array.isArray(tasks)) return [];

  return tasks.map((task: any): NormalizedTask | null => {
    if (!task || !task.id) return null;

    return {
      id: task.id,
      title: task.name || task.title || 'Untitled Task',
      status: task.status || 'pending',
      meta: {
        type: 'implementation',
        agent: null,
        scope: task.scope || null,
        module: null
      },
      context: {
        requirements: task.description ? [task.description] : (task.key_point ? [task.key_point] : []),
        focus_paths: task.files?.map((f: any) => typeof f === 'string' ? f : f.file) || [],
        acceptance: task.acceptance_criteria || [],
        depends_on: task.depends_on || []
      },
      flow_control: {
        implementation_approach: task.files?.map((f: any, i: number) => {
          const filePath = typeof f === 'string' ? f : f.file;
          const action = typeof f === 'string' ? 'modify' : f.action;
          const line = typeof f === 'string' ? null : f.line;
          return {
            step: `Step ${i + 1}`,
            action: `${action} ${filePath}${line ? ` at line ${line}` : ''}`
          };
        }) || []
      },
      _raw: {
        task,
        estimated_complexity: task.estimated_complexity
      }
    };
  }).filter((task): task is NormalizedTask => task !== null);
}

/**
 * Load plan.json or fix-plan.json from session directory
 * @param sessionPath - Session directory path
 * @returns Plan data or null
 */
async function loadPlanJson(sessionPath: string): Promise<unknown | null> {
  // Try fix-plan.json first (for lite-fix), then plan.json (for lite-plan)
  const fixPlanPath = join(sessionPath, 'fix-plan.json');
  const planPath = join(sessionPath, 'plan.json');

  // Try fix-plan.json first
  try {
    const content = await readFile(fixPlanPath, 'utf8');
    return JSON.parse(content);
  } catch {
    // Continue to try plan.json
  }

  // Fallback to plan.json
  try {
    const content = await readFile(planPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Load all task JSON files from session directory
 * Supports multiple task formats:
 * 1. .task/IMPL-*.json files
 * 2. tasks array in plan.json
 * 3. task-*.json files in session root
 * @param sessionPath - Session directory path
 * @returns Array of task objects
 */
async function loadTaskJsons(sessionPath: string): Promise<NormalizedTask[]> {
  let tasks: NormalizedTask[] = [];

  // Method 1: Check .task/IMPL-*.json files
  const taskDir = join(sessionPath, '.task');
  try {
    const implFiles = (await readdir(taskDir))
      .filter((fileName) => fileName.endsWith('.json') && (
        fileName.startsWith('IMPL-') ||
        fileName.startsWith('TASK-') ||
        fileName.startsWith('task-') ||
        fileName.startsWith('diagnosis-') ||
        /^T\d+\.json$/i.test(fileName)
      ));

    const implTasks = (await Promise.all(
      implFiles.map(async (fileName) => {
        const taskPath = join(taskDir, fileName);
        try {
          const content = await readFile(taskPath, 'utf8');
          return normalizeTask(JSON.parse(content));
        } catch {
          return null;
        }
      }),
    ))
      .filter((task): task is NormalizedTask => task !== null);

    tasks = tasks.concat(implTasks);
  } catch {
    // Continue to other methods
  }

  // Method 2: Check plan.json or fix-plan.json for embedded tasks array
  if (tasks.length === 0) {
    const planFiles = [join(sessionPath, 'fix-plan.json'), join(sessionPath, 'plan.json')];

    for (const planFile of planFiles) {
      try {
        const plan = JSON.parse(await readFile(planFile, 'utf8')) as { tasks?: unknown[] };
        if (Array.isArray(plan.tasks)) {
          tasks = plan.tasks
            .map((task) => normalizeTask(task))
            .filter((task): task is NormalizedTask => task !== null);
          break;
        }
      } catch {
        // Continue to other plan files
      }
    }
  }

  // Method 3: Check for task-*.json and diagnosis-*.json files in session root
  if (tasks.length === 0) {
    try {
      const rootFiles = (await readdir(sessionPath))
        .filter((fileName) => fileName.endsWith('.json') && (
          fileName.startsWith('task-') ||
          fileName.startsWith('TASK-') ||
          fileName.startsWith('diagnosis-') ||
          /^T\d+\.json$/i.test(fileName)
        ));

      const rootTasks = (await Promise.all(
        rootFiles.map(async (fileName) => {
          const taskPath = join(sessionPath, fileName);
          try {
            const content = await readFile(taskPath, 'utf8');
            return normalizeTask(JSON.parse(content));
          } catch {
            return null;
          }
        }),
      ))
        .filter((task): task is NormalizedTask => task !== null);

      tasks = tasks.concat(rootTasks);
    } catch {
      // No tasks found
    }
  }

  // Sort tasks by ID
  return tasks.sort((a, b) => {
    const aNum = parseInt(a.id?.replace(/\D/g, '') || '0');
    const bNum = parseInt(b.id?.replace(/\D/g, '') || '0');
    return aNum - bNum;
  });
}

/**
 * Normalize task object to consistent structure
 * @param task - Raw task object
 * @returns Normalized task
 */
function normalizeTask(task: unknown): NormalizedTask | null {
  if (!task || typeof task !== 'object') return null;

  const taskObj = task as Record<string, unknown>;

  // Determine status - support various status formats
  let status = (taskObj.status as string | { state?: string; value?: string }) || 'pending';
  if (typeof status === 'object') {
    status = status.state || status.value || 'pending';
  }

  const meta = taskObj.meta as Record<string, unknown> | undefined;
  const context = taskObj.context as Record<string, unknown> | undefined;
  const flowControl = taskObj.flow_control as Record<string, unknown> | undefined;
  const implementation = taskObj.implementation as unknown[] | undefined;
  const preAnalysis = taskObj.pre_analysis as Array<Record<string, unknown>> | undefined;
  const convergence = taskObj.convergence as NormalizedTask['convergence'] | undefined;
  const modificationPoints = taskObj.modification_points as Array<{ file?: string }> | undefined;

  // Ensure id is always a string (handle numeric IDs from JSON)
  const rawId = taskObj.id ?? taskObj.task_id;
  const stringId = rawId != null ? String(rawId) : 'unknown';

  // Normalize files: support both string[] and {path, action, change}[] formats
  const rawFiles = taskObj.files as unknown[] | undefined;
  const normalizedFiles: Array<{ path: string; [key: string]: unknown }> | undefined =
    Array.isArray(rawFiles) && rawFiles.length > 0
      ? rawFiles.map(f => typeof f === 'string' ? { path: f } : f as { path: string })
      : undefined;

  // Extract focus_paths: top-level > context > files paths > modification_points
  const focusPaths: string[] =
    (taskObj.focus_paths as string[])
    || (context?.focus_paths as string[])
    || normalizedFiles?.map(f => f.path).filter(Boolean)
    || modificationPoints?.map(m => m.file).filter((f): f is string => !!f)
    || [];

  // Build implementation_approach: preserve rich objects, handle strings
  let implApproach: Array<Record<string, unknown>> = [];
  if (flowControl?.implementation_approach) {
    implApproach = flowControl.implementation_approach as Array<Record<string, unknown>>;
  } else if (implementation) {
    implApproach = implementation.map((step, i) => {
      if (typeof step === 'object' && step !== null) {
        return step as Record<string, unknown>;
      }
      return { step: i + 1, title: `Step ${i + 1}`, action: String(step) };
    });
  }

  // Build pre_analysis: top-level > flow_control
  const preAnalysisSteps = preAnalysis
    || (flowControl?.pre_analysis as Array<Record<string, unknown>>)
    || undefined;

  // Build acceptance criteria: convergence.criteria > context.acceptance
  const acceptance: string[] =
    convergence?.criteria
    || (context?.acceptance as string[])
    || (taskObj.acceptance as string[])
    || [];

  return {
    id: stringId,
    title: (taskObj.title as string) || (taskObj.name as string) || (taskObj.summary as string) || 'Untitled Task',
    status: (status as string).toLowerCase(),
    description: taskObj.description as string | undefined,
    // Preserve original fields for flexible rendering
    meta: meta ? {
      type: (meta.type as string) || (taskObj.type as string) || (taskObj.action as string) || 'task',
      agent: (meta.agent as string) || (taskObj.agent as string) || null,
      scope: (meta.scope as string) || (taskObj.scope as string) || null,
      module: (meta.module as string) || (taskObj.module as string) || null
    } : {
      type: (taskObj.type as string) || (taskObj.action as string) || 'task',
      agent: (taskObj.agent as string) || null,
      scope: (taskObj.scope as string) || null,
      module: (taskObj.module as string) || null
    },
    context: context ? {
      requirements: (context.requirements as string[]) || [],
      focus_paths: focusPaths,
      acceptance,
      depends_on: (context.depends_on as string[]) || []
    } : {
      requirements: (taskObj.requirements as string[])
        || (taskObj.details as string[])
        || (taskObj.description ? [taskObj.description as string] : taskObj.scope ? [taskObj.scope as string] : []),
      focus_paths: focusPaths,
      acceptance,
      depends_on: (taskObj.depends_on as string[]) || []
    },
    flow_control: {
      implementation_approach: implApproach,
      pre_analysis: preAnalysisSteps,
      target_files: normalizedFiles
        || (flowControl?.target_files as Array<{ path: string }>) || undefined,
    },
    // New flat format pass-through: let frontend normalizer consume these directly
    convergence,
    focus_paths: focusPaths,
    pre_analysis: preAnalysisSteps,
    implementation: implementation,
    files: normalizedFiles,
    // Keep all original fields for raw JSON view
    _raw: task
  };
}

/**
 * Get directory creation time
 * @param dirPath - Directory path
 * @returns ISO date string
 */
async function getCreatedTime(dirPath: string): Promise<string> {
  try {
    const stats = await stat(dirPath);
    return stats.birthtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Calculate progress from tasks
 * @param tasks - Array of task objects
 * @returns Progress info
 */
function calculateProgress(tasks: NormalizedTask[]): Progress {
  if (!tasks || tasks.length === 0) {
    return { total: 0, completed: 0, percentage: 0 };
  }

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const percentage = Math.round((completed / total) * 100);

  return { total, completed, percentage };
}

/**
 * Get detailed lite task info
 * @param workflowDir - Workflow directory
 * @param type - 'lite-plan', 'lite-fix', or 'multi-cli-plan'
 * @param sessionId - Session ID
 * @returns Detailed task info
 */
export async function getLiteTaskDetail(workflowDir: string, type: string, sessionId: string): Promise<LiteTaskDetail | null> {
  let dir: string;
  if (type === 'lite-plan') {
    dir = join(workflowDir, '.lite-plan', sessionId);
  } else if (type === 'multi-cli-plan') {
    dir = join(workflowDir, '.multi-cli-plan', sessionId);
  } else {
    dir = join(workflowDir, '.lite-fix', sessionId);
  }

  try {
    const stats = await stat(dir);
    if (!stats.isDirectory()) return null;
  } catch {
    return null;
  }

  // For multi-cli-plan, use synthesis-based loading
  if (type === 'multi-cli-plan') {
    const [syntheses, explorations, clarifications] = await Promise.all([
      loadRoundSyntheses(dir),
      loadExplorations(dir),
      loadClarifications(dir),
    ]);

    const latestSynthesis = syntheses.length > 0 ? syntheses[syntheses.length - 1] : null;

    const detail: LiteTaskDetail = {
      id: sessionId,
      type,
      path: dir,
      plan: latestSynthesis,
      tasks: extractTasksFromSyntheses(syntheses),
      explorations,
      clarifications,
      // Multi-cli-plan specific fields
      rounds: syntheses,
      latestSynthesis,
    };

    return detail;
  }

  const [plan, tasks, explorations, clarifications, diagnoses] = await Promise.all([
    loadPlanJson(dir),
    loadTaskJsons(dir),
    loadExplorations(dir),
    loadClarifications(dir),
    type === 'lite-fix' ? loadDiagnoses(dir) : Promise.resolve(undefined),
  ]);

  const detail: LiteTaskDetail = {
    id: sessionId,
    type,
    path: dir,
    plan,
    tasks,
    explorations,
    clarifications,
    diagnoses,
  };

  return detail;
}

/**
 * Load exploration results
 * @param sessionPath - Session directory path
 * @returns Exploration results
 */
async function loadExplorations(sessionPath: string): Promise<unknown[]> {
  const explorePath = join(sessionPath, 'explorations.json');

  try {
    const content = await readFile(explorePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Load clarification data
 * @param sessionPath - Session directory path
 * @returns Clarification data
 */
async function loadClarifications(sessionPath: string): Promise<unknown | null> {
  const clarifyPath = join(sessionPath, 'clarifications.json');

  try {
    const content = await readFile(clarifyPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Load diagnosis files for lite-fix sessions
 * Loads diagnosis-*.json files from session root directory
 * @param sessionPath - Session directory path
 * @returns Diagnoses data with manifest and items
 */
async function loadDiagnoses(sessionPath: string): Promise<Diagnoses> {
  const result: Diagnoses = {
    manifest: null,
    items: []
  };

  // Try to load diagnoses-manifest.json first
  const manifestPath = join(sessionPath, 'diagnoses-manifest.json');
  try {
    result.manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    // Continue without manifest
  }

  // Load all diagnosis-*.json files from session root
  try {
    const diagnosisFiles = (await readdir(sessionPath))
      .filter((fileName) => fileName.startsWith('diagnosis-') && fileName.endsWith('.json'));

    const items = (await Promise.all(
      diagnosisFiles.map(async (fileName) => {
        const filePath = join(sessionPath, fileName);
        try {
          const content = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
          return {
            id: fileName.replace('diagnosis-', '').replace('.json', ''),
            filename: fileName,
            ...content,
          } satisfies DiagnosisItem;
        } catch {
          return null;
        }
      }),
    ))
      .filter((item): item is DiagnosisItem => item !== null);

    result.items.push(...items);
  } catch {
    // Return empty items if directory read fails
  }

  return result;
}
