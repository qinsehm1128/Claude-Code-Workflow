import { randomBytes } from 'crypto';

export type CliSessionShareMode = 'read' | 'write';

export interface CliSessionShareTokenRecord {
  token: string;
  sessionKey: string;
  projectRoot: string;
  mode: CliSessionShareMode;
  expiresAt: string;
}

interface InternalTokenRecord extends CliSessionShareTokenRecord {
  expiresAtMs: number;
}

function createTokenValue(): string {
  // 32 bytes => 43 chars base64url (approx), safe for URLs.
  return randomBytes(32).toString('base64url');
}

export class CliSessionShareManager {
  private tokens = new Map<string, InternalTokenRecord>();

  listTokensForSession(sessionKey: string, projectRoot?: string): CliSessionShareTokenRecord[] {
    this.cleanupExpired();
    const records: CliSessionShareTokenRecord[] = [];
    for (const record of this.tokens.values()) {
      if (record.sessionKey !== sessionKey) continue;
      if (projectRoot && record.projectRoot !== projectRoot) continue;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { expiresAtMs: _expiresAtMs, ...publicRecord } = record;
      records.push(publicRecord);
    }
    records.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
    return records;
  }

  createToken(input: {
    sessionKey: string;
    projectRoot: string;
    mode: CliSessionShareMode;
    ttlMs?: number;
  }): CliSessionShareTokenRecord {
    const ttlMs = typeof input.ttlMs === 'number' ? Math.max(1_000, input.ttlMs) : 24 * 60 * 60_000;
    const expiresAtMs = Date.now() + ttlMs;
    const record: InternalTokenRecord = {
      token: createTokenValue(),
      sessionKey: input.sessionKey,
      projectRoot: input.projectRoot,
      mode: input.mode,
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
    };
    this.tokens.set(record.token, record);
    return record;
  }

  validateToken(token: string, sessionKey: string): CliSessionShareTokenRecord | null {
    const record = this.tokens.get(token);
    if (!record) return null;
    if (record.sessionKey !== sessionKey) return null;
    if (Date.now() >= record.expiresAtMs) {
      this.tokens.delete(token);
      return null;
    }
    const { expiresAtMs: _expiresAtMs, ...publicRecord } = record;
    return publicRecord;
  }

  revokeToken(token: string): boolean {
    return this.tokens.delete(token);
  }

  cleanupExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [token, record] of this.tokens) {
      if (now >= record.expiresAtMs) {
        this.tokens.delete(token);
        removed += 1;
      }
    }
    return removed;
  }
}

let singleton: CliSessionShareManager | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function getCliSessionShareManager(): CliSessionShareManager {
  if (!singleton) {
    singleton = new CliSessionShareManager();
    cleanupTimer = setInterval(() => {
      try {
        singleton?.cleanupExpired();
      } catch {
        // ignore
      }
    }, 60_000);
    cleanupTimer.unref?.();
  }
  return singleton;
}

export function describeShareAuthFailure(): { error: string; status: number } {
  return { error: 'Invalid or expired share token', status: 403 };
}
