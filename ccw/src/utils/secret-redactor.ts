/**
 * Secret Redactor - Regex-based secret pattern detection and replacement
 *
 * Scans text for common secret patterns (API keys, tokens, credentials)
 * and replaces them with [REDACTED_SECRET] to prevent leakage into
 * memory extraction outputs.
 *
 * Patterns are intentionally specific (prefix-based) to minimize false positives.
 */

const REDACTED = '[REDACTED_SECRET]';

/**
 * Secret patterns with named regex for each category.
 * Each pattern targets a specific, well-known secret format.
 */
const SECRET_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  // OpenAI API keys: sk-<20+ alphanumeric chars>
  { name: 'openai_key', regex: /sk-[A-Za-z0-9]{20,}/g },
  // AWS Access Key IDs: AKIA<16 uppercase alphanumeric chars>
  { name: 'aws_key', regex: /AKIA[0-9A-Z]{16}/g },
  // Bearer tokens: Bearer <16+ token chars>
  { name: 'bearer_token', regex: /Bearer\s+[A-Za-z0-9._\-]{16,}/g },
  // Secret assignments: key=value or key:value patterns for known secret variable names
  { name: 'secret_assignment', regex: /(?:api_key|token|secret|password)[:=]\S+/gi },
];

/**
 * Apply regex-based secret pattern matching and replacement.
 *
 * Scans the input text for 4 pattern categories:
 * 1. OpenAI API keys (sk-...)
 * 2. AWS Access Key IDs (AKIA...)
 * 3. Bearer tokens (Bearer ...)
 * 4. Secret variable assignments (api_key=..., token:..., etc.)
 *
 * @param text - Input text to scan for secrets
 * @returns Text with all matched secrets replaced by [REDACTED_SECRET]
 */
export function redactSecrets(text: string): string {
  if (!text) return text;

  let result = text;
  for (const { regex } of SECRET_PATTERNS) {
    // Reset lastIndex for global regexes to ensure fresh match on each call
    regex.lastIndex = 0;
    result = result.replace(regex, REDACTED);
  }
  return result;
}
