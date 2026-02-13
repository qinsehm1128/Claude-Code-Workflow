/**
 * Memory Job Scheduler - Lease-based job scheduling backed by SQLite
 *
 * Provides atomic claim/release/heartbeat operations for coordinating
 * concurrent memory extraction and consolidation jobs.
 *
 * All state lives in the `jobs` table of the CoreMemoryStore database.
 * Concurrency control uses ownership_token + lease_until for distributed-safe
 * (but single-process) job dispatch.
 */

import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { LEASE_SECONDS, MAX_RETRIES, RETRY_DELAY_SECONDS } from './memory-v2-config.js';

// -- Types --

export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export interface JobRecord {
  kind: string;
  job_key: string;
  status: JobStatus;
  worker_id?: string;
  ownership_token?: string;
  started_at?: number;
  finished_at?: number;
  lease_until?: number;
  retry_at?: number;
  retry_remaining: number;
  last_error?: string;
  input_watermark: number;
  last_success_watermark: number;
}

export interface ClaimResult {
  claimed: boolean;
  ownership_token?: string;
  reason?: 'already_running' | 'retry_exhausted' | 'retry_pending' | 'concurrency_limit';
}

// -- Scheduler --

export class MemoryJobScheduler {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Atomically claim a job for processing.
   *
   * Logic:
   * 1. If job does not exist, insert it as 'running' with a fresh token.
   * 2. If job exists and is 'pending', transition to 'running'.
   * 3. If job exists and is 'running' but lease expired, reclaim it.
   * 4. If job exists and is 'error' with retry_remaining > 0 and retry_at <= now, reclaim it.
   * 5. Otherwise, return not claimed with reason.
   *
   * Respects maxConcurrent: total running jobs of this `kind` must not exceed limit.
   */
  claimJob(kind: string, jobKey: string, maxConcurrent: number, workerId?: string): ClaimResult {
    const now = Math.floor(Date.now() / 1000);
    const token = randomUUID();
    const leaseUntil = now + LEASE_SECONDS;

    // Use a transaction for atomicity
    const result = this.db.transaction(() => {
      // Check concurrency limit for this kind
      const runningCount = this.db.prepare(
        `SELECT COUNT(*) as cnt FROM jobs WHERE kind = ? AND status = 'running' AND lease_until > ?`
      ).get(kind, now) as { cnt: number };

      const existing = this.db.prepare(
        `SELECT * FROM jobs WHERE kind = ? AND job_key = ?`
      ).get(kind, jobKey) as any | undefined;

      if (!existing) {
        // No job row yet - check concurrency before inserting
        if (runningCount.cnt >= maxConcurrent) {
          return { claimed: false, reason: 'concurrency_limit' as const };
        }

        this.db.prepare(`
          INSERT INTO jobs (kind, job_key, status, worker_id, ownership_token, started_at, lease_until, retry_remaining, input_watermark, last_success_watermark)
          VALUES (?, ?, 'running', ?, ?, ?, ?, ?, 0, 0)
        `).run(kind, jobKey, workerId || null, token, now, leaseUntil, MAX_RETRIES);

        return { claimed: true, ownership_token: token };
      }

      // Job exists - check status transitions
      if (existing.status === 'done') {
        // Already done - check dirty (input_watermark > last_success_watermark)
        if (existing.input_watermark <= existing.last_success_watermark) {
          return { claimed: false, reason: 'already_running' as const };
        }
        // Dirty - re-run
        if (runningCount.cnt >= maxConcurrent) {
          return { claimed: false, reason: 'concurrency_limit' as const };
        }
        this.db.prepare(`
          UPDATE jobs SET status = 'running', worker_id = ?, ownership_token = ?,
            started_at = ?, lease_until = ?, finished_at = NULL, last_error = NULL,
            retry_remaining = ?
          WHERE kind = ? AND job_key = ?
        `).run(workerId || null, token, now, leaseUntil, MAX_RETRIES, kind, jobKey);
        return { claimed: true, ownership_token: token };
      }

      if (existing.status === 'running') {
        // Running - check lease expiry
        if (existing.lease_until > now) {
          return { claimed: false, reason: 'already_running' as const };
        }
        // Lease expired - reclaim if concurrency allows
        // The expired job doesn't count towards running total (lease_until <= now),
        // so runningCount already excludes it.
        if (runningCount.cnt >= maxConcurrent) {
          return { claimed: false, reason: 'concurrency_limit' as const };
        }
        this.db.prepare(`
          UPDATE jobs SET worker_id = ?, ownership_token = ?, started_at = ?,
            lease_until = ?, last_error = NULL
          WHERE kind = ? AND job_key = ?
        `).run(workerId || null, token, now, leaseUntil, kind, jobKey);
        return { claimed: true, ownership_token: token };
      }

      if (existing.status === 'pending') {
        if (runningCount.cnt >= maxConcurrent) {
          return { claimed: false, reason: 'concurrency_limit' as const };
        }
        this.db.prepare(`
          UPDATE jobs SET status = 'running', worker_id = ?, ownership_token = ?,
            started_at = ?, lease_until = ?
          WHERE kind = ? AND job_key = ?
        `).run(workerId || null, token, now, leaseUntil, kind, jobKey);
        return { claimed: true, ownership_token: token };
      }

      if (existing.status === 'error') {
        if (existing.retry_remaining <= 0) {
          return { claimed: false, reason: 'retry_exhausted' as const };
        }
        if (existing.retry_at && existing.retry_at > now) {
          return { claimed: false, reason: 'retry_pending' as const };
        }
        if (runningCount.cnt >= maxConcurrent) {
          return { claimed: false, reason: 'concurrency_limit' as const };
        }
        this.db.prepare(`
          UPDATE jobs SET status = 'running', worker_id = ?, ownership_token = ?,
            started_at = ?, lease_until = ?, last_error = NULL,
            retry_remaining = retry_remaining - 1
          WHERE kind = ? AND job_key = ?
        `).run(workerId || null, token, now, leaseUntil, kind, jobKey);
        return { claimed: true, ownership_token: token };
      }

      return { claimed: false, reason: 'already_running' as const };
    })();

    return result;
  }

  /**
   * Release a job, marking it as done or error.
   * Only succeeds if the ownership_token matches.
   */
  releaseJob(kind: string, jobKey: string, token: string, status: 'done' | 'error', error?: string): boolean {
    const now = Math.floor(Date.now() / 1000);

    const result = this.db.prepare(`
      UPDATE jobs SET
        status = ?,
        finished_at = ?,
        lease_until = NULL,
        ownership_token = NULL,
        worker_id = NULL,
        last_error = ?
      WHERE kind = ? AND job_key = ? AND ownership_token = ?
    `).run(status, now, error || null, kind, jobKey, token);

    return result.changes > 0;
  }

  /**
   * Renew the lease for an active job.
   * Returns false if ownership_token does not match or job is not running.
   */
  heartbeat(kind: string, jobKey: string, token: string, leaseSeconds: number = LEASE_SECONDS): boolean {
    const now = Math.floor(Date.now() / 1000);
    const newLeaseUntil = now + leaseSeconds;

    const result = this.db.prepare(`
      UPDATE jobs SET lease_until = ?
      WHERE kind = ? AND job_key = ? AND ownership_token = ? AND status = 'running'
    `).run(newLeaseUntil, kind, jobKey, token);

    return result.changes > 0;
  }

  /**
   * Enqueue a job or update its input_watermark.
   * Uses MAX(existing, new) for watermark to ensure monotonicity.
   * If job doesn't exist, creates it in 'pending' status.
   */
  enqueueJob(kind: string, jobKey: string, inputWatermark: number): void {
    this.db.prepare(`
      INSERT INTO jobs (kind, job_key, status, retry_remaining, input_watermark, last_success_watermark)
      VALUES (?, ?, 'pending', ?, ?, 0)
      ON CONFLICT(kind, job_key) DO UPDATE SET
        input_watermark = MAX(jobs.input_watermark, excluded.input_watermark)
    `).run(kind, jobKey, MAX_RETRIES, inputWatermark);
  }

  /**
   * Mark a job as successfully completed and update success watermark.
   * Only succeeds if ownership_token matches.
   */
  markSucceeded(kind: string, jobKey: string, token: string, watermark: number): boolean {
    const now = Math.floor(Date.now() / 1000);

    const result = this.db.prepare(`
      UPDATE jobs SET
        status = 'done',
        finished_at = ?,
        lease_until = NULL,
        ownership_token = NULL,
        worker_id = NULL,
        last_error = NULL,
        last_success_watermark = ?
      WHERE kind = ? AND job_key = ? AND ownership_token = ?
    `).run(now, watermark, kind, jobKey, token);

    return result.changes > 0;
  }

  /**
   * Mark a job as failed with error message and schedule retry.
   * Only succeeds if ownership_token matches.
   */
  markFailed(kind: string, jobKey: string, token: string, error: string, retryDelay: number = RETRY_DELAY_SECONDS): boolean {
    const now = Math.floor(Date.now() / 1000);
    const retryAt = now + retryDelay;

    const result = this.db.prepare(`
      UPDATE jobs SET
        status = 'error',
        finished_at = ?,
        lease_until = NULL,
        ownership_token = NULL,
        worker_id = NULL,
        last_error = ?,
        retry_at = ?
      WHERE kind = ? AND job_key = ? AND ownership_token = ?
    `).run(now, error, retryAt, kind, jobKey, token);

    return result.changes > 0;
  }

  /**
   * Get current status of a specific job.
   */
  getJobStatus(kind: string, jobKey: string): JobRecord | null {
    const row = this.db.prepare(
      `SELECT * FROM jobs WHERE kind = ? AND job_key = ?`
    ).get(kind, jobKey) as any;

    if (!row) return null;
    return this.rowToJobRecord(row);
  }

  /**
   * List jobs, optionally filtered by kind and/or status.
   */
  listJobs(kind?: string, status?: JobStatus): JobRecord[] {
    let query = 'SELECT * FROM jobs';
    const params: any[] = [];
    const conditions: string[] = [];

    if (kind) {
      conditions.push('kind = ?');
      params.push(kind);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY kind, job_key';

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => this.rowToJobRecord(row));
  }

  /**
   * Check if a job is dirty (input_watermark > last_success_watermark).
   */
  isDirty(kind: string, jobKey: string): boolean {
    const row = this.db.prepare(
      `SELECT input_watermark, last_success_watermark FROM jobs WHERE kind = ? AND job_key = ?`
    ).get(kind, jobKey) as any;

    if (!row) return false;
    return row.input_watermark > row.last_success_watermark;
  }

  /**
   * Convert a database row to a typed JobRecord.
   */
  private rowToJobRecord(row: any): JobRecord {
    return {
      kind: row.kind,
      job_key: row.job_key,
      status: row.status,
      worker_id: row.worker_id || undefined,
      ownership_token: row.ownership_token || undefined,
      started_at: row.started_at || undefined,
      finished_at: row.finished_at || undefined,
      lease_until: row.lease_until || undefined,
      retry_at: row.retry_at || undefined,
      retry_remaining: row.retry_remaining,
      last_error: row.last_error || undefined,
      input_watermark: row.input_watermark ?? 0,
      last_success_watermark: row.last_success_watermark ?? 0,
    };
  }
}
