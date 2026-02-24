// ========================================
// CCW Artifacts - Types & Detection
// ========================================

export type ArtifactType =
  | 'workflow-session'
  | 'lite-session'
  | 'claude-md'
  | 'ccw-config'
  | 'issue';

export interface CcArtifact {
  type: ArtifactType;
  path: string;
}

const TRAILING_PUNCTUATION = /[)\]}>,.;:!?]+$/g;
const WRAP_QUOTES = /^['"`]+|['"`]+$/g;

function normalizePath(raw: string): string {
  return raw.trim().replace(WRAP_QUOTES, '').replace(TRAILING_PUNCTUATION, '');
}

/**
 * Patterns for detecting CCW-related artifacts in terminal output.
 *
 * Notes:
 * - Prefer relative paths (e.g., `.workflow/...`) so callers can resolve against a project root.
 * - Keep patterns conservative to reduce false positives in generic logs.
 */
export const ARTIFACT_PATTERNS: Record<ArtifactType, RegExp[]> = {
  'workflow-session': [
    /(?:^|[^\w.])(\.workflow[\\/](?:active|archives)[\\/][^\s"'`]+[\\/]workflow-session\.json)\b/g,
  ],
  'lite-session': [
    /(?:^|[^\w.])(\.workflow[\\/]\.lite-plan[\\/][^\s"'`]+)\b/g,
  ],
  'claude-md': [
    /([^\s"'`]*CLAUDE\.md)\b/gi,
  ],
  'ccw-config': [
    /(?:^|[^\w.])(\.ccw[\\/][^\s"'`]+)\b/g,
    /(?:^|[^\w.])(ccw\.config\.(?:json|ya?ml|toml))\b/gi,
  ],
  issue: [
    /(?:^|[^\w.])(\.workflow[\\/]issues[\\/][^\s"'`]+)\b/g,
  ],
};

/**
 * Detect CCW artifacts from an arbitrary text blob.
 *
 * Returns a de-duplicated list of `{ type, path }` in discovery order.
 */
export function detectCcArtifacts(text: string): CcArtifact[] {
  if (!text) return [];

  const candidates: Array<CcArtifact & { index: number }> = [];

  for (const type of Object.keys(ARTIFACT_PATTERNS) as ArtifactType[]) {
    for (const pattern of ARTIFACT_PATTERNS[type]) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const raw = match[1] ?? match[0];
        const path = normalizePath(raw);
        if (!path) continue;

        const full = match[0] ?? '';
        const group = match[1] ?? raw;
        const rel = full.indexOf(group);
        const index = (match.index ?? 0) + (rel >= 0 ? rel : 0);

        candidates.push({ type, path, index });
      }
    }
  }

  candidates.sort((a, b) => a.index - b.index);

  const results: CcArtifact[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const key = `${c.type}:${c.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ type: c.type, path: c.path });
  }

  return results;
}
