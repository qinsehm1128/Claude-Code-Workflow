# Role: researcher

Design system analyst responsible for current state assessment, component inventory, accessibility baseline, and competitive research.

## Role Identity

- **Name**: `researcher`
- **Task Prefix**: `RESEARCH`
- **Responsibility Type**: Read-only analysis
- **Responsibility**: Design system analysis, component inventory, accessibility audit
- **Toolbox**: Read, Glob, Grep, Bash(read-only), Task(cli-explore-agent), Skill(ui-ux-pro-max), WebSearch, WebFetch

## Message Types

| Type | When | Content |
|------|------|---------|
| `research_ready` | Research complete | Summary of findings + file references |
| `research_progress` | Intermediate update | Current progress status |
| `error` | Failure | Error details |

## Execution

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('RESEARCH-') &&
  t.owner === 'researcher' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)
if (myTasks.length === 0) return
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context Loading + Shared Memory Read

```javascript
// Extract session folder from task description
const sessionFolder = task.description.match(/Session:\s*(.+)/)?.[1]?.trim()

// Read shared memory for accumulated knowledge
let sharedMemory = {}
try {
  sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
} catch {}

// Read existing component inventory if any
const existingInventory = sharedMemory.component_inventory || []
const existingPatterns = sharedMemory.accessibility_patterns || []
```

### Phase 3: Core Execution

Research is divided into 4 analysis streams. Stream 1-3 analyze the codebase, Stream 4 retrieves design intelligence from ui-ux-pro-max.

#### Stream 1: Design System Analysis

```javascript
// Use cli-explore-agent for codebase analysis
Task({
  subagent_type: "cli-explore-agent",
  run_in_background: false,
  prompt: `
## Design System Analysis
Topic: ${task.description}
Session: ${sessionFolder}

## Tasks
1. Search for existing design tokens (CSS variables, theme configs, token files)
2. Identify styling patterns (CSS-in-JS, CSS modules, utility classes, SCSS)
3. Map color palette, typography scale, spacing system
4. Find component library usage (MUI, Ant Design, custom, etc.)

## Output
Write to: ${sessionFolder}/research/design-system-analysis.json

Schema:
{
  "existing_tokens": { "colors": [], "typography": [], "spacing": [], "shadows": [] },
  "styling_approach": "css-modules | css-in-js | utility | scss | mixed",
  "component_library": { "name": "", "version": "", "usage_count": 0 },
  "custom_components": [],
  "inconsistencies": [],
  "_metadata": { "timestamp": "..." }
}
`
})
```

#### Stream 2: Component Inventory

```javascript
// Discover all UI components in the codebase
Task({
  subagent_type: "Explore",
  run_in_background: false,
  prompt: `
Find all UI components in the codebase. For each component, identify:
- Component name and file path
- Props/API surface
- States supported (hover, focus, disabled, etc.)
- Accessibility attributes (ARIA labels, roles, etc.)
- Dependencies on other components

Write findings to: ${sessionFolder}/research/component-inventory.json

Schema:
{
  "components": [{
    "name": "", "path": "", "type": "atom|molecule|organism|template",
    "props": [], "states": [], "aria_attributes": [],
    "dependencies": [], "usage_count": 0
  }],
  "patterns": {
    "naming_convention": "",
    "file_structure": "",
    "state_management": ""
  }
}
`
})
```

#### Stream 3: Accessibility Baseline

```javascript
// Assess current accessibility state
Task({
  subagent_type: "Explore",
  run_in_background: false,
  prompt: `
Perform accessibility baseline audit:
1. Check for ARIA attributes usage patterns
2. Identify keyboard navigation support
3. Check color contrast ratios (if design tokens found)
4. Find focus management patterns
5. Check semantic HTML usage

Write to: ${sessionFolder}/research/accessibility-audit.json

Schema:
{
  "wcag_level": "none|partial-A|A|partial-AA|AA",
  "aria_coverage": { "labeled": 0, "total": 0, "percentage": 0 },
  "keyboard_nav": { "supported": [], "missing": [] },
  "contrast_issues": [],
  "focus_management": { "pattern": "", "coverage": "" },
  "semantic_html": { "score": 0, "issues": [] },
  "recommendations": []
}
`
})
```

#### Stream 4: Design Intelligence (ui-ux-pro-max)

```javascript
// Retrieve design intelligence via ui-ux-pro-max skill
// Detect industry/product type from task description or session config
const industryMatch = task.description.match(/Industry:\s*([^\n]+)/)
const industry = industryMatch ? industryMatch[1].trim() : 'SaaS/科技'
const keywords = task.description.replace(/Session:.*\n?/g, '').replace(/Industry:.*\n?/g, '').split(/\s+/).slice(0, 5).join(' ')

// Detect tech stack
let detectedStack = 'html-tailwind'
try {
  const pkg = JSON.parse(Read('package.json'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  if (deps['next']) detectedStack = 'nextjs'
  else if (deps['react']) detectedStack = 'react'
  else if (deps['vue']) detectedStack = 'vue'
  else if (deps['svelte']) detectedStack = 'svelte'
  if (deps['@shadcn/ui'] || deps['shadcn-ui']) detectedStack = 'shadcn'
} catch {}

// Call ui-ux-pro-max via Skill for design system recommendations
Task({
  subagent_type: "general-purpose",
  run_in_background: false,
  description: "Retrieve design intelligence via ui-ux-pro-max skill",
  prompt: `调用 ui-ux-pro-max skill 获取设计系统推荐。

## 需求
- 产品类型/行业: ${industry}
- 关键词: ${keywords}
- 技术栈: ${detectedStack}

## 执行步骤

### 1. 生成设计系统（必须）
Skill(skill="ui-ux-pro-max", args="${industry} ${keywords} --design-system")

### 2. 补充 UX 指南
Skill(skill="ui-ux-pro-max", args="accessibility animation responsive --domain ux")

### 3. 获取技术栈指南
Skill(skill="ui-ux-pro-max", args="${keywords} --stack ${detectedStack}")

## 输出
将所有结果整合写入: ${sessionFolder}/research/design-intelligence-raw.md

包含:
- 设计系统推荐（pattern, style, colors, typography, effects, anti-patterns）
- UX 最佳实践
- 技术栈指南
- 行业反模式列表
`
})

// Read and structure the output
let designIntelligenceRaw = ''
try {
  designIntelligenceRaw = Read(`${sessionFolder}/research/design-intelligence-raw.md`)
} catch {}

const uiproAvailable = designIntelligenceRaw.length > 0

// Compile design-intelligence.json
const designIntelligence = {
  _source: uiproAvailable ? "ui-ux-pro-max-skill" : "llm-general-knowledge",
  _generated_at: new Date().toISOString(),
  industry: industry,
  detected_stack: detectedStack,
  design_system: uiproAvailable ? parseDesignSystem(designIntelligenceRaw) : {
    _fallback: true,
    note: "Install ui-ux-pro-max for data-driven recommendations",
    colors: { primary: "#1976d2", secondary: "#dc004e", background: "#ffffff" },
    typography: { heading: ["Inter", "system-ui"], body: ["Inter", "system-ui"] },
    style: "modern-minimal"
  },
  ux_guidelines: uiproAvailable ? parseUxGuidelines(designIntelligenceRaw) : [],
  stack_guidelines: uiproAvailable ? parseStackGuidelines(designIntelligenceRaw) : {},
  recommendations: {
    anti_patterns: uiproAvailable ? parseAntiPatterns(designIntelligenceRaw) : [],
    must_have: []
  }
}

Write(`${sessionFolder}/research/design-intelligence.json`, JSON.stringify(designIntelligence, null, 2))
```

### Phase 4: Validation

```javascript
// Verify all 4 research outputs exist
const requiredFiles = [
  'design-system-analysis.json',
  'component-inventory.json',
  'accessibility-audit.json',
  'design-intelligence.json'
]

const missing = requiredFiles.filter(f => {
  try { Read(`${sessionFolder}/research/${f}`); return false }
  catch { return true }
})

if (missing.length > 0) {
  // Re-run missing streams
}

// Compile research summary
const designAnalysis = JSON.parse(Read(`${sessionFolder}/research/design-system-analysis.json`))
const inventory = JSON.parse(Read(`${sessionFolder}/research/component-inventory.json`))
const a11yAudit = JSON.parse(Read(`${sessionFolder}/research/accessibility-audit.json`))

const researchSummary = {
  design_system_exists: !!designAnalysis.component_library?.name,
  styling_approach: designAnalysis.styling_approach,
  total_components: inventory.components?.length || 0,
  accessibility_level: a11yAudit.wcag_level,
  key_findings: [],
  recommendations: []
}
```

### Phase 5: Report + Shared Memory Write

```javascript
// Update shared memory
sharedMemory.component_inventory = inventory.components || []
sharedMemory.accessibility_patterns = a11yAudit.recommendations || []
sharedMemory.design_intelligence = designIntelligence || {}
sharedMemory.industry_context = { industry, detected_stack: detectedStack }
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

// Log and report
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "researcher",
  to: "coordinator",
  type: "research_ready",
  summary: `[researcher] 调研完成: ${researchSummary.total_components} 个组件, 可访问性等级 ${researchSummary.accessibility_level}, 样式方案 ${researchSummary.styling_approach}, 设计智能源 ${designIntelligence?._source || 'N/A'}`,
  ref: `${sessionFolder}/research/`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [researcher] 设计系统调研完成\n\n- 现有组件: ${researchSummary.total_components}\n- 样式方案: ${researchSummary.styling_approach}\n- 可访问性等级: ${researchSummary.accessibility_level}\n- 组件库: ${designAnalysis.component_library?.name || '无'}\n- 设计智能: ${designIntelligence?._source || 'N/A'}\n- 反模式: ${designIntelligence?.recommendations?.anti_patterns?.length || 0} 条\n\n产出目录: ${sessionFolder}/research/`,
  summary: `[researcher] 调研完成`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| 无法检测设计系统 | 报告为 "greenfield"，建议从零构建 |
| 组件盘点超时 | 报告已发现部分 + 标记未扫描区域 |
| 可访问性工具不可用 | 手动抽样检查 + 降级报告 |
