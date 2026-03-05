/**
 * DeepWiki Service
 * Read-only SQLite service for DeepWiki documentation index.
 *
 * Connects to codex-lens database at ~/.codexlens/deepwiki_index.db
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
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
