/**
 * DeepWiki Type Definitions
 *
 * Types for DeepWiki documentation index storage.
 * These types mirror the Python Pydantic models in codex-lens.
 */

/**
 * A symbol record in the DeepWiki index.
 * Maps a code symbol to its generated documentation file and anchor.
 */
export interface DeepWikiSymbol {
  /** Database row ID */
  id?: number;
  /** Symbol name (function, class, etc.) */
  name: string;
  /** Symbol type (function, class, method, variable) */
  type: string;
  /** Path to source file containing the symbol */
  sourceFile: string;
  /** Path to generated documentation file */
  docFile: string;
  /** HTML anchor ID for linking to specific section */
  anchor: string;
  /** (start_line, end_line) in source file, 1-based inclusive */
  lineRange: [number, number];
  /** Record creation timestamp */
  createdAt?: string;
  /** Record update timestamp */
  updatedAt?: string;
}

/**
 * A documentation file record in the DeepWiki index.
 * Tracks generated documentation files and their associated symbols.
 */
export interface DeepWikiDoc {
  /** Database row ID */
  id?: number;
  /** Path to documentation file */
  path: string;
  /** SHA256 hash of file content for change detection */
  contentHash: string;
  /** List of symbol names documented in this file */
  symbols: string[];
  /** Timestamp when documentation was generated (ISO string) */
  generatedAt: string;
  /** LLM tool used to generate documentation (gemini/qwen) */
  llmTool?: string;
}

/**
 * A source file record in the DeepWiki index.
 * Tracks indexed source files and their content hashes for incremental updates.
 */
export interface DeepWikiFile {
  /** Database row ID */
  id?: number;
  /** Path to source file */
  path: string;
  /** SHA256 hash of file content */
  contentHash: string;
  /** Timestamp when file was last indexed (ISO string) */
  lastIndexed: string;
  /** Number of symbols indexed from this file */
  symbolsCount: number;
  /** Whether documentation has been generated */
  docsGenerated: boolean;
}

/**
 * Storage statistics for DeepWiki index.
 */
export interface DeepWikiStats {
  /** Total number of tracked source files */
  files: number;
  /** Total number of indexed symbols */
  symbols: number;
  /** Total number of documentation files */
  docs: number;
  /** Files that need documentation generated */
  filesNeedingDocs: number;
  /** Path to the database file */
  dbPath: string;
}

/**
 * Options for listing files in DeepWiki index.
 */
export interface ListFilesOptions {
  /** Only return files that need documentation generated */
  needsDocs?: boolean;
  /** Maximum number of files to return */
  limit?: number;
}

/**
 * Options for searching symbols.
 */
export interface SearchSymbolsOptions {
  /** Maximum number of results to return */
  limit?: number;
}
