import { randomBytes } from 'crypto';

export interface CsrfTokenManagerOptions {
  tokenTtlMs?: number;
  cleanupIntervalMs?: number;
  maxTokensPerSession?: number;
}

type CsrfTokenRecord = {
  sessionId: string;
  expiresAtMs: number;
  used: boolean;
};

const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_TOKENS_PER_SESSION = 5;

export class CsrfTokenManager {
  private readonly tokenTtlMs: number;
  private readonly maxTokensPerSession: number;
  // sessionId -> (token -> record) - supports multiple tokens per session
  private readonly sessionTokens = new Map<string, Map<string, CsrfTokenRecord>>();
  // Quick lookup: token -> sessionId for validation
  private readonly tokenToSession = new Map<string, string>();
  private readonly cleanupTimer: NodeJS.Timeout | null;

  constructor(options: CsrfTokenManagerOptions = {}) {
    this.tokenTtlMs = options.tokenTtlMs ?? DEFAULT_TOKEN_TTL_MS;
    this.maxTokensPerSession = options.maxTokensPerSession ?? DEFAULT_MAX_TOKENS_PER_SESSION;

    const cleanupIntervalMs = options.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
    if (cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredTokens();
      }, cleanupIntervalMs);

      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    } else {
      this.cleanupTimer = null;
    }
  }

  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.sessionTokens.clear();
    this.tokenToSession.clear();
  }

  /**
   * Generate a single CSRF token for a session
   */
  generateToken(sessionId: string): string {
    const tokens = this.generateTokens(sessionId, 1);
    // If no slots available (session at max capacity), force generate anyway
    // This ensures we always return a valid token
    if (tokens.length === 0) {
      const token = randomBytes(32).toString('hex');
      const expiresAtMs = Date.now() + this.tokenTtlMs;
      const record: CsrfTokenRecord = {
        sessionId,
        expiresAtMs,
        used: false,
      };
      // Get or create session map
      let sessionMap = this.sessionTokens.get(sessionId);
      if (!sessionMap) {
        sessionMap = new Map();
        this.sessionTokens.set(sessionId, sessionMap);
      }
      sessionMap.set(token, record);
      this.tokenToSession.set(token, sessionId);
      return token;
    }
    return tokens[0];
  }

  /**
   * Generate multiple CSRF tokens for a session (pool pattern)
   * @param sessionId - Session identifier
   * @param count - Number of tokens to generate (max: maxTokensPerSession)
   * @returns Array of generated tokens
   */
  generateTokens(sessionId: string, count: number): string[] {
    // Get or create session token map
    let sessionMap = this.sessionTokens.get(sessionId);
    if (!sessionMap) {
      sessionMap = new Map();
      this.sessionTokens.set(sessionId, sessionMap);
    }

    // Limit count to max tokens per session
    const currentCount = sessionMap.size;
    const availableSlots = Math.max(0, this.maxTokensPerSession - currentCount);
    const tokensToGenerate = Math.min(count, availableSlots);

    const tokens: string[] = [];
    const expiresAtMs = Date.now() + this.tokenTtlMs;

    for (let i = 0; i < tokensToGenerate; i++) {
      const token = randomBytes(32).toString('hex');
      const record: CsrfTokenRecord = {
        sessionId,
        expiresAtMs,
        used: false,
      };
      sessionMap.set(token, record);
      this.tokenToSession.set(token, sessionId);
      tokens.push(token);
    }

    return tokens;
  }

  /**
   * Validate a CSRF token against a session
   * Marks token as used (single-use) on successful validation
   */
  validateToken(token: string, sessionId: string): boolean {
    // Quick lookup: get session from token
    const tokenSessionId = this.tokenToSession.get(token);
    if (!tokenSessionId) return false;
    if (tokenSessionId !== sessionId) return false;

    // Get session's token map
    const sessionMap = this.sessionTokens.get(sessionId);
    if (!sessionMap) return false;

    // Get token record
    const record = sessionMap.get(token);
    if (!record) return false;
    if (record.used) return false;

    // Check expiration
    if (Date.now() > record.expiresAtMs) {
      this.removeToken(token, sessionId);
      return false;
    }

    // Mark as used (single-use enforcement)
    record.used = true;
    return true;
  }

  /**
   * Remove a token from the pool
   */
  private removeToken(token: string, sessionId: string): void {
    const sessionMap = this.sessionTokens.get(sessionId);
    if (sessionMap) {
      sessionMap.delete(token);
      // Clean up empty session maps
      if (sessionMap.size === 0) {
        this.sessionTokens.delete(sessionId);
      }
    }
    this.tokenToSession.delete(token);
  }

  /**
   * Get the number of active tokens for a session
   */
  getTokenCount(sessionId: string): number {
    const sessionMap = this.sessionTokens.get(sessionId);
    return sessionMap ? sessionMap.size : 0;
  }

  /**
   * Get total number of active tokens across all sessions
   */
  getActiveTokenCount(): number {
    return this.tokenToSession.size;
  }

  /**
   * Clean up expired and used tokens
   */
  cleanupExpiredTokens(nowMs: number = Date.now()): number {
    let removed = 0;

    for (const [sessionId, sessionMap] of this.sessionTokens.entries()) {
      for (const [token, record] of sessionMap.entries()) {
        if (record.used || nowMs > record.expiresAtMs) {
          sessionMap.delete(token);
          this.tokenToSession.delete(token);
          removed += 1;
        }
      }
      // Clean up empty session maps
      if (sessionMap.size === 0) {
        this.sessionTokens.delete(sessionId);
      }
    }

    return removed;
  }
}

let csrfManagerInstance: CsrfTokenManager | null = null;

export function getCsrfTokenManager(options?: CsrfTokenManagerOptions): CsrfTokenManager {
  if (!csrfManagerInstance) {
    csrfManagerInstance = new CsrfTokenManager(options);
  }
  return csrfManagerInstance;
}

export function resetCsrfTokenManager(): void {
  if (csrfManagerInstance) {
    csrfManagerInstance.dispose();
  }
  csrfManagerInstance = null;
}

