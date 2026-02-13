/**
 * Edit File Tool - AI-focused file editing
 * Two complementary modes:
 * - update: Content-driven text replacement (AI primary use)
 * - line: Position-driven line operations (precise control)
 *
 * Features:
 * - dryRun mode for previewing changes
 * - Git-style diff output
 * - Multi-edit support in update mode
 * - Auto line-ending adaptation (CRLF/LF)
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, isAbsolute, dirname } from 'path';
import { validatePath } from '../utils/path-validator.js';

// Define Zod schemas for validation
const EditItemSchema = z.object({
  oldText: z.string(),
  newText: z.string(),
});

// Base schema with common parameters
const BaseParamsSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  dryRun: z.boolean().default(false),
});

// Update mode schema
const UpdateModeSchema = BaseParamsSchema.extend({
  mode: z.literal('update').default('update'),
  oldText: z.string().optional(),
  newText: z.string().optional(),
  edits: z.array(EditItemSchema).optional(),
  replaceAll: z.boolean().default(false),
}).refine(
  (data) => {
    const hasSingle = data.oldText !== undefined;
    const hasBatch = data.edits !== undefined;
    // XOR: Only one of oldText/newText or edits should be provided
    return hasSingle !== hasBatch || (!hasSingle && !hasBatch);
  },
  {
    message: 'Use either oldText/newText or edits array, not both',
  }
);

// Line mode schema
const LineModeSchema = BaseParamsSchema.extend({
  mode: z.literal('line'),
  operation: z.enum(['insert_before', 'insert_after', 'replace', 'delete']),
  line: z.number().int().positive('Line must be a positive integer'),
  end_line: z.number().int().positive().optional(),
  text: z.string().optional(),
}).refine(
  (data) => {
    // text is required for insert_before, insert_after, and replace operations
    if (['insert_before', 'insert_after', 'replace'].includes(data.operation)) {
      return data.text !== undefined;
    }
    return true;
  },
  {
    message: 'Parameter "text" is required for insert_before, insert_after, and replace operations',
  }
);

// Discriminated union schema
const ParamsSchema = z.discriminatedUnion('mode', [
  UpdateModeSchema,
  LineModeSchema,
]);

type Params = z.infer<typeof ParamsSchema>;
type EditItem = z.infer<typeof EditItemSchema>;

// Extract specific types for each mode
type UpdateModeParams = z.infer<typeof UpdateModeSchema>;
type LineModeParams = z.infer<typeof LineModeSchema>;

interface UpdateModeResult {
  content: string;
  modified: boolean;
  status: string;
  replacements: number;
  editResults: Array<Record<string, unknown>>;
  diff: string;
  dryRun: boolean;
  message: string;
}

// Max lines to show in diff preview
const MAX_DIFF_LINES = 15;

interface LineModeResult {
  content: string;
  modified: boolean;
  operation: string;
  line: number;
  end_line?: number;
  message: string;
}

// Internal type for mode results (content excluded in final output)

/**
 * Resolve file path and read content
 * @param filePath - Path to file
 * @returns Resolved path and content
 */
async function readFile(filePath: string): Promise<{ resolvedPath: string; content: string }> {
  const resolvedPath = await validatePath(filePath, { mustExist: true });

  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  try {
    const content = readFileSync(resolvedPath, 'utf8');
    return { resolvedPath, content };
  } catch (error) {
    throw new Error(`Failed to read file: ${(error as Error).message}`);
  }
}

/**
 * Write content to file with optional parent directory creation
 * @param filePath - Path to file
 * @param content - Content to write
 * @param createDirs - Create parent directories if needed
 */
function writeFile(filePath: string, content: string, createDirs = false): void {
  try {
    if (createDirs) {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    throw new Error(`Failed to write file: ${(error as Error).message}`);
  }
}

/**
 * Normalize line endings to LF
 * @param text - Input text
 * @returns Text with LF line endings
 */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/**
 * Create unified diff between two strings
 * @param original - Original content
 * @param modified - Modified content
 * @param filePath - File path for diff header
 * @returns Unified diff string
 */
function createUnifiedDiff(original: string, modified: string, filePath: string): string {
  const origLines = normalizeLineEndings(original).split('\n');
  const modLines = normalizeLineEndings(modified).split('\n');

  const diffLines = [`--- a/${filePath}`, `+++ b/${filePath}`];

  // Simple diff algorithm - find changes
  let i = 0,
    j = 0;
  let hunk: string[] = [];
  let origStart = 0;
  let modStart = 0;

  while (i < origLines.length || j < modLines.length) {
    if (i < origLines.length && j < modLines.length && origLines[i] === modLines[j]) {
      // Context line
      if (hunk.length > 0) {
        hunk.push(` ${origLines[i]}`);
      }
      i++;
      j++;
    } else {
      // Start or continue hunk
      if (hunk.length === 0) {
        origStart = i + 1;
        modStart = j + 1;
        // Add context before
        const contextStart = Math.max(0, i - 3);
        for (let c = contextStart; c < i; c++) {
          hunk.push(` ${origLines[c]}`);
        }
        origStart = contextStart + 1;
        modStart = contextStart + 1;
      }

      // Find where lines match again
      let foundMatch = false;
      for (let lookAhead = 1; lookAhead <= 10; lookAhead++) {
        if (
          i + lookAhead < origLines.length &&
          j < modLines.length &&
          origLines[i + lookAhead] === modLines[j]
        ) {
          // Remove lines from original
          for (let r = 0; r < lookAhead; r++) {
            hunk.push(`-${origLines[i + r]}`);
          }
          i += lookAhead;
          foundMatch = true;
          break;
        }
        if (
          j + lookAhead < modLines.length &&
          i < origLines.length &&
          modLines[j + lookAhead] === origLines[i]
        ) {
          // Add lines to modified
          for (let a = 0; a < lookAhead; a++) {
            hunk.push(`+${modLines[j + a]}`);
          }
          j += lookAhead;
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        // Replace line
        if (i < origLines.length) {
          hunk.push(`-${origLines[i]}`);
          i++;
        }
        if (j < modLines.length) {
          hunk.push(`+${modLines[j]}`);
          j++;
        }
      }
    }

    // Flush hunk if we've had 3 context lines after changes
    const lastChangeIdx = hunk.findLastIndex((l) => l.startsWith('+') || l.startsWith('-'));
    if (lastChangeIdx >= 0 && hunk.length - lastChangeIdx > 3) {
      const origCount = hunk.filter((l) => !l.startsWith('+')).length;
      const modCount = hunk.filter((l) => !l.startsWith('-')).length;
      diffLines.push(`@@ -${origStart},${origCount} +${modStart},${modCount} @@`);
      diffLines.push(...hunk);
      hunk = [];
    }
  }

  // Flush remaining hunk
  if (hunk.length > 0) {
    const origCount = hunk.filter((l) => !l.startsWith('+')).length;
    const modCount = hunk.filter((l) => !l.startsWith('-')).length;
    diffLines.push(`@@ -${origStart},${origCount} +${modStart},${modCount} @@`);
    diffLines.push(...hunk);
  }

  return diffLines.length > 2 ? diffLines.join('\n') : '';
}

/**
 * Mode: update - Simple text replacement
 * Auto-adapts line endings (CRLF/LF)
 * Supports multiple edits via 'edits' array
 */
function executeUpdateMode(content: string, params: UpdateModeParams, filePath: string): UpdateModeResult {
  const { oldText, newText, replaceAll, edits, dryRun = false } = params;

  // Detect original line ending
  const hasCRLF = content.includes('\r\n');
  const normalizedContent = normalizeLineEndings(content);
  const originalContent = normalizedContent;

  let newContent = normalizedContent;
  let replacements = 0;
  const editResults: Array<Record<string, unknown>> = [];

  // Support multiple edits via 'edits' array
  const editOperations: EditItem[] =
    edits || (oldText !== undefined ? [{ oldText, newText: newText || '' }] : []);

  if (editOperations.length === 0) {
    throw new Error('Either "oldText/newText" or "edits" array is required for update mode');
  }

  for (const edit of editOperations) {
    const normalizedOld = normalizeLineEndings(edit.oldText || '');
    const normalizedNew = normalizeLineEndings(edit.newText || '');

    if (!normalizedOld) {
      editResults.push({ status: 'error', message: 'Empty oldText' });
      continue;
    }

    if (newContent.includes(normalizedOld)) {
      if (replaceAll) {
        const parts = newContent.split(normalizedOld);
        const count = parts.length - 1;
        newContent = parts.join(normalizedNew);
        replacements += count;
        editResults.push({ status: 'replaced_all', count });
      } else {
        newContent = newContent.replace(normalizedOld, normalizedNew);
        replacements += 1;
        editResults.push({ status: 'replaced', count: 1 });
      }
    } else {
      // Try fuzzy match (trimmed whitespace)
      const lines = newContent.split('\n');
      const oldLines = normalizedOld.split('\n');
      let matchFound = false;

      for (let i = 0; i <= lines.length - oldLines.length; i++) {
        const potentialMatch = lines.slice(i, i + oldLines.length);
        const isMatch = oldLines.every(
          (oldLine, j) => oldLine.trim() === potentialMatch[j].trim()
        );

        if (isMatch) {
          // Preserve indentation of first line
          const indent = lines[i].match(/^\s*/)?.[0] || '';
          const newLines = normalizedNew.split('\n').map((line, j) => {
            if (j === 0) return indent + line.trimStart();
            return line;
          });
          lines.splice(i, oldLines.length, ...newLines);
          newContent = lines.join('\n');
          replacements += 1;
          editResults.push({ status: 'replaced_fuzzy', count: 1 });
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        editResults.push({ status: 'not_found', oldText: normalizedOld.substring(0, 50) });
      }
    }
  }

  // Restore original line ending
  if (hasCRLF) {
    newContent = newContent.replace(/\n/g, '\r\n');
  }

  // Generate diff if content changed
  let diff = '';
  if (originalContent !== normalizeLineEndings(newContent)) {
    diff = createUnifiedDiff(originalContent, normalizeLineEndings(newContent), filePath);
  }

  return {
    content: newContent,
    modified: content !== newContent,
    status: replacements > 0 ? 'replaced' : 'not found',
    replacements,
    editResults,
    diff,
    dryRun,
    message:
      replacements > 0
        ? `${replacements} replacement(s) made${dryRun ? ' (dry run)' : ''}`
        : 'No matches found',
  };
}

/**
 * Mode: line - Line-based operations
 * Operations: insert_before, insert_after, replace, delete
 */
function executeLineMode(content: string, params: LineModeParams): LineModeResult {
  const { operation, line, text, end_line } = params;

  // No need for additional validation - Zod schema already ensures required fields

  // Detect original line ending and normalize for processing
  const hasCRLF = content.includes('\r\n');
  const normalizedContent = hasCRLF ? content.replace(/\r\n/g, '\n') : content;

  const lines = normalizedContent.split('\n');
  const lineIndex = line - 1; // Convert to 0-based

  if (lineIndex < 0 || lineIndex >= lines.length) {
    throw new Error(`Line ${line} out of range (1-${lines.length})`);
  }

  const newLines = [...lines];
  let message = '';

  switch (operation) {
    case 'insert_before':
      if (text === undefined) throw new Error('Parameter "text" is required for insert_before');
      newLines.splice(lineIndex, 0, text);
      message = `Inserted before line ${line}`;
      break;

    case 'insert_after':
      if (text === undefined) throw new Error('Parameter "text" is required for insert_after');
      newLines.splice(lineIndex + 1, 0, text);
      message = `Inserted after line ${line}`;
      break;

    case 'replace': {
      if (text === undefined) throw new Error('Parameter "text" is required for replace');
      const endIdx = end_line ? end_line - 1 : lineIndex;
      if (endIdx < lineIndex || endIdx >= lines.length) {
        throw new Error(`end_line ${end_line} is invalid`);
      }
      const deleteCount = endIdx - lineIndex + 1;
      newLines.splice(lineIndex, deleteCount, text);
      message = end_line ? `Replaced lines ${line}-${end_line}` : `Replaced line ${line}`;
      break;
    }

    case 'delete': {
      const endDelete = end_line ? end_line - 1 : lineIndex;
      if (endDelete < lineIndex || endDelete >= lines.length) {
        throw new Error(`end_line ${end_line} is invalid`);
      }
      const count = endDelete - lineIndex + 1;
      newLines.splice(lineIndex, count);
      message = end_line ? `Deleted lines ${line}-${end_line}` : `Deleted line ${line}`;
      break;
    }

    default:
      throw new Error(
        `Unknown operation: ${operation}. Valid: insert_before, insert_after, replace, delete`
      );
  }

  let newContent = newLines.join('\n');

  // Restore original line endings
  if (hasCRLF) {
    newContent = newContent.replace(/\n/g, '\r\n');
  }

  return {
    content: newContent,
    modified: content !== newContent,
    operation,
    line,
    end_line,
    message,
  };
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'edit_file',
  description: `Edit file using two modes: "update" for text replacement (default) and "line" for line-based operations.

**Update Mode** (default):
- Use oldText/newText for single replacement OR edits for multiple replacements
- Parameters: oldText, newText, replaceAll, dryRun
- Cannot use line mode parameters (operation, line, end_line, text)
- Validation: oldText/newText and edits are mutually exclusive

**Line Mode**:
- Use for precise line-based operations
- Parameters: operation (insert_before/insert_after/replace/delete), line, end_line, text, dryRun
- Cannot use update mode parameters (oldText, newText, edits, replaceAll)

Usage (update mode - single replacement):
  edit_file(path="f.js", oldText="old", newText="new")

Usage (update mode - multiple replacements):
  edit_file(path="f.js", edits=[{oldText:"a",newText:"b"},{oldText:"c",newText:"d"}])

Usage (line mode):
  edit_file(path="f.js", mode="line", operation="insert_after", line=10, text="new line")
  edit_file(path="f.js", mode="line", operation="delete", line=5, end_line=8)

Options: dryRun=true (preview diff), replaceAll=true (update mode only)

**Important**: Each mode only accepts its own parameters. Providing parameters from both modes will cause a validation error.`,
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to modify',
      },
      mode: {
        type: 'string',
        enum: ['update', 'line'],
        description: 'Edit mode (default: update)',
        default: 'update',
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview changes using git-style diff without modifying file (default: false)',
        default: false,
      },
      // Update mode params
      oldText: {
        type: 'string',
        description: '[update mode] Text to find and replace. **Mutually exclusive with edits parameter** - use either oldText/newText or edits, not both.',
      },
      newText: {
        type: 'string',
        description: '[update mode] Replacement text',
      },
      edits: {
        type: 'array',
        description: '[update mode] Array of {oldText, newText} for multiple replacements. **Mutually exclusive with oldText/newText** - use either oldText/newText or edits, not both.',
        items: {
          type: 'object',
          properties: {
            oldText: { type: 'string', description: 'Text to search for - must match exactly' },
            newText: { type: 'string', description: 'Text to replace with' },
          },
          required: ['oldText', 'newText'],
        },
      },
      replaceAll: {
        type: 'boolean',
        description: '[update mode] Replace all occurrences of oldText (default: false)',
      },
      // Line mode params
      operation: {
        type: 'string',
        enum: ['insert_before', 'insert_after', 'replace', 'delete'],
        description: '[line mode] Line operation type. **Only valid in line mode** - cannot be combined with update mode parameters.',
      },
      line: {
        type: 'number',
        description: '[line mode] Line number (1-based). **Only valid in line mode** - cannot be combined with update mode parameters.',
      },
      end_line: {
        type: 'number',
        description: '[line mode] End line for range operations. **Only valid in line mode** - cannot be combined with update mode parameters.',
      },
      text: {
        type: 'string',
        description: '[line mode] Text for insert/replace operations. **Only valid in line mode** - cannot be combined with update mode parameters.',
      },
    },
    required: ['path'],
  },
};

/**
 * Truncate diff to max lines with indicator
 */
function truncateDiff(diff: string, maxLines: number): string {
  if (!diff) return '';
  const lines = diff.split('\n');
  if (lines.length <= maxLines) return diff;
  return lines.slice(0, maxLines).join('\n') + `\n... (+${lines.length - maxLines} more lines)`;
}

/**
 * Build compact result for output
 */
interface CompactEditResult {
  path: string;
  modified: boolean;
  message: string;
  replacements?: number;
  diff?: string;
  dryRun?: boolean;
}

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<CompactEditResult>> {
  // Apply default mode before discriminatedUnion check (Zod doesn't apply defaults on discriminator)
  const normalizedParams = params.mode === undefined ? { ...params, mode: 'update' } : params;
  const parsed = ParamsSchema.safeParse(normalizedParams);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const { path: filePath, mode, dryRun } = parsed.data;

  try {
    const { resolvedPath, content } = await readFile(filePath);

    let result: UpdateModeResult | LineModeResult;
    // Use discriminated union for type narrowing
    if (mode === 'line') {
      result = executeLineMode(content, parsed.data as LineModeParams);
    } else {
      // mode is 'update' (default)
      result = executeUpdateMode(content, parsed.data as UpdateModeParams, filePath);
    }

    // Write if modified and not dry run
    if (result.modified && !dryRun) {
      writeFile(resolvedPath, result.content);
    }

    // Build compact result
    const compactResult: CompactEditResult = {
      path: resolvedPath,
      modified: result.modified,
      message: result.message,
    };

    // Add mode-specific fields
    if ('replacements' in result) {
      compactResult.replacements = result.replacements;
      compactResult.dryRun = result.dryRun;
      // Truncate diff for compact output
      if (result.diff) {
        compactResult.diff = truncateDiff(result.diff, MAX_DIFF_LINES);
      }
    }

    return { success: true, result: compactResult };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
