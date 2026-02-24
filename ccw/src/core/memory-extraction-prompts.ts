/**
 * Memory Extraction Prompts - LLM prompt templates for Phase 1 extraction
 *
 * Provides system and user prompt templates for extracting structured memory
 * from CLI session transcripts. The LLM output must conform to a JSON schema
 * with raw_memory, rollout_summary, and tags fields.
 *
 * Design spec section 4.4: Prompt structure with outcome triage rules.
 */

/**
 * System prompt for the extraction LLM call.
 *
 * Instructs the model to:
 * - Produce a JSON object with raw_memory, rollout_summary, and tags
 * - Follow structure markers in raw_memory (# summary, Memory context, etc.)
 * - Apply outcome triage rules for categorizing task results
 * - Keep rollout_summary concise (1-2 sentences)
 * - Generate 3-8 lowercase tags capturing topic, action, and technology
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction agent. Your job is to read a CLI session transcript and produce structured memory output.

You MUST respond with a valid JSON object containing exactly three fields:

{
  "raw_memory": "<structured memory text>",
  "rollout_summary": "<1-2 sentence summary>",
  "tags": ["<tag1>", "<tag2>", ...]
}

## tags format

An array of 3-8 short lowercase tags (1-3 words each) capturing:
- Main topic or domain (e.g., "authentication", "database migration")
- Action type (e.g., "bug fix", "refactoring", "new feature")
- Key technology (e.g., "react", "typescript", "sqlite")

## raw_memory format

The raw_memory field must follow this structure:

# summary
<One paragraph high-level summary of what was accomplished in this session>

Memory context:
- Project: <project name or path if identifiable>
- Tools used: <CLI tools, frameworks, languages mentioned>
- Key files: <important files created or modified>

User preferences:
- <Any coding style preferences, conventions, or patterns the user demonstrated>
- <Tool preferences, workflow habits>

## Task: <task title or description>
Outcome: <success | partial | failed | abandoned>
<Detailed description of what was done, decisions made, and results>

### Key decisions
- <Important architectural or design decisions>
- <Trade-offs considered>

### Lessons learned
- <What worked well>
- <What did not work and why>
- <Gotchas or pitfalls discovered>

## Outcome Triage Rules

- **success**: Task was completed as intended, tests pass, code works
- **partial**: Some progress made but not fully complete; note what remains
- **failed**: Attempted but could not achieve the goal; document root cause
- **abandoned**: User switched direction or cancelled; note the reason

## rollout_summary format

A concise 1-2 sentence summary capturing:
- What the session was about (the goal)
- The outcome (success/partial/failed)
- The most important takeaway

Do NOT include markdown code fences in your response. Return raw JSON only.`;

/**
 * Build the user prompt by injecting the session transcript.
 *
 * @param sessionId - The session/conversation ID for reference
 * @param transcript - The filtered and truncated transcript text
 * @returns The complete user prompt string
 */
export function buildExtractionUserPrompt(sessionId: string, transcript: string): string {
  return `Extract structured memory from the following CLI session transcript.

Session ID: ${sessionId}

--- BEGIN TRANSCRIPT ---
${transcript}
--- END TRANSCRIPT ---

Respond with a JSON object containing "raw_memory", "rollout_summary", and "tags" fields.`;
}
