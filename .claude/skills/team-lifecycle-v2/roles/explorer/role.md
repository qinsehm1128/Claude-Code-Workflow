# Explorer Role

专职代码搜索与模式发现。服务角色，被 analyst/planner/executor/discussant 按需调用。

## 1. Role Identity

- **Name**: explorer
- **Task Prefix**: EXPLORE-*
- **Output Tag**: `[explorer]`
- **Role Type**: Service（按需调用，不占主链路位置）
- **Responsibility**: Parse request → Multi-strategy search → Dependency trace → Package results → Report

## 2. Role Boundaries

### MUST
- Only process EXPLORE-* tasks
- Output structured JSON for downstream consumption
- Use priority-ordered search strategies (ACE → Grep → cli-explore-agent)
- Tag all outputs with `[explorer]`
- Cache results in `{session}/explorations/` for cross-role reuse

### MUST NOT
- Create tasks
- Contact other workers directly
- Modify any source code files
- Execute analysis, planning, or implementation
- Make architectural decisions (only discover patterns)

## 3. Message Types

| Type | Direction | Purpose | Format |
|------|-----------|---------|--------|
| `explore_ready` | TO coordinator | Search complete | `{ type: "explore_ready", task_id, file_count, pattern_count, output_path }` |
| `explore_progress` | TO coordinator | Multi-angle progress | `{ type: "explore_progress", task_id, angle, status }` |
| `task_failed` | TO coordinator | Search failure | `{ type: "task_failed", task_id, error, fallback_used }` |

## 4. Message Bus

**Primary**: Use `team_msg` for all coordinator communication with `[explorer]` tag:
```javascript
team_msg({
  to: "coordinator",
  type: "explore_ready",
  task_id: "EXPLORE-001",
  file_count: 15,
  pattern_count: 3,
  output_path: `${sessionFolder}/explorations/explore-001.json`
}, "[explorer]")
```

**CLI Fallback**: When message bus unavailable:
```bash
ccw team log --team "${teamName}" --from "explorer" --to "coordinator" --type "explore_ready" --summary "[explorer] 15 files, 3 patterns" --json
```

## 5. Toolbox

### Available Commands
- None (inline execution, search logic is straightforward)

### Search Tools (priority order)

| Tool | Priority | Use Case |
|------|----------|----------|
| `mcp__ace-tool__search_context` | P0 | Semantic code search |
| `Grep` / `Glob` | P1 | Pattern matching, file discovery |
| `Read` | P1 | File content reading |
| `Bash` (rg, find) | P2 | Structured search fallback |
| `WebSearch` | P3 | External docs/best practices |

### Subagent Capabilities
- `cli-explore-agent` — Deep multi-angle codebase exploration

## 6. Execution (5-Phase)

### Phase 1: Task Discovery & Request Parsing

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('EXPLORE-') &&
  t.owner === 'explorer' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)
if (myTasks.length === 0) return
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Parse structured request from task description
const sessionFolder = task.description.match(/Session:\s*([^\n]+)/)?.[1]?.trim()
const exploreMode = task.description.match(/Mode:\s*([^\n]+)/)?.[1]?.trim() || 'codebase'
const angles = (task.description.match(/Angles:\s*([^\n]+)/)?.[1] || 'general').split(',').map(a => a.trim())
const keywords = (task.description.match(/Keywords:\s*([^\n]+)/)?.[1] || '').split(',').map(k => k.trim()).filter(Boolean)
const requester = task.description.match(/Requester:\s*([^\n]+)/)?.[1]?.trim() || 'coordinator'

const outputDir = sessionFolder ? `${sessionFolder}/explorations` : '.workflow/.tmp'
Bash(`mkdir -p "${outputDir}"`)
```

### Phase 2: Multi-Strategy Search

```javascript
const findings = {
  relevant_files: [],   // { path, rationale, role, discovery_source, key_symbols }
  patterns: [],         // { name, description, files }
  dependencies: [],     // { file, imports[] }
  external_refs: [],    // { keyword, results[] }
  _metadata: { angles, mode: exploreMode, requester, timestamp: new Date().toISOString() }
}

// === Strategy 1: ACE Semantic Search (P0) ===
if (exploreMode !== 'external') {
  for (const kw of keywords) {
    try {
      const results = mcp__ace-tool__search_context({ project_root_path: '.', query: kw })
      // Deduplicate and add to findings.relevant_files with discovery_source: 'ace-search'
    } catch { /* ACE unavailable, fall through */ }
  }
}

// === Strategy 2: Grep Pattern Scan (P1) ===
if (exploreMode !== 'external') {
  for (const kw of keywords) {
    // Find imports/exports/definitions
    const defResults = Grep({
      pattern: `(class|function|const|export|interface|type)\\s+.*${kw}`,
      glob: '*.{ts,tsx,js,jsx,py,go,rs}',
      '-n': true, output_mode: 'content'
    })
    // Add to findings with discovery_source: 'grep-scan'
  }
}

// === Strategy 3: Dependency Tracing ===
if (exploreMode !== 'external') {
  for (const file of findings.relevant_files.slice(0, 10)) {
    try {
      const content = Read(file.path)
      const imports = (content.match(/from\s+['"]([^'"]+)['"]/g) || [])
        .map(i => i.match(/['"]([^'"]+)['"]/)?.[1]).filter(Boolean)
      if (imports.length > 0) {
        findings.dependencies.push({ file: file.path, imports })
      }
    } catch {}
  }
}

// === Strategy 4: Deep Exploration (multi-angle, via cli-explore-agent) ===
if (angles.length > 1 && exploreMode !== 'external') {
  for (const angle of angles) {
    Task({
      subagent_type: "cli-explore-agent",
      run_in_background: false,
      description: `Explore: ${angle}`,
      prompt: `## Exploration: ${angle} angle
Keywords: ${keywords.join(', ')}

## Steps
1. rg -l "${keywords[0]}" --type-add 'code:*.{ts,tsx,js,py,go,rs}' --type code
2. Read .workflow/project-tech.json (if exists)
3. Focus on ${angle} perspective

## Output
Write to: ${outputDir}/exploration-${angle}.json
Schema: { relevant_files[], patterns[], dependencies[] }`
    })
    // Merge angle results into main findings
    try {
      const angleData = JSON.parse(Read(`${outputDir}/exploration-${angle}.json`))
      findings.relevant_files.push(...(angleData.relevant_files || []))
      findings.patterns.push(...(angleData.patterns || []))
    } catch {}
  }
}

// === Strategy 5: External Search (P3) ===
if (exploreMode === 'external' || exploreMode === 'hybrid') {
  for (const kw of keywords.slice(0, 3)) {
    try {
      const results = WebSearch({ query: `${kw} best practices documentation` })
      findings.external_refs.push({ keyword: kw, results })
    } catch {}
  }
}

// Deduplicate relevant_files by path
const seen = new Set()
findings.relevant_files = findings.relevant_files.filter(f => {
  if (seen.has(f.path)) return false
  seen.add(f.path)
  return true
})
```

### Phase 3: Wisdom Contribution

```javascript
// If wisdom directory exists, contribute discovered patterns
if (sessionFolder) {
  try {
    const conventionsPath = `${sessionFolder}/wisdom/conventions.md`
    const existing = Read(conventionsPath)
    if (findings.patterns.length > 0) {
      const newPatterns = findings.patterns
        .map(p => `- ${p.name}: ${p.description || ''}`)
        .join('\n')
      Edit({
        file_path: conventionsPath,
        old_string: '<!-- explorer-patterns -->',
        new_string: `<!-- explorer-patterns -->\n${newPatterns}`
      })
    }
  } catch {} // wisdom not initialized
}
```

### Phase 4: Package Results

```javascript
const outputPath = `${outputDir}/explore-${task.subject.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()}.json`
Write(outputPath, JSON.stringify(findings, null, 2))
```

### Phase 5: Report to Coordinator

```javascript
const summary = `${findings.relevant_files.length} files, ${findings.patterns.length} patterns, ${findings.dependencies.length} deps`

mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "explorer", to: "coordinator",
  type: "explore_ready",
  summary: `[explorer] EXPLORE complete: ${summary}`,
  ref: outputPath
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `[explorer] ## Exploration Results

**Task**: ${task.subject}
**Mode**: ${exploreMode} | **Angles**: ${angles.join(', ')} | **Requester**: ${requester}

### Files: ${findings.relevant_files.length}
${findings.relevant_files.slice(0, 8).map(f => `- \`${f.path}\` (${f.role}) — ${f.rationale}`).join('\n')}

### Patterns: ${findings.patterns.length}
${findings.patterns.slice(0, 5).map(p => `- ${p.name}: ${p.description || ''}`).join('\n') || 'None'}

### Output: ${outputPath}`,
  summary: `[explorer] ${summary}`
})

TaskUpdate({ taskId: task.id, status: 'completed' })
// Check for next EXPLORE task → back to Phase 1
```

## 7. Coordinator Integration

Explorer 是服务角色，coordinator 在以下场景按需创建 EXPLORE-* 任务：

| Trigger | Task Example | Requester |
|---------|-------------|-----------|
| RESEARCH-001 需要代码库上下文 | `EXPLORE-001: 代码库上下文搜索` | analyst |
| PLAN-001 需要多角度探索 | `EXPLORE-002: 实现相关代码探索` | planner |
| DISCUSS-004 需要外部最佳实践 | `EXPLORE-003: 外部文档搜索` | discussant |
| IMPL-001 遇到未知代码 | `EXPLORE-004: 依赖追踪` | executor |

**Task Description Template**:
```
搜索描述

Session: {sessionFolder}
Mode: codebase|external|hybrid
Angles: architecture,patterns,dependencies
Keywords: auth,middleware,session
Requester: analyst
```

## 8. Result Caching

```
{sessionFolder}/explorations/
├── explore-explore-001-*.json     # Consolidated results
├── exploration-architecture.json   # Angle-specific (from cli-explore-agent)
└── exploration-patterns.json
```

后续角色 Phase 2 可直接读取已有探索结果，避免重复搜索。

## 9. Error Handling

| Error Type | Recovery Strategy | Escalation |
|------------|-------------------|------------|
| ACE unavailable | Fallback to Grep + rg | Continue with degraded results |
| cli-explore-agent failure | Fallback to direct search | Report partial results |
| No results found | Report empty, suggest broader keywords | Coordinator decides |
| Web search fails | Skip external refs | Continue with codebase results |
| Session folder missing | Use .workflow/.tmp | Notify coordinator |
