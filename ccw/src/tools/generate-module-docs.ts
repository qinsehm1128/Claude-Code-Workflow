/**
 * Generate Module Docs Tool
 * Generate documentation for modules and projects with multiple strategies
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { readdirSync, statSync, existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, resolve, basename, extname, relative } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { getSecondaryModel } from './cli-config-manager.js';

// Directories to exclude
const EXCLUDE_DIRS = [
  '.git', '__pycache__', 'node_modules', '.venv', 'venv', 'env',
  'dist', 'build', '.cache', '.pytest_cache', '.mypy_cache',
  'coverage', '.nyc_output', 'logs', 'tmp', 'temp', '.workflow'
];

// Code file extensions
const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.py', '.sh', '.go', '.rs'
];

// Template paths (relative to user home directory)
const TEMPLATE_BASE = '~/.ccw/workflows/cli-templates/prompts/documentation';

// Define Zod schema for validation
const ParamsSchema = z.object({
  strategy: z.enum(['full', 'single', 'project-readme', 'project-architecture', 'http-api']),
  sourcePath: z.string().min(1, 'Source path is required'),
  projectName: z.string().min(1, 'Project name is required'),
  tool: z.enum(['gemini', 'qwen', 'codex']).default('gemini'),
  model: z.string().optional(),
});

type Params = z.infer<typeof ParamsSchema>;

interface ToolOutput {
  success: boolean;
  strategy: string;
  source_path: string;
  project_name: string;
  output_path?: string;
  folder_type?: 'code' | 'navigation';
  tool: string;
  model?: string;
  duration_seconds?: number;
  message?: string;
  error?: string;
}

/**
 * Detect folder type (code vs navigation)
 */
function detectFolderType(dirPath: string): 'code' | 'navigation' {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const codeFiles = entries.filter(e => {
      if (!e.isFile()) return false;
      const ext = extname(e.name).toLowerCase();
      return CODE_EXTENSIONS.includes(ext);
    });
    return codeFiles.length > 0 ? 'code' : 'navigation';
  } catch (e) {
    return 'navigation';
  }
}

/**
 * Calculate output path
 */
function calculateOutputPath(sourcePath: string, projectName: string, projectRoot: string): string {
  const absSource = resolve(sourcePath);
  const normRoot = resolve(projectRoot);
  let relPath = relative(normRoot, absSource);
  relPath = relPath.replace(/\\/g, '/');

  return join('.workflow', 'docs', projectName, relPath);
}

/**
 * Load template content
 */
function loadTemplate(templateName: string): string {
  const homePath = process.env.HOME || process.env.USERPROFILE;
  if (!homePath) {
    return getDefaultTemplate(templateName);
  }

  const templatePath = join(homePath, TEMPLATE_BASE, `${templateName}.txt`);

  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf8');
  }

  return getDefaultTemplate(templateName);
}

/**
 * Get default template content
 */
function getDefaultTemplate(templateName: string): string {
  const fallbacks: Record<string, string> = {
    'api': 'Generate API documentation with function signatures, parameters, return values, and usage examples.',
    'module-readme': 'Generate README documentation with purpose, usage, configuration, and examples.',
    'folder-navigation': 'Generate navigation README with overview of subdirectories and their purposes.',
    'project-readme': 'Generate project README with overview, installation, usage, and configuration.',
    'project-architecture': 'Generate ARCHITECTURE.md with system design, components, and data flow.'
  };

  return fallbacks[templateName] || 'Generate comprehensive documentation.';
}

/**
 * Create temporary prompt file and return path
 */
function createPromptFile(prompt: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const promptFile = join(tmpdir(), `docs-prompt-${timestamp}-${randomSuffix}.txt`);
  writeFileSync(promptFile, prompt, 'utf8');
  return promptFile;
}

/**
 * Build CLI command using stdin piping (avoids shell escaping issues)
 */
function buildCliCommand(tool: string, promptFile: string, model: string): string {
  const normalizedPath = promptFile.replace(/\\/g, '/');
  const isWindows = process.platform === 'win32';

  // Build the cat/read command based on platform
  const catCmd = isWindows ? `Get-Content -Raw "${normalizedPath}" | ` : `cat "${normalizedPath}" | `;

  // Build model flag only if model is specified
  const modelFlag = model ? ` -m "${model}"` : '';

  switch (tool) {
    case 'qwen':
      return `${catCmd}qwen${modelFlag} --yolo`;
    case 'codex':
      // codex uses different syntax - prompt as exec argument
      if (isWindows) {
        return `codex --full-auto exec (Get-Content -Raw "${normalizedPath}")${modelFlag} --skip-git-repo-check -s danger-full-access`;
      }
      return `codex --full-auto exec "$(cat "${normalizedPath}")"${modelFlag} --skip-git-repo-check -s danger-full-access`;
    case 'gemini':
    default:
      return `${catCmd}gemini${modelFlag} --yolo`;
  }
}

/**
 * Scan directory structure
 */
function scanDirectoryStructure(targetPath: string): {
  info: string;
  folderType: 'code' | 'navigation';
} {
  const lines: string[] = [];
  const dirName = basename(targetPath);

  let totalFiles = 0;
  let totalDirs = 0;

  function countRecursive(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      entries.forEach(e => {
        if (e.name.startsWith('.') || EXCLUDE_DIRS.includes(e.name)) return;
        if (e.isFile()) totalFiles++;
        else if (e.isDirectory()) {
          totalDirs++;
          countRecursive(join(dir, e.name));
        }
      });
    } catch (e) {
      // Ignore
    }
  }

  countRecursive(targetPath);
  const folderType = detectFolderType(targetPath);

  lines.push(`Directory: ${dirName}`);
  lines.push(`Total files: ${totalFiles}`);
  lines.push(`Total directories: ${totalDirs}`);
  lines.push(`Folder type: ${folderType}`);

  return {
    info: lines.join('\n'),
    folderType
  };
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'generate_module_docs',
  description: `Generate documentation for modules and projects.

Module-Level Strategies:
- full: Full documentation (API.md + README.md for all directories)
- single: Single-layer documentation (current directory only)

Project-Level Strategies:
- project-readme: Project overview from module docs
- project-architecture: System design documentation
- http-api: HTTP API documentation

Output: .workflow/docs/{projectName}/...`,
  inputSchema: {
    type: 'object',
    properties: {
      strategy: {
        type: 'string',
        enum: ['full', 'single', 'project-readme', 'project-architecture', 'http-api'],
        description: 'Documentation strategy'
      },
      sourcePath: {
        type: 'string',
        description: 'Source module directory path'
      },
      projectName: {
        type: 'string',
        description: 'Project name for output path'
      },
      tool: {
        type: 'string',
        enum: ['gemini', 'qwen', 'codex'],
        description: 'CLI tool to use (default: gemini)',
        default: 'gemini'
      },
      model: {
        type: 'string',
        description: 'Model name (optional, uses tool defaults)'
      }
    },
    required: ['strategy', 'sourcePath', 'projectName']
  }
};

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<ToolOutput>> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const { strategy, sourcePath, projectName, tool, model } = parsed.data;

  try {
    const targetPath = resolve(process.cwd(), sourcePath);

    if (!existsSync(targetPath)) {
      return { success: false, error: `Directory not found: ${targetPath}` };
    }

    if (!statSync(targetPath).isDirectory()) {
      return { success: false, error: `Not a directory: ${targetPath}` };
    }

    // Set model (use secondaryModel from config for internal calls)
    let actualModel = model;
    if (!actualModel) {
      try {
        actualModel = getSecondaryModel(process.cwd(), tool);
      } catch {
        // If config not available, don't specify model - let CLI decide
        actualModel = '';
      }
    }

    // Scan directory
    const { info: structureInfo, folderType } = scanDirectoryStructure(targetPath);

    // Calculate output path (relative for display, absolute for CLI prompt)
    const outputPath = calculateOutputPath(targetPath, projectName, process.cwd());
    const absOutputPath = resolve(process.cwd(), outputPath);

    // Ensure output directory exists
    mkdirSync(absOutputPath, { recursive: true });

    // Build prompt based on strategy
    let prompt: string;
    let templateContent: string;

    switch (strategy) {
      case 'full':
      case 'single':
        if (folderType === 'code') {
          templateContent = loadTemplate('api');
          prompt = `Directory Structure Analysis:
${structureInfo}

Read: ${strategy === 'full' ? '@**/*' : '@*.ts @*.tsx @*.js @*.jsx @*.py @*.sh @*.md @*.json'}

Generate documentation files:
- API.md: Code API documentation
- README.md: Module overview and usage

Output directory: ${absOutputPath}

Template Guidelines:
${templateContent}`;
        } else {
          templateContent = loadTemplate('folder-navigation');
          prompt = `Directory Structure Analysis:
${structureInfo}

Read: @*/API.md @*/README.md

Generate documentation file:
- README.md: Navigation overview of subdirectories

Output directory: ${absOutputPath}

Template Guidelines:
${templateContent}`;
        }
        break;

      case 'project-readme':
        templateContent = loadTemplate('project-readme');
        const projectDocsDir = resolve(process.cwd(), '.workflow', 'docs', projectName);
        prompt = `Read all module documentation:
@.workflow/docs/${projectName}/**/API.md
@.workflow/docs/${projectName}/**/README.md

Generate project-level documentation:
- README.md in ${projectDocsDir}/

Template Guidelines:
${templateContent}`;
        break;

      case 'project-architecture':
        templateContent = loadTemplate('project-architecture');
        const projectArchDir = resolve(process.cwd(), '.workflow', 'docs', projectName);
        prompt = `Read project documentation:
@.workflow/docs/${projectName}/README.md
@.workflow/docs/${projectName}/**/API.md

Generate:
- ARCHITECTURE.md: System design documentation
- EXAMPLES.md: Usage examples

Output directory: ${projectArchDir}/

Template Guidelines:
${templateContent}`;
        break;

      case 'http-api':
        const apiDocsDir = resolve(process.cwd(), '.workflow', 'docs', projectName, 'api');
        prompt = `Read API route files:
@**/routes/**/*.ts @**/routes/**/*.js
@**/api/**/*.ts @**/api/**/*.js

Generate HTTP API documentation:
- api/README.md: REST API endpoints documentation

Output directory: ${apiDocsDir}/`;
        break;
    }

    // Create temporary prompt file (avoids shell escaping issues)
    const promptFile = createPromptFile(prompt);

    // Build command using file-based prompt
    const command = buildCliCommand(tool, promptFile, actualModel);

    // Log execution info
    console.log(`📚 Generating docs: ${sourcePath}`);
    console.log(`   Strategy: ${strategy} | Tool: ${tool} | Model: ${actualModel}`);
    console.log(`   Output: ${outputPath}`);

    try {
      const startTime = Date.now();

      execSync(command, {
        cwd: targetPath,
        encoding: 'utf8',
        stdio: 'inherit',
        timeout: 600000, // 10 minutes
        shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
      });

      const duration = Math.round((Date.now() - startTime) / 1000);

      // Cleanup prompt file
      try {
        unlinkSync(promptFile);
      } catch (e) {
        // Ignore cleanup errors
      }

      console.log(`   ✅ Completed in ${duration}s`);

      return {
        success: true,
        result: {
          success: true,
          strategy,
          source_path: sourcePath,
          project_name: projectName,
          output_path: outputPath,
          folder_type: folderType,
          tool,
          model: actualModel,
          duration_seconds: duration,
          message: `Documentation generated successfully in ${duration}s`
        }
      };
    } catch (error) {
      // Cleanup prompt file on error
      try {
        unlinkSync(promptFile);
      } catch (e) {
        // Ignore cleanup errors
      }

      console.log(`   ❌ Generation failed: ${(error as Error).message}`);

      return {
        success: false,
        error: `Documentation generation failed: ${(error as Error).message}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Tool execution failed: ${(error as Error).message}`
    };
  }
}
