/**
 * Core AST outline parsing engine using web-tree-sitter.
 *
 * Parses source files into structured symbol outlines (functions, classes, methods, etc.)
 * with line offsets compatible with read_file(offset, limit).
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'path';
import Parser from 'web-tree-sitter';
import type { LanguageConfig } from './outline-queries.js';

export interface OutlineSymbol {
  kind: 'function' | 'class' | 'method' | 'interface' | 'type' | 'enum' | 'property';
  name: string;
  line: number;       // 0-based, compatible with read_file offset
  endLine: number;    // 0-based
  doc: string | null;
  signature: string;  // truncated to 200 chars
  parent: string | null;
  children: number;   // nested method/property count (class/interface)
}

export interface OutlineResult {
  file: string;
  language: string;
  symbols: OutlineSymbol[];
  totalSymbols: number;
}

// Singleton init guard
let initialized = false;

// Language WASM cache (Language loading is heavy IO, cache aggressively)
const languageCache = new Map<string, Parser.Language>();

// Resolve WASM paths via createRequire (works in ESM)
const _require = createRequire(import.meta.url);

function getWasmDir(): string {
  return join(dirname(_require.resolve('tree-sitter-wasms/package.json')), 'out');
}

async function ensureInit(): Promise<void> {
  if (initialized) return;
  await Parser.init();
  initialized = true;
}

async function loadLanguage(grammarName: string): Promise<Parser.Language> {
  const cached = languageCache.get(grammarName);
  if (cached) return cached;

  const wasmPath = join(getWasmDir(), `tree-sitter-${grammarName}.wasm`);
  const lang = await Parser.Language.load(wasmPath);
  languageCache.set(grammarName, lang);
  return lang;
}

/**
 * Parse a source file into an outline of symbols.
 */
export async function parseOutline(
  filePath: string,
  content: string,
  config: LanguageConfig
): Promise<OutlineResult> {
  await ensureInit();

  const language = await loadLanguage(config.grammarName);
  const parser = new Parser();
  parser.setLanguage(language);

  const tree = parser.parse(content);
  if (!tree) {
    parser.delete();
    return { file: filePath, language: config.grammarName, symbols: [], totalSymbols: 0 };
  }

  let query: Parser.Query;
  try {
    query = language.query(config.symbolQuery);
  } catch (err) {
    tree.delete();
    parser.delete();
    throw new Error(`Query compilation failed for ${config.grammarName}: ${(err as Error).message}`);
  }

  const matches = query.matches(tree.rootNode);
  const contentLines = content.split('\n');
  const symbols: OutlineSymbol[] = [];

  for (const match of matches) {
    const symbol = processMatch(match, contentLines, config.grammarName);
    if (symbol) symbols.push(symbol);
  }

  // Sort by line position
  symbols.sort((a, b) => a.line - b.line);

  // Clean up native resources
  query.delete();
  tree.delete();
  parser.delete();

  return {
    file: filePath,
    language: config.grammarName,
    symbols,
    totalSymbols: symbols.length,
  };
}

/**
 * Process a single query match into an OutlineSymbol.
 */
function processMatch(
  match: Parser.QueryMatch,
  contentLines: string[],
  language: string
): OutlineSymbol | null {
  let nameNode: Parser.SyntaxNode | null = null;
  let defNode: Parser.SyntaxNode | null = null;
  let kind = 'function';

  for (const capture of match.captures) {
    if (capture.name === 'name') {
      nameNode = capture.node;
    } else if (capture.name.startsWith('definition.')) {
      defNode = capture.node;
      kind = capture.name.slice('definition.'.length);
    }
  }

  if (!defNode || !nameNode) return null;

  const name = nameNode.text;
  const line = defNode.startPosition.row;
  const endLine = defNode.endPosition.row;
  const signature = extractSignature(defNode.text, language);
  const doc = extractDoc(defNode, contentLines, language);
  const parent = findParent(defNode);
  const children = countChildren(defNode, kind);

  return {
    kind: kind as OutlineSymbol['kind'],
    name,
    line,
    endLine,
    doc,
    signature,
    parent,
    children,
  };
}

/**
 * Extract a concise signature from the node text.
 * Takes the first line, removes the body start, truncates to 200 chars.
 */
function extractSignature(nodeText: string, language: string): string {
  const firstLine = nodeText.split('\n')[0].trimEnd();
  let sig = firstLine;

  if (language === 'python') {
    // Remove trailing colon (body start)
    if (sig.endsWith(':')) {
      sig = sig.slice(0, -1).trimEnd();
    }
  } else {
    // Remove opening brace and everything after
    const braceIdx = sig.indexOf('{');
    if (braceIdx > 0) {
      sig = sig.substring(0, braceIdx).trimEnd();
    }
  }

  if (sig.length > 200) {
    sig = sig.substring(0, 200) + '...';
  }

  return sig;
}

/**
 * Extract documentation comment for a definition node.
 */
function extractDoc(
  defNode: Parser.SyntaxNode,
  contentLines: string[],
  language: string
): string | null {
  if (language === 'python') {
    return extractPythonDocstring(defNode);
  }
  return extractCommentDoc(defNode, contentLines);
}

/**
 * Extract comment doc by looking at lines before the definition.
 */
function extractCommentDoc(
  defNode: Parser.SyntaxNode,
  contentLines: string[]
): string | null {
  const defLine = defNode.startPosition.row;
  let endIdx = defLine - 1;
  if (endIdx < 0) return null;

  // Skip at most one blank line
  if (contentLines[endIdx].trim() === '') {
    endIdx--;
    if (endIdx < 0) return null;
  }

  const endText = contentLines[endIdx].trim();

  // Block comment ending with */
  if (endText.endsWith('*/')) {
    let startIdx = endIdx;
    while (startIdx > 0 && !contentLines[startIdx].trim().startsWith('/*')) {
      startIdx--;
    }
    return cleanBlockComment(contentLines.slice(startIdx, endIdx + 1).join('\n'));
  }

  // Line comments (// or /// or #)
  if (endText.startsWith('//') || endText.startsWith('#')) {
    let startIdx = endIdx;
    while (startIdx > 0) {
      const prevText = contentLines[startIdx - 1].trim();
      if (prevText.startsWith('//') || prevText.startsWith('#')) {
        startIdx--;
      } else {
        break;
      }
    }
    return cleanLineComments(contentLines.slice(startIdx, endIdx + 1).join('\n'));
  }

  return null;
}

/**
 * Extract Python docstring from function/class body.
 */
function extractPythonDocstring(defNode: Parser.SyntaxNode): string | null {
  const body = defNode.childForFieldName('body');
  if (!body) return null;

  const firstChild = body.namedChildren[0];
  if (!firstChild || firstChild.type !== 'expression_statement') return null;

  const expr = firstChild.namedChildren[0];
  if (!expr || (expr.type !== 'string' && expr.type !== 'concatenated_string')) return null;

  let text = expr.text;
  // Remove triple-quote markers
  for (const quote of ['"""', "'''"]) {
    if (text.startsWith(quote) && text.endsWith(quote)) {
      text = text.slice(3, -3);
      break;
    }
  }
  text = text.trim();
  return text || null;
}

/**
 * Clean block comment text.
 */
function cleanBlockComment(text: string): string | null {
  let lines = text.split('\n');
  // Remove /* and */
  lines[0] = lines[0].replace(/^\s*\/\*\*?\s?/, '');
  lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*\*\/\s*$/, '');
  // Remove leading * from middle lines
  lines = lines.map(l => l.replace(/^\s*\*\s?/, ''));
  const result = lines.join('\n').trim();
  return result || null;
}

/**
 * Clean line comment (// or #) text.
 */
function cleanLineComments(text: string): string | null {
  const lines = text.split('\n').map(l => l.replace(/^\s*(?:\/\/\/?\s?|#\s?)/, ''));
  const result = lines.join('\n').trim();
  return result || null;
}

/**
 * Find the parent class/interface/impl name for a definition node.
 */
function findParent(defNode: Parser.SyntaxNode): string | null {
  let current = defNode.parent;
  while (current) {
    const type = current.type;

    // Common parent types across languages
    if (
      type === 'class_declaration' || type === 'interface_declaration' ||
      type === 'class_definition' || type === 'enum_declaration' ||
      type === 'impl_item' || type === 'class_specifier' || type === 'struct_specifier'
    ) {
      // Try 'name' field first, then 'type' field (for Rust impl_item)
      const nameNode = current.childForFieldName('name') || current.childForFieldName('type');
      if (nameNode) return nameNode.text;
    }

    current = current.parent;
  }

  return null;
}

/**
 * Count direct children (methods/properties) for class/interface nodes.
 */
function countChildren(defNode: Parser.SyntaxNode, kind: string): number {
  if (kind !== 'class' && kind !== 'interface') return 0;

  // Find the body node (class_body, interface_body, block, declaration_list, etc.)
  let body = defNode.childForFieldName('body');
  if (!body) {
    for (const child of defNode.namedChildren) {
      if (
        child.type === 'class_body' || child.type === 'interface_body' ||
        child.type === 'declaration_list' || child.type === 'block' ||
        child.type === 'enum_body' || child.type === 'field_declaration_list'
      ) {
        body = child;
        break;
      }
    }
  }

  if (!body) return 0;
  return body.namedChildCount;
}
