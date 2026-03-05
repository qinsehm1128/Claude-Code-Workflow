/**
 * CLI Documentation Generator
 * Parses ccw/src/tools/command-registry.ts and generates Markdown docs
 */

import fs from 'fs'
import path from 'path'

interface Command {
  name: string
  description: string
  options: CommandOption[]
  examples: string[]
}

interface CommandOption {
  name: string
  description: string
  type: string
  required: boolean
  default?: string
}

function parseCommandRegistry(): Command[] {
  // This would parse the actual ccw command registry
  // For now, return mock data
  return [
    {
      name: 'cli',
      description: 'Execute AI-powered CLI operations',
      options: [
        {
          name: '-p, --prompt',
          description: 'Prompt text for the AI',
          type: 'string',
          required: true
        },
        {
          name: '--tool',
          description: 'AI tool to use (gemini, codex, qwen, claude)',
          type: 'string',
          required: false,
          default: 'first enabled'
        },
        {
          name: '--mode',
          description: 'Execution mode (analysis, write, review)',
          type: 'string',
          required: true
        }
      ],
      examples: [
        'ccw cli -p "Analyze codebase" --mode analysis',
        'ccw cli -p "Add auth" --mode write --tool codex'
      ]
    },
    {
      name: 'skill',
      description: 'Manage and execute skills',
      options: [
        {
          name: 'list',
          description: 'List all available skills',
          type: 'boolean',
          required: false
        },
        {
          name: 'run',
          description: 'Run a specific skill',
          type: 'string',
          required: false
        }
      ],
      examples: [
        'ccw skill list',
        'ccw skill run commit'
      ]
    }
  ]
}

function generateCommandMarkdown(command: Command): string {
  let md = `## ${command.name}\n\n`
  md += `${command.description}\n\n`

  if (command.options.length > 0) {
    md += `### Options\n\n`
    md += `| Option | Type | Required | Default | Description |\n`
    md += `|--------|------|----------|---------|-------------|\n`

    for (const option of command.options) {
      const required = option.required ? 'Yes' : 'No'
      const defaultVal = option.default ?? '-'
      md += `| \`${option.name}\` | ${option.type} | ${required} | ${defaultVal} | ${option.description} |\n`
    }
    md += `\n`
  }

  if (command.examples.length > 0) {
    md += `### Examples\n\n`
    for (const example of command.examples) {
      md += `\`\`\`bash\n${example}\n\`\`\`\n\n`
    }
  }

  return md
}

function generateDocs() {
  const commands = parseCommandRegistry()
  const outputPath = path.join(process.cwd(), 'cli/commands.generated.md')

  let markdown = `# CLI Commands Reference\n\n`
  markdown += `Complete reference for all CCW CLI commands.\n\n`

  for (const command of commands) {
    markdown += generateCommandMarkdown(command)
    markdown += `---\n\n`
  }

  fs.writeFileSync(outputPath, markdown, 'utf-8')
  console.log(`✅ Generated CLI documentation: ${outputPath}`)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateDocs()
}

export { generateDocs, parseCommandRegistry, generateCommandMarkdown }
