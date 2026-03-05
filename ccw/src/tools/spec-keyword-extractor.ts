/**
 * Spec Keyword Extractor
 *
 * Extracts keywords from user prompt text for matching against
 * spec document YAML frontmatter keywords.
 *
 * Supports:
 * - English word tokenization (split by spaces/punctuation, remove stop words)
 * - Chinese character segment extraction (CJK boundary splitting)
 */

/**
 * Common English stop words to filter out during keyword extraction.
 * These words appear frequently but carry little semantic meaning
 * for spec matching.
 */
export const STOP_WORDS = new Set([
  // Articles
  'a', 'an', 'the',
  // Pronouns
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  // Prepositions
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'into',
  'about', 'between', 'through', 'after', 'before', 'above', 'below',
  // Conjunctions
  'and', 'or', 'but', 'if', 'then', 'else', 'when', 'while', 'so', 'because',
  // Auxiliary verbs
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'has', 'have', 'had', 'do', 'does', 'did',
  'will', 'would', 'shall', 'should', 'may', 'might', 'can', 'could', 'must',
  // Common verbs (too generic for matching)
  'get', 'got', 'make', 'made', 'let', 'go', 'going', 'come', 'take', 'give',
  // Adverbs
  'not', 'no', 'yes', 'also', 'just', 'only', 'very', 'too', 'now', 'here',
  'there', 'how', 'why', 'where', 'all', 'each', 'every', 'both', 'some',
  'any', 'most', 'more', 'less', 'much', 'many', 'few', 'other', 'such',
  // Misc
  'please', 'need', 'want', 'like', 'know', 'think', 'see', 'use', 'using',
  'way', 'thing', 'something', 'anything', 'nothing',
]);

/**
 * Regex to detect CJK (Chinese/Japanese/Korean) characters.
 * Covers CJK Unified Ideographs and common extensions.
 */
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

/**
 * Regex to match contiguous CJK character sequences.
 */
const CJK_SEGMENT_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g;

/**
 * Regex to split text into English word tokens.
 * Splits on whitespace and common punctuation.
 */
const WORD_SPLIT_REGEX = /[\s,;:!?.()\[\]{}<>"'`~@#$%^&*+=|\\/_\-\u3001\u3002\uff0c\uff1b\uff1a\uff01\uff1f]+/;

/**
 * Minimum word length to keep (filters out single-char English tokens).
 */
const MIN_WORD_LENGTH = 2;

/**
 * Extract keywords from prompt text.
 *
 * For English text:
 *   Splits by whitespace/punctuation, lowercases, removes stop words,
 *   filters short tokens, and deduplicates.
 *
 * For Chinese text:
 *   Extracts contiguous CJK character sequences. For sequences longer
 *   than 2 characters, also generates 2-character sliding window bigrams
 *   to improve matching (since Chinese keywords in YAML are typically
 *   2-4 character compounds).
 *
 * @param text - The user prompt text to extract keywords from
 * @returns Array of unique keywords (lowercase for English, original for CJK)
 */
export function extractKeywords(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const keywords = new Set<string>();

  // Extract English keywords
  const englishKeywords = extractEnglishKeywords(text);
  for (const kw of englishKeywords) {
    keywords.add(kw);
  }

  // Extract CJK keywords
  const cjkKeywords = extractCjkKeywords(text);
  for (const kw of cjkKeywords) {
    keywords.add(kw);
  }

  return Array.from(keywords);
}

/**
 * Extract English keywords from text.
 *
 * @param text - Input text
 * @returns Array of lowercase English keyword tokens
 */
function extractEnglishKeywords(text: string): string[] {
  // Remove CJK characters first so they don't pollute English tokens
  const cleanedText = text.replace(CJK_SEGMENT_REGEX, ' ');

  const tokens = cleanedText
    .split(WORD_SPLIT_REGEX)
    .map(token => token.toLowerCase().trim())
    .filter(token =>
      token.length >= MIN_WORD_LENGTH &&
      !STOP_WORDS.has(token) &&
      // Filter out pure number tokens
      !/^\d+$/.test(token)
    );

  // Deduplicate while preserving order
  return Array.from(new Set(tokens));
}

/**
 * Extract CJK keywords from text.
 *
 * Extracts contiguous CJK segments. For segments longer than 2 characters,
 * generates 2-character bigrams as well (common Chinese keyword length).
 *
 * @param text - Input text
 * @returns Array of CJK keyword segments
 */
function extractCjkKeywords(text: string): string[] {
  if (!CJK_REGEX.test(text)) {
    return [];
  }

  const keywords = new Set<string>();

  // Find all contiguous CJK segments
  const segments = text.match(CJK_SEGMENT_REGEX);
  if (!segments) {
    return [];
  }

  for (const segment of segments) {
    // Add the full segment
    keywords.add(segment);

    // For longer segments, generate 2-char bigrams
    if (segment.length > 2) {
      for (let i = 0; i <= segment.length - 2; i++) {
        keywords.add(segment.substring(i, i + 2));
      }
    }
  }

  return Array.from(keywords);
}

/**
 * Check if a keyword matches any entry in a keyword list.
 * Supports case-insensitive matching for English and exact matching for CJK.
 *
 * @param keyword - The keyword to check
 * @param targetKeywords - The target keyword list from spec frontmatter
 * @returns true if keyword matches any target
 */
export function keywordMatches(keyword: string, targetKeywords: string[]): boolean {
  const lowerKeyword = keyword.toLowerCase();
  return targetKeywords.some(target => {
    const lowerTarget = target.toLowerCase();
    // Exact match (case insensitive)
    if (lowerKeyword === lowerTarget) return true;
    // Substring match: keyword appears within target or vice versa
    if (lowerTarget.includes(lowerKeyword) || lowerKeyword.includes(lowerTarget)) return true;
    return false;
  });
}

/**
 * Calculate match score between extracted keywords and spec keywords.
 * Higher score means better match.
 *
 * @param extractedKeywords - Keywords extracted from user prompt
 * @param specKeywords - Keywords from spec YAML frontmatter
 * @returns Number of matching keywords (0 = no match)
 */
export function calculateMatchScore(
  extractedKeywords: string[],
  specKeywords: string[]
): number {
  if (!extractedKeywords.length || !specKeywords.length) {
    return 0;
  }

  let score = 0;
  for (const keyword of extractedKeywords) {
    if (keywordMatches(keyword, specKeywords)) {
      score++;
    }
  }

  return score;
}
