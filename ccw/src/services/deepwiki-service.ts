/**
 * DeepWiki Service
 * Read-only SQLite service for DeepWiki documentation index.
 *
 * Connects to codex-lens database at ~/.codexlens/deepwiki_index.db
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import Database from 'better-sqlite3';

// Default database path (same as Python DeepWikiStore)
const DEFAULT_DB_PATH = join(homedir(), '.codexlens', 'deepwiki_index.db');

/**
 * Symbol information from deepwiki_symbols table
 */
export interface DeepWikiSymbol {
  id: number;
  name: string;
  type: string;
  source_file: string;
  doc_file: string;
  anchor: string;
  start_line: number;
  end_line: number;
  created_at: number | null;
  updated_at: number | null;
  staleness_score: number;
}

/**
 * Document information from deepwiki_docs table
 */
export interface DeepWikiDoc {
  id: number;
  path: string;
  content_hash: string;
  symbols: string[];
  generated_at: number;
  llm_tool: string | null;
}

/**
 * File information from deepwiki_files table
 */
export interface DeepWikiFile {
  id: number;
  path: string;
  content_hash: string;
  last_indexed: number;
  symbols_count: number;
  docs_generated: boolean;
}

/**
 * Document with symbols for API response
 */
export interface DocumentWithSymbols {
  path: string;
  symbols: Array<{
    name: string;
    type: string;
    anchor: string;
    start_line: number;
    end_line: number;
  }>;
  generated_at: string | null;
  llm_tool: string | null;
}

/**
 * DeepWiki Service - Read-only SQLite access
 */
export class DeepWikiService {
  private dbPath: string;
  private db: Database.Database | null = null;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
  }

  /**
   * Get or create database connection
   */
  private getConnection(): Database.Database | null {
    if (this.db) {
      return this.db;
    }

    // Check if database exists
    if (!existsSync(this.dbPath)) {
      console.log(`[DeepWiki] Database not found at ${this.dbPath}`);
      return null;
    }

    try {
      // Open in read-only mode
      this.db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
      console.log(`[DeepWiki] Connected to database at ${this.dbPath}`);
      return this.db;
    } catch (error) {
      console.error(`[DeepWiki] Failed to connect to database:`, error);
      return null;
    }
  }

  /**
   * Close database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Check if database is available
   */
  public isAvailable(): boolean {
    return existsSync(this.dbPath);
  }

  /**
   * List all documented files (source files with symbols)
   * @returns Array of file paths that have documentation
   */
  public listDocumentedFiles(): string[] {
    const db = this.getConnection();
    if (!db) {
      return [];
    }

    try {
      // Get distinct source files that have symbols documented
      const rows = db.prepare(`
        SELECT DISTINCT source_file
        FROM deepwiki_symbols
        ORDER BY source_file
      `).all() as Array<{ source_file: string }>;

      return rows.map(row => row.source_file);
    } catch (error) {
      console.error('[DeepWiki] Error listing documented files:', error);
      return [];
    }
  }

  /**
   * Get document information by source file path
   * @param filePath - Source file path
   * @returns Document with symbols or null if not found
   */
  public getDocumentByPath(filePath: string): DocumentWithSymbols | null {
    const db = this.getConnection();
    if (!db) {
      return null;
    }

    try {
      // Normalize path (forward slashes)
      const normalizedPath = filePath.replace(/\\/g, '/');

      // Get symbols for this source file
      const symbols = db.prepare(`
        SELECT name, type, anchor, start_line, end_line
        FROM deepwiki_symbols
        WHERE source_file = ?
        ORDER BY start_line
      `).all(normalizedPath) as Array<{
        name: string;
        type: string;
        anchor: string;
        start_line: number;
        end_line: number;
      }>;

      if (symbols.length === 0) {
        return null;
      }

      // Get the doc file path (from first symbol)
      const docFile = db.prepare(`
        SELECT doc_file FROM deepwiki_symbols WHERE source_file = ? LIMIT 1
      `).get(normalizedPath) as { doc_file: string } | undefined;

      // Get document metadata if available
      let generatedAt: string | null = null;
      let llmTool: string | null = null;

      if (docFile) {
        const doc = db.prepare(`
          SELECT generated_at, llm_tool
          FROM deepwiki_docs
          WHERE path = ?
        `).get(docFile.doc_file) as { generated_at: number; llm_tool: string | null } | undefined;

        if (doc) {
          generatedAt = doc.generated_at ? new Date(doc.generated_at * 1000).toISOString() : null;
          llmTool = doc.llm_tool;
        }
      }

      return {
        path: normalizedPath,
        symbols: symbols.map(s => ({
          name: s.name,
          type: s.type,
          anchor: s.anchor,
          start_line: s.start_line,
          end_line: s.end_line
        })),
        generated_at: generatedAt,
        llm_tool: llmTool
      };
    } catch (error) {
      console.error('[DeepWiki] Error getting document by path:', error);
      return null;
    }
  }



  /**
   * Search symbols by name pattern
   * @param query - Search query (supports LIKE pattern)
   * @param limit - Maximum results
   * @returns Array of matching symbols
   */
  public searchSymbols(query: string, limit: number = 50): DeepWikiSymbol[] {
    const db = this.getConnection();
    if (!db) {
      return [];
    }

    try {
      const pattern = `%${query}%`;
      const rows = db.prepare(`
        SELECT id, name, type, source_file, doc_file, anchor, start_line, end_line, created_at, updated_at
        FROM deepwiki_symbols
        WHERE name LIKE ?
        ORDER BY name
        LIMIT ?
      `).all(pattern, limit) as DeepWikiSymbol[];

      return rows;
    } catch (error) {
      console.error('[DeepWiki] Error searching symbols:', error);
      return [];
    }
  }

  /**
   * Get all symbols for multiple source file paths (batch query)
   * @param paths - Array of source file paths
   * @returns Map of normalized path to array of symbol info
   */
  public getSymbolsForPaths(paths: string[]): Map<string, Array<{
    name: string;
    type: string;
    doc_file: string;
    anchor: string;
    start_line: number;
    end_line: number;
    staleness_score: number;
  }>> {
    const db = this.getConnection();
    if (!db) {
      return new Map();
    }

    try {
      const result = new Map<string, Array<{
        name: string;
        type: string;
        doc_file: string;
        anchor: string;
        start_line: number;
        end_line: number;
        staleness_score: number;
      }>>();

      if (paths.length === 0) {
        return result;
      }

      const normalizedPaths = paths.map(p => p.replace(/\\/g, '/'));
      const placeholders = normalizedPaths.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT source_file, name, type, doc_file, anchor, start_line, end_line, staleness_score
        FROM deepwiki_symbols
        WHERE source_file IN (${placeholders})
        ORDER BY source_file, start_line
      `).all(...normalizedPaths) as Array<{
        source_file: string;
        name: string;
        type: string;
        doc_file: string;
        anchor: string;
        start_line: number;
        end_line: number;
        staleness_score: number;
      }>;

      for (const row of rows) {
        const existing = result.get(row.source_file) || [];
        existing.push({
          name: row.name,
          type: row.type,
          doc_file: row.doc_file,
          anchor: row.anchor,
          start_line: row.start_line,
          end_line: row.end_line,
          staleness_score: row.staleness_score,
        });
        result.set(row.source_file, existing);
      }

      return result;
    } catch (error) {
      console.error('[DeepWiki] Error getting symbols for paths:', error);
      return new Map();
    }
  }

  /**
   * Check which files have stale documentation by comparing content hashes
   * @param files - Array of {path, hash} to check
   * @returns Array of file paths where stored hash differs from provided hash
   */
  public getStaleFiles(files: Array<{ path: string; hash: string }>): Array<{
    path: string;
    stored_hash: string | null;
    current_hash: string;
  }> {
    const db = this.getConnection();
    if (!db) {
      return [];
    }

    try {
      const stale: Array<{ path: string; stored_hash: string | null; current_hash: string }> = [];
      if (files.length === 0) {
        return stale;
      }

      // Build lookup: normalizedPath -> original file
      const lookup = new Map<string, { path: string; hash: string }>();
      const normalizedPaths: string[] = [];
      for (const file of files) {
        const np = file.path.replace(/\\/g, '/');
        lookup.set(np, file);
        normalizedPaths.push(np);
      }

      const placeholders = normalizedPaths.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT path, content_hash FROM deepwiki_files WHERE path IN (${placeholders})`
      ).all(...normalizedPaths) as Array<{ path: string; content_hash: string }>;

      const stored = new Map<string, string>();
      for (const row of rows) {
        stored.set(row.path, row.content_hash);
      }

      for (const [np, file] of lookup) {
        const storedHash = stored.get(np);
        if (storedHash === undefined) {
          stale.push({ path: file.path, stored_hash: null, current_hash: file.hash });
        } else if (storedHash !== file.hash) {
          stale.push({ path: file.path, stored_hash: storedHash, current_hash: file.hash });
        }
      }

      return stale;
    } catch (error) {
      console.error('[DeepWiki] Error checking stale files:', error);
      return [];
    }
  }

  /**
   * Read symbol documentation file content
   * @param docFile - Path to the documentation file (relative to .deepwiki/)
   * @returns Documentation content string or null
   */
  public getSymbolDocContent(docFile: string): string | null {
    try {
      const fullPath = join(homedir(), '.codexlens', 'deepwiki', docFile);
      if (!existsSync(fullPath)) {
        return null;
      }
      return readFileSync(fullPath, 'utf-8');
    } catch (error) {
      console.error('[DeepWiki] Error reading doc content:', error);
      return null;
    }
  }

  /**
   * Get storage statistics
   * @returns Statistics object with counts
   */
  public getStats(): { files: number; symbols: number; docs: number; filesNeedingDocs: number; dbPath: string } {
    const db = this.getConnection();
    if (!db) {
      return { files: 0, symbols: 0, docs: 0, filesNeedingDocs: 0, dbPath: this.dbPath };
    }

    try {
      const files = db.prepare('SELECT COUNT(*) as count FROM deepwiki_files').get() as { count: number };
      const symbols = db.prepare('SELECT COUNT(*) as count FROM deepwiki_symbols').get() as { count: number };
      const docs = db.prepare('SELECT COUNT(*) as count FROM deepwiki_docs').get() as { count: number };
      const filesNeedingDocs = db.prepare('SELECT COUNT(*) as count FROM deepwiki_files WHERE docs_generated = 0').get() as { count: number };

      return {
        files: files?.count || 0,
        symbols: symbols?.count || 0,
        docs: docs?.count || 0,
        filesNeedingDocs: filesNeedingDocs?.count || 0,
        dbPath: this.dbPath
      };
    } catch (error) {
      console.error('[DeepWiki] Error getting stats:', error);
      return { files: 0, symbols: 0, docs: 0, filesNeedingDocs: 0, dbPath: this.dbPath };
    }
  }
}

// Singleton instance
let deepWikiService: DeepWikiService | null = null;

/**
 * Get the singleton DeepWiki service instance
 */
export function getDeepWikiService(): DeepWikiService {
  if (!deepWikiService) {
    deepWikiService = new DeepWikiService();
  }
  return deepWikiService;
}

/**
 * Handle DeepWiki API routes
 * @returns true if route was handled, false otherwise
 */
export async function handleDeepWikiRoutes(ctx: {
  pathname: string;
  req: any;
  res: any;
}): Promise<boolean> {
  const { pathname, req, res } = ctx;
  const service = getDeepWikiService();

  if (pathname === '/api/deepwiki/symbols-for-paths' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const paths: string[] = body?.paths || [];
    const result = service.getSymbolsForPaths(paths);
    // Convert Map to plain object for JSON serialization
    const obj: Record<string, any> = {};
    for (const [key, value] of result) {
      obj[key] = value;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
    return true;
  }

  if (pathname === '/api/deepwiki/stale-files' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const files: Array<{ path: string; hash: string }> = body?.files || [];
    const result = service.getStaleFiles(files);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return true;
  }

  return false;
}

/**
 * Read JSON body from request
 */
function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: string) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(null);
      }
    });
  });
}
