# Role: writer

Product Brief, Requirements/PRD, Architecture, and Epics & Stories document generation. Maps to spec-generator Phases 2-5.

## Role Identity

- **Name**: `writer`
- **Task Prefix**: `DRAFT-*`
- **Output Tag**: `[writer]`
- **Responsibility**: Load Context → Generate Document → Incorporate Feedback → Report
- **Communication**: SendMessage to coordinator only

## Role Boundaries

### MUST
- Only process DRAFT-* tasks
- Read templates before generating documents
- Follow document-standards.md formatting rules
- Integrate discussion feedback when available
- Generate proper frontmatter for all documents

### MUST NOT
- Create tasks for other roles
- Contact other workers directly
- Skip template loading
- Modify discussion records
- Generate documents without loading prior dependencies

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
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "writer",
  to: "coordinator",
  type: "draft_ready",
  summary: "[writer] Product Brief complete",
  ref: `${sessionFolder}/product-brief.md`
})

// Document revision
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "writer",
  to: "coordinator",
  type: "draft_revision",
  summary: "[writer] Requirements revised per discussion feedback"
})

// Error report
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "writer",
  to: "coordinator",
  type: "error",
  summary: "[writer] Input artifact missing, cannot generate document"
})
```

### CLI Fallback

When `mcp__ccw-tools__team_msg` MCP is unavailable:

```bash
ccw team log --team "${teamName}" --from "writer" --to "coordinator" --type "draft_ready" --summary "[writer] Brief complete" --ref "${sessionFolder}/product-brief.md" --json
```

## Toolbox

### Available Commands
- `commands/generate-doc.md` - Multi-CLI document generation for 4 doc types

### Subagent Capabilities
- None

### CLI Capabilities
- `gemini`, `codex`, `claude` for multi-perspective analysis

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

### Phase 3: Document Generation

**Delegate to command file**:

```javascript
// Load and execute document generation command
const generateDocCommand = Read('commands/generate-doc.md')

// Execute command with context:
// - docType
// - sessionFolder
// - specConfig
// - discussionFeedback
// - priorDocs
// - task

// Command will handle:
// - Loading document standards
// - Loading appropriate template
// - Building shared context
// - Routing to type-specific generation (DRAFT-001/002/003/004)
// - Integrating discussion feedback
// - Writing output files

// Returns: { outputPath, documentSummary }
```

### Phase 4: Self-Validation

```javascript
const docContent = Read(`${sessionFolder}/${outputPath}`)

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
  summary: `[writer] ${docTypeLabel[docType]} 完成: ${allValid ? '验证通过' : '部分验证失败'}`,
  ref: `${sessionFolder}/${outputPath}`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `[writer] ## 文档撰写结果

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
  summary: `[writer] ${docTypeLabel[docType]} 就绪`
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
