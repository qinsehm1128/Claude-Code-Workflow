/**
 * CLI History Store - SQLite Storage Backend
 * Provides persistent storage for CLI execution history with efficient queries
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, rmdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { parseSessionFile, formatConversation, extractConversationPairs, type ParsedSession, type ParsedTurn } from './session-content-parser.js';
import { StoragePaths, ensureStorageDir, getProjectId, getCCWHome } from '../config/storage-paths.js';
import type { CliOutputUnit } from './cli-output-converter.js';

// Types
export interface ConversationTurn {
  turn: number;
  timestamp: string;
  prompt: string;
  duration_ms: number;
  status: 'success' | 'error' | 'timeout';
  exit_code: number | null;
  // NOTE: Naming inconsistency - using prompt/stdout vs tool_args/tool_output in MemoryStore
  // This reflects CLI-specific semantics (prompt -> execution -> output)
  output: {
    stdout: string;
    stderr: string;
    truncated: boolean;
    cached?: boolean;
    stdout_full?: string;
    stderr_full?: string;
    parsed_output?: string;  // Filtered output (intermediate content removed)
    final_output?: string;  // Agent message only (for --final flag)
    structured?: CliOutputUnit[];  // Structured IR sequence for advanced parsing
  };
}

// Execution category types
export type ExecutionCategory = 'user' | 'internal' | 'insight';

export interface ConversationRecord {
  id: string;
  created_at: string;
  updated_at: string;
  tool: string;
  model: string;
  mode: string;
  category: ExecutionCategory; // user | internal | insight
  total_duration_ms: number;
  turn_count: number;
  latest_status: 'success' | 'error' | 'timeout';
  turns: ConversationTurn[];
  parent_execution_id?: string; // For fork/retry scenarios
}

export interface HistoryQueryOptions {
  limit?: number;
  offset?: number;
  tool?: string | null;
  status?: string | null;
  category?: ExecutionCategory | null;
  search?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface HistoryIndexEntry {
  id: string;
  timestamp: string;
  updated_at?: string;
  tool: string;
  status: string;
  category?: ExecutionCategory;
  duration_ms: number;
  turn_count?: number;
  prompt_preview: string;
  sourceDir?: string;
}

// Native session mapping interface
export interface NativeSessionMapping {
  ccw_id: string;              // CCW execution ID (e.g., 1702123456789-gemini)
  tool: string;                // gemini | qwen | codex
  native_session_id: string;   // Native UUID
  native_session_path?: string; // Native file path
  project_hash?: string;       // Project hash (Gemini/Qwen)
  transaction_id?: string;     // Transaction ID for concurrent session disambiguation
  created_at: string;
}

// Review record interface
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface ReviewRecord {
  id?: number;
  execution_id: string;
  status: ReviewStatus;
  rating?: number;
  comments?: string;
  reviewer?: string;
  created_at: string;
  updated_at: string;
}

/**
 * CLI History Store using SQLite
 */
export class CliHistoryStore {
  private db: Database.Database;
  private dbPath: string;
  private projectPath: string;

  constructor(baseDir: string) {
    this.projectPath = baseDir;

    // Use centralized storage path
    const paths = StoragePaths.project(baseDir);
    const historyDir = paths.cliHistory;
    ensureStorageDir(historyDir);

    this.dbPath = paths.historyDb;
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('busy_timeout = 5000');  // Wait up to 5 seconds for locks

    this.initSchema();
    this.migrateFromJson(historyDir);
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    this.db.exec(`
      -- Conversations table (conversation metadata)
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        tool TEXT NOT NULL,
        model TEXT DEFAULT 'default',
        mode TEXT DEFAULT 'analysis',
        category TEXT DEFAULT 'user',
        total_duration_ms INTEGER DEFAULT 0,
        turn_count INTEGER DEFAULT 0,
        latest_status TEXT DEFAULT 'success',
        prompt_preview TEXT,
        parent_execution_id TEXT,
        FOREIGN KEY (parent_execution_id) REFERENCES conversations(id) ON DELETE SET NULL
      );

      -- Turns table (individual conversation turns)
      CREATE TABLE IF NOT EXISTS turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        turn_number INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        prompt TEXT NOT NULL,
        duration_ms INTEGER DEFAULT 0,
        status TEXT DEFAULT 'success',
        exit_code INTEGER,
        stdout TEXT,
        stderr TEXT,
        truncated INTEGER DEFAULT 0,
        cached INTEGER DEFAULT 0,
        stdout_full TEXT,
        stderr_full TEXT,
        parsed_output TEXT,
        final_output TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        UNIQUE(conversation_id, turn_number)
      );

      -- Indexes for efficient queries
      CREATE INDEX IF NOT EXISTS idx_conversations_tool ON conversations(tool);
      CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(latest_status);
      CREATE INDEX IF NOT EXISTS idx_conversations_category ON conversations(category);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_turns_conversation ON turns(conversation_id);

      -- Full-text search for prompts
      CREATE VIRTUAL TABLE IF NOT EXISTS turns_fts USING fts5(
        prompt,
        stdout,
        content='turns',
        content_rowid='id'
      );

      -- Triggers to keep FTS index updated
      CREATE TRIGGER IF NOT EXISTS turns_ai AFTER INSERT ON turns BEGIN
        INSERT INTO turns_fts(rowid, prompt, stdout) VALUES (new.id, new.prompt, new.stdout);
      END;

      CREATE TRIGGER IF NOT EXISTS turns_ad AFTER DELETE ON turns BEGIN
        INSERT INTO turns_fts(turns_fts, rowid, prompt, stdout) VALUES('delete', old.id, old.prompt, old.stdout);
      END;

      CREATE TRIGGER IF NOT EXISTS turns_au AFTER UPDATE ON turns BEGIN
        INSERT INTO turns_fts(turns_fts, rowid, prompt, stdout) VALUES('delete', old.id, old.prompt, old.stdout);
        INSERT INTO turns_fts(rowid, prompt, stdout) VALUES (new.id, new.prompt, new.stdout);
      END;

      -- Native session mapping table (CCW ID <-> Native Session ID)
      CREATE TABLE IF NOT EXISTS native_session_mapping (
        ccw_id TEXT PRIMARY KEY,
        tool TEXT NOT NULL,
        native_session_id TEXT NOT NULL,
        native_session_path TEXT,
        project_hash TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tool, native_session_id)
      );

      -- Indexes for native session lookups
      CREATE INDEX IF NOT EXISTS idx_native_tool_session ON native_session_mapping(tool, native_session_id);
      CREATE INDEX IF NOT EXISTS idx_native_session_id ON native_session_mapping(native_session_id);

      -- Insights analysis history table
      CREATE TABLE IF NOT EXISTS insights (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        tool TEXT NOT NULL,
        prompt_count INTEGER DEFAULT 0,
        patterns TEXT,
        suggestions TEXT,
        raw_output TEXT,
        execution_id TEXT,
        lang TEXT DEFAULT 'en'
      );

      CREATE INDEX IF NOT EXISTS idx_insights_created ON insights(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_insights_tool ON insights(tool);

      -- Reviews table for CLI execution reviews
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        rating INTEGER,
        comments TEXT,
        reviewer TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (execution_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_reviews_execution ON reviews(execution_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
      CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);
    `);

    // Migration: Add category column if not exists (for existing databases)
    this.migrateSchema();
  }

  /**
   * Migrate schema for existing databases
   */
  private migrateSchema(): void {
    try {
      // Check if columns exist
      const tableInfo = this.db.prepare('PRAGMA table_info(conversations)').all() as Array<{ name: string }>;
      const hasCategory = tableInfo.some(col => col.name === 'category');
      const hasParentExecutionId = tableInfo.some(col => col.name === 'parent_execution_id');
      const hasProjectRoot = tableInfo.some(col => col.name === 'project_root');
      const hasRelativePath = tableInfo.some(col => col.name === 'relative_path');

      if (!hasCategory) {
        console.log('[CLI History] Migrating database: adding category column...');
        this.db.exec(`
          ALTER TABLE conversations ADD COLUMN category TEXT DEFAULT 'user';
        `);
        // Create index separately to handle potential errors
        try {
          this.db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_category ON conversations(category);`);
        } catch (indexErr) {
          console.warn('[CLI History] Category index creation warning:', (indexErr as Error).message);
        }
        console.log('[CLI History] Migration complete: category column added');
      }

      if (!hasParentExecutionId) {
        console.log('[CLI History] Migrating database: adding parent_execution_id column...');
        this.db.exec(`
          ALTER TABLE conversations ADD COLUMN parent_execution_id TEXT;
        `);
        try {
          this.db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_parent ON conversations(parent_execution_id);`);
        } catch (indexErr) {
          console.warn('[CLI History] Parent execution index creation warning:', (indexErr as Error).message);
        }
        console.log('[CLI History] Migration complete: parent_execution_id column added');
      }

      // Add hierarchical storage support columns
      if (!hasProjectRoot) {
        console.log('[CLI History] Migrating database: adding project_root column for hierarchical storage...');
        this.db.exec(`
          ALTER TABLE conversations ADD COLUMN project_root TEXT;
        `);
        try {
          this.db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_project_root ON conversations(project_root);`);
        } catch (indexErr) {
          console.warn('[CLI History] Project root index creation warning:', (indexErr as Error).message);
        }
        console.log('[CLI History] Migration complete: project_root column added');
      }

      if (!hasRelativePath) {
        console.log('[CLI History] Migrating database: adding relative_path column for hierarchical storage...');
        this.db.exec(`
          ALTER TABLE conversations ADD COLUMN relative_path TEXT;
        `);
        console.log('[CLI History] Migration complete: relative_path column added');
      }

      // Add missing timestamp index for turns table (for time-based queries)
      try {
        const indexExists = this.db.prepare(`
          SELECT name FROM sqlite_master
          WHERE type='index' AND name='idx_turns_timestamp'
        `).get();

        if (!indexExists) {
          console.log('[CLI History] Adding missing timestamp index to turns table...');
          this.db.exec(`CREATE INDEX IF NOT EXISTS idx_turns_timestamp ON turns(timestamp DESC);`);
          console.log('[CLI History] Migration complete: turns timestamp index added');
        }
      } catch (indexErr) {
        console.warn('[CLI History] Turns timestamp index creation warning:', (indexErr as Error).message);
      }

      // Add cached output columns to turns table for non-streaming mode
      const turnsInfo = this.db.prepare('PRAGMA table_info(turns)').all() as Array<{ name: string }>;
      const turnsColumns = new Set(turnsInfo.map(col => col.name));

      // Collect all missing columns
      const missingTurnsColumns: string[] = [];
      const turnsColumnDefs: Record<string, string> = {
        'cached': 'INTEGER DEFAULT 0',
        'stdout_full': 'TEXT',
        'stderr_full': 'TEXT',
        'parsed_output': 'TEXT',
        'final_output': 'TEXT'
      };

      // Silently detect missing columns
      for (const [col, def] of Object.entries(turnsColumnDefs)) {
        if (!turnsColumns.has(col)) {
          missingTurnsColumns.push(col);
        }
      }

      // Batch migration - only output log if there are columns to migrate
      if (missingTurnsColumns.length > 0) {
        console.log(`[CLI History] Migrating turns table: adding ${missingTurnsColumns.length} columns (${missingTurnsColumns.join(', ')})...`);

        for (const col of missingTurnsColumns) {
          this.db.exec(`ALTER TABLE turns ADD COLUMN ${col} ${turnsColumnDefs[col]};`);
        }

        console.log('[CLI History] Migration complete: turns table updated');
      }

      // Add transaction_id column to native_session_mapping table for concurrent session disambiguation
      const mappingInfo = this.db.prepare('PRAGMA table_info(native_session_mapping)').all() as Array<{ name: string }>;
      const hasTransactionId = mappingInfo.some(col => col.name === 'transaction_id');

      if (!hasTransactionId) {
        console.log('[CLI History] Migrating database: adding transaction_id column to native_session_mapping...');
        this.db.exec(`
          ALTER TABLE native_session_mapping ADD COLUMN transaction_id TEXT;
        `);
        try {
          this.db.exec(`CREATE INDEX IF NOT EXISTS idx_native_transaction_id ON native_session_mapping(transaction_id);`);
        } catch (indexErr) {
          console.warn('[CLI History] Transaction ID index creation warning:', (indexErr as Error).message);
        }
        console.log('[CLI History] Migration complete: transaction_id column added');
      }
    } catch (err) {
      console.error('[CLI History] Migration error:', (err as Error).message);
      // Don't throw - allow the store to continue working with existing schema
    }
  }

  /**
   * Execute a database operation with retry logic for SQLITE_BUSY errors
   * @param operation - Function to execute
   * @param maxRetries - Maximum retry attempts (default: 3)
   * @param baseDelay - Base delay in ms for exponential backoff (default: 100)
   */
  private withRetry<T>(operation: () => T, maxRetries = 3, baseDelay = 100): T {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return operation();
      } catch (err) {
        const error = err as Error;
        // Check if it's a SQLITE_BUSY error
        if (error.message?.includes('SQLITE_BUSY') || error.message?.includes('database is locked')) {
          lastError = error;
          if (attempt < maxRetries) {
            // Exponential backoff: 100ms, 200ms, 400ms
            const delay = baseDelay * Math.pow(2, attempt);
            // Sync sleep using Atomics (works in Node.js)
            const sharedBuffer = new SharedArrayBuffer(4);
            const sharedArray = new Int32Array(sharedBuffer);
            Atomics.wait(sharedArray, 0, 0, delay);
          }
        } else {
          // Non-BUSY error, throw immediately
          throw error;
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Migrate existing JSON files to SQLite
   */
  private migrateFromJson(historyDir: string): void {
    const migrationMarker = join(historyDir, '.migrated');
    if (existsSync(migrationMarker)) {
      return; // Already migrated
    }

    // Find all date directories
    const dateDirs = readdirSync(historyDir).filter(d => {
      const dirPath = join(historyDir, d);
      return statSync(dirPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d);
    });

    let migratedCount = 0;

    for (const dateDir of dateDirs) {
      const dirPath = join(historyDir, dateDir);
      const files = readdirSync(dirPath).filter(f => f.endsWith('.json'));

      for (const file of files) {
        try {
          const filePath = join(dirPath, file);
          const data = JSON.parse(readFileSync(filePath, 'utf8'));

          // Convert to conversation record if legacy format
          const conversation = this.normalizeRecord(data);
          this.saveConversation(conversation);
          migratedCount++;

          // Optionally delete the JSON file after migration
          // unlinkSync(filePath);
        } catch (err) {
          console.error(`Failed to migrate ${file}:`, (err as Error).message);
        }
      }
    }

    // Create migration marker
    if (migratedCount > 0) {
      require('fs').writeFileSync(migrationMarker, new Date().toISOString());
      console.log(`[CLI History] Migrated ${migratedCount} records to SQLite`);
    }
  }

  /**
   * Normalize legacy record to ConversationRecord format
   */
  private normalizeRecord(data: any): ConversationRecord {
    if (data.turns && Array.isArray(data.turns)) {
      return data as ConversationRecord;
    }

    // Legacy single execution format
    return {
      id: data.id,
      created_at: data.timestamp,
      updated_at: data.timestamp,
      tool: data.tool,
      model: data.model || 'default',
      mode: data.mode || 'analysis',
      category: data.category || 'user',
      total_duration_ms: data.duration_ms || 0,
      turn_count: 1,
      latest_status: data.status || 'success',
      turns: [{
        turn: 1,
        timestamp: data.timestamp,
        prompt: data.prompt,
        duration_ms: data.duration_ms || 0,
        status: data.status || 'success',
        exit_code: data.exit_code,
        output: data.output || { stdout: '', stderr: '', truncated: false }
      }]
    };
  }

  /**
   * Save or update a conversation
   */
  saveConversation(conversation: ConversationRecord): void {
    const promptPreview = conversation.turns.length > 0
      ? conversation.turns[conversation.turns.length - 1].prompt.substring(0, 100)
      : '';

    const upsertConversation = this.db.prepare(`
      INSERT INTO conversations (id, created_at, updated_at, tool, model, mode, category, total_duration_ms, turn_count, latest_status, prompt_preview, parent_execution_id, project_root, relative_path)
      VALUES (@id, @created_at, @updated_at, @tool, @model, @mode, @category, @total_duration_ms, @turn_count, @latest_status, @prompt_preview, @parent_execution_id, @project_root, @relative_path)
      ON CONFLICT(id) DO UPDATE SET
        updated_at = @updated_at,
        total_duration_ms = @total_duration_ms,
        turn_count = @turn_count,
        latest_status = @latest_status,
        prompt_preview = @prompt_preview,
        project_root = @project_root,
        relative_path = @relative_path
    `);

    const upsertTurn = this.db.prepare(`
      INSERT INTO turns (conversation_id, turn_number, timestamp, prompt, duration_ms, status, exit_code, stdout, stderr, truncated, cached, stdout_full, stderr_full, parsed_output, final_output)
      VALUES (@conversation_id, @turn_number, @timestamp, @prompt, @duration_ms, @status, @exit_code, @stdout, @stderr, @truncated, @cached, @stdout_full, @stderr_full, @parsed_output, @final_output)
      ON CONFLICT(conversation_id, turn_number) DO UPDATE SET
        timestamp = @timestamp,
        prompt = @prompt,
        duration_ms = @duration_ms,
        status = @status,
        exit_code = @exit_code,
        stdout = @stdout,
        stderr = @stderr,
        truncated = @truncated,
        cached = @cached,
        stdout_full = @stdout_full,
        stderr_full = @stderr_full,
        parsed_output = @parsed_output,
        final_output = @final_output
    `);

    const transaction = this.db.transaction(() => {
      upsertConversation.run({
        id: conversation.id,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        tool: conversation.tool,
        model: conversation.model,
        mode: conversation.mode,
        category: conversation.category || 'user',
        total_duration_ms: conversation.total_duration_ms,
        turn_count: conversation.turn_count,
        latest_status: conversation.latest_status,
        prompt_preview: promptPreview,
        parent_execution_id: conversation.parent_execution_id || null,
        project_root: this.projectPath,
        relative_path: null  // For future hierarchical tracking
      });

      for (const turn of conversation.turns) {
        upsertTurn.run({
          conversation_id: conversation.id,
          turn_number: turn.turn,
          timestamp: turn.timestamp,
          prompt: turn.prompt,
          duration_ms: turn.duration_ms,
          status: turn.status,
          exit_code: turn.exit_code,
          stdout: turn.output.stdout,
          stderr: turn.output.stderr,
          truncated: turn.output.truncated ? 1 : 0,
          cached: turn.output.cached ? 1 : 0,
          stdout_full: turn.output.stdout_full || null,
          stderr_full: turn.output.stderr_full || null,
          parsed_output: turn.output.parsed_output || null,
          final_output: turn.output.final_output || null
        });
      }
    });

    this.withRetry(() => transaction());
  }

  /**
   * Get conversation by ID
   */
  getConversation(id: string): ConversationRecord | null {
    const conv = this.db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `).get(id) as any;

    if (!conv) return null;

    const turns = this.db.prepare(`
      SELECT * FROM turns WHERE conversation_id = ? ORDER BY turn_number ASC
    `).all(id) as any[];

    return {
      id: conv.id,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      tool: conv.tool,
      model: conv.model,
      mode: conv.mode,
      category: conv.category || 'user',
      total_duration_ms: conv.total_duration_ms,
      turn_count: conv.turn_count,
      latest_status: conv.latest_status,
      parent_execution_id: conv.parent_execution_id || undefined,
      turns: turns.map(t => ({
        turn: t.turn_number,
        timestamp: t.timestamp,
        prompt: t.prompt,
        duration_ms: t.duration_ms,
        status: t.status,
        exit_code: t.exit_code,
        output: {
          stdout: t.stdout || '',
          stderr: t.stderr || '',
          truncated: !!t.truncated,
          cached: !!t.cached,
          stdout_full: t.stdout_full || undefined,
          stderr_full: t.stderr_full || undefined,
          parsed_output: t.parsed_output || undefined,
          final_output: t.final_output || undefined  // Agent message only for --final flag
        }
      }))
    };
  }

  /**
   * Get conversation with native session info
   */
  getConversationWithNativeInfo(id: string): (ConversationRecord & {
    hasNativeSession: boolean;
    nativeSessionId?: string;
    nativeSessionPath?: string;
  }) | null {
    const conv = this.getConversation(id);
    if (!conv) return null;

    const mapping = this.getNativeSessionMapping(id);
    return {
      ...conv,
      hasNativeSession: !!mapping,
      nativeSessionId: mapping?.native_session_id,
      nativeSessionPath: mapping?.native_session_path
    };
  }

  /**
   * Get paginated cached output for a conversation turn
   * @param conversationId - Conversation ID
   * @param turnNumber - Turn number (default: latest turn)
   * @param options - Pagination options
   */
  getCachedOutput(
    conversationId: string,
    turnNumber?: number,
    options: {
      offset?: number;      // Character offset (default: 0)
      limit?: number;       // Max characters to return (default: 10000)
      outputType?: 'stdout' | 'stderr' | 'both';  // Which output to fetch
    } = {}
  ): {
    conversationId: string;
    turnNumber: number;
    stdout?: { content: string; totalBytes: number; offset: number; hasMore: boolean };
    stderr?: { content: string; totalBytes: number; offset: number; hasMore: boolean };
    parsedOutput?: { content: string; totalBytes: number; offset: number; hasMore: boolean };
    finalOutput?: { content: string; totalBytes: number; offset: number; hasMore: boolean };
    cached: boolean;
    prompt: string;
    status: string;
    timestamp: string;
  } | null {
    const { offset = 0, limit = 10000, outputType = 'both' } = options;

    // Get turn (latest if not specified)
    let turn;
    if (turnNumber !== undefined) {
      turn = this.db.prepare(`
        SELECT * FROM turns WHERE conversation_id = ? AND turn_number = ?
      `).get(conversationId, turnNumber) as any;
    } else {
      turn = this.db.prepare(`
        SELECT * FROM turns WHERE conversation_id = ? ORDER BY turn_number DESC LIMIT 1
      `).get(conversationId) as any;
    }

    if (!turn) return null;

    const result: {
      conversationId: string;
      turnNumber: number;
      stdout?: { content: string; totalBytes: number; offset: number; hasMore: boolean };
      stderr?: { content: string; totalBytes: number; offset: number; hasMore: boolean };
      parsedOutput?: { content: string; totalBytes: number; offset: number; hasMore: boolean };
      finalOutput?: { content: string; totalBytes: number; offset: number; hasMore: boolean };
      cached: boolean;
      prompt: string;
      status: string;
      timestamp: string;
    } = {
      conversationId,
      turnNumber: turn.turn_number,
      cached: !!turn.cached,
      prompt: turn.prompt,
      status: turn.status,
      timestamp: turn.timestamp
    };

    // Use full output if cached, otherwise use truncated
    if (outputType === 'stdout' || outputType === 'both') {
      const fullStdout = turn.cached ? (turn.stdout_full || '') : (turn.stdout || '');
      const totalBytes = fullStdout.length;
      const content = fullStdout.substring(offset, offset + limit);
      result.stdout = {
        content,
        totalBytes,
        offset,
        hasMore: offset + limit < totalBytes
      };
    }

    if (outputType === 'stderr' || outputType === 'both') {
      const fullStderr = turn.cached ? (turn.stderr_full || '') : (turn.stderr || '');
      const totalBytes = fullStderr.length;
      const content = fullStderr.substring(offset, offset + limit);
      result.stderr = {
        content,
        totalBytes,
        offset,
        hasMore: offset + limit < totalBytes
      };
    }

    // Add parsed output if available (filtered output for general display)
    if (turn.parsed_output) {
      const parsedContent = turn.parsed_output;
      const totalBytes = parsedContent.length;
      const content = parsedContent.substring(offset, offset + limit);
      result.parsedOutput = {
        content,
        totalBytes,
        offset,
        hasMore: offset + limit < totalBytes
      };
    }

    // Add final output if available (agent_message only for --final flag)
    if (turn.final_output) {
      const finalContent = turn.final_output;
      const totalBytes = finalContent.length;
      const content = finalContent.substring(offset, offset + limit);
      result.finalOutput = {
        content,
        totalBytes,
        offset,
        hasMore: offset + limit < totalBytes
      };
    }

    return result;
  }

  /**
   * Query execution history
   */
  getHistory(options: HistoryQueryOptions = {}): {
    total: number;
    count: number;
    executions: HistoryIndexEntry[];
  } {
    const { limit = 50, offset = 0, tool, status, category, search, startDate, endDate } = options;

    let whereClause = '1=1';
    const params: any = {};

    if (tool) {
      whereClause += ' AND tool = @tool';
      params.tool = tool;
    }

    if (status) {
      whereClause += ' AND latest_status = @status';
      params.status = status;
    }

    if (category) {
      whereClause += ' AND category = @category';
      params.category = category;
    }

    if (startDate) {
      whereClause += ' AND created_at >= @startDate';
      params.startDate = startDate;
    }

    if (endDate) {
      whereClause += ' AND created_at <= @endDate';
      params.endDate = endDate;
    }

    // Full-text search
    let joinClause = '';
    if (search) {
      joinClause = `
        INNER JOIN (
          SELECT DISTINCT conversation_id FROM turns t
          INNER JOIN turns_fts ON turns_fts.rowid = t.id
          WHERE turns_fts MATCH @search
        ) AS matched ON c.id = matched.conversation_id
      `;
      params.search = search;
    }

    const countQuery = this.db.prepare(`
      SELECT COUNT(*) as count FROM conversations c ${joinClause} WHERE ${whereClause}
    `);
    const total = (countQuery.get(params) as any).count;

    const dataQuery = this.db.prepare(`
      SELECT c.* FROM conversations c ${joinClause}
      WHERE ${whereClause}
      ORDER BY c.updated_at DESC
      LIMIT @limit OFFSET @offset
    `);

    const rows = dataQuery.all({ ...params, limit, offset }) as any[];

    return {
      total,
      count: rows.length,
      executions: rows.map(r => ({
        id: r.id,
        timestamp: r.created_at,
        updated_at: r.updated_at,
        tool: r.tool,
        status: r.latest_status,
        category: r.category || 'user',
        duration_ms: r.total_duration_ms,
        turn_count: r.turn_count,
        prompt_preview: r.prompt_preview || ''
      }))
    };
  }

  /**
   * Delete a conversation
   */
  deleteConversation(id: string): { success: boolean; error?: string } {
    try {
      const result = this.withRetry(() =>
        this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
      );
      return { success: result.changes > 0 };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Batch delete conversations
   */
  batchDelete(ids: string[]): { success: boolean; deleted: number; errors?: string[] } {
    const deleteStmt = this.db.prepare('DELETE FROM conversations WHERE id = ?');
    const errors: string[] = [];
    let deleted = 0;

    const transaction = this.db.transaction(() => {
      for (const id of ids) {
        try {
          const result = deleteStmt.run(id);
          if (result.changes > 0) deleted++;
        } catch (err) {
          errors.push(`${id}: ${(err as Error).message}`);
        }
      }
    });

    this.withRetry(() => transaction());

    return {
      success: true,
      deleted,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Delete conversations by tool
   */
  deleteByTool(tool: string): { success: boolean; deleted: number } {
    const result = this.db.prepare('DELETE FROM conversations WHERE tool = ?').run(tool);
    return { success: true, deleted: result.changes };
  }

  /**
   * Delete all conversations
   */
  deleteAll(): { success: boolean; deleted: number } {
    const count = (this.db.prepare('SELECT COUNT(*) as c FROM conversations').get() as any).c;
    this.db.prepare('DELETE FROM conversations').run();
    return { success: true, deleted: count };
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byTool: Record<string, number>;
    byStatus: Record<string, number>;
    totalDuration: number;
  } {
    const total = (this.db.prepare('SELECT COUNT(*) as c FROM conversations').get() as any).c;

    const byToolRows = this.db.prepare(`
      SELECT tool, COUNT(*) as count FROM conversations GROUP BY tool
    `).all() as any[];
    const byTool: Record<string, number> = {};
    for (const row of byToolRows) {
      byTool[row.tool] = row.count;
    }

    const byStatusRows = this.db.prepare(`
      SELECT latest_status, COUNT(*) as count FROM conversations GROUP BY latest_status
    `).all() as any[];
    const byStatus: Record<string, number> = {};
    for (const row of byStatusRows) {
      byStatus[row.latest_status] = row.count;
    }

    const totalDuration = (this.db.prepare(`
      SELECT COALESCE(SUM(total_duration_ms), 0) as total FROM conversations
    `).get() as any).total;

    return { total, byTool, byStatus, totalDuration };
  }

  // ========== Native Session Mapping Methods ==========

  /**
   * Save or update native session mapping
   */
  saveNativeSessionMapping(mapping: NativeSessionMapping): void {
    const stmt = this.db.prepare(`
      INSERT INTO native_session_mapping (ccw_id, tool, native_session_id, native_session_path, project_hash, transaction_id, created_at)
      VALUES (@ccw_id, @tool, @native_session_id, @native_session_path, @project_hash, @transaction_id, @created_at)
      ON CONFLICT(ccw_id) DO UPDATE SET
        native_session_id = @native_session_id,
        native_session_path = @native_session_path,
        project_hash = @project_hash,
        transaction_id = @transaction_id
    `);

    this.withRetry(() => stmt.run({
      ccw_id: mapping.ccw_id,
      tool: mapping.tool,
      native_session_id: mapping.native_session_id,
      native_session_path: mapping.native_session_path || null,
      project_hash: mapping.project_hash || null,
      transaction_id: mapping.transaction_id || null,
      created_at: mapping.created_at || new Date().toISOString()
    }));
  }

  /**
   * Get native session ID by CCW ID
   */
  getNativeSessionId(ccwId: string): string | null {
    const row = this.db.prepare(`
      SELECT native_session_id FROM native_session_mapping WHERE ccw_id = ?
    `).get(ccwId) as any;
    return row?.native_session_id || null;
  }

  /**
   * Get CCW ID by native session ID
   */
  getCcwIdByNativeSession(tool: string, nativeSessionId: string): string | null {
    const row = this.db.prepare(`
      SELECT ccw_id FROM native_session_mapping WHERE tool = ? AND native_session_id = ?
    `).get(tool, nativeSessionId) as any;
    return row?.ccw_id || null;
  }

  /**
   * Get transaction ID by CCW ID
   */
  getTransactionId(ccwId: string): string | null {
    const row = this.db.prepare(`
      SELECT transaction_id FROM native_session_mapping WHERE ccw_id = ?
    `).get(ccwId) as any;
    return row?.transaction_id || null;
  }

  /**
   * Get full mapping by CCW ID
   */
  getNativeSessionMapping(ccwId: string): NativeSessionMapping | null {
    const row = this.db.prepare(`
      SELECT * FROM native_session_mapping WHERE ccw_id = ?
    `).get(ccwId) as any;

    if (!row) return null;

    return {
      ccw_id: row.ccw_id,
      tool: row.tool,
      native_session_id: row.native_session_id,
      native_session_path: row.native_session_path,
      project_hash: row.project_hash,
      transaction_id: row.transaction_id,
      created_at: row.created_at
    };
  }

  /**
   * Get latest native session mapping for a tool
   */
  getLatestNativeMapping(tool: string): NativeSessionMapping | null {
    const row = this.db.prepare(`
      SELECT * FROM native_session_mapping 
      WHERE tool = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(tool) as any;

    if (!row) return null;

    return {
      ccw_id: row.ccw_id,
      tool: row.tool,
      native_session_id: row.native_session_id,
      native_session_path: row.native_session_path,
      project_hash: row.project_hash,
      transaction_id: row.transaction_id,
      created_at: row.created_at
    };
  }

  /**
   * Delete native session mapping
   */
  deleteNativeSessionMapping(ccwId: string): boolean {
    const result = this.db.prepare('DELETE FROM native_session_mapping WHERE ccw_id = ?').run(ccwId);
    return result.changes > 0;
  }

  /**
   * Check if CCW ID has native session mapping
   */
  hasNativeSession(ccwId: string): boolean {
    const row = this.db.prepare(`
      SELECT 1 FROM native_session_mapping WHERE ccw_id = ? LIMIT 1
    `).get(ccwId);
    return !!row;
  }

  // ========== Native Session Content Methods ==========

  /**
   * Get parsed native session content by CCW ID
   * Returns full conversation with all turns from native session file
   */
  async getNativeSessionContent(ccwId: string): Promise<ParsedSession | null> {
    const mapping = this.getNativeSessionMapping(ccwId);
    if (!mapping || !mapping.native_session_path) {
      return null;
    }

    return parseSessionFile(mapping.native_session_path, mapping.tool);
  }

  /**
   * Get formatted conversation text from native session
   */
  async getFormattedNativeConversation(ccwId: string, options?: {
    includeThoughts?: boolean;
    includeToolCalls?: boolean;
    includeTokens?: boolean;
    maxContentLength?: number;
  }): Promise<string | null> {
    const session = await this.getNativeSessionContent(ccwId);
    if (!session) {
      return null;
    }
    return formatConversation(session, options);
  }

  /**
   * Get conversation pairs (user prompt + assistant response) from native session
   */
  async getNativeConversationPairs(ccwId: string): Promise<Array<{
    turn: number;
    userPrompt: string;
    assistantResponse: string;
    timestamp: string;
  }> | null> {
    const session = await this.getNativeSessionContent(ccwId);
    if (!session) {
      return null;
    }
    return extractConversationPairs(session);
  }

  /**
   * Get conversation with enriched native session data
   * Merges CCW history with native session content
   */
  async getEnrichedConversation(ccwId: string): Promise<{
    ccw: ConversationRecord | null;
    native: ParsedSession | null;
    merged: Array<{
      turn: number;
      timestamp: string;
      ccwPrompt?: string;
      ccwOutput?: string;
      nativeUserContent?: string;
      nativeAssistantContent?: string;
      nativeThoughts?: string[];
      nativeToolCalls?: Array<{ name: string; arguments?: string; output?: string }>;
    }>;
  } | null> {
    const ccwConv = this.getConversation(ccwId);
    const nativeSession = await this.getNativeSessionContent(ccwId);

    if (!ccwConv && !nativeSession) {
      return null;
    }

    const merged: Array<{
      turn: number;
      timestamp: string;
      ccwPrompt?: string;
      ccwOutput?: string;
      nativeUserContent?: string;
      nativeAssistantContent?: string;
      nativeThoughts?: string[];
      nativeToolCalls?: Array<{ name: string; arguments?: string; output?: string }>;
    }> = [];

    // Determine max turn count
    const maxTurns = Math.max(
      ccwConv?.turn_count || 0,
      nativeSession?.turns.filter(t => t.role === 'user').length || 0
    );

    for (let i = 1; i <= maxTurns; i++) {
      const ccwTurn = ccwConv?.turns.find(t => t.turn === i);
      const nativeUserTurn = nativeSession?.turns.find(t => t.turnNumber === i && t.role === 'user');
      const nativeAssistantTurn = nativeSession?.turns.find(t => t.turnNumber === i && t.role === 'assistant');

      merged.push({
        turn: i,
        timestamp: ccwTurn?.timestamp || nativeUserTurn?.timestamp || '',
        ccwPrompt: ccwTurn?.prompt,
        ccwOutput: ccwTurn?.output.stdout,
        nativeUserContent: nativeUserTurn?.content,
        nativeAssistantContent: nativeAssistantTurn?.content,
        nativeThoughts: nativeAssistantTurn?.thoughts,
        nativeToolCalls: nativeAssistantTurn?.toolCalls
      });
    }

    return { ccw: ccwConv, native: nativeSession, merged };
  }

  /**
   * List all conversations with native session info
   */
  getHistoryWithNativeInfo(options: HistoryQueryOptions = {}): {
    total: number;
    count: number;
    executions: Array<HistoryIndexEntry & {
      hasNativeSession: boolean;
      nativeSessionId?: string;
      nativeSessionPath?: string;
    }>;
  } {
    const history = this.getHistory(options);

    const enrichedExecutions = history.executions.map(exec => {
      const mapping = this.getNativeSessionMapping(exec.id);
      return {
        ...exec,
        hasNativeSession: !!mapping,
        nativeSessionId: mapping?.native_session_id,
        nativeSessionPath: mapping?.native_session_path
      };
    });

    return {
      total: history.total,
      count: history.count,
      executions: enrichedExecutions
    };
  }

  // ========== Insights Methods ==========

  /**
   * Save an insights analysis result
   */
  saveInsight(insight: {
    id: string;
    tool: string;
    promptCount: number;
    patterns: any[];
    suggestions: any[];
    rawOutput?: string;
    executionId?: string;
    lang?: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO insights (id, created_at, tool, prompt_count, patterns, suggestions, raw_output, execution_id, lang)
      VALUES (@id, @created_at, @tool, @prompt_count, @patterns, @suggestions, @raw_output, @execution_id, @lang)
    `);

    this.withRetry(() => stmt.run({
      id: insight.id,
      created_at: new Date().toISOString(),
      tool: insight.tool,
      prompt_count: insight.promptCount,
      patterns: JSON.stringify(insight.patterns || []),
      suggestions: JSON.stringify(insight.suggestions || []),
      raw_output: insight.rawOutput || null,
      execution_id: insight.executionId || null,
      lang: insight.lang || 'en'
    }));
  }

  /**
   * Get insights history
   */
  getInsights(options: { limit?: number; tool?: string } = {}): {
    id: string;
    created_at: string;
    tool: string;
    prompt_count: number;
    patterns: any[];
    suggestions: any[];
    execution_id: string | null;
    lang: string;
  }[] {
    const { limit = 20, tool } = options;

    let sql = 'SELECT id, created_at, tool, prompt_count, patterns, suggestions, execution_id, lang FROM insights';
    const params: any = {};

    if (tool) {
      sql += ' WHERE tool = @tool';
      params.tool = tool;
    }

    sql += ' ORDER BY created_at DESC LIMIT @limit';
    params.limit = limit;

    const rows = this.db.prepare(sql).all(params) as any[];

    return rows.map(row => ({
      ...row,
      patterns: JSON.parse(row.patterns || '[]'),
      suggestions: JSON.parse(row.suggestions || '[]')
    }));
  }

  /**
   * Get a single insight by ID
   */
  getInsight(id: string): {
    id: string;
    created_at: string;
    tool: string;
    prompt_count: number;
    patterns: any[];
    suggestions: any[];
    raw_output: string | null;
    execution_id: string | null;
    lang: string;
  } | null {
    const row = this.db.prepare(
      'SELECT * FROM insights WHERE id = ?'
    ).get(id) as any;

    if (!row) return null;

    return {
      ...row,
      patterns: JSON.parse(row.patterns || '[]'),
      suggestions: JSON.parse(row.suggestions || '[]')
    };
  }

  /**
   * Delete an insight
   */
  deleteInsight(id: string): boolean {
    const result = this.db.prepare('DELETE FROM insights WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Save or update a review for an execution
   */
  saveReview(review: Omit<ReviewRecord, 'id' | 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): ReviewRecord {
    const now = new Date().toISOString();
    const created_at = review.created_at || now;
    const updated_at = review.updated_at || now;

    const stmt = this.db.prepare(`
      INSERT INTO reviews (execution_id, status, rating, comments, reviewer, created_at, updated_at)
      VALUES (@execution_id, @status, @rating, @comments, @reviewer, @created_at, @updated_at)
      ON CONFLICT(execution_id) DO UPDATE SET
        status = @status,
        rating = @rating,
        comments = @comments,
        reviewer = @reviewer,
        updated_at = @updated_at
    `);

    const result = this.withRetry(() => stmt.run({
      execution_id: review.execution_id,
      status: review.status,
      rating: review.rating ?? null,
      comments: review.comments ?? null,
      reviewer: review.reviewer ?? null,
      created_at,
      updated_at
    }));

    return {
      id: result.lastInsertRowid as number,
      execution_id: review.execution_id,
      status: review.status,
      rating: review.rating,
      comments: review.comments,
      reviewer: review.reviewer,
      created_at,
      updated_at
    };
  }

  /**
   * Get review for an execution
   */
  getReview(executionId: string): ReviewRecord | null {
    const row = this.db.prepare(
      'SELECT * FROM reviews WHERE execution_id = ?'
    ).get(executionId) as any;

    if (!row) return null;

    return {
      id: row.id,
      execution_id: row.execution_id,
      status: row.status as ReviewStatus,
      rating: row.rating,
      comments: row.comments,
      reviewer: row.reviewer,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Get reviews with optional filtering
   */
  getReviews(options: { status?: ReviewStatus; limit?: number } = {}): ReviewRecord[] {
    const { status, limit = 50 } = options;

    let sql = 'SELECT * FROM reviews';
    const params: any = { limit };

    if (status) {
      sql += ' WHERE status = @status';
      params.status = status;
    }

    sql += ' ORDER BY updated_at DESC LIMIT @limit';

    const rows = this.db.prepare(sql).all(params) as any[];

    return rows.map(row => ({
      id: row.id,
      execution_id: row.execution_id,
      status: row.status as ReviewStatus,
      rating: row.rating,
      comments: row.comments,
      reviewer: row.reviewer,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  /**
   * Delete a review
   */
  deleteReview(executionId: string): boolean {
    const result = this.db.prepare('DELETE FROM reviews WHERE execution_id = ?').run(executionId);
    return result.changes > 0;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance cache - keyed by normalized project ID for consistency
const storeCache = new Map<string, CliHistoryStore>();

/**
 * Get or create a store instance for a directory
 * Uses normalized project ID as cache key to handle path casing differences
 */
export function getHistoryStore(baseDir: string): CliHistoryStore {
  // Use getProjectId to normalize path for consistent cache key
  const cacheKey = getProjectId(baseDir);

  if (!storeCache.has(cacheKey)) {
    storeCache.set(cacheKey, new CliHistoryStore(baseDir));
  }
  return storeCache.get(cacheKey)!;
}

/**
 * Close all store instances
 */
export function closeAllStores(): void {
  for (const store of storeCache.values()) {
    store.close();
  }
  storeCache.clear();
}

/**
 * Find project path that contains the given execution
 * Searches upward through parent directories and all registered projects
 * @param conversationId - Execution ID to search for
 * @param startDir - Starting directory (default: process.cwd())
 * @returns Object with projectPath and projectId if found, null otherwise
 */
export function findProjectWithExecution(
  conversationId: string,
  startDir: string = process.cwd()
): { projectPath: string; projectId: string } | null {
  // Strategy 1: Search upward in parent directories
  let currentPath = resolve(startDir);
  const visited = new Set<string>();

  while (true) {
    // Avoid infinite loops
    if (visited.has(currentPath)) break;
    visited.add(currentPath);

    const projectId = getProjectId(currentPath);
    const paths = StoragePaths.project(currentPath);

    // Check if database exists for this path
    if (existsSync(paths.historyDb)) {
      try {
        const store = getHistoryStore(currentPath);
        const result = store.getCachedOutput(conversationId);
        if (result) {
          return { projectPath: currentPath, projectId };
        }
      } catch {
        // Database might be locked or corrupted, continue searching
      }
    }

    // Move to parent directory
    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      // Reached filesystem root
      break;
    }
    currentPath = parentPath;
  }

  // Strategy 2: Search in all registered projects (global search)
  // This covers cases where execution might be in a completely different project tree
  const projectsDir = join(getCCWHome(), 'projects');
  if (existsSync(projectsDir)) {
    try {
      const entries = readdirSync(projectsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const projectId = entry.name;
        const historyDb = join(projectsDir, projectId, 'cli-history', 'history.db');

        if (!existsSync(historyDb)) continue;

        try {
          // Open and query this database directly
          const db = new Database(historyDb, { readonly: true });
          const turn = db.prepare(`
            SELECT * FROM turns
            WHERE conversation_id = ?
            ORDER BY turn_number DESC
            LIMIT 1
          `).get(conversationId);

          db.close();

          if (turn) {
            // Found in this project - return the projectId
            // Note: projectPath is set to projectId since we don't have the original path stored
            return { projectPath: projectId, projectId };
          }
        } catch {
          // Skip this database (might be corrupted or locked)
          continue;
        }
      }
    } catch {
      // Failed to read projects directory
    }
  }

  return null;
}

// Re-export types from session-content-parser
export type { ParsedSession, ParsedTurn } from './session-content-parser.js';
