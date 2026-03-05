# Claude Skills - Workflow

## One-Liner

**Workflow Skills is a task orchestration and execution pipeline system** — Complete automation from planning to execution to verification.

## Pain Points Solved

| Pain Point | Current State | Claude Code Workflow Solution |
|------------|---------------|----------------------|
| **Manual task breakdown** | Manual decomposition, easy to miss | Automated task generation and dependency management |
| **Scattered execution state** | Tools independent, state not unified | Unified session management, TodoWrite tracking |
| **Difficult interruption recovery** | Hard to resume after interruption | Session persistence, checkpoint recovery |
| **Missing quality verification** | No quality check after completion | Built-in quality gates, verification reports |

## Skills List

| Skill | Function | Trigger |
|-------|----------|---------|
| `workflow-plan` | Unified planning skill (4-stage workflow) | `/workflow-plan` |
| `workflow-execute` | Agent-coordinated execution | `/workflow-execute` |
| `workflow-lite-planex` | Lightweight quick planning | `/workflow-lite-planex` |
| `workflow-multi-cli-plan` | Multi-CLI collaborative planning | `/workflow-multi-cli-plan` |
| `workflow-tdd-plan` | TDD workflow | `/workflow-tdd-plan` |
| `workflow-test-fix` | Test-fix workflow | `/workflow-test-fix` |
| `workflow-skill-designer` | Skill design workflow | `/workflow-skill-designer` |
| `team-arch-opt` | Architecture optimization | `/team-arch-opt` |

> **New in 7.2.1**: `team-arch-opt` skill added for architecture analysis and optimization. `workflow-lite-planex` renamed from `workflow-lite-plan`.

## Skills Details

### workflow-plan

**One-Liner**: Unified planning skill — 4-stage workflow, plan verification, interactive re-planning

**Trigger**:
```shell
/workflow-plan <task-description>
/workflow-plan-verify --session <session-id>
/workflow:replan --session <session-id> [task-id] "requirements"
```

**Features**:
- 4-stage workflow: Session discovery → Context collection → Conflict resolution → Task generation
- Plan verification (Phase 5): Read-only verification + quality gates
- Interactive re-planning (Phase 6): Boundary clarification → Impact analysis → Backup → Apply → Verify

**Mode Detection**:
```javascript
// Skill trigger determines mode
skillName === 'workflow-plan-verify' → 'verify'
skillName === 'workflow:replan' → 'replan'
default → 'plan'
```

**Core Rules**:
1. **Pure coordinator**: SKILL.md only routes and coordinates, execution details in phase files
2. **Progressive phase loading**: Read phase documents only when phase is about to execute
3. **Multi-mode routing**: Single skill handles plan/verify/replan via mode detection
4. **Task append model**: Subcommand tasks are appended, executed sequentially, then collapsed
5. **Auto-continue**: Automatically execute next pending phase after each phase completes
6. **Accumulated state**: planning-notes.md carries context across phases for N+1 decisions

**Plan Mode Data Flow**:
```plaintext
User Input (task description)
    ↓
[Convert to structured format]
    ↓ Structured description:
    ↓   GOAL: [goal]
    ↓   SCOPE: [scope]
    ↓   CONTEXT: [context]
    ↓
Phase 1: session:start --auto "structured-description"
    ↓ Output: sessionId
    ↓ Write: planning-notes.md (user intent section)
    ↓
Phase 2: context-gather --session sessionId "structured-description"
    ↓ Input: sessionId + structured description
    ↓ Output: contextPath + conflictRisk
    ↓ Update: planning-notes.md
    ↓
Phase 3: conflict-resolution [condition: conflictRisk ≥ medium]
    ↓ Input: sessionId + contextPath + conflictRisk
    ↓ Output: Modified brainstorm artifacts
    ↓ Skip if conflictRisk is none/low → go directly to Phase 4
    ↓
Phase 4: task-generate-agent --session sessionId
    ↓ Input: sessionId + planning-notes.md + context-package.json
    ↓ Output: IMPL_PLAN.md, task JSONs, TODO_LIST.md
    ↓
Plan Confirmation (User Decision Gate):
    ├─ "Verify plan quality" (recommended) → Phase 5
    ├─ "Start execution" → Skill(skill="workflow-execute")
    └─ "Review status only" → Inline show session status
```

**TodoWrite Mode**:
- **Task append** (during phase execution): Subtasks appended to coordinator's TodoWrite
- **Task collapse** (after subtask completion): Remove detailed subtasks, collapse to phase summary
- **Continuous execution**: Auto-proceed to next pending phase after completion

---

### workflow-execute

**One-Liner**: Agent-coordinated execution — Systematic task discovery, agent coordination, and state tracking

**Trigger**:
```shell
/workflow-execute
/workflow-execute --resume-session="WFS-auth"
/workflow-execute --yes
/workflow-execute -y --with-commit
```

**Features**:
- Session discovery: Identify and select active workflow sessions
- Execution strategy resolution: Extract execution model from IMPL_PLAN.md
- TodoWrite progress tracking: Real-time progress tracking throughout workflow execution
- Agent orchestration: Coordinate specialized agents with full context
- Autonomous completion: Execute all tasks until workflow completes or reaches blocking state

**Auto Mode Defaults** (`--yes` or `-y`):
- **Session selection**: Auto-select first (latest) active session
- **Completion selection**: Auto-complete session (run `/workflow:session:complete --yes`)

**Execution Process**:
```plaintext
Phase 1: Discovery
   ├─ Count active sessions
   └─ Decision:
      ├─ count=0 → Error: No active sessions
      ├─ count=1 → Auto-select session → Phase 2
      └─ count>1 → AskUserQuestion (max 4 options) → Phase 2

Phase 2: Plan Document Verification
   ├─ Check IMPL_PLAN.md exists
   ├─ Check TODO_LIST.md exists
   └─ Verify .task/ contains IMPL-*.json files

Phase 3: TodoWrite Generation
   ├─ Update session status to "active"
   ├─ Parse TODO_LIST.md for task status
   ├─ Generate TodoWrite for entire workflow
   └─ Prepare session context paths

Phase 4: Execution Strategy Selection & Task Execution
   ├─ Step 4A: Parse execution strategy from IMPL_PLAN.md
   └─ Step 4B: Lazy load execution tasks
      └─ Loop:
         ├─ Get next in_progress task from TodoWrite
         ├─ Lazy load task JSON
         ├─ Start agent with task context
         ├─ Mark task complete
         ├─ [with-commit] Commit changes based on summary
         └─ Advance to next task

Phase 5: Completion
   ├─ Update task status
   ├─ Generate summary
   └─ AskUserQuestion: Select next action
```

**Execution Models**:
| Model | Condition | Mode |
|-------|-----------|------|
| Sequential | IMPL_PLAN specifies or no clear parallelization guidance | Execute one by one |
| Parallel | IMPL_PLAN specifies parallelization opportunities | Execute independent task groups in parallel |
| Phased | IMPL_PLAN specifies phase breakdown | Execute by phase, respect phase boundaries |
| Intelligent Fallback | IMPL_PLAN lacks execution strategy details | Analyze task structure, apply intelligent defaults |

**Lazy Loading Strategy**:
- **TODO_LIST.md**: Phase 3 read (task metadata, status, dependencies)
- **IMPL_PLAN.md**: Phase 2 check existence, Phase 4A parse execution strategy
- **Task JSONs**: Lazy load — read only when task is about to execute

**Auto Commit Mode** (`--with-commit`):
```bash
# 1. Read summary from .summaries/{task-id}-summary.md
# 2. Extract files from "Files Modified" section
# 3. Commit: git add <files> && git commit -m "{type}: {title} - {summary}"
```

---

### workflow-lite-planex

**One-Liner**: Lightweight quick planning — Quick planning and execution for super simple tasks

**Trigger**:
```shell
/workflow-lite-planex <simple-task>
```

**Features**:
- For Level 1 (Lite-Lite-Lite) workflow
- Minimal planning overhead for super simple quick tasks
- Direct text input, no complex analysis

**Use Cases**:
- Small bug fixes
- Simple documentation updates
- Configuration adjustments
- Single function modifications

---

### workflow-multi-cli-plan

**One-Liner**: Multi-CLI collaborative planning — Analysis and planning with multiple CLI tools collaborating

**Trigger**:
```shell
/workflow-multi-cli-plan <task>
```

**Features**:
- Call multiple CLI tools (Gemini, Codex, Claude) for parallel analysis
- Synthesize input from multiple perspectives
- Generate comprehensive plan

**Use Cases**:
- Tasks requiring multi-perspective analysis
- Complex architecture decisions
- Cross-domain problems

---

### workflow-tdd-plan

**One-Liner**: TDD workflow — Test-driven development process

**Trigger**:
```shell
/workflow-tdd <feature-description>
```

**Features**:
- Write tests first
- Implement functionality
- Run tests to verify
- Loop until passing

**Pipeline**:
```plaintext
Plan Tests → Write Tests → [Fail] → Implement Feature → [Pass] → Complete
                    ↑___________|
```

---

### workflow-test-fix

**One-Liner**: Test-fix workflow — Diagnosis and fixing of failing tests

**Trigger**:
```shell
/workflow:test-fix <failing-tests>
```

**Features**:
- Diagnose test failure causes
- Fix code or tests
- Verify fixes
- Loop until passing

**Pipeline**:
```plaintext
Diagnose Failure → Identify Root Cause → [Code Issue] → Fix Code → Verify
                          ↑___________|
```

---

### workflow-skill-designer

**One-Liner**: Skill design workflow — Create new Claude Code Skills

**Trigger**:
```shell
/workflow:skill-designer <skill-idea>
```

**Features**:
- Requirement discovery
- Structure generation
- Phase/action generation
- Specification and template generation
- Verification and documentation

**Output Structure**:
```plaintext
.claude/skills/{skill-name}/
├── SKILL.md              # Entry file
├── phases/
│   ├── orchestrator.md   # Orchestrator
│   └── actions/          # Action files
├── specs/                # Specification documents
├── templates/            # Template files
└── README.md
```

---

### workflow-wave-plan

**One-Liner**: Wave batch planning — Parallel processing planning for batch issues

**Trigger**:
```shell
/workflow:wave-plan <issue-list>
```

**Features**:
- Batch issue analysis
- Parallelization opportunity identification
- Wave scheduling (batch by batch)
- Execution queue generation

**Wave Model**:
```plaintext
Wave 1: Issue 1-5 → Parallel planning → Parallel execution
Wave 2: Issue 6-10 → Parallel planning → Parallel execution
...
```

---

### team-arch-opt

**One-Liner**: Architecture optimization — Analyze and optimize system architecture

**Trigger**:
```shell
/team-arch-opt
/ccw "team arch opt: analyze module structure"
```

**Features**:
- Architecture analysis and assessment
- Optimization recommendations
- Team-based architecture review
- Role-spec-driven worker agents

**Use Cases**:
- Architecture health assessment
- Module dependency analysis
- Performance bottleneck identification
- Technical debt evaluation

## Related Commands

- [Claude Commands - Workflow](../commands/claude/workflow.md)
- [Claude Skills - Team Collaboration](./claude-collaboration.md)

## Best Practices

1. **Choose the right workflow**:
   - Super simple tasks → `workflow-lite-planex`
   - Complex features → `workflow-plan` → `workflow-execute`
   - TDD development → `workflow-tdd-plan`
   - Test fixes → `workflow-test-fix`
   - Skill creation → `workflow-skill-designer`

2. **Leverage auto mode**: Use `--yes` or `-y` to skip interactive confirmations, use defaults

3. **Session management**: All workflows support session persistence, can resume after interruption

4. **TodoWrite tracking**: Use TodoWrite to view workflow execution progress in real-time

5. **Lazy Loading**: Task JSONs are lazy loaded, read only during execution, improving performance
