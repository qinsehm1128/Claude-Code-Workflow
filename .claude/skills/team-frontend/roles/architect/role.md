# Role: architect

前端架构师。消费 design-intelligence.json，定义设计令牌系统、组件架构、项目结构、技术选型。设计令牌值优先使用 ui-ux-pro-max 推荐值。

## Role Identity

- **Name**: `architect`
- **Task Prefix**: `ARCH-*`
- **Responsibility**: Code generation (architecture artifacts)
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[architect]`

## Role Boundaries

### MUST

- 仅处理 `ARCH-*` 前缀的任务
- 所有输出必须带 `[architect]` 标识
- 仅通过 SendMessage 与 coordinator 通信
- 严格在架构设计和令牌定义范围内工作

### MUST NOT

- ❌ 执行需求分析、代码实现、质量审查等其他角色职责
- ❌ 直接与其他 worker 角色通信
- ❌ 为其他角色创建任务
- ❌ 实现具体组件代码（仅定义规格）

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `arch_ready` | architect → coordinator | Architecture complete | 架构产出就绪，下游可消费 |
| `arch_revision` | architect → coordinator | Revision after QA feedback | 架构修订完成 |
| `arch_progress` | architect → coordinator | Partial progress | 架构进度更新 |
| `error` | architect → coordinator | Architecture failure | 架构设计失败 |

## Toolbox

### Available Tools

| Tool | Purpose |
|------|---------|
| Read, Write, Edit | 读写架构产物文件 |
| Glob, Grep | 搜索项目结构和模式 |
| Task (code-developer) | 复杂架构文件生成委派 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('ARCH-') &&
  t.owner === 'architect' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context Loading

```javascript
// Extract session folder
const sessionMatch = task.description.match(/Session:\s*([^\n]+)/)
const sessionFolder = sessionMatch ? sessionMatch[1].trim() : null

// Extract scope (tokens / components / full)
const scopeMatch = task.description.match(/Scope:\s*([^\n]+)/)
const scope = scopeMatch ? scopeMatch[1].trim() : 'full'

// Load design intelligence from analyst
let designIntel = {}
try {
  designIntel = JSON.parse(Read(`${sessionFolder}/analysis/design-intelligence.json`))
} catch {
  // No design intelligence available — use defaults
}

// Load shared memory
let sharedMemory = {}
try {
  sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
} catch {}

// Load existing project structure
const projectFiles = Glob({ pattern: 'src/**/*' })
const hasExistingProject = projectFiles.length > 0
```

### Phase 3: Architecture Design

#### Step 1: Design Token System (scope: tokens or full)

```javascript
if (scope === 'tokens' || scope === 'full') {
  const recommended = designIntel.design_system || {}

  const designTokens = {
    "$schema": "https://design-tokens.github.io/community-group/format/",
    "color": {
      "primary": {
        "$type": "color",
        "$value": {
          "light": recommended.colors?.primary || "#1976d2",
          "dark": recommended.colors?.primary_dark || "#90caf9"
        }
      },
      "secondary": {
        "$type": "color",
        "$value": {
          "light": recommended.colors?.secondary || "#dc004e",
          "dark": recommended.colors?.secondary_dark || "#f48fb1"
        }
      },
      "background": {
        "$type": "color",
        "$value": { "light": recommended.colors?.background || "#ffffff", "dark": "#121212" }
      },
      "surface": {
        "$type": "color",
        "$value": { "light": "#f5f5f5", "dark": "#1e1e1e" }
      },
      "text": {
        "$type": "color",
        "$value": { "light": "#1a1a1a", "dark": "#e0e0e0" }
      },
      "cta": {
        "$type": "color",
        "$value": recommended.colors?.cta || "#F97316"
      }
    },
    "typography": {
      "font-family": {
        "heading": {
          "$type": "fontFamily",
          "$value": recommended.typography?.heading || ["Inter", "system-ui", "sans-serif"]
        },
        "body": {
          "$type": "fontFamily",
          "$value": recommended.typography?.body || ["Inter", "system-ui", "sans-serif"]
        },
        "mono": {
          "$type": "fontFamily",
          "$value": ["JetBrains Mono", "Fira Code", "monospace"]
        }
      },
      "font-size": {
        "xs": { "$type": "dimension", "$value": "0.75rem" },
        "sm": { "$type": "dimension", "$value": "0.875rem" },
        "base": { "$type": "dimension", "$value": "1rem" },
        "lg": { "$type": "dimension", "$value": "1.125rem" },
        "xl": { "$type": "dimension", "$value": "1.25rem" },
        "2xl": { "$type": "dimension", "$value": "1.5rem" },
        "3xl": { "$type": "dimension", "$value": "2rem" }
      }
    },
    "spacing": {
      "xs": { "$type": "dimension", "$value": "0.25rem" },
      "sm": { "$type": "dimension", "$value": "0.5rem" },
      "md": { "$type": "dimension", "$value": "1rem" },
      "lg": { "$type": "dimension", "$value": "1.5rem" },
      "xl": { "$type": "dimension", "$value": "2rem" },
      "2xl": { "$type": "dimension", "$value": "3rem" }
    },
    "border-radius": {
      "sm": { "$type": "dimension", "$value": "0.25rem" },
      "md": { "$type": "dimension", "$value": "0.5rem" },
      "lg": { "$type": "dimension", "$value": "1rem" },
      "full": { "$type": "dimension", "$value": "9999px" }
    },
    "shadow": {
      "sm": { "$type": "shadow", "$value": "0 1px 2px rgba(0,0,0,0.05)" },
      "md": { "$type": "shadow", "$value": "0 4px 6px rgba(0,0,0,0.1)" },
      "lg": { "$type": "shadow", "$value": "0 10px 15px rgba(0,0,0,0.1)" }
    },
    "transition": {
      "fast": { "$type": "duration", "$value": "150ms" },
      "normal": { "$type": "duration", "$value": "200ms" },
      "slow": { "$type": "duration", "$value": "300ms" }
    }
  }

  Write(`${sessionFolder}/architecture/design-tokens.json`, JSON.stringify(designTokens, null, 2))
}
```

#### Step 2: Component Architecture (scope: components or full)

```javascript
if (scope === 'components' || scope === 'full') {
  const taskDesc = task.description.replace(/Session:.*\n?/g, '').replace(/Scope:.*\n?/g, '').trim()
  const antiPatterns = designIntel.recommendations?.anti_patterns || []
  const styleHints = designIntel.design_system?.css_keywords || ''

  // Analyze requirements and define component specs
  // Each component spec includes: props, variants, accessibility, implementation hints
  Bash(`mkdir -p "${sessionFolder}/architecture/component-specs"`)

  // Generate component spec template with design intelligence hints
  const componentSpecTemplate = `# Component: {name}

## Design Reference
- **Style**: ${designIntel.design_system?.style || 'modern-minimal'}
- **Stack**: ${designIntel.detected_stack || 'react'}

## Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|

## Variants
| Variant | Description |
|---------|-------------|

## Accessibility
- Role:
- Keyboard:
- ARIA:
- Contrast: 4.5:1 minimum

## Implementation Hints
${styleHints ? `- CSS Keywords: ${styleHints}` : ''}
${antiPatterns.length > 0 ? `\n## Anti-Patterns to AVOID\n${antiPatterns.map(p => '- ❌ ' + p).join('\n')}` : ''}
`

  // Write component specs based on task requirements
  // (Actual component list derived from task description analysis)
}
```

#### Step 3: Project Structure

```javascript
if (scope === 'full' || !hasExistingProject) {
  const stack = designIntel.detected_stack || 'react'

  const projectStructure = {
    stack: stack,
    structure: getStackStructure(stack),
    conventions: {
      naming: "kebab-case for files, PascalCase for components",
      imports: "absolute imports via @/ alias",
      styling: stack === 'html-tailwind' ? 'Tailwind CSS' : 'CSS Modules + design tokens',
      testing: "co-located test files (*.test.tsx)"
    }
  }

  Write(`${sessionFolder}/architecture/project-structure.md`, `# Project Structure

## Stack: ${stack}

## Directory Layout
\`\`\`
${projectStructure.structure}
\`\`\`

## Conventions
${Object.entries(projectStructure.conventions).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}
`)
}

function getStackStructure(stack) {
  const structures = {
    'react': `src/
├── components/     # Reusable UI components
│   ├── ui/         # Primitive components (Button, Input, etc.)
│   └── layout/     # Layout components (Header, Footer, etc.)
├── pages/          # Page-level components
├── hooks/          # Custom React hooks
├── styles/         # Global styles + design tokens
│   ├── tokens.css  # CSS custom properties from design tokens
│   └── global.css  # Global resets and base styles
├── utils/          # Utility functions
└── types/          # TypeScript type definitions`,
    'nextjs': `app/
├── (routes)/       # Route groups
├── components/     # Shared components
│   ├── ui/         # Primitive components
│   └── layout/     # Layout components
├── lib/            # Utility functions
├── styles/         # Global styles + design tokens
│   ├── tokens.css
│   └── globals.css
└── types/          # TypeScript types`,
    'vue': `src/
├── components/     # Vue components
│   ├── ui/         # Primitive components
│   └── layout/     # Layout components
├── views/          # Page views
├── composables/    # Vue composables
├── styles/         # Global styles + design tokens
└── types/          # TypeScript types`,
    'html-tailwind': `src/
├── components/     # HTML partials
├── pages/          # HTML pages
├── styles/         # Tailwind config + custom CSS
│   └── tailwind.config.js
└── assets/         # Static assets`
  }
  return structures[stack] || structures['react']
}
```

### Phase 4: Self-Validation

```javascript
// Validate architecture artifacts
const validationResults = { issues: [] }

// Check design tokens JSON validity
try {
  JSON.parse(Read(`${sessionFolder}/architecture/design-tokens.json`))
} catch (e) {
  validationResults.issues.push({ severity: 'critical', message: 'design-tokens.json is invalid JSON' })
}

// Check color contrast (basic)
// Check that all required token categories exist
const requiredCategories = ['color', 'typography', 'spacing']
const tokens = JSON.parse(Read(`${sessionFolder}/architecture/design-tokens.json`))
for (const cat of requiredCategories) {
  if (!tokens[cat]) {
    validationResults.issues.push({ severity: 'high', message: `Missing token category: ${cat}` })
  }
}

// Check anti-pattern compliance
const antiPatterns = designIntel.recommendations?.anti_patterns || []
// Verify token values don't violate industry anti-patterns

// Update shared memory with architecture output
sharedMemory.design_token_registry = tokens
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

const resultStatus = validationResults.issues.length === 0 ? 'complete' : 'complete_with_warnings'
const resultSummary = `Architecture artifacts generated for scope: ${scope}. ${validationResults.issues.length} issues found.`
const resultDetails = `Files:\n- ${sessionFolder}/architecture/design-tokens.json\n- ${sessionFolder}/architecture/project-structure.md\n- ${sessionFolder}/architecture/component-specs/`
```

### Phase 5: Report to Coordinator

```javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "architect",
  to: "coordinator",
  type: "arch_ready",
  summary: `[architect] ARCH complete: ${task.subject}`,
  ref: `${sessionFolder}/architecture/design-tokens.json`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [architect] Architecture Results

**Task**: ${task.subject}
**Status**: ${resultStatus}
**Scope**: ${scope}

### Summary
${resultSummary}

### Design Tokens
- Colors: ${Object.keys(tokens.color || {}).length} tokens
- Typography: ${Object.keys(tokens.typography || {}).length} categories
- Spacing: ${Object.keys(tokens.spacing || {}).length} scales
- Source: ${designIntel._source || 'defaults'}

### Output Files
${resultDetails}

${validationResults.issues.length > 0 ? `### Warnings\n${validationResults.issues.map(i => `- [${i.severity}] ${i.message}`).join('\n')}` : ''}`,
  summary: `[architect] ARCH complete`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('ARCH-') &&
  t.owner === 'architect' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task → back to Phase 1
}
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No ARCH-* tasks available | Idle, wait for coordinator |
| design-intelligence.json not found | Use default token values, log warning |
| Session folder not found | Notify coordinator, request location |
| Token validation fails | Report issues, continue with warnings |
| Sub-agent failure | Retry once, fallback to direct execution |
| Critical issue beyond scope | SendMessage error to coordinator |
