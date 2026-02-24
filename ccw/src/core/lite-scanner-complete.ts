import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
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

interface LiteTasks {
  litePlan: LiteSession[];
  liteFix: LiteSession[];
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
}

/**
 * Scan lite-plan and lite-fix directories for task sessions
 * @param workflowDir - Path to .workflow directory
 * @returns Lite tasks data
 */
export async function scanLiteTasks(workflowDir: string): Promise<LiteTasks> {
  const litePlanDir = join(workflowDir, '.lite-plan');
  const liteFixDir = join(workflowDir, '.lite-fix');

  return {
    litePlan: scanLiteDir(litePlanDir, 'lite-plan'),
    liteFix: scanLiteDir(liteFixDir, 'lite-fix')
  };
}

/**
 * Scan a lite task directory
 * @param dir - Directory path
 * @param type - Task type ('lite-plan' or 'lite-fix')
 * @returns Array of lite task sessions
 */
function scanLiteDir(dir: string, type: string): LiteSession[] {
  if (!existsSync(dir)) return [];

  try {
    const sessions = readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const sessionPath = join(dir, d.name);
        const session: LiteSession = {
          id: d.name,
          type,
          path: sessionPath,
          createdAt: getCreatedTime(sessionPath),
          plan: loadPlanJson(sessionPath),
          tasks: loadTaskJsons(sessionPath),
          progress: { total: 0, completed: 0, percentage: 0 }
        };

        // For lite-fix sessions, also load diagnoses separately
        if (type === 'lite-fix') {
          session.diagnoses = loadDiagnoses(sessionPath);
        }

        // Calculate progress
        session.progress = calculateProgress(session.tasks);

        return session;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return sessions;
  } catch (err) {
    console.error(`Error scanning ${dir}:`, (err as Error).message);
    return [];
  }
}

/**
 * Load plan.json or fix-plan.json from session directory
 * @param sessionPath - Session directory path
 * @returns Plan data or null
 */
function loadPlanJson(sessionPath: string): unknown | null {
  // Try fix-plan.json first (for lite-fix), then plan.json (for lite-plan)
  const fixPlanPath = join(sessionPath, 'fix-plan.json');
  const planPath = join(sessionPath, 'plan.json');

  // Try fix-plan.json first
  if (existsSync(fixPlanPath)) {
    try {
      const content = readFileSync(fixPlanPath, 'utf8');
      return JSON.parse(content);
    } catch {
      // Continue to try plan.json
    }
  }

  // Fallback to plan.json
  if (existsSync(planPath)) {
    try {
      const content = readFileSync(planPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  return null;
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
function loadTaskJsons(sessionPath: string): NormalizedTask[] {
  let tasks: NormalizedTask[] = [];

  // Method 1: Check .task/IMPL-*.json files
  const taskDir = join(sessionPath, '.task');
  if (existsSync(taskDir)) {
    try {
      const implTasks = readdirSync(taskDir)
        .filter(f => f.endsWith('.json') && (
          f.startsWith('IMPL-') ||
          f.startsWith('TASK-') ||
          f.startsWith('task-') ||
          f.startsWith('diagnosis-') ||
          /^T\d+\.json$/i.test(f)
        ))
        .map(f => {
          const taskPath = join(taskDir, f);
          try {
            const content = readFileSync(taskPath, 'utf8');
            return normalizeTask(JSON.parse(content));
          } catch {
            return null;
          }
        })
        .filter((t): t is NormalizedTask => t !== null);
      tasks = tasks.concat(implTasks);
    } catch {
      // Continue to other methods
    }
  }

  // Method 2: Check plan.json or fix-plan.json for embedded tasks array
  if (tasks.length === 0) {
    // Try fix-plan.json first (for lite-fix), then plan.json (for lite-plan)
    const fixPlanPath = join(sessionPath, 'fix-plan.json');
    const planPath = join(sessionPath, 'plan.json');

    const planFile = existsSync(fixPlanPath) ? fixPlanPath :
                     existsSync(planPath) ? planPath : null;

    if (planFile) {
      try {
        const plan = JSON.parse(readFileSync(planFile, 'utf8')) as { tasks?: unknown[] };
        if (Array.isArray(plan.tasks)) {
          tasks = plan.tasks.map(t => normalizeTask(t)).filter((t): t is NormalizedTask => t !== null);
        }
      } catch {
        // Continue to other methods
      }
    }
  }

  // Method 3: Check for task-*.json and diagnosis-*.json files in session root
  if (tasks.length === 0) {
    try {
      const rootTasks = readdirSync(sessionPath)
        .filter(f => f.endsWith('.json') && (
          f.startsWith('task-') ||
          f.startsWith('TASK-') ||
          f.startsWith('diagnosis-') ||
          /^T\d+\.json$/i.test(f)
        ))
        .map(f => {
          const taskPath = join(sessionPath, f);
          try {
            const content = readFileSync(taskPath, 'utf8');
            return normalizeTask(JSON.parse(content));
          } catch {
            return null;
          }
        })
        .filter((t): t is NormalizedTask => t !== null);
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
function getCreatedTime(dirPath: string): string {
  try {
    const stat = statSync(dirPath);
    return stat.birthtime.toISOString();
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
 * @param type - 'lite-plan' or 'lite-fix'
 * @param sessionId - Session ID
 * @returns Detailed task info
 */
export function getLiteTaskDetail(workflowDir: string, type: string, sessionId: string): LiteTaskDetail | null {
  const dir = type === 'lite-plan'
    ? join(workflowDir, '.lite-plan', sessionId)
    : join(workflowDir, '.lite-fix', sessionId);

  if (!existsSync(dir)) return null;

  const detail: LiteTaskDetail = {
    id: sessionId,
    type,
    path: dir,
    plan: loadPlanJson(dir),
    tasks: loadTaskJsons(dir),
    explorations: loadExplorations(dir),
    clarifications: loadClarifications(dir)
  };

  // For lite-fix sessions, also load diagnoses
  if (type === 'lite-fix') {
    detail.diagnoses = loadDiagnoses(dir);
  }

  return detail;
}

/**
 * Load exploration results
 * @param sessionPath - Session directory path
 * @returns Exploration results
 */
function loadExplorations(sessionPath: string): unknown[] {
  const explorePath = join(sessionPath, 'explorations.json');
  if (!existsSync(explorePath)) return [];

  try {
    const content = readFileSync(explorePath, 'utf8');
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
function loadClarifications(sessionPath: string): unknown | null {
  const clarifyPath = join(sessionPath, 'clarifications.json');
  if (!existsSync(clarifyPath)) return null;

  try {
    const content = readFileSync(clarifyPath, 'utf8');
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
function loadDiagnoses(sessionPath: string): Diagnoses {
  const result: Diagnoses = {
    manifest: null,
    items: []
  };

  // Try to load diagnoses-manifest.json first
  const manifestPath = join(sessionPath, 'diagnoses-manifest.json');
  if (existsSync(manifestPath)) {
    try {
      result.manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      // Continue without manifest
    }
  }

  // Load all diagnosis-*.json files from session root
  try {
    const diagnosisFiles = readdirSync(sessionPath)
      .filter(f => f.startsWith('diagnosis-') && f.endsWith('.json'));

    for (const file of diagnosisFiles) {
      const filePath = join(sessionPath, file);
      try {
        const content = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
        result.items.push({
          id: file.replace('diagnosis-', '').replace('.json', ''),
          filename: file,
          ...content
        });
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Return empty items if directory read fails
  }

  return result;
}
