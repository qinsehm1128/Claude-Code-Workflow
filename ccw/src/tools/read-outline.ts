/**
 * Read Outline Tool - Parse code files into structured symbol outlines.
 *
 * Uses web-tree-sitter for AST-level parsing. Returns function/class/method
 * signatures with line offsets directly usable by read_file(offset, limit).
 *
 * Supported: TypeScript, TSX, JavaScript, Python, Go, Rust, Java, C#, C, C++
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { existsSync, statSync, readFileSync } from 'fs';
import { relative } from 'path';
import { validatePath, getProjectRoot } from '../utils/path-validator.js';
import { BINARY_EXTENSIONS } from '../utils/file-reader.js';
import { detectLanguage } from '../utils/outline-queries.js';
import { parseOutline } from '../utils/outline-parser.js';
import type { OutlineResult } from '../utils/outline-parser.js';
import { extname } from 'path';

const ParamsSchema = z.object({
  path: z.string().describe('File path to parse for outline'),
  language: z.string().optional().describe('Language hint (e.g. "typescript", "python"). Auto-detected from extension if omitted.'),
});

type Params = z.infer<typeof ParamsSchema>;

export const schema: ToolSchema = {
  name: 'read_outline',
  description: `Parse a code file into a structured outline of symbols (functions, classes, methods, interfaces, types, enums).

Returns symbol names, signatures, docstrings, and 0-based line offsets that work directly with read_file(offset, limit).

Usage:
  read_outline(path="src/server.ts")
  read_outline(path="main.py", language="python")

Workflow: discover symbols → use line/endLine with read_file to jump to implementations.

Supported languages: TypeScript, TSX, JavaScript, Python, Go, Rust, Java, C#, C, C++`,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to parse for outline' },
      language: { type: 'string', description: 'Language hint (e.g. "typescript", "python"). Auto-detected from extension if omitted.' },
    },
    required: ['path'],
  },
};

export async function handler(params: Record<string, unknown>): Promise<ToolResult<OutlineResult>> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const { path: filePath, language: langHint } = parsed.data;
  const cwd = getProjectRoot();
  const resolvedPath = await validatePath(filePath);

  if (!existsSync(resolvedPath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  const stat = statSync(resolvedPath);
  if (!stat.isFile()) {
    return { success: false, error: `Not a file: ${filePath}` };
  }

  // Check for binary files
  const ext = extname(resolvedPath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return { success: false, error: `Binary file not supported: ${filePath}` };
  }

  // Detect language
  const config = detectLanguage(resolvedPath, langHint);
  if (!config) {
    const supported = 'TypeScript, TSX, JavaScript, Python, Go, Rust, Java, C#, C, C++';
    return {
      success: false,
      error: `Unsupported language for "${ext}" extension. Supported: ${supported}`,
    };
  }

  // Read file content
  const content = readFileSync(resolvedPath, 'utf-8');

  // Parse outline
  try {
    const result = await parseOutline(
      relative(cwd, resolvedPath) || filePath,
      content,
      config
    );

    return { success: true, result };
  } catch (err) {
    return {
      success: false,
      error: `Outline parsing failed: ${(err as Error).message}`,
    };
  }
}
