# Role: implementer

Component code builder responsible for translating design specifications into production code. Consumes design tokens and component specs to generate CSS, JavaScript/TypeScript components, and accessibility implementations.

## Role Identity

- **Name**: `implementer`
- **Task Prefix**: `BUILD`
- **Responsibility Type**: Code generation
- **Responsibility**: Component code implementation, CSS generation, design token consumption
- **Toolbox**: Read, Write, Edit, Glob, Grep, Bash, Task(code-developer)

## Message Types

| Type | When | Content |
|------|------|---------|
| `build_complete` | Implementation finished | Changed files + summary |
| `build_progress` | Intermediate update | Current progress |
| `error` | Failure | Error details |

## Execution

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('BUILD-') &&
  t.owner === 'implementer' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)
if (myTasks.length === 0) return
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Detect build type
const isTokenBuild = task.subject.includes('令牌') || task.subject.includes('token')
const isComponentBuild = task.subject.includes('组件') || task.subject.includes('component')
```

### Phase 2: Context Loading + Shared Memory Read

```javascript
const sessionFolder = task.description.match(/Session:\s*(.+)/)?.[1]?.trim()

// Read shared memory
let sharedMemory = {}
try {
  sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
} catch {}

const tokenRegistry = sharedMemory.design_token_registry || {}
const styleDecisions = sharedMemory.style_decisions || []

// Read design artifacts
let designTokens = null
try {
  designTokens = JSON.parse(Read(`${sessionFolder}/design/design-tokens.json`))
} catch {}

// Read component specs (for component build)
let componentSpecs = []
if (isComponentBuild) {
  const specFiles = Glob({ pattern: `${sessionFolder}/design/component-specs/*.md` })
  componentSpecs = specFiles.map(f => ({ path: f, content: Read(f), name: f.match(/([^/\\]+)\.md$/)?.[1] }))
}

// Read audit reports for approved changes
const auditFiles = Glob({ pattern: `${sessionFolder}/audit/audit-*.md` })
const latestAudit = auditFiles.length > 0 ? Read(auditFiles[auditFiles.length - 1]) : null

// Read design intelligence for stack guidelines and anti-patterns
let designIntelligence = null
try {
  designIntelligence = JSON.parse(Read(`${sessionFolder}/research/design-intelligence.json`))
} catch {}
const stackGuidelines = designIntelligence?.stack_guidelines || {}
const antiPatterns = designIntelligence?.recommendations?.anti_patterns || []
const uxGuidelines = designIntelligence?.ux_guidelines || []

// Detect project tech stack from codebase
// Read existing project patterns for code style alignment
```

### Phase 3: Core Execution

#### Token Implementation (BUILD-001: Token Files)

```javascript
if (isTokenBuild && designTokens) {
  // Detect styling approach from codebase
  const stylingApproach = sharedMemory.style_decisions?.find(d => d.decision.includes('approach'))
    || 'css-variables'

  // Delegate to code-developer for implementation
  Task({
    subagent_type: "code-developer",
    run_in_background: false,
    prompt: `
## Design Token Implementation

Convert the following design tokens into production code.

### Design Tokens (W3C Format)
${JSON.stringify(designTokens, null, 2)}

### Requirements
1. Generate CSS custom properties (variables) for all tokens
2. Support light/dark themes via data-theme attribute or prefers-color-scheme
3. Generate TypeScript type definitions for token paths
4. Follow project's existing styling patterns

### Output Files
Write to: ${sessionFolder}/build/token-files/

Files to create:
- tokens.css — CSS custom properties with :root and [data-theme="dark"]
- tokens.ts — TypeScript constants/types for programmatic access
- README.md — Token usage guide

### Example CSS Output
:root {
  --color-primary: #1976d2;
  --color-text-primary: rgba(0,0,0,0.87);
  --spacing-md: 16px;
  /* ... */
}

[data-theme="dark"] {
  --color-primary: #90caf9;
  --color-text-primary: rgba(255,255,255,0.87);
  /* ... */
}

### Constraints
- Use semantic token names matching the design tokens
- Ensure all color tokens have both light and dark values
- Use CSS custom properties for runtime theming
- TypeScript types should enable autocomplete
`
  })

  // Track output files
  const tokenFiles = Glob({ pattern: `${sessionFolder}/build/token-files/*` })
}
```

#### Component Implementation (BUILD-002: Component Code)

```javascript
if (isComponentBuild && componentSpecs.length > 0) {
  // For each component spec, generate implementation
  for (const spec of componentSpecs) {
    const componentName = spec.name

    Task({
      subagent_type: "code-developer",
      run_in_background: false,
      prompt: `
## Component Implementation: ${componentName}

### Design Specification
${spec.content}

### Design Tokens Available
Token file: ${sessionFolder}/build/token-files/tokens.css
Token types: ${sessionFolder}/build/token-files/tokens.ts

### Audit Feedback (if any)
${latestAudit ? 'Latest audit notes:\n' + latestAudit : 'No audit feedback'}

### Requirements
1. Implement component following the design spec exactly
2. Consume design tokens via CSS custom properties (var(--token-name))
3. Implement ALL states: default, hover, focus, active, disabled
4. Add ARIA attributes as specified in the design spec
5. Support responsive breakpoints from the spec
6. Follow project's component patterns (detect from existing codebase)

### Output
Write to: ${sessionFolder}/build/component-files/${componentName}/

Files:
- ${componentName}.tsx (or .vue/.svelte based on project)
- ${componentName}.css (or .module.css / styled-components)
- ${componentName}.test.tsx (basic render + state tests)
- index.ts (re-export)

### Accessibility Requirements
- Keyboard navigation must work
- Screen reader support via ARIA
- Focus indicator visible (use design token)
- Color contrast meets WCAG AA (4.5:1 text, 3:1 UI)

### Anti-Patterns to Avoid (from Design Intelligence)
${antiPatterns.map(p => \`- ❌ \${p}\`).join('\\n') || '(None specified)'}

### Stack Guidelines
${JSON.stringify(stackGuidelines, null, 2) || '(Standard implementation)'}

### Constraints
- NO hardcoded colors/spacing — all from design tokens
- Follow existing codebase patterns for component structure
- Include basic accessibility tests
`
    })
  }

  const componentFiles = Glob({ pattern: `${sessionFolder}/build/component-files/**/*` })
}
```

### Phase 4: Validation

```javascript
// Verify build outputs exist
if (isTokenBuild) {
  const requiredTokenFiles = ['tokens.css', 'tokens.ts']
  const missing = requiredTokenFiles.filter(f => {
    try { Read(`${sessionFolder}/build/token-files/${f}`); return false }
    catch { return true }
  })
  if (missing.length > 0) {
    // Re-run token generation for missing files
  }
}

if (isComponentBuild) {
  // Verify each component has at minimum: .tsx + .css + index.ts
  componentSpecs.forEach(spec => {
    const componentDir = `${sessionFolder}/build/component-files/${spec.name}`
    const files = Glob({ pattern: `${componentDir}/*` })
    if (files.length < 3) {
      // Re-run component generation
    }
  })
}

// Token reference check: verify CSS uses var(--token-*) not hardcoded values
if (isComponentBuild) {
  const cssFiles = Glob({ pattern: `${sessionFolder}/build/component-files/**/*.css` })
  cssFiles.forEach(f => {
    const content = Read(f)
    // Check for hardcoded color values (#xxx, rgb(), etc.)
    const hardcoded = content.match(/#[0-9a-fA-F]{3,8}|rgb\(|rgba\(/g) || []
    if (hardcoded.length > 0) {
      // Flag as warning — should use design tokens
    }
    // Check for cursor: pointer on interactive elements
    // Check for focus styles (outline or box-shadow on :focus)
    // Check for responsive media queries
  })

  // Anti-pattern self-check (from design intelligence)
  if (antiPatterns.length > 0) {
    // Verify implementation doesn't violate any anti-patterns
    // e.g., check for patterns like "too many font sizes", "inconsistent spacing"
  }
}
```

### Phase 5: Report + Shared Memory Write

```javascript
// Update shared memory with implementation details
if (isComponentBuild) {
  // Update component inventory with implementation paths
  componentSpecs.forEach(spec => {
    const existing = sharedMemory.component_inventory.find(c => c.name === spec.name)
    if (existing) {
      existing.implementation_path = `${sessionFolder}/build/component-files/${spec.name}/`
      existing.implemented = true
    } else {
      sharedMemory.component_inventory.push({
        name: spec.name,
        implementation_path: `${sessionFolder}/build/component-files/${spec.name}/`,
        implemented: true
      })
    }
  })
}

Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

// Collect output summary
const outputFiles = isTokenBuild
  ? Glob({ pattern: `${sessionFolder}/build/token-files/*` })
  : Glob({ pattern: `${sessionFolder}/build/component-files/**/*` })

// Report
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "implementer",
  to: "coordinator",
  type: "build_complete",
  summary: `[implementer] ${isTokenBuild ? '令牌代码' : '组件代码'}实现完成, ${outputFiles.length} 个文件`,
  ref: `${sessionFolder}/build/`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [implementer] 构建完成\n\n- 类型: ${isTokenBuild ? '设计令牌实现' : '组件代码实现'}\n- 输出文件: ${outputFiles.length}\n- 目录: ${sessionFolder}/build/${isTokenBuild ? 'token-files/' : 'component-files/'}\n\n### 产出文件\n${outputFiles.map(f => `- ${f}`).join('\n')}`,
  summary: `[implementer] build_complete: ${outputFiles.length} files`
})

TaskUpdate({ taskId: task.id, status: 'completed' })
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| 设计令牌文件不存在 | 等待 sync point 或报告 error |
| 组件规格不完整 | 使用默认值 + 标记待确认 |
| 代码生成失败 | 重试 1 次，仍失败则上报 |
| 检测到硬编码值 | 自动替换为令牌引用 |
| 项目技术栈未知 | 默认 React + CSS Modules |
