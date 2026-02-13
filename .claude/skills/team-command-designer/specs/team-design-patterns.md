# Team Command Design Patterns

> Extracted from 5 production team commands: coordinate, plan, execute, test, review
> Extended with 10 collaboration patterns for diverse team interaction models

---

## Pattern Architecture

```
Team Design Patterns
├── Section A: Infrastructure Patterns (8)    ← HOW to build a team command
│   ├── Pattern 1: Message Bus Integration
│   ├── Pattern 2: YAML Front Matter
│   ├── Pattern 3: Task Lifecycle
│   ├── Pattern 4: Five-Phase Execution
│   ├── Pattern 5: Complexity-Adaptive Routing
│   ├── Pattern 6: Coordinator Spawn Integration
│   ├── Pattern 7: Error Handling Table
│   └── Pattern 8: Session File Structure
│
└── Section B: Collaboration Patterns (10)    ← HOW agents interact
    ├── CP-1: Linear Pipeline (线性流水线)
    ├── CP-2: Review-Fix Cycle (审查修复循环)
    ├── CP-3: Parallel Fan-out/Fan-in (并行扇出扇入)
    ├── CP-4: Consensus Gate (共识门控)
    ├── CP-5: Escalation Chain (逐级升级)
    ├── CP-6: Incremental Delivery (增量交付)
    ├── CP-7: Swarming (群策攻关)
    ├── CP-8: Consulting/Advisory (咨询顾问)
    ├── CP-9: Dual-Track (双轨并行)
    └── CP-10: Post-Mortem (复盘回顾)
```

**Section B** collaboration patterns are documented in: [collaboration-patterns.md](collaboration-patterns.md)

---

## When to Use

| Phase | Usage | Section |
|-------|-------|---------|
| Phase 0 | Understand all patterns before design | All sections |
| Phase 2 | Select applicable infrastructure + collaboration patterns | Pattern catalog |
| Phase 3 | Apply patterns during generation | Implementation details |
| Phase 4 | Verify compliance | Checklists |

---

# Section A: Infrastructure Patterns

## Pattern 1: Message Bus Integration

Every teammate must use `mcp__ccw-tools__team_msg` for persistent logging before every `SendMessage`.

### Structure

```javascript
// BEFORE every SendMessage, call:
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "<role-name>",       // planner | executor | tester | <new-role>
  to: "coordinator",
  type: "<message-type>",
  summary: "<human-readable summary>",
  ref: "<optional file path>",
  data: { /* optional structured payload */ }
})
```

### Standard Message Types

| Type | Direction | Trigger | Payload |
|------|-----------|---------|---------|
| `plan_ready` | planner -> coordinator | Plan generation complete | `{ taskCount, complexity }` |
| `plan_approved` | coordinator -> planner | Plan reviewed | `{ approved: true }` |
| `plan_revision` | planner -> coordinator | Plan modified per feedback | `{ changes }` |
| `task_unblocked` | coordinator -> any | Dependency resolved | `{ taskId }` |
| `impl_complete` | executor -> coordinator | Implementation done | `{ changedFiles, syntaxClean }` |
| `impl_progress` | any -> coordinator | Progress update | `{ batch, total }` |
| `test_result` | tester -> coordinator | Test cycle end | `{ passRate, iterations }` |
| `review_result` | tester -> coordinator | Review done | `{ verdict, findings }` |
| `fix_required` | any -> coordinator | Critical issues | `{ details[] }` |
| `error` | any -> coordinator | Blocking error | `{ message }` |
| `shutdown` | coordinator -> all | Team dissolved | `{}` |

### Collaboration Pattern Message Types

| Type | Used By | Direction | Trigger |
|------|---------|-----------|---------|
| `vote` | CP-4 Consensus | any -> coordinator | Agent casts vote on proposal |
| `escalate` | CP-5 Escalation | any -> coordinator | Agent escalates unresolved issue |
| `increment_ready` | CP-6 Incremental | executor -> coordinator | Increment delivered for validation |
| `swarm_join` | CP-7 Swarming | any -> coordinator | Agent joins swarm on blocker |
| `consult_request` | CP-8 Consulting | any -> specialist | Agent requests expert advice |
| `consult_response` | CP-8 Consulting | specialist -> requester | Expert provides advice |
| `sync_checkpoint` | CP-9 Dual-Track | any -> coordinator | Track reaches sync point |
| `retro_finding` | CP-10 Post-Mortem | any -> coordinator | Retrospective insight |

### Adding New Message Types

When designing a new role, define role-specific message types following the convention:
- `{action}_ready` - Work product ready for review
- `{action}_complete` - Work phase finished
- `{action}_progress` - Intermediate progress update

### CLI Fallback

When `mcp__ccw-tools__team_msg` MCP is unavailable, use `ccw team` CLI as equivalent fallback:

```javascript
// Fallback: Replace MCP call with Bash CLI (parameters map 1:1)
Bash(`ccw team log --team "${teamName}" --from "<role>" --to "coordinator" --type "<type>" --summary "<summary>" [--ref <path>] [--data '<json>'] --json`)
```

**Parameter mapping**: `team_msg(params)` → `ccw team <operation> --team <team> [--from/--to/--type/--summary/--ref/--data/--id/--last] [--json]`

**Coordinator** uses all 4 operations: `log`, `list`, `status`, `read`
**Teammates** primarily use: `log`

### Message Bus Section Template

```markdown
## 消息总线

每次 SendMessage **前**，必须调用 `mcp__ccw-tools__team_msg` 记录消息：

\`\`\`javascript
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "<role>", to: "coordinator", type: "<type>", summary: "<summary>" })
\`\`\`

### 支持的 Message Types

| Type | 方向 | 触发时机 | 说明 |
|------|------|----------|------|
| `<type>` | <role> → coordinator | <when> | <what> |

### CLI 回退

当 `mcp__ccw-tools__team_msg` MCP 不可用时，使用 `ccw team` CLI 作为等效回退：

\`\`\`javascript
// 回退: 将 MCP 调用替换为 Bash CLI（参数一一对应）
Bash(\`ccw team log --team "${teamName}" --from "<role>" --to "coordinator" --type "<type>" --summary "<summary>" --json\`)
\`\`\`

**参数映射**: `team_msg(params)` → `ccw team log --team <team> --from <role> --to coordinator --type <type> --summary "<text>" [--ref <path>] [--data '<json>'] [--json]`
```

---

## Pattern 2: YAML Front Matter

Every team command file must start with standardized YAML front matter.

### Structure

```yaml
---
name: <command-name>
description: Team <role> - <capabilities in Chinese>
argument-hint: ""
allowed-tools: SendMessage(*), TaskUpdate(*), TaskList(*), TaskGet(*), TodoWrite(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*), Task(*)
group: team
---
```

### Field Rules

| Field | Rule | Example |
|-------|------|---------|
| `name` | Lowercase, matches filename | `plan`, `execute`, `test` |
| `description` | `Team <role> -` prefix + Chinese capability list | `Team planner - 多角度代码探索、结构化实现规划` |
| `argument-hint` | Empty string for teammates, has hint for coordinator | `""` |
| `allowed-tools` | Start with `SendMessage(*), TaskUpdate(*), TaskList(*), TaskGet(*)` | See each role |
| `group` | Always `team` | `team` |

### Minimum Tool Set (All Teammates)

```
SendMessage(*), TaskUpdate(*), TaskList(*), TaskGet(*), TodoWrite(*), Read(*), Bash(*), Glob(*), Grep(*)
```

### Role-Specific Additional Tools

| Role Type | Additional Tools |
|-----------|-----------------|
| Read-only (reviewer, analyzer) | None extra |
| Write-capable (executor, fixer) | `Write(*), Edit(*)` |
| Agent-delegating (planner, executor) | `Task(*)` |

---

## Pattern 3: Task Lifecycle

All teammates follow the same task discovery and lifecycle pattern.

### Standard Flow

```javascript
// Step 1: Find my tasks
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('<PREFIX>-') &&  // PLAN-*, IMPL-*, TEST-*, REVIEW-*
  t.owner === '<role-name>' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0              // Not blocked
)

// Step 2: No tasks -> idle
if (myTasks.length === 0) return

// Step 3: Claim task (lowest ID first)
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Step 4: Execute work
// ... role-specific logic ...

// Step 5: Complete and loop
TaskUpdate({ taskId: task.id, status: 'completed' })

// Step 6: Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('<PREFIX>-') &&
  t.owner === '<role-name>' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)
if (nextTasks.length > 0) {
  // Continue with next task -> back to Step 3
}
```

### Task Prefix Convention

| Prefix | Role | Example |
|--------|------|---------|
| `PLAN-` | planner | `PLAN-001: Explore and plan implementation` |
| `IMPL-` | executor | `IMPL-001: Implement approved plan` |
| `TEST-` | tester | `TEST-001: Test-fix cycle` |
| `REVIEW-` | tester | `REVIEW-001: Code review and requirement verification` |
| `<NEW>-` | new role | Must be unique, uppercase, hyphen-suffixed |

### Task Chain (defined in coordinate.md)

```
PLAN-001 → IMPL-001 → TEST-001 + REVIEW-001
         ↑ blockedBy    ↑ blockedBy
```

---

## Pattern 4: Five-Phase Execution Structure

Every team command follows a consistent 5-phase internal structure.

### Standard Phases

| Phase | Purpose | Common Actions |
|-------|---------|----------------|
| Phase 1: Task Discovery | Find and claim assigned tasks | TaskList, TaskGet, TaskUpdate |
| Phase 2: Context Loading | Load necessary context for work | Read plan/config, detect framework |
| Phase 3: Core Work | Execute primary responsibility | Role-specific logic |
| Phase 4: Validation/Summary | Verify work quality | Syntax check, criteria verification |
| Phase 5: Report + Loop | Report to coordinator, check next | SendMessage, TaskUpdate, TaskList |

### Phase Structure Template

```markdown
### Phase N: <Phase Name>

\`\`\`javascript
// Implementation code
\`\`\`
```

---

## Pattern 5: Complexity-Adaptive Routing

All roles that process varying-difficulty tasks should implement adaptive routing.

### Decision Logic

```javascript
function assessComplexity(description) {
  let score = 0
  if (/refactor|architect|restructure|module|system/.test(description)) score += 2
  if (/multiple|across|cross/.test(description)) score += 2
  if (/integrate|api|database/.test(description)) score += 1
  if (/security|performance/.test(description)) score += 1
  return score >= 4 ? 'High' : score >= 2 ? 'Medium' : 'Low'
}
```

### Routing Table

| Complexity | Direct Claude | CLI Agent | Sub-agent |
|------------|---------------|-----------|-----------|
| Low | Direct execution | - | - |
| Medium | - | `cli-explore-agent` / `cli-lite-planning-agent` | - |
| High | - | CLI agent | `code-developer` / `universal-executor` |

### Sub-agent Delegation Pattern

```javascript
Task({
  subagent_type: "<agent-type>",
  run_in_background: false,
  description: "<brief description>",
  prompt: `
## Task Objective
${taskDescription}

## Output Location
${sessionFolder}/${outputFile}

## MANDATORY FIRST STEPS
1. Read: .workflow/project-tech.json (if exists)
2. Read: .workflow/project-guidelines.json (if exists)

## Expected Output
${expectedFormat}
`
})
```

---

## Pattern 6: Coordinator Spawn Integration

New teammates must be spawnable from coordinate.md using standard pattern.

### Skill Path Format (Folder-Based)

Team commands use folder-based organization with colon-separated skill paths:

```
File location:  .claude/commands/team/{team-name}/{role-name}.md
Skill path:     team:{team-name}:{role-name}

Example:
  .claude/commands/team/spec/analyst.md  →  team:spec:analyst
  .claude/commands/team/security/scanner.md  →  team:security:scanner
```

### Spawn Template

```javascript
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "<role-name>",
  prompt: `You are team "${teamName}" <ROLE>.

When you receive <PREFIX>-* tasks, call Skill(skill="team:${teamName}:<role-name>") to execute.

Current requirement: ${taskDescription}
Constraints: ${constraints}

## Message Bus (Required)
Before each SendMessage, call mcp__ccw-tools__team_msg:
mcp__ccw-tools__team_msg({ operation: "log", team: "${teamName}", from: "<role>", to: "coordinator", type: "<type>", summary: "<summary>" })

Workflow:
1. TaskList -> find <PREFIX>-* tasks assigned to you
2. Skill(skill="team:${teamName}:<role-name>") to execute
3. team_msg log + SendMessage results to coordinator
4. TaskUpdate completed -> check next task`
})
```

---

## Pattern 7: Error Handling Table

Every command ends with a standardized error handling table.

### Template

```markdown
## Error Handling

| Scenario | Resolution |
|----------|------------|
| No tasks available | Idle, wait for coordinator assignment |
| Plan/Context file not found | Notify coordinator, request location |
| Sub-agent failure | Retry once, then fallback to direct execution |
| Max iterations exceeded | Report to coordinator, suggest intervention |
| Critical issue beyond scope | SendMessage fix_required to coordinator |
```

---

## Pattern 8: Session File Structure

Roles that produce artifacts follow standard session directory patterns.

### Convention

```
.workflow/.team-<purpose>/{identifier}-{YYYY-MM-DD}/
├── <work-product-files>
├── manifest.json (if multiple outputs)
└── .task/ (if generating task files)
    ├── TASK-001.json
    └── TASK-002.json
```

---

# Section B: Collaboration Patterns

> Complete specification: [collaboration-patterns.md](collaboration-patterns.md)

## Collaboration Pattern Quick Reference

Every collaboration pattern has these standard elements:

| Element | Description |
|---------|-------------|
| **Entry Condition** | When to activate this pattern |
| **Workflow** | Step-by-step execution flow |
| **Convergence Criteria** | How the pattern terminates successfully |
| **Feedback Loop** | How information flows back to enable correction |
| **Timeout/Fallback** | What happens when the pattern doesn't converge |
| **Max Iterations** | Hard limit on cycles (where applicable) |

### Pattern Selection Guide

| Scenario | Recommended Pattern | Why |
|----------|-------------------|-----|
| Standard feature development | CP-1: Linear Pipeline | Well-defined sequential stages |
| Code review with fixes needed | CP-2: Review-Fix Cycle | Iterative improvement until quality met |
| Multi-angle analysis needed | CP-3: Fan-out/Fan-in | Parallel exploration, aggregated results |
| Critical decision (architecture, security) | CP-4: Consensus Gate | Multiple perspectives before committing |
| Agent stuck / self-repair failed | CP-5: Escalation Chain | Progressive expertise levels |
| Large feature (many files) | CP-6: Incremental Delivery | Validated increments reduce risk |
| Blocking issue stalls pipeline | CP-7: Swarming | All resources on one problem |
| Domain-specific expertise needed | CP-8: Consulting | Expert advice without role change |
| Design + Implementation parallel | CP-9: Dual-Track | Faster delivery with sync checkpoints |
| Post-completion learning | CP-10: Post-Mortem | Capture insights for future improvement |

---

## Pattern Summary Checklist

When designing a new team command, verify:

### Infrastructure Patterns
- [ ] YAML front matter with `group: team`
- [ ] Message bus section with `team_msg` logging
- [ ] CLI fallback section with `ccw team` CLI examples and parameter mapping
- [ ] Role-specific message types defined
- [ ] Task lifecycle: TaskList -> TaskGet -> TaskUpdate flow
- [ ] Unique task prefix (no collision with existing PLAN/IMPL/TEST/REVIEW, scan `team/**/*.md`)
- [ ] 5-phase execution structure
- [ ] Complexity-adaptive routing (if applicable)
- [ ] Coordinator spawn template integration
- [ ] Error handling table
- [ ] SendMessage communication to coordinator only
- [ ] Session file structure (if producing artifacts)

### Collaboration Patterns
- [ ] At least one collaboration pattern selected
- [ ] Convergence criteria defined (max iterations / quality gate / timeout)
- [ ] Feedback loop implemented (how results flow back)
- [ ] Timeout/fallback behavior specified
- [ ] Pattern-specific message types registered
- [ ] Coordinator aware of pattern (can route messages accordingly)
