/**
 * Skills Routes Module
 * Handles all Skills-related API endpoints
 */
import { readFileSync, existsSync, readdirSync, statSync, unlinkSync, renameSync, promises as fsPromises } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { executeCliTool } from '../../tools/cli-executor.js';
import { SmartContentFormatter } from '../../tools/cli-output-converter.js';
import { validatePath as validateAllowedPath } from '../../utils/path-validator.js';
import type { RouteContext } from './types.js';
import type {
  SkillLocation,
  ParsedSkillFrontmatter,
  SkillSummary,
  SkillsConfig,
  SkillInfo,
  SkillFolderValidation,
  DisabledSkillSummary,
  ExtendedSkillsConfig,
  SkillOperationResult
} from '../../types/skill-types.js';

type GenerationType = 'description' | 'template';
type CliType = 'claude' | 'codex';

/** Get the CLI base directory name based on cliType */
function getCliDir(cliType: CliType): string {
  return cliType === 'codex' ? '.codex' : '.claude';
}

interface GenerationParams {
  generationType: GenerationType;
  description?: string;
  skillName: string;
  location: SkillLocation;
  projectPath: string;
  broadcastToClients?: (data: unknown) => void;
  cliType?: CliType;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ========== Skills Helper Functions ==========

/**
 * Disable a skill by renaming SKILL.md to SKILL.md.disabled
 */
async function disableSkill(
  skillName: string,
  location: SkillLocation,
  projectPath: string,
  initialPath: string,
  reason?: string,  // Kept for API compatibility but no longer used
  cliType: CliType = 'claude'
): Promise<SkillOperationResult> {
  try {
    // Validate skill name
    if (skillName.includes('/') || skillName.includes('\\') || skillName.includes('..')) {
      return { success: false, message: 'Invalid skill name', status: 400 };
    }

    const cliDir = getCliDir(cliType);

    // Get skill directory
    let skillsDir: string;
    if (location === 'project') {
      try {
        const validatedProjectPath = await validateAllowedPath(projectPath, { mustExist: true, allowedDirectories: [initialPath] });
        skillsDir = join(validatedProjectPath, cliDir, 'skills');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, message: message.includes('Access denied') ? 'Access denied' : 'Invalid path', status: 403 };
      }
    } else {
      skillsDir = join(homedir(), cliDir, 'skills');
    }

    const skillDir = join(skillsDir, skillName);
    if (!existsSync(skillDir)) {
      return { success: false, message: 'Skill not found', status: 404 };
    }

    const skillMdPath = join(skillDir, 'SKILL.md');
    if (!existsSync(skillMdPath)) {
      return { success: false, message: 'SKILL.md not found', status: 404 };
    }

    const disabledPath = join(skillDir, 'SKILL.md.disabled');
    if (existsSync(disabledPath)) {
      return { success: false, message: 'Skill already disabled', status: 409 };
    }

    // Rename: SKILL.md → SKILL.md.disabled
    renameSync(skillMdPath, disabledPath);

    return { success: true, message: 'Skill disabled', skillName, location };
  } catch (error) {
    return { success: false, message: (error as Error).message, status: 500 };
  }
}

/**
 * Enable a skill by renaming SKILL.md.disabled back to SKILL.md
 */
async function enableSkill(
  skillName: string,
  location: SkillLocation,
  projectPath: string,
  initialPath: string,
  cliType: CliType = 'claude'
): Promise<SkillOperationResult> {
  try {
    // Validate skill name
    if (skillName.includes('/') || skillName.includes('\\') || skillName.includes('..')) {
      return { success: false, message: 'Invalid skill name', status: 400 };
    }

    const cliDir = getCliDir(cliType);

    // Get skill directory
    let skillsDir: string;
    if (location === 'project') {
      try {
        const validatedProjectPath = await validateAllowedPath(projectPath, { mustExist: true, allowedDirectories: [initialPath] });
        skillsDir = join(validatedProjectPath, cliDir, 'skills');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, message: message.includes('Access denied') ? 'Access denied' : 'Invalid path', status: 403 };
      }
    } else {
      skillsDir = join(homedir(), cliDir, 'skills');
    }

    const skillDir = join(skillsDir, skillName);
    if (!existsSync(skillDir)) {
      return { success: false, message: 'Skill not found', status: 404 };
    }

    const disabledPath = join(skillDir, 'SKILL.md.disabled');
    if (!existsSync(disabledPath)) {
      return { success: false, message: 'Disabled skill not found', status: 404 };
    }

    const skillMdPath = join(skillDir, 'SKILL.md');
    if (existsSync(skillMdPath)) {
      return { success: false, message: 'Skill already enabled', status: 409 };
    }

    // Rename: SKILL.md.disabled → SKILL.md
    renameSync(disabledPath, skillMdPath);

    return { success: true, message: 'Skill enabled', skillName, location };
  } catch (error) {
    return { success: false, message: (error as Error).message, status: 500 };
  }
}

/**
 * Get list of disabled skills by checking for SKILL.md.disabled files
 */
function getDisabledSkillsList(location: SkillLocation, projectPath: string, cliType: CliType = 'claude'): DisabledSkillSummary[] {
  const result: DisabledSkillSummary[] = [];

  const cliDir = getCliDir(cliType);

  // Get skills directory (not a separate disabled directory)
  let skillsDir: string;
  if (location === 'project') {
    skillsDir = join(projectPath, cliDir, 'skills');
  } else {
    skillsDir = join(homedir(), cliDir, 'skills');
  }

  if (!existsSync(skillsDir)) {
    return result;
  }

  try {
    const skills = readdirSync(skillsDir, { withFileTypes: true });
    for (const skill of skills) {
      if (skill.isDirectory()) {
        const disabledPath = join(skillsDir, skill.name, 'SKILL.md.disabled');
        if (existsSync(disabledPath)) {
          const content = readFileSync(disabledPath, 'utf8');
          const parsed = parseSkillFrontmatter(content);
          const skillDir = join(skillsDir, skill.name);
          const supportingFiles = getSupportingFiles(skillDir);

          result.push({
            name: parsed.name || skill.name,
            folderName: skill.name,
            description: parsed.description,
            version: parsed.version,
            allowedTools: parsed.allowedTools,
            location,
            path: skillDir,
            supportingFiles,
            disabledAt: new Date().toISOString(),  // Cannot get exact time without config file
            reason: undefined  // No longer stored
          });
        }
      }
    }
  } catch (error) {
    console.error(`[Skills] Failed to read disabled skills: ${error}`);
  }

  return result;
}

/**
 * Get extended skills config including disabled skills
 */
function getExtendedSkillsConfig(projectPath: string, cliType: CliType = 'claude'): ExtendedSkillsConfig {
  const baseConfig = getSkillsConfig(projectPath, cliType);
  return {
    ...baseConfig,
    disabledProjectSkills: getDisabledSkillsList('project', projectPath, cliType),
    disabledUserSkills: getDisabledSkillsList('user', projectPath, cliType)
  };
}

// ========== Active Skills Helper Functions ==========

/**
 * Parse skill frontmatter (YAML header)
 * @param {string} content - Skill file content
 * @returns {Object} Parsed frontmatter and content
 */
function parseSkillFrontmatter(content: string): ParsedSkillFrontmatter {
  const result: ParsedSkillFrontmatter = {
    name: '',
    description: '',
    version: null,
    allowedTools: [],
    content: ''
  };

  // Check for YAML frontmatter
  if (content.startsWith('---')) {
    const endIndex = content.indexOf('---', 3);
    if (endIndex > 0) {
      const frontmatter = content.substring(3, endIndex).trim();
      result.content = content.substring(endIndex + 3).trim();

      // Parse frontmatter lines
      const lines = frontmatter.split('\n');
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim().toLowerCase();
          const value = line.substring(colonIndex + 1).trim();

          if (key === 'name') {
            result.name = value.replace(/^["']|["']$/g, '');
          } else if (key === 'description') {
            result.description = value.replace(/^["']|["']$/g, '');
          } else if (key === 'version') {
            result.version = value.replace(/^["']|["']$/g, '');
          } else if (key === 'allowed-tools' || key === 'allowedtools') {
            // Parse as comma-separated or YAML array
            result.allowedTools = value
              .replace(/^\[|\]$/g, '')
              .split(',')
              .map((tool) => tool.trim())
              .filter(Boolean);
          }
        }
      }
    }
  } else {
    result.content = content;
  }

  return result;
}

/**
 * Get list of supporting files for a skill (recursive)
 * @param {string} skillDir
 * @returns {string[]} Array of relative paths (directories end with '/')
 */
function getSupportingFiles(skillDir: string): string[] {
  const files: string[] = [];

  function readDirRecursive(dirPath: string, relativePath: string = '') {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        // Exclude SKILL.md and SKILL.md.disabled from supporting files
        if (entry.name !== 'SKILL.md' && entry.name !== 'SKILL.md.disabled') {
          const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

          if (entry.isFile()) {
            files.push(entryRelativePath);
          } else if (entry.isDirectory()) {
            // Add directory marker
            files.push(entryRelativePath + '/');
            // Recurse into subdirectory
            readDirRecursive(join(dirPath, entry.name), entryRelativePath);
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  readDirRecursive(skillDir);
  return files;
}

/**
 * Get skills configuration from project and user directories
 * @param {string} projectPath
 * @returns {Object}
 */
function getSkillsConfig(projectPath: string, cliType: CliType = 'claude'): SkillsConfig {
  const result: SkillsConfig = {
    projectSkills: [],
    userSkills: []
  };

  const cliDir = getCliDir(cliType);

  try {
    // Project skills: .<cliType>/skills/
    const projectSkillsDir = join(projectPath, cliDir, 'skills');
    if (existsSync(projectSkillsDir)) {
      const skills = readdirSync(projectSkillsDir, { withFileTypes: true });
      for (const skill of skills) {
        if (skill.isDirectory()) {
          const skillMdPath = join(projectSkillsDir, skill.name, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            const content = readFileSync(skillMdPath, 'utf8');
            const parsed = parseSkillFrontmatter(content);

            // Get supporting files
            const skillDir = join(projectSkillsDir, skill.name);
            const supportingFiles = getSupportingFiles(skillDir);

            result.projectSkills.push({
              name: parsed.name || skill.name,
              folderName: skill.name,  // Actual folder name for API queries
              description: parsed.description,
              version: parsed.version,
              allowedTools: parsed.allowedTools,
              location: 'project',
              path: skillDir,
              supportingFiles
            });
          }
        }
      }
    }

    // User skills: ~/.<cliType>/skills/
    const userSkillsDir = join(homedir(), cliDir, 'skills');
    if (existsSync(userSkillsDir)) {
      const skills = readdirSync(userSkillsDir, { withFileTypes: true });
      for (const skill of skills) {
        if (skill.isDirectory()) {
          const skillMdPath = join(userSkillsDir, skill.name, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            const content = readFileSync(skillMdPath, 'utf8');
            const parsed = parseSkillFrontmatter(content);

            // Get supporting files
            const skillDir = join(userSkillsDir, skill.name);
            const supportingFiles = getSupportingFiles(skillDir);

            result.userSkills.push({
              name: parsed.name || skill.name,
              folderName: skill.name,  // Actual folder name for API queries
              description: parsed.description,
              version: parsed.version,
              allowedTools: parsed.allowedTools,
              location: 'user',
              path: skillDir,
              supportingFiles
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error reading skills config:', error);
  }

  return result;
}

/**
 * Get single skill detail
 * @param {string} skillName
 * @param {string} location - 'project' or 'user'
 * @param {string} projectPath
 * @returns {Object}
 */
async function getSkillDetail(skillName: string, location: SkillLocation, projectPath: string, initialPath: string, cliType: CliType = 'claude') {
  try {
    if (skillName.includes('/') || skillName.includes('\\')) {
      return { error: 'Access denied', status: 403 };
    }
    if (skillName.includes('..')) {
      return { error: 'Invalid skill name', status: 400 };
    }

    const cliDir = getCliDir(cliType);

    let baseDir;
    if (location === 'project') {
      try {
        const validatedProjectPath = await validateAllowedPath(projectPath, { mustExist: true, allowedDirectories: [initialPath] });
        baseDir = join(validatedProjectPath, cliDir, 'skills');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message.includes('Access denied') ? 403 : 400;
        console.error(`[Skills] Project path validation failed: ${message}`);
        return { error: status === 403 ? 'Access denied' : 'Invalid path', status };
      }
    } else {
      baseDir = join(homedir(), cliDir, 'skills');
    }

    const skillDir = join(baseDir, skillName);
    const skillMdCandidate = join(skillDir, 'SKILL.md');

    let skillMdPath;
    try {
      skillMdPath = await validateAllowedPath(skillMdCandidate, { mustExist: true, allowedDirectories: [skillDir] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('File not found')) {
        return { error: 'Skill not found', status: 404 };
      }
      const status = message.includes('Access denied') ? 403 : 400;
      console.error(`[Skills] Path validation failed: ${message}`);
      return { error: status === 403 ? 'Access denied' : 'Invalid path', status };
    }

    const content = readFileSync(skillMdPath, 'utf8');
    const parsed = parseSkillFrontmatter(content);
    const supportingFiles = getSupportingFiles(skillDir);

    return {
      skill: {
        name: parsed.name || skillName,
        folderName: skillName,  // Actual folder name for API queries
        description: parsed.description,
        version: parsed.version,
        allowedTools: parsed.allowedTools,
        content: parsed.content,
        location,
        path: skillDir,
        supportingFiles
      }
    };
  } catch (error) {
    return { error: (error as Error).message, status: 500 };
  }
}

/**
 * Delete a skill
 * @param {string} skillName
 * @param {string} location
 * @param {string} projectPath
 * @returns {Object}
 */
async function deleteSkill(skillName: string, location: SkillLocation, projectPath: string, initialPath: string, cliType: CliType = 'claude') {
  try {
    if (skillName.includes('/') || skillName.includes('\\')) {
      return { error: 'Access denied', status: 403 };
    }
    if (skillName.includes('..')) {
      return { error: 'Invalid skill name', status: 400 };
    }

    const cliDir = getCliDir(cliType);

    let baseDir;
    if (location === 'project') {
      try {
        const validatedProjectPath = await validateAllowedPath(projectPath, { mustExist: true, allowedDirectories: [initialPath] });
        baseDir = join(validatedProjectPath, cliDir, 'skills');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message.includes('Access denied') ? 403 : 400;
        console.error(`[Skills] Project path validation failed: ${message}`);
        return { error: status === 403 ? 'Access denied' : 'Invalid path', status };
      }
    } else {
      baseDir = join(homedir(), cliDir, 'skills');
    }

    const skillDirCandidate = join(baseDir, skillName);

    let skillDir;
    try {
      skillDir = await validateAllowedPath(skillDirCandidate, { mustExist: true, allowedDirectories: [baseDir] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('File not found')) {
        return { error: 'Skill not found', status: 404 };
      }
      const status = message.includes('Access denied') ? 403 : 400;
      console.error(`[Skills] Path validation failed: ${message}`);
      return { error: status === 403 ? 'Access denied' : 'Invalid path', status };
    }

    await fsPromises.rm(skillDir, { recursive: true, force: true });

    return { success: true, skillName, location };
  } catch (error) {
    return { error: (error as Error).message, status: 500 };
  }
}

/**
 * Validate skill folder structure
 * @param {string} folderPath - Path to skill folder
 * @returns {Object} Validation result with skill info
 */
function validateSkillFolder(folderPath: string): SkillFolderValidation {
  const errors: string[] = [];

  // Check if folder exists
  if (!existsSync(folderPath)) {
    return { valid: false, errors: ['Folder does not exist'], skillInfo: null };
  }

  // Check if it's a directory
  try {
    const stat = statSync(folderPath);
    if (!stat.isDirectory()) {
      return { valid: false, errors: ['Path is not a directory'], skillInfo: null };
    }
  } catch (e) {
    return { valid: false, errors: ['Cannot access folder'], skillInfo: null };
  }

  // Check SKILL.md exists
  const skillMdPath = join(folderPath, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    errors.push('SKILL.md file not found');
    return { valid: false, errors, skillInfo: null };
  }

  // Parse and validate frontmatter
  try {
    const content = readFileSync(skillMdPath, 'utf8');
    const parsed = parseSkillFrontmatter(content);

    if (!parsed.name) {
      errors.push('name field is required in frontmatter');
    }
    if (!parsed.description) {
      errors.push('description field is required in frontmatter');
    }

    // Get supporting files
    const supportingFiles = getSupportingFiles(folderPath);

    // If validation passed
    if (errors.length === 0) {
      return {
        valid: true,
        errors: [],
        skillInfo: {
          name: parsed.name,
          description: parsed.description,
          version: parsed.version,
          allowedTools: parsed.allowedTools,
          supportingFiles
        }
      };
    } else {
      return { valid: false, errors, skillInfo: null };
    }
  } catch (error) {
    return { valid: false, errors: ['Failed to parse SKILL.md: ' + (error as Error).message], skillInfo: null };
  }
}

/**
 * Recursively copy directory
 * @param {string} source - Source directory path
 * @param {string} target - Target directory path
 */
async function copyDirectoryRecursive(source: string, target: string): Promise<void> {
  await fsPromises.mkdir(target, { recursive: true });

  const entries = await fsPromises.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      await fsPromises.copyFile(sourcePath, targetPath);
    }
  }
}

/**
 * Import skill from folder
 * @param {string} sourcePath - Source skill folder path
 * @param {string} location - 'project' or 'user'
 * @param {string} projectPath - Project root path
 * @param {string} customName - Optional custom name for skill
 * @returns {Object}
 */
async function importSkill(sourcePath: string, location: SkillLocation, projectPath: string, customName?: string, cliType: CliType = 'claude') {
  try {
    // Validate source folder
    const validation = validateSkillFolder(sourcePath);
    if (!validation.valid) {
      return { error: validation.errors.join(', ') };
    }

    const cliDir = getCliDir(cliType);
    const baseDir = location === 'project'
      ? join(projectPath, cliDir, 'skills')
      : join(homedir(), cliDir, 'skills');

    // Ensure base directory exists
    if (!existsSync(baseDir)) {
      await fsPromises.mkdir(baseDir, { recursive: true });
    }

    // Determine target folder name
    const skillName = customName || validation.skillInfo.name;
    if (skillName.includes('/') || skillName.includes('\\') || skillName.includes('..')) {
      return { error: 'Invalid skill name', status: 400 };
    }
    const targetPath = join(baseDir, skillName);

    // Check if already exists
    if (existsSync(targetPath)) {
      return { error: `Skill '${skillName}' already exists in ${location} location` };
    }

    // Copy entire folder recursively
    await copyDirectoryRecursive(sourcePath, targetPath);

    return {
      success: true,
      skillName,
      location,
      path: targetPath
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/**
 * Generate skill via CLI tool (Claude)
 * @param {Object} params - Generation parameters
 * @param {string} params.generationType - 'description' or 'template'
 * @param {string} params.description - Skill description from user
 * @param {string} params.skillName - Name for the skill
 * @param {string} params.location - 'project' or 'user'
 * @param {string} params.projectPath - Project root path
 * @param {Function} params.broadcastToClients - WebSocket broadcast function
 * @returns {Object}
 */
async function generateSkillViaCLI({ generationType, description, skillName, location, projectPath, broadcastToClients, cliType = 'claude' }: GenerationParams) {
  // Generate unique execution ID for tracking
  const executionId = `skill-gen-${skillName}-${Date.now()}`;

  try {
    // Validate inputs
    if (!skillName) {
      return { error: 'Skill name is required' };
    }
    if (generationType === 'description' && !description) {
      return { error: 'Description is required for description-based generation' };
    }

    const cliDir = getCliDir(cliType);

    // Determine target directory
    const baseDir = location === 'project'
      ? join(projectPath, cliDir, 'skills')
      : join(homedir(), cliDir, 'skills');

    const targetPath = join(baseDir, skillName);

    // Check if already exists
    if (existsSync(targetPath)) {
      return { error: `Skill '${skillName}' already exists in ${location} location` };
    }

    // Ensure base directory exists
    if (!existsSync(baseDir)) {
      await fsPromises.mkdir(baseDir, { recursive: true });
    }

    // Build structured skill parameters for /skill-generator
    const targetLocationDisplay = location === 'project'
      ? '.claude/skills/'
      : '~/.claude/skills/';

    // Structured fields from user input
    const skillParams = {
      skill_name: skillName,
      description: description || 'Generate a basic skill template',
      target_location: targetLocationDisplay,
      target_path: targetPath,
      location_type: location // 'project' | 'user'
    };

    // Prompt that invokes /skill-generator skill with structured parameters
    const prompt = `/skill-generator

## Skill Parameters (Structured Input)

\`\`\`json
${JSON.stringify(skillParams, null, 2)}
\`\`\`

## User Request

Create a new Claude Code skill with the following specifications:

- **Skill Name**: ${skillName}
- **Description**: ${description || 'Generate a basic skill template'}
- **Target Location**: ${targetLocationDisplay}${skillName}
- **Location Type**: ${location === 'project' ? 'Project-level (.claude/skills/)' : 'User-level (~/.claude/skills/)'}

## Instructions

1. Use the skill-generator to create a complete skill structure
2. Generate SKILL.md with proper frontmatter (name, description, version, allowed-tools)
3. Create necessary supporting files (phases, specs, templates as needed)
4. Follow Claude Code skill design patterns and best practices
5. Output all files to: ${targetPath}`;

    // Broadcast CLI_EXECUTION_STARTED event
    if (broadcastToClients) {
      broadcastToClients({
        type: 'CLI_EXECUTION_STARTED',
        payload: {
          executionId,
          tool: 'claude',
          mode: 'write',
          category: 'internal',
          context: 'skill-generation',
          skillName
        }
      });
    }

    // Create onOutput callback for real-time streaming
    const onOutput = broadcastToClients
      ? (unit: import('../../tools/cli-output-converter.js').CliOutputUnit) => {
          // CliOutputUnit handler: use SmartContentFormatter for intelligent formatting (never returns null)
          const content = SmartContentFormatter.format(unit.content, unit.type);
          broadcastToClients({
            type: 'CLI_OUTPUT',
            payload: {
              executionId,
              chunkType: unit.type,
              data: content
            }
          });
        }
      : undefined;

    // Execute CLI tool (Claude) with write mode
    const startTime = Date.now();
    const result = await executeCliTool({
      tool: 'claude',
      prompt,
      mode: 'write',
      cd: baseDir,
      timeout: 600000, // 10 minutes
      category: 'internal',
      id: executionId
    }, onOutput);

    // Broadcast CLI_EXECUTION_COMPLETED event
    if (broadcastToClients) {
      broadcastToClients({
        type: 'CLI_EXECUTION_COMPLETED',
        payload: {
          executionId,
          success: result.success,
          status: result.execution?.status || (result.success ? 'success' : 'error'),
          duration_ms: Date.now() - startTime
        }
      });
    }

    // Check if execution was successful
    if (!result.success) {
      return {
        error: `CLI generation failed: ${result.stderr || 'Unknown error'}`,
        stdout: result.parsedOutput || result.stdout,
        stderr: result.stderr
      };
    }

    // Validate the generated skill
    const validation = validateSkillFolder(targetPath);
    if (!validation.valid) {
      return {
        error: `Generated skill is invalid: ${validation.errors.join(', ')}`,
        stdout: result.parsedOutput || result.stdout,
        stderr: result.stderr
      };
    }

    return {
      success: true,
      skillName: validation.skillInfo.name,
      location,
      path: targetPath,
      stdout: result.parsedOutput || result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

// ========== Skills API Routes ==========

/**
 * Handle Skills routes
 * @returns true if route was handled, false otherwise
 */
export async function handleSkillsRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest, broadcastToClients } = ctx;

  // API: Get all skills (project and user) - with optional extended format
  if (pathname === '/api/skills' && req.method === 'GET') {
    const projectPathParam = url.searchParams.get('path') || initialPath;
    const includeDisabled = url.searchParams.get('includeDisabled') === 'true';
    const cliTypeParam = url.searchParams.get('cliType');
    const cliType: CliType = cliTypeParam === 'codex' ? 'codex' : 'claude';

    try {
      const validatedProjectPath = await validateAllowedPath(projectPathParam, { mustExist: true, allowedDirectories: [initialPath] });

      if (includeDisabled) {
        const extendedData = getExtendedSkillsConfig(validatedProjectPath, cliType);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(extendedData));
      } else {
        const skillsData = getSkillsConfig(validatedProjectPath, cliType);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(skillsData));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('Access denied') ? 403 : 400;
      console.error(`[Skills] Project path validation failed: ${message}`);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: status === 403 ? 'Access denied' : 'Invalid path', projectSkills: [], userSkills: [] }));
    }
    return true;
  }

  // API: Get disabled skills list
  if (pathname === '/api/skills/disabled' && req.method === 'GET') {
    const projectPathParam = url.searchParams.get('path') || initialPath;
    const cliTypeParam = url.searchParams.get('cliType');
    const cliType: CliType = cliTypeParam === 'codex' ? 'codex' : 'claude';

    try {
      const validatedProjectPath = await validateAllowedPath(projectPathParam, { mustExist: true, allowedDirectories: [initialPath] });
      const disabledProjectSkills = getDisabledSkillsList('project', validatedProjectPath, cliType);
      const disabledUserSkills = getDisabledSkillsList('user', validatedProjectPath, cliType);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ disabledProjectSkills, disabledUserSkills }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('Access denied') ? 403 : 400;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: status === 403 ? 'Access denied' : 'Invalid path', disabledProjectSkills: [], disabledUserSkills: [] }));
    }
    return true;
  }

  // API: Disable a skill
  if (pathname.match(/^\/api\/skills\/[^/]+\/disable$/) && req.method === 'POST') {
    const pathParts = pathname.split('/');
    const skillName = decodeURIComponent(pathParts[3]);

    handlePostRequest(req, res, async (body) => {
      if (!isRecord(body)) {
        return { error: 'Invalid request body', status: 400 };
      }

      const locationValue = body.location;
      const projectPathParam = typeof body.projectPath === 'string' ? body.projectPath : undefined;
      const reason = typeof body.reason === 'string' ? body.reason : undefined;

      if (locationValue !== 'project' && locationValue !== 'user') {
        return { error: 'Location is required (project or user)' };
      }

      const projectPath = projectPathParam || initialPath;
      const cliTypeValue = typeof body.cliType === 'string' ? body.cliType : 'claude';
      const cliType: CliType = cliTypeValue === 'codex' ? 'codex' : 'claude';
      return disableSkill(skillName, locationValue, projectPath, initialPath, reason, cliType);
    });
    return true;
  }

  // API: Enable a skill
  if (pathname.match(/^\/api\/skills\/[^/]+\/enable$/) && req.method === 'POST') {
    const pathParts = pathname.split('/');
    const skillName = decodeURIComponent(pathParts[3]);

    handlePostRequest(req, res, async (body) => {
      if (!isRecord(body)) {
        return { error: 'Invalid request body', status: 400 };
      }

      const locationValue = body.location;
      const projectPathParam = typeof body.projectPath === 'string' ? body.projectPath : undefined;

      if (locationValue !== 'project' && locationValue !== 'user') {
        return { error: 'Location is required (project or user)' };
      }

      const projectPath = projectPathParam || initialPath;
      const cliTypeValue = typeof body.cliType === 'string' ? body.cliType : 'claude';
      const cliType: CliType = cliTypeValue === 'codex' ? 'codex' : 'claude';
      return enableSkill(skillName, locationValue, projectPath, initialPath, cliType);
    });
    return true;
  }

  // API: List skill directory contents
  if (pathname.match(/^\/api\/skills\/[^/]+\/dir$/) && req.method === 'GET') {
    const pathParts = pathname.split('/');
    const skillName = decodeURIComponent(pathParts[3]);
    const subPath = url.searchParams.get('subpath') || '';
    const location = url.searchParams.get('location') || 'project';
    const projectPathParam = url.searchParams.get('path') || initialPath;
    const cliTypeParam = url.searchParams.get('cliType');
    const dirCliType: CliType = cliTypeParam === 'codex' ? 'codex' : 'claude';
    const dirCliDir = getCliDir(dirCliType);

    if (skillName.includes('/') || skillName.includes('\\') || skillName.includes('..')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid skill name' }));
      return true;
    }

    let baseDir: string;
    if (location === 'project') {
      try {
        const validatedProjectPath = await validateAllowedPath(projectPathParam, { mustExist: true, allowedDirectories: [initialPath] });
        baseDir = join(validatedProjectPath, dirCliDir, 'skills');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message.includes('Access denied') ? 403 : 400;
        console.error(`[Skills] Project path validation failed: ${message}`);
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: status === 403 ? 'Access denied' : 'Invalid path' }));
        return true;
      }
    } else {
      baseDir = join(homedir(), dirCliDir, 'skills');
    }

    const skillRoot = join(baseDir, skillName);
    const requestedDir = subPath ? join(skillRoot, subPath) : skillRoot;

    let dirPath: string;
    try {
      dirPath = await validateAllowedPath(requestedDir, { mustExist: true, allowedDirectories: [skillRoot] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('File not found')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Directory not found' }));
        return true;
      }
      const status = message.includes('Access denied') ? 403 : 400;
      console.error(`[Skills] Path validation failed: ${message}`);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: status === 403 ? 'Access denied' : 'Invalid path' }));
      return true;
    }

    if (!existsSync(dirPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Directory not found' }));
      return true;
    }

    try {
      const stat = statSync(dirPath);
      if (!stat.isDirectory()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Path is not a directory' }));
        return true;
      }

      const entries = readdirSync(dirPath, { withFileTypes: true });
      const files = entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: subPath ? `${subPath}/${entry.name}` : entry.name
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files, subPath, skillName }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return true;
  }

  // API: Read skill file content
  if (pathname.match(/^\/api\/skills\/[^/]+\/file$/) && req.method === 'GET') {
    const pathParts = pathname.split('/');
    const skillName = decodeURIComponent(pathParts[3]);
    const fileName = url.searchParams.get('filename');
    const location = url.searchParams.get('location') || 'project';
    const projectPathParam = url.searchParams.get('path') || initialPath;
    const fileCliTypeParam = url.searchParams.get('cliType');
    const fileCliType: CliType = fileCliTypeParam === 'codex' ? 'codex' : 'claude';
    const fileCliDir = getCliDir(fileCliType);

    if (!fileName) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'filename parameter is required' }));
      return true;
    }

    if (skillName.includes('/') || skillName.includes('\\') || skillName.includes('..')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid skill name' }));
      return true;
    }

    let baseDir: string;
    if (location === 'project') {
      try {
        const validatedProjectPath = await validateAllowedPath(projectPathParam, { mustExist: true, allowedDirectories: [initialPath] });
        baseDir = join(validatedProjectPath, fileCliDir, 'skills');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message.includes('Access denied') ? 403 : 400;
        console.error(`[Skills] Project path validation failed: ${message}`);
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: status === 403 ? 'Access denied' : 'Invalid path' }));
        return true;
      }
    } else {
      baseDir = join(homedir(), fileCliDir, 'skills');
    }

    const skillRoot = join(baseDir, skillName);
    const requestedFile = join(skillRoot, fileName);

    let filePath: string;
    try {
      filePath = await validateAllowedPath(requestedFile, { mustExist: true, allowedDirectories: [skillRoot] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('File not found')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return true;
      }
      const status = message.includes('Access denied') ? 403 : 400;
      console.error(`[Skills] Path validation failed: ${message}`);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: status === 403 ? 'Access denied' : 'Invalid path' }));
      return true;
    }

    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return true;
    }

    try {
      const content = readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content, fileName, path: filePath }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return true;
  }

  // API: Write skill file content
  if (pathname.match(/^\/api\/skills\/[^/]+\/file$/) && req.method === 'POST') {
    const pathParts = pathname.split('/');
    const skillName = decodeURIComponent(pathParts[3]);

    handlePostRequest(req, res, async (body) => {
      if (!isRecord(body)) {
        return { error: 'Invalid request body', status: 400 };
      }

      const fileName = body.fileName;
      const content = body.content;
      const location: SkillLocation = body.location === 'project' ? 'project' : 'user';
      const projectPathParam = typeof body.projectPath === 'string' ? body.projectPath : undefined;

      if (typeof fileName !== 'string' || !fileName) {
        return { error: 'fileName is required' };
      }

      if (typeof content !== 'string') {
        return { error: 'content is required' };
      }

      if (skillName.includes('/') || skillName.includes('\\') || skillName.includes('..')) {
        return { error: 'Invalid skill name', status: 400 };
      }

      const writeCliTypeValue = typeof body.cliType === 'string' ? body.cliType : 'claude';
      const writeCliType: CliType = writeCliTypeValue === 'codex' ? 'codex' : 'claude';
      const writeCliDir = getCliDir(writeCliType);

      let baseDir: string;
      if (location === 'project') {
        try {
          const projectRoot = projectPathParam || initialPath;
          const validatedProjectPath = await validateAllowedPath(projectRoot, { mustExist: true, allowedDirectories: [initialPath] });
          baseDir = join(validatedProjectPath, writeCliDir, 'skills');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const status = message.includes('Access denied') ? 403 : 400;
          console.error(`[Skills] Project path validation failed: ${message}`);
          return { error: status === 403 ? 'Access denied' : 'Invalid path', status };
        }
      } else {
        baseDir = join(homedir(), writeCliDir, 'skills');
      }

      const skillRoot = join(baseDir, skillName);
      const requestedFile = join(skillRoot, fileName);

      let filePath: string;
      try {
        filePath = await validateAllowedPath(requestedFile, { allowedDirectories: [skillRoot] });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message.includes('Access denied') ? 403 : 400;
        console.error(`[Skills] Path validation failed: ${message}`);
        return { error: status === 403 ? 'Access denied' : 'Invalid path', status };
      }

      try {
        await fsPromises.writeFile(filePath, content, 'utf8');
        return { success: true, fileName, path: filePath };
      } catch (error) {
        return { error: (error as Error).message };
      }
    });
    return true;
  }

  // API: Get single skill detail (exclude /dir and /file sub-routes)
  if (pathname.startsWith('/api/skills/') && req.method === 'GET' &&
      !pathname.endsWith('/skills/') && !pathname.endsWith('/dir') && !pathname.endsWith('/file')) {
    const skillName = decodeURIComponent(pathname.replace('/api/skills/', ''));
    const locationParam = url.searchParams.get('location');
    const location: SkillLocation = locationParam === 'user' ? 'user' : 'project';
    const projectPathParam = url.searchParams.get('path') || initialPath;
    const cliTypeParam = url.searchParams.get('cliType');
    const cliType: CliType = cliTypeParam === 'codex' ? 'codex' : 'claude';
    const skillDetail = await getSkillDetail(skillName, location, projectPathParam, initialPath, cliType);
    if (skillDetail.error) {
      res.writeHead(skillDetail.status || 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: skillDetail.error }));
      return true;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(skillDetail));
    return true;
  }

  // API: Delete skill
  if (pathname.startsWith('/api/skills/') && req.method === 'DELETE') {
    const skillName = decodeURIComponent(pathname.replace('/api/skills/', ''));
    if (skillName.includes('/') || skillName.includes('\\')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access denied' }));
      return true;
    }
    if (skillName.includes('..')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid skill name' }));
      return true;
    }
    handlePostRequest(req, res, async (body) => {
      if (!isRecord(body)) {
        return { error: 'Invalid request body', status: 400 };
      }

      const location: SkillLocation = body.location === 'project' ? 'project' : 'user';
      const projectPathParam = typeof body.projectPath === 'string' ? body.projectPath : undefined;
      const delCliTypeValue = typeof body.cliType === 'string' ? body.cliType : 'claude';
      const delCliType: CliType = delCliTypeValue === 'codex' ? 'codex' : 'claude';

      return deleteSkill(skillName, location, projectPathParam || initialPath, initialPath, delCliType);
    });
    return true;
  }

  // API: Validate skill import
  if (pathname === '/api/skills/validate-import' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      if (!isRecord(body)) {
        return { valid: false, errors: ['Source path is required'], skillInfo: null };
      }

      const sourcePath = body.sourcePath;
      if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
        return { valid: false, errors: ['Source path is required'], skillInfo: null };
      }

      try {
        const validatedSourcePath = await validateAllowedPath(sourcePath, { mustExist: true });
        return validateSkillFolder(validatedSourcePath);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message.includes('Access denied') ? 403 : 400;
        console.error(`[Skills] Path validation failed: ${message}`);
        return { error: status === 403 ? 'Access denied' : 'Invalid path', status };
      }
    });
    return true;
  }

  // API: Create/Import skill
  if (pathname === '/api/skills/create' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      if (!isRecord(body)) {
        return { error: 'Invalid request body', status: 400 };
      }

      const mode = body.mode;
      const locationValue = body.location;
      const sourcePath = typeof body.sourcePath === 'string' ? body.sourcePath : undefined;
      const skillName = typeof body.skillName === 'string' ? body.skillName : undefined;
      const description = typeof body.description === 'string' ? body.description : undefined;
      const generationType = typeof body.generationType === 'string' ? body.generationType : undefined;
      const projectPathParam = typeof body.projectPath === 'string' ? body.projectPath : undefined;
      const createCliTypeValue = typeof body.cliType === 'string' ? body.cliType : 'claude';
      const createCliType: CliType = createCliTypeValue === 'codex' ? 'codex' : 'claude';

      if (typeof mode !== 'string' || !mode) {
        return { error: 'Mode is required (import or cli-generate)' };
      }

      if (locationValue !== 'project' && locationValue !== 'user') {
        return { error: 'Location is required (project or user)' };
      }

      const location: SkillLocation = locationValue;
      const projectPath = projectPathParam || initialPath;

      let validatedProjectPath = projectPath;
      if (location === 'project') {
        try {
          validatedProjectPath = await validateAllowedPath(projectPath, { mustExist: true, allowedDirectories: [initialPath] });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const status = message.includes('Access denied') ? 403 : 400;
          console.error(`[Skills] Project path validation failed: ${message}`);
          return { error: status === 403 ? 'Access denied' : 'Invalid path', status };
        }
      }

      if (mode === 'import') {
        // Import mode: copy existing skill folder
        if (!sourcePath) {
          return { error: 'Source path is required for import mode' };
        }

        if (skillName && (skillName.includes('/') || skillName.includes('\\') || skillName.includes('..'))) {
          return { error: 'Invalid skill name', status: 400 };
        }

        let validatedSourcePath;
        try {
          validatedSourcePath = await validateAllowedPath(sourcePath, { mustExist: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const status = message.includes('Access denied') ? 403 : 400;
          console.error(`[Skills] Path validation failed: ${message}`);
          return { error: status === 403 ? 'Access denied' : 'Invalid path', status };
        }

        return await importSkill(validatedSourcePath, location, validatedProjectPath, skillName, createCliType);
      } else if (mode === 'cli-generate') {
        // CLI generate mode: use Claude to generate skill
        if (!skillName) {
          return { error: 'Skill name is required for CLI generation mode' };
        }
        if (skillName.includes('/') || skillName.includes('\\') || skillName.includes('..')) {
          return { error: 'Invalid skill name', status: 400 };
        }

        return await generateSkillViaCLI({
          generationType: generationType === 'template' ? 'template' : 'description',
          description,
          skillName,
          location,
          projectPath: validatedProjectPath,
          broadcastToClients,
          cliType: createCliType
        });
      } else {
        return { error: 'Invalid mode. Must be "import" or "cli-generate"' };
      }
    });
    return true;
  }

  return false;
}
