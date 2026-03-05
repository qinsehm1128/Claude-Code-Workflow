# Custom Agents

Guide to creating and configuring custom CCW agents.

## Agent Structure

```
~/.claude/agents/my-agent/
├── AGENT.md          # Agent definition
├── index.ts          # Agent logic
├── tools/            # Agent-specific tools
└── examples/         # Usage examples
```

## Creating an Agent

### 1. Define Agent

Create `AGENT.md`:

```markdown
---
name: my-agent
type: development
version: 1.0.0
capabilities: [react, typescript, testing]
---

# My Custom Agent

Specialized agent for React component development with TypeScript.

## Capabilities

- Generate React components with hooks
- TypeScript type definitions
- Vitest testing setup
- Tailwind CSS styling

## Usage

\`\`\`javascript
Task({
  subagent_type: "my-agent",
  prompt: "Create a user profile component"
})
\`\`\`
```

### 2. Implement Agent Logic

Create `index.ts`:

```typescript
import type { AgentContext, AgentResult } from '@ccw/types'

export async function execute(
  prompt: string,
  context: AgentContext
): Promise<AgentResult> {
  // Analyze request
  const intent = analyzeIntent(prompt)

  // Execute based on intent
  switch (intent.type) {
    case 'generate-component':
      return await generateComponent(intent.options)
    case 'add-tests':
      return await addTests(intent.options)
    default:
      return await handleGeneral(prompt)
  }
}

function analyzeIntent(prompt: string) {
  // Parse user intent from prompt
  // Return structured intent object
}
```

## Agent Capabilities

### Code Generation

```typescript
async function generateComponent(options: ComponentOptions) {
  return {
    files: [
      {
        path: 'src/components/UserProfile.tsx',
        content: generateReactComponent(options)
      },
      {
        path: 'src/components/UserProfile.test.tsx',
        content: generateTests(options)
      }
    ]
  }
}
```

### Analysis

```typescript
async function analyzeCodebase(context: AgentContext) {
  const files = await context.filesystem.read('src/**/*.ts')
  const patterns = identifyPatterns(files)
  return {
    patterns,
    recommendations: generateRecommendations(patterns)
  }
}
```

### Testing

```typescript
async function generateTests(options: TestOptions) {
  return {
    framework: 'vitest',
    files: [
      {
        path: `${options.file}.test.ts`,
        content: generateTestCode(options)
      }
    ]
  }
}
```

## Agent Tools

Agents can define custom tools:

```typescript
export const tools = {
  'my-tool': {
    description: 'My custom tool',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string' }
      }
    },
    execute: async (params) => {
      // Tool implementation
    }
  }
}
```

## Agent Communication

Agents communicate via message bus:

```typescript
// Send message to another agent
await context.messaging.send({
  to: 'tester',
  type: 'task-complete',
  data: { files: generatedFiles }
})

// Receive messages
context.messaging.on('task-complete', async (message) => {
  if (message.from === 'executor') {
    await startTesting(message.data.files)
  }
})
```

## Agent Configuration

Configure agents in `~/.claude/agents/config.json`:

```json
{
  "my-agent": {
    "enabled": true,
    "priority": 10,
    "capabilities": {
      "frameworks": ["react", "vue"],
      "languages": ["typescript", "javascript"],
      "tools": ["vitest", "playwright"]
    },
    "limits": {
      "maxFiles": 100,
      "maxSize": "10MB"
    }
  }
}
```

## Agent Best Practices

### 1. Clear Purpose

Define specific, focused capabilities:

```markdown
# Good: Focused
name: react-component-agent
purpose: Generate React components with TypeScript

# Bad: Too broad
name: fullstack-agent
purpose: Handle everything
```

### 2. Tool Selection

Use appropriate tools for tasks:

```typescript
// File operations
context.filesystem.read(path)
context.filesystem.write(path, content)

// Code analysis
context.codebase.search(query)
context.codebase.analyze(pattern)

// Communication
context.messaging.send(to, type, data)
```

### 3. Error Handling

```typescript
try {
  const result = await executeTask(prompt)
  return { success: true, result }
} catch (error) {
  return {
    success: false,
    error: error.message,
    recovery: suggestRecovery(error)
  }
}
```

## Testing Agents

```typescript
import { describe, it, expect } from 'vitest'
import { execute } from '../index'

describe('my-agent', () => {
  it('should generate component', async () => {
    const result = await execute(
      'Create a UserCard component',
      mockContext
    )
    expect(result.success).toBe(true)
    expect(result.files).toHaveLength(2) // component + test
  })
})
```

::: info See Also
- [Built-in Agents](./builtin.md) - Pre-configured agents
- [Agents Overview](./index.md) - Agent system introduction
:::
