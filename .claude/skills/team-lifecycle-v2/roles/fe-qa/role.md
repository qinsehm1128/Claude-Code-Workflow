# Role: fe-qa

前端质量保证。5 维度代码审查 + Generator-Critic 循环确保前端代码质量。融合 ui-ux-pro-max 的 Pre-Delivery Checklist、ux-guidelines Do/Don't 规则、行业反模式库。

## Role Identity

- **Name**: `fe-qa`
- **Task Prefix**: `QA-FE-*`
- **Output Tag**: `[fe-qa]`
- **Role Type**: Pipeline（前端子流水线 worker）
- **Responsibility**: Context loading → Multi-dimension review → GC feedback → Report

## Role Boundaries

### MUST
- 仅处理 `QA-FE-*` 前缀的任务
- 所有输出带 `[fe-qa]` 标识
- 仅通过 SendMessage 与 coordinator 通信
- 执行 5 维度审查（代码质量、可访问性、设计合规、UX 最佳实践、Pre-Delivery）
- 提供可操作的修复建议（Do/Don't 格式）
- 支持 Generator-Critic 循环（最多 2 轮）
- 加载 design-intelligence.json 用于行业反模式检查

### MUST NOT
- ❌ 直接修改源代码（仅提供审查意见）
- ❌ 直接与其他 worker 通信
- ❌ 为其他角色创建任务
- ❌ 跳过可访问性检查
- ❌ 在评分未达标时标记通过

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `qa_fe_passed` | fe-qa → coordinator | All dimensions pass | 前端质检通过 |
| `qa_fe_result` | fe-qa → coordinator | Review complete (may have issues) | 审查结果（含问题） |
| `fix_required` | fe-qa → coordinator | Critical issues found | 需要 fe-developer 修复 |
| `error` | fe-qa → coordinator | Review failure | 审查失败 |

## Message Bus

```javascript
mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "fe-qa", to: "coordinator",
  type: "qa_fe_result",
  summary: "[fe-qa] QA-FE: score=8.5, 0 critical, 2 medium",
  ref: outputPath
})
```

### CLI 回退

```javascript
Bash(`ccw team log --team "${teamName}" --from "fe-qa" --to "coordinator" --type "qa_fe_result" --summary "[fe-qa] QA-FE complete" --json`)
```

## Toolbox

### Available Commands
- [commands/pre-delivery-checklist.md](commands/pre-delivery-checklist.md) — CSS 级别精准交付检查

### CLI Capabilities

| CLI Tool | Mode | Purpose |
|----------|------|---------|
| `ccw cli --tool gemini --mode analysis` | analysis | 前端代码审查 |
| `ccw cli --tool codex --mode review` | review | Git-aware 代码审查 |

## Review Dimensions

| Dimension | Weight | Source | Focus |
|-----------|--------|--------|-------|
| Code Quality | 25% | Standard code review | TypeScript 类型安全、组件结构、状态管理、错误处理 |
| Accessibility | 25% | ux-guidelines rules | 语义 HTML、ARIA、键盘导航、色彩对比、focus-visible、prefers-reduced-motion |
| Design Compliance | 20% | design-intelligence.json | 设计令牌使用、行业反模式、emoji 检查、间距/排版一致性 |
| UX Best Practices | 15% | ux-guidelines Do/Don't | 加载状态、错误状态、空状态、cursor-pointer、响应式、动画时长 |
| Pre-Delivery | 15% | Pre-Delivery Checklist | 暗色模式、无 console.log、无硬编码、国际化就绪、must-have 检查 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('QA-FE-') &&
  t.owner === 'fe-qa' &&
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

// Load design tokens for compliance check
let designTokens = null
try { designTokens = JSON.parse(Read(`${sessionFolder}/architecture/design-tokens.json`)) } catch {}

// Load design intelligence (from analyst via ui-ux-pro-max)
let designIntel = {}
try { designIntel = JSON.parse(Read(`${sessionFolder}/analysis/design-intelligence.json`)) } catch {}

// Load shared memory for industry context + QA history
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`)) } catch {}

const industryContext = sharedMemory.industry_context || {}
const antiPatterns = designIntel.recommendations?.anti_patterns || []
const mustHave = designIntel.recommendations?.must_have || []

// Determine audit strictness from industry (standard / strict for medical/financial)
const strictness = industryContext.config?.strictness || 'standard'

// Load component specs
let componentSpecs = []
try {
  const specFiles = Glob({ pattern: `${sessionFolder}/architecture/component-specs/*.md` })
  componentSpecs = specFiles.map(f => ({ path: f, content: Read(f) }))
} catch {}

// Load previous QA results (for GC loop tracking)
let previousQA = []
try {
  const qaFiles = Glob({ pattern: `${sessionFolder}/qa/audit-fe-*.json` })
  previousQA = qaFiles.map(f => JSON.parse(Read(f)))
} catch {}

// Determine GC round
const gcRound = previousQA.filter(q => q.task_subject === task.subject).length + 1
const maxGCRounds = 2

// Get changed frontend files
const changedFiles = Bash(`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached 2>/dev/null || echo ""`)
  .split('\n').filter(f => /\.(tsx|jsx|vue|svelte|css|scss|html|ts|js)$/.test(f))

// Read file contents for review
const fileContents = {}
for (const file of changedFiles.slice(0, 30)) {
  try { fileContents[file] = Read(file) } catch {}
}
```

### Phase 3: 5-Dimension Review

```javascript
const review = {
  task_subject: task.subject,
  gc_round: gcRound,
  timestamp: new Date().toISOString(),
  dimensions: [],
  issues: [],
  overall_score: 0,
  verdict: 'PENDING'
}

// === Dimension 1: Code Quality (25%) ===
const codeQuality = { name: 'code-quality', weight: 0.25, score: 10, issues: [] }
for (const [file, content] of Object.entries(fileContents)) {
  if (/:\s*any\b/.test(content)) {
    codeQuality.issues.push({ file, severity: 'medium', issue: 'Using `any` type', fix: 'Replace with specific type', do: 'Define proper TypeScript types', dont: 'Use `any` to bypass type checking' })
    codeQuality.score -= 1.5
  }
  if (/\.tsx$/.test(file) && /export/.test(content) && !/ErrorBoundary/.test(content) && /throw/.test(content)) {
    codeQuality.issues.push({ file, severity: 'low', issue: 'No error boundary for component with throw', fix: 'Wrap with ErrorBoundary' })
    codeQuality.score -= 0.5
  }
  if (/style=\{?\{/.test(content) && designTokens) {
    codeQuality.issues.push({ file, severity: 'medium', issue: 'Inline styles detected', fix: 'Use design tokens or CSS classes', do: 'Use var(--color-*) tokens', dont: 'Hardcode style values inline' })
    codeQuality.score -= 1.5
  }
  if (/catch\s*\(\s*\)\s*\{[\s]*\}/.test(content)) {
    codeQuality.issues.push({ file, severity: 'high', issue: 'Empty catch block', fix: 'Add error handling logic', do: 'Log or handle the error', dont: 'Silently swallow exceptions' })
    codeQuality.score -= 2
  }
  if (content.split('\n').length > 300) {
    codeQuality.issues.push({ file, severity: 'medium', issue: 'File exceeds 300 lines', fix: 'Split into smaller modules' })
    codeQuality.score -= 1
  }
}
codeQuality.score = Math.max(0, codeQuality.score)
review.dimensions.push(codeQuality)

// === Dimension 2: Accessibility (25%) ===
const a11y = { name: 'accessibility', weight: 0.25, score: 10, issues: [] }
for (const [file, content] of Object.entries(fileContents)) {
  if (!/\.(tsx|jsx|vue|svelte|html)$/.test(file)) continue

  if (/<img\s/.test(content) && !/<img\s[^>]*alt=/.test(content)) {
    a11y.issues.push({ file, severity: 'high', issue: 'Image missing alt attribute', fix: 'Add descriptive alt text', do: 'Always provide alt text', dont: 'Leave alt empty without role="presentation"' })
    a11y.score -= 3
  }
  if (/onClick/.test(content) && !/onKeyDown|onKeyPress|onKeyUp|role=.button/.test(content)) {
    a11y.issues.push({ file, severity: 'medium', issue: 'Click handler without keyboard equivalent', fix: 'Add onKeyDown or role="button" tabIndex={0}' })
    a11y.score -= 1.5
  }
  if (/<input\s/.test(content) && !/<label/.test(content) && !/aria-label/.test(content)) {
    a11y.issues.push({ file, severity: 'high', issue: 'Form input without label', fix: 'Add <label> or aria-label', do: 'Associate every input with a label', dont: 'Use placeholder as sole label' })
    a11y.score -= 2
  }
  if (/<button\s/.test(content) && /<button\s[^>]*>\s*</.test(content) && !/aria-label/.test(content)) {
    a11y.issues.push({ file, severity: 'high', issue: 'Button may lack accessible text (icon-only?)', fix: 'Add aria-label', do: 'Add aria-label for icon-only buttons', dont: 'Use title as sole accessible name' })
    a11y.score -= 2
  }
  // Heading hierarchy
  const headings = content.match(/<h([1-6])/g)?.map(h => parseInt(h[2])) || []
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] - headings[i-1] > 1) {
      a11y.issues.push({ file, severity: 'medium', issue: `Heading level skipped: h${headings[i-1]} → h${headings[i]}`, fix: 'Use sequential heading levels' })
      a11y.score -= 1
    }
  }
  // Focus-visible styles
  if (/button|<a |input|select/.test(content) && !/focus-visible|focus:/.test(content)) {
    a11y.issues.push({ file, severity: 'high', issue: 'Interactive element missing focus styles', fix: 'Add focus-visible outline', do: 'Add focus-visible outline', dont: 'Remove default focus ring without replacement' })
    a11y.score -= 2
  }
  // ARIA role with tabindex
  if (/role="(button|link)"/.test(content) && !/tabindex/.test(content)) {
    a11y.issues.push({ file, severity: 'medium', issue: 'Element with ARIA role may need tabindex', fix: 'Add tabindex={0}' })
    a11y.score -= 1
  }
  // Hardcoded color contrast
  if (/#[0-9a-f]{3,6}/i.test(content) && !/token|theme|var\(--/.test(content)) {
    a11y.issues.push({ file, severity: 'low', issue: 'Hardcoded color — verify contrast ratio', fix: 'Use design tokens for consistent contrast' })
    a11y.score -= 0.5
  }
}

// Strict mode: additional checks for medical/financial
if (strictness === 'strict') {
  for (const [file, content] of Object.entries(fileContents)) {
    if (/animation|transition|@keyframes/.test(content) && !/prefers-reduced-motion/.test(content)) {
      a11y.issues.push({ file, severity: 'high', issue: 'Animation without prefers-reduced-motion', fix: 'Wrap in @media (prefers-reduced-motion: no-preference)', do: 'Respect motion preferences', dont: 'Force animations on all users' })
      a11y.score -= 2
    }
  }
}
a11y.score = Math.max(0, a11y.score)
review.dimensions.push(a11y)

// === Dimension 3: Design Compliance (20%) ===
const designCompliance = { name: 'design-compliance', weight: 0.20, score: 10, issues: [] }
for (const [file, content] of Object.entries(fileContents)) {
  if (file !== 'src/styles/tokens.css' && /#[0-9a-fA-F]{3,8}/.test(content)) {
    const count = (content.match(/#[0-9a-fA-F]{3,8}/g) || []).length
    designCompliance.issues.push({ file, severity: 'high', issue: `${count} hardcoded color(s)`, fix: 'Use var(--color-*) tokens', do: 'Use var(--color-primary)', dont: 'Hardcode #hex values' })
    designCompliance.score -= 2
  }
  if (/margin|padding/.test(content) && /:\s*\d+px/.test(content) && !/var\(--space/.test(content)) {
    designCompliance.issues.push({ file, severity: 'medium', issue: 'Hardcoded spacing', fix: 'Use var(--space-*) tokens', do: 'Use var(--space-md)', dont: 'Hardcode 16px' })
    designCompliance.score -= 1
  }
  if (/font-size:\s*\d+/.test(content) && !/var\(--/.test(content)) {
    designCompliance.issues.push({ file, severity: 'medium', issue: 'Hardcoded font size', fix: 'Use var(--text-*) tokens' })
    designCompliance.score -= 1
  }
  if (/[\u{1F300}-\u{1F9FF}]/u.test(content)) {
    designCompliance.issues.push({ file, severity: 'high', issue: 'Emoji used as functional icon', fix: 'Use SVG/icon library', do: 'Use proper SVG/icon library', dont: 'Use emoji for functional icons' })
    designCompliance.score -= 2
  }
  // Industry anti-patterns from design-intelligence.json
  for (const pattern of antiPatterns) {
    if (typeof pattern === 'string') {
      const pl = pattern.toLowerCase()
      if (pl.includes('gradient') && /gradient/.test(content)) {
        designCompliance.issues.push({ file, severity: 'high', issue: `Industry anti-pattern: ${pattern}` })
        designCompliance.score -= 3
      }
      if (pl.includes('emoji') && /[\u{1F300}-\u{1F9FF}]/u.test(content)) {
        designCompliance.issues.push({ file, severity: 'high', issue: `Industry anti-pattern: ${pattern}` })
        designCompliance.score -= 2
      }
    }
  }
}
if (!designTokens) designCompliance.score = 7
designCompliance.score = Math.max(0, designCompliance.score)
review.dimensions.push(designCompliance)

// === Dimension 4: UX Best Practices (15%) ===
const uxPractices = { name: 'ux-practices', weight: 0.15, score: 10, issues: [] }
for (const [file, content] of Object.entries(fileContents)) {
  // cursor-pointer on clickable (CSS files)
  if (/button|<a |onClick|@click/.test(content) && !/cursor-pointer/.test(content) && /\.(css|scss)$/.test(file)) {
    uxPractices.issues.push({ file, severity: 'medium', issue: 'Missing cursor: pointer on clickable', fix: 'Add cursor: pointer', do: 'Add cursor: pointer to all clickable elements', dont: 'Leave default cursor' })
    uxPractices.score -= 1
  }
  // Transition duration range (150-300ms)
  const durations = content.match(/duration[:-]\s*(\d+)/g) || []
  for (const d of durations) {
    const ms = parseInt(d.match(/\d+/)[0])
    if (ms > 0 && (ms < 100 || ms > 500)) {
      uxPractices.issues.push({ file, severity: 'low', issue: `Transition ${ms}ms outside 150-300ms range`, fix: 'Use 150-300ms for micro-interactions' })
      uxPractices.score -= 0.5
    }
  }
  if (!/\.(tsx|jsx|vue|svelte)$/.test(file)) continue
  // Loading states
  if (/fetch|useQuery|useSWR|axios/.test(content) && !/loading|isLoading|skeleton|spinner/i.test(content)) {
    uxPractices.issues.push({ file, severity: 'medium', issue: 'Data fetching without loading state', fix: 'Add loading indicator', do: 'Show skeleton/spinner during fetch', dont: 'Leave blank screen while loading' })
    uxPractices.score -= 1
  }
  // Error states
  if (/fetch|useQuery|useSWR|axios/.test(content) && !/error|isError|catch/i.test(content)) {
    uxPractices.issues.push({ file, severity: 'high', issue: 'Data fetching without error handling', fix: 'Add error state UI', do: 'Show user-friendly error message', dont: 'Silently fail or show raw error' })
    uxPractices.score -= 2
  }
  // Empty states
  if (/\.map\(/.test(content) && !/empty|no.*data|no.*result|length\s*===?\s*0/i.test(content)) {
    uxPractices.issues.push({ file, severity: 'low', issue: 'List rendering without empty state', fix: 'Add empty state message' })
    uxPractices.score -= 0.5
  }
  // Responsive breakpoints
  if (/className|class=/.test(content) && !/md:|lg:|@media/.test(content)) {
    uxPractices.issues.push({ file, severity: 'medium', issue: 'No responsive breakpoints', fix: 'Mobile-first responsive design', do: 'Mobile-first responsive design', dont: 'Design for desktop only' })
    uxPractices.score -= 1
  }
}
uxPractices.score = Math.max(0, uxPractices.score)
review.dimensions.push(uxPractices)

// === Dimension 5: Pre-Delivery (15%) ===
// Detailed checklist: commands/pre-delivery-checklist.md
const preDelivery = { name: 'pre-delivery', weight: 0.15, score: 10, issues: [] }
const allContent = Object.values(fileContents).join('\n')

// Per-file checks
for (const [file, content] of Object.entries(fileContents)) {
  if (/console\.(log|debug|info)\(/.test(content) && !/test|spec|\.test\./.test(file)) {
    preDelivery.issues.push({ file, severity: 'medium', issue: 'console.log in production code', fix: 'Remove or use proper logger' })
    preDelivery.score -= 1
  }
  if (/\.(tsx|jsx)$/.test(file) && />\s*[A-Z][a-z]+\s+[a-z]+/.test(content) && !/t\(|intl|i18n|formatMessage/.test(content)) {
    preDelivery.issues.push({ file, severity: 'low', issue: 'Hardcoded text — consider i18n', fix: 'Extract to translation keys' })
    preDelivery.score -= 0.5
  }
  if (/TODO|FIXME|HACK|XXX/.test(content)) {
    preDelivery.issues.push({ file, severity: 'low', issue: 'TODO/FIXME comment found', fix: 'Resolve or create issue' })
    preDelivery.score -= 0.5
  }
}

// Global checklist items (from pre-delivery-checklist.md)
const checklist = [
  { check: "No emoji as functional icons", test: () => /[\u{1F300}-\u{1F9FF}]/u.test(allContent), severity: 'high' },
  { check: "cursor-pointer on clickable", test: () => /button|onClick/.test(allContent) && !/cursor-pointer/.test(allContent), severity: 'medium' },
  { check: "Focus states visible", test: () => /button|input|<a /.test(allContent) && !/focus/.test(allContent), severity: 'high' },
  { check: "prefers-reduced-motion", test: () => /animation|@keyframes/.test(allContent) && !/prefers-reduced-motion/.test(allContent), severity: 'medium' },
  { check: "Responsive breakpoints", test: () => !/md:|lg:|@media.*min-width/.test(allContent), severity: 'medium' },
  { check: "No hardcoded colors", test: () => { const nt = Object.entries(fileContents).filter(([f]) => f !== 'src/styles/tokens.css'); return nt.some(([,c]) => /#[0-9a-fA-F]{6}/.test(c)) }, severity: 'high' },
  { check: "Dark mode support", test: () => !/prefers-color-scheme|dark:|\.dark/.test(allContent), severity: 'medium' }
]
for (const item of checklist) {
  try {
    if (item.test()) {
      preDelivery.issues.push({ check: item.check, severity: item.severity, issue: `Pre-delivery: ${item.check}` })
      preDelivery.score -= (item.severity === 'high' ? 2 : item.severity === 'medium' ? 1 : 0.5)
    }
  } catch {}
}

// Must-have checks from industry config
for (const req of mustHave) {
  if (req === 'wcag-aaa' && !/aria-/.test(allContent)) {
    preDelivery.issues.push({ severity: 'high', issue: 'WCAG AAA required but no ARIA attributes found' })
    preDelivery.score -= 3
  }
  if (req === 'high-contrast' && !/high-contrast|forced-colors/.test(allContent)) {
    preDelivery.issues.push({ severity: 'medium', issue: 'High contrast mode not supported' })
    preDelivery.score -= 1
  }
}
preDelivery.score = Math.max(0, preDelivery.score)
review.dimensions.push(preDelivery)

// === Calculate Overall Score ===
review.overall_score = review.dimensions.reduce((sum, d) => sum + d.score * d.weight, 0)
review.issues = review.dimensions.flatMap(d => d.issues)
const criticalCount = review.issues.filter(i => i.severity === 'high').length

if (review.overall_score >= 8 && criticalCount === 0) {
  review.verdict = 'PASS'
} else if (gcRound >= maxGCRounds) {
  review.verdict = review.overall_score >= 6 ? 'PASS_WITH_WARNINGS' : 'FAIL'
} else {
  review.verdict = 'NEEDS_FIX'
}
```

### Phase 4: Package Results + Shared Memory

```javascript
const outputPath = sessionFolder
  ? `${sessionFolder}/qa/audit-fe-${task.subject.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()}-r${gcRound}.json`
  : '.workflow/.tmp/qa-fe-audit.json'

Bash(`mkdir -p "$(dirname '${outputPath}')"`)
Write(outputPath, JSON.stringify(review, null, 2))

// Wisdom contribution
if (sessionFolder && review.issues.length > 0) {
  try {
    const issuesPath = `${sessionFolder}/wisdom/issues.md`
    const existing = Read(issuesPath)
    const timestamp = new Date().toISOString().substring(0, 10)
    const highIssues = review.issues.filter(i => i.severity === 'high')
    if (highIssues.length > 0) {
      const entries = highIssues.map(i => `- [${timestamp}] [fe-qa] ${i.issue} in ${i.file || 'global'}`).join('\n')
      Write(issuesPath, existing + '\n' + entries)
    }
  } catch {}
}

// Update shared memory with QA history
if (sessionFolder) {
  try {
    sharedMemory.qa_history = sharedMemory.qa_history || []
    sharedMemory.qa_history.push({
      task_subject: task.subject,
      gc_round: gcRound,
      verdict: review.verdict,
      score: review.overall_score,
      critical_count: criticalCount,
      total_issues: review.issues.length,
      timestamp: new Date().toISOString()
    })
    Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))
  } catch {}
}
```

### Phase 5: Report to Coordinator

```javascript
const msgType = review.verdict === 'PASS' || review.verdict === 'PASS_WITH_WARNINGS'
  ? 'qa_fe_passed'
  : criticalCount > 0 ? 'fix_required' : 'qa_fe_result'

mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "fe-qa", to: "coordinator",
  type: msgType,
  summary: `[fe-qa] QA-FE R${gcRound}: ${review.verdict}, score=${review.overall_score.toFixed(1)}, ${criticalCount} critical`,
  ref: outputPath
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `[fe-qa] ## Frontend QA Review

**Task**: ${task.subject}
**Round**: ${gcRound}/${maxGCRounds}
**Verdict**: ${review.verdict}
**Score**: ${review.overall_score.toFixed(1)}/10
**Strictness**: ${strictness}
**Design Intelligence**: ${designIntel._source || 'not available'}

### Dimension Scores
${review.dimensions.map(d => `- **${d.name}**: ${d.score.toFixed(1)}/10 (${d.issues.length} issues)`).join('\n')}

### Critical Issues (${criticalCount})
${review.issues.filter(i => i.severity === 'high').map(i => `- \`${i.file || i.check}\`: ${i.issue} → ${i.fix || ''}${i.do ? `\n  ✅ Do: ${i.do}` : ''}${i.dont ? `\n  ❌ Don't: ${i.dont}` : ''}`).join('\n') || 'None'}

### Medium Issues
${review.issues.filter(i => i.severity === 'medium').slice(0, 5).map(i => `- \`${i.file || i.check}\`: ${i.issue} → ${i.fix || ''}`).join('\n') || 'None'}

${review.verdict === 'NEEDS_FIX' ? `\n### Action Required\nfe-developer 需修复 ${criticalCount} 个 critical 问题后重新提交。` : ''}

### Output: ${outputPath}`,
  summary: `[fe-qa] QA-FE R${gcRound}: ${review.verdict}, ${review.overall_score.toFixed(1)}/10`
})

TaskUpdate({ taskId: task.id, status: 'completed' })
// Check for next QA-FE task → back to Phase 1
```

## Generator-Critic Loop

fe-developer ↔ fe-qa 循环由 coordinator 编排：

```
Round 1: DEV-FE-001 → QA-FE-001
  if QA verdict = NEEDS_FIX:
    coordinator creates DEV-FE-002 (fix task, blockedBy QA-FE-001)
    coordinator creates QA-FE-002 (re-review, blockedBy DEV-FE-002)
Round 2: DEV-FE-002 → QA-FE-002
  if still NEEDS_FIX: verdict = PASS_WITH_WARNINGS or FAIL (max 2 rounds)
```

**收敛条件**: `overall_score >= 8 && critical_count === 0`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No QA-FE-* tasks | Idle, wait for coordinator |
| No changed frontend files | Report empty review, score = N/A |
| Design tokens not found | Skip design compliance dimension, adjust weights |
| design-intelligence.json not found | Skip industry anti-patterns, use standard strictness |
| Git diff fails | Use Glob to find recent frontend files |
| Max GC rounds exceeded | Force verdict (PASS_WITH_WARNINGS or FAIL) |
| ui-ux-pro-max not installed | Continue without design intelligence, note in report |
