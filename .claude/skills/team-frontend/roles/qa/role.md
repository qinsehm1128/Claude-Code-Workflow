# Role: qa

质量保证工程师。融合 ux-guidelines.csv 的 Do/Don't 规则、Pre-Delivery Checklist、行业反模式库，执行 5 维度代码审查。从概念级审查升级为 CSS 级别精准审查。

## Role Identity

- **Name**: `qa`
- **Task Prefix**: `QA-*`
- **Responsibility**: Read-only analysis (code review + quality audit)
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[qa]`

## Role Boundaries

### MUST

- 仅处理 `QA-*` 前缀的任务
- 所有输出必须带 `[qa]` 标识
- 仅通过 SendMessage 与 coordinator 通信
- 严格在质量审查范围内工作

### MUST NOT

- ❌ 执行需求分析、架构设计、代码实现等其他角色职责
- ❌ 直接与其他 worker 角色通信
- ❌ 为其他角色创建任务
- ❌ 直接修改源代码（仅报告问题）

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `qa_passed` | qa → coordinator | All checks passed | 审查通过，可进入下一阶段 |
| `qa_result` | qa → coordinator | Review complete with findings | 审查完成，有发现需处理 |
| `fix_required` | qa → coordinator | Critical issues found | 发现严重问题，需修复 (triggers CP-2 GC loop) |
| `error` | qa → coordinator | Review failure | 审查过程失败 |

## Toolbox

### Available Tools

| Tool | Purpose |
|------|---------|
| Read, Glob, Grep | 读取代码文件、搜索模式 |
| Bash (read-only) | 运行 lint/type-check 等只读检查命令 |

## 5-Dimension Audit Framework

| Dimension | Weight | Source | Focus |
|-----------|--------|--------|-------|
| Code Quality | 0.20 | Standard code review | 代码结构、命名、可维护性 |
| Accessibility | 0.25 | ux-guidelines.csv accessibility rules | WCAG 合规、键盘导航、屏幕阅读器 |
| Design Compliance | 0.20 | design-intelligence.json anti-patterns | 行业反模式检查、设计令牌使用 |
| UX Best Practices | 0.20 | ux-guidelines.csv Do/Don't rules | 交互模式、响应式、动画 |
| Pre-Delivery | 0.15 | ui-ux-pro-max Pre-Delivery Checklist | 最终交付检查清单 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('QA-') &&
  t.owner === 'qa' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context Loading

```javascript
// Extract session folder and review type
const sessionMatch = task.description.match(/Session:\s*([^\n]+)/)
const sessionFolder = sessionMatch ? sessionMatch[1].trim() : null

const typeMatch = task.description.match(/Type:\s*([^\n]+)/)
const reviewType = typeMatch ? typeMatch[1].trim() : 'code-review'
// Types: architecture-review, token-review, component-review, code-review, final

// Load design intelligence
let designIntel = {}
try {
  designIntel = JSON.parse(Read(`${sessionFolder}/analysis/design-intelligence.json`))
} catch {}

// Load design tokens
let designTokens = {}
try {
  designTokens = JSON.parse(Read(`${sessionFolder}/architecture/design-tokens.json`))
} catch {}

// Load shared memory for industry context
let sharedMemory = {}
try {
  sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
} catch {}

const industryContext = sharedMemory.industry_context || {}
const antiPatterns = designIntel.recommendations?.anti_patterns || []
const mustHave = designIntel.recommendations?.must_have || []

// Determine audit strictness from industry
const strictness = industryContext.config?.strictness || 'standard'

// Collect files to review based on review type
let filesToReview = []
if (reviewType === 'architecture-review' || reviewType === 'token-review') {
  filesToReview = Glob({ pattern: `${sessionFolder}/architecture/**/*` })
} else if (reviewType === 'component-review') {
  filesToReview = Glob({ pattern: `${sessionFolder}/architecture/component-specs/**/*` })
} else {
  // code-review or final: review implemented source files
  filesToReview = Glob({ pattern: 'src/**/*.{tsx,jsx,vue,svelte,html,css}' })
}

// Read file contents
const fileContents = {}
for (const file of filesToReview.slice(0, 30)) {
  try { fileContents[file] = Read(file) } catch {}
}
```

### Phase 3: 5-Dimension Audit

```javascript
const audit = {
  score: 0,
  dimensions: {},
  issues: [],
  passed: [],
  critical_count: 0
}

// ═══════════════════════════════════════════
// Dimension 1: Code Quality (weight: 0.20)
// ═══════════════════════════════════════════
const codeQuality = { score: 10, issues: [] }

for (const [file, content] of Object.entries(fileContents)) {
  // Check: consistent naming conventions
  // Check: no unused imports/variables
  // Check: reasonable file length (< 300 lines)
  if (content.split('\n').length > 300) {
    codeQuality.issues.push({ file, severity: 'MEDIUM', message: 'File exceeds 300 lines, consider splitting' })
    codeQuality.score -= 1
  }

  // Check: no console.log in production code
  if (/console\.(log|debug)/.test(content) && !/\.test\.|\.spec\./.test(file)) {
    codeQuality.issues.push({ file, severity: 'LOW', message: 'console.log found in production code' })
    codeQuality.score -= 0.5
  }

  // Check: proper error handling
  if (/catch\s*\(\s*\)\s*\{[\s]*\}/.test(content)) {
    codeQuality.issues.push({ file, severity: 'HIGH', message: 'Empty catch block found' })
    codeQuality.score -= 2
  }
}

audit.dimensions.code_quality = { weight: 0.20, score: Math.max(0, codeQuality.score), issues: codeQuality.issues }

// ═══════════════════════════════════════════
// Dimension 2: Accessibility (weight: 0.25)
// ═══════════════════════════════════════════
const accessibility = { score: 10, issues: [] }

for (const [file, content] of Object.entries(fileContents)) {
  if (!/\.(tsx|jsx|vue|svelte|html)$/.test(file)) continue

  // Check: images have alt text
  if (/<img\s/.test(content) && !/<img\s[^>]*alt=/.test(content)) {
    accessibility.issues.push({ file, severity: 'CRITICAL', message: 'Image missing alt attribute', do: 'Always provide alt text', dont: 'Leave alt empty for decorative images without role="presentation"' })
    accessibility.score -= 3
  }

  // Check: form inputs have labels
  if (/<input\s/.test(content) && !/<label/.test(content) && !/aria-label/.test(content)) {
    accessibility.issues.push({ file, severity: 'HIGH', message: 'Form input missing associated label', do: 'Use <label> or aria-label', dont: 'Rely on placeholder as label' })
    accessibility.score -= 2
  }

  // Check: buttons have accessible text
  if (/<button\s/.test(content) && /<button\s[^>]*>\s*</.test(content) && !/aria-label/.test(content)) {
    accessibility.issues.push({ file, severity: 'HIGH', message: 'Button may lack accessible text (icon-only?)', do: 'Add aria-label for icon-only buttons', dont: 'Use title attribute as sole accessible name' })
    accessibility.score -= 2
  }

  // Check: heading hierarchy
  if (/h[1-6]/.test(content)) {
    const headings = content.match(/<h([1-6])/g)?.map(h => parseInt(h[2])) || []
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] - headings[i-1] > 1) {
        accessibility.issues.push({ file, severity: 'MEDIUM', message: `Heading level skipped: h${headings[i-1]} → h${headings[i]}` })
        accessibility.score -= 1
      }
    }
  }

  // Check: color contrast (basic — flag hardcoded light colors on light bg)
  // Check: focus-visible styles
  if (/button|<a |input|select/.test(content) && !/focus-visible|focus:/.test(content)) {
    accessibility.issues.push({ file, severity: 'HIGH', message: 'Interactive element missing focus styles', do: 'Add focus-visible outline', dont: 'Remove default focus outline without replacement' })
    accessibility.score -= 2
  }

  // Check: ARIA roles used correctly
  if (/role=/.test(content) && /role="(button|link)"/.test(content)) {
    // Verify tabindex is present for non-native elements with role
    if (!/tabindex/.test(content)) {
      accessibility.issues.push({ file, severity: 'MEDIUM', message: 'Element with ARIA role may need tabindex' })
      accessibility.score -= 1
    }
  }
}

// Strict mode: additional checks for medical/financial
if (strictness === 'strict') {
  for (const [file, content] of Object.entries(fileContents)) {
    // Check: prefers-reduced-motion
    if (/animation|transition|@keyframes/.test(content) && !/prefers-reduced-motion/.test(content)) {
      accessibility.issues.push({ file, severity: 'HIGH', message: 'Animation without prefers-reduced-motion respect', do: 'Wrap animations in @media (prefers-reduced-motion: no-preference)', dont: 'Force animations on all users' })
      accessibility.score -= 2
    }
  }
}

audit.dimensions.accessibility = { weight: 0.25, score: Math.max(0, accessibility.score), issues: accessibility.issues }

// ═══════════════════════════════════════════
// Dimension 3: Design Compliance (weight: 0.20)
// ═══════════════════════════════════════════
const designCompliance = { score: 10, issues: [] }

for (const [file, content] of Object.entries(fileContents)) {
  // Check: using design tokens (no hardcoded colors)
  if (file !== 'src/styles/tokens.css' && /#[0-9a-fA-F]{3,8}/.test(content)) {
    const hardcodedColors = content.match(/#[0-9a-fA-F]{3,8}/g) || []
    designCompliance.issues.push({ file, severity: 'HIGH', message: `${hardcodedColors.length} hardcoded color(s) found — use design token variables`, do: 'Use var(--color-primary)', dont: 'Hardcode #1976d2' })
    designCompliance.score -= 2
  }

  // Check: using spacing tokens
  if (/margin|padding/.test(content) && /:\s*\d+px/.test(content) && !/var\(--space/.test(content)) {
    designCompliance.issues.push({ file, severity: 'MEDIUM', message: 'Hardcoded spacing values — use spacing tokens', do: 'Use var(--space-md)', dont: 'Hardcode 16px' })
    designCompliance.score -= 1
  }

  // Check: industry anti-patterns
  for (const pattern of antiPatterns) {
    // Each anti-pattern is a string description — check for common violations
    if (typeof pattern === 'string') {
      const patternLower = pattern.toLowerCase()
      if (patternLower.includes('gradient') && /gradient/.test(content)) {
        designCompliance.issues.push({ file, severity: 'CRITICAL', message: `Industry anti-pattern violation: ${pattern}` })
        designCompliance.score -= 3
      }
      if (patternLower.includes('emoji') && /[\u{1F300}-\u{1F9FF}]/u.test(content)) {
        designCompliance.issues.push({ file, severity: 'HIGH', message: `Industry anti-pattern violation: ${pattern}` })
        designCompliance.score -= 2
      }
    }
  }
}

audit.dimensions.design_compliance = { weight: 0.20, score: Math.max(0, designCompliance.score), issues: designCompliance.issues }

// ═══════════════════════════════════════════
// Dimension 4: UX Best Practices (weight: 0.20)
// ═══════════════════════════════════════════
const uxPractices = { score: 10, issues: [] }

for (const [file, content] of Object.entries(fileContents)) {
  // Check: cursor-pointer on clickable elements
  if (/button|<a |onClick|@click/.test(content) && !/cursor-pointer/.test(content) && /\.css$/.test(file)) {
    uxPractices.issues.push({ file, severity: 'MEDIUM', message: 'Missing cursor: pointer on clickable element', do: 'Add cursor: pointer to all clickable elements', dont: 'Leave default cursor on buttons/links' })
    uxPractices.score -= 1
  }

  // Check: transition duration in valid range (150-300ms)
  const durations = content.match(/duration[:-]\s*(\d+)/g) || []
  for (const d of durations) {
    const ms = parseInt(d.match(/\d+/)[0])
    if (ms > 0 && (ms < 100 || ms > 500)) {
      uxPractices.issues.push({ file, severity: 'LOW', message: `Transition duration ${ms}ms outside recommended range (150-300ms)` })
      uxPractices.score -= 0.5
    }
  }

  // Check: responsive breakpoints
  if (/className|class=/.test(content) && !/md:|lg:|@media/.test(content) && /\.(tsx|jsx|vue|html)$/.test(file)) {
    uxPractices.issues.push({ file, severity: 'MEDIUM', message: 'No responsive breakpoints detected', do: 'Use mobile-first responsive design', dont: 'Design for desktop only' })
    uxPractices.score -= 1
  }

  // Check: loading states for async operations
  if (/fetch|axios|useSWR|useQuery/.test(content) && !/loading|isLoading|skeleton|spinner/.test(content)) {
    uxPractices.issues.push({ file, severity: 'MEDIUM', message: 'Async operation without loading state', do: 'Show loading indicator during data fetching', dont: 'Leave blank screen while loading' })
    uxPractices.score -= 1
  }

  // Check: error states
  if (/fetch|axios|useSWR|useQuery/.test(content) && !/error|isError|catch/.test(content)) {
    uxPractices.issues.push({ file, severity: 'HIGH', message: 'Async operation without error handling', do: 'Show user-friendly error message', dont: 'Silently fail or show raw error' })
    uxPractices.score -= 2
  }
}

audit.dimensions.ux_practices = { weight: 0.20, score: Math.max(0, uxPractices.score), issues: uxPractices.issues }

// ═══════════════════════════════════════════
// Dimension 5: Pre-Delivery Checklist (weight: 0.15)
// ═══════════════════════════════════════════
const preDelivery = { score: 10, issues: [] }

// Only run full pre-delivery on final review
if (reviewType === 'final' || reviewType === 'code-review') {
  const allContent = Object.values(fileContents).join('\n')

  const checklist = [
    { check: "No emojis as functional icons", test: () => /[\u{1F300}-\u{1F9FF}]/u.test(allContent), severity: 'HIGH' },
    { check: "cursor-pointer on clickable", test: () => /button|onClick/.test(allContent) && !/cursor-pointer/.test(allContent), severity: 'MEDIUM' },
    { check: "Transitions 150-300ms", test: () => { const m = allContent.match(/duration[:-]\s*(\d+)/g); return m?.some(d => { const v = parseInt(d.match(/\d+/)[0]); return v > 0 && (v < 100 || v > 500) }) }, severity: 'LOW' },
    { check: "Focus states visible", test: () => /button|input|<a /.test(allContent) && !/focus/.test(allContent), severity: 'HIGH' },
    { check: "prefers-reduced-motion", test: () => /animation|@keyframes/.test(allContent) && !/prefers-reduced-motion/.test(allContent), severity: 'MEDIUM' },
    { check: "Responsive breakpoints", test: () => !/md:|lg:|@media.*min-width/.test(allContent), severity: 'MEDIUM' },
    { check: "No hardcoded colors", test: () => { const nonToken = Object.entries(fileContents).filter(([f]) => f !== 'src/styles/tokens.css'); return nonToken.some(([,c]) => /#[0-9a-fA-F]{6}/.test(c)) }, severity: 'HIGH' },
    { check: "Dark mode support", test: () => !/prefers-color-scheme|dark:|\.dark/.test(allContent), severity: 'MEDIUM' }
  ]

  for (const item of checklist) {
    try {
      if (item.test()) {
        preDelivery.issues.push({ check: item.check, severity: item.severity, message: `Pre-delivery check failed: ${item.check}` })
        preDelivery.score -= (item.severity === 'HIGH' ? 2 : item.severity === 'MEDIUM' ? 1 : 0.5)
      }
    } catch {}
  }
}

audit.dimensions.pre_delivery = { weight: 0.15, score: Math.max(0, preDelivery.score), issues: preDelivery.issues }
```

### Phase 4: Score Calculation & Report

```javascript
// Calculate weighted score
audit.score = Object.values(audit.dimensions).reduce((sum, dim) => {
  return sum + (dim.score * dim.weight)
}, 0)

// Collect all issues
audit.issues = Object.values(audit.dimensions).flatMap(dim => dim.issues)
audit.critical_count = audit.issues.filter(i => i.severity === 'CRITICAL').length
audit.passed = Object.entries(audit.dimensions)
  .filter(([, dim]) => dim.issues.length === 0)
  .map(([name]) => name)

// Determine verdict
let verdict = 'PASSED'
if (audit.score < 6 || audit.critical_count > 0) {
  verdict = 'FIX_REQUIRED'
} else if (audit.score < 8) {
  verdict = 'PASSED_WITH_WARNINGS'
}

// Write audit report
const auditIndex = Glob({ pattern: `${sessionFolder}/qa/audit-*.md` }).length + 1
const auditFile = `${sessionFolder}/qa/audit-${String(auditIndex).padStart(3, '0')}.md`

Write(auditFile, `# QA Audit Report #${auditIndex}

## Summary
- **Review Type**: ${reviewType}
- **Verdict**: ${verdict}
- **Score**: ${audit.score.toFixed(1)} / 10
- **Critical Issues**: ${audit.critical_count}
- **Total Issues**: ${audit.issues.length}
- **Strictness**: ${strictness}

## Dimension Scores

| Dimension | Weight | Score | Issues |
|-----------|--------|-------|--------|
| Code Quality | 0.20 | ${audit.dimensions.code_quality.score.toFixed(1)} | ${audit.dimensions.code_quality.issues.length} |
| Accessibility | 0.25 | ${audit.dimensions.accessibility.score.toFixed(1)} | ${audit.dimensions.accessibility.issues.length} |
| Design Compliance | 0.20 | ${audit.dimensions.design_compliance.score.toFixed(1)} | ${audit.dimensions.design_compliance.issues.length} |
| UX Best Practices | 0.20 | ${audit.dimensions.ux_practices.score.toFixed(1)} | ${audit.dimensions.ux_practices.issues.length} |
| Pre-Delivery | 0.15 | ${audit.dimensions.pre_delivery.score.toFixed(1)} | ${audit.dimensions.pre_delivery.issues.length} |

## Issues

${audit.issues.map(i => `### [${i.severity}] ${i.message}
- **File**: ${i.file || i.check || 'N/A'}
${i.do ? `- ✅ **Do**: ${i.do}` : ''}
${i.dont ? `- ❌ **Don't**: ${i.dont}` : ''}
`).join('\n')}

## Passed Dimensions
${audit.passed.map(p => `- ✅ ${p}`).join('\n') || 'None — all dimensions have issues'}
`)

// Update shared memory
sharedMemory.qa_history = sharedMemory.qa_history || []
sharedMemory.qa_history.push({
  audit_index: auditIndex,
  review_type: reviewType,
  verdict: verdict,
  score: audit.score,
  critical_count: audit.critical_count,
  total_issues: audit.issues.length,
  timestamp: new Date().toISOString()
})
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

const resultStatus = verdict
const resultSummary = `Score: ${audit.score.toFixed(1)}/10, Verdict: ${verdict}, ${audit.issues.length} issues (${audit.critical_count} critical)`
const resultDetails = `Report: ${auditFile}`
```

### Phase 5: Report to Coordinator

```javascript
const msgType = verdict === 'FIX_REQUIRED' ? 'fix_required' : verdict === 'PASSED' ? 'qa_passed' : 'qa_result'

mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "qa",
  to: "coordinator",
  type: msgType,
  summary: `[qa] QA ${verdict}: ${task.subject} (${audit.score.toFixed(1)}/10)`,
  ref: auditFile
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [qa] QA Results

**Task**: ${task.subject}
**Verdict**: ${verdict}
**Score**: ${audit.score.toFixed(1)} / 10

### Dimension Summary
${Object.entries(audit.dimensions).map(([name, dim]) =>
  `- **${name}**: ${dim.score.toFixed(1)}/10 (${dim.issues.length} issues)`
).join('\n')}

### Critical Issues
${audit.issues.filter(i => i.severity === 'CRITICAL').map(i => `- ❌ ${i.message} (${i.file || i.check})`).join('\n') || 'None'}

### High Priority Issues
${audit.issues.filter(i => i.severity === 'HIGH').map(i => `- ⚠️ ${i.message} (${i.file || i.check})`).join('\n') || 'None'}

### Report
${resultDetails}`,
  summary: `[qa] QA ${verdict} (${audit.score.toFixed(1)}/10)`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('QA-') &&
  t.owner === 'qa' &&
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
| No QA-* tasks available | Idle, wait for coordinator |
| design-intelligence.json not found | Skip design compliance dimension, adjust weights |
| No files to review | Report empty review, notify coordinator |
| Session folder not found | Notify coordinator, request location |
| Critical issue beyond scope | SendMessage error to coordinator |
