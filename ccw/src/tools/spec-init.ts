/**
 * Spec Init - Initialize the 2-dimension spec system
 *
 * Creates .ccw/specs/, .ccw/personal/,
 * and .ccw/.spec-index/ directories with seed MD documents
 * containing YAML frontmatter templates.
 *
 * Idempotent: skips existing files, only creates missing directories/files.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpecFrontmatter {
  title: string;
  dimension: string;
  category?: 'general' | 'exploration' | 'planning' | 'execution';
  keywords: string[];
  readMode: 'required' | 'optional';
  priority: 'high' | 'medium' | 'low';
}

export interface SeedDoc {
  filename: string;
  frontmatter: SpecFrontmatter;
  body: string;
}

export interface InitResult {
  created: string[];
  skipped: string[];
  directories: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DIMENSIONS = ['specs', 'personal'] as const;
export const INDEX_DIR = '.spec-index';

// ---------------------------------------------------------------------------
// Seed Documents
// ---------------------------------------------------------------------------

export const SEED_DOCS: Map<string, SeedDoc[]> = new Map([
  [
    'specs',
    [
      {
        filename: 'coding-conventions.md',
        frontmatter: {
          title: 'Coding Conventions',
          dimension: 'specs',
          category: 'general',
          keywords: ['typescript', 'naming', 'style', 'convention'],
          readMode: 'required',
          priority: 'high',
        },
        body: `# Coding Conventions

## Naming

- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
- Use UPPER_SNAKE_CASE for constants

## Formatting

- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line constructs

## Patterns

- Prefer composition over inheritance
- Use early returns to reduce nesting
- Keep functions under 30 lines when practical

## Error Handling

- Always handle errors explicitly
- Prefer typed errors over generic catch-all
- Log errors with sufficient context
`,
      },
      {
        filename: 'architecture-constraints.md',
        frontmatter: {
          title: 'Architecture Constraints',
          dimension: 'specs',
          category: 'planning',
          keywords: ['architecture', 'module', 'layer', 'pattern'],
          readMode: 'required',
          priority: 'high',
        },
        body: `# Architecture Constraints

## Module Boundaries

- Each module owns its data and exposes a public API
- No circular dependencies between modules
- Shared utilities live in a dedicated shared layer

## Layer Separation

- Presentation layer must not import data layer directly
- Business logic must be independent of framework specifics
- Configuration must be externalized, not hardcoded

## Dependency Rules

- External dependencies require justification
- Prefer standard library when available
- Pin dependency versions for reproducibility
`,
      },
    ],
  ],
  [
    'personal',
    [
      {
        filename: 'coding-style.md',
        frontmatter: {
          title: 'Personal Coding Style',
          dimension: 'personal',
          category: 'general',
          keywords: ['style', 'preference'],
          readMode: 'optional',
          priority: 'medium',
        },
        body: `# Personal Coding Style

## Preferences

- Describe your preferred coding style here
- Example: verbose variable names vs terse, functional vs imperative

## Patterns I Prefer

- List patterns you reach for most often
- Example: builder pattern, factory functions, tagged unions

## Things I Avoid

- List anti-patterns or approaches you dislike
- Example: deep inheritance hierarchies, magic strings
`,
      },
      {
        filename: 'tool-preferences.md',
        frontmatter: {
          title: 'Tool Preferences',
          dimension: 'personal',
          category: 'general',
          keywords: ['tool', 'cli', 'editor'],
          readMode: 'optional',
          priority: 'low',
        },
        body: `# Tool Preferences

## Editor

- Preferred editor and key extensions/plugins

## CLI Tools

- Preferred shell, package manager, build tools

## Debugging

- Preferred debugging approach and tools
`,
      },
    ],
  ],
]);

// ---------------------------------------------------------------------------
// Frontmatter Serializer
// ---------------------------------------------------------------------------

/**
 * Serialize a SpecFrontmatter object to YAML frontmatter string.
 * Uses template literal to avoid a js-yaml dependency.
 */
export function formatFrontmatter(fm: SpecFrontmatter): string {
  const keywordsYaml = fm.keywords.map((k) => `  - ${k}`).join('\n');
  const lines = [
    '---',
    `title: "${fm.title}"`,
    `dimension: ${fm.dimension}`,
  ];
  if (fm.category) {
    lines.push(`category: ${fm.category}`);
  }
  lines.push(
    `keywords:`,
    keywordsYaml,
    `readMode: ${fm.readMode}`,
    `priority: ${fm.priority}`,
    '---'
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Init Function
// ---------------------------------------------------------------------------

/**
 * Initialize the spec system directory structure and seed documents.
 *
 * Idempotent: creates directories if missing, writes seed files only when
 * they do not already exist.
 *
 * @param projectPath - Absolute path to the project root
 * @returns InitResult with lists of created/skipped paths
 */
export function initSpecSystem(projectPath: string): InitResult {
  const ccwDir = join(projectPath, '.ccw');
  const result: InitResult = {
    created: [],
    skipped: [],
    directories: [],
  };

  // Ensure .ccw root exists
  if (!existsSync(ccwDir)) {
    mkdirSync(ccwDir, { recursive: true });
  }

  // Create dimension directories
  for (const dim of DIMENSIONS) {
    const dirPath = join(ccwDir, dim);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
      result.directories.push(dirPath);
    }
  }

  // Create index directory inside .ccw (matches spec-index-builder.ts location)
  const indexPath = join(ccwDir, INDEX_DIR);
  if (!existsSync(indexPath)) {
    mkdirSync(indexPath, { recursive: true });
    result.directories.push(indexPath);
  }

  // Write seed documents per dimension
  for (const [dimension, docs] of SEED_DOCS) {
    const dimDir = join(ccwDir, dimension);

    for (const doc of docs) {
      const filePath = join(dimDir, doc.filename);

      if (existsSync(filePath)) {
        result.skipped.push(filePath);
        continue;
      }

      const content = formatFrontmatter(doc.frontmatter) + '\n\n' + doc.body;
      writeFileSync(filePath, content, 'utf8');
      result.created.push(filePath);
    }
  }

  return result;
}
