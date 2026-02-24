/**
 * KeywordDetector - Detects magic keywords in user prompts
 *
 * Detects magic keywords in user prompts and returns the appropriate
 * mode message to inject into context.
 *
 * Ported from oh-my-opencode's keyword-detector hook with adaptations
 * for CCW architecture.
 */

/**
 * Supported keyword types for mode detection
 */
export type KeywordType =
  | 'cancel'      // Priority 1: Cancel all operations
  | 'ralph'       // Priority 2: Ralph mode
  | 'autopilot'   // Priority 3: Auto-pilot mode
  | 'ultrapilot'  // Priority 4: Ultra-pilot mode (parallel build)
  | 'team'        // Priority 4.5: Team mode (coordinated agents)
  | 'ultrawork'   // Priority 5: Ultra-work mode
  | 'swarm'       // Priority 6: Swarm mode (multiple agents)
  | 'pipeline'    // Priority 7: Pipeline mode (chained agents)
  | 'ralplan'     // Priority 8: Ralplan mode
  | 'plan'        // Priority 9: Planning mode
  | 'tdd'         // Priority 10: Test-driven development mode
  | 'ultrathink'  // Priority 11: Deep thinking mode
  | 'deepsearch'  // Priority 12: Deep search mode
  | 'analyze'     // Priority 13: Analysis mode
  | 'codex'       // Priority 14: Delegate to Codex
  | 'gemini';     // Priority 15: Delegate to Gemini

/**
 * Detected keyword with metadata
 */
export interface DetectedKeyword {
  /** Type of the detected keyword */
  type: KeywordType;
  /** The actual matched keyword string */
  keyword: string;
  /** Position in the original text where the keyword was found */
  position: number;
}

/**
 * Keyword patterns for each mode
 */
export const KEYWORD_PATTERNS: Record<KeywordType, RegExp> = {
  cancel: /\b(cancelomc|stopomc)\b/i,
  ralph: /\b(ralph)\b/i,
  autopilot: /\b(autopilot|auto[\s-]?pilot|fullsend|full\s+auto)\b/i,
  ultrapilot: /\b(ultrapilot|ultra-pilot)\b|\bparallel\s+build\b|\bswarm\s+build\b/i,
  ultrawork: /\b(ultrawork|ulw)\b/i,
  swarm: /\bswarm\s+\d+\s+agents?\b|\bcoordinated\s+agents\b|\bteam\s+mode\b/i,
  team: /(?<!\b(?:my|the|our|a|his|her|their|its)\s)\bteam\b|\bcoordinated\s+team\b/i,
  pipeline: /\bagent\s+pipeline\b|\bchain\s+agents\b/i,
  ralplan: /\b(ralplan)\b/i,
  plan: /\bplan\s+(this|the)\b/i,
  tdd: /\b(tdd)\b|\btest\s+first\b/i,
  ultrathink: /\b(ultrathink)\b/i,
  deepsearch: /\b(deepsearch)\b|\bsearch\s+the\s+codebase\b|\bfind\s+in\s+(the\s+)?codebase\b/i,
  analyze: /\b(deep[\s-]?analyze|deepanalyze)\b/i,
  codex: /\b(ask|use|delegate\s+to)\s+(codex|gpt)\b/i,
  gemini: /\b(ask|use|delegate\s+to)\s+gemini\b/i
};

/**
 * Priority order for keyword detection
 * Higher priority keywords are checked first and take precedence in conflict resolution
 */
export const KEYWORD_PRIORITY: KeywordType[] = [
  'cancel', 'ralph', 'autopilot', 'ultrapilot', 'team', 'ultrawork',
  'swarm', 'pipeline', 'ralplan', 'plan', 'tdd',
  'ultrathink', 'deepsearch', 'analyze', 'codex', 'gemini'
];

/**
 * Remove code blocks from text to prevent false positives
 * Handles both fenced code blocks and inline code
 *
 * @param text - The text to clean
 * @returns Text with code blocks removed
 */
export function removeCodeBlocks(text: string): string {
  // Remove fenced code blocks (``` or ~~~)
  let result = text.replace(/```[\s\S]*?```/g, '');
  result = result.replace(/~~~[\s\S]*?~~~/g, '');

  // Remove inline code (single backticks)
  result = result.replace(/`[^`]+`/g, '');

  return result;
}

/**
 * Sanitize text for keyword detection by removing structural noise.
 * Strips XML tags, URLs, file paths, and code blocks.
 *
 * @param text - The text to sanitize
 * @returns Sanitized text ready for keyword detection
 */
export function sanitizeText(text: string): string {
  // Remove XML tag blocks (opening + content + closing; tag names must match)
  let result = text.replace(/<(\w[\w-]*)[\s>][\s\S]*?<\/\1>/g, '');
  // Remove self-closing XML tags
  result = result.replace(/<\w[\w-]*(?:\s[^>]*)?\s*\/>/g, '');
  // Remove URLs
  result = result.replace(/https?:\/\/\S+/g, '');
  // Remove file paths - requires leading / or ./ or multi-segment dir/file.ext
  result = result.replace(/(^|[\s"'`(])(?:\.?\/(?:[\w.-]+\/)*[\w.-]+|(?:[\w.-]+\/)+[\w.-]+\.\w+)/gm, '$1');
  // Remove code blocks (fenced and inline)
  result = removeCodeBlocks(result);
  return result;
}

/**
 * Detect keywords in text and return matches with type info
 *
 * @param text - The text to analyze
 * @param options - Optional configuration
 * @returns Array of detected keywords with metadata
 */
export function detectKeywords(
  text: string,
  options?: { teamEnabled?: boolean }
): DetectedKeyword[] {
  const detected: DetectedKeyword[] = [];
  const cleanedText = sanitizeText(text);
  const teamEnabled = options?.teamEnabled ?? false;

  // Check each keyword type in priority order
  for (const type of KEYWORD_PRIORITY) {
    // Skip team-related types when team feature is disabled
    if ((type === 'team' || type === 'ultrapilot' || type === 'swarm') && !teamEnabled) {
      continue;
    }

    const pattern = KEYWORD_PATTERNS[type];
    const match = cleanedText.match(pattern);

    if (match && match.index !== undefined) {
      detected.push({
        type,
        keyword: match[0],
        position: match.index
      });

      // Legacy ultrapilot/swarm also activate team mode internally
      if (teamEnabled && (type === 'ultrapilot' || type === 'swarm')) {
        detected.push({
          type: 'team',
          keyword: match[0],
          position: match.index
        });
      }
    }
  }

  return detected;
}

/**
 * Check if text contains any magic keyword
 *
 * @param text - The text to check
 * @returns true if any keyword is detected
 */
export function hasKeyword(text: string): boolean {
  return detectKeywords(text).length > 0;
}

/**
 * Get all detected keywords with conflict resolution applied
 *
 * Conflict resolution rules:
 * - cancel suppresses everything (exclusive)
 * - team beats autopilot (mutual exclusion)
 *
 * @param text - The text to analyze
 * @param options - Optional configuration
 * @returns Array of resolved keyword types in priority order
 */
export function getAllKeywords(
  text: string,
  options?: { teamEnabled?: boolean }
): KeywordType[] {
  const detected = detectKeywords(text, options);

  if (detected.length === 0) return [];

  let types = Array.from(new Set(detected.map(d => d.type)));

  // Exclusive: cancel suppresses everything
  if (types.includes('cancel')) return ['cancel'];

  // Mutual exclusion: team beats autopilot (ultrapilot/swarm now map to team at detection)
  if (types.includes('team') && types.includes('autopilot')) {
    types = types.filter(t => t !== 'autopilot');
  }

  // Sort by priority order
  return KEYWORD_PRIORITY.filter(k => types.includes(k));
}

/**
 * Get the highest priority keyword detected with conflict resolution
 *
 * @param text - The text to analyze
 * @param options - Optional configuration
 * @returns The primary detected keyword or null if none found
 */
export function getPrimaryKeyword(
  text: string,
  options?: { teamEnabled?: boolean }
): DetectedKeyword | null {
  const allKeywords = getAllKeywords(text, options);

  if (allKeywords.length === 0) {
    return null;
  }

  // Get the highest priority keyword type
  const primaryType = allKeywords[0];

  // Find the original detected keyword for this type
  const detected = detectKeywords(text, options);
  const match = detected.find(d => d.type === primaryType);

  return match || null;
}

/**
 * Get keyword type for a given keyword string
 *
 * @param keyword - The keyword string to look up
 * @returns The keyword type or null if not found
 */
export function getKeywordType(keyword: string): KeywordType | null {
  const normalizedKeyword = keyword.toLowerCase();

  for (const type of KEYWORD_PRIORITY) {
    const pattern = KEYWORD_PATTERNS[type];
    if (pattern.test(normalizedKeyword)) {
      return type;
    }
  }

  return null;
}

/**
 * Check if a specific keyword type is detected in text
 *
 * @param text - The text to check
 * @param type - The keyword type to look for
 * @returns true if the keyword type is detected
 */
export function hasKeywordType(text: string, type: KeywordType): boolean {
  const cleanedText = sanitizeText(text);
  const pattern = KEYWORD_PATTERNS[type];
  return pattern.test(cleanedText);
}
