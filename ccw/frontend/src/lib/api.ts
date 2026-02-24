// ========================================
// API Client
// ========================================
// Typed fetch functions for API communication with CSRF token handling

import type { SessionMetadata, TaskData, IndexStatus, IndexRebuildRequest, Rule, RuleCreateInput, RulesResponse, Prompt, PromptInsight, Pattern, Suggestion, McpTemplate, McpTemplateInstallRequest, AllProjectsResponse, OtherProjectsServersResponse, CrossCliCopyRequest, CrossCliCopyResponse } from '../types/store';
import type { TeamArtifactsResponse } from '../types/team';

// Re-export types for backward compatibility
export type { IndexStatus, IndexRebuildRequest, Rule, RuleCreateInput, RulesResponse, Prompt, PromptInsight, Pattern, Suggestion, McpTemplate, McpTemplateInstallRequest, AllProjectsResponse, OtherProjectsServersResponse, CrossCliCopyRequest, CrossCliCopyResponse };


/**
 * Raw backend session data structure matching the backend API response.
 *
 * @remarks
 * This interface represents the exact schema returned by the backend `/api/data` endpoint.
 * It is used internally during transformation to `SessionMetadata` in the frontend.
 *
 * **Field mappings to frontend SessionMetadata:**
 * - `project` → `title` and `description` (split on ':' separator)
 * - `status: 'active'` → `status: 'in_progress'` (other statuses remain unchanged)
 * - `location` is added based on which array (activeSessions/archivedSessions) the data comes from
 *
 * **Backend schema location:** `ccw/src/data-aggregator.ts`
 * **Transformation function:** {@link transformBackendSession}
 * **Frontend type:** {@link SessionMetadata}
 *
 * @warning If backend schema changes, update this interface AND the transformation logic in {@link transformBackendSession}
 */
interface BackendSessionData {
  session_id: string;
  project?: string;
  status: 'active' | 'completed' | 'archived' | 'planning' | 'paused';
  type?: string;
  created_at: string;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * Dashboard statistics mapped from backend statistics response.
 *
 * @remarks
 * This interface represents the frontend statistics type displayed on the dashboard.
 * The data is extracted from the backend `/api/data` response's `statistics` field.
 *
 * **Backend response structure:**
 * ```json
 * {
 *   "statistics": {
 *     "totalSessions": number,
 *     "activeSessions": number,
 *     "archivedSessions": number,
 *     "totalTasks": number,
 *     "completedTasks": number,
 *     "pendingTasks": number,
 *     "failedTasks": number,
 *     "todayActivity": number
 *   }
 * }
 * ```
 *
 * **Mapping function:** {@link fetchDashboardStats}
 * **Fallback:** Returns zero-initialized stats on error via {@link getEmptyDashboardStats}
 *
 * @see {@link fetchDashboardStats} for the transformation logic
 */
export interface DashboardStats {
  totalSessions: number;
  activeSessions: number;
  archivedSessions: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  failedTasks: number;
  todayActivity: number;
}

export interface SessionsResponse {
  activeSessions: SessionMetadata[];
  archivedSessions: SessionMetadata[];
}

export interface CreateSessionInput {
  session_id: string;
  title?: string;
  description?: string;
  type?: 'workflow' | 'review' | 'lite-plan' | 'lite-fix';
}

export interface UpdateSessionInput {
  title?: string;
  description?: string;
  status?: SessionMetadata['status'];
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

// ========== CSRF Token Handling ==========

/**
 * Get CSRF token from cookie
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ========== Base Fetch Wrapper ==========

/**
 * Base fetch wrapper with CSRF token and error handling
 */
async function fetchApi<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  // Add CSRF token for mutating requests
  if (options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  // Set content type for JSON requests
  if (options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (!response.ok) {
    const error: ApiError = {
      message: response.statusText || 'Request failed',
      status: response.status,
    };

    // Only try to parse JSON if the content type indicates JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        const body = await response.json();
        // Check both 'message' and 'error' fields for error message
        if (body.message) error.message = body.message;
        else if (body.error) error.message = body.error;
        if (body.code) error.code = body.code;
      } catch (parseError) {
        // Silently ignore JSON parse errors for non-JSON responses
      }
    }

    throw error;
  }

  // Handle no-content responses
  if (response.status === 204) {
    return undefined as T;
  }

  // Wrap response.json() with try-catch for better error messages
  try {
    return await response.json();
  } catch (parseError) {
    const message = parseError instanceof Error ? parseError.message : 'Unknown error';
    throw new Error(`Failed to parse JSON response: ${message}`);
  }
}

// ========== Transformation Helpers ==========

/**
 * Infer session type from session_id pattern (matches backend logic)
 * Used as fallback when backend.type field is missing
 *
 * @param sessionId - Session ID to analyze
 * @returns Inferred session type
 *
 * @see ccw/src/core/session-scanner.ts:inferTypeFromName for backend implementation
 */
function inferTypeFromName(sessionId: string): SessionMetadata['type'] {
  const name = sessionId.toLowerCase();

  if (name.includes('-review-') || name.includes('-code-review-')) {
    return 'review';
  }
  if (name.includes('-tdd-') || name.includes('-test-driven-')) {
    return 'tdd';
  }
  if (name.includes('-test-') || name.includes('-testing-')) {
    return 'test';
  }
  if (name.includes('-docs-') || name.includes('-doc-') || name.includes('-documentation-')) {
    return 'docs';
  }
  if (name.includes('-lite-plan-')) {
    return 'lite-plan';
  }
  if (name.includes('-lite-fix-') || name.includes('-fix-')) {
    return 'lite-fix';
  }

  // Default to workflow for standard sessions
  return 'workflow';
}

/**
 * Transform backend session data to frontend SessionMetadata interface
 * Maps backend schema (project, status: 'active') to frontend schema (title, description, status: 'in_progress', location)
 *
 * @param backendSession - Raw session data from backend
 * @param location - Whether this session is from active or archived list
 * @returns Transformed SessionMetadata object
 */
function transformBackendSession(
  backendSession: BackendSessionData,
  location: 'active' | 'archived'
): SessionMetadata {
  // Map backend 'active' status to frontend 'in_progress'
  // Other statuses remain the same
  const statusMap: Record<string, SessionMetadata['status']> = {
    'active': 'in_progress',
    'completed': 'completed',
    'archived': 'archived',
    'planning': 'planning',
    'paused': 'paused',
  };

  const transformedStatus = statusMap[backendSession.status] || backendSession.status as SessionMetadata['status'];

  // Extract title and description from project field
  // Backend sends 'project' as a string, frontend expects 'title' and optional 'description'
  let title = backendSession.project || backendSession.session_id;
  let description: string | undefined;

  if (backendSession.project && backendSession.project.includes(':')) {
    const parts = backendSession.project.split(':');
    title = parts[0].trim();
    description = parts.slice(1).join(':').trim();
  }

  // Preserve type field from backend, or infer from session_id pattern
  // Multi-level type detection: backend.type > hasReview (for review sessions) > infer from name
  let sessionType = (backendSession.type as SessionMetadata['type']) ||
    inferTypeFromName(backendSession.session_id);

  // Transform backend review data to frontend format
  // Backend has: hasReview, reviewSummary, reviewDimensions (separate fields)
  // Frontend expects: review object with dimensions, findings count, etc.
  const backendData = backendSession as unknown as {
    hasReview?: boolean;
    reviewSummary?: {
      phase?: string;
      severityDistribution?: Record<string, number>;
      criticalFiles?: string[];
      status?: string;
    };
    reviewDimensions?: Array<{
      name: string;
      findings?: Array<{ severity?: string }>;
      summary?: unknown;
      status?: string;
    }>;
  };

  let review: SessionMetadata['review'] | undefined;
  if (backendData.hasReview) {
    // If session has review data but type is not 'review', auto-fix the type
    if (sessionType !== 'review') {
      sessionType = 'review';
    }

    // Build review object from backend data
    const dimensions = backendData.reviewDimensions || [];
    const totalFindings = dimensions.reduce(
      (sum, dim) => sum + (dim.findings?.length || 0), 0
    );

    review = {
      dimensions: dimensions.map(dim => ({
        name: dim.name,
        findings: dim.findings || []
      })),
      dimensions_count: dimensions.length,
      findings: totalFindings,
      iterations: undefined,
      fixes: undefined
    };
  }

  return {
    session_id: backendSession.session_id,
    type: sessionType,
    title,
    description,
    status: transformedStatus,
    created_at: backendSession.created_at,
    updated_at: backendSession.updated_at,
    location,
    path: (backendSession as unknown as { path?: string }).path,
    // Preserve additional fields if they exist
    has_plan: (backendSession as unknown as { has_plan?: boolean }).has_plan,
    plan_updated_at: (backendSession as unknown as { plan_updated_at?: string }).plan_updated_at,
    has_review: backendData.hasReview,
    review,
    summaries: (backendSession as unknown as { summaries?: SessionMetadata['summaries'] }).summaries,
    tasks: ((backendSession as unknown as { tasks?: TaskData[] }).tasks || [])
      .map(t => normalizeTask(t as unknown as Record<string, unknown>)),
  };
}

// ========== Dashboard API ==========

/**
 * Fetch dashboard statistics for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchDashboardStats(projectPath?: string): Promise<DashboardStats> {
  try {
    const url = projectPath ? `/api/data?path=${encodeURIComponent(projectPath)}` : '/api/data';
    const data = await fetchApi<{ statistics?: DashboardStats }>(url);

    // Validate response structure
    if (!data) {
      console.warn('[API] No data received from /api/data for dashboard stats');
      return getEmptyDashboardStats();
    }

    // Extract statistics from response, with defaults
    return {
      totalSessions: data.statistics?.totalSessions ?? 0,
      activeSessions: data.statistics?.activeSessions ?? 0,
      archivedSessions: data.statistics?.archivedSessions ?? 0,
      totalTasks: data.statistics?.totalTasks ?? 0,
      completedTasks: data.statistics?.completedTasks ?? 0,
      pendingTasks: data.statistics?.pendingTasks ?? 0,
      failedTasks: data.statistics?.failedTasks ?? 0,
      todayActivity: data.statistics?.todayActivity ?? 0,
    };
  } catch (error) {
    console.error('[API] Failed to fetch dashboard stats:', error);
    return getEmptyDashboardStats();
  }
}

/**
 * Get empty dashboard stats with zero values
 */
function getEmptyDashboardStats(): DashboardStats {
  return {
    totalSessions: 0,
    activeSessions: 0,
    archivedSessions: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    failedTasks: 0,
    todayActivity: 0,
  };
}

// ========== Sessions API ==========

/**
 * Fetch all sessions (active and archived) for a specific workspace
 * Applies transformation layer to map backend data to frontend SessionMetadata interface
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchSessions(projectPath?: string): Promise<SessionsResponse> {
  try {
    const url = projectPath ? `/api/data?path=${encodeURIComponent(projectPath)}` : '/api/data';
    const data = await fetchApi<{
      activeSessions?: BackendSessionData[];
      archivedSessions?: BackendSessionData[];
    }>(url);

    // Validate response structure
    if (!data) {
      console.warn('[API] No data received from /api/data for sessions');
      return { activeSessions: [], archivedSessions: [] };
    }

    // Transform active sessions with location = 'active'
    const activeSessions = (data.activeSessions ?? []).map((session) => {
      try {
        return transformBackendSession(session, 'active');
      } catch (error) {
        console.error('[API] Failed to transform active session:', session, error);
        // Return a minimal valid session to prevent crashes
        return {
          session_id: session.session_id,
          title: session.project || session.session_id,
          status: 'in_progress' as const,
          created_at: session.created_at,
          location: 'active' as const,
        };
      }
    });

    // Transform archived sessions with location = 'archived'
    const archivedSessions = (data.archivedSessions ?? []).map((session) => {
      try {
        return transformBackendSession(session, 'archived');
      } catch (error) {
        console.error('[API] Failed to transform archived session:', session, error);
        // Return a minimal valid session to prevent crashes
        return {
          session_id: session.session_id,
          title: session.project || session.session_id,
          status: session.status === 'active' ? 'in_progress' : session.status as SessionMetadata['status'],
          created_at: session.created_at,
          location: 'archived' as const,
        };
      }
    });

    return { activeSessions, archivedSessions };
  } catch (error) {
    console.error('[API] Failed to fetch sessions:', error);
    // Return empty arrays on error to prevent crashes
    return { activeSessions: [], archivedSessions: [] };
  }
}

/**
 * Fetch a single session by ID
 */
export async function fetchSession(sessionId: string): Promise<SessionMetadata> {
  return fetchApi<SessionMetadata>(`/api/sessions/${encodeURIComponent(sessionId)}`);
}

/**
 * Create a new session
 */
export async function createSession(input: CreateSessionInput): Promise<SessionMetadata> {
  return fetchApi<SessionMetadata>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update a session
 */
export async function updateSession(
  sessionId: string,
  input: UpdateSessionInput
): Promise<SessionMetadata> {
  return fetchApi<SessionMetadata>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Archive a session
 */
export async function archiveSession(sessionId: string): Promise<SessionMetadata> {
  return fetchApi<SessionMetadata>(`/api/sessions/${encodeURIComponent(sessionId)}/archive`, {
    method: 'POST',
  });
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  return fetchApi<void>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
}

// ========== Tasks API ==========

/**
 * Fetch tasks for a session
 */
export async function fetchSessionTasks(sessionId: string): Promise<TaskData[]> {
  return fetchApi<TaskData[]>(`/api/sessions/${encodeURIComponent(sessionId)}/tasks`);
}

/**
 * Update a task status
 */
export async function updateTask(
  sessionId: string,
  taskId: string,
  updates: Partial<TaskData>
): Promise<TaskData> {
  return fetchApi<TaskData>(
    `/api/sessions/${encodeURIComponent(sessionId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
}

// ========== Path Management API ==========

/**
 * Fetch recent paths
 */
export async function fetchRecentPaths(): Promise<string[]> {
  const data = await fetchApi<{ paths?: string[] }>('/api/recent-paths');
  return data.paths ?? [];
}

/**
 * Remove a recent path
 */
export async function removeRecentPath(path: string): Promise<string[]> {
  const data = await fetchApi<{ paths: string[] }>('/api/remove-recent-path', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
  return data.paths;
}

/**
 * Switch workspace response
 */
export interface SwitchWorkspaceResponse {
  projectPath: string;
  recentPaths: string[];
  activeSessions: SessionMetadata[];
  archivedSessions: SessionMetadata[];
  statistics: DashboardStats;
}

/**
 * Remove recent path response
 */
export interface RemoveRecentPathResponse {
  paths: string[];
}

/**
 * Fetch data for path response
 */
export interface FetchDataForPathResponse {
  projectOverview?: ProjectOverview | null;
  sessions?: SessionsResponse;
  statistics?: DashboardStats;
}

/**
 * Switch to a different project path and load its data
 */
export async function loadDashboardData(path: string): Promise<{
  activeSessions: SessionMetadata[];
  archivedSessions: SessionMetadata[];
  statistics: DashboardStats;
  projectPath: string;
  recentPaths: string[];
}> {
  return fetchApi(`/api/data?path=${encodeURIComponent(path)}`);
}

/**
 * Switch workspace to a different project path
 */
export async function switchWorkspace(path: string): Promise<SwitchWorkspaceResponse> {
  return fetchApi<SwitchWorkspaceResponse>(`/api/switch-path?path=${encodeURIComponent(path)}`);
}

/**
 * Fetch data for a specific path
 */
export async function fetchDataForPath(path: string): Promise<FetchDataForPathResponse> {
  return fetchApi<FetchDataForPathResponse>(`/api/data?path=${encodeURIComponent(path)}`);
}

// ========== Loops API ==========

export interface Loop {
  id: string;
  name?: string;
  status: 'created' | 'running' | 'paused' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  prompt?: string;
  tool?: string;
  error?: string;
  context?: {
    workingDir?: string;
    mode?: string;
  };
}

export interface LoopsResponse {
  loops: Loop[];
  total: number;
}

/**
 * Fetch all loops for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchLoops(projectPath?: string): Promise<LoopsResponse> {
  const url = projectPath ? `/api/loops?path=${encodeURIComponent(projectPath)}` : '/api/loops';
  const data = await fetchApi<{ loops?: Loop[] }>(url);
  return {
    loops: data.loops ?? [],
    total: data.loops?.length ?? 0,
  };
}

/**
 * Fetch a single loop by ID for a specific workspace
 * @param loopId - The loop ID to fetch
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchLoop(loopId: string, projectPath?: string): Promise<Loop> {
  const url = projectPath
    ? `/api/loops/${encodeURIComponent(loopId)}?path=${encodeURIComponent(projectPath)}`
    : `/api/loops/${encodeURIComponent(loopId)}`;
  return fetchApi<Loop>(url);
}

/**
 * Create a new loop
 */
export async function createLoop(input: {
  prompt: string;
  tool?: string;
  mode?: string;
}): Promise<Loop> {
  return fetchApi<Loop>('/api/loops', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update a loop's status (pause, resume, stop)
 */
export async function updateLoopStatus(
  loopId: string,
  action: 'pause' | 'resume' | 'stop'
): Promise<Loop> {
  return fetchApi<Loop>(`/api/loops/${encodeURIComponent(loopId)}/${action}`, {
    method: 'POST',
  });
}

/**
 * Delete a loop
 */
export async function deleteLoop(loopId: string): Promise<void> {
  return fetchApi<void>(`/api/loops/${encodeURIComponent(loopId)}`, {
    method: 'DELETE',
  });
}

// ========== Issues API ==========

export interface IssueSolution {
  id: string;
  description: string;
  approach?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  estimatedEffort?: string;
}

/**
 * Attachment entity for file uploads
 */
export interface Attachment {
  id: string;
  filename: string;
  path: string;
  type: string;
  size: number;
  uploaded_at: string;
}

export interface Issue {
  id: string;
  title: string;
  context?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt?: string;
  solutions?: IssueSolution[];
  labels?: string[];
  assignee?: string;
  attachments?: Attachment[];
}

export interface QueueItem {
  item_id: string;
  issue_id: string;
  solution_id: string;
  task_id?: string;
  status: 'pending' | 'ready' | 'executing' | 'completed' | 'failed' | 'blocked';
  execution_order: number;
  execution_group: string;
  depends_on: string[];
  semantic_priority: number;
  files_touched?: string[];
  task_count?: number;
}

export interface IssueQueue {
  id?: string;
  tasks?: QueueItem[];
  solutions?: QueueItem[];
  conflicts: string[];
  execution_groups: string[];
  grouped_items: Record<string, QueueItem[]>;
}

export interface IssuesResponse {
  issues: Issue[];
}

/**
 * Fetch all issues
 */
export async function fetchIssues(projectPath?: string): Promise<IssuesResponse> {
  const url = projectPath
    ? `/api/issues?path=${encodeURIComponent(projectPath)}`
    : '/api/issues';
  const data = await fetchApi<{ issues?: Issue[] }>(url);
  return {
    issues: data.issues ?? [],
  };
}

/**
 * Fetch issue history
 */
export async function fetchIssueHistory(projectPath?: string): Promise<IssuesResponse> {
  const url = projectPath
    ? `/api/issues/history?path=${encodeURIComponent(projectPath)}`
    : '/api/issues/history';
  const data = await fetchApi<{ issues?: Issue[] }>(url);
  return {
    issues: data.issues ?? [],
  };
}

/**
 * Fetch issue queue
 */
export async function fetchIssueQueue(projectPath?: string): Promise<IssueQueue> {
  const url = projectPath
    ? `/api/queue?path=${encodeURIComponent(projectPath)}`
    : '/api/queue';
  return fetchApi<IssueQueue>(url);
}

/**
 * Create a new issue
 */
export async function createIssue(input: {
  title: string;
  context?: string;
  priority?: Issue['priority'];
}): Promise<Issue> {
  return fetchApi<Issue>('/api/issues', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update an issue
 */
export async function updateIssue(
  issueId: string,
  input: Partial<Issue>
): Promise<Issue> {
  return fetchApi<Issue>(`/api/issues/${encodeURIComponent(issueId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Delete an issue
 */
export async function deleteIssue(issueId: string): Promise<void> {
  return fetchApi<void>(`/api/issues/${encodeURIComponent(issueId)}`, {
    method: 'DELETE',
  });
}

// ========== Attachment API ==========

export interface UploadAttachmentsResponse {
  success: boolean;
  issueId: string;
  attachments: Attachment[];
  count: number;
}

export interface ListAttachmentsResponse {
  success: boolean;
  issueId: string;
  attachments: Attachment[];
  count: number;
}

/**
 * Upload attachments to an issue
 */
export async function uploadAttachments(
  issueId: string,
  files: File[]
): Promise<UploadAttachmentsResponse> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(`/api/issues/${encodeURIComponent(issueId)}/attachments`, {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Failed to upload attachments');
  }

  return response.json();
}

/**
 * List attachments for an issue
 */
export async function listAttachments(issueId: string): Promise<ListAttachmentsResponse> {
  return fetchApi<ListAttachmentsResponse>(`/api/issues/${encodeURIComponent(issueId)}/attachments`);
}

/**
 * Delete an attachment
 */
export async function deleteAttachment(issueId: string, attachmentId: string): Promise<void> {
  return fetchApi<void>(`/api/issues/${encodeURIComponent(issueId)}/attachments/${encodeURIComponent(attachmentId)}`, {
    method: 'DELETE',
  });
}

/**
 * Get attachment download URL
 */
export function getAttachmentUrl(issueId: string, filename: string): string {
  return `/api/issues/files/${encodeURIComponent(issueId)}/${encodeURIComponent(filename)}`;
}

/**
 * Pull issues from GitHub
 */
export interface GitHubPullOptions {
  state?: 'open' | 'closed' | 'all';
  limit?: number;
  labels?: string;
  downloadImages?: boolean;
}

export interface GitHubPullResponse {
  imported: number;
  updated: number;
  skipped: number;
  images_downloaded: number;
  total: number;
}

export async function pullIssuesFromGitHub(options: GitHubPullOptions = {}): Promise<GitHubPullResponse> {
  const params = new URLSearchParams();
  if (options.state) params.set('state', options.state);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.labels) params.set('labels', options.labels);
  if (options.downloadImages) params.set('downloadImages', 'true');

  const url = `/api/issues/pull${params.toString() ? '?' + params.toString() : ''}`;
  return fetchApi<GitHubPullResponse>(url, {
    method: 'POST',
  });
}

// ========== Queue History (Multi-Queue) ==========

export interface QueueHistoryEntry {
  id: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  issue_ids?: string[];
  total_tasks?: number;
  completed_tasks?: number;
  total_solutions?: number;
  completed_solutions?: number;
  [key: string]: unknown;
}

export interface QueueHistoryIndex {
  queues: QueueHistoryEntry[];
  active_queue_id: string | null;
  active_queue_ids: string[];
}

export async function fetchQueueHistory(projectPath: string): Promise<QueueHistoryIndex> {
  return fetchApi<QueueHistoryIndex>(`/api/queue/history?path=${encodeURIComponent(projectPath)}`);
}

/**
 * Fetch a specific queue by ID
 */
export async function fetchQueueById(queueId: string, projectPath: string): Promise<IssueQueue> {
  return fetchApi<IssueQueue>(`/api/queue/${encodeURIComponent(queueId)}?path=${encodeURIComponent(projectPath)}`);
}

/**
 * Activate a queue
 */
export async function activateQueue(queueId: string, projectPath: string): Promise<void> {
  return fetchApi<void>(`/api/queue/activate?path=${encodeURIComponent(projectPath)}`, {
    method: 'POST',
    body: JSON.stringify({ queueId }),
  });
}

/**
 * Deactivate the current queue
 */
export async function deactivateQueue(projectPath: string): Promise<void> {
  return fetchApi<void>(`/api/queue/deactivate?path=${encodeURIComponent(projectPath)}`, {
    method: 'POST',
  });
}

/**
 * Reorder items within a single execution group
 */
export async function reorderQueueGroup(
  projectPath: string,
  input: { groupId: string; newOrder: string[] }
): Promise<{ success: boolean; groupId: string; reordered: number }> {
  return fetchApi<{ success: boolean; groupId: string; reordered: number }>(
    `/api/queue/reorder?path=${encodeURIComponent(projectPath)}`,
    { method: 'POST', body: JSON.stringify(input) }
  );
}

/**
 * Move an item across execution groups (and optionally insert at index)
 */
export async function moveQueueItem(
  projectPath: string,
  input: { itemId: string; toGroupId: string; toIndex?: number }
): Promise<{ success: boolean; itemId: string; fromGroupId: string; toGroupId: string }> {
  return fetchApi<{ success: boolean; itemId: string; fromGroupId: string; toGroupId: string }>(
    `/api/queue/move?path=${encodeURIComponent(projectPath)}`,
    { method: 'POST', body: JSON.stringify(input) }
  );
}

/**
 * Delete a queue
 */
export async function deleteQueue(queueId: string, projectPath: string): Promise<void> {
  return fetchApi<void>(`/api/queue/${encodeURIComponent(queueId)}?path=${encodeURIComponent(projectPath)}`, {
    method: 'DELETE',
  });
}

/**
 * Merge queues
 */
export async function mergeQueues(sourceId: string, targetId: string, projectPath: string): Promise<void> {
  return fetchApi<void>(`/api/queue/merge?path=${encodeURIComponent(projectPath)}`, {
    method: 'POST',
    body: JSON.stringify({ sourceQueueId: sourceId, targetQueueId: targetId }),
  });
}

/**
 * Split queue - split items from source queue into a new queue
 */
export async function splitQueue(sourceQueueId: string, itemIds: string[], projectPath: string): Promise<void> {
  return fetchApi<void>(`/api/queue/split?path=${encodeURIComponent(projectPath)}`, {
    method: 'POST',
    body: JSON.stringify({ sourceQueueId, itemIds }),
  });
}

// ========== Discovery API ==========

export interface DiscoverySession {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  findings_count: number;
  created_at: string;
  completed_at?: string;
}

export interface Finding {
  id: string;
  sessionId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  code_snippet?: string;
  created_at: string;
  issue_id?: string; // Associated issue ID if exported
  exported?: boolean; // Whether this finding has been exported as an issue
}

export async function fetchDiscoveries(projectPath?: string): Promise<DiscoverySession[]> {
  const url = projectPath
    ? `/api/discoveries?path=${encodeURIComponent(projectPath)}`
    : '/api/discoveries';
  const data = await fetchApi<{ discoveries?: any[]; sessions?: DiscoverySession[] }>(url);

  // Backend returns 'discoveries' with different schema, transform to frontend format
  const rawDiscoveries = data.discoveries ?? data.sessions ?? [];

  // Map backend schema to frontend DiscoverySession interface
  return rawDiscoveries.map((d: any) => {
    // Map phase to status
    let status: 'running' | 'completed' | 'failed' = 'running';
    if (d.phase === 'complete' || d.phase === 'completed') {
      status = 'completed';
    } else if (d.phase === 'failed') {
      status = 'failed';
    }

    // Extract progress percentage from nested progress object
    const progress = d.progress?.perspective_analysis?.percent_complete ?? 0;

    return {
      id: d.discovery_id || d.id,
      name: d.target_pattern || d.discovery_id || d.name || 'Discovery',
      status,
      progress,
      findings_count: d.total_findings ?? d.findings_count ?? 0,
      created_at: d.created_at,
      completed_at: d.completed_at
    };
  });
}

export async function fetchDiscoveryDetail(
  sessionId: string,
  projectPath?: string
): Promise<DiscoverySession> {
  const url = projectPath
    ? `/api/discoveries/${encodeURIComponent(sessionId)}?path=${encodeURIComponent(projectPath)}`
    : `/api/discoveries/${encodeURIComponent(sessionId)}`;
  return fetchApi<DiscoverySession>(url);
}

export async function fetchDiscoveryFindings(
  sessionId: string,
  projectPath?: string
): Promise<Finding[]> {
  const url = projectPath
    ? `/api/discoveries/${encodeURIComponent(sessionId)}/findings?path=${encodeURIComponent(projectPath)}`
    : `/api/discoveries/${encodeURIComponent(sessionId)}/findings`;
  const data = await fetchApi<{ findings?: Finding[] }>(url);
  return data.findings ?? [];
}

/**
 * Export findings as issues
 * @param sessionId - Discovery session ID
 * @param findingIds - Array of finding IDs to export
 * @param exportAll - Export all findings if true
 * @param projectPath - Optional project path
 */
export async function exportDiscoveryFindingsAsIssues(
  sessionId: string,
  { findingIds, exportAll }: { findingIds?: string[]; exportAll?: boolean },
  projectPath?: string
): Promise<{ success: boolean; message?: string; exported?: number }> {
  const url = projectPath
    ? `/api/discoveries/${encodeURIComponent(sessionId)}/export?path=${encodeURIComponent(projectPath)}`
    : `/api/discoveries/${encodeURIComponent(sessionId)}/export`;
  return fetchApi<{ success: boolean; message?: string; exported?: number }>(url, {
    method: 'POST',
    body: JSON.stringify({ finding_ids: findingIds, export_all: exportAll }),
  });
}

// ========== Skills API ==========

export interface Skill {
  name: string;
  description: string;
  enabled: boolean;
  triggers: string[];
  category?: string;
  source?: 'builtin' | 'custom' | 'community';
  version?: string;
  author?: string;
  location?: 'project' | 'user';
  folderName?: string;
  path?: string;
  allowedTools?: string[];
  supportingFiles?: string[];
}

export interface SkillsResponse {
  skills: Skill[];
}

/**
 * Fetch all skills for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchSkills(projectPath?: string, cliType: 'claude' | 'codex' = 'claude'): Promise<SkillsResponse> {
  // Response type from backend when includeDisabled=true
  interface ExtendedSkillsResponse {
    skills?: Skill[];
    projectSkills?: Skill[];
    userSkills?: Skill[];
    disabledProjectSkills?: Skill[];
    disabledUserSkills?: Skill[];
  }

  // Helper to add location and enabled status to skills
  const addEnabledMetadata = (skills: Skill[], location: 'project' | 'user'): Skill[] =>
    skills.map(skill => ({ ...skill, location, enabled: true }));

  const addDisabledMetadata = (skills: Skill[], location: 'project' | 'user'): Skill[] =>
    skills.map(skill => ({ ...skill, location, enabled: false }));

  const buildSkillsList = (data: ExtendedSkillsResponse): Skill[] => {
    const projectSkillsEnabled = addEnabledMetadata(data.projectSkills ?? [], 'project');
    const userSkillsEnabled = addEnabledMetadata(data.userSkills ?? [], 'user');
    const projectSkillsDisabled = addDisabledMetadata(data.disabledProjectSkills ?? [], 'project');
    const userSkillsDisabled = addDisabledMetadata(data.disabledUserSkills ?? [], 'user');
    return [...projectSkillsEnabled, ...userSkillsEnabled, ...projectSkillsDisabled, ...userSkillsDisabled];
  };

  const cliTypeParam = cliType === 'codex' ? '&cliType=codex' : '';

  // Try with project path first, fall back to global on 403/404
  if (projectPath) {
    try {
      const url = `/api/skills?path=${encodeURIComponent(projectPath)}&includeDisabled=true${cliTypeParam}`;
      const data = await fetchApi<ExtendedSkillsResponse>(url);
      return { skills: buildSkillsList(data) };
    } catch (error: unknown) {
      const apiError = error as ApiError;
      if (apiError.status === 403 || apiError.status === 404) {
        // Fall back to global skills list
        console.warn('[fetchSkills] 403/404 for project path, falling back to global skills');
      } else {
        throw error;
      }
    }
  }
  // Fallback: fetch global skills
  const data = await fetchApi<ExtendedSkillsResponse>(`/api/skills?includeDisabled=true${cliTypeParam}`);
  return { skills: buildSkillsList(data) };
}

/**
 * Enable a skill
 */
export async function enableSkill(
  skillName: string,
  location: 'project' | 'user',
  projectPath?: string,
  cliType: 'claude' | 'codex' = 'claude'
): Promise<Skill> {
  return fetchApi<Skill>(`/api/skills/${encodeURIComponent(skillName)}/enable`, {
    method: 'POST',
    body: JSON.stringify({ location, projectPath, cliType }),
  });
}

/**
 * Disable a skill
 */
export async function disableSkill(
  skillName: string,
  location: 'project' | 'user',
  projectPath?: string,
  cliType: 'claude' | 'codex' = 'claude'
): Promise<Skill> {
  return fetchApi<Skill>(`/api/skills/${encodeURIComponent(skillName)}/disable`, {
    method: 'POST',
    body: JSON.stringify({ location, projectPath, cliType }),
  });
}

/**
 * Fetch detailed information about a specific skill
 * @param skillName - Name of the skill to fetch
 * @param location - Location of the skill (project or user)
 * @param projectPath - Optional project path
 */
export async function fetchSkillDetail(
  skillName: string,
  location: 'project' | 'user',
  projectPath?: string,
  cliType: 'claude' | 'codex' = 'claude'
): Promise<{ skill: Skill }> {
  const cliTypeParam = cliType === 'codex' ? '&cliType=codex' : '';
  const url = projectPath
    ? `/api/skills/${encodeURIComponent(skillName)}?location=${location}&path=${encodeURIComponent(projectPath)}${cliTypeParam}`
    : `/api/skills/${encodeURIComponent(skillName)}?location=${location}${cliTypeParam}`;
  return fetchApi<{ skill: Skill }>(url);
}

/**
 * Validate a skill folder for import
 */
export async function validateSkillImport(sourcePath: string): Promise<{
  valid: boolean;
  errors?: string[];
  skillInfo?: { name: string; description: string; version?: string; supportingFiles?: string[] };
}> {
  return fetchApi('/api/skills/validate-import', {
    method: 'POST',
    body: JSON.stringify({ sourcePath }),
  });
}

/**
 * Create/import a skill
 */
export async function createSkill(params: {
  mode: 'import' | 'cli-generate';
  location: 'project' | 'user';
  sourcePath?: string;
  skillName?: string;
  description?: string;
  generationType?: 'description' | 'template';
  projectPath?: string;
  cliType?: 'claude' | 'codex';
}): Promise<{ skillName: string; path: string }> {
  return fetchApi('/api/skills/create', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ========== Commands API ==========

export interface Command {
  name: string;
  description: string;
  usage?: string;
  examples?: string[];
  category?: string;
  aliases?: string[];
  source?: 'builtin' | 'custom';
  group?: string;
  enabled?: boolean;
  location?: 'project' | 'user';
  path?: string;
  relativePath?: string;
  argumentHint?: string;
  allowedTools?: string[];
}

export interface CommandsResponse {
  commands: Command[];
  groups?: string[];
  projectGroupsConfig?: Record<string, any>;
  userGroupsConfig?: Record<string, any>;
}

/**
 * Fetch all commands for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchCommands(projectPath?: string): Promise<CommandsResponse> {
  // Try with project path first, fall back to global on errors
  if (projectPath) {
    try {
      const url = `/api/commands?path=${encodeURIComponent(projectPath)}`;
      const data = await fetchApi<{
        commands?: Command[];
        projectCommands?: Command[];
        userCommands?: Command[];
        groups?: string[];
        projectGroupsConfig?: Record<string, any>;
        userGroupsConfig?: Record<string, any>;
      }>(url);
      const allCommands = [...(data.projectCommands ?? []), ...(data.userCommands ?? [])];
      return {
        commands: data.commands ?? allCommands,
        groups: data.groups,
        projectGroupsConfig: data.projectGroupsConfig,
        userGroupsConfig: data.userGroupsConfig,
      };
    } catch (error: unknown) {
      const apiError = error as ApiError;
      if (apiError.status === 403 || apiError.status === 404 || apiError.status === 400) {
        // Fall back to global commands list on path validation errors
        console.warn('[fetchCommands] Path validation failed, falling back to global commands');
      } else {
        throw error;
      }
    }
  }
  // Fallback: fetch global commands
  try {
    const data = await fetchApi<{
      commands?: Command[];
      projectCommands?: Command[];
      userCommands?: Command[];
      groups?: string[];
      projectGroupsConfig?: Record<string, any>;
      userGroupsConfig?: Record<string, any>;
    }>('/api/commands');
    const allCommands = [...(data.projectCommands ?? []), ...(data.userCommands ?? [])];
    return {
      commands: data.commands ?? allCommands,
      groups: data.groups,
      projectGroupsConfig: data.projectGroupsConfig,
      userGroupsConfig: data.userGroupsConfig,
    };
  } catch (error) {
    // Let errors propagate to React Query for proper error handling
    console.error('[fetchCommands] Failed to fetch commands:', error);
    throw error;
  }
}

/**
 * Toggle command enabled status
 */
export async function toggleCommand(
  commandName: string,
  enabled: boolean,
  location: 'project' | 'user',
  projectPath?: string
): Promise<{ success: boolean; message: string }> {
  return fetchApi<{ success: boolean; message: string }>(`/api/commands/${encodeURIComponent(commandName)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled, location, projectPath }),
  });
}

/**
 * Toggle all commands in a group
 */
export async function toggleCommandGroup(
  groupName: string,
  enable: boolean,
  location: 'project' | 'user',
  projectPath?: string
): Promise<{ success: boolean; results: any[]; message: string }> {
  return fetchApi<{ success: boolean; results: any[]; message: string }>(`/api/commands/group/${encodeURIComponent(groupName)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enable, location, projectPath }),
  });
}

/**
 * Get commands groups configuration
 */
export async function getCommandsGroupsConfig(
  location: 'project' | 'user',
  projectPath?: string
): Promise<{ groups: Record<string, any>; assignments: Record<string, string> }> {
  const params = new URLSearchParams({ location });
  if (projectPath) params.set('path', projectPath);
  return fetchApi<{ groups: Record<string, any>; assignments: Record<string, string> }>(`/api/commands/groups/config?${params}`);
}

// ========== Memory API ==========

export interface CoreMemory {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  source?: string;
  tags?: string[];
  size?: number;
  metadata?: string | Record<string, any>;
  archived?: boolean;
}

export interface MemoryResponse {
  memories: CoreMemory[];
  totalSize: number;
  claudeMdCount: number;
}

/**
 * Fetch all memories for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchMemories(projectPath?: string): Promise<MemoryResponse> {
  // Try with project path first, fall back to global on 403/404
  if (projectPath) {
    try {
      const url = `/api/core-memory/memories?path=${encodeURIComponent(projectPath)}`;
      const data = await fetchApi<{
        memories?: CoreMemory[];
        totalSize?: number;
        claudeMdCount?: number;
      }>(url);
      return {
        memories: data.memories ?? [],
        totalSize: data.totalSize ?? 0,
        claudeMdCount: data.claudeMdCount ?? 0,
      };
    } catch (error: unknown) {
      const apiError = error as ApiError;
      if (apiError.status === 403 || apiError.status === 404) {
        // Fall back to global memories list
        console.warn('[fetchMemories] 403/404 for project path, falling back to global memories');
      } else {
        throw error;
      }
    }
  }
  // Fallback: fetch global memories
  const data = await fetchApi<{
    memories?: CoreMemory[];
    totalSize?: number;
    claudeMdCount?: number;
  }>('/api/core-memory/memories');
  return {
    memories: data.memories ?? [],
    totalSize: data.totalSize ?? 0,
    claudeMdCount: data.claudeMdCount ?? 0,
  };
}

/**
 * Create a new memory entry for a specific workspace
 * @param input - Memory input data
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function createMemory(input: {
  content: string;
  tags?: string[];
  metadata?: Record<string, any>;
}, projectPath?: string): Promise<CoreMemory> {
  const url = '/api/core-memory/memories';
  return fetchApi<{ success: boolean; memory: CoreMemory }>(url, {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      path: projectPath,
    }),
  }).then(data => data.memory);
}

/**
 * Update a memory entry for a specific workspace
 * @param memoryId - Memory ID to update
 * @param input - Partial memory data
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function updateMemory(
  memoryId: string,
  input: Partial<CoreMemory>,
  projectPath?: string
): Promise<CoreMemory> {
  const url = '/api/core-memory/memories';
  return fetchApi<{ success: boolean; memory: CoreMemory }>(url, {
    method: 'POST',
    body: JSON.stringify({
      id: memoryId,
      ...input,
      path: projectPath,
    }),
  }).then(data => data.memory);
}

/**
 * Delete a memory entry for a specific workspace
 * @param memoryId - Memory ID to delete
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function deleteMemory(memoryId: string, projectPath?: string): Promise<void> {
  const url = projectPath
    ? `/api/core-memory/memories/${encodeURIComponent(memoryId)}?path=${encodeURIComponent(projectPath)}`
    : `/api/core-memory/memories/${encodeURIComponent(memoryId)}`;
  return fetchApi<void>(url, {
    method: 'DELETE',
  });
}

/**
 * Archive a memory entry for a specific workspace
 * @param memoryId - Memory ID to archive
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function archiveMemory(memoryId: string, projectPath?: string): Promise<void> {
  const url = projectPath
    ? `/api/core-memory/memories/${encodeURIComponent(memoryId)}/archive?path=${encodeURIComponent(projectPath)}`
    : `/api/core-memory/memories/${encodeURIComponent(memoryId)}/archive`;
  return fetchApi<void>(url, {
    method: 'POST',
  });
}

/**
 * Unarchive a memory entry for a specific workspace
 * @param memoryId - Memory ID to unarchive
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function unarchiveMemory(memoryId: string, projectPath?: string): Promise<void> {
  const url = projectPath
    ? `/api/core-memory/memories/${encodeURIComponent(memoryId)}/unarchive?path=${encodeURIComponent(projectPath)}`
    : `/api/core-memory/memories/${encodeURIComponent(memoryId)}/unarchive`;
  return fetchApi<void>(url, {
    method: 'POST',
  });
}

// ========== Project Overview API ==========

export interface TechnologyStack {
  languages: Array<{ name: string; file_count: number; primary?: boolean }>;
  frameworks: string[];
  build_tools: string[];
  test_frameworks?: string[];
}

export interface Architecture {
  style: string;
  layers: string[];
  patterns: string[];
}

export interface KeyComponent {
  name: string;
  description?: string;
  importance: 'high' | 'medium' | 'low';
  responsibility?: string[];
  path?: string;
}

export interface DevelopmentIndexEntry {
  title: string;
  description?: string;
  sessionId?: string;
  sub_feature?: string;
  status?: string;
  tags?: string[];
  archivedAt?: string;
  date?: string;
  implemented_at?: string;
}

export interface GuidelineEntry {
  rule: string;
  scope: string;
  enforced_by?: string;
}

export interface LearningEntry {
  insight: string;
  category?: string;
  session_id?: string;
  context?: string;
  date: string;
}

export interface ProjectGuidelines {
  conventions?: Record<string, string[]>;
  constraints?: Record<string, string[]>;
  quality_rules?: GuidelineEntry[];
  learnings?: LearningEntry[];
  _metadata?: {
    created_at?: string;
    updated_at?: string;
    version?: string;
  };
}

export interface ProjectOverviewMetadata {
  analysis_mode?: string;
  [key: string]: unknown;
}

export interface ProjectOverview {
  projectName: string;
  description?: string;
  initializedAt: string;
  technologyStack: TechnologyStack;
  architecture: Architecture;
  keyComponents: KeyComponent[];
  developmentIndex?: {
    feature?: DevelopmentIndexEntry[];
    enhancement?: DevelopmentIndexEntry[];
    bugfix?: DevelopmentIndexEntry[];
    refactor?: DevelopmentIndexEntry[];
    docs?: DevelopmentIndexEntry[];
    [key: string]: DevelopmentIndexEntry[] | undefined;
  };
  guidelines?: ProjectGuidelines;
  metadata?: ProjectOverviewMetadata;
}

/**
 * Fetch project overview for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchProjectOverview(projectPath?: string): Promise<ProjectOverview | null> {
  const url = projectPath ? `/api/ccw?path=${encodeURIComponent(projectPath)}` : '/api/ccw';
  const data = await fetchApi<{ projectOverview?: ProjectOverview }>(url);
  return data.projectOverview ?? null;
}

/**
 * Update project guidelines for a specific workspace
 */
export async function updateProjectGuidelines(
  guidelines: ProjectGuidelines,
  projectPath?: string
): Promise<{ success: boolean; guidelines?: ProjectGuidelines; error?: string }> {
  const url = projectPath
    ? `/api/ccw/guidelines?path=${encodeURIComponent(projectPath)}`
    : '/api/ccw/guidelines';
  return fetchApi(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(guidelines),
  });
}

// ========== Session Detail API ==========

export interface SessionDetailContext {
  requirements?: string[];
  focus_paths?: string[];
  artifacts?: string[];
  shared_context?: {
    tech_stack?: string[];
    conventions?: string[];
  };
  // Extended context fields for context-package.json
  context?: {
    metadata?: {
      task_description?: string;
      session_id?: string;
      complexity?: string;
      keywords?: string[];
    };
    project_context?: {
      tech_stack?: {
        languages?: Array<{ name: string; file_count?: number }>;
        frameworks?: string[];
        libraries?: string[];
      };
      architecture_patterns?: string[];
    };
    assets?: {
      documentation?: Array<{ path: string; relevance_score?: number; scope?: string; contains?: string[] }>;
      source_code?: Array<{ path: string; relevance_score?: number; scope?: string; contains?: string[] }>;
      tests?: Array<{ path: string; relevance_score?: number; scope?: string; contains?: string[] }>;
    };
    dependencies?: {
      internal?: Array<{ from: string; type: string; to: string }>;
      external?: Array<{ package: string; version?: string; usage?: string }>;
    };
    test_context?: {
      frameworks?: {
        backend?: { name?: string; plugins?: string[] };
        frontend?: { name?: string };
      };
      existing_tests?: string[];
      coverage_config?: Record<string, unknown>;
      test_markers?: string[];
    };
    conflict_detection?: {
      risk_level?: 'low' | 'medium' | 'high' | 'critical';
      mitigation_strategy?: string;
      risk_factors?: {
        test_gaps?: string[];
        existing_implementations?: string[];
      };
      affected_modules?: string[];
    };
  };
  explorations?: {
    manifest: {
      task_description: string;
      complexity?: string;
      exploration_count: number;
    };
    data: Record<string, {
      project_structure?: string[];
      relevant_files?: string[];
      patterns?: string[];
      dependencies?: string[];
      integration_points?: string[];
      testing?: string[];
    }>;
  };
}

export interface SessionDetailResponse {
  session: SessionMetadata;
  context?: SessionDetailContext;
  summary?: string;
  summaries?: Array<{ name: string; content: string }>;
  implPlan?: unknown;
  conflicts?: unknown[];
  review?: unknown;
}

/**
 * Fetch session detail for a specific workspace
 * First fetches session list to get the session path, then fetches detail data
 * @param sessionId - Session ID to fetch details for
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchSessionDetail(sessionId: string, projectPath?: string): Promise<SessionDetailResponse> {
  // Step 1: Fetch all sessions to get the session path
  const sessionsData = await fetchSessions(projectPath);
  const allSessions = [...sessionsData.activeSessions, ...sessionsData.archivedSessions];
  const session = allSessions.find(s => s.session_id === sessionId);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Step 2: Use the session path to fetch detail data from the correct endpoint
  // Backend expects the actual session directory path, not the project path
  const sessionPath = (session as any).path || session.session_id;
  const detailData = await fetchApi<any>(`/api/session-detail?path=${encodeURIComponent(sessionPath)}&type=all`);

  // Step 3: Transform the response to match SessionDetailResponse interface
  // Also check for summaries array and extract first one if summary is empty
  let finalSummary = detailData.summary;
  if (!finalSummary && detailData.summaries && detailData.summaries.length > 0) {
    finalSummary = detailData.summaries[0].content || detailData.summaries[0].name || '';
  }

  // Step 4: Transform context to match SessionDetailContext interface
  // Backend returns raw context-package.json content, frontend expects it nested under 'context' field
  const transformedContext = detailData.context ? { context: detailData.context } : undefined;

  // Step 5: Merge tasks from detailData into session object
  // Backend returns tasks at root level, frontend expects them on session object
  const sessionWithTasks = {
    ...session,
    tasks: detailData.tasks || session.tasks || [],
  };

  return {
    session: sessionWithTasks,
    context: transformedContext,
    summary: finalSummary,
    summaries: detailData.summaries,
    implPlan: detailData.implPlan,
    conflicts: detailData.conflictResolution,  // Backend returns 'conflictResolution', not 'conflicts'
    review: detailData.review,
  };
}

// ========== History / CLI Execution API ==========

export interface CliExecution {
  id: string;
  tool: 'gemini' | 'qwen' | 'codex' | string;
  mode?: string;
  status: 'success' | 'error' | 'timeout';
  prompt_preview: string;
  timestamp: string;
  duration_ms: number;
  sourceDir?: string;
  turn_count?: number;
  hasNativeSession?: boolean;
  nativeSessionId?: string;
  nativeSessionPath?: string;
}

export interface HistoryResponse {
  executions: CliExecution[];
}

/**
 * Fetch CLI execution history with native session info
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchHistory(projectPath?: string): Promise<HistoryResponse> {
  const url = projectPath
    ? `/api/cli/history-native?path=${encodeURIComponent(projectPath)}`
    : '/api/cli/history-native';
  const data = await fetchApi<{ executions?: CliExecution[] }>(url);
  return {
    executions: data.executions ?? [],
  };
}

/**
 * Delete a CLI execution record
 */
export async function deleteExecution(executionId: string): Promise<void> {
  await fetchApi<void>(`/api/cli/history/${encodeURIComponent(executionId)}`, {
    method: 'DELETE',
  });
}

/**
 * Delete CLI executions by tool
 */
export async function deleteExecutionsByTool(tool: string): Promise<void> {
  await fetchApi<void>(`/api/cli/history/tool/${encodeURIComponent(tool)}`, {
    method: 'DELETE',
  });
}

/**
 * Delete all CLI execution history
 */
export async function deleteAllHistory(): Promise<void> {
  await fetchApi<void>('/api/cli/history', {
    method: 'DELETE',
  });
}

// ========== Task Status Update API ==========

/**
 * Bulk update task status for multiple tasks
 * @param sessionPath - Path to session directory
 * @param taskIds - Array of task IDs to update
 * @param newStatus - New status to set
 */
export async function bulkUpdateTaskStatus(
  sessionPath: string,
  taskIds: string[],
  newStatus: TaskStatus
): Promise<{ success: boolean; updated: number; error?: string }> {
  return fetchApi('/api/bulk-update-task-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionPath, taskIds, newStatus }),
  });
}

/**
 * Update single task status
 * @param sessionPath - Path to session directory
 * @param taskId - Task ID to update
 * @param newStatus - New status to set
 */
export async function updateTaskStatus(
  sessionPath: string,
  taskId: string,
  newStatus: TaskStatus
): Promise<{ success: boolean; error?: string }> {
  return fetchApi('/api/update-task-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionPath, taskId, newStatus }),
  });
}

// Task status type (matches TaskData.status)
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';

/**
 * Fetch CLI execution detail (conversation records)
 */
export async function fetchExecutionDetail(
  executionId: string,
  sourceDir?: string
): Promise<ConversationRecord> {
  const params = new URLSearchParams({ id: executionId });
  if (sourceDir) params.set('path', sourceDir);

  const data = await fetchApi<ConversationRecord>(
    `/api/cli/execution?${params.toString()}`
  );
  return data;
}

// ========== CLI Execution Types ==========

/**
 * Conversation record for a CLI execution
 * Contains the full conversation history between user and CLI tool
 */
export interface ConversationRecord {
  id: string;
  tool: string;
  mode?: string;
  turns: ConversationTurn[];
  turn_count: number;
  created_at: string;
  updated_at?: string;
}

/**
 * Single turn in a CLI conversation
 */
export interface ConversationTurn {
  turn: number;
  prompt: string;
  output: {
    stdout: string;
    stderr?: string;
    truncated?: boolean;
    cached?: boolean;
    stdout_full?: string;
    stderr_full?: string;
    parsed_output?: string;
    final_output?: string;
    structured?: unknown[];
  };
  timestamp: string;
  duration_ms: number;
  status?: 'success' | 'error' | 'timeout';
  exit_code?: number;
}

// ========== Native Session Types ==========

export interface NativeTokenInfo {
  input?: number;
  output?: number;
  cached?: number;
  total?: number;
}

export interface NativeToolCall {
  name: string;
  arguments?: string;
  output?: string;
}

export interface NativeSessionTurn {
  turnNumber: number;
  timestamp: string;
  role: 'user' | 'assistant';
  content: string;
  thoughts?: string[];
  toolCalls?: NativeToolCall[];
  tokens?: NativeTokenInfo;
}

export interface NativeSession {
  sessionId: string;
  tool: string;
  model?: string;
  projectHash?: string;
  workingDir?: string;
  startTime: string;
  lastUpdated: string;
  turns: NativeSessionTurn[];
  totalTokens?: NativeTokenInfo;
}

/**
 * Fetch native CLI session content by execution ID
 */
export async function fetchNativeSession(
  executionId: string,
  projectPath?: string
): Promise<NativeSession> {
  const params = new URLSearchParams({ id: executionId });
  if (projectPath) params.set('path', projectPath);
  return fetchApi<NativeSession>(
    `/api/cli/native-session?${params.toString()}`
  );
}

// ========== CLI Tools Config API ==========

export interface CliToolsConfigResponse {
  version: string;
  tools: Record<string, {
    enabled: boolean;
    primaryModel: string;
    secondaryModel: string;
    tags: string[];
    type: string;
  }>;
}

/**
 * Fetch CLI tools configuration
 */
export async function fetchCliToolsConfig(): Promise<CliToolsConfigResponse> {
  return fetchApi<CliToolsConfigResponse>('/api/cli/tools-config');
}

/**
 * Update CLI tools configuration
 */
export async function updateCliToolsConfig(
  config: Partial<CliToolsConfigResponse>
): Promise<CliToolsConfigResponse> {
  return fetchApi<CliToolsConfigResponse>('/api/cli/tools-config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// ========== Lite Tasks API ==========

export interface ImplementationStep {
  step?: number | string;
  phase?: string;
  title?: string;
  action?: string;
  description?: string;
  modification_points?: string[] | Array<{ file: string; target: string; change: string }>;
  logic_flow?: string[];
  depends_on?: number[] | string[];
  output?: string;
  output_to?: string;
  commands?: string[];
  steps?: string[];
  test_patterns?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
  [key: string]: unknown;
}

export interface PreAnalysisStep {
  step?: string;
  action?: string;
  output_to?: string;
  commands?: string[];
}

export interface FlowControl {
  pre_analysis?: PreAnalysisStep[];
  implementation_approach?: (ImplementationStep | string)[];
  target_files?: Array<{ path: string; name?: string }>;
  [key: string]: unknown;
}

export interface LiteTask {
  id: string;
  task_id?: string;
  title?: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';
  priority?: string;
  flow_control?: FlowControl;
  meta?: {
    type?: string;
    scope?: string;
  };
  context?: {
    focus_paths?: string[];
    acceptance?: string[];
    depends_on?: string[];
  };
  created_at?: string;
  updated_at?: string;
}

// ========== Normalized Task (Unified Flat Format) ==========

/**
 * Normalized task type that unifies both old 6-field nested format
 * and new unified flat format into a single interface.
 *
 * Old format paths → New flat paths:
 * - context.acceptance[]        → convergence.criteria[]
 * - context.focus_paths[]       → focus_paths[]
 * - context.depends_on[]        → depends_on[]
 * - context.requirements[]      → description
 * - flow_control.pre_analysis[] → pre_analysis[]
 * - flow_control.implementation_approach[] → implementation[]
 * - flow_control.target_files[] → files[]
 */
export interface NormalizedTask extends TaskData {
  // Promoted from context
  focus_paths?: string[];
  convergence?: {
    criteria?: string[];
    verification?: string;
    definition_of_done?: string;
  };

  // Promoted from flow_control
  pre_analysis?: PreAnalysisStep[];
  implementation?: (ImplementationStep | string)[];
  files?: Array<{ path: string; name?: string }>;

  // Promoted from meta
  type?: string;
  scope?: string;
  action?: string;

  // Original nested objects (preserved for long-term compat)
  flow_control?: FlowControl;
  context?: {
    focus_paths?: string[];
    acceptance?: string[];
    depends_on?: string[];
    requirements?: string[];
  };
  meta?: {
    type?: string;
    scope?: string;
    [key: string]: unknown;
  };

  // Raw data reference for JSON viewer / debugging
  _raw?: unknown;
}

/**
 * Normalize files field: handles both old string[] format and new {path}[] format.
 */
function normalizeFilesField(files: unknown): Array<{ path: string; name?: string }> | undefined {
  if (!Array.isArray(files) || files.length === 0) return undefined;
  return files.map((f: unknown) => typeof f === 'string' ? { path: f } : f) as Array<{ path: string; name?: string }>;
}

/**
 * Normalize a raw task object (old 6-field or new unified flat) into NormalizedTask.
 * Reads new flat fields first, falls back to old nested paths.
 * Long-term compatible: handles both formats permanently.
 */
export function normalizeTask(raw: Record<string, unknown>): NormalizedTask {
  if (!raw || typeof raw !== 'object') {
    return { task_id: 'N/A', status: 'pending', _raw: raw } as NormalizedTask;
  }

  // Type-safe access helpers (use intersection for broad compat with old/new schemas)
  const rawContext = raw.context as (LiteTask['context'] & { requirements?: string[] }) | undefined;
  const rawFlowControl = raw.flow_control as FlowControl | undefined;
  const rawMeta = raw.meta as LiteTask['meta'] | undefined;
  const rawConvergence = raw.convergence as NormalizedTask['convergence'] | undefined;
  const rawModPoints = raw.modification_points as Array<{ file?: string; target?: string; change?: string }> | undefined;

  // Description: new flat field first, then join old context.requirements, then old details/scope
  const rawRequirements = rawContext?.requirements;
  const rawDetails = raw.details as string[] | undefined;
  const description = (raw.description as string | undefined)
    || (Array.isArray(rawRequirements) && rawRequirements.length > 0
      ? rawRequirements.join('; ')
      : undefined)
    || (Array.isArray(rawDetails) && rawDetails.length > 0
      ? rawDetails.join('; ')
      : undefined)
    || (raw.scope as string | undefined);

  // Normalize files: new flat files > flow_control.target_files > modification_points
  const normalizedFiles = normalizeFilesField(raw.files)
    || rawFlowControl?.target_files
    || (rawModPoints?.length
      ? rawModPoints.filter(m => m.file).map(m => ({ path: m.file!, name: m.target, change: m.change }))
      : undefined);

  // Normalize focus_paths: top-level > context > files paths
  const focusPaths = (raw.focus_paths as string[])
    || rawContext?.focus_paths
    || (normalizedFiles?.length ? normalizedFiles.map(f => f.path).filter(Boolean) : undefined)
    || [];

  // Normalize acceptance: convergence > context.acceptance > top-level acceptance
  const rawAcceptance = raw.acceptance as string[] | undefined;
  const convergence = rawConvergence
    || (rawContext?.acceptance?.length ? { criteria: rawContext.acceptance } : undefined)
    || (rawAcceptance?.length ? { criteria: rawAcceptance } : undefined);

  return {
    // Identity
    task_id: (raw.task_id as string) || (raw.id as string) || 'N/A',
    title: raw.title as string | undefined,
    description,
    status: (raw.status as NormalizedTask['status']) || 'pending',
    priority: raw.priority as NormalizedTask['priority'],
    created_at: raw.created_at as string | undefined,
    updated_at: raw.updated_at as string | undefined,
    has_summary: raw.has_summary as boolean | undefined,
    estimated_complexity: raw.estimated_complexity as string | undefined,

    // Promoted from context (new first, old fallback)
    depends_on: (raw.depends_on as string[]) || rawContext?.depends_on || [],
    focus_paths: focusPaths,
    convergence,

    // Promoted from flow_control (new first, old fallback)
    pre_analysis: (raw.pre_analysis as PreAnalysisStep[]) || rawFlowControl?.pre_analysis,
    implementation: (raw.implementation as (ImplementationStep | string)[]) || rawFlowControl?.implementation_approach,
    files: normalizedFiles,

    // Promoted from meta (new first, old fallback)
    type: (raw.type as string) || rawMeta?.type,
    scope: (raw.scope as string) || rawMeta?.scope,
    action: (raw.action as string) || (rawMeta as Record<string, unknown> | undefined)?.action as string | undefined,

    // Preserve original nested objects for backward compat
    flow_control: rawFlowControl,
    context: rawContext,
    meta: rawMeta,

    // Raw reference
    _raw: raw,
  };
}

/**
 * Build a FlowControl object from NormalizedTask for backward-compatible components (e.g. Flowchart).
 */
export function buildFlowControl(task: NormalizedTask): FlowControl | undefined {
  const preAnalysis = task.pre_analysis;
  const implementation = task.implementation;
  const files = task.files;

  if (!preAnalysis?.length && !implementation?.length && !files?.length) {
    return task.flow_control; // Fall back to original if no flat fields
  }

  return {
    pre_analysis: preAnalysis || task.flow_control?.pre_analysis,
    implementation_approach: implementation || task.flow_control?.implementation_approach,
    target_files: files || task.flow_control?.target_files,
  };
}

export interface LiteTaskSession {
  id: string;
  session_id?: string;
  type: 'lite-plan' | 'lite-fix' | 'multi-cli-plan';
  title?: string;
  description?: string;
  path?: string;
  tasks?: LiteTask[];
  metadata?: Record<string, unknown>;
  latestSynthesis?: {
    title?: string | { en?: string; zh?: string };
    status?: string;
  };
  diagnoses?: {
    manifest?: Record<string, unknown>;
    items?: Array<Record<string, unknown>>;
  };
  plan?: Record<string, unknown>;
  roundCount?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  // Multi-cli-plan specific fields
  rounds?: RoundSynthesis[];
}

// Multi-cli-plan synthesis types
export interface SolutionFileAction {
  file: string;
  line: number;
  action: 'modify' | 'create' | 'delete';
}

export interface SolutionTask {
  id: string;
  name: string;
  depends_on: string[];
  files: SolutionFileAction[];
  key_point: string | null;
}

export interface Solution {
  name: string;
  source_cli: string[];
  feasibility: number;
  effort: string;
  risk: string;
  summary: string;
  pros: string[];
  cons: string[];
  affected_files: SolutionFileAction[];
  implementation_plan: {
    approach: string;
    tasks: SolutionTask[];
    execution_flow: string;
    milestones: string[];
  };
  dependencies: {
    internal: string[];
    external: string[];
  };
  technical_concerns: string[];
}

export interface SynthesisConvergence {
  score: number;
  new_insights: boolean;
  recommendation: 'converged' | 'continue' | 'user_input_needed';
  rationale: string;
}

export interface SynthesisCrossVerification {
  agreements: string[];
  disagreements: Array<{
    topic: string;
    gemini: string;
    codex: string;
    resolution: string | null;
  }>;
  resolution: string;
}

export interface RoundSynthesis {
  round: number;
  timestamp: string;
  cli_executions: Record<string, { status: string; duration_ms: number; model: string }>;
  solutions: Solution[];
  convergence: SynthesisConvergence;
  cross_verification: SynthesisCrossVerification;
  clarification_questions: string[];
  user_feedback_incorporated?: string;
}

// Multi-cli-plan context-package.json structure
export interface MultiCliContextPackage {
  solution?: {
    name: string;
    source_cli: string[];
    feasibility: number;
    effort: string;
    risk: string;
    summary: string;
  };
  implementation_plan?: {
    approach: string;
    tasks: Array<{
      id: string;
      name: string;
      depends_on: string[];
      files: SolutionFileAction[];
      key_point: string | null;
    }>;
    execution_flow: string;
    milestones: string[];
  };
  dependencies?: {
    internal: string[];
    external: string[];
  };
  technical_concerns?: string[];
  consensus?: {
    agreements: string[];
    resolved_conflicts?: string;
  };
  constraints?: string[];
  task_description?: string;
  session_id?: string;
}

export interface LiteTasksResponse {
  litePlan?: LiteTaskSession[];
  liteFix?: LiteTaskSession[];
  multiCliPlan?: LiteTaskSession[];
}

/**
 * Fetch all lite tasks sessions for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchLiteTasks(projectPath?: string): Promise<LiteTasksResponse> {
  const url = projectPath ? `/api/data?path=${encodeURIComponent(projectPath)}` : '/api/data';
  const data = await fetchApi<{ liteTasks?: LiteTasksResponse }>(url);
  return data.liteTasks || {};
}

/**
 * Fetch a single lite task session by ID for a specific workspace
 * @param sessionId - Session ID to fetch
 * @param type - Type of lite task
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchLiteTaskSession(
  sessionId: string,
  type: 'lite-plan' | 'lite-fix' | 'multi-cli-plan',
  projectPath?: string
): Promise<LiteTaskSession | null> {
  const data = await fetchLiteTasks(projectPath);
  const sessions = type === 'lite-plan' ? (data.litePlan || []) :
    type === 'lite-fix' ? (data.liteFix || []) :
    (data.multiCliPlan || []);
  return sessions.find(s => s.id === sessionId || s.session_id === sessionId) || null;
}

/**
 * Fetch context data for a lite task session
 * Uses the session-detail API with type=context
 */

// Context package core type (compatible with lite and full context-package.json)
export interface LiteContextPackage {
  // Basic fields (lite task context)
  task_description?: string;
  constraints?: string[];
  focus_paths?: string[];
  relevant_files?: Array<string | { path: string; reason?: string }>;
  dependencies?: string[] | Array<{ name: string; type?: string; version?: string }>;
  conflict_risks?: string[] | Array<{ description: string; severity?: string }>;
  session_id?: string;
  metadata?: Record<string, unknown>;

  // Extended fields (full context-package.json)
  project_context?: {
    tech_stack?: {
      languages?: Array<{ name: string; file_count?: number }>;
      frameworks?: string[];
      libraries?: string[];
    };
    architecture_patterns?: string[];
  };
  assets?: {
    documentation?: Array<{ path: string; relevance_score?: number; scope?: string; contains?: string[] }>;
    source_code?: Array<{ path: string; relevance_score?: number; scope?: string; contains?: string[] }>;
    tests?: Array<{ path: string; relevance_score?: number; scope?: string; contains?: string[] }>;
  };
  test_context?: Record<string, unknown>;
  conflict_detection?: {
    risk_level?: 'low' | 'medium' | 'high' | 'critical';
    mitigation_strategy?: string;
    risk_factors?: { test_gaps?: string[]; existing_implementations?: string[] };
    affected_modules?: string[];
  };
}

export interface LiteExplorationAngle {
  project_structure?: string[];
  relevant_files?: string[];
  patterns?: string[];
  dependencies?: string[];
  integration_points?: string[];
  testing?: string[];
  findings?: string[];
  recommendations?: string[];
  risks?: string[];
}

export interface LiteDiagnosisItem {
  id?: string;
  title?: string;
  description?: string;
  symptom?: string;
  root_cause?: string;
  issues?: Array<{ file: string; line?: number; severity?: string; message: string }>;
  affected_files?: string[];
  fix_hints?: string[];
}

export interface LiteSessionContext {
  context?: LiteContextPackage;
  explorations?: {
    manifest?: {
      task_description?: string;
      complexity?: string;
      exploration_count?: number;
    };
    data?: Record<string, LiteExplorationAngle>;
  };
  diagnoses?: {
    manifest?: Record<string, unknown>;
    data?: Record<string, unknown>;          // Backend session-routes format
    items?: LiteDiagnosisItem[];             // lite-scanner format (compat)
  };
}

export async function fetchLiteSessionContext(
  sessionPath: string
): Promise<LiteSessionContext> {
  const data = await fetchApi<LiteSessionContext>(
    `/api/session-detail?path=${encodeURIComponent(sessionPath)}&type=context`
  );
  return data;
}

// ========== Review Session API ==========

export interface ReviewFinding {
  id?: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category?: string;
  file?: string;
  line?: string;
  code_context?: string;
  snippet?: string;
  recommendations?: string[];
  recommendation?: string;
  root_cause?: string;
  impact?: string;
  references?: string[];
  metadata?: Record<string, unknown>;
  fix_status?: string | null;
}

export interface ReviewDimension {
  name: string;
  findings: ReviewFinding[];
}

export interface ReviewSession {
  session_id: string;
  title?: string;
  description?: string;
  type: 'review';
  phase?: string;
  reviewDimensions?: ReviewDimension[];
  _isActive?: boolean;
  created_at?: string;
  updated_at?: string;
  status?: string;
}

export interface ReviewSessionsResponse {
  reviewSessions?: ReviewSession[];
  reviewData?: {
    sessions?: Array<{
      session_id: string;
      dimensions: Array<{ name: string; findings?: Array<ReviewFinding> }>;
      findings?: Array<ReviewFinding & { dimension: string }>;
      progress?: unknown;
    }>;
  };
}

/**
 * Fetch all review sessions
 */
export async function fetchReviewSessions(): Promise<ReviewSession[]> {
  const data = await fetchApi<ReviewSessionsResponse>('/api/data');

  // If reviewSessions field exists (legacy format), use it
  if (data.reviewSessions && data.reviewSessions.length > 0) {
    return data.reviewSessions;
  }

  // Otherwise, transform reviewData.sessions into ReviewSession format
  if (data.reviewData?.sessions) {
    return data.reviewData.sessions.map(session => ({
      session_id: session.session_id,
      title: session.session_id,
      description: '',
      type: 'review' as const,
      phase: 'in-progress',
      reviewDimensions: session.dimensions.map(dim => ({
        name: dim.name,
        findings: dim.findings || []
      })),
      _isActive: true,
      created_at: undefined,
      updated_at: undefined,
      status: 'active'
    }));
  }

  return [];
}

/**
 * Fetch a single review session by ID
 */
export async function fetchReviewSession(sessionId: string): Promise<ReviewSession | null> {
  const sessions = await fetchReviewSessions();
  return sessions.find(s => s.session_id === sessionId) || null;
}

// ========== MCP API ==========

export interface McpServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  scope: 'project' | 'global';
}

export interface McpServerConflict {
  name: string;
  projectServer: McpServer;
  globalServer: McpServer;
  /** Runtime effective scope */
  effectiveScope: 'global' | 'project';
}

export interface McpServersResponse {
  project: McpServer[];
  global: McpServer[];
  conflicts: McpServerConflict[];
}

/**
 * Fetch complete MCP configuration from all sources
 * Returns raw config including projects, globalServers, userServers, enterpriseServers
 */
export async function fetchMcpConfig(): Promise<{
  projects: Record<string, { mcpServers: Record<string, any>; disabledMcpServers?: string[] }>;
  globalServers: Record<string, any>;
  userServers: Record<string, any>;
  enterpriseServers: Record<string, any>;
  configSources: string[];
  codex?: { servers: Record<string, any>; configPath: string; exists?: boolean };
}> {
  return fetchApi('/api/mcp-config');
}

type UnknownRecord = Record<string, unknown>;

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePathForCompare(inputPath: string): string {
  const trimmed = inputPath.trim();
  if (!trimmed) return '';

  let normalized = trimmed.replace(/\\/g, '/');

  // Handle /d/path -> D:/path (matches backend normalization)
  if (/^\/[a-zA-Z]\//.test(normalized)) {
    normalized = normalized.charAt(1).toUpperCase() + ':' + normalized.slice(2);
  }

  // Normalize drive letter casing
  if (/^[a-zA-Z]:\//.test(normalized)) {
    normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  return normalized.replace(/\/+$/, '');
}

function findProjectConfigKey(projects: Record<string, unknown>, projectPath?: string): string | null {
  if (!projectPath) return null;

  const desired = normalizePathForCompare(projectPath);
  if (!desired) return null;

  for (const key of Object.keys(projects)) {
    if (normalizePathForCompare(key) === desired) {
      return key;
    }
  }

  // Fallback to exact key match if present
  return projectPath in projects ? projectPath : null;
}

function normalizeServerConfig(config: unknown): { command: string; args?: string[]; env?: Record<string, string> } {
  if (!isUnknownRecord(config)) {
    return { command: '' };
  }

  const command =
    typeof config.command === 'string'
      ? config.command
      : typeof config.url === 'string'
        ? config.url
        : '';

  const args = Array.isArray(config.args)
    ? config.args.filter((arg): arg is string => typeof arg === 'string')
    : undefined;

  const env = isUnknownRecord(config.env)
    ? Object.fromEntries(
        Object.entries(config.env).flatMap(([key, value]) =>
          typeof value === 'string' ? [[key, value]] : []
        )
      )
    : undefined;

  return {
    command,
    args: args && args.length > 0 ? args : undefined,
    env: env && Object.keys(env).length > 0 ? env : undefined,
  };
}

/**
 * Fetch all MCP servers (project and global scope) for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchMcpServers(projectPath?: string): Promise<McpServersResponse> {
  const config = await fetchMcpConfig();

  const projectsRecord = isUnknownRecord(config.projects) ? (config.projects as UnknownRecord) : {};
  const projectKey = findProjectConfigKey(projectsRecord, projectPath);
  const projectConfig = projectKey && isUnknownRecord(projectsRecord[projectKey])
    ? (projectsRecord[projectKey] as UnknownRecord)
    : null;

  const disabledServers = projectConfig && Array.isArray(projectConfig.disabledMcpServers)
    ? projectConfig.disabledMcpServers.filter((name): name is string => typeof name === 'string')
    : [];
  const disabledSet = new Set(disabledServers);

  const userServers = isUnknownRecord(config.userServers) ? (config.userServers as UnknownRecord) : {};

  const projectServersRecord = projectConfig && isUnknownRecord(projectConfig.mcpServers)
    ? (projectConfig.mcpServers as UnknownRecord)
    : {};

  const global: McpServer[] = Object.entries(userServers).map(([name, raw]) => {
    const normalized = normalizeServerConfig(raw);
    return {
      name,
      ...normalized,
      enabled: !disabledSet.has(name),
      scope: 'global',
    };
  });

  const project: McpServer[] = Object.entries(projectServersRecord)
    .map(([name, raw]) => {
      const normalized = normalizeServerConfig(raw);
      return {
        name,
        ...normalized,
        enabled: !disabledSet.has(name),
        scope: 'project' as const,
      };
    });

  // Detect conflicts: same name exists in both project and global
  const conflicts: McpServerConflict[] = [];
  for (const ps of project) {
    const gs = global.find(g => g.name === ps.name);
    if (gs) {
      conflicts.push({
        name: ps.name,
        projectServer: ps,
        globalServer: gs,
        effectiveScope: 'global',
      });
    }
  }

  return {
    project,
    global,
    conflicts,
  };
}

export type McpProjectConfigType = 'mcp' | 'claude';

export interface McpServerMutationOptions {
  /** Required for project-scoped mutations and for enabled/disabled toggles */
  projectPath?: string;
  /** Controls where project servers are stored (.mcp.json vs legacy .claude.json) */
  configType?: McpProjectConfigType;
}

function requireProjectPath(projectPath: string | undefined, ctx: string): string {
  const trimmed = projectPath?.trim();
  if (!trimmed) {
    throw new Error(`${ctx}: projectPath is required`);
  }
  return trimmed;
}

function toServerConfig(server: { command: string; args?: string[]; env?: Record<string, string> }): UnknownRecord {
  const config: UnknownRecord = { command: server.command };
  if (server.args && server.args.length > 0) config.args = server.args;
  if (server.env && Object.keys(server.env).length > 0) config.env = server.env;
  return config;
}

/**
 * Update MCP server configuration
 */
export async function updateMcpServer(
  serverName: string,
  config: Partial<McpServer>,
  options: McpServerMutationOptions = {}
): Promise<McpServer> {
  if (!config.scope) {
    throw new Error('updateMcpServer: scope is required');
  }
  if (typeof config.command !== 'string' || !config.command.trim()) {
    throw new Error('updateMcpServer: command is required');
  }

  const serverConfig = toServerConfig({
    command: config.command,
    args: config.args,
    env: config.env,
  });

  if (config.scope === 'global') {
    const result = await fetchApi<{ success?: boolean; error?: string }>('/api/mcp-add-global-server', {
      method: 'POST',
      body: JSON.stringify({ serverName, serverConfig }),
    });
    if (result?.error) {
      throw new Error(result.error);
    }
  } else {
    const projectPath = requireProjectPath(options.projectPath, 'updateMcpServer');
    const configType = options.configType ?? 'mcp';
    const result = await fetchApi<{ success?: boolean; error?: string }>('/api/mcp-copy-server', {
      method: 'POST',
      body: JSON.stringify({ projectPath, serverName, serverConfig, configType }),
    });
    if (result?.error) {
      throw new Error(result.error);
    }
  }

  if (typeof config.enabled === 'boolean') {
    const projectPath = options.projectPath?.trim();
    if (projectPath) {
      const toggleRes = await fetchApi<{ success?: boolean; error?: string }>('/api/mcp-toggle', {
        method: 'POST',
        body: JSON.stringify({ projectPath, serverName, enable: config.enabled }),
      });
      if (toggleRes?.error) {
        throw new Error(toggleRes.error);
      }
    }
  }

  if (options.projectPath) {
    const servers = await fetchMcpServers(options.projectPath);
    return [...servers.project, ...servers.global].find((s) => s.name === serverName) ?? {
      name: serverName,
      command: config.command,
      args: config.args,
      env: config.env,
      enabled: config.enabled ?? true,
      scope: config.scope,
    };
  }

  return {
    name: serverName,
    command: config.command,
    args: config.args,
    env: config.env,
    enabled: config.enabled ?? true,
    scope: config.scope,
  };
}

/**
 * Create a new MCP server
 */
export async function createMcpServer(
  server: McpServer,
  options: McpServerMutationOptions = {}
): Promise<McpServer> {
  if (!server.name?.trim()) {
    throw new Error('createMcpServer: name is required');
  }
  if (!server.command?.trim()) {
    throw new Error('createMcpServer: command is required');
  }

  const serverName = server.name.trim();
  const serverConfig = toServerConfig(server);

  if (server.scope === 'global') {
    const result = await fetchApi<{ success?: boolean; error?: string }>('/api/mcp-add-global-server', {
      method: 'POST',
      body: JSON.stringify({ serverName, serverConfig }),
    });
    if (result?.error) {
      throw new Error(result.error);
    }
  } else {
    const projectPath = requireProjectPath(options.projectPath, 'createMcpServer');
    const configType = options.configType ?? 'mcp';
    const result = await fetchApi<{ success?: boolean; error?: string }>('/api/mcp-copy-server', {
      method: 'POST',
      body: JSON.stringify({ projectPath, serverName, serverConfig, configType }),
    });
    if (result?.error) {
      throw new Error(result.error);
    }
  }

  // Enforced enabled/disabled is project-scoped (via disabledMcpServers list)
  if (server.enabled === false) {
    const projectPath = requireProjectPath(options.projectPath, 'createMcpServer');
    const toggleRes = await fetchApi<{ success?: boolean; error?: string }>('/api/mcp-toggle', {
      method: 'POST',
      body: JSON.stringify({ projectPath, serverName, enable: false }),
    });
    if (toggleRes?.error) {
      throw new Error(toggleRes.error);
    }
  }

  if (options.projectPath) {
    const servers = await fetchMcpServers(options.projectPath);
    return [...servers.project, ...servers.global].find((s) => s.name === serverName) ?? server;
  }

  return server;
}

/**
 * Delete an MCP server
 */
export async function deleteMcpServer(
  serverName: string,
  scope: 'project' | 'global',
  options: McpServerMutationOptions = {}
): Promise<void> {
  if (scope === 'global') {
    const result = await fetchApi<{ success?: boolean; error?: string }>('/api/mcp-remove-global-server', {
      method: 'POST',
      body: JSON.stringify({ serverName }),
    });
    if (result?.error) {
      throw new Error(result.error);
    }
    return;
  }

  const projectPath = requireProjectPath(options.projectPath, 'deleteMcpServer');
  const result = await fetchApi<{ success?: boolean; error?: string }>('/api/mcp-remove-server', {
    method: 'POST',
    body: JSON.stringify({ projectPath, serverName }),
  });
  if (result?.error) {
    throw new Error(result.error);
  }
}

/**
 * Toggle MCP server enabled status
 */
export async function toggleMcpServer(
  serverName: string,
  enabled: boolean,
  options: McpServerMutationOptions = {}
): Promise<McpServer> {
  const projectPath = requireProjectPath(options.projectPath, 'toggleMcpServer');

  const result = await fetchApi<{ success?: boolean; error?: string }>('/api/mcp-toggle', {
    method: 'POST',
    body: JSON.stringify({ projectPath, serverName, enable: enabled }),
  });
  if (result?.error) {
    throw new Error(result.error);
  }

  const servers = await fetchMcpServers(projectPath);
  return [...servers.project, ...servers.global].find((s) => s.name === serverName) ?? {
    name: serverName,
    command: '',
    enabled,
    scope: 'project',
  };
}

// ========== Codex MCP API ==========
/**
 * Codex MCP Server - Read-only server with config path
 * Extends McpServer with optional configPath field
 */
export interface CodexMcpServer extends McpServer {
  configPath?: string;
}

export interface CodexMcpServersResponse {
  servers: CodexMcpServer[];
  configPath: string;
}

/**
 * Fetch Codex MCP servers from config.toml
 * Codex MCP servers are read-only (managed via config file)
 */
export async function fetchCodexMcpServers(): Promise<CodexMcpServersResponse> {
  const data = await fetchApi<{ servers?: Record<string, unknown>; configPath: string; exists?: boolean }>('/api/codex-mcp-config');
  const serversRecord = isUnknownRecord(data.servers) ? (data.servers as UnknownRecord) : {};

  const servers: CodexMcpServer[] = Object.entries(serversRecord).map(([name, raw]) => {
    const normalized = normalizeServerConfig(raw);
    const enabled = isUnknownRecord(raw) ? (raw.enabled !== false) : true;

    return {
      name,
      ...normalized,
      enabled,
      // Codex config is global for the CLI; scope is only used for UI badges in Claude mode
      scope: 'global',
      configPath: data.configPath,
    };
  });

  return { servers, configPath: data.configPath };
}

/**
 * Add a new MCP server to Codex config
 * Note: This requires write access to Codex config.toml
 */
export async function addCodexMcpServer(
  serverName: string,
  serverConfig: Record<string, unknown>
): Promise<{ success?: boolean; error?: string }> {
  return fetchApi<{ success?: boolean; error?: string }>('/api/codex-mcp-add', {
    method: 'POST',
    body: JSON.stringify({ serverName, serverConfig }),
  });
}

/**
 * Remove MCP server from Codex config.toml
 */
export async function codexRemoveServer(serverName: string): Promise<{ success: boolean; error?: string }> {
  return fetchApi<{ success: boolean; error?: string }>('/api/codex-mcp-remove', {
    method: 'POST',
    body: JSON.stringify({ serverName }),
  });
}

/**
 * Toggle Codex MCP server enabled state
 */
export async function codexToggleServer(
  serverName: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  return fetchApi<{ success: boolean; error?: string }>('/api/codex-mcp-toggle', {
    method: 'POST',
    body: JSON.stringify({ serverName, enabled }),
  });
}

// ========== MCP Templates API ==========

/**
 * Fetch all MCP templates from database
 */
export async function fetchMcpTemplates(): Promise<McpTemplate[]> {
  const data = await fetchApi<{ success: boolean; templates: McpTemplate[] }>('/api/mcp-templates');
  return data.templates ?? [];
}

/**
 * Save or update MCP template
 */
export async function saveMcpTemplate(
  template: Omit<McpTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; id?: number; error?: string }> {
  return fetchApi<{ success: boolean; id?: number; error?: string }>('/api/mcp-templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
}

/**
 * Delete MCP template by name
 */
export async function deleteMcpTemplate(templateName: string): Promise<{ success: boolean; error?: string }> {
  return fetchApi<{ success: boolean; error?: string }>(
    `/api/mcp-templates/${encodeURIComponent(templateName)}`,
    { method: 'DELETE' }
  );
}

/**
 * Install MCP template to project or global scope
 */
export async function installMcpTemplate(
  request: McpTemplateInstallRequest
): Promise<{ success: boolean; serverName?: string; error?: string }> {
  return fetchApi<{ success: boolean; serverName?: string; error?: string }>('/api/mcp-templates/install', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Search MCP templates by keyword
 */
export async function searchMcpTemplates(keyword: string): Promise<McpTemplate[]> {
  const data = await fetchApi<{ success: boolean; templates: McpTemplate[] }>(
    `/api/mcp-templates/search?q=${encodeURIComponent(keyword)}`
  );
  return data.templates ?? [];
}

/**
 * Get all MCP template categories
 */
export async function fetchMcpTemplateCategories(): Promise<string[]> {
  const data = await fetchApi<{ success: boolean; categories: string[] }>('/api/mcp-templates/categories');
  return data.categories ?? [];
}

/**
 * Get MCP templates by category
 */
export async function fetchMcpTemplatesByCategory(category: string): Promise<McpTemplate[]> {
  const data = await fetchApi<{ success: boolean; templates: McpTemplate[] }>(
    `/api/mcp-templates/category/${encodeURIComponent(category)}`
  );
  return data.templates ?? [];
}

// ========== Projects API ==========

/**
 * Fetch all projects for cross-project operations
 */
export async function fetchAllProjects(): Promise<AllProjectsResponse> {
  const config = await fetchMcpConfig();
  const projects = Object.keys(config.projects ?? {}).sort((a, b) => a.localeCompare(b));
  return { projects };
}

/**
 * Fetch MCP servers from other projects
 */
export async function fetchOtherProjectsServers(
  projectPaths?: string[]
): Promise<OtherProjectsServersResponse> {
  const config = await fetchMcpConfig();
  const userServers = isUnknownRecord(config.userServers) ? (config.userServers as UnknownRecord) : {};
  const enterpriseServers = isUnknownRecord(config.enterpriseServers) ? (config.enterpriseServers as UnknownRecord) : {};

  const filterSet = projectPaths && projectPaths.length > 0
    ? new Set(projectPaths.map((p) => normalizePathForCompare(p)))
    : null;

  const servers: OtherProjectsServersResponse['servers'] = {};

  for (const [path, rawProjectConfig] of Object.entries(config.projects ?? {})) {
    const normalizedPath = normalizePathForCompare(path);
    if (filterSet && !filterSet.has(normalizedPath)) {
      continue;
    }

    const projectConfig = isUnknownRecord(rawProjectConfig) ? (rawProjectConfig as UnknownRecord) : {};
    const projectServersRecord = isUnknownRecord(projectConfig.mcpServers)
      ? (projectConfig.mcpServers as UnknownRecord)
      : {};

    const disabledServers = Array.isArray(projectConfig.disabledMcpServers)
      ? projectConfig.disabledMcpServers.filter((name): name is string => typeof name === 'string')
      : [];
    const disabledSet = new Set(disabledServers);

    servers[path] = Object.entries(projectServersRecord)
      // Exclude globally-defined servers; this section is meant for project-local discovery
      .filter(([name]) => !(name in userServers) && !(name in enterpriseServers))
      .map(([name, raw]) => {
        const normalized = normalizeServerConfig(raw);
        return {
          name,
          ...normalized,
          enabled: !disabledSet.has(name),
        };
      });
  }

  return { servers };
}

// ========== Cross-CLI Operations ==========

/**
 * Copy MCP servers between Claude and Codex CLIs
 */
export async function crossCliCopy(
  request: CrossCliCopyRequest
): Promise<CrossCliCopyResponse> {
  const serverNames = request.serverNames ?? [];
  if (serverNames.length === 0 || request.source === request.target) {
    return { success: true, copied: [], failed: [] };
  }

  const copied: string[] = [];
  const failed: Array<{ name: string; error: string }> = [];

  // Claude -> Codex (upserts into ~/.codex/config.toml via backend)
  if (request.source === 'claude' && request.target === 'codex') {
    const config = await fetchMcpConfig();
    const projectsRecord = isUnknownRecord(config.projects) ? (config.projects as UnknownRecord) : {};
    const projectKey = findProjectConfigKey(projectsRecord, request.projectPath ?? undefined);
    const projectConfig = projectKey && isUnknownRecord(projectsRecord[projectKey])
      ? (projectsRecord[projectKey] as UnknownRecord)
      : null;

    const projectServersRecord = projectConfig && isUnknownRecord(projectConfig.mcpServers)
      ? (projectConfig.mcpServers as UnknownRecord)
      : {};

    for (const name of serverNames) {
      try {
        const rawConfig =
          projectServersRecord[name] ??
          (config.userServers ? (config.userServers as UnknownRecord)[name] : undefined) ??
          (config.enterpriseServers ? (config.enterpriseServers as UnknownRecord)[name] : undefined);

        if (!isUnknownRecord(rawConfig)) {
          failed.push({ name, error: 'Source server config not found' });
          continue;
        }

        const result = await addCodexMcpServer(name, rawConfig);
        if (result?.error) {
          failed.push({ name, error: result.error });
          continue;
        }

        copied.push(name);
      } catch (err: unknown) {
        failed.push({ name, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return { success: copied.length > 0, copied, failed };
  }

  // Codex -> Claude (defaults to copying into current project via /api/mcp-copy-server)
  if (request.source === 'codex' && request.target === 'claude') {
    const projectPath = requireProjectPath(request.projectPath, 'crossCliCopy');

    const codex = await fetchApi<{ servers?: Record<string, unknown> }>('/api/codex-mcp-config');
    const codexServers = isUnknownRecord(codex.servers) ? (codex.servers as UnknownRecord) : {};

    for (const name of serverNames) {
      try {
        const rawConfig = codexServers[name];
        if (!isUnknownRecord(rawConfig)) {
          failed.push({ name, error: 'Source server config not found' });
          continue;
        }

        const result = await fetchApi<{ success?: boolean; error?: string }>('/api/mcp-copy-server', {
          method: 'POST',
          body: JSON.stringify({ projectPath, serverName: name, serverConfig: rawConfig, configType: 'mcp' }),
        });

        if (result?.error) {
          failed.push({ name, error: result.error });
          continue;
        }

        copied.push(name);
      } catch (err: unknown) {
        failed.push({ name, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return { success: copied.length > 0, copied, failed };
  }

  return {
    success: false,
    copied: [],
    failed: serverNames.map((name) => ({ name, error: 'Unsupported copy direction' })),
  };
}

// ========== CLI Endpoints API ==========

export interface CliEndpoint {
  id: string;
  name: string;
  type: 'litellm' | 'custom' | 'wrapper';
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface CliEndpointsResponse {
  endpoints: CliEndpoint[];
}

/**
 * Fetch all CLI endpoints
 */
export async function fetchCliEndpoints(): Promise<CliEndpointsResponse> {
  const data = await fetchApi<{ endpoints?: CliEndpoint[] }>('/api/cli/endpoints');
  return {
    endpoints: data.endpoints ?? [],
  };
}

/**
 * Update CLI endpoint configuration
 */
export async function updateCliEndpoint(
  endpointId: string,
  config: Partial<CliEndpoint>
): Promise<CliEndpoint> {
  return fetchApi<CliEndpoint>(`/api/cli/endpoints/${encodeURIComponent(endpointId)}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

/**
 * Create a new CLI endpoint
 */
export async function createCliEndpoint(
  endpoint: Omit<CliEndpoint, 'id'>
): Promise<CliEndpoint> {
  return fetchApi<CliEndpoint>('/api/cli/endpoints', {
    method: 'POST',
    body: JSON.stringify(endpoint),
  });
}

/**
 * Delete a CLI endpoint
 */
export async function deleteCliEndpoint(endpointId: string): Promise<void> {
  await fetchApi<void>(`/api/cli/endpoints/${encodeURIComponent(endpointId)}`, {
    method: 'DELETE',
  });
}

/**
 * Toggle CLI endpoint enabled status
 */
export async function toggleCliEndpoint(
  endpointId: string,
  enabled: boolean
): Promise<CliEndpoint> {
  return fetchApi<CliEndpoint>(`/api/cli/endpoints/${encodeURIComponent(endpointId)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

// ========== CLI Installations API ==========

export interface CliInstallation {
  name: string;
  version: string;
  installed: boolean;
  path?: string;
  status: 'active' | 'inactive' | 'error';
  lastChecked?: string;
}

export interface CliInstallationsResponse {
  tools: CliInstallation[];
}

/**
 * Fetch all CLI tool installations
 */
export async function fetchCliInstallations(): Promise<CliInstallationsResponse> {
  const data = await fetchApi<{ tools?: CliInstallation[] }>('/api/cli/installations');
  return {
    tools: data.tools ?? [],
  };
}

/**
 * Install a CLI tool
 */
export async function installCliTool(toolName: string): Promise<CliInstallation> {
  return fetchApi<CliInstallation>(`/api/cli/installations/${encodeURIComponent(toolName)}/install`, {
    method: 'POST',
  });
}

/**
 * Uninstall a CLI tool
 */
export async function uninstallCliTool(toolName: string): Promise<void> {
  await fetchApi<void>(`/api/cli/installations/${encodeURIComponent(toolName)}/uninstall`, {
    method: 'POST',
  });
}

/**
 * Upgrade a CLI tool
 */
export async function upgradeCliTool(toolName: string): Promise<CliInstallation> {
  return fetchApi<CliInstallation>(`/api/cli/installations/${encodeURIComponent(toolName)}/upgrade`, {
    method: 'POST',
  });
}

/**
 * Check CLI tool installation status
 */
export async function checkCliToolStatus(toolName: string): Promise<CliInstallation> {
  return fetchApi<CliInstallation>(`/api/cli/installations/${encodeURIComponent(toolName)}/check`, {
    method: 'POST',
  });
}

// ========== Hooks API ==========

export interface Hook {
  name: string;
  description?: string;
  enabled: boolean;
  script?: string;
  command?: string;
  trigger: string;
  matcher?: string;
  scope?: 'global' | 'project';
  index?: number;
  templateId?: string;
}

export interface HooksResponse {
  hooks: Hook[];
}

/**
 * Raw hook entry as stored in settings.json
 * Format: { matcher?: string, hooks: [{ type: "command", command: "..." }] }
 */
interface RawHookEntry {
  matcher?: string;
  _templateId?: string;
  hooks?: Array<{
    type?: string;
    command?: string;
    prompt?: string;
    timeout?: number;
    async?: boolean;
  }>;
  // Legacy flat format support
  command?: string;
  args?: string[];
  script?: string;
  enabled?: boolean;
  description?: string;
}

/**
 * Parse raw hooks config from backend into flat Hook array
 */
function parseHooksConfig(
  data: {
    global?: { path?: string; hooks?: Record<string, RawHookEntry[]> };
    project?: { path?: string | null; hooks?: Record<string, RawHookEntry[]> };
  }
): Hook[] {
  const result: Hook[] = [];

  for (const scope of ['project', 'global'] as const) {
    const scopeData = data[scope];
    if (!scopeData?.hooks || typeof scopeData.hooks !== 'object') continue;

    for (const [event, entries] of Object.entries(scopeData.hooks)) {
      if (!Array.isArray(entries)) continue;

      entries.forEach((entry, index) => {
        // Extract command from nested hooks array (official format)
        let command = '';
        if (entry.hooks && Array.isArray(entry.hooks) && entry.hooks.length > 0) {
          command = entry.hooks.map(h => h.command || h.prompt || '').filter(Boolean).join(' && ');
        }
        // Legacy flat format fallback
        if (!command && entry.command) {
          command = entry.args
            ? `${entry.command} ${entry.args.join(' ')}`
            : entry.command;
        }
        if (!command && entry.script) {
          command = entry.script;
        }

        const name = `${scope}-${event}-${index}`;

        result.push({
          name,
          description: entry.description,
          enabled: entry.enabled !== false,
          command,
          trigger: event,
          matcher: entry.matcher,
          scope,
          index,
          templateId: entry._templateId,
        });
      });
    }
  }

  return result;
}

/**
 * Fetch all hooks for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchHooks(projectPath?: string): Promise<HooksResponse> {
  const url = projectPath ? `/api/hooks?path=${encodeURIComponent(projectPath)}` : '/api/hooks';
  const data = await fetchApi<Record<string, unknown>>(url);
  return {
    hooks: parseHooksConfig(data as Parameters<typeof parseHooksConfig>[0]),
  };
}

/**
 * Update hook configuration
 */
export async function updateHook(
  hookName: string,
  config: Partial<Hook>
): Promise<Hook> {
  return fetchApi<Hook>(`/api/hooks/${encodeURIComponent(hookName)}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

/**
 * Toggle hook enabled status
 */
export async function toggleHook(
  hookName: string,
  enabled: boolean
): Promise<Hook> {
  return fetchApi<Hook>(`/api/hooks/${encodeURIComponent(hookName)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

/**
 * Create a new hook
 */
export async function createHook(
  input: { name: string; description?: string; trigger: string; matcher?: string; command: string }
): Promise<Hook> {
  return fetchApi<Hook>('/api/hooks/create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Save a hook to settings file via POST /api/hooks
 * This writes directly to Claude Code's settings.json in the correct format
 */
export async function saveHook(
  scope: 'global' | 'project',
  event: string,
  hookData: Record<string, unknown>
): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>('/api/hooks', {
    method: 'POST',
    body: JSON.stringify({ projectPath: '', scope, event, hookData }),
  });
}

/**
 * Update hook using dedicated update endpoint with partial input
 */
export async function updateHookConfig(
  hookName: string,
  input: { description?: string; trigger?: string; matcher?: string; command?: string }
): Promise<Hook> {
  return fetchApi<Hook>('/api/hooks/update', {
    method: 'POST',
    body: JSON.stringify({ name: hookName, ...input }),
  });
}

/**
 * Delete a hook
 */
export async function deleteHook(hookName: string): Promise<void> {
  return fetchApi<void>(`/api/hooks/delete/${encodeURIComponent(hookName)}`, {
    method: 'DELETE',
  });
}

/**
 * Install a hook from predefined template
 * Converts template data to Claude Code's settings.json format:
 * { _templateId, matcher?, hooks: [{ type: "command", command: "full command string" }] }
 */
export async function installHookTemplate(
  trigger: string,
  templateData: { id: string; command: string; args?: string[]; matcher?: string }
): Promise<{ success: boolean }> {
  // Build full command string from command + args
  const fullCommand = templateData.args
    ? `${templateData.command} ${templateData.args.map(a => a.includes(' ') ? `'${a}'` : a).join(' ')}`
    : templateData.command;

  // Build hookData in Claude Code's official nested format
  // _templateId is ignored by Claude Code but used for installed detection
  const hookData: Record<string, unknown> = {
    _templateId: templateData.id,
    hooks: [
      {
        type: 'command',
        command: fullCommand,
      }
    ]
  };

  if (templateData.matcher) {
    hookData.matcher = templateData.matcher;
  }

  return saveHook('project', trigger, hookData);
}

// ========== Rules API ==========

/**
 * Fetch all rules for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchRules(projectPath?: string): Promise<RulesResponse> {
  // Try with project path first, fall back to global on 403/404
  if (projectPath) {
    try {
      const url = `/api/rules?path=${encodeURIComponent(projectPath)}`;
      const data = await fetchApi<{ rules?: Rule[]; projectRules?: Rule[]; userRules?: Rule[] }>(url);
      const allRules = [...(data.projectRules ?? []), ...(data.userRules ?? [])];
      return {
        rules: data.rules ?? allRules,
      };
    } catch (error: unknown) {
      const apiError = error as ApiError;
      if (apiError.status === 403 || apiError.status === 404) {
        // Fall back to global rules list
        console.warn('[fetchRules] 403/404 for project path, falling back to global rules');
      } else {
        throw error;
      }
    }
  }
  // Fallback: fetch global rules
  const data = await fetchApi<{ rules?: Rule[]; projectRules?: Rule[]; userRules?: Rule[] }>('/api/rules');
  const allRules = [...(data.projectRules ?? []), ...(data.userRules ?? [])];
  return {
    rules: data.rules ?? allRules,
  };
}

/**
 * Update rule configuration
 */
export async function updateRule(
  ruleId: string,
  config: Partial<Rule>
): Promise<Rule> {
  return fetchApi<Rule>(`/api/rules/${encodeURIComponent(ruleId)}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

/**
 * Toggle rule enabled status
 */
export async function toggleRule(
  ruleId: string,
  enabled: boolean
): Promise<Rule> {
  return fetchApi<Rule>(`/api/rules/${encodeURIComponent(ruleId)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

/**
 * Create a new rule
 */
export async function createRule(input: RuleCreateInput): Promise<Rule> {
  return fetchApi<Rule>('/api/rules/create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Delete a rule
 */
export async function deleteRule(
  ruleId: string,
  location?: string
): Promise<void> {
  return fetchApi<void>(`/api/rules/${encodeURIComponent(ruleId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ location }),
  });
}

/**
 * Add MCP server to global scope (~/.claude.json mcpServers)
 */
export async function addGlobalMcpServer(
  serverName: string,
  serverConfig: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    type?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  return fetchApi<{ success: boolean; error?: string }>('/api/mcp-add-global-server', {
    method: 'POST',
    body: JSON.stringify({ serverName, serverConfig }),
  });
}

/**
 * Copy/Add MCP server to project (.mcp.json or .claude.json)
 */
export async function copyMcpServerToProject(
  serverName: string,
  serverConfig: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    type?: string;
  },
  projectPath: string,
  configType: 'mcp' | 'claude' = 'mcp'
): Promise<{ success: boolean; error?: string }> {
  const path = requireProjectPath(projectPath, 'copyMcpServerToProject');

  return fetchApi<{ success: boolean; error?: string }>('/api/mcp-copy-server', {
    method: 'POST',
    body: JSON.stringify({ projectPath: path, serverName, serverConfig, configType }),
  });
}

// ========== CCW Tools MCP API ==========

/**
 * CCW MCP configuration interface
 */
export interface CcwMcpConfig {
  isInstalled: boolean;
  enabledTools: string[];
  projectRoot?: string;
  allowedDirs?: string;
  enableSandbox?: boolean;
  installedScopes: ('global' | 'project')[];
}

/**
 * Platform detection for cross-platform MCP config
 */
const isWindows = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('win');

/**
 * Build CCW MCP server config
 */
function buildCcwMcpServerConfig(config: {
  enabledTools?: string[];
  projectRoot?: string;
  allowedDirs?: string;
  enableSandbox?: boolean;
}): { command: string; args: string[]; env: Record<string, string> } {
  const env: Record<string, string> = {};

  if (config.enabledTools && config.enabledTools.length > 0) {
    env.CCW_ENABLED_TOOLS = config.enabledTools.join(',');
  } else {
    env.CCW_ENABLED_TOOLS = 'write_file,edit_file,read_file,core_memory,ask_question,smart_search';
  }

  if (config.projectRoot) {
    env.CCW_PROJECT_ROOT = config.projectRoot;
  }
  if (config.allowedDirs) {
    env.CCW_ALLOWED_DIRS = config.allowedDirs;
  }
  if (config.enableSandbox) {
    env.CCW_ENABLE_SANDBOX = '1';
  }

  // Cross-platform config
  if (isWindows) {
    return {
      command: 'cmd',
      args: ['/c', 'npx', '-y', 'ccw-mcp'],
      env
    };
  }
  return {
    command: 'npx',
    args: ['-y', 'ccw-mcp'],
    env
  };
}

/**
 * Fetch CCW Tools MCP configuration by checking if ccw-tools server exists
 */
export async function fetchCcwMcpConfig(currentProjectPath?: string): Promise<CcwMcpConfig> {
  try {
    const config = await fetchMcpConfig();

    const installedScopes: ('global' | 'project')[] = [];
    let ccwServer: any = null;

    // Check global/user servers
    if (config.globalServers?.['ccw-tools']) {
      installedScopes.push('global');
      ccwServer = config.globalServers['ccw-tools'];
    } else if (config.userServers?.['ccw-tools']) {
      installedScopes.push('global');
      ccwServer = config.userServers['ccw-tools'];
    }

    // Check project servers - only check current project if specified
    if (config.projects) {
      if (currentProjectPath) {
        // Normalize path for comparison (forward slashes)
        const normalizedCurrent = currentProjectPath.replace(/\\/g, '/');
        for (const [key, proj] of Object.entries(config.projects)) {
          const normalizedKey = key.replace(/\\/g, '/');
          if (normalizedKey === normalizedCurrent && proj.mcpServers?.['ccw-tools']) {
            installedScopes.push('project');
            if (!ccwServer) ccwServer = proj.mcpServers['ccw-tools'];
            break;
          }
        }
      } else {
        // Fallback: check all projects (legacy behavior)
        for (const proj of Object.values(config.projects)) {
          if (proj.mcpServers?.['ccw-tools']) {
            installedScopes.push('project');
            if (!ccwServer) ccwServer = proj.mcpServers['ccw-tools'];
            break;
          }
        }
      }
    }

    if (!ccwServer) {
      return {
        isInstalled: false,
        enabledTools: [],
        installedScopes: [],
      };
    }

    // Parse enabled tools from env
    const env = ccwServer.env || {};
    const enabledToolsStr = env.CCW_ENABLED_TOOLS || 'all';
    const enabledTools = enabledToolsStr === 'all'
      ? ['write_file', 'edit_file', 'read_file', 'core_memory', 'ask_question']
      : enabledToolsStr.split(',').map((t: string) => t.trim());

    return {
      isInstalled: true,
      enabledTools,
      projectRoot: env.CCW_PROJECT_ROOT,
      allowedDirs: env.CCW_ALLOWED_DIRS,
      enableSandbox: env.CCW_ENABLE_SANDBOX === '1',
      installedScopes,
    };
  } catch {
    return {
      isInstalled: false,
      enabledTools: [],
      installedScopes: [],
    };
  }
}

/**
 * Update CCW Tools MCP configuration (re-install with new config)
 */
export async function updateCcwConfig(config: {
  enabledTools?: string[];
  projectRoot?: string;
  allowedDirs?: string;
  enableSandbox?: boolean;
}): Promise<CcwMcpConfig> {
  const serverConfig = buildCcwMcpServerConfig(config);

  // Install/update to global config
  const result = await addGlobalMcpServer('ccw-tools', serverConfig);
  if (!result.success) {
    throw new Error(result.error || 'Failed to update CCW config');
  }

  return fetchCcwMcpConfig();
}

/**
 * Install CCW Tools MCP server
 */
export async function installCcwMcp(
  scope: 'global' | 'project' = 'global',
  projectPath?: string
): Promise<CcwMcpConfig> {
  const serverConfig = buildCcwMcpServerConfig({
    enabledTools: ['write_file', 'edit_file', 'read_file', 'core_memory', 'ask_question', 'smart_search'],
  });

  if (scope === 'project' && projectPath) {
    const result = await fetchApi<{ success?: boolean; error?: string }>('/api/mcp-copy-server', {
      method: 'POST',
      body: JSON.stringify({
        projectPath,
        serverName: 'ccw-tools',
        serverConfig,
        configType: 'mcp',
      }),
    });
    if (result?.error) {
      throw new Error(result.error || 'Failed to install CCW MCP to project');
    }
  } else {
    const result = await addGlobalMcpServer('ccw-tools', serverConfig);
    if (!result.success) {
      throw new Error(result.error || 'Failed to install CCW MCP');
    }
  }

  return fetchCcwMcpConfig();
}

/**
 * Uninstall CCW Tools MCP server from all scopes (global + projects)
 */
export async function uninstallCcwMcp(): Promise<void> {
  // 1. Remove from global scope
  try {
    await fetchApi<{ success: boolean }>('/api/mcp-remove-global-server', {
      method: 'POST',
      body: JSON.stringify({ serverName: 'ccw-tools' }),
    });
  } catch {
    // May not exist in global - continue
  }

  // 2. Remove from all projects that have ccw-tools
  try {
    const config = await fetchMcpConfig();
    if (config.projects) {
      const removePromises = Object.entries(config.projects)
        .filter(([_, proj]) => proj.mcpServers?.['ccw-tools'])
        .map(([projectPath]) =>
          fetchApi<{ success: boolean }>('/api/mcp-remove-server', {
            method: 'POST',
            body: JSON.stringify({ projectPath, serverName: 'ccw-tools' }),
          }).catch(() => {})
        );
      await Promise.all(removePromises);
    }
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Uninstall CCW Tools MCP server from a specific scope
 */
export async function uninstallCcwMcpFromScope(
  scope: 'global' | 'project',
  projectPath?: string
): Promise<void> {
  if (scope === 'global') {
    await fetchApi('/api/mcp-remove-global-server', {
      method: 'POST',
      body: JSON.stringify({ serverName: 'ccw-tools' }),
    });
  } else {
    if (!projectPath) throw new Error('projectPath required for project scope uninstall');
    await fetchApi('/api/mcp-remove-server', {
      method: 'POST',
      body: JSON.stringify({ projectPath, serverName: 'ccw-tools' }),
    });
  }
}

// ========== CCW Tools MCP - Codex API ==========

/**
 * Fetch CCW Tools MCP configuration from Codex config.toml
 */
export async function fetchCcwMcpConfigForCodex(): Promise<CcwMcpConfig> {
  try {
    const { servers } = await fetchCodexMcpServers();
    const ccwServer = servers.find((s) => s.name === 'ccw-tools');

    if (!ccwServer) {
      return { isInstalled: false, enabledTools: [], installedScopes: [] };
    }

    const env = ccwServer.env || {};
    const enabledToolsStr = env.CCW_ENABLED_TOOLS || 'all';
    const enabledTools = enabledToolsStr === 'all'
      ? ['write_file', 'edit_file', 'read_file', 'core_memory', 'ask_question', 'smart_search']
      : enabledToolsStr.split(',').map((t: string) => t.trim());

    return {
      isInstalled: true,
      enabledTools,
      projectRoot: env.CCW_PROJECT_ROOT,
      allowedDirs: env.CCW_ALLOWED_DIRS,
      enableSandbox: env.CCW_ENABLE_SANDBOX === '1',
      installedScopes: ['global'],
    };
  } catch {
    return { isInstalled: false, enabledTools: [], installedScopes: [] };
  }
}

/**
 * Build CCW MCP server config for Codex (uses global ccw-mcp command)
 */
function buildCcwMcpServerConfigForCodex(config: {
  enabledTools?: string[];
  projectRoot?: string;
  allowedDirs?: string;
  enableSandbox?: boolean;
}): { command: string; args: string[]; env: Record<string, string> } {
  const env: Record<string, string> = {};

  if (config.enabledTools && config.enabledTools.length > 0) {
    env.CCW_ENABLED_TOOLS = config.enabledTools.join(',');
  } else {
    env.CCW_ENABLED_TOOLS = 'write_file,edit_file,read_file,core_memory,ask_question,smart_search';
  }

  if (config.projectRoot) {
    env.CCW_PROJECT_ROOT = config.projectRoot;
  }
  if (config.allowedDirs) {
    env.CCW_ALLOWED_DIRS = config.allowedDirs;
  }
  if (config.enableSandbox) {
    env.CCW_ENABLE_SANDBOX = '1';
  }

  return { command: 'ccw-mcp', args: [], env };
}

/**
 * Install CCW Tools MCP to Codex config.toml
 */
export async function installCcwMcpToCodex(): Promise<CcwMcpConfig> {
  const serverConfig = buildCcwMcpServerConfigForCodex({
    enabledTools: ['write_file', 'edit_file', 'read_file', 'core_memory', 'ask_question', 'smart_search'],
  });

  const result = await addCodexMcpServer('ccw-tools', serverConfig);
  if (result.error) {
    throw new Error(result.error || 'Failed to install CCW MCP to Codex');
  }

  return fetchCcwMcpConfigForCodex();
}

/**
 * Uninstall CCW Tools MCP from Codex config.toml
 */
export async function uninstallCcwMcpFromCodex(): Promise<void> {
  const result = await codexRemoveServer('ccw-tools');
  if (!result.success) {
    throw new Error(result.error || 'Failed to uninstall CCW MCP from Codex');
  }
}

/**
 * Update CCW Tools MCP configuration in Codex config.toml
 */
export async function updateCcwConfigForCodex(config: {
  enabledTools?: string[];
  projectRoot?: string;
  allowedDirs?: string;
  enableSandbox?: boolean;
}): Promise<CcwMcpConfig> {
  const serverConfig = buildCcwMcpServerConfigForCodex(config);

  const result = await addCodexMcpServer('ccw-tools', serverConfig);
  if (result.error) {
    throw new Error(result.error || 'Failed to update CCW config in Codex');
  }

  return fetchCcwMcpConfigForCodex();
}

// ========== Index Management API ==========

/**
 * Fetch current index status for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchIndexStatus(projectPath?: string): Promise<IndexStatus> {
  const url = projectPath
    ? `/api/codexlens/workspace-status?path=${encodeURIComponent(projectPath)}`
    : '/api/codexlens/workspace-status';
  const resp = await fetchApi<{
    success: boolean;
    hasIndex: boolean;
    fts?: { indexedFiles: number; totalFiles: number };
  }>(url);
  return {
    totalFiles: resp.fts?.totalFiles ?? 0,
    lastUpdated: new Date().toISOString(),
    buildTime: 0,
    status: resp.hasIndex ? 'completed' : 'idle',
  };
}

/**
 * Rebuild index
 */
export async function rebuildIndex(request: IndexRebuildRequest = {}): Promise<IndexStatus> {
  await fetchApi<{ success: boolean }>('/api/codexlens/init', {
    method: 'POST',
    body: JSON.stringify({
      path: request.paths?.[0],
      indexType: 'vector',
    }),
  });
  return {
    totalFiles: 0,
    lastUpdated: new Date().toISOString(),
    buildTime: 0,
    status: 'building',
  };
}

// ========== Prompt History API ==========

/**
 * Prompt history response from backend
 */
export interface PromptsResponse {
  prompts: Prompt[];
  total: number;
}

/**
 * Prompt insights response from backend
 */
export interface PromptInsightsResponse {
  insights: PromptInsight[];
  patterns: Pattern[];
  suggestions: Suggestion[];
}

/**
 * Insight history entry from CLI analysis
 */
export interface InsightHistory {
  /** Unique insight identifier */
  id: string;
  /** Created timestamp */
  created_at: string;
  /** AI tool used for analysis */
  tool: 'gemini' | 'qwen' | 'codex' | string;
  /** Number of prompts analyzed */
  prompt_count: number;
  /** Detected patterns */
  patterns: Pattern[];
  /** AI suggestions */
  suggestions: Suggestion[];
  /** Associated execution ID */
  execution_id: string | null;
  /** Language preference */
  lang: string;
}

/**
 * Insights history response from backend
 */
export interface InsightsHistoryResponse {
  insights: InsightHistory[];
}

/**
 * Analyze prompts request
 */
export interface AnalyzePromptsRequest {
  tool?: 'gemini' | 'qwen' | 'codex';
  promptIds?: string[];
  limit?: number;
}

/**
 * Fetch all prompts from history for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchPrompts(projectPath?: string): Promise<PromptsResponse> {
  const url = projectPath ? `/api/memory/prompts?path=${encodeURIComponent(projectPath)}` : '/api/memory/prompts';
  return fetchApi<PromptsResponse>(url);
}

/**
 * Fetch prompt insights from backend for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchPromptInsights(projectPath?: string): Promise<PromptInsightsResponse> {
  const url = projectPath ? `/api/memory/insights?path=${encodeURIComponent(projectPath)}` : '/api/memory/insights';
  return fetchApi<PromptInsightsResponse>(url);
}

/**
 * Fetch insights history (past CLI analyses) from backend
 * @param projectPath - Optional project path to filter data by workspace
 * @param limit - Maximum number of insights to fetch (default: 20)
 */
export async function fetchInsightsHistory(projectPath?: string, limit: number = 20): Promise<InsightsHistoryResponse> {
  const url = projectPath
    ? `/api/memory/insights?limit=${limit}&path=${encodeURIComponent(projectPath)}`
    : `/api/memory/insights?limit=${limit}`;
  return fetchApi<InsightsHistoryResponse>(url);
}

/**
 * Fetch a single insight detail by ID
 * @param insightId - Insight ID to fetch
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchInsightDetail(insightId: string, projectPath?: string): Promise<InsightHistory> {
  const url = projectPath
    ? `/api/memory/insights/${encodeURIComponent(insightId)}?path=${encodeURIComponent(projectPath)}`
    : `/api/memory/insights/${encodeURIComponent(insightId)}`;
  return fetchApi<InsightHistory>(url);
}

/**
 * Analyze prompts using AI tool
 */
export async function analyzePrompts(request: AnalyzePromptsRequest = {}): Promise<PromptInsightsResponse> {
  return fetchApi<PromptInsightsResponse>('/api/memory/analyze', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Delete a prompt from history
 */
export async function deletePrompt(promptId: string): Promise<void> {
  await fetchApi<void>('/api/memory/prompts/' + encodeURIComponent(promptId), {
    method: 'DELETE',
  });
}

/**
 * Delete an insight from history
 */
export async function deleteInsight(insightId: string, projectPath?: string): Promise<{ success: boolean }> {
  const url = projectPath
    ? `/api/memory/insights/${encodeURIComponent(insightId)}?path=${encodeURIComponent(projectPath)}`
    : `/api/memory/insights/${encodeURIComponent(insightId)}`;
  return fetchApi<{ success: boolean }>(url, {
    method: 'DELETE',
  });
}

/**
 * Batch delete prompts from history
 */
export async function batchDeletePrompts(promptIds: string[]): Promise<{ deleted: number }> {
  return fetchApi<{ deleted: number }>('/api/memory/prompts/batch-delete', {
    method: 'POST',
    body: JSON.stringify({ promptIds }),
  });
}

// ========== File Explorer API ==========

/**
 * File tree response from backend
 */
export interface FileTreeResponse {
  rootNodes: import('../types/file-explorer').FileSystemNode[];
  fileCount: number;
  directoryCount: number;
  totalSize: number;
  buildTime: number;
}

/**
 * Fetch file tree for a given root path
 */
export async function fetchFileTree(rootPath: string = '/', options: {
  maxDepth?: number;
  includeHidden?: boolean;
  excludePatterns?: string[];
} = {}): Promise<FileTreeResponse> {
  const params = new URLSearchParams();
  params.append('rootPath', rootPath);
  if (options.maxDepth !== undefined) params.append('maxDepth', String(options.maxDepth));
  if (options.includeHidden !== undefined) params.append('includeHidden', String(options.includeHidden));
  if (options.excludePatterns) params.append('excludePatterns', options.excludePatterns.join(','));

  return fetchApi<FileTreeResponse>(`/api/explorer/tree?${params.toString()}`);
}

/**
 * Fetch file content
 */
export async function fetchFileContent(filePath: string, options: {
  encoding?: 'utf8' | 'ascii' | 'base64';
  maxSize?: number;
} = {}): Promise<import('../types/file-explorer').FileContent> {
  const params = new URLSearchParams();
  params.append('path', filePath);
  if (options.encoding) params.append('encoding', options.encoding);
  if (options.maxSize !== undefined) params.append('maxSize', String(options.maxSize));

  return fetchApi<import('../types/file-explorer').FileContent>(`/api/explorer/file?${params.toString()}`);
}

/**
 * Search files request
 */
export interface SearchFilesRequest {
  rootPath?: string;
  query: string;
  filePatterns?: string[];
  excludePatterns?: string[];
  maxResults?: number;
  caseSensitive?: boolean;
}

/**
 * Search files response
 */
export interface SearchFilesResponse {
  results: Array<{
    path: string;
    name: string;
    type: 'file' | 'directory';
    matches: Array<{
      line: number;
      column: number;
      context: string;
    }>;
  }>;
  totalMatches: number;
  searchTime: number;
}

/**
 * Search files by content or name
 */
export async function searchFiles(request: SearchFilesRequest): Promise<SearchFilesResponse> {
  return fetchApi<SearchFilesResponse>('/api/explorer/search', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get available root directories
 */
export interface RootDirectory {
  path: string;
  name: string;
  isWorkspace: boolean;
  isGitRoot: boolean;
}

export async function fetchRootDirectories(): Promise<RootDirectory[]> {
  return fetchApi<RootDirectory[]>('/api/explorer/roots');
}

// ========== Graph Explorer API ==========

/**
 * Graph dependencies request
 */
export interface GraphDependenciesRequest {
  rootPath?: string;
  maxDepth?: number;
  includeTypes?: string[];
  excludePatterns?: string[];
}

/**
 * Graph dependencies response
 */
export interface GraphDependenciesResponse {
  nodes: import('../types/graph-explorer').GraphNode[];
  edges: import('../types/graph-explorer').GraphEdge[];
  metadata: import('../types/graph-explorer').GraphMetadata;
}

/**
 * Fetch graph dependencies for code visualization
 */
export async function fetchGraphDependencies(request: GraphDependenciesRequest = {}): Promise<GraphDependenciesResponse> {
  const params = new URLSearchParams();
  if (request.rootPath) params.append('rootPath', request.rootPath);
  if (request.maxDepth !== undefined) params.append('maxDepth', String(request.maxDepth));
  if (request.includeTypes) params.append('includeTypes', request.includeTypes.join(','));
  if (request.excludePatterns) params.append('excludePatterns', request.excludePatterns.join(','));

  return fetchApi<GraphDependenciesResponse>(`/api/graph/dependencies?${params.toString()}`);
}

/**
 * Graph impact analysis request
 */
export interface GraphImpactRequest {
  nodeId: string;
  direction?: 'upstream' | 'downstream' | 'both';
  maxDepth?: number;
}

/**
 * Graph impact analysis response
 */
export interface GraphImpactResponse {
  nodeId: string;
  dependencies: import('../types/graph-explorer').GraphNode[];
  dependents: import('../types/graph-explorer').GraphNode[];
  paths: Array<{
    nodes: string[];
    edges: string[];
  }>;
}

/**
 * Fetch impact analysis for a specific node
 */
export async function fetchGraphImpact(request: GraphImpactRequest): Promise<GraphImpactResponse> {
  const params = new URLSearchParams();
  params.append('nodeId', request.nodeId);
  if (request.direction) params.append('direction', request.direction);
  if (request.maxDepth !== undefined) params.append('maxDepth', String(request.maxDepth));

  return fetchApi<GraphImpactResponse>(`/api/graph/impact?${params.toString()}`);
}

// ========== CodexLens API ==========

/**
 * CodexLens venv status response
 */
export interface CodexLensVenvStatus {
  ready: boolean;
  installed: boolean;
  version?: string;
  pythonVersion?: string;
  venvPath?: string;
  error?: string;
}

/**
 * CodexLens status data
 */
export interface CodexLensStatusData {
  projects_count?: number;
  total_files?: number;
  total_chunks?: number;
  api_url?: string;
  api_ready?: boolean;
  [key: string]: unknown;
}

/**
 * CodexLens configuration
 */
export interface CodexLensConfig {
  index_dir: string;
  index_count: number;
  api_max_workers: number;
  api_batch_size: number;
}

/**
 * Semantic search status
 */
export interface CodexLensSemanticStatus {
  available: boolean;
  backend?: string;
  model?: string;
  hasEmbeddings?: boolean;
  [key: string]: unknown;
}

/**
 * Dashboard init response
 */
export interface CodexLensDashboardInitResponse {
  installed: boolean;
  status: CodexLensVenvStatus;
  config: CodexLensConfig;
  semantic: CodexLensSemanticStatus;
  statusData?: CodexLensStatusData;
}

/**
 * Workspace index status
 */
export interface CodexLensWorkspaceStatus {
  success: boolean;
  hasIndex: boolean;
  path?: string;
  fts: {
    percent: number;
    indexedFiles: number;
    totalFiles: number;
  };
  vector: {
    percent: number;
    filesWithEmbeddings: number;
    totalFiles: number;
    totalChunks: number;
  };
}

/**
 * GPU device info
 */
export interface CodexLensGpuDevice {
  name: string;
  type: 'integrated' | 'discrete';
  index: number;
  device_id?: string;
  memory?: {
    total?: number;
    free?: number;
  };
}

/**
 * GPU detect response
 */
export interface CodexLensGpuDetectResponse {
  success: boolean;
  supported: boolean;
  platform: string;
  deviceCount?: number;
  devices?: CodexLensGpuDevice[];
  error?: string;
}

/**
 * GPU list response
 */
export interface CodexLensGpuListResponse {
  success: boolean;
  devices: CodexLensGpuDevice[];
  selected_device_id?: string | number;
}

/**
 * Model info (normalized from CLI output)
 */
export interface CodexLensModel {
  profile: string;
  name: string;
  type: 'embedding' | 'reranker';
  backend: string;
  size?: string;
  installed: boolean;
  cache_path?: string;
  /** Original HuggingFace model name */
  model_name?: string;
  /** Model description */
  description?: string;
  /** Use case description */
  use_case?: string;
  /** Embedding dimensions */
  dimensions?: number;
  /** Whether this model is recommended */
  recommended?: boolean;
  /** Model source: 'predefined' | 'discovered' */
  source?: string;
  /** Estimated size in MB */
  estimated_size_mb?: number;
  /** Actual size in MB (when installed) */
  actual_size_mb?: number | null;
}

/**
 * Model list response (normalized)
 */
export interface CodexLensModelsResponse {
  success: boolean;
  models: CodexLensModel[];
}

/**
 * Model info response
 */
export interface CodexLensModelInfoResponse {
  success: boolean;
  profile: string;
  info: {
    name: string;
    backend: string;
    type: string;
    size?: string;
    path?: string;
    [key: string]: unknown;
  };
}

/**
 * Download model response
 */
export interface CodexLensDownloadModelResponse {
  success: boolean;
  message?: string;
  profile?: string;
  progress?: number;
  error?: string;
}

/**
 * Delete model response
 */
export interface CodexLensDeleteModelResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Environment variables response
 */
export interface CodexLensEnvResponse {
  success: boolean;
  path?: string;
  env: Record<string, string>;
  raw?: string;
  settings?: Record<string, string>;
}

/**
 * Update environment request
 */
export interface CodexLensUpdateEnvRequest {
  env: Record<string, string>;
}

/**
 * Update environment response
 */
export interface CodexLensUpdateEnvResponse {
  success: boolean;
  message?: string;
  path?: string;
  settingsPath?: string;
}

/**
 * Ignore patterns response
 */
export interface CodexLensIgnorePatternsResponse {
  success: boolean;
  patterns: string[];
  extensionFilters: string[];
  defaults: {
    patterns: string[];
    extensionFilters: string[];
  };
}

/**
 * Update ignore patterns request
 */
export interface CodexLensUpdateIgnorePatternsRequest {
  patterns?: string[];
  extensionFilters?: string[];
}

/**
 * Bootstrap install response
 */
export interface CodexLensBootstrapResponse {
  success: boolean;
  message?: string;
  version?: string;
  error?: string;
}

/**
 * Uninstall response
 */
export interface CodexLensUninstallResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Fetch CodexLens dashboard initialization data
 */
export async function fetchCodexLensDashboardInit(): Promise<CodexLensDashboardInitResponse> {
  return fetchApi<CodexLensDashboardInitResponse>('/api/codexlens/dashboard-init');
}

/**
 * Fetch CodexLens venv status
 */
export async function fetchCodexLensStatus(): Promise<CodexLensVenvStatus> {
  return fetchApi<CodexLensVenvStatus>('/api/codexlens/status');
}

/**
 * Fetch CodexLens workspace index status
 */
export async function fetchCodexLensWorkspaceStatus(projectPath: string): Promise<CodexLensWorkspaceStatus> {
  const params = new URLSearchParams();
  params.append('path', projectPath);
  return fetchApi<CodexLensWorkspaceStatus>(`/api/codexlens/workspace-status?${params.toString()}`);
}

/**
 * Fetch CodexLens configuration
 */
export async function fetchCodexLensConfig(): Promise<CodexLensConfig> {
  return fetchApi<CodexLensConfig>('/api/codexlens/config');
}

/**
 * Update CodexLens configuration
 */
export async function updateCodexLensConfig(config: {
  index_dir: string;
  api_max_workers?: number;
  api_batch_size?: number;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  return fetchApi('/api/codexlens/config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

/**
 * Bootstrap/install CodexLens
 */
export async function bootstrapCodexLens(): Promise<CodexLensBootstrapResponse> {
  return fetchApi<CodexLensBootstrapResponse>('/api/codexlens/bootstrap', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * CodexLens semantic install response
 */
export interface CodexLensSemanticInstallResponse {
  success: boolean;
  message?: string;
  gpuMode?: string;
  available?: boolean;
  backend?: string;
  accelerator?: string;
  providers?: string[];
  error?: string;
}

/**
 * Install CodexLens semantic dependencies with GPU mode
 */
export async function installCodexLensSemantic(gpuMode: 'cpu' | 'cuda' | 'directml' = 'cpu'): Promise<CodexLensSemanticInstallResponse> {
  return fetchApi<CodexLensSemanticInstallResponse>('/api/codexlens/semantic/install', {
    method: 'POST',
    body: JSON.stringify({ gpuMode }),
  });
}

/**
 * Uninstall CodexLens
 */
export async function uninstallCodexLens(): Promise<CodexLensUninstallResponse> {
  return fetchApi<CodexLensUninstallResponse>('/api/codexlens/uninstall', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Fetch CodexLens models list
 * Normalizes the CLI response format to match the frontend interface.
 * CLI returns: { success, result: { models: [{ model_name, estimated_size_mb, ... }] } }
 * Frontend expects: { success, models: [{ name, size, type, backend, ... }] }
 */
export async function fetchCodexLensModels(): Promise<CodexLensModelsResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await fetchApi<any>('/api/codexlens/models');

  // Handle nested result structure from CLI
  const rawModels = raw?.result?.models ?? raw?.models ?? [];

  const models: CodexLensModel[] = rawModels.map((m: Record<string, unknown>) => ({
    profile: (m.profile as string) || '',
    name: (m.model_name as string) || (m.name as string) || (m.profile as string) || '',
    type: (m.type as 'embedding' | 'reranker') || 'embedding',
    backend: (m.source as string) || 'fastembed',
    size: m.installed && m.actual_size_mb
      ? `${(m.actual_size_mb as number).toFixed(0)} MB`
      : m.estimated_size_mb
        ? `~${m.estimated_size_mb} MB`
        : undefined,
    installed: (m.installed as boolean) ?? false,
    cache_path: m.cache_path as string | undefined,
    model_name: m.model_name as string | undefined,
    description: m.description as string | undefined,
    use_case: m.use_case as string | undefined,
    dimensions: m.dimensions as number | undefined,
    recommended: m.recommended as boolean | undefined,
    source: m.source as string | undefined,
    estimated_size_mb: m.estimated_size_mb as number | undefined,
    actual_size_mb: m.actual_size_mb as number | null | undefined,
  }));

  return {
    success: raw?.success ?? true,
    models,
  };
}

/**
 * Fetch CodexLens model info by profile
 */
export async function fetchCodexLensModelInfo(profile: string): Promise<CodexLensModelInfoResponse> {
  const params = new URLSearchParams();
  params.append('profile', profile);
  return fetchApi<CodexLensModelInfoResponse>(`/api/codexlens/models/info?${params.toString()}`);
}

/**
 * Download CodexLens model by profile
 */
export async function downloadCodexLensModel(profile: string): Promise<CodexLensDownloadModelResponse> {
  return fetchApi<CodexLensDownloadModelResponse>('/api/codexlens/models/download', {
    method: 'POST',
    body: JSON.stringify({ profile }),
  });
}

/**
 * Download custom CodexLens model from HuggingFace
 */
export async function downloadCodexLensCustomModel(modelName: string, modelType: string = 'embedding'): Promise<CodexLensDownloadModelResponse> {
  return fetchApi<CodexLensDownloadModelResponse>('/api/codexlens/models/download-custom', {
    method: 'POST',
    body: JSON.stringify({ model_name: modelName, model_type: modelType }),
  });
}

/**
 * Delete CodexLens model by profile
 */
export async function deleteCodexLensModel(profile: string): Promise<CodexLensDeleteModelResponse> {
  return fetchApi<CodexLensDeleteModelResponse>('/api/codexlens/models/delete', {
    method: 'POST',
    body: JSON.stringify({ profile }),
  });
}

/**
 * Delete CodexLens model by cache path
 */
export async function deleteCodexLensModelByPath(cachePath: string): Promise<CodexLensDeleteModelResponse> {
  return fetchApi<CodexLensDeleteModelResponse>('/api/codexlens/models/delete-path', {
    method: 'POST',
    body: JSON.stringify({ cache_path: cachePath }),
  });
}

/**
 * Fetch CodexLens environment variables
 */
export async function fetchCodexLensEnv(): Promise<CodexLensEnvResponse> {
  return fetchApi<CodexLensEnvResponse>('/api/codexlens/env');
}

/**
 * Update CodexLens environment variables
 */
export async function updateCodexLensEnv(request: CodexLensUpdateEnvRequest): Promise<CodexLensUpdateEnvResponse> {
  return fetchApi<CodexLensUpdateEnvResponse>('/api/codexlens/env', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Detect GPU support for CodexLens
 */
export async function fetchCodexLensGpuDetect(): Promise<CodexLensGpuDetectResponse> {
  return fetchApi<CodexLensGpuDetectResponse>('/api/codexlens/gpu/detect');
}

/**
 * Fetch available GPU devices
 */
export async function fetchCodexLensGpuList(): Promise<CodexLensGpuListResponse> {
  return fetchApi<CodexLensGpuListResponse>('/api/codexlens/gpu/list');
}

/**
 * Select GPU device for CodexLens
 */
export async function selectCodexLensGpu(deviceId: string | number): Promise<{ success: boolean; message?: string; error?: string }> {
  return fetchApi('/api/codexlens/gpu/select', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId }),
  });
}

/**
 * Reset GPU selection to auto-detection
 */
export async function resetCodexLensGpu(): Promise<{ success: boolean; message?: string; error?: string }> {
  return fetchApi('/api/codexlens/gpu/reset', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Fetch CodexLens ignore patterns
 */
export async function fetchCodexLensIgnorePatterns(): Promise<CodexLensIgnorePatternsResponse> {
  return fetchApi<CodexLensIgnorePatternsResponse>('/api/codexlens/ignore-patterns');
}

/**
 * Update CodexLens ignore patterns
 */
export async function updateCodexLensIgnorePatterns(request: CodexLensUpdateIgnorePatternsRequest): Promise<CodexLensIgnorePatternsResponse> {
  return fetchApi<CodexLensIgnorePatternsResponse>('/api/codexlens/ignore-patterns', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ========== CodexLens Reranker Config API ==========

/**
 * Reranker LiteLLM model info
 */
export interface RerankerLitellmModel {
  modelId: string;
  modelName: string;
  providers: string[];
}

/**
 * Reranker configuration response from GET /api/codexlens/reranker/config
 */
export interface RerankerConfigResponse {
  success: boolean;
  backend: string;
  model_name: string;
  api_provider: string;
  api_key_set: boolean;
  available_backends: string[];
  api_providers: string[];
  litellm_endpoints: string[];
  litellm_models?: RerankerLitellmModel[];
  config_source: string;
  error?: string;
}

/**
 * Reranker configuration update request for POST /api/codexlens/reranker/config
 */
export interface RerankerConfigUpdateRequest {
  backend?: string;
  model_name?: string;
  api_provider?: string;
  api_key?: string;
  litellm_endpoint?: string;
}

/**
 * Reranker configuration update response
 */
export interface RerankerConfigUpdateResponse {
  success: boolean;
  message?: string;
  updates?: string[];
  error?: string;
}

/**
 * Fetch reranker configuration (backends, models, providers)
 */
export async function fetchRerankerConfig(): Promise<RerankerConfigResponse> {
  return fetchApi<RerankerConfigResponse>('/api/codexlens/reranker/config');
}

/**
 * Update reranker configuration
 */
export async function updateRerankerConfig(
  request: RerankerConfigUpdateRequest
): Promise<RerankerConfigUpdateResponse> {
  return fetchApi<RerankerConfigUpdateResponse>('/api/codexlens/reranker/config', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ========== CodexLens Search API ==========

/**
 * CodexLens search request parameters
 */
export interface CodexLensSearchParams {
  query: string;
  limit?: number;
  mode?: 'dense_rerank' | 'fts' | 'fuzzy';
  max_content_length?: number;
  extra_files_count?: number;
}

/**
 * CodexLens search result
 */
export interface CodexLensSearchResult {
  path: string;
  score: number;
  content?: string;
  line_start?: number;
  line_end?: number;
  [key: string]: unknown;
}

/**
 * CodexLens search response
 */
export interface CodexLensSearchResponse {
  success: boolean;
  results: CodexLensSearchResult[];
  total?: number;
  query: string;
  error?: string;
}

/**
 * CodexLens symbol search response
 */
export interface CodexLensSymbolSearchResponse {
  success: boolean;
  symbols: Array<{
    name: string;
    kind: string;
    path: string;
    line: number;
    [key: string]: unknown;
  }>;
  error?: string;
}

/**
 * CodexLens file search response (returns file paths only)
 */
export interface CodexLensFileSearchResponse {
  success: boolean;
  query?: string;
  count?: number;
  files: string[];
  error?: string;
}

/**
 * Perform content search using CodexLens
 */
export async function searchCodexLens(params: CodexLensSearchParams): Promise<CodexLensSearchResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append('query', params.query);
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.mode) queryParams.append('mode', params.mode);
  if (params.max_content_length) queryParams.append('max_content_length', String(params.max_content_length));
  if (params.extra_files_count) queryParams.append('extra_files_count', String(params.extra_files_count));

  return fetchApi<CodexLensSearchResponse>(`/api/codexlens/search?${queryParams.toString()}`);
}

/**
 * Perform file search using CodexLens
 */
export async function searchFilesCodexLens(params: CodexLensSearchParams): Promise<CodexLensFileSearchResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append('query', params.query);
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.mode) queryParams.append('mode', params.mode);
  if (params.max_content_length) queryParams.append('max_content_length', String(params.max_content_length));
  if (params.extra_files_count) queryParams.append('extra_files_count', String(params.extra_files_count));

  return fetchApi<CodexLensFileSearchResponse>(`/api/codexlens/search_files?${queryParams.toString()}`);
}

/**
 * Perform symbol search using CodexLens
 */
export async function searchSymbolCodexLens(params: Pick<CodexLensSearchParams, 'query' | 'limit'>): Promise<CodexLensSymbolSearchResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append('query', params.query);
  if (params.limit) queryParams.append('limit', String(params.limit));

  return fetchApi<CodexLensSymbolSearchResponse>(`/api/codexlens/symbol?${queryParams.toString()}`);
}

// ========== CodexLens LSP / Semantic Search API ==========

/**
 * CodexLens LSP status response
 */
export interface CodexLensLspStatusResponse {
  available: boolean;
  semantic_available: boolean;
  vector_index: boolean;
  project_count?: number;
  embeddings?: Record<string, unknown>;
  modes?: string[];
  strategies?: string[];
  error?: string;
}

/**
 * CodexLens semantic search params (Python API)
 */
export type CodexLensSemanticSearchMode = 'fusion' | 'vector' | 'structural';
export type CodexLensFusionStrategy = 'rrf' | 'staged' | 'binary' | 'hybrid' | 'dense_rerank';
export type CodexLensStagedStage2Mode = 'precomputed' | 'realtime' | 'static_global_graph';

export interface CodexLensSemanticSearchParams {
  query: string;
  path?: string;
  mode?: CodexLensSemanticSearchMode;
  fusion_strategy?: CodexLensFusionStrategy;
  staged_stage2_mode?: CodexLensStagedStage2Mode;
  vector_weight?: number;
  structural_weight?: number;
  keyword_weight?: number;
  kind_filter?: string[];
  limit?: number;
  include_match_reason?: boolean;
}

/**
 * CodexLens semantic search result
 */
export interface CodexLensSemanticSearchResult {
  name?: string;
  kind?: string;
  file_path?: string;
  score?: number;
  match_reason?: string;
  range?: { start_line: number; end_line: number };
  [key: string]: unknown;
}

/**
 * CodexLens semantic search response
 */
export interface CodexLensSemanticSearchResponse {
  success: boolean;
  results?: CodexLensSemanticSearchResult[];
  query?: string;
  mode?: string;
  fusion_strategy?: string;
  count?: number;
  error?: string;
}

/**
 * Fetch CodexLens LSP status
 */
export async function fetchCodexLensLspStatus(): Promise<CodexLensLspStatusResponse> {
  return fetchApi<CodexLensLspStatusResponse>('/api/codexlens/lsp/status');
}

/**
 * Start CodexLens LSP server
 */
export async function startCodexLensLsp(path?: string): Promise<{ success: boolean; message?: string; workspace_root?: string; error?: string }> {
  return fetchApi('/api/codexlens/lsp/start', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

/**
 * Stop CodexLens LSP server
 */
export async function stopCodexLensLsp(path?: string): Promise<{ success: boolean; message?: string; error?: string }> {
  return fetchApi('/api/codexlens/lsp/stop', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

/**
 * Restart CodexLens LSP server
 */
export async function restartCodexLensLsp(path?: string): Promise<{ success: boolean; message?: string; workspace_root?: string; error?: string }> {
  return fetchApi('/api/codexlens/lsp/restart', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

/**
 * Perform semantic search using CodexLens Python API
 */
export async function semanticSearchCodexLens(params: CodexLensSemanticSearchParams): Promise<CodexLensSemanticSearchResponse> {
  return fetchApi<CodexLensSemanticSearchResponse>('/api/codexlens/lsp/search', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ========== CodexLens Index Management API ==========

/**
 * Index operation type
 */
export type CodexLensIndexOperation = 'fts_full' | 'fts_incremental' | 'vector_full' | 'vector_incremental';

/**
 * CodexLens index entry
 */
export interface CodexLensIndex {
  id: string;
  path: string;
  indexPath: string;
  size: number;
  sizeFormatted: string;
  fileCount: number;
  dirCount: number;
  hasVectorIndex: boolean;
  hasNormalIndex: boolean;
  status: string;
  lastModified: string | null;
}

/**
 * CodexLens index list response
 */
export interface CodexLensIndexesResponse {
  success: boolean;
  indexDir: string;
  indexes: CodexLensIndex[];
  summary: {
    totalSize: number;
    totalSizeFormatted: string;
    vectorIndexCount: number;
    normalIndexCount: number;
    totalProjects?: number;
    totalFiles?: number;
    totalDirs?: number;
    indexSizeBytes?: number;
    indexSizeMb?: number;
    embeddings?: any;
    fullIndexDirSize?: number;
    fullIndexDirSizeFormatted?: string;
  };
  error?: string;
}

/**
 * CodexLens index operation request
 */
export interface CodexLensIndexOperationRequest {
  path: string;
  operation: CodexLensIndexOperation;
  indexType?: 'normal' | 'vector';
  embeddingModel?: string;
  embeddingBackend?: 'fastembed' | 'litellm';
  maxWorkers?: number;
}

/**
 * CodexLens index operation response
 */
export interface CodexLensIndexOperationResponse {
  success: boolean;
  message?: string;
  error?: string;
  result?: any;
  output?: string;
}

/**
 * CodexLens indexing status response
 */
export interface CodexLensIndexingStatusResponse {
  success: boolean;
  inProgress: boolean;
  error?: string;
}

/**
 * Fetch all CodexLens indexes
 */
export async function fetchCodexLensIndexes(): Promise<CodexLensIndexesResponse> {
  return fetchApi<CodexLensIndexesResponse>('/api/codexlens/indexes');
}

/**
 * Rebuild CodexLens index (full rebuild)
 * @param projectPath - Project path to index
 * @param options - Index options
 */
export async function rebuildCodexLensIndex(
  projectPath: string,
  options: {
    indexType?: 'normal' | 'vector';
    embeddingModel?: string;
    embeddingBackend?: 'fastembed' | 'litellm';
    maxWorkers?: number;
  } = {}
): Promise<CodexLensIndexOperationResponse> {
  return fetchApi<CodexLensIndexOperationResponse>('/api/codexlens/init', {
    method: 'POST',
    body: JSON.stringify({
      path: projectPath,
      indexType: options.indexType || 'vector',
      embeddingModel: options.embeddingModel || 'code',
      embeddingBackend: options.embeddingBackend || 'fastembed',
      maxWorkers: options.maxWorkers || 1
    }),
  });
}

/**
 * Incremental update CodexLens index
 * @param projectPath - Project path to update
 * @param options - Index options
 */
export async function updateCodexLensIndex(
  projectPath: string,
  options: {
    indexType?: 'normal' | 'vector';
    embeddingModel?: string;
    embeddingBackend?: 'fastembed' | 'litellm';
    maxWorkers?: number;
  } = {}
): Promise<CodexLensIndexOperationResponse> {
  return fetchApi<CodexLensIndexOperationResponse>('/api/codexlens/update', {
    method: 'POST',
    body: JSON.stringify({
      path: projectPath,
      indexType: options.indexType || 'vector',
      embeddingModel: options.embeddingModel || 'code',
      embeddingBackend: options.embeddingBackend || 'fastembed',
      maxWorkers: options.maxWorkers || 1
    }),
  });
}

/**
 * Cancel ongoing CodexLens indexing
 */
export async function cancelCodexLensIndexing(): Promise<{ success: boolean; error?: string }> {
  return fetchApi('/api/codexlens/cancel', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Check if CodexLens indexing is in progress
 */
export async function checkCodexLensIndexingStatus(): Promise<CodexLensIndexingStatusResponse> {
  return fetchApi<CodexLensIndexingStatusResponse>('/api/codexlens/indexing-status');
}

/**
 * Clean CodexLens indexes
 * @param options - Clean options
 */
export async function cleanCodexLensIndexes(options: {
  all?: boolean;
  path?: string;
} = {}): Promise<{ success: boolean; message?: string; error?: string }> {
  return fetchApi('/api/codexlens/clean', {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

// ========== CodexLens File Watcher API ==========

/**
 * CodexLens watcher status response
 */
export interface CodexLensWatcherStatusResponse {
  success: boolean;
  running: boolean;
  root_path: string;
  events_processed: number;
  start_time: string | null;
  uptime_seconds: number;
}

/**
 * Fetch CodexLens file watcher status
 */
export async function fetchCodexLensWatcherStatus(): Promise<CodexLensWatcherStatusResponse> {
  return fetchApi<CodexLensWatcherStatusResponse>('/api/codexlens/watch/status');
}

/**
 * Start CodexLens file watcher
 */
export async function startCodexLensWatcher(path?: string, debounceMs?: number): Promise<{ success: boolean; message?: string; path?: string; pid?: number; error?: string }> {
  return fetchApi('/api/codexlens/watch/start', {
    method: 'POST',
    body: JSON.stringify({ path, debounce_ms: debounceMs }),
  });
}

/**
 * Stop CodexLens file watcher
 */
export async function stopCodexLensWatcher(): Promise<{ success: boolean; message?: string; events_processed?: number; uptime_seconds?: number; error?: string }> {
  return fetchApi('/api/codexlens/watch/stop', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ========== LiteLLM API Settings API ==========

/**
 * Provider credential types
 */
export type ProviderType = 'openai' | 'anthropic' | 'custom';

/**
 * Advanced provider settings
 */
export interface ProviderAdvancedSettings {
  timeout?: number;
  maxRetries?: number;
  organization?: string;
  apiVersion?: string;
  customHeaders?: Record<string, string>;
  rpm?: number;
  tpm?: number;
  proxy?: string;
}

/**
 * Routing strategy types
 */
export type RoutingStrategy = 'simple-shuffle' | 'weighted' | 'latency-based' | 'cost-based' | 'least-busy';

/**
 * Individual API key entry
 */
export interface ApiKeyEntry {
  id: string;
  key: string;
  label?: string;
  weight?: number;
  enabled: boolean;
  healthStatus?: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck?: string;
  lastError?: string;
  lastLatencyMs?: number;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  intervalSeconds: number;
  cooldownSeconds: number;
  failureThreshold: number;
}

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  streaming?: boolean;
  functionCalling?: boolean;
  vision?: boolean;
  contextWindow?: number;
  embeddingDimension?: number;
  maxOutputTokens?: number;
}

/**
 * Model endpoint settings
 */
export interface ModelEndpointSettings {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  customHeaders?: Record<string, string>;
  cacheStrategy?: CacheStrategy;
}

/**
 * Model definition
 */
export interface ModelDefinition {
  id: string;
  name: string;
  type: 'llm' | 'embedding' | 'reranker';
  series: string;
  enabled: boolean;
  capabilities?: ModelCapabilities;
  endpointSettings?: ModelEndpointSettings;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Provider credential
 */
export interface ProviderCredential {
  id: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  apiBase?: string;
  enabled: boolean;
  advancedSettings?: ProviderAdvancedSettings;
  apiKeys?: ApiKeyEntry[];
  routingStrategy?: RoutingStrategy;
  healthCheck?: HealthCheckConfig;
  llmModels?: ModelDefinition[];
  embeddingModels?: ModelDefinition[];
  rerankerModels?: ModelDefinition[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Cache strategy
 */
export interface CacheStrategy {
  enabled: boolean;
  ttlMinutes: number;
  maxSizeKB: number;
  filePatterns: string[];
}

/**
 * Custom endpoint
 */
export interface CustomEndpoint {
  id: string;
  name: string;
  providerId: string;
  model: string;
  description?: string;
  cacheStrategy: CacheStrategy;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Global cache settings
 */
export interface GlobalCacheSettings {
  enabled: boolean;
  cacheDir: string;
  maxTotalSizeMB: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalSize: number;
  maxSize: number;
  entries: number;
}

/**
 * Model pool type
 */
export type ModelPoolType = 'embedding' | 'llm' | 'reranker';

/**
 * Model pool config
 */
export interface ModelPoolConfig {
  id: string;
  modelType: ModelPoolType;
  enabled: boolean;
  targetModel: string;
  strategy: 'round_robin' | 'latency_aware' | 'weighted_random';
  autoDiscover: boolean;
  excludedProviderIds?: string[];
  defaultCooldown: number;
  defaultMaxConcurrentPerKey: number;
  name?: string;
  description?: string;
}

/**
 * Provider for model pool discovery
 */
export interface DiscoveredProvider {
  providerId: string;
  providerName: string;
  models: string[];
}

/**
 * CLI settings mode
 */
export type CliSettingsMode = 'provider-based' | 'direct';

/**
 * CLI settings
 */
export interface CliSettings {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  mode: CliSettingsMode;
  providerId?: string;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ========== Provider Management ==========

/**
 * Fetch all providers
 */
export async function fetchProviders(): Promise<{ providers: ProviderCredential[]; count: number }> {
  return fetchApi('/api/litellm-api/providers');
}

/**
 * Create provider
 */
export async function createProvider(provider: Omit<ProviderCredential, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; provider: ProviderCredential }> {
  return fetchApi('/api/litellm-api/providers', {
    method: 'POST',
    body: JSON.stringify(provider),
  });
}

/**
 * Update provider
 */
export async function updateProvider(providerId: string, updates: Partial<Omit<ProviderCredential, 'id' | 'createdAt' | 'updatedAt'>>): Promise<{ success: boolean; provider: ProviderCredential }> {
  return fetchApi(`/api/litellm-api/providers/${encodeURIComponent(providerId)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete provider
 */
export async function deleteProvider(providerId: string): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/api/litellm-api/providers/${encodeURIComponent(providerId)}`, {
    method: 'DELETE',
  });
}

/**
 * Test provider connection
 */
export async function testProvider(providerId: string): Promise<{ success: boolean; provider: string; latencyMs?: number; error?: string }> {
  return fetchApi(`/api/litellm-api/providers/${encodeURIComponent(providerId)}/test`, {
    method: 'POST',
  });
}

/**
 * Test specific API key
 */
export async function testProviderKey(providerId: string, keyId: string): Promise<{ valid: boolean; error?: string; latencyMs?: number; keyLabel?: string }> {
  return fetchApi(`/api/litellm-api/providers/${encodeURIComponent(providerId)}/test-key`, {
    method: 'POST',
    body: JSON.stringify({ keyId }),
  });
}

/**
 * Get provider health status
 */
export async function getProviderHealthStatus(providerId: string): Promise<{ providerId: string; providerName: string; keys: Array<{ keyId: string; label: string; status: string; lastCheck?: string; lastLatencyMs?: number; consecutiveFailures?: number; inCooldown?: boolean; lastError?: string }> }> {
  return fetchApi(`/api/litellm-api/providers/${encodeURIComponent(providerId)}/health-status`);
}

/**
 * Trigger health check now
 */
export async function triggerProviderHealthCheck(providerId: string): Promise<{ success: boolean; providerId: string; providerName?: string; keys: Array<any>; checkedAt: string }> {
  return fetchApi(`/api/litellm-api/providers/${encodeURIComponent(providerId)}/health-check-now`, {
    method: 'POST',
  });
}

// ========== Endpoint Management ==========

/**
 * Fetch all endpoints
 */
export async function fetchEndpoints(): Promise<{ endpoints: CustomEndpoint[]; count: number }> {
  return fetchApi('/api/litellm-api/endpoints');
}

/**
 * Create endpoint
 */
export async function createEndpoint(endpoint: Omit<CustomEndpoint, 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; endpoint: CustomEndpoint }> {
  return fetchApi('/api/litellm-api/endpoints', {
    method: 'POST',
    body: JSON.stringify(endpoint),
  });
}

/**
 * Update endpoint
 */
export async function updateEndpoint(endpointId: string, updates: Partial<Omit<CustomEndpoint, 'id' | 'createdAt' | 'updatedAt'>>): Promise<{ success: boolean; endpoint: CustomEndpoint }> {
  return fetchApi(`/api/litellm-api/endpoints/${encodeURIComponent(endpointId)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete endpoint
 */
export async function deleteEndpoint(endpointId: string): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/api/litellm-api/endpoints/${encodeURIComponent(endpointId)}`, {
    method: 'DELETE',
  });
}

// ========== Model Discovery ==========

/**
 * Get available models for provider type
 */
export async function getProviderModels(providerType: string): Promise<{ providerType: string; models: Array<{ id: string; name: string; provider: string; description?: string }>; count: number }> {
  return fetchApi(`/api/litellm-api/models/${encodeURIComponent(providerType)}`);
}

// ========== Cache Management ==========

/**
 * Fetch cache statistics
 */
export async function fetchCacheStats(): Promise<CacheStats> {
  return fetchApi('/api/litellm-api/cache/stats');
}

/**
 * Clear cache
 */
export async function clearCache(): Promise<{ success: boolean; removed: number }> {
  return fetchApi('/api/litellm-api/cache/clear', {
    method: 'POST',
  });
}

/**
 * Update cache settings
 */
export async function updateCacheSettings(settings: Partial<{ enabled: boolean; cacheDir: string; maxTotalSizeMB: number }>): Promise<{ success: boolean; settings: GlobalCacheSettings }> {
  return fetchApi('/api/litellm-api/config/cache', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// ========== Model Pool Management ==========

/**
 * Fetch all model pools
 */
export async function fetchModelPools(): Promise<{ pools: ModelPoolConfig[] }> {
  return fetchApi('/api/litellm-api/model-pools');
}

/**
 * Fetch single model pool
 */
export async function fetchModelPool(poolId: string): Promise<{ pool: ModelPoolConfig }> {
  return fetchApi(`/api/litellm-api/model-pools/${encodeURIComponent(poolId)}`);
}

/**
 * Create model pool
 */
export async function createModelPool(pool: Omit<ModelPoolConfig, 'id'>): Promise<{ success: boolean; poolId: string; syncResult?: any }> {
  return fetchApi('/api/litellm-api/model-pools', {
    method: 'POST',
    body: JSON.stringify(pool),
  });
}

/**
 * Update model pool
 */
export async function updateModelPool(poolId: string, updates: Partial<ModelPoolConfig>): Promise<{ success: boolean; poolId?: string; syncResult?: any }> {
  return fetchApi(`/api/litellm-api/model-pools/${encodeURIComponent(poolId)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete model pool
 */
export async function deleteModelPool(poolId: string): Promise<{ success: boolean; syncResult?: any }> {
  return fetchApi(`/api/litellm-api/model-pools/${encodeURIComponent(poolId)}`, {
    method: 'DELETE',
  });
}

/**
 * Get available models for pool type
 */
export async function getAvailableModelsForPool(modelType: ModelPoolType): Promise<{ availableModels: Array<{ modelId: string; modelName: string; providers: string[] }> }> {
  return fetchApi(`/api/litellm-api/model-pools/available-models/${encodeURIComponent(modelType)}`);
}

/**
 * Discover providers for model
 */
export async function discoverModelsForPool(modelType: ModelPoolType, targetModel: string): Promise<{ modelType: string; targetModel: string; discovered: DiscoveredProvider[]; count: number }> {
  return fetchApi(`/api/litellm-api/model-pools/discover/${encodeURIComponent(modelType)}/${encodeURIComponent(targetModel)}`);
}

// ========== Config Management ==========

/**
 * Get full config
 */
export async function fetchApiConfig(): Promise<any> {
  return fetchApi('/api/litellm-api/config');
}

/**
 * Sync config to YAML
 */
export async function syncApiConfig(): Promise<{ success: boolean; message: string; yamlPath?: string }> {
  return fetchApi('/api/litellm-api/config/sync', {
    method: 'POST',
  });
}

/**
 * Preview YAML config
 */
export async function previewYamlConfig(): Promise<{ success: boolean; config: string }> {
  return fetchApi('/api/litellm-api/config/yaml-preview');
}

// ========== CCW-LiteLLM Package Management ==========

/**
 * Check ccw-litellm status
 */
export async function checkCcwLitellmStatus(refresh = false): Promise<{ installed: boolean; version?: string; error?: string }> {
  return fetchApi(`/api/litellm-api/ccw-litellm/status${refresh ? '?refresh=true' : ''}`);
}

/**
 * Install ccw-litellm
 */
export async function installCcwLitellm(): Promise<{ success: boolean; message?: string; error?: string; path?: string }> {
  return fetchApi('/api/litellm-api/ccw-litellm/install', {
    method: 'POST',
  });
}

/**
 * Uninstall ccw-litellm
 */
export async function uninstallCcwLitellm(): Promise<{ success: boolean; message?: string; error?: string }> {
  return fetchApi('/api/litellm-api/ccw-litellm/uninstall', {
    method: 'POST',
  });
}

// ========== CLI Settings Management ==========

/**
 * CLI Settings (Claude CLI endpoint configuration)
 * Maps to backend EndpointSettings from /api/cli/settings
 */
export interface CliSettingsEndpoint {
  id: string;
  name: string;
  description?: string;
  settings: {
    env: {
      ANTHROPIC_AUTH_TOKEN?: string;
      ANTHROPIC_BASE_URL?: string;
      DISABLE_AUTOUPDATER?: string;
      [key: string]: string | undefined;
    };
    model?: string;
    includeCoAuthoredBy?: boolean;
    settingsFile?: string;
    availableModels?: string[];
    tags?: string[];
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * CLI Settings list response
 */
export interface CliSettingsListResponse {
  endpoints: CliSettingsEndpoint[];
  total: number;
}

/**
 * Save CLI Settings request
 */
export interface SaveCliSettingsRequest {
  id?: string;
  name: string;
  description?: string;
  settings: {
    env: {
      ANTHROPIC_AUTH_TOKEN?: string;
      ANTHROPIC_BASE_URL?: string;
      DISABLE_AUTOUPDATER?: string;
      [key: string]: string | undefined;
    };
    model?: string;
    includeCoAuthoredBy?: boolean;
    settingsFile?: string;
    availableModels?: string[];
    tags?: string[];
  };
  enabled?: boolean;
}

/**
 * Fetch all CLI settings endpoints
 */
export async function fetchCliSettings(): Promise<CliSettingsListResponse> {
  return fetchApi('/api/cli/settings');
}

/**
 * Fetch single CLI settings endpoint
 */
export async function fetchCliSettingsEndpoint(endpointId: string): Promise<{ endpoint: CliSettingsEndpoint; filePath?: string }> {
  return fetchApi(`/api/cli/settings/${encodeURIComponent(endpointId)}`);
}

/**
 * Create CLI settings endpoint
 */
export async function createCliSettings(request: SaveCliSettingsRequest): Promise<{ success: boolean; endpoint?: CliSettingsEndpoint; filePath?: string; message?: string }> {
  return fetchApi('/api/cli/settings', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Update CLI settings endpoint
 */
export async function updateCliSettings(endpointId: string, request: Partial<SaveCliSettingsRequest>): Promise<{ success: boolean; endpoint?: CliSettingsEndpoint; message?: string }> {
  return fetchApi(`/api/cli/settings/${encodeURIComponent(endpointId)}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

/**
 * Delete CLI settings endpoint
 */
export async function deleteCliSettings(endpointId: string): Promise<{ success: boolean; message?: string }> {
  return fetchApi(`/api/cli/settings/${encodeURIComponent(endpointId)}`, {
    method: 'DELETE',
  });
}

/**
 * Toggle CLI settings enabled status
 */
export async function toggleCliSettingsEnabled(endpointId: string, enabled: boolean): Promise<{ success: boolean; message?: string }> {
  return fetchApi(`/api/cli/settings/${encodeURIComponent(endpointId)}`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

/**
 * Get CLI settings file path
 */
export async function getCliSettingsPath(endpointId: string): Promise<{ endpointId: string; filePath: string; enabled: boolean }> {
  return fetchApi(`/api/cli/settings/${encodeURIComponent(endpointId)}/path`);
}

// ========== Orchestrator Execution Monitoring API ==========

/**
 * Execution state response from orchestrator
 */
export interface ExecutionStateResponse {
  execId: string;
  flowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentNodeId?: string;
  startedAt: string;
  completedAt?: string;
  elapsedMs: number;
}

/**
 * Coordinator pipeline details response
 */
export interface CoordinatorPipelineDetails {
  id: string;
  name: string;
  description?: string;
  nodes: Array<{
    id: string;
    name: string;
    description?: string;
    command: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: string;
    completedAt?: string;
    result?: unknown;
    error?: string;
    output?: string;
    parentId?: string;
    children?: Array<any>;
  }>;
  totalSteps: number;
  estimatedDuration?: number;
  logs?: Array<{
    id: string;
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug' | 'success';
    message: string;
    nodeId?: string;
    source?: 'system' | 'node' | 'user';
  }>;
  status: 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
}

/**
 * Execution log entry
 */
export interface ExecutionLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  nodeId?: string;
  message: string;
}

/**
 * Execution logs response
 */
export interface ExecutionLogsResponse {
  execId: string;
  logs: ExecutionLogEntry[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ========== Orchestrator Flow API (Create/Execute) ==========

export interface OrchestratorFlowDto {
  id: string;
  name: string;
  description?: string;
  version: string;
  created_at: string;
  updated_at: string;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  variables: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface CreateOrchestratorFlowRequest {
  name: string;
  description?: string;
  version?: string;
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
  variables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function createOrchestratorFlow(
  request: CreateOrchestratorFlowRequest,
  projectPath?: string
): Promise<{ success: boolean; data: OrchestratorFlowDto }> {
  return fetchApi(withPath('/api/orchestrator/flows', projectPath), {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function executeOrchestratorFlow(
  flowId: string,
  request?: { variables?: Record<string, unknown> },
  projectPath?: string
): Promise<{ success: boolean; data: { execId: string; flowId: string; status: string; startedAt: string } }> {
  return fetchApi(withPath(`/api/orchestrator/flows/${encodeURIComponent(flowId)}/execute`, projectPath), {
    method: 'POST',
    body: JSON.stringify(request ?? {}),
  });
}

/**
 * Fetch execution state by execId
 * @param execId - Execution ID
 */
export async function fetchExecutionState(execId: string): Promise<{ success: boolean; data: ExecutionStateResponse }> {
  return fetchApi(`/api/orchestrator/executions/${encodeURIComponent(execId)}`);
}

/**
 * Fetch coordinator pipeline details by execution ID
 * @param execId - Execution/Pipeline ID
 */
export async function fetchCoordinatorPipeline(execId: string): Promise<{ success: boolean; data: CoordinatorPipelineDetails }> {
  return fetchApi(`/api/coordinator/pipeline/${encodeURIComponent(execId)}`);
}

/**
 * Fetch execution logs with pagination and filtering
 * @param execId - Execution ID
 * @param options - Query options
 */
export async function fetchExecutionLogs(
  execId: string,
  options?: {
    limit?: number;
    offset?: number;
    level?: 'info' | 'warn' | 'error' | 'debug';
    nodeId?: string;
  }
): Promise<{ success: boolean; data: ExecutionLogsResponse }> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.offset) params.append('offset', String(options.offset));
  if (options?.level) params.append('level', options.level);
  if (options?.nodeId) params.append('nodeId', options.nodeId);

  const queryString = params.toString();
  return fetchApi(`/api/orchestrator/executions/${encodeURIComponent(execId)}/logs${queryString ? `?${queryString}` : ''}`);
}

// ========== System Settings API ==========

/**
 * Chinese response setting status
 */
export interface ChineseResponseStatus {
  enabled: boolean;
  claudeEnabled: boolean;
  codexEnabled: boolean;
  codexNeedsMigration: boolean;
  guidelinesPath: string;
  guidelinesExists: boolean;
  userClaudeMdExists: boolean;
  userCodexAgentsExists: boolean;
}

/**
 * Fetch Chinese response setting status
 */
export async function fetchChineseResponseStatus(): Promise<ChineseResponseStatus> {
  return fetchApi('/api/language/chinese-response');
}

/**
 * Toggle Chinese response setting
 */
export async function toggleChineseResponse(
  enabled: boolean,
  target: 'claude' | 'codex' = 'claude'
): Promise<{ success: boolean; enabled: boolean; target: string }> {
  return fetchApi('/api/language/chinese-response', {
    method: 'POST',
    body: JSON.stringify({ enabled, target }),
  });
}

/**
 * Windows platform setting status
 */
export interface WindowsPlatformStatus {
  enabled: boolean;
  guidelinesPath: string;
  guidelinesExists: boolean;
  userClaudeMdExists: boolean;
}

/**
 * Fetch Windows platform setting status
 */
export async function fetchWindowsPlatformStatus(): Promise<WindowsPlatformStatus> {
  return fetchApi('/api/language/windows-platform');
}

/**
 * Toggle Windows platform setting
 */
export async function toggleWindowsPlatform(
  enabled: boolean
): Promise<{ success: boolean; enabled: boolean }> {
  return fetchApi('/api/language/windows-platform', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

/**
 * Codex CLI Enhancement setting status
 */
export interface CodexCliEnhancementStatus {
  enabled: boolean;
  guidelinesPath: string;
  guidelinesExists: boolean;
  userCodexAgentsExists: boolean;
}

/**
 * Fetch Codex CLI Enhancement setting status
 */
export async function fetchCodexCliEnhancementStatus(): Promise<CodexCliEnhancementStatus> {
  return fetchApi('/api/language/codex-cli-enhancement');
}

/**
 * Toggle Codex CLI Enhancement setting
 */
export async function toggleCodexCliEnhancement(
  enabled: boolean
): Promise<{ success: boolean; enabled: boolean }> {
  return fetchApi('/api/language/codex-cli-enhancement', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

/**
 * Refresh Codex CLI Enhancement content
 */
export async function refreshCodexCliEnhancement(): Promise<{ success: boolean; refreshed: boolean }> {
  return fetchApi('/api/language/codex-cli-enhancement', {
    method: 'POST',
    body: JSON.stringify({ action: 'refresh' }),
  });
}

/**
 * CCW Install status
 */
export interface CcwInstallStatus {
  installed: boolean;
  workflowsInstalled: boolean;
  missingFiles: string[];
  installPath: string;
}

/**
 * Aggregated status response
 */
export interface AggregatedStatus {
  cli: Record<string, { available: boolean; path?: string; version?: string }>;
  codexLens: { ready: boolean };
  semantic: { available: boolean; backend: string | null };
  ccwInstall: CcwInstallStatus;
  timestamp: string;
}

/**
 * Fetch aggregated system status (includes CCW install status)
 */
export async function fetchAggregatedStatus(): Promise<AggregatedStatus> {
  return fetchApi('/api/status/all');
}

/**
 * Fetch CLI tool availability status
 */
export async function fetchCliToolStatus(): Promise<Record<string, { available: boolean; path?: string; version?: string }>> {
  return fetchApi('/api/cli/status');
}

/**
 * CCW Installation manifest
 */
export interface CcwInstallationManifest {
  manifest_id: string;
  version: string;
  installation_mode: string;
  installation_path: string;
  installation_date: string;
  installer_version: string;
  manifest_file: string;
  application_version: string;
  files_count: number;
  directories_count: number;
}

/**
 * Fetch CCW installation manifests
 */
export async function fetchCcwInstallations(): Promise<{ installations: CcwInstallationManifest[] }> {
  return fetchApi('/api/ccw/installations');
}

/**
 * Upgrade CCW installation
 */
export async function upgradeCcwInstallation(
  path?: string
): Promise<{ success: boolean; message?: string; error?: string; output?: string }> {
  return fetchApi('/api/ccw/upgrade', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

// ========== CCW Tools API ==========

/**
 * CCW tool info returned by /api/ccw/tools
 */
export interface CcwToolInfo {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

/**
 * Fetch all registered CCW tools
 */
export async function fetchCcwTools(): Promise<CcwToolInfo[]> {
  const data = await fetchApi<{ tools: CcwToolInfo[] }>('/api/ccw/tools');
  return data.tools;
}

// ========== Team API ==========

export async function fetchTeams(location?: string): Promise<{ teams: Array<{ name: string; messageCount: number; lastActivity: string; status: string; created_at: string; updated_at: string; archived_at?: string; pipeline_mode?: string; memberCount: number; members?: string[] }> }> {
  const params = new URLSearchParams();
  if (location) params.set('location', location);
  const qs = params.toString();
  return fetchApi(`/api/teams${qs ? `?${qs}` : ''}`);
}

export async function archiveTeam(teamName: string): Promise<{ success: boolean; team: string; status: string }> {
  return fetchApi(`/api/teams/${encodeURIComponent(teamName)}/archive`, { method: 'POST' });
}

export async function unarchiveTeam(teamName: string): Promise<{ success: boolean; team: string; status: string }> {
  return fetchApi(`/api/teams/${encodeURIComponent(teamName)}/unarchive`, { method: 'POST' });
}

export async function deleteTeam(teamName: string): Promise<void> {
  return fetchApi<void>(`/api/teams/${encodeURIComponent(teamName)}`, { method: 'DELETE' });
}

export async function fetchTeamMessages(
  teamName: string,
  params?: { from?: string; to?: string; type?: string; last?: number; offset?: number }
): Promise<{ total: number; showing: number; messages: Array<Record<string, unknown>> }> {
  const searchParams = new URLSearchParams();
  if (params?.from) searchParams.set('from', params.from);
  if (params?.to) searchParams.set('to', params.to);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.last) searchParams.set('last', String(params.last));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const qs = searchParams.toString();
  return fetchApi(`/api/teams/${encodeURIComponent(teamName)}/messages${qs ? `?${qs}` : ''}`);
}

export async function fetchTeamStatus(
  teamName: string
): Promise<{ members: Array<{ member: string; lastSeen: string; lastAction: string; messageCount: number }>; total_messages: number }> {
  return fetchApi(`/api/teams/${encodeURIComponent(teamName)}/status`);
}

export async function fetchTeamArtifacts(
  teamName: string
): Promise<TeamArtifactsResponse> {
  return fetchApi(`/api/teams/${encodeURIComponent(teamName)}/artifacts`);
}

export async function fetchArtifactContent(
  teamName: string,
  artifactPath: string
): Promise<{ content: string; contentType: string; path: string }> {
  return fetchApi(`/api/teams/${encodeURIComponent(teamName)}/artifacts/${encodeURIComponent(artifactPath)}`);
}

// ========== CLI Sessions (PTY) API ==========

export interface CliSession {
  sessionKey: string;
  shellKind: string;
  workingDir: string;
  tool?: string;
  model?: string;
  resumeKey?: string;
  createdAt: string;
  updatedAt: string;
  isPaused: boolean;
  /** When set, this session is a native CLI interactive process. */
  cliTool?: string;
}

export interface CreateCliSessionInput {
  workingDir?: string;
  cols?: number;
  rows?: number;
  /** Shell to use for spawning CLI tools on Windows. */
  preferredShell?: 'bash' | 'pwsh' | 'cmd';
  tool?: string;
  model?: string;
  resumeKey?: string;
  /** Launch mode for native CLI sessions (default or yolo). */
  launchMode?: 'default' | 'yolo';
}

function withPath(url: string, projectPath?: string): string {
  if (!projectPath) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}path=${encodeURIComponent(projectPath)}`;
}

export async function fetchCliSessions(projectPath?: string): Promise<{ sessions: CliSession[] }> {
  return fetchApi<{ sessions: CliSession[] }>(withPath('/api/cli-sessions', projectPath));
}

export async function createCliSession(
  input: CreateCliSessionInput,
  projectPath?: string
): Promise<{ success: boolean; session: CliSession }> {
  return fetchApi<{ success: boolean; session: CliSession }>(withPath('/api/cli-sessions', projectPath), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchCliSessionBuffer(
  sessionKey: string,
  projectPath?: string
): Promise<{ session: CliSession; buffer: string }> {
  return fetchApi<{ session: CliSession; buffer: string }>(
    withPath(`/api/cli-sessions/${encodeURIComponent(sessionKey)}/buffer`, projectPath)
  );
}

export async function sendCliSessionText(
  sessionKey: string,
  input: { text: string; appendNewline?: boolean },
  projectPath?: string
): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(withPath(`/api/cli-sessions/${encodeURIComponent(sessionKey)}/send`, projectPath), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface ExecuteInCliSessionInput {
  tool: string;
  prompt: string;
  mode?: 'analysis' | 'write' | 'auto';
  model?: string;
  workingDir?: string;
  category?: 'user' | 'internal' | 'insight';
  resumeKey?: string;
  resumeStrategy?: 'nativeResume' | 'promptConcat';
  instructionType?: 'prompt' | 'skill' | 'command';
  skillName?: string;
}

export async function executeInCliSession(
  sessionKey: string,
  input: ExecuteInCliSessionInput,
  projectPath?: string
): Promise<{ success: boolean; executionId: string; command: string }> {
  return fetchApi<{ success: boolean; executionId: string; command: string }>(
    withPath(`/api/cli-sessions/${encodeURIComponent(sessionKey)}/execute`, projectPath),
    { method: 'POST', body: JSON.stringify(input) }
  );
}

export async function resizeCliSession(
  sessionKey: string,
  input: { cols: number; rows: number },
  projectPath?: string
): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(withPath(`/api/cli-sessions/${encodeURIComponent(sessionKey)}/resize`, projectPath), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function closeCliSession(sessionKey: string, projectPath?: string): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(withPath(`/api/cli-sessions/${encodeURIComponent(sessionKey)}/close`, projectPath), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function pauseCliSession(sessionKey: string, projectPath?: string): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(withPath(`/api/cli-sessions/${encodeURIComponent(sessionKey)}/pause`, projectPath), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function resumeCliSession(sessionKey: string, projectPath?: string): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(withPath(`/api/cli-sessions/${encodeURIComponent(sessionKey)}/resume`, projectPath), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function createCliSessionShareToken(
  sessionKey: string,
  input: { mode?: 'read' | 'write'; ttlMs?: number },
  projectPath?: string
): Promise<{ success: boolean; shareToken: string; expiresAt: string; mode: 'read' | 'write' }> {
  return fetchApi<{ success: boolean; shareToken: string; expiresAt: string; mode: 'read' | 'write' }>(
    withPath(`/api/cli-sessions/${encodeURIComponent(sessionKey)}/share`, projectPath),
    { method: 'POST', body: JSON.stringify(input) }
  );
}

export async function fetchCliSessionShares(
  sessionKey: string,
  projectPath?: string
): Promise<{ shares: Array<{ shareToken: string; expiresAt: string; mode: 'read' | 'write' }> }> {
  return fetchApi<{ shares: Array<{ shareToken: string; expiresAt: string; mode: 'read' | 'write' }> }>(
    withPath(`/api/cli-sessions/${encodeURIComponent(sessionKey)}/shares`, projectPath)
  );
}

export async function revokeCliSessionShareToken(
  sessionKey: string,
  input: { shareToken: string },
  projectPath?: string
): Promise<{ success: boolean; revoked: boolean }> {
  return fetchApi<{ success: boolean; revoked: boolean }>(
    withPath(`/api/cli-sessions/${encodeURIComponent(sessionKey)}/share/revoke`, projectPath),
    { method: 'POST', body: JSON.stringify(input) }
  );
}

// ========== Audit (Observability) API ==========

export type CliSessionAuditEventType =
  | 'session_created'
  | 'session_closed'
  | 'session_send'
  | 'session_execute'
  | 'session_resize'
  | 'session_share_created'
  | 'session_share_revoked'
  | 'session_idle_reaped';

export interface CliSessionAuditEvent {
  type: CliSessionAuditEventType;
  timestamp: string;
  projectRoot: string;
  sessionKey?: string;
  tool?: string;
  resumeKey?: string;
  workingDir?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

export interface CliSessionAuditListResponse {
  events: CliSessionAuditEvent[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export async function fetchCliSessionAudit(
  options?: {
    projectPath?: string;
    sessionKey?: string;
    type?: CliSessionAuditEventType | CliSessionAuditEventType[];
    q?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ success: boolean; data: CliSessionAuditListResponse }> {
  const params = new URLSearchParams();
  if (options?.sessionKey) params.set('sessionKey', options.sessionKey);
  if (options?.q) params.set('q', options.q);
  if (typeof options?.limit === 'number') params.set('limit', String(options.limit));
  if (typeof options?.offset === 'number') params.set('offset', String(options.offset));
  if (options?.type) {
    const types = Array.isArray(options.type) ? options.type : [options.type];
    params.set('type', types.join(','));
  }

  const queryString = params.toString();
  return fetchApi<{ success: boolean; data: CliSessionAuditListResponse }>(
    withPath(`/api/audit/cli-sessions${queryString ? `?${queryString}` : ''}`, options?.projectPath)
  );
}

// ========== Unified Memory API ==========

export interface UnifiedSearchResult {
  source_id: string;
  source_type: string;
  score: number;
  content: string;
  category: string;
  rank_sources: {
    vector_rank?: number;
    vector_score?: number;
    fts_rank?: number;
    heat_score?: number;
  };
}

export interface UnifiedSearchResponse {
  success: boolean;
  query: string;
  total: number;
  results: UnifiedSearchResult[];
}

export interface UnifiedMemoryStats {
  core_memories: {
    total: number;
    archived: number;
  };
  stage1_outputs: number;
  entities: number;
  prompts: number;
  conversations: number;
  vector_index: {
    available: boolean;
    total_chunks: number;
    hnsw_available: boolean;
    hnsw_count: number;
    dimension: number;
    categories?: Record<string, number>;
  };
}

export interface RecommendationResult {
  source_id: string;
  source_type: string;
  score: number;
  content: string;
  category: string;
}

export interface ReindexResponse {
  success: boolean;
  hnsw_count?: number;
  elapsed_time?: number;
  error?: string;
}

/**
 * Search unified memory using vector + FTS5 fusion (RRF)
 * @param query - Search query text
 * @param options - Search options (topK, minScore, category)
 * @param projectPath - Optional project path for workspace isolation
 */
export async function fetchUnifiedSearch(
  query: string,
  options?: {
    topK?: number;
    minScore?: number;
    category?: string;
  },
  projectPath?: string
): Promise<UnifiedSearchResponse> {
  const params = new URLSearchParams();
  params.set('q', query);
  if (options?.topK) params.set('topK', String(options.topK));
  if (options?.minScore) params.set('minScore', String(options.minScore));
  if (options?.category) params.set('category', options.category);

  const data = await fetchApi<UnifiedSearchResponse & { error?: string }>(
    withPath(`/api/unified-memory/search?${params.toString()}`, projectPath)
  );
  if (data.success === false) {
    throw new Error(data.error || 'Search failed');
  }
  return data;
}

/**
 * Fetch unified memory statistics (core memories, entities, vectors, etc.)
 * @param projectPath - Optional project path for workspace isolation
 */
export async function fetchUnifiedStats(
  projectPath?: string
): Promise<{ success: boolean; stats: UnifiedMemoryStats }> {
  const data = await fetchApi<{ success: boolean; stats: UnifiedMemoryStats; error?: string }>(
    withPath('/api/unified-memory/stats', projectPath)
  );
  if (data.success === false) {
    throw new Error(data.error || 'Failed to load unified stats');
  }
  return data;
}

/**
 * Get KNN-based recommendations for a specific memory
 * @param memoryId - Core memory ID (CMEM-*)
 * @param limit - Number of recommendations (default: 5)
 * @param projectPath - Optional project path for workspace isolation
 */
export async function fetchRecommendations(
  memoryId: string,
  limit?: number,
  projectPath?: string
): Promise<{ success: boolean; memory_id: string; total: number; recommendations: RecommendationResult[] }> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  const queryString = params.toString();

  const data = await fetchApi<{ success: boolean; memory_id: string; total: number; recommendations: RecommendationResult[]; error?: string }>(
    withPath(
      `/api/unified-memory/recommendations/${encodeURIComponent(memoryId)}${queryString ? `?${queryString}` : ''}`,
      projectPath
    )
  );
  if (data.success === false) {
    throw new Error(data.error || 'Failed to load recommendations');
  }
  return data;
}

/**
 * Trigger vector index rebuild
 * @param projectPath - Optional project path for workspace isolation
 */
export async function triggerReindex(
  projectPath?: string
): Promise<ReindexResponse> {
  return fetchApi<ReindexResponse>(
    '/api/unified-memory/reindex',
    {
      method: 'POST',
      body: JSON.stringify({ path: projectPath }),
    }
  );
}
