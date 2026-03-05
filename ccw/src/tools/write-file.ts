/**
 * Write File Tool - Create or overwrite files
 *
 * Features:
 * - Create new files or overwrite existing
 * - Auto-create parent directories
 * - Support for text content with proper encoding
 * - Optional backup before overwrite
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync, statSync } from 'fs';
import { resolve, isAbsolute, dirname, basename } from 'path';
import { validatePath } from '../utils/path-validator.js';

// Define Zod schema for validation
const ParamsSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  content: z.string(),
  createDirectories: z.boolean().default(true),
  backup: z.boolean().default(false),
  encoding: z.enum(['utf8', 'utf-8', 'ascii', 'latin1', 'binary', 'hex', 'base64']).default('utf8'),
});

type Params = z.infer<typeof ParamsSchema>;

// Compact result for output
interface WriteResult {
  path: string;
  bytes: number;
  message: string;
}

/**
 * Ensure parent directory exists
 * @param filePath - Path to file
 */
function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Create backup of existing file
 * @param filePath - Path to file
 * @returns Backup path or null if no backup created
 */
function createBackup(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const dir = dirname(filePath);
  const name = basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve(dir, `.${name}.${timestamp}.bak`);

  try {
    const content = readFileSync(filePath);
    writeFileSync(backupPath, content);
    return backupPath;
  } catch (error) {
    throw new Error(`Failed to create backup: ${(error as Error).message}`);
  }
}

/**
 * Verify file write operation completed successfully
 * @param filePath - Path to written file
 * @param expectedBytes - Expected file size in bytes
 * @param encoding - File encoding used
 * @returns Error message if verification fails, null if successful
 */
function verifyFileWrite(filePath: string, expectedBytes: number, encoding: BufferEncoding): string | null {
  // Check 1: File exists
  if (!existsSync(filePath)) {
    return `File verification failed: file does not exist at ${filePath}`;
  }

  try {
    // Check 2: File size matches expected bytes
    const stats = statSync(filePath);
    if (stats.size !== expectedBytes) {
      return `File verification failed: size mismatch (expected ${expectedBytes}B, actual ${stats.size}B)`;
    }

    // Check 3: File is readable (for long JSON files)
    const readContent = readFileSync(filePath, { encoding });
    const actualBytes = Buffer.byteLength(readContent, encoding);
    if (actualBytes !== expectedBytes) {
      return `File verification failed: content size mismatch after read (expected ${expectedBytes}B, read ${actualBytes}B)`;
    }

    return null; // Verification passed
  } catch (error) {
    return `File verification failed: ${(error as Error).message}`;
  }
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'write_file',
  description: `Write content to file. Auto-creates parent directories.

Required: path (string), content (string)
Options: backup=true, createDirectories=false, encoding="utf8"`,
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to create or overwrite',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
      createDirectories: {
        type: 'boolean',
        description: 'Create parent directories if they do not exist (default: true)',
        default: true,
      },
      backup: {
        type: 'boolean',
        description: 'Create backup of existing file before overwriting (default: false)',
        default: false,
      },
      encoding: {
        type: 'string',
        description: 'File encoding (default: utf8)',
        default: 'utf8',
        enum: ['utf8', 'utf-8', 'ascii', 'latin1', 'binary', 'hex', 'base64'],
      },
    },
    required: ['path', 'content'],
  },
};

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<WriteResult>> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const {
    path: filePath,
    content,
    createDirectories,
    backup,
    encoding,
  } = parsed.data;

  // Validate and resolve path
  const resolvedPath = await validatePath(filePath);
  const fileExists = existsSync(resolvedPath);

  // Create parent directories if needed
  if (createDirectories) {
    ensureDir(resolvedPath);
  } else if (!existsSync(dirname(resolvedPath))) {
    return {
      success: false,
      error: `Parent directory does not exist: ${dirname(resolvedPath)}`,
    };
  }

  // Create backup if requested and file exists
  let backupPath: string | null = null;
  if (backup && fileExists) {
    try {
      backupPath = createBackup(resolvedPath);
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Write file
  try {
    writeFileSync(resolvedPath, content, { encoding });
    const bytes = Buffer.byteLength(content, encoding);

    // Verify write operation completed successfully
    const verificationError = verifyFileWrite(resolvedPath, bytes, encoding as BufferEncoding);
    if (verificationError) {
      return {
        success: false,
        error: verificationError,
      };
    }

    // Build compact message
    let message: string;
    if (fileExists) {
      message = backupPath
        ? `Overwrote (${bytes}B, backup: ${basename(backupPath)}) - verified`
        : `Overwrote (${bytes}B) - verified`;
    } else {
      message = `Created (${bytes}B) - verified`;
    }

    return {
      success: true,
      result: {
        path: resolvedPath,
        bytes,
        message,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to write file: ${(error as Error).message}`,
    };
  }
}
