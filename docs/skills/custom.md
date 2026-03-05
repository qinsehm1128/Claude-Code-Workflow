# Custom Skill Development

Guide to creating and deploying custom CCW skills.

## Skill Structure

```
~/.claude/skills/my-skill/
├── SKILL.md          # Skill definition (required)
├── index.ts          # Skill logic (optional)
├── examples/         # Usage examples
└── README.md         # Documentation
```

## Creating a Skill

### 1. Define Skill Metadata

Create `SKILL.md` with YAML frontmatter:

```markdown
---
name: my-skill
description: My custom skill for X
version: 1.0.0
author: Your Name <email@example.com>
tags: [custom, automation, frontend]
category: development
---

# My Custom Skill

## What It Does
Detailed description of the skill's purpose and capabilities.

## Usage

\`\`\`javascript
Skill(skill="my-skill", args="your input here")
\`\`\`

## Examples

### Example 1: Basic Usage
\`\`\`javascript
Skill(skill="my-skill", args="create user form")
\`\`\`

### Example 2: With Options
\`\`\`javascript
Skill(skill="my-skill", args={
  component: "UserForm",
  typescript: true,
  styling: "tailwind"
})
\`\`\`
```

### 2. Implement Skill Logic (Optional)

For complex skills, add `index.ts`:

```typescript
import type { SkillContext, SkillResult } from '@ccw/types'

interface MySkillOptions {
  component?: string
  typescript?: boolean
  styling?: 'css' | 'tailwind' | 'scss'
}

export async function execute(
  args: string | MySkillOptions,
  context: SkillContext
): Promise<SkillResult> {
  // Parse input
  const options = typeof args === 'string'
    ? { component: args }
    : args

  // Execute skill logic
  const result = await generateComponent(options)

  return {
    success: true,
    output: result,
    metadata: {
      skill: 'my-skill',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }
  }
}

async function generateComponent(options: MySkillOptions) {
  // Your implementation here
  return `// Generated code`
}
```

## Skill Categories

### Development

- Component generators
- API scaffolding
- Database schema creation

### Documentation

- API docs generation
- README creation
- Changelog generation

### DevOps

- CI/CD configuration
- Dockerfile generation
- Kubernetes manifests

### Testing

- Test generation
- Mock creation
- Coverage reports

## Skill Best Practices

### 1. Clear Purpose

```markdown
# Good: Clear and specific
name: generate-react-component
description: Generate React component with hooks and TypeScript

# Bad: Vague and generic
name: code-helper
description: Helps with coding
```

### 2. Type Safety

```typescript
// Define clear interfaces
interface Options {
  name: string
  typescript?: boolean
  styling?: 'css' | 'tailwind'
}

// Validate input
function validateOptions(options: any): Options {
  if (!options.name) {
    throw new Error('Component name is required')
  }
  return options as Options
}
```

### 3. Error Handling

```typescript
try {
  const result = await generateComponent(options)
  return { success: true, output: result }
} catch (error) {
  return {
    success: false,
    error: error.message,
    suggestion: 'Ensure component name is valid'
  }
}
```

### 4. Documentation

```markdown
## Usage

\`\`\`javascript
Skill(skill="my-skill", args="...")
\`\`\`

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| name | string | required | Component name |
| typescript | boolean | true | Use TypeScript |

## Examples

See `examples/` directory for more examples.
```

## Publishing Skills

### Private Skills

Skills in `~/.claude/skills/` are automatically available.

### Team Skills

Share skills via git:

```bash
# Create skill repository
mkdir my-ccw-skills
cd my-ccw-skills
git init

# Add skills
mkdir skills/skill-1
# ... add skill files

# Share with team
git remote add origin <repo-url>
git push -u origin main
```

Team members install:

```bash
git clone <repo-url> ~/.claude/skills/team-skills
```

### Public Skills

Publish to npm:

```json
{
  "name": "ccw-skills-my-skill",
  "version": "1.0.0",
  "ccw": {
    "skills": ["my-skill"]
  }
}
```

## Testing Skills

Create tests in `tests/`:

```typescript
import { describe, it, expect } from 'vitest'
import { execute } from '../index'

describe('my-skill', () => {
  it('should generate component', async () => {
    const result = await execute('UserForm', {})
    expect(result.success).toBe(true)
    expect(result.output).toContain('UserForm')
  })
})
```

## Debugging

Enable debug logging and invoke skill directly:

```bash
export CCW_DEBUG=1
Skill(skill="my-skill", args="test input")
```

> **Note**: The CLI command `ccw skill run` is deprecated. Use `Skill()` tool directly.

::: info See Also
- [Core Skills](./core-skills.md) - Built-in skill reference
- [Skills Library](./index.md) - All available skills
:::
