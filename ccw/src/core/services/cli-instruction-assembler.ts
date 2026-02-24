// ========================================
// CLI Instruction Assembler
// ========================================
// Assembles the final sendText string based on CLI type and instruction type.

export type InstructionType = 'prompt' | 'skill' | 'command';

/**
 * Assemble the text to send to a CLI interactive session.
 *
 * - prompt  → raw content text
 * - skill   → CLI-specific skill prefix (claude: /, codex: $, others: fallback to prompt)
 * - command → raw content text (CLI native command)
 */
export function assembleInstruction(
  cliTool: string,
  instructionType: InstructionType,
  content: string,
  skillName?: string,
): string {
  if (instructionType === 'prompt' || instructionType === 'command') {
    return content;
  }

  // instructionType === 'skill'
  const name = skillName ?? '';

  switch (cliTool) {
    case 'claude':
      return `/${name} ${content}`;
    case 'codex':
      return `$${name} ${content}`;
    default:
      // Other CLIs don't support skill syntax — fallback to plain prompt
      return content;
  }
}
