import { existsSync, mkdirSync, appendFileSync } from 'fs';
import path from 'path';

export type CliSessionAuditEventType =
  | 'session_created'
  | 'session_closed'
  | 'session_paused'
  | 'session_resumed'
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

function auditFilePath(projectRoot: string): string {
  return path.join(projectRoot, '.workflow', 'audit', 'cli-sessions.jsonl');
}

export function appendCliSessionAudit(event: CliSessionAuditEvent): void {
  try {
    const filePath = auditFilePath(event.projectRoot);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(filePath, JSON.stringify(event) + '\n', { encoding: 'utf8' });
  } catch {
    // Best-effort: never fail API requests due to audit write errors.
  }
}
