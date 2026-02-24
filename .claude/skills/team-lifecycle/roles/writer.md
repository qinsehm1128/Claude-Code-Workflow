# Role: writer

Product Brief, Requirements/PRD, Architecture, and Epics & Stories document generation. Maps to spec-generator Phases 2-5.

## Role Identity

- **Name**: `writer`
- **Task Prefix**: `DRAFT-*`
- **Responsibility**: Load Context → Generate Document → Incorporate Feedback → Report
- **Communication**: SendMessage to coordinator only

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `draft_ready` | writer → coordinator | Document writing complete | With document path and type |
| `draft_revision` | writer → coordinator | Document revised and resubmitted | Describes changes made |
| `impl_progress` | writer → coordinator | Long writing progress | Multi-document stage progress |
| `error` | writer → coordinator | Unrecoverable error | Template missing, insufficient context, etc. |

## Message Bus

Before every `SendMessage`, MUST call `mcp__ccw-tools__team_msg` to log:

```javascript
// Document ready
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "writer", to: "coordinator", type: "draft_ready", summary: "Product Brief complete", ref: `${sessionFolder}/product-brief.md` })

// Document revision
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "writer", to: "coordinator", type: "draft_revision", summary: "Requirements revised per discussion feedback" })

// Error report
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "writer", to: "coordinator", type: "error", summary: "Input artifact missing, cannot generate document" })
```

### CLI Fallback

When `mcp__ccw-tools__team_msg` MCP is unavailable:

```javascript
Bash(`ccw team log --team "${teamName}" --from "writer" --to "coordinator" --type "draft_ready" --summary "Brief complete" --ref "${sessionFolder}/product-brief.md" --json`)
```

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('DRAFT-') &&
  t.owner === 'writer' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context & Discussion Loading

```javascript
// Extract session folder from task description
const sessionMatch = task.description.match(/Session:\s*(.+)/)
const sessionFolder = sessionMatch ? sessionMatch[1].trim() : ''

// Load session config
let specConfig = null
try { specConfig = JSON.parse(Read(`${sessionFolder}/spec/spec-config.json`)) } catch {}

// Determine document type from task subject
const docType = task.subject.includes('Product Brief') ? 'product-brief'
  : task.subject.includes('Requirements') || task.subject.includes('PRD') ? 'requirements'
  : task.subject.includes('Architecture') ? 'architecture'
  : task.subject.includes('Epics') ? 'epics'
  : 'unknown'

// Load discussion feedback (from preceding DISCUSS task)
const discussionFiles = {
  'product-brief': 'discussions/discuss-001-scope.md',
  'requirements': 'discussions/discuss-002-brief.md',
  'architecture': 'discussions/discuss-003-requirements.md',
  'epics': 'discussions/discuss-004-architecture.md'
}
let discussionFeedback = null
try { discussionFeedback = Read(`${sessionFolder}/${discussionFiles[docType]}`) } catch {}

// Load prior documents progressively
const priorDocs = {}
if (docType !== 'product-brief') {
  try { priorDocs.discoveryContext = Read(`${sessionFolder}/spec/discovery-context.json`) } catch {}
}
if (['requirements', 'architecture', 'epics'].includes(docType)) {
  try { priorDocs.productBrief = Read(`${sessionFolder}/spec/product-brief.md`) } catch {}
}
if (['architecture', 'epics'].includes(docType)) {
  try { priorDocs.requirementsIndex = Read(`${sessionFolder}/spec/requirements/_index.md`) } catch {}
}
if (docType === 'epics') {
  try { priorDocs.architectureIndex = Read(`${sessionFolder}/spec/architecture/_index.md`) } catch {}
}
```

### Phase 3: Document Generation (type-specific)

**前置步骤（所有类型共用）**:

```javascript
// 1. 加载格式规范
const docStandards = Read('../specs/document-standards.md')

// 2. 加载对应 template 文件（路径见 SKILL.md Shared Spec Resources）
const templateMap = {
  'product-brief': '../templates/product-brief.md',
  'requirements': '../templates/requirements-prd.md',
  'architecture': '../templates/architecture-doc.md',
  'epics': '../templates/epics-template.md'
}
const template = Read(templateMap[docType])

// 3. 构建 sharedContext
const seedAnalysis = specConfig?.seed_analysis || discoveryContext?.seed_analysis || {}
const sharedContext = `
SEED: ${specConfig?.topic || ''}
PROBLEM: ${seedAnalysis.problem_statement || ''}
TARGET USERS: ${(seedAnalysis.target_users || []).join(', ')}
DOMAIN: ${seedAnalysis.domain || ''}
CONSTRAINTS: ${(seedAnalysis.constraints || []).join(', ')}
FOCUS AREAS: ${(specConfig?.focus_areas || []).join(', ')}
${priorDocs.discoveryContext ? `
CODEBASE CONTEXT:
- Existing patterns: ${JSON.parse(priorDocs.discoveryContext).existing_patterns?.slice(0,5).join(', ') || 'none'}
- Tech stack: ${JSON.stringify(JSON.parse(priorDocs.discoveryContext).tech_stack || {})}
` : ''}`

// 4. 路由到具体类型
```

#### DRAFT-001: Product Brief

3 路并行 CLI 分析（产品视角/技术视角/用户视角），综合后生成 product-brief.md。

```javascript
if (docType === 'product-brief') {
  // === 并行 CLI 分析 ===

  // 产品视角 (Gemini)
  Bash({
    command: `ccw cli -p "PURPOSE: Product analysis for specification - identify market fit, user value, and success criteria.
Success: Clear vision, measurable goals, competitive positioning.

${sharedContext}

TASK:
- Define product vision (1-3 sentences, aspirational)
- Analyze market/competitive landscape
- Define 3-5 measurable success metrics
- Identify scope boundaries (in-scope vs out-of-scope)
- Assess user value proposition
- List assumptions that need validation

MODE: analysis
EXPECTED: Structured product analysis with: vision, goals with metrics, scope, competitive positioning, assumptions
CONSTRAINTS: Focus on 'what' and 'why', not 'how'
" --tool gemini --mode analysis`,
    run_in_background: true
  })

  // 技术视角 (Codex)
  Bash({
    command: `ccw cli -p "PURPOSE: Technical feasibility analysis for specification - assess implementation viability and constraints.
Success: Clear technical constraints, integration complexity, technology recommendations.

${sharedContext}

TASK:
- Assess technical feasibility of the core concept
- Identify technical constraints and blockers
- Evaluate integration complexity with existing systems
- Recommend technology approach (high-level)
- Identify technical risks and dependencies
- Estimate complexity: simple/moderate/complex

MODE: analysis
EXPECTED: Technical analysis with: feasibility assessment, constraints, integration complexity, tech recommendations, risks
CONSTRAINTS: Focus on feasibility and constraints, not detailed architecture
" --tool codex --mode analysis`,
    run_in_background: true
  })

  // 用户视角 (Claude)
  Bash({
    command: `ccw cli -p "PURPOSE: User experience analysis for specification - understand user journeys, pain points, and UX considerations.
Success: Clear user personas, journey maps, UX requirements.

${sharedContext}

TASK:
- Elaborate user personas with goals and frustrations
- Map primary user journey (happy path)
- Identify key pain points in current experience
- Define UX success criteria
- List accessibility and usability considerations
- Suggest interaction patterns

MODE: analysis
EXPECTED: User analysis with: personas, journey map, pain points, UX criteria, interaction recommendations
CONSTRAINTS: Focus on user needs and experience, not implementation
" --tool claude --mode analysis`,
    run_in_background: true
  })

  // STOP: Wait for all 3 CLI results

  // === 综合三视角 ===
  const synthesis = {
    convergent_themes: [],  // 三视角一致的主题
    conflicts: [],           // 视角冲突点
    product_insights: [],    // 产品视角独特洞察
    technical_insights: [],  // 技术视角独特洞察
    user_insights: []        // 用户视角独特洞察
  }

  // === 整合讨论反馈 ===
  if (discussionFeedback) {
    // 从 discuss-001-scope.md 提取共识和调整建议
    // 将讨论结论融入 synthesis
  }

  // === 按 template 生成文档 ===
  const frontmatter = `---
session_id: ${specConfig?.session_id || 'unknown'}
phase: 2
document_type: product-brief
status: draft
generated_at: ${new Date().toISOString()}
version: 1
dependencies:
  - spec-config.json
  - discovery-context.json
---`

  // 填充 template 中所有 section: Vision, Problem Statement, Target Users, Goals, Scope
  // 应用 document-standards.md 格式规范

  Write(`${sessionFolder}/spec/product-brief.md`, `${frontmatter}\n\n${filledContent}`)
  outputPath = 'spec/product-brief.md'
}
```

#### DRAFT-002: Requirements/PRD

通过 Gemini CLI 扩展需求，生成 REQ-NNN + NFR-{type}-NNN 文件。

```javascript
if (docType === 'requirements') {
  // === 需求扩展 CLI ===
  Bash({
    command: `ccw cli -p "PURPOSE: Generate detailed functional and non-functional requirements from product brief.
Success: Complete PRD with testable acceptance criteria for every requirement.

PRODUCT BRIEF CONTEXT:
${priorDocs.productBrief?.slice(0, 3000) || ''}

${sharedContext}

TASK:
- For each goal in the product brief, generate 3-7 functional requirements
- Each requirement must have:
  - Unique ID: REQ-NNN (zero-padded)
  - Clear title
  - Detailed description
  - User story: As a [persona], I want [action] so that [benefit]
  - 2-4 specific, testable acceptance criteria
- Generate non-functional requirements:
  - Performance (response times, throughput)
  - Security (authentication, authorization, data protection)
  - Scalability (user load, data volume)
  - Usability (accessibility, learnability)
- Assign MoSCoW priority: Must/Should/Could/Won't
- Output structure per requirement: ID, title, description, user_story, acceptance_criteria[], priority, traces

MODE: analysis
EXPECTED: Structured requirements with: ID, title, description, user story, acceptance criteria, priority, traceability to goals
CONSTRAINTS: Every requirement must be specific enough to estimate and test. No vague requirements.
" --tool gemini --mode analysis`,
    run_in_background: true
  })

  // Wait for CLI result

  // === 整合讨论反馈 ===
  if (discussionFeedback) {
    // 从 discuss-002-brief.md 提取需求调整建议
    // 合并新增/修改/删除需求
  }

  // === 生成 requirements/ 目录 ===
  Bash(`mkdir -p "${sessionFolder}/spec/requirements"`)

  const timestamp = new Date().toISOString()

  // Parse CLI output → funcReqs[], nfReqs[]
  const funcReqs = parseFunctionalRequirements(cliOutput)
  const nfReqs = parseNonFunctionalRequirements(cliOutput)

  // 写入独立 REQ-*.md 文件（每个功能需求一个文件）
  funcReqs.forEach(req => {
    const reqFrontmatter = `---
id: REQ-${req.id}
title: "${req.title}"
priority: ${req.priority}
status: draft
traces:
  - product-brief.md
---`
    const reqContent = `${reqFrontmatter}

# REQ-${req.id}: ${req.title}

## Description
${req.description}

## User Story
${req.user_story}

## Acceptance Criteria
${req.acceptance_criteria.map((ac, i) => `${i+1}. ${ac}`).join('\n')}
`
    Write(`${sessionFolder}/spec/requirements/REQ-${req.id}-${req.slug}.md`, reqContent)
  })

  // 写入独立 NFR-*.md 文件
  nfReqs.forEach(nfr => {
    const nfrFrontmatter = `---
id: NFR-${nfr.type}-${nfr.id}
type: ${nfr.type}
title: "${nfr.title}"
status: draft
traces:
  - product-brief.md
---`
    const nfrContent = `${nfrFrontmatter}

# NFR-${nfr.type}-${nfr.id}: ${nfr.title}

## Requirement
${nfr.requirement}

## Metric & Target
${nfr.metric} — Target: ${nfr.target}
`
    Write(`${sessionFolder}/spec/requirements/NFR-${nfr.type}-${nfr.id}-${nfr.slug}.md`, nfrContent)
  })

  // 写入 _index.md（汇总 + 链接）
  const indexFrontmatter = `---
session_id: ${specConfig?.session_id || 'unknown'}
phase: 3
document_type: requirements-index
status: draft
generated_at: ${timestamp}
version: 1
dependencies:
  - product-brief.md
---`
  const indexContent = `${indexFrontmatter}

# Requirements (PRD)

## Summary
Total: ${funcReqs.length} functional + ${nfReqs.length} non-functional requirements

## Functional Requirements
| ID | Title | Priority | Status |
|----|-------|----------|--------|
${funcReqs.map(r => `| [REQ-${r.id}](REQ-${r.id}-${r.slug}.md) | ${r.title} | ${r.priority} | draft |`).join('\n')}

## Non-Functional Requirements
| ID | Type | Title |
|----|------|-------|
${nfReqs.map(n => `| [NFR-${n.type}-${n.id}](NFR-${n.type}-${n.id}-${n.slug}.md) | ${n.type} | ${n.title} |`).join('\n')}

## MoSCoW Summary
- **Must**: ${funcReqs.filter(r => r.priority === 'Must').length}
- **Should**: ${funcReqs.filter(r => r.priority === 'Should').length}
- **Could**: ${funcReqs.filter(r => r.priority === 'Could').length}
- **Won't**: ${funcReqs.filter(r => r.priority === "Won't").length}
`
  Write(`${sessionFolder}/spec/requirements/_index.md`, indexContent)
  outputPath = 'spec/requirements/_index.md'
}
```

#### DRAFT-003: Architecture

两阶段 CLI：Gemini 架构设计 + Codex 架构挑战/审查。

```javascript
if (docType === 'architecture') {
  // === 阶段1: 架构设计 (Gemini) ===
  Bash({
    command: `ccw cli -p "PURPOSE: Generate technical architecture for the specified requirements.
Success: Complete component architecture, tech stack, and ADRs with justified decisions.

PRODUCT BRIEF (summary):
${priorDocs.productBrief?.slice(0, 3000) || ''}

REQUIREMENTS:
${priorDocs.requirementsIndex?.slice(0, 5000) || ''}

${sharedContext}

TASK:
- Define system architecture style (monolith, microservices, serverless, etc.) with justification
- Identify core components and their responsibilities
- Create component interaction diagram (Mermaid graph TD format)
- Specify technology stack: languages, frameworks, databases, infrastructure
- Generate 2-4 Architecture Decision Records (ADRs):
  - Each ADR: context, decision, 2-3 alternatives with pros/cons, consequences
  - Focus on: data storage, API design, authentication, key technical choices
- Define data model: key entities and relationships (Mermaid erDiagram format)
- Identify security architecture: auth, authorization, data protection
- List API endpoints (high-level)

MODE: analysis
EXPECTED: Complete architecture with: style justification, component diagram, tech stack table, ADRs, data model, security controls, API overview
CONSTRAINTS: Architecture must support all Must-have requirements. Prefer proven technologies.
" --tool gemini --mode analysis`,
    run_in_background: true
  })

  // Wait for Gemini result

  // === 阶段2: 架构审查 (Codex) ===
  Bash({
    command: `ccw cli -p "PURPOSE: Critical review of proposed architecture - identify weaknesses and risks.
Success: Actionable feedback with specific concerns and improvement suggestions.

PROPOSED ARCHITECTURE:
${geminiArchitectureOutput.slice(0, 5000)}

REQUIREMENTS CONTEXT:
${priorDocs.requirementsIndex?.slice(0, 2000) || ''}

TASK:
- Challenge each ADR: are the alternatives truly the best options?
- Identify scalability bottlenecks in the component design
- Assess security gaps: authentication, authorization, data protection
- Evaluate technology choices: maturity, community support, fit
- Check for over-engineering or under-engineering
- Verify architecture covers all Must-have requirements
- Rate overall architecture quality: 1-5 with justification

MODE: analysis
EXPECTED: Architecture review with: per-ADR feedback, scalability concerns, security gaps, technology risks, quality rating
CONSTRAINTS: Be genuinely critical, not just validating. Focus on actionable improvements.
" --tool codex --mode analysis`,
    run_in_background: true
  })

  // Wait for Codex result

  // === 整合讨论反馈 ===
  if (discussionFeedback) {
    // 从 discuss-003-requirements.md 提取架构相关反馈
    // 合并到架构设计中
  }

  // === 代码库集成映射（条件性） ===
  let integrationMapping = null
  if (priorDocs.discoveryContext) {
    const dc = JSON.parse(priorDocs.discoveryContext)
    if (dc.relevant_files) {
      integrationMapping = dc.relevant_files.map(f => ({
        new_component: '...',
        existing_module: f.path,
        integration_type: 'Extend|Replace|New',
        notes: f.rationale
      }))
    }
  }

  // === 生成 architecture/ 目录 ===
  Bash(`mkdir -p "${sessionFolder}/spec/architecture"`)

  const timestamp = new Date().toISOString()
  const adrs = parseADRs(geminiArchitectureOutput, codexReviewOutput)

  // 写入独立 ADR-*.md 文件
  adrs.forEach(adr => {
    const adrFrontmatter = `---
id: ADR-${adr.id}
title: "${adr.title}"
status: draft
traces:
  - ../requirements/_index.md
---`
    const adrContent = `${adrFrontmatter}

# ADR-${adr.id}: ${adr.title}

## Context
${adr.context}

## Decision
${adr.decision}

## Alternatives
${adr.alternatives.map((alt, i) => `### Option ${i+1}: ${alt.name}\n- **Pros**: ${alt.pros.join(', ')}\n- **Cons**: ${alt.cons.join(', ')}`).join('\n\n')}

## Consequences
${adr.consequences}

## Review Feedback
${adr.reviewFeedback || 'N/A'}
`
    Write(`${sessionFolder}/spec/architecture/ADR-${adr.id}-${adr.slug}.md`, adrContent)
  })

  // 写入 _index.md（含 Mermaid 组件图 + ER图 + 链接）
  const archIndexFrontmatter = `---
session_id: ${specConfig?.session_id || 'unknown'}
phase: 4
document_type: architecture-index
status: draft
generated_at: ${timestamp}
version: 1
dependencies:
  - ../product-brief.md
  - ../requirements/_index.md
---`
  // 包含: system overview, component diagram (Mermaid), tech stack table,
  // ADR links table, data model (Mermaid erDiagram), API design, security controls
  Write(`${sessionFolder}/spec/architecture/_index.md`, archIndexContent)
  outputPath = 'spec/architecture/_index.md'
}
```

#### DRAFT-004: Epics & Stories

通过 Gemini CLI 分解为 Epic，生成 EPIC-*.md 文件。

```javascript
if (docType === 'epics') {
  // === Epic 分解 CLI ===
  Bash({
    command: `ccw cli -p "PURPOSE: Decompose requirements into executable Epics and Stories for implementation planning.
Success: 3-7 Epics with prioritized Stories, dependency map, and MVP subset clearly defined.

PRODUCT BRIEF (summary):
${priorDocs.productBrief?.slice(0, 2000) || ''}

REQUIREMENTS:
${priorDocs.requirementsIndex?.slice(0, 5000) || ''}

ARCHITECTURE (summary):
${priorDocs.architectureIndex?.slice(0, 3000) || ''}

TASK:
- Group requirements into 3-7 logical Epics:
  - Each Epic: EPIC-NNN ID, title, description, priority (Must/Should/Could)
  - Group by functional domain or user journey stage
  - Tag MVP Epics (minimum set for initial release)
- For each Epic, generate 2-5 Stories:
  - Each Story: STORY-{EPIC}-NNN ID, title
  - User story format: As a [persona], I want [action] so that [benefit]
  - 2-4 acceptance criteria per story (testable)
  - Relative size estimate: S/M/L/XL
  - Trace to source requirement(s): REQ-NNN
- Create dependency map:
  - Cross-Epic dependencies (which Epics block others)
  - Mermaid graph LR format
  - Recommended execution order with rationale
- Define MVP:
  - Which Epics are in MVP
  - MVP definition of done (3-5 criteria)
  - What is explicitly deferred post-MVP

MODE: analysis
EXPECTED: Structured output with: Epic list (ID, title, priority, MVP flag), Stories per Epic (ID, user story, AC, size, trace), dependency Mermaid diagram, execution order, MVP definition
CONSTRAINTS: Every Must-have requirement must appear in at least one Story. Stories must be small enough to implement independently. Dependencies should be minimized across Epics.
" --tool gemini --mode analysis`,
    run_in_background: true
  })

  // Wait for CLI result

  // === 整合讨论反馈 ===
  if (discussionFeedback) {
    // 从 discuss-004-architecture.md 提取执行相关反馈
    // 调整 Epic 粒度、MVP 范围
  }

  // === 生成 epics/ 目录 ===
  Bash(`mkdir -p "${sessionFolder}/spec/epics"`)

  const timestamp = new Date().toISOString()
  const epicsList = parseEpics(cliOutput)

  // 写入独立 EPIC-*.md 文件（含 stories）
  epicsList.forEach(epic => {
    const epicFrontmatter = `---
id: EPIC-${epic.id}
title: "${epic.title}"
priority: ${epic.priority}
mvp: ${epic.mvp}
size: ${epic.size}
requirements:
${epic.reqs.map(r => `  - ${r}`).join('\n')}
architecture:
${epic.adrs.map(a => `  - ${a}`).join('\n')}
dependencies:
${epic.deps.map(d => `  - ${d}`).join('\n')}
status: draft
---`
    const storiesContent = epic.stories.map(s => `### ${s.id}: ${s.title}

**User Story**: ${s.user_story}
**Size**: ${s.size}
**Traces**: ${s.traces.join(', ')}

**Acceptance Criteria**:
${s.acceptance_criteria.map((ac, i) => `${i+1}. ${ac}`).join('\n')}
`).join('\n')

    const epicContent = `${epicFrontmatter}

# EPIC-${epic.id}: ${epic.title}

## Description
${epic.description}

## Stories
${storiesContent}

## Requirements
${epic.reqs.map(r => `- [${r}](../requirements/${r}.md)`).join('\n')}

## Architecture
${epic.adrs.map(a => `- [${a}](../architecture/${a}.md)`).join('\n')}
`
    Write(`${sessionFolder}/spec/epics/EPIC-${epic.id}-${epic.slug}.md`, epicContent)
  })

  // 写入 _index.md（含 Mermaid 依赖图 + MVP + 链接）
  const epicsIndexFrontmatter = `---
session_id: ${specConfig?.session_id || 'unknown'}
phase: 5
document_type: epics-index
status: draft
generated_at: ${timestamp}
version: 1
dependencies:
  - ../requirements/_index.md
  - ../architecture/_index.md
---`
  // 包含: Epic overview table (with links), dependency Mermaid diagram,
  // execution order, MVP scope, traceability matrix
  Write(`${sessionFolder}/spec/epics/_index.md`, epicsIndexContent)
  outputPath = 'spec/epics/_index.md'
}
```

### Phase 4: Self-Validation

```javascript
const validationChecks = {
  has_frontmatter: /^---\n[\s\S]+?\n---/.test(docContent),
  sections_complete: /* verify all required sections present */,
  cross_references: docContent.includes('session_id'),
  discussion_integrated: !discussionFeedback || docContent.includes('Discussion')
}

const allValid = Object.values(validationChecks).every(v => v)
```

### Phase 5: Report to Coordinator

```javascript
const docTypeLabel = {
  'product-brief': 'Product Brief',
  'requirements': 'Requirements/PRD',
  'architecture': 'Architecture Document',
  'epics': 'Epics & Stories'
}

mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "writer", to: "coordinator",
  type: "draft_ready",
  summary: `${docTypeLabel[docType]} 完成: ${allValid ? '验证通过' : '部分验证失败'}`,
  ref: `${sessionFolder}/${outputPath}`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## 文档撰写结果

**Task**: ${task.subject}
**文档类型**: ${docTypeLabel[docType]}
**验证状态**: ${allValid ? 'PASS' : 'PARTIAL'}

### 文档摘要
${documentSummary}

### 讨论反馈整合
${discussionFeedback ? '已整合前序讨论反馈' : '首次撰写'}

### 自验证结果
${Object.entries(validationChecks).map(([k, v]) => '- ' + k + ': ' + (v ? 'PASS' : 'FAIL')).join('\n')}

### 输出位置
${sessionFolder}/${outputPath}

文档已就绪，可进入讨论轮次。`,
  summary: `${docTypeLabel[docType]} 就绪`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next DRAFT task → back to Phase 1
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No DRAFT-* tasks available | Idle, wait for coordinator assignment |
| Prior document not found | Notify coordinator, request prerequisite |
| CLI analysis failure | Retry with fallback tool, then direct generation |
| Template sections incomplete | Generate best-effort, note gaps in report |
| Discussion feedback contradicts prior docs | Note conflict in document, flag for next discussion |
| Session folder missing | Notify coordinator, request session path |
| Unexpected error | Log error via team_msg, report to coordinator |
