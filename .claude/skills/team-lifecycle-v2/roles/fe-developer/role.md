# Role: fe-developer

前端开发。消费计划/架构产出，实现前端组件、页面、样式代码。

## Role Identity

- **Name**: `fe-developer`
- **Task Prefix**: `DEV-FE-*`
- **Output Tag**: `[fe-developer]`
- **Role Type**: Pipeline（前端子流水线 worker）
- **Responsibility**: Context loading → Design token consumption → Component implementation → Report

## Role Boundaries

### MUST
- 仅处理 `DEV-FE-*` 前缀的任务
- 所有输出带 `[fe-developer]` 标识
- 仅通过 SendMessage 与 coordinator 通信
- 遵循已有设计令牌和组件规范（如存在）
- 生成可访问性合规的前端代码（语义 HTML、ARIA 属性、键盘导航）
- 遵循项目已有的前端技术栈和约定

### MUST NOT
- ❌ 修改后端代码或 API 接口
- ❌ 直接与其他 worker 通信
- ❌ 为其他角色创建任务
- ❌ 跳过设计令牌/规范检查（如存在）
- ❌ 引入未经架构审查的新前端依赖

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `dev_fe_complete` | fe-developer → coordinator | Implementation done | 前端实现完成 |
| `dev_fe_progress` | fe-developer → coordinator | Long task progress | 进度更新 |
| `error` | fe-developer → coordinator | Implementation failure | 实现失败 |

## Message Bus

每次 SendMessage **前**，必须调用 `mcp__ccw-tools__team_msg` 记录：

```javascript
mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "fe-developer", to: "coordinator",
  type: "dev_fe_complete",
  summary: "[fe-developer] DEV-FE complete: 3 components, 1 page",
  ref: outputPath
})
```

### CLI 回退

```javascript
Bash(`ccw team log --team "${teamName}" --from "fe-developer" --to "coordinator" --type "dev_fe_complete" --summary "[fe-developer] DEV-FE complete" --ref "${outputPath}" --json`)
```

## Toolbox

### Available Commands
- None (inline execution — implementation delegated to subagent)

### Subagent Capabilities

| Agent Type | Purpose |
|------------|---------|
| `code-developer` | 组件/页面代码实现 |

### CLI Capabilities

| CLI Tool | Mode | Purpose |
|----------|------|---------|
| `ccw cli --tool gemini --mode write` | write | 前端代码生成 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('DEV-FE-') &&
  t.owner === 'fe-developer' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)
if (myTasks.length === 0) return
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context Loading

```javascript
const sessionFolder = task.description.match(/Session:\s*([^\n]+)/)?.[1]?.trim()

// Load plan context
let plan = null
try { plan = JSON.parse(Read(`${sessionFolder}/plan/plan.json`)) } catch {}

// Load design tokens (if architect produced them)
let designTokens = null
try { designTokens = JSON.parse(Read(`${sessionFolder}/architecture/design-tokens.json`)) } catch {}

// Load design intelligence (from analyst via ui-ux-pro-max)
let designIntel = {}
try { designIntel = JSON.parse(Read(`${sessionFolder}/analysis/design-intelligence.json`)) } catch {}

// Load component specs (if available)
let componentSpecs = []
try {
  const specFiles = Glob({ pattern: `${sessionFolder}/architecture/component-specs/*.md` })
  componentSpecs = specFiles.map(f => ({ path: f, content: Read(f) }))
} catch {}

// Load shared memory (cross-role state)
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`)) } catch {}

// Load wisdom
let wisdom = {}
if (sessionFolder) {
  try { wisdom.conventions = Read(`${sessionFolder}/wisdom/conventions.md`) } catch {}
  try { wisdom.decisions = Read(`${sessionFolder}/wisdom/decisions.md`) } catch {}
}

// Extract design constraints from design intelligence
const antiPatterns = designIntel.recommendations?.anti_patterns || []
const implementationChecklist = designIntel.design_system?.implementation_checklist || []
const stackGuidelines = designIntel.stack_guidelines || {}

// Detect frontend tech stack
let techStack = {}
try { techStack = JSON.parse(Read('.workflow/project-tech.json')) } catch {}
const feTech = detectFrontendStack(techStack)
// Override with design intelligence detection if available
if (designIntel.detected_stack) {
  const diStack = designIntel.detected_stack
  if (['react', 'nextjs', 'vue', 'svelte', 'nuxt'].includes(diStack)) feTech.framework = diStack
}

function detectFrontendStack(tech) {
  const deps = tech?.dependencies || {}
  const stack = { framework: 'html', styling: 'css', ui_lib: null }
  if (deps.react || deps['react-dom']) stack.framework = 'react'
  if (deps.vue) stack.framework = 'vue'
  if (deps.svelte) stack.framework = 'svelte'
  if (deps.next) stack.framework = 'nextjs'
  if (deps.nuxt) stack.framework = 'nuxt'
  if (deps.tailwindcss) stack.styling = 'tailwind'
  if (deps['@shadcn/ui'] || deps['shadcn-ui']) stack.ui_lib = 'shadcn'
  if (deps['@mui/material']) stack.ui_lib = 'mui'
  if (deps['antd']) stack.ui_lib = 'antd'
  return stack
}
```

### Phase 3: Frontend Implementation

#### Step 1: Generate Design Token CSS (if tokens available)

```javascript
if (designTokens && task.description.includes('Scope: tokens') || task.description.includes('Scope: full')) {
  // Convert design-tokens.json to CSS custom properties
  let cssVars = ':root {\n'

  // Colors
  if (designTokens.color) {
    for (const [name, token] of Object.entries(designTokens.color)) {
      const value = typeof token.$value === 'object' ? token.$value.light : token.$value
      cssVars += `  --color-${name}: ${value};\n`
    }
  }

  // Typography
  if (designTokens.typography?.['font-family']) {
    for (const [name, token] of Object.entries(designTokens.typography['font-family'])) {
      const value = Array.isArray(token.$value) ? token.$value.join(', ') : token.$value
      cssVars += `  --font-${name}: ${value};\n`
    }
  }
  if (designTokens.typography?.['font-size']) {
    for (const [name, token] of Object.entries(designTokens.typography['font-size'])) {
      cssVars += `  --text-${name}: ${token.$value};\n`
    }
  }

  // Spacing, border-radius, shadow, transition
  for (const category of ['spacing', 'border-radius', 'shadow', 'transition']) {
    const prefix = { spacing: 'space', 'border-radius': 'radius', shadow: 'shadow', transition: 'duration' }[category]
    if (designTokens[category]) {
      for (const [name, token] of Object.entries(designTokens[category])) {
        cssVars += `  --${prefix}-${name}: ${token.$value};\n`
      }
    }
  }

  cssVars += '}\n'

  // Dark mode overrides
  if (designTokens.color) {
    const darkOverrides = Object.entries(designTokens.color)
      .filter(([, token]) => typeof token.$value === 'object' && token.$value.dark)
    if (darkOverrides.length > 0) {
      cssVars += '\n@media (prefers-color-scheme: dark) {\n  :root {\n'
      for (const [name, token] of darkOverrides) {
        cssVars += `    --color-${name}: ${token.$value.dark};\n`
      }
      cssVars += '  }\n}\n'
    }
  }

  Bash(`mkdir -p src/styles`)
  Write('src/styles/tokens.css', cssVars)
}
```

#### Step 2: Implement Components

```javascript
const taskId = task.subject.match(/DEV-FE-(\d+)/)?.[0]
const taskDetail = plan?.task_ids?.includes(taskId)
  ? JSON.parse(Read(`${sessionFolder}/plan/.task/${taskId}.json`))
  : { title: task.subject, description: task.description, files: [] }

const isSimple = (taskDetail.files || []).length <= 3 &&
  !task.description.includes('system') &&
  !task.description.includes('多组件')

if (isSimple) {
  Task({
    subagent_type: "code-developer",
    run_in_background: false,
    description: `Frontend implementation: ${taskDetail.title}`,
    prompt: `## Frontend Implementation

Task: ${taskDetail.title}
Description: ${taskDetail.description}

${designTokens ? `## Design Tokens\nImport from: src/styles/tokens.css\nUse CSS custom properties (var(--color-primary), var(--space-md), etc.)\n${JSON.stringify(designTokens, null, 2).substring(0, 1000)}` : ''}
${componentSpecs.length > 0 ? `## Component Specs\n${componentSpecs.map(s => s.content.substring(0, 500)).join('\n---\n')}` : ''}

## Tech Stack
- Framework: ${feTech.framework}
- Styling: ${feTech.styling}
${feTech.ui_lib ? `- UI Library: ${feTech.ui_lib}` : ''}

## Stack-Specific Guidelines
${JSON.stringify(stackGuidelines, null, 2).substring(0, 500)}

## Implementation Checklist (MUST verify each item)
${implementationChecklist.map(item => `- [ ] ${item}`).join('\n') || '- [ ] Semantic HTML\n- [ ] Keyboard accessible\n- [ ] Responsive layout\n- [ ] Dark mode support'}

## Anti-Patterns to AVOID
${antiPatterns.map(p => `- ❌ ${p}`).join('\n') || 'None specified'}

## Coding Standards
- Use design token CSS variables, never hardcode colors/spacing
- All interactive elements must have cursor: pointer
- Transitions: 150-300ms (use var(--duration-normal))
- Text contrast: minimum 4.5:1 ratio
- Include focus-visible styles for keyboard navigation
- Support prefers-reduced-motion
- Responsive: mobile-first with md/lg breakpoints
- No emoji as functional icons

## Files to modify/create
${(taskDetail.files || []).map(f => `- ${f.path}: ${f.change}`).join('\n') || 'Determine from task description'}

## Conventions
${wisdom.conventions || 'Follow project existing patterns'}`
  })
} else {
  Bash({
    command: `ccw cli -p "PURPOSE: Implement frontend components for '${taskDetail.title}'
TASK: ${taskDetail.description}
MODE: write
CONTEXT: @src/**/*.{tsx,jsx,vue,svelte,css,scss,html} @public/**/*
EXPECTED: Production-ready frontend code with accessibility, responsive design, design token usage
CONSTRAINTS: Framework=${feTech.framework}, Styling=${feTech.styling}${feTech.ui_lib ? ', UI=' + feTech.ui_lib : ''}
ANTI-PATTERNS: ${antiPatterns.join(', ') || 'None'}
CHECKLIST: ${implementationChecklist.join(', ') || 'Semantic HTML, keyboard accessible, responsive, dark mode'}" --tool gemini --mode write --rule development-implement-component-ui`,
    run_in_background: true
  })
}
```

### Phase 4: Self-Validation + Wisdom + Shared Memory

```javascript
// === Self-Validation (pre-QA check) ===
const implementedFiles = Glob({ pattern: 'src/**/*.{tsx,jsx,vue,svelte,html,css}' })
const selfCheck = { passed: [], failed: [] }

for (const file of implementedFiles.slice(0, 20)) {
  try {
    const content = Read(file)

    // Check: no hardcoded colors (hex outside tokens.css)
    if (file !== 'src/styles/tokens.css' && /#[0-9a-fA-F]{3,8}/.test(content)) {
      selfCheck.failed.push({ file, check: 'hardcoded-color', message: 'Hardcoded color — use var(--color-*)' })
    }

    // Check: cursor-pointer on interactive elements
    if (/button|<a |onClick|@click/.test(content) && !/cursor-pointer/.test(content)) {
      selfCheck.failed.push({ file, check: 'cursor-pointer', message: 'Missing cursor-pointer on interactive element' })
    }

    // Check: focus styles
    if (/button|input|select|textarea|<a /.test(content) && !/focus/.test(content)) {
      selfCheck.failed.push({ file, check: 'focus-styles', message: 'Missing focus styles for keyboard navigation' })
    }

    // Check: responsive breakpoints
    if (/className|class=/.test(content) && !/md:|lg:|@media/.test(content) && /\.(tsx|jsx|vue|html)$/.test(file)) {
      selfCheck.failed.push({ file, check: 'responsive', message: 'No responsive breakpoints found' })
    }

    // Check: prefers-reduced-motion for animations
    if (/animation|@keyframes/.test(content) && !/prefers-reduced-motion/.test(content)) {
      selfCheck.failed.push({ file, check: 'reduced-motion', message: 'Animation without prefers-reduced-motion' })
    }

    // Check: emoji as icons
    if (/[\u{1F300}-\u{1F9FF}]/u.test(content)) {
      selfCheck.failed.push({ file, check: 'emoji-icon', message: 'Emoji used as icon — use SVG/icon library' })
    }
  } catch {}
}

// === Wisdom Contribution ===
if (sessionFolder) {
  const timestamp = new Date().toISOString().substring(0, 10)
  try {
    const conventionsPath = `${sessionFolder}/wisdom/conventions.md`
    const existing = Read(conventionsPath)
    const entry = `- [${timestamp}] [fe-developer] Frontend: ${feTech.framework}/${feTech.styling}, component pattern used`
    Write(conventionsPath, existing + '\n' + entry)
  } catch {}
}

// === Update Shared Memory ===
if (sessionFolder) {
  try {
    sharedMemory.component_inventory = implementedFiles.map(f => ({ path: f, status: 'implemented' }))
    Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))
  } catch {}
}
```

### Phase 5: Report to Coordinator

```javascript
const changedFiles = Bash(`git diff --name-only HEAD 2>/dev/null || echo "unknown"`)
  .split('\n').filter(Boolean)
const feFiles = changedFiles.filter(f =>
  /\.(tsx|jsx|vue|svelte|css|scss|html)$/.test(f)
)

const resultStatus = selfCheck.failed.length === 0 ? 'complete' : 'complete_with_warnings'

mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "fe-developer", to: "coordinator",
  type: "dev_fe_complete",
  summary: `[fe-developer] DEV-FE complete: ${feFiles.length} files, self-check: ${selfCheck.failed.length} issues`,
  ref: sessionFolder
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `[fe-developer] ## Frontend Implementation Complete

**Task**: ${task.subject}
**Status**: ${resultStatus}
**Framework**: ${feTech.framework} | **Styling**: ${feTech.styling}
**Design Intelligence**: ${designIntel._source || 'not available'}

### Files Modified
${feFiles.slice(0, 10).map(f => `- \`${f}\``).join('\n') || 'See git diff'}

### Design Token Usage
${designTokens ? 'Applied design tokens from architecture → src/styles/tokens.css' : 'No design tokens available — used project defaults'}

### Self-Validation
${selfCheck.failed.length === 0 ? '✅ All checks passed' : `⚠️ ${selfCheck.failed.length} issues:\n${selfCheck.failed.slice(0, 5).map(f => `- [${f.check}] ${f.file}: ${f.message}`).join('\n')}`}

### Accessibility
- Semantic HTML structure
- ARIA attributes applied
- Keyboard navigation supported
- Focus-visible styles included`,
  summary: `[fe-developer] DEV-FE complete: ${feFiles.length} files`
})

TaskUpdate({ taskId: task.id, status: 'completed' })
// Check for next DEV-FE task → back to Phase 1
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No DEV-FE-* tasks | Idle, wait for coordinator |
| Design tokens not found | Use project defaults, note in report |
| Component spec missing | Implement from task description only |
| Tech stack undetected | Default to HTML + CSS, ask coordinator |
| Subagent failure | Fallback to CLI write mode |
| Build/lint errors | Report to coordinator for QA-FE review |
