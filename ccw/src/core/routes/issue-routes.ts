/**
 * Issue Routes Module (Optimized - Flat JSONL Storage)
 *
 * Storage Structure:
 * .workflow/issues/
 * ├── issues.jsonl              # All issues (one per line)
 * ├── queues/                   # Queue history directory
 * │   ├── index.json            # Queue index (active + history)
 * │   └── {queue-id}.json       # Individual queue files
 * ├── solutions/
 * │   ├── {issue-id}.jsonl      # Solutions for issue (one per line)
 * │   └── ...
 * └── attachments/
 *     └── {issue-id}/           # Attachments for issue
 *         └── {filename}        # Uploaded files
 *
 * API Endpoints:
 * - GET    /api/issues              - List all issues
 * - POST   /api/issues              - Create new issue (with Zod validation)
 * - GET    /api/issues/:id          - Get issue detail
 * - PATCH  /api/issues/:id          - Update issue (includes binding logic)
 * - DELETE /api/issues/:id          - Delete issue
 * - POST   /api/issues/:id/solutions - Add solution
 * - PATCH  /api/issues/:id/tasks/:taskId - Update task
 * - GET    /api/queue               - Get execution queue
 * - POST   /api/queue/reorder       - Reorder queue items
 * - POST   /api/issues/:id/attachments - Upload attachment (multipart/form-data)
 * - GET    /api/issues/:id/attachments - List attachments
 * - DELETE /api/issues/:id/attachments/:attachmentId - Delete attachment
 * - GET    /api/issues/files/:issueId/:filename - Download file
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, unlinkSync, createReadStream, statSync } from 'fs';
import { join, resolve, normalize, basename } from 'path';
import { randomUUID } from 'crypto';
import type { RouteContext } from './types.js';
import {
  processCreateIssueRequest,
  generateIssueId,
  type CreateIssueResult,
} from '../services/issue-service.js';
import type { Issue, Attachment } from '../types/issue.js';

// ========== JSONL Helper Functions ==========

function readIssuesJsonl(issuesDir: string): any[] {
  const issuesPath = join(issuesDir, 'issues.jsonl');
  if (!existsSync(issuesPath)) return [];
  try {
    const content = readFileSync(issuesPath, 'utf8');
    return content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function writeIssuesJsonl(issuesDir: string, issues: any[]) {
  if (!existsSync(issuesDir)) mkdirSync(issuesDir, { recursive: true });
  const issuesPath = join(issuesDir, 'issues.jsonl');
  writeFileSync(issuesPath, issues.map(i => JSON.stringify(i)).join('\n'));
}

function readSolutionsJsonl(issuesDir: string, issueId: string): any[] {
  const solutionsPath = join(issuesDir, 'solutions', `${issueId}.jsonl`);
  if (!existsSync(solutionsPath)) return [];
  try {
    const content = readFileSync(solutionsPath, 'utf8');
    return content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function readIssueHistoryJsonl(issuesDir: string): any[] {
  const historyPath = join(issuesDir, 'issue-history.jsonl');
  if (!existsSync(historyPath)) return [];
  try {
    const content = readFileSync(historyPath, 'utf8');
    return content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function writeIssueHistoryJsonl(issuesDir: string, issues: any[]) {
  if (!existsSync(issuesDir)) mkdirSync(issuesDir, { recursive: true });
  const historyPath = join(issuesDir, 'issue-history.jsonl');
  writeFileSync(historyPath, issues.map(i => JSON.stringify(i)).join('\n'));
}

function writeSolutionsJsonl(issuesDir: string, issueId: string, solutions: any[]) {
  const solutionsDir = join(issuesDir, 'solutions');
  if (!existsSync(solutionsDir)) mkdirSync(solutionsDir, { recursive: true });
  writeFileSync(join(solutionsDir, `${issueId}.jsonl`), solutions.map(s => JSON.stringify(s)).join('\n'));
}

function generateQueueFileId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `QUE-${ts}`;
}

// ========== Attachment Helper Functions ==========

const ALLOWED_MIME_TYPES = [
  // Images
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf',
  'text/plain', 'text/markdown', 'text/csv',
  // Code files
  'application/json', 'text/javascript', 'text/typescript', 'text/html', 'text/css',
  'application/xml', 'text/xml',
  // Archives
  'application/zip', 'application/x-gzip',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getAttachmentsDir(issuesDir: string, issueId: string): string {
  return join(issuesDir, 'attachments', issueId);
}

function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts and invalid characters
  const sanitized = basename(filename)
    .replace(/[<>:"|?*\x00-\x1f]/g, '')
    .replace(/\.\./g, '');
  // Add timestamp prefix to prevent collisions
  const ext = sanitized.includes('.') ? `.${sanitized.split('.').pop()}` : '';
  const base = ext ? sanitized.slice(0, -(ext.length)) : sanitized;
  return `${Date.now()}-${base}${ext}`;
}

function isValidMimeType(mimeType: string): boolean {
  // Allow common code file types that might not have standard MIME types
  const additionalTypes = [
    'application/octet-stream', // Generic binary, often used for various file types
  ];
  return ALLOWED_MIME_TYPES.includes(mimeType) || additionalTypes.includes(mimeType);
}

function parseMultipartFormData(req: any): Promise<{ fields: Record<string, string>; files: Array<{ name: string; data: Buffer; filename: string; type: string }> }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const boundary = req.headers['content-type']?.match(/boundary=(.+)/)?.[1];
        if (!boundary) {
          reject(new Error('No boundary in content-type'));
          return;
        }

        const buffer = Buffer.concat(chunks);
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        const fields: Record<string, string> = {};
        const files: Array<{ name: string; data: Buffer; filename: string; type: string }> = [];

        // Split by boundary
        let start = 0;
        while (start < buffer.length) {
          const boundaryIndex = buffer.indexOf(boundaryBuffer, start);
          if (boundaryIndex === -1) break;

          const nextBoundary = buffer.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
          if (nextBoundary === -1) break;

          const part = buffer.slice(boundaryIndex + boundaryBuffer.length + 2, nextBoundary - 2); // +2 for \r\n, -2 for \r\n before boundary

          // Parse headers
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) {
            start = nextBoundary;
            continue;
          }

          const headers = part.slice(0, headerEnd).toString();
          const content = part.slice(headerEnd + 4);

          // Extract content-disposition
          const nameMatch = headers.match(/name="([^"]+)"/);
          const filenameMatch = headers.match(/filename="([^"]+)"/);
          const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);

          if (nameMatch) {
            const name = nameMatch[1];
            if (filenameMatch) {
              // It's a file
              files.push({
                name,
                data: content,
                filename: filenameMatch[1],
                type: contentTypeMatch?.[1] || 'application/octet-stream',
              });
            } else {
              // It's a field
              fields[name] = content.toString().replace(/\r\n$/, '');
            }
          }

          start = nextBoundary;
        }

        resolve({ fields, files });
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function readQueue(issuesDir: string) {
  // Try new multi-queue structure first
  const queuesDir = join(issuesDir, 'queues');
  const indexPath = join(queuesDir, 'index.json');

  if (existsSync(indexPath)) {
    try {
      const index = JSON.parse(readFileSync(indexPath, 'utf8'));
      const activeQueueId = index.active_queue_id;

      if (activeQueueId) {
        const queueFilePath = join(queuesDir, `${activeQueueId}.json`);
        if (existsSync(queueFilePath)) {
          return JSON.parse(readFileSync(queueFilePath, 'utf8'));
        }
      }
    } catch {
      // Fall through to legacy check
    }
  }

  // Fallback to legacy queue.json
  const legacyQueuePath = join(issuesDir, 'queue.json');
  if (existsSync(legacyQueuePath)) {
    try {
      return JSON.parse(readFileSync(legacyQueuePath, 'utf8'));
    } catch {
      // Return empty queue
    }
  }

  return { tasks: [], conflicts: [], execution_groups: [], _metadata: { version: '1.0', total_tasks: 0 } };
}

function writeQueue(issuesDir: string, queue: any) {
  if (!existsSync(issuesDir)) mkdirSync(issuesDir, { recursive: true });

  // Support both solution-based and task-based queues
  const items = queue.solutions || queue.tasks || [];
  const isSolutionBased = Array.isArray(queue.solutions) && queue.solutions.length > 0;

  queue._metadata = {
    ...queue._metadata,
    updated_at: new Date().toISOString(),
    ...(isSolutionBased
      ? { total_solutions: items.length }
      : { total_tasks: items.length })
  };

  // Check if using new multi-queue structure
  const queuesDir = join(issuesDir, 'queues');
  const indexPath = join(queuesDir, 'index.json');

  if (existsSync(indexPath) && queue.id) {
    // Write to new structure
    const queueFilePath = join(queuesDir, `${queue.id}.json`);
    writeFileSync(queueFilePath, JSON.stringify(queue, null, 2));

    // Update index metadata
    try {
      const index = JSON.parse(readFileSync(indexPath, 'utf8'));
      const queueEntry = index.queues?.find((q: any) => q.id === queue.id);
      if (queueEntry) {
        if (isSolutionBased) {
          queueEntry.total_solutions = items.length;
          queueEntry.completed_solutions = items.filter((i: any) => i.status === 'completed').length;
        } else {
          queueEntry.total_tasks = items.length;
          queueEntry.completed_tasks = items.filter((i: any) => i.status === 'completed').length;
        }
        writeFileSync(indexPath, JSON.stringify(index, null, 2));
      }
    } catch {
      // Ignore index update errors
    }
  } else {
    // Fallback to legacy queue.json
    writeFileSync(join(issuesDir, 'queue.json'), JSON.stringify(queue, null, 2));
  }
}

function getIssueDetail(issuesDir: string, issueId: string) {
  const issues = readIssuesJsonl(issuesDir);
  let issue = issues.find(i => i.id === issueId);

  // Fix: Check history if not found in active issues
  if (!issue) {
    const historyIssues = readIssueHistoryJsonl(issuesDir);
    issue = historyIssues.find(i => i.id === issueId);
  }

  // Fallback: Reconstruct issue from solution file if issue not in issues.jsonl or history
  if (!issue) {
    const solutionPath = join(issuesDir, 'solutions', `${issueId}.jsonl`);
    if (existsSync(solutionPath)) {
      const solutions = readSolutionsJsonl(issuesDir, issueId);
      if (solutions.length > 0) {
        const boundSolution = solutions.find(s => s.is_bound) || solutions[0];
        issue = {
          id: issueId,
          title: boundSolution?.description || issueId,
          status: 'completed',
          priority: 3,
          context: boundSolution?.approach || '',
          bound_solution_id: boundSolution?.id || null,
          created_at: boundSolution?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _reconstructed: true
        };
      }
    }
  }

  if (!issue) return null;

  const solutions = readSolutionsJsonl(issuesDir, issueId);
  let tasks: any[] = [];
  if (issue.bound_solution_id) {
    const boundSol = solutions.find(s => s.id === issue.bound_solution_id);
    if (boundSol?.tasks) tasks = boundSol.tasks;
  }
  return { ...issue, solutions, tasks };
}

function enrichIssues(issues: any[], issuesDir: string) {
  return issues.map(issue => {
    const solutions = readSolutionsJsonl(issuesDir, issue.id);
    let tasks: any[] = [];

    // Get tasks from bound solution
    if (issue.bound_solution_id) {
      const boundSol = solutions.find(s => s.id === issue.bound_solution_id);
      if (boundSol?.tasks) {
        tasks = boundSol.tasks;
      }
    }

    return {
      ...issue,
      solutions,                        // Add full solutions array
      tasks,                            // Add full tasks array
      solution_count: solutions.length,
      task_count: tasks.length
    };
  });
}

/**
 * Get queue items (supports both solution-based and task-based queues)
 */
function getQueueItems(queue: any): any[] {
  return queue.solutions || queue.tasks || [];
}

/**
 * Check if queue is solution-based
 */
function isSolutionBasedQueue(queue: any): boolean {
  return Array.isArray(queue.solutions) && queue.solutions.length > 0;
}

function groupQueueByExecutionGroup(queue: any) {
  const groups: { [key: string]: any[] } = {};
  const items = getQueueItems(queue);
  const isSolutionBased = isSolutionBasedQueue(queue);

  for (const item of items) {
    const groupId = item.execution_group || 'ungrouped';
    if (!groups[groupId]) groups[groupId] = [];
    groups[groupId].push(item);
  }
  for (const groupId of Object.keys(groups)) {
    groups[groupId].sort((a, b) => (a.execution_order || 0) - (b.execution_order || 0));
  }
  const executionGroups = Object.entries(groups).map(([id, groupItems]) => ({
    id,
    type: id.startsWith('P') ? 'parallel' : id.startsWith('S') ? 'sequential' : 'unknown',
    // Use appropriate count field based on queue type
    ...(isSolutionBased
      ? { solution_count: groupItems.length, solutions: groupItems.map(i => i.item_id) }
      : { task_count: groupItems.length, tasks: groupItems.map(i => i.item_id) })
  })).sort((a, b) => {
    const aFirst = groups[a.id]?.[0]?.execution_order || 0;
    const bFirst = groups[b.id]?.[0]?.execution_order || 0;
    return aFirst - bFirst;
  });
  return { ...queue, execution_groups: executionGroups, grouped_items: groups };
}

/**
 * Bind solution to issue with proper side effects
 */
function bindSolutionToIssue(issuesDir: string, issueId: string, solutionId: string, issues: any[], issueIndex: number) {
  const solutions = readSolutionsJsonl(issuesDir, issueId);
  const solIndex = solutions.findIndex(s => s.id === solutionId);

  if (solIndex === -1) return { error: `Solution ${solutionId} not found` };

  // Unbind all, bind new
  solutions.forEach(s => { s.is_bound = false; });
  solutions[solIndex].is_bound = true;
  solutions[solIndex].bound_at = new Date().toISOString();
  writeSolutionsJsonl(issuesDir, issueId, solutions);

  // Update issue
  issues[issueIndex].bound_solution_id = solutionId;
  issues[issueIndex].status = 'planned';
  issues[issueIndex].planned_at = new Date().toISOString();

  return { success: true, bound: solutionId };
}

// ========== Path Validation ==========

/**
 * Validate that the provided path is safe (no path traversal)
 * Returns the resolved, normalized path or null if invalid
 */
function validateProjectPath(requestedPath: string, basePath: string): string | null {
  if (!requestedPath) return basePath;

  // Resolve to absolute path and normalize
  const resolvedPath = resolve(normalize(requestedPath));
  const resolvedBase = resolve(normalize(basePath));

  // For local development tool, we allow any absolute path
  // but prevent obvious traversal attempts
  if (requestedPath.includes('..') && !resolvedPath.startsWith(resolvedBase)) {
    // Check if it's trying to escape with ..
    const normalizedRequested = normalize(requestedPath);
    if (normalizedRequested.startsWith('..')) {
      return null;
    }
  }

  return resolvedPath;
}

// ========== Route Handler ==========

export async function handleIssueRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest } = ctx;
  const rawProjectPath = url.searchParams.get('path') || initialPath;

  // Validate project path to prevent path traversal
  const projectPath = validateProjectPath(rawProjectPath, initialPath);
  if (!projectPath) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid project path' }));
    return true;
  }

  const issuesDir = join(projectPath, '.workflow', 'issues');

  // ===== Helper: Normalize queue path (supports both /api/queue/* and /api/issues/queue/*) =====
  const normalizeQueuePath = (path: string): string | null => {
    if (path.startsWith('/api/issues/queue')) {
      return path.replace('/api/issues/queue', '/api/queue');
    }
    if (path.startsWith('/api/queue')) {
      return path;
    }
    return null;
  };

  const normalizedPath = normalizeQueuePath(pathname);

  // ===== Queue Routes (supports both /api/queue/* and /api/issues/queue/*) =====

  // GET /api/queue or /api/issues/queue - Get execution queue
  if ((normalizedPath === '/api/queue') && req.method === 'GET') {
    const queue = groupQueueByExecutionGroup(readQueue(issuesDir));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(queue));
    return true;
  }

  // GET /api/queue/history or /api/issues/queue/history - Get queue history (all queues from index)
  if (normalizedPath === '/api/queue/history' && req.method === 'GET') {
    const queuesDir = join(issuesDir, 'queues');
    const indexPath = join(queuesDir, 'index.json');

    if (!existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ queues: [], active_queue_id: null, active_queue_ids: [] }));
      return true;
    }

    try {
      const index = JSON.parse(readFileSync(indexPath, 'utf8'));
      // Ensure active_queue_ids is always returned for multi-queue support
      if (!index.active_queue_ids) {
        index.active_queue_ids = index.active_queue_id ? [index.active_queue_id] : [];
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(index));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ queues: [], active_queue_id: null, active_queue_ids: [] }));
    }
    return true;
  }

  // GET /api/queue/:id or /api/issues/queue/:id - Get specific queue by ID
  const queueDetailMatch = normalizedPath?.match(/^\/api\/queue\/([^/]+)$/);
  const reservedQueuePaths = ['history', 'reorder', 'move', 'switch', 'deactivate', 'merge', 'activate'];
  if (queueDetailMatch && req.method === 'GET' && !reservedQueuePaths.includes(queueDetailMatch[1])) {
    const queueId = queueDetailMatch[1];
    const queuesDir = join(issuesDir, 'queues');
    const queueFilePath = join(queuesDir, `${queueId}.json`);

    if (!existsSync(queueFilePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Queue ${queueId} not found` }));
      return true;
    }

    try {
      const queue = JSON.parse(readFileSync(queueFilePath, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(groupQueueByExecutionGroup(queue)));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read queue' }));
    }
    return true;
  }

  // POST /api/queue/activate or /api/issues/queue/activate - Activate one or more queues (multi-queue support)
  if (normalizedPath === '/api/queue/activate' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { queueId, queueIds } = body;

      // Support both single queueId and array queueIds
      const idsToActivate: string[] = queueIds
        ? (Array.isArray(queueIds) ? queueIds : [queueIds])
        : (queueId ? [queueId] : []);

      if (idsToActivate.length === 0) {
        return { error: 'queueId or queueIds required' };
      }

      const queuesDir = join(issuesDir, 'queues');
      const indexPath = join(queuesDir, 'index.json');

      // Validate all queue IDs exist
      for (const id of idsToActivate) {
        const queueFilePath = join(queuesDir, `${id}.json`);
        if (!existsSync(queueFilePath)) {
          return { error: `Queue ${id} not found` };
        }
      }

      try {
        const index = existsSync(indexPath)
          ? JSON.parse(readFileSync(indexPath, 'utf8'))
          : { active_queue_id: null, active_queue_ids: [], queues: [] };

        index.active_queue_ids = idsToActivate;
        index.active_queue_id = idsToActivate[0] || null; // Backward compat

        writeFileSync(indexPath, JSON.stringify(index, null, 2));

        return {
          success: true,
          active_queue_ids: idsToActivate,
          active_queue_id: idsToActivate[0] || null // Backward compat
        };
      } catch (err) {
        return { error: 'Failed to activate queue(s)' };
      }
    });
    return true;
  }

  // POST /api/queue/switch or /api/issues/queue/switch - Switch active queue (legacy, single queue)
  if (normalizedPath === '/api/queue/switch' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { queueId } = body;
      if (!queueId) return { error: 'queueId required' };

      const queuesDir = join(issuesDir, 'queues');
      const indexPath = join(queuesDir, 'index.json');
      const queueFilePath = join(queuesDir, `${queueId}.json`);

      if (!existsSync(queueFilePath)) {
        return { error: `Queue ${queueId} not found` };
      }

      try {
        const index = existsSync(indexPath)
          ? JSON.parse(readFileSync(indexPath, 'utf8'))
          : { active_queue_id: null, active_queue_ids: [], queues: [] };

        index.active_queue_id = queueId;
        index.active_queue_ids = [queueId]; // Also update multi-queue array

        writeFileSync(indexPath, JSON.stringify(index, null, 2));

        return {
          success: true,
          active_queue_id: queueId,
          active_queue_ids: [queueId]
        };
      } catch (err) {
        return { error: 'Failed to switch queue' };
      }
    });
    return true;
  }

  // POST /api/queue/deactivate or /api/issues/queue/deactivate - Deactivate queue(s)
  if (normalizedPath === '/api/queue/deactivate' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { queueId } = body; // Optional: specific queue to deactivate
      const queuesDir = join(issuesDir, 'queues');
      const indexPath = join(queuesDir, 'index.json');

      try {
        const index = existsSync(indexPath)
          ? JSON.parse(readFileSync(indexPath, 'utf8'))
          : { active_queue_id: null, active_queue_ids: [], queues: [] };

        const currentActiveIds = index.active_queue_ids || (index.active_queue_id ? [index.active_queue_id] : []);
        let deactivatedIds: string[] = [];
        let remainingIds: string[] = [];

        if (queueId) {
          // Deactivate specific queue
          deactivatedIds = currentActiveIds.includes(queueId) ? [queueId] : [];
          remainingIds = currentActiveIds.filter((id: string) => id !== queueId);
        } else {
          // Deactivate all
          deactivatedIds = [...currentActiveIds];
          remainingIds = [];
        }

        index.active_queue_ids = remainingIds;
        index.active_queue_id = remainingIds[0] || null; // Backward compat

        writeFileSync(indexPath, JSON.stringify(index, null, 2));

        return {
          success: true,
          deactivated_queue_ids: deactivatedIds,
          active_queue_ids: remainingIds,
          active_queue_id: remainingIds[0] || null // Backward compat
        };
      } catch (err) {
        return { error: 'Failed to deactivate queue' };
      }
    });
    return true;
  }

  // POST /api/queue/reorder or /api/issues/queue/reorder - Reorder queue items (supports both solutions and tasks)
  if (normalizedPath === '/api/queue/reorder' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { groupId, newOrder } = body;
      if (!groupId || !Array.isArray(newOrder)) {
        return { error: 'groupId and newOrder (array) required' };
      }

      const queue = readQueue(issuesDir);
      const items = getQueueItems(queue);
      const isSolutionBased = isSolutionBasedQueue(queue);

      const groupItems = items.filter((item: any) => item.execution_group === groupId);
      const otherItems = items.filter((item: any) => item.execution_group !== groupId);

      if (groupItems.length === 0) return { error: `No items in group ${groupId}` };

      const groupItemIds = new Set(groupItems.map((i: any) => i.item_id));
      if (groupItemIds.size !== new Set(newOrder).size) {
        return { error: 'newOrder must contain all group items' };
      }
      for (const id of newOrder) {
        if (!groupItemIds.has(id)) return { error: `Invalid item_id: ${id}` };
      }

      const itemMap = new Map(groupItems.map((i: any) => [i.item_id, i]));
      const reorderedItems = newOrder.map((qid: string, idx: number) => ({ ...itemMap.get(qid), _idx: idx }));
      const newQueueItems = [...otherItems, ...reorderedItems].sort((a, b) => {
        const aGroup = parseInt(a.execution_group?.match(/\d+/)?.[0] || '999');
        const bGroup = parseInt(b.execution_group?.match(/\d+/)?.[0] || '999');
        if (aGroup !== bGroup) return aGroup - bGroup;
        if (a.execution_group === b.execution_group) {
          return (a._idx ?? a.execution_order ?? 999) - (b._idx ?? b.execution_order ?? 999);
        }
        return (a.execution_order || 0) - (b.execution_order || 0);
      });

      newQueueItems.forEach((item, idx) => { item.execution_order = idx + 1; delete item._idx; });

      // Write back to appropriate array based on queue type
      if (isSolutionBased) {
        queue.solutions = newQueueItems;
      } else {
        queue.tasks = newQueueItems;
      }
      writeQueue(issuesDir, queue);

      return { success: true, groupId, reordered: newOrder.length };
    });
    return true;
  }

  // POST /api/queue/move - Move an item to a different execution_group (and optionally insert at index)
  if (normalizedPath === '/api/queue/move' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { itemId, toGroupId, toIndex } = body;
      if (!itemId || !toGroupId) {
        return { error: 'itemId and toGroupId required' };
      }

      const queue = readQueue(issuesDir);
      const items = getQueueItems(queue);
      const isSolutionBased = isSolutionBasedQueue(queue);

      const itemIndex = items.findIndex((i: any) => i.item_id === itemId);
      if (itemIndex === -1) return { error: `Item ${itemId} not found` };

      const moved = { ...items[itemIndex] };
      const fromGroupId = moved.execution_group || 'ungrouped';

      // Build per-group ordered lists based on current execution_order
      const groupToIds = new Map<string, string[]>();
      const sorted = [...items].sort((a: any, b: any) => (a.execution_order || 0) - (b.execution_order || 0));
      for (const it of sorted) {
        const gid = it.execution_group || 'ungrouped';
        if (!groupToIds.has(gid)) groupToIds.set(gid, []);
        groupToIds.get(gid)!.push(it.item_id);
      }

      // Remove from old group
      const fromList = groupToIds.get(fromGroupId) || [];
      groupToIds.set(fromGroupId, fromList.filter((id) => id !== itemId));

      // Insert into target group
      const targetList = groupToIds.get(toGroupId) || [];
      const insertAt = typeof toIndex === 'number' ? Math.max(0, Math.min(targetList.length, toIndex)) : targetList.length;
      const nextTarget = [...targetList];
      nextTarget.splice(insertAt, 0, itemId);
      groupToIds.set(toGroupId, nextTarget);

      moved.execution_group = toGroupId;

      const itemMap = new Map(items.map((i: any) => [i.item_id, i]));
      itemMap.set(itemId, moved);

      const groupIds = Array.from(groupToIds.keys());
      groupIds.sort((a, b) => {
        const aGroup = parseInt(a.match(/\\d+/)?.[0] || '999');
        const bGroup = parseInt(b.match(/\\d+/)?.[0] || '999');
        if (aGroup !== bGroup) return aGroup - bGroup;
        return a.localeCompare(b);
      });

      const nextItems: any[] = [];
      const seen = new Set<string>();
      for (const gid of groupIds) {
        const ids = groupToIds.get(gid) || [];
        for (const id of ids) {
          const it = itemMap.get(id);
          if (!it) continue;
          if (seen.has(id)) continue;
          seen.add(id);
          nextItems.push(it);
        }
      }

      // Fallback: append any missing items
      for (const it of items) {
        if (!seen.has(it.item_id)) nextItems.push(it);
      }

      nextItems.forEach((it, idx) => { it.execution_order = idx + 1; });

      if (isSolutionBased) {
        queue.solutions = nextItems;
      } else {
        queue.tasks = nextItems;
      }
      writeQueue(issuesDir, queue);

      return { success: true, itemId, fromGroupId, toGroupId };
    });
    return true;
  }

  // DELETE /api/queue/:queueId/item/:itemId or /api/issues/queue/:queueId/item/:itemId
  const queueItemDeleteMatch = normalizedPath?.match(/^\/api\/queue\/([^/]+)\/item\/([^/]+)$/);
  if (queueItemDeleteMatch && req.method === 'DELETE') {
    const queueId = queueItemDeleteMatch[1];
    const itemId = decodeURIComponent(queueItemDeleteMatch[2]);

    const queuesDir = join(issuesDir, 'queues');
    const queueFilePath = join(queuesDir, `${queueId}.json`);

    if (!existsSync(queueFilePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Queue ${queueId} not found` }));
      return true;
    }

    try {
      const queue = JSON.parse(readFileSync(queueFilePath, 'utf8'));
      const items = queue.solutions || queue.tasks || [];
      const filteredItems = items.filter((item: any) => item.item_id !== itemId);

      if (filteredItems.length === items.length) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Item ${itemId} not found in queue` }));
        return true;
      }

      // Update queue items
      if (queue.solutions) {
        queue.solutions = filteredItems;
      } else {
        queue.tasks = filteredItems;
      }

      // Recalculate metadata
      const completedCount = filteredItems.filter((i: any) => i.status === 'completed').length;
      queue._metadata = {
        ...queue._metadata,
        updated_at: new Date().toISOString(),
        ...(queue.solutions
          ? { total_solutions: filteredItems.length, completed_solutions: completedCount }
          : { total_tasks: filteredItems.length, completed_tasks: completedCount })
      };

      writeFileSync(queueFilePath, JSON.stringify(queue, null, 2));

      // Update index counts
      const indexPath = join(queuesDir, 'index.json');
      if (existsSync(indexPath)) {
        try {
          const index = JSON.parse(readFileSync(indexPath, 'utf8'));
          const queueEntry = index.queues?.find((q: any) => q.id === queueId);
          if (queueEntry) {
            if (queue.solutions) {
              queueEntry.total_solutions = filteredItems.length;
              queueEntry.completed_solutions = completedCount;
            } else {
              queueEntry.total_tasks = filteredItems.length;
              queueEntry.completed_tasks = completedCount;
            }
            writeFileSync(indexPath, JSON.stringify(index, null, 2));
          }
        } catch (err) {
          console.error('Failed to update queue index:', err);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, queueId, deletedItemId: itemId }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to delete item' }));
    }
    return true;
  }

  // DELETE /api/queue/:queueId or /api/issues/queue/:queueId - Delete entire queue
  const queueDeleteMatch = normalizedPath?.match(/^\/api\/queue\/([^/]+)$/);
  if (queueDeleteMatch && req.method === 'DELETE') {
    const queueId = queueDeleteMatch[1];
    const queuesDir = join(issuesDir, 'queues');
    const queueFilePath = join(queuesDir, `${queueId}.json`);
    const indexPath = join(queuesDir, 'index.json');

    if (!existsSync(queueFilePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Queue ${queueId} not found` }));
      return true;
    }

    try {
      // Delete queue file
      unlinkSync(queueFilePath);

      // Update index
      if (existsSync(indexPath)) {
        const index = JSON.parse(readFileSync(indexPath, 'utf8'));

        // Remove from queues array
        index.queues = (index.queues || []).filter((q: any) => q.id !== queueId);

        // Clear active if this was the active queue
        if (index.active_queue_id === queueId) {
          index.active_queue_id = null;
        }

        writeFileSync(indexPath, JSON.stringify(index, null, 2));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deletedQueueId: queueId }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to delete queue' }));
    }
    return true;
  }

  // POST /api/queue/merge or /api/issues/queue/merge - Merge source queue into target queue
  if (normalizedPath === '/api/queue/merge' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { sourceQueueId, targetQueueId } = body;
      if (!sourceQueueId || !targetQueueId) {
        return { error: 'sourceQueueId and targetQueueId required' };
      }

      if (sourceQueueId === targetQueueId) {
        return { error: 'Cannot merge queue into itself' };
      }

      const queuesDir = join(issuesDir, 'queues');
      const sourcePath = join(queuesDir, `${sourceQueueId}.json`);
      const targetPath = join(queuesDir, `${targetQueueId}.json`);

      if (!existsSync(sourcePath)) return { error: `Source queue ${sourceQueueId} not found` };
      if (!existsSync(targetPath)) return { error: `Target queue ${targetQueueId} not found` };

      try {
        const sourceQueue = JSON.parse(readFileSync(sourcePath, 'utf8'));
        const targetQueue = JSON.parse(readFileSync(targetPath, 'utf8'));

        const sourceItems = sourceQueue.solutions || sourceQueue.tasks || [];
        const targetItems = targetQueue.solutions || targetQueue.tasks || [];
        const isSolutionBased = !!targetQueue.solutions;

        if (!isSolutionBased) {
          targetQueue.solutions = [];
        }

        // Helper to generate next item ID (S-N format)
        const getNextItemId = (): string => {
          const items = targetQueue.solutions || [];
          const maxNum = items.reduce((max: number, i: any) => {
            const match = i.item_id?.match(/^S-(\d+)$/);
            return match ? Math.max(max, parseInt(match[1])) : max;
          }, 0);
          return `S-${maxNum + 1}`;
        };

        let itemsMerged = 0;
        let skippedDuplicates = 0;

        for (const sourceItem of sourceItems) {
          // Skip duplicates (same issue_id + solution_id)
          const exists = (targetQueue.solutions || []).some(
            (t: any) => t.issue_id === sourceItem.issue_id && t.solution_id === sourceItem.solution_id
          );

          if (exists) {
            skippedDuplicates++;
            continue;
          }

          // Add with new item_id (S-N format)
          const newItem = {
            ...sourceItem,
            item_id: getNextItemId(),
            execution_order: (targetQueue.solutions?.length || 0) + 1
          };

          if (!targetQueue.solutions) targetQueue.solutions = [];
          targetQueue.solutions.push(newItem);
          itemsMerged++;
        }

        // Merge issue_ids
        const mergedIssueIds = [...new Set([
          ...(targetQueue.issue_ids || []),
          ...(sourceQueue.issue_ids || [])
        ])];
        targetQueue.issue_ids = mergedIssueIds;

        // Merge conflicts
        if (sourceQueue.conflicts && sourceQueue.conflicts.length > 0) {
          if (!targetQueue.conflicts) targetQueue.conflicts = [];
          targetQueue.conflicts.push(...sourceQueue.conflicts);
        }

        // Update metadata
        const mergedItems = targetQueue.solutions || [];
        const completedCount = mergedItems.filter((i: any) => i.status === 'completed').length;
        targetQueue._metadata = {
          ...targetQueue._metadata,
          updated_at: new Date().toISOString(),
          total_solutions: mergedItems.length,
          completed_solutions: completedCount
        };

        // Write merged queue
        writeFileSync(targetPath, JSON.stringify(targetQueue, null, 2));

        // Update source queue status to 'merged'
        sourceQueue.status = 'merged';
        sourceQueue._metadata = {
          ...sourceQueue._metadata,
          merged_into: targetQueueId,
          merged_at: new Date().toISOString()
        };
        writeFileSync(sourcePath, JSON.stringify(sourceQueue, null, 2));

        // Update index
        const indexPath = join(queuesDir, 'index.json');
        if (existsSync(indexPath)) {
          try {
            const index = JSON.parse(readFileSync(indexPath, 'utf8'));
            const sourceEntry = index.queues?.find((q: any) => q.id === sourceQueueId);
            const targetEntry = index.queues?.find((q: any) => q.id === targetQueueId);
            if (sourceEntry) {
              sourceEntry.status = 'merged';
            }
            if (targetEntry) {
              targetEntry.total_solutions = mergedItems.length;
              targetEntry.completed_solutions = completedCount;
              targetEntry.issue_ids = mergedIssueIds;
            }
            writeFileSync(indexPath, JSON.stringify(index, null, 2));
          } catch {
            // Ignore index update errors
          }
        }

        return {
          success: true,
          sourceQueueId,
          targetQueueId,
          mergedItemCount: itemsMerged,
          skippedDuplicates,
          totalItems: mergedItems.length
        };
      } catch (err) {
        return { error: 'Failed to merge queues' };
      }
    });
    return true;
  }

  // POST /api/queue/split - Split items from source queue into a new queue
  if (normalizedPath === '/api/queue/split' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { sourceQueueId, itemIds } = body;
      if (!sourceQueueId || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return { error: 'sourceQueueId and itemIds (non-empty array) required' };
      }

      const queuesDir = join(issuesDir, 'queues');
      const sourcePath = join(queuesDir, `${sourceQueueId}.json`);

      if (!existsSync(sourcePath)) {
        return { error: `Source queue ${sourceQueueId} not found` };
      }

      try {
        const sourceQueue = JSON.parse(readFileSync(sourcePath, 'utf8'));
        const sourceItems = sourceQueue.solutions || sourceQueue.tasks || [];
        const isSolutionBased = !!sourceQueue.solutions;

        // Find items to split
        const itemsToSplit = sourceItems.filter((item: any) =>
          itemIds.includes(item.item_id) ||
          itemIds.includes(item.solution_id) ||
          itemIds.includes(item.task_id)
        );

        if (itemsToSplit.length === 0) {
          return { error: 'No matching items found to split' };
        }

        if (itemsToSplit.length === sourceItems.length) {
          return { error: 'Cannot split all items - at least one item must remain in source queue' };
        }

        // Find remaining items
        const remainingItems = sourceItems.filter((item: any) =>
          !itemIds.includes(item.item_id) &&
          !itemIds.includes(item.solution_id) &&
          !itemIds.includes(item.task_id)
        );

        // Create new queue with split items
        const newQueueId = generateQueueFileId();
        const newQueuePath = join(queuesDir, `${newQueueId}.json`);

        // Re-index split items
        const reindexedSplitItems = itemsToSplit.map((item: any, idx: number) => ({
          ...item,
          execution_order: idx + 1
        }));

        // Extract issue IDs from split items
        const splitIssueIds = [...new Set(itemsToSplit.map((item: any) => item.issue_id).filter(Boolean))];

        // Remaining issue IDs
        const remainingIssueIds = [...new Set(remainingItems.map((item: any) => item.issue_id).filter(Boolean))];

        // Create new queue
        const newQueue: any = {
          id: newQueueId,
          status: 'active',
          issue_ids: splitIssueIds,
          conflicts: [],
          _metadata: {
            version: '2.1',
            updated_at: new Date().toISOString(),
            split_from: sourceQueueId,
            split_at: new Date().toISOString(),
            ...(isSolutionBased
              ? {
                  total_solutions: reindexedSplitItems.length,
                  completed_solutions: reindexedSplitItems.filter((i: any) => i.status === 'completed').length
                }
              : {
                  total_tasks: reindexedSplitItems.length,
                  completed_tasks: reindexedSplitItems.filter((i: any) => i.status === 'completed').length
                })
          }
        };

        if (isSolutionBased) {
          newQueue.solutions = reindexedSplitItems;
        } else {
          newQueue.tasks = reindexedSplitItems;
        }

        // Update source queue with remaining items
        const reindexedRemainingItems = remainingItems.map((item: any, idx: number) => ({
          ...item,
          execution_order: idx + 1
        }));

        if (isSolutionBased) {
          sourceQueue.solutions = reindexedRemainingItems;
        } else {
          sourceQueue.tasks = reindexedRemainingItems;
        }

        sourceQueue.issue_ids = remainingIssueIds;
        sourceQueue._metadata = {
          ...sourceQueue._metadata,
          updated_at: new Date().toISOString(),
          ...(isSolutionBased
            ? {
                total_solutions: reindexedRemainingItems.length,
                completed_solutions: reindexedRemainingItems.filter((i: any) => i.status === 'completed').length
              }
            : {
                total_tasks: reindexedRemainingItems.length,
                completed_tasks: reindexedRemainingItems.filter((i: any) => i.status === 'completed').length
              })
        };

        // Write both queues
        writeFileSync(newQueuePath, JSON.stringify(newQueue, null, 2));
        writeFileSync(sourcePath, JSON.stringify(sourceQueue, null, 2));

        // Update index
        const indexPath = join(queuesDir, 'index.json');
        if (existsSync(indexPath)) {
          try {
            const index = JSON.parse(readFileSync(indexPath, 'utf8'));

            // Add new queue to index
            const newQueueEntry: any = {
              id: newQueueId,
              status: 'active',
              issue_ids: splitIssueIds,
              created_at: new Date().toISOString(),
              ...(isSolutionBased
                ? {
                    total_solutions: reindexedSplitItems.length,
                    completed_solutions: reindexedSplitItems.filter((i: any) => i.status === 'completed').length
                  }
                : {
                    total_tasks: reindexedSplitItems.length,
                    completed_tasks: reindexedSplitItems.filter((i: any) => i.status === 'completed').length
                  })
            };

            index.queues = index.queues || [];
            index.queues.push(newQueueEntry);

            // Update source queue in index
            const sourceEntry = index.queues.find((q: any) => q.id === sourceQueueId);
            if (sourceEntry) {
              sourceEntry.issue_ids = remainingIssueIds;
              if (isSolutionBased) {
                sourceEntry.total_solutions = reindexedRemainingItems.length;
                sourceEntry.completed_solutions = reindexedRemainingItems.filter((i: any) => i.status === 'completed').length;
              } else {
                sourceEntry.total_tasks = reindexedRemainingItems.length;
                sourceEntry.completed_tasks = reindexedRemainingItems.filter((i: any) => i.status === 'completed').length;
              }
            }

            writeFileSync(indexPath, JSON.stringify(index, null, 2));
          } catch {
            // Ignore index update errors
          }
        }

        return {
          success: true,
          sourceQueueId,
          newQueueId,
          splitItemCount: itemsToSplit.length,
          remainingItemCount: remainingItems.length
        };
      } catch (err) {
        return { error: 'Failed to split queue' };
      }
    });
    return true;
  }

  // Legacy: GET /api/issues/queue (backward compat)
  if (pathname === '/api/issues/queue' && req.method === 'GET') {
    const queue = groupQueueByExecutionGroup(readQueue(issuesDir));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(queue));
    return true;
  }

  // ===== Issue Routes =====

  // GET /api/issues - List all issues
  if (pathname === '/api/issues' && req.method === 'GET') {
    const issues = enrichIssues(readIssuesJsonl(issuesDir), issuesDir);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      issues,
      _metadata: { version: '2.0', storage: 'jsonl', total_issues: issues.length, last_updated: new Date().toISOString() }
    }));
    return true;
  }

  // GET /api/issues/history - List completed issues from history
  if (pathname === '/api/issues/history' && req.method === 'GET') {
    // Fix: Use enrichIssues to add solution/task counts to historical issues
    const history = enrichIssues(readIssueHistoryJsonl(issuesDir), issuesDir);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      issues: history,
      _metadata: { version: '1.0', storage: 'jsonl', total_issues: history.length, last_updated: new Date().toISOString() }
    }));
    return true;
  }

  // POST /api/issues - Create issue (with Zod validation)
  if (pathname === '/api/issues' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      // Use new validation service
      const result: CreateIssueResult = processCreateIssueRequest(body);

      if (!result.success) {
        return { error: result.error.error.message, status: result.status, details: result.error.error };
      }

      // TypeScript narrowing: result is now { success: true; issue: Issue; status: 201 }
      const { issue } = result;
      const issues = readIssuesJsonl(issuesDir);

      // Check for duplicate ID (auto-generated IDs should be unique)
      if (issues.find((i: any) => i.id === issue.id)) {
        return { error: `Issue ${issue.id} already exists`, status: 409 };
      }

      // Store issue
      issues.push(issue);
      writeIssuesJsonl(issuesDir, issues);

      // Return 201 Created response
      return { success: true, data: { issue }, status: 201 };
    });
    return true;
  }

  // POST /api/issues/pull - Pull issues from GitHub
  if (pathname === '/api/issues/pull' && req.method === 'POST') {
    const state = url.searchParams.get('state') || 'open';
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const labels = url.searchParams.get('labels') || '';
    const downloadImages = url.searchParams.get('downloadImages') === 'true';

    try {
      const { execSync } = await import('child_process');
      const https = await import('https');
      const http = await import('http');

      // Check if gh CLI is available
      try {
        execSync('gh --version', { stdio: 'ignore', timeout: 5000 });
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'GitHub CLI (gh) is not installed or not in PATH' }));
        return true;
      }

      // Build gh command
      let ghCommand = `gh issue list --state ${state} --limit ${limit} --json number,title,body,labels,url,state`;
      if (labels) ghCommand += ` --label "${labels}"`;

      // Execute gh command from project root
      const ghOutput = execSync(ghCommand, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000,
        cwd: issuesDir.replace(/[\\/]\.workflow[\\/]issues$/, '')
      }).trim();

      if (!ghOutput) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ imported: 0, updated: 0, skipped: 0, images_downloaded: 0 }));
        return true;
      }

      const ghIssues = JSON.parse(ghOutput);
      const existingIssues = readIssuesJsonl(issuesDir);

      let imported = 0;
      let skipped = 0;
      let updated = 0;
      let imagesDownloaded = 0;

      // Create images directory if needed
      const imagesDir = join(issuesDir, 'images');
      if (downloadImages && !existsSync(imagesDir)) {
        mkdirSync(imagesDir, { recursive: true });
      }

      // Helper function to download image
      const downloadImage = async (imageUrl: string, issueNumber: number, imageIndex: number): Promise<string | null> => {
        return new Promise((resolveDownload) => {
          try {
            const ext = imageUrl.match(/\.(png|jpg|jpeg|gif|webp|svg)/i)?.[1] || 'png';
            const filename = `GH-${issueNumber}-${imageIndex}.${ext}`;
            const filePath = join(imagesDir, filename);

            // Skip if already downloaded
            if (existsSync(filePath)) {
              resolveDownload(`.workflow/issues/images/${filename}`);
              return;
            }

            const protocol = imageUrl.startsWith('https') ? https : http;
            protocol.get(imageUrl, { timeout: 30000 }, (response: any) => {
              // Handle redirect
              if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                  downloadImage(redirectUrl, issueNumber, imageIndex).then(resolveDownload);
                  return;
                }
              }
              if (response.statusCode !== 200) {
                resolveDownload(null);
                return;
              }

              const chunks: Buffer[] = [];
              response.on('data', (chunk: Buffer) => chunks.push(chunk));
              response.on('end', () => {
                try {
                  writeFileSync(filePath, Buffer.concat(chunks));
                  resolveDownload(`.workflow/issues/images/${filename}`);
                } catch {
                  resolveDownload(null);
                }
              });
              response.on('error', () => resolveDownload(null));
            }).on('error', () => resolveDownload(null));
          } catch {
            resolveDownload(null);
          }
        });
      };

      // Process issues
      for (const ghIssue of ghIssues) {
        const issueId = `GH-${ghIssue.number}`;
        const existingIssue = existingIssues.find((i: any) => i.id === issueId);

        let context = ghIssue.body || ghIssue.title;

        // Extract and download images if enabled
        if (downloadImages && ghIssue.body) {
          // Find all image URLs in the body
          const imgPattern = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)|<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
          const imageUrls: string[] = [];
          let match;
          while ((match = imgPattern.exec(ghIssue.body)) !== null) {
            imageUrls.push(match[1] || match[2]);
          }

          // Download images and build reference list
          if (imageUrls.length > 0) {
            const downloadedImages: string[] = [];
            for (let i = 0; i < imageUrls.length; i++) {
              const localPath = await downloadImage(imageUrls[i], ghIssue.number, i + 1);
              if (localPath) {
                downloadedImages.push(localPath);
                imagesDownloaded++;
              }
            }

            // Append image references to context
            if (downloadedImages.length > 0) {
              context += '\n\n---\n**Downloaded Images:**\n';
              downloadedImages.forEach((path, idx) => {
                context += `- Image ${idx + 1}: \`${path}\`\n`;
              });
            }
          }
        }

        // Prepare issue data (truncate context to 2000 chars max)
        const issueData = {
          id: issueId,
          title: ghIssue.title,
          status: ghIssue.state === 'OPEN' ? 'registered' : 'completed',
          priority: 3,
          context: context.substring(0, 2000),
          source: 'github',
          source_url: ghIssue.url,
          tags: ghIssue.labels?.map((l: any) => l.name) || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (existingIssue) {
          // Update if changed
          const newStatus = ghIssue.state === 'OPEN' ? 'registered' : 'completed';
          if (existingIssue.status !== newStatus || existingIssue.title !== ghIssue.title) {
            existingIssue.title = ghIssue.title;
            existingIssue.status = newStatus;
            existingIssue.context = issueData.context;
            existingIssue.updated_at = new Date().toISOString();
            updated++;
          } else {
            skipped++;
          }
        } else {
          existingIssues.push(issueData);
          imported++;
        }
      }

      // Save all issues
      writeIssuesJsonl(issuesDir, existingIssues);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ imported, updated, skipped, images_downloaded: imagesDownloaded, total: ghIssues.length }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Failed to pull issues from GitHub' }));
    }
    return true;
  }

  // GET /api/issues/:id - Get issue detail
  const detailMatch = pathname.match(/^\/api\/issues\/([^/]+)$/);
  if (detailMatch && req.method === 'GET') {
    const issueId = decodeURIComponent(detailMatch[1]);
    if (issueId === 'queue') return false;

    const detail = getIssueDetail(issuesDir, issueId);
    if (!detail) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(detail));
    return true;
  }

  // PATCH /api/issues/:id - Update issue (with binding support)
  const updateMatch = pathname.match(/^\/api\/issues\/([^/]+)$/);
  if (updateMatch && req.method === 'PATCH') {
    const issueId = decodeURIComponent(updateMatch[1]);
    if (issueId === 'queue') return false;

    handlePostRequest(req, res, async (body: any) => {
      const issues = readIssuesJsonl(issuesDir);
      const issueIndex = issues.findIndex(i => i.id === issueId);
      if (issueIndex === -1) return { error: 'Issue not found' };

      const updates: string[] = [];

      // Handle binding if bound_solution_id provided
      if (body.bound_solution_id !== undefined) {
        if (body.bound_solution_id) {
          const bindResult = bindSolutionToIssue(issuesDir, issueId, body.bound_solution_id, issues, issueIndex);
          if (bindResult.error) return bindResult;
          updates.push('bound_solution_id');
        } else {
          // Unbind
          const solutions = readSolutionsJsonl(issuesDir, issueId);
          solutions.forEach(s => { s.is_bound = false; });
          writeSolutionsJsonl(issuesDir, issueId, solutions);
          issues[issueIndex].bound_solution_id = null;
          updates.push('bound_solution_id (unbound)');
        }
      }

      // Update other fields
      for (const field of ['title', 'context', 'status', 'priority', 'tags']) {
        if (body[field] !== undefined) {
          issues[issueIndex][field] = body[field];
          updates.push(field);
        }
      }

      issues[issueIndex].updated_at = new Date().toISOString();
      writeIssuesJsonl(issuesDir, issues);
      return { success: true, issueId, updated: updates };
    });
    return true;
  }

  // DELETE /api/issues/:id
  const deleteMatch = pathname.match(/^\/api\/issues\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const issueId = decodeURIComponent(deleteMatch[1]);

    const issues = readIssuesJsonl(issuesDir);
    const filtered = issues.filter(i => i.id !== issueId);
    if (filtered.length === issues.length) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return true;
    }

    writeIssuesJsonl(issuesDir, filtered);

    // Clean up solutions file
    const solPath = join(issuesDir, 'solutions', `${issueId}.jsonl`);
    if (existsSync(solPath)) {
      try { unlinkSync(solPath); } catch {}
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, issueId }));
    return true;
  }

  // POST /api/issues/:id/archive - Archive issue (move to history)
  const archiveMatch = pathname.match(/^\/api\/issues\/([^/]+)\/archive$/);
  if (archiveMatch && req.method === 'POST') {
    const issueId = decodeURIComponent(archiveMatch[1]);

    const issues = readIssuesJsonl(issuesDir);
    const issueIndex = issues.findIndex(i => i.id === issueId);

    if (issueIndex === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return true;
    }

    // Get the issue and add archive metadata
    const issue = issues[issueIndex];
    issue.archived_at = new Date().toISOString();
    issue.status = 'completed';

    // Move to history
    const history = readIssueHistoryJsonl(issuesDir);
    history.push(issue);
    writeIssueHistoryJsonl(issuesDir, history);

    // Remove from active issues
    issues.splice(issueIndex, 1);
    writeIssuesJsonl(issuesDir, issues);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, issueId, archivedAt: issue.archived_at }));
    return true;
  }

  // POST /api/issues/:id/solutions - Add solution
  const addSolMatch = pathname.match(/^\/api\/issues\/([^/]+)\/solutions$/);
  if (addSolMatch && req.method === 'POST') {
    const issueId = decodeURIComponent(addSolMatch[1]);

    handlePostRequest(req, res, async (body: any) => {
      if (!body.id || !body.tasks) return { error: 'id and tasks required' };

      const solutions = readSolutionsJsonl(issuesDir, issueId);
      if (solutions.find(s => s.id === body.id)) return { error: `Solution ${body.id} exists` };

      const newSolution = {
        id: body.id,
        description: body.description || '',
        tasks: body.tasks,
        exploration_context: body.exploration_context || {},
        analysis: body.analysis || {},
        score: body.score || 0,
        is_bound: false,
        created_at: new Date().toISOString()
      };

      solutions.push(newSolution);
      writeSolutionsJsonl(issuesDir, issueId, solutions);

      // Update issue solution_count
      const issues = readIssuesJsonl(issuesDir);
      const idx = issues.findIndex(i => i.id === issueId);
      if (idx !== -1) {
        issues[idx].solution_count = solutions.length;
        issues[idx].updated_at = new Date().toISOString();
        writeIssuesJsonl(issuesDir, issues);
      }

      return { success: true, solution: newSolution };
    });
    return true;
  }

  // PATCH /api/issues/:id/tasks/:taskId - Update task
  const taskMatch = pathname.match(/^\/api\/issues\/([^/]+)\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === 'PATCH') {
    const issueId = decodeURIComponent(taskMatch[1]);
    const taskId = decodeURIComponent(taskMatch[2]);

    handlePostRequest(req, res, async (body: any) => {
      const issues = readIssuesJsonl(issuesDir);
      const issue = issues.find(i => i.id === issueId);
      if (!issue?.bound_solution_id) return { error: 'Issue or bound solution not found' };

      const solutions = readSolutionsJsonl(issuesDir, issueId);
      const solIdx = solutions.findIndex(s => s.id === issue.bound_solution_id);
      if (solIdx === -1) return { error: 'Bound solution not found' };

      const taskIdx = solutions[solIdx].tasks?.findIndex((t: any) => t.id === taskId);
      if (taskIdx === -1 || taskIdx === undefined) return { error: 'Task not found' };

      const updates: string[] = [];
      for (const field of ['status', 'priority', 'result', 'error']) {
        if (body[field] !== undefined) {
          solutions[solIdx].tasks[taskIdx][field] = body[field];
          updates.push(field);
        }
      }
      solutions[solIdx].tasks[taskIdx].updated_at = new Date().toISOString();
      writeSolutionsJsonl(issuesDir, issueId, solutions);

      return { success: true, issueId, taskId, updated: updates };
    });
    return true;
  }

  // Legacy: PUT /api/issues/:id/task/:taskId (backward compat)
  const legacyTaskMatch = pathname.match(/^\/api\/issues\/([^/]+)\/task\/([^/]+)$/);
  if (legacyTaskMatch && req.method === 'PUT') {
    const issueId = decodeURIComponent(legacyTaskMatch[1]);
    const taskId = decodeURIComponent(legacyTaskMatch[2]);

    handlePostRequest(req, res, async (body: any) => {
      const issues = readIssuesJsonl(issuesDir);
      const issue = issues.find(i => i.id === issueId);
      if (!issue?.bound_solution_id) return { error: 'Issue or bound solution not found' };

      const solutions = readSolutionsJsonl(issuesDir, issueId);
      const solIdx = solutions.findIndex(s => s.id === issue.bound_solution_id);
      if (solIdx === -1) return { error: 'Bound solution not found' };

      const taskIdx = solutions[solIdx].tasks?.findIndex((t: any) => t.id === taskId);
      if (taskIdx === -1 || taskIdx === undefined) return { error: 'Task not found' };

      const updates: string[] = [];
      if (body.status !== undefined) { solutions[solIdx].tasks[taskIdx].status = body.status; updates.push('status'); }
      if (body.priority !== undefined) { solutions[solIdx].tasks[taskIdx].priority = body.priority; updates.push('priority'); }
      solutions[solIdx].tasks[taskIdx].updated_at = new Date().toISOString();
      writeSolutionsJsonl(issuesDir, issueId, solutions);

      return { success: true, issueId, taskId, updated: updates };
    });
    return true;
  }

  // Legacy: PUT /api/issues/:id/bind/:solutionId (backward compat)
  const legacyBindMatch = pathname.match(/^\/api\/issues\/([^/]+)\/bind\/([^/]+)$/);
  if (legacyBindMatch && req.method === 'PUT') {
    const issueId = decodeURIComponent(legacyBindMatch[1]);
    const solutionId = decodeURIComponent(legacyBindMatch[2]);

    const issues = readIssuesJsonl(issuesDir);
    const issueIndex = issues.findIndex(i => i.id === issueId);
    if (issueIndex === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return true;
    }

    const result = bindSolutionToIssue(issuesDir, issueId, solutionId, issues, issueIndex);
    if (result.error) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    }

    issues[issueIndex].updated_at = new Date().toISOString();
    writeIssuesJsonl(issuesDir, issues);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, issueId, solutionId }));
    return true;
  }

  // Legacy: PUT /api/issues/:id (backward compat for PATCH)
  const legacyUpdateMatch = pathname.match(/^\/api\/issues\/([^/]+)$/);
  if (legacyUpdateMatch && req.method === 'PUT') {
    const issueId = decodeURIComponent(legacyUpdateMatch[1]);
    if (issueId === 'queue') return false;

    handlePostRequest(req, res, async (body: any) => {
      const issues = readIssuesJsonl(issuesDir);
      const issueIndex = issues.findIndex(i => i.id === issueId);
      if (issueIndex === -1) return { error: 'Issue not found' };

      const updates: string[] = [];
      for (const field of ['title', 'context', 'status', 'priority', 'bound_solution_id', 'tags']) {
        if (body[field] !== undefined) {
          issues[issueIndex][field] = body[field];
          updates.push(field);
        }
      }

      issues[issueIndex].updated_at = new Date().toISOString();
      writeIssuesJsonl(issuesDir, issues);
      return { success: true, issueId, updated: updates };
    });
    return true;
  }

  // ===== Attachment Routes =====

  // POST /api/issues/:id/attachments - Upload attachment
  const uploadAttachmentMatch = pathname.match(/^\/api\/issues\/([^/]+)\/attachments$/);
  if (uploadAttachmentMatch && req.method === 'POST') {
    const issueId = decodeURIComponent(uploadAttachmentMatch[1]);

    // Check if issue exists
    const issues = readIssuesJsonl(issuesDir);
    const issueIndex = issues.findIndex(i => i.id === issueId);
    if (issueIndex === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return true;
    }

    // Parse multipart form data
    try {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Content-Type must be multipart/form-data' }));
        return true;
      }

      const { files } = await parseMultipartFormData(req);

      if (files.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No files uploaded' }));
        return true;
      }

      const uploadedAttachments: Attachment[] = [];
      const attachmentsDir = getAttachmentsDir(issuesDir, issueId);
      if (!existsSync(attachmentsDir)) {
        mkdirSync(attachmentsDir, { recursive: true });
      }

      for (const file of files) {
        // Validate file size
        if (file.data.length > MAX_FILE_SIZE) {
          continue; // Skip files that are too large
        }

        // Validate MIME type (allow common types)
        if (!isValidMimeType(file.type)) {
          continue; // Skip invalid file types
        }

        // Generate safe filename
        const safeFilename = sanitizeFilename(file.filename);
        const filePath = join(attachmentsDir, safeFilename);

        // Save file
        writeFileSync(filePath, file.data);

        // Create attachment record
        const attachment: Attachment = {
          id: randomUUID(),
          filename: file.filename,
          path: `attachments/${issueId}/${safeFilename}`,
          type: file.type,
          size: file.data.length,
          uploaded_at: new Date().toISOString(),
        };

        uploadedAttachments.push(attachment);
      }

      if (uploadedAttachments.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No valid files uploaded. Check file size (max 10MB) and type.' }));
        return true;
      }

      // Update issue with attachments
      if (!issues[issueIndex].attachments) {
        issues[issueIndex].attachments = [];
      }
      issues[issueIndex].attachments!.push(...uploadedAttachments);
      issues[issueIndex].updated_at = new Date().toISOString();
      writeIssuesJsonl(issuesDir, issues);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        issueId,
        attachments: uploadedAttachments,
        count: uploadedAttachments.length,
      }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Failed to upload attachments' }));
    }
    return true;
  }

  // GET /api/issues/:id/attachments - List attachments
  const listAttachmentsMatch = pathname.match(/^\/api\/issues\/([^/]+)\/attachments$/);
  if (listAttachmentsMatch && req.method === 'GET') {
    const issueId = decodeURIComponent(listAttachmentsMatch[1]);

    const issues = readIssuesJsonl(issuesDir);
    const issue = issues.find(i => i.id === issueId);

    if (!issue) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return true;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      issueId,
      attachments: issue.attachments || [],
      count: (issue.attachments || []).length,
    }));
    return true;
  }

  // DELETE /api/issues/:id/attachments/:attachmentId - Delete attachment
  const deleteAttachmentMatch = pathname.match(/^\/api\/issues\/([^/]+)\/attachments\/([^/]+)$/);
  if (deleteAttachmentMatch && req.method === 'DELETE') {
    const issueId = decodeURIComponent(deleteAttachmentMatch[1]);
    const attachmentId = decodeURIComponent(deleteAttachmentMatch[2]);

    const issues = readIssuesJsonl(issuesDir);
    const issueIndex = issues.findIndex(i => i.id === issueId);

    if (issueIndex === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return true;
    }

    const issue = issues[issueIndex];
    if (!issue.attachments || issue.attachments.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No attachments found' }));
      return true;
    }

    const attachmentIndex = issue.attachments.findIndex((a: Attachment) => a.id === attachmentId);
    if (attachmentIndex === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Attachment not found' }));
      return true;
    }

    const attachment = issue.attachments[attachmentIndex];

    // Delete file from disk
    const filePath = join(issuesDir, attachment.path);
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch {
        // Ignore file deletion errors
      }
    }

    // Remove from issue
    issue.attachments.splice(attachmentIndex, 1);
    issue.updated_at = new Date().toISOString();
    writeIssuesJsonl(issuesDir, issues);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      issueId,
      deletedAttachmentId: attachmentId,
    }));
    return true;
  }

  // GET /api/issues/files/:issueId/:filename - Get/download file
  const fileMatch = pathname.match(/^\/api\/issues\/files\/([^/]+)\/(.+)$/);
  if (fileMatch && req.method === 'GET') {
    const issueId = decodeURIComponent(fileMatch[1]);
    const filename = decodeURIComponent(fileMatch[2]);

    // Verify the file belongs to this issue
    const issues = readIssuesJsonl(issuesDir);
    const issue = issues.find(i => i.id === issueId);

    if (!issue) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return true;
    }

    // Find attachment by filename (check both original and sanitized name)
    const attachment = (issue.attachments || []).find((a: Attachment) =>
      a.path.endsWith(filename) ||
      a.filename === filename
    );

    if (!attachment) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return true;
    }

    const filePath = join(issuesDir, attachment.path);
    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found on disk' }));
      return true;
    }

    try {
      const stat = statSync(filePath);
      res.writeHead(200, {
        'Content-Type': attachment.type,
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
      });
      const fileStream = createReadStream(filePath);
      fileStream.pipe(res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read file' }));
    }
    return true;
  }

  return false;
}
