---
name: workflow-test-fix
description: Unified test-fix pipeline combining test generation (session, context, analysis, task gen) with iterative test-cycle execution (adaptive strategy, progressive testing, CLI fallback). Triggers on "workflow:test-fix-gen", "workflow:test-cycle-execute", "test fix workflow".
allowed-tools: Skill, Task, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, Read, Write, Edit, Bash, Glob, Grep
---

# Workflow Test Fix

Unified test-fix orchestrator that combines **test planning generation** (Phase 1) with **iterative test-cycle execution** (Phase 2) into a single end-to-end pipeline. Creates test sessions with progressive L0-L3 test layers, generates test tasks, then executes them with adaptive fix cycles until pass rate >= 95% or max iterations reached.

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Workflow Test Fix Orchestrator (SKILL.md)                                │
│  → Pure coordinator: Route entry point, track progress, pass context      │
│  → Two phases: Generation (Phase 1) + Execution (Phase 2)                │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │
       ┌───────────────────────────┼────────────────────────────┐
       ↓                                                        ↓
┌──────────────────────┐                          ┌──────────────────────┐
│  Phase 1: Test Gen   │                          │  Phase 2: Test Cycle │
│  (test-fix-gen)      │─── testSessionId ───────→│  (test-cycle-execute)│
│                      │                          │                      │
│  1. Session Create   │                          │  1. Discovery        │
│  2. Context Gather   │                          │  2. Initial Execute  │
│  3. Test Analysis    │                          │  3. Fix Loop         │
│  4. Task Generation  │                          │  4. Completion       │
│  5. Summary          │                          │                      │
└──────────────────────┘                          └──────────────────────┘
     sessionId                                       pass_rate >= 95%
     contextPath                                     or max iterations
     IMPL_PLAN.md
     IMPL-*.json

Task Pipeline (generated in Phase 1, executed in Phase 2):
┌──────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌──────────────┐
│  IMPL-001    │──→│  IMPL-001.3     │──→│  IMPL-001.5     │──→│  IMPL-002    │
│  Test Gen    │   │  Code Validate  │   │  Quality Gate   │   │  Test & Fix  │
│  L1-L3       │   │  L0 + AI Issues │   │  Coverage 80%+  │   │  Max N iter  │
│@code-developer│  │ @test-fix-agent │   │ @test-fix-agent │   │@test-fix-agent│
└──────────────┘   └─────────────────┘   └─────────────────┘   └──────────────┘
```

## Key Design Principles

1. **Unified Pipeline**: Generation and execution are one continuous workflow - no manual handoff
2. **Pure Orchestrator**: SKILL.md coordinates only - delegates all execution detail to phase files
3. **Auto-Continue**: Phase 1 completes → Phase 2 starts automatically
4. **Task Attachment/Collapse**: Sub-tasks attached during phase execution, collapsed after completion
5. **Progressive Phase Loading**: Phase docs read **only** when that phase executes, not upfront
6. **Adaptive Strategy**: Fix loop auto-selects strategy (conservative/aggressive/surgical) based on iteration context
7. **Quality Gate**: Pass rate >= 95% (criticality-aware) terminates the fix loop
8. **Original Commands Preserved**: Phase files preserve full original command content and Skill() calls

## Usage

```bash
# Full pipeline: generate + execute
/workflow:test-fix-gen "Test the user authentication API"
/workflow:test-fix-gen WFS-user-auth-v2

# Execute only (resume from existing test session with generated tasks)
/workflow:test-cycle-execute
/workflow:test-cycle-execute --resume-session="WFS-test-user-auth"
/workflow:test-cycle-execute --max-iterations=15
```

## Auto Mode

When `--yes` or `-y`: Auto-select first active session, skip confirmations, auto-complete on success.

## Execution Flow

```
Entry Point Detection:
   ├─ /workflow:test-fix-gen → Full Pipeline (Phase 1 → Phase 2)
   └─ /workflow:test-cycle-execute → Execution Only (Phase 2)

Phase 1: Test Generation (test-fix-gen)
   └─ Ref: phases/01-test-fix-gen.md
      ├─ Step 1.1: Detect input mode (session | prompt)
      ├─ Step 1.2: Create test session → testSessionId
      ├─ Step 1.3: Gather test context → contextPath
      ├─ Step 1.4: Test analysis (Gemini) → TEST_ANALYSIS_RESULTS.md
      ├─ Step 1.5: Generate test tasks → IMPL_PLAN.md, IMPL-*.json, TODO_LIST.md
      └─ Output: testSessionId, 4+ task JSONs
         → Auto-continue to Phase 2

Phase 2: Test Cycle Execution (test-cycle-execute)
   └─ Ref: phases/02-test-cycle-execute.md
      ├─ Step 2.1: Discovery (load session, tasks, iteration state)
      ├─ Step 2.2: Execute initial tasks (IMPL-001 → 001.3 → 001.5 → 002)
      ├─ Step 2.3: Fix loop (if pass_rate < 95%)
      │   ├─ Select strategy: conservative/aggressive/surgical
      │   ├─ Generate fix task via @cli-planning-agent
      │   ├─ Execute fix via @test-fix-agent
      │   └─ Re-test → loop or exit
      └─ Step 2.4: Completion (summary, session archive)
         └─ Output: final pass_rate, summary
```

**Phase Reference Documents** (read on-demand when phase executes):

| Phase | Document | Purpose |
|-------|----------|---------|
| 1 | [phases/01-test-fix-gen.md](phases/01-test-fix-gen.md) | Create test session, gather context, analyze, generate tasks |
| 2 | [phases/02-test-cycle-execute.md](phases/02-test-cycle-execute.md) | Execute tasks, iterative fix cycles, completion |

## Core Rules

1. **Start Immediately**: First action is TaskCreate initialization, second action is Phase 1 (or Phase 2 for execute-only entry)
2. **No Preliminary Analysis**: Do not read files or gather context before starting the phase
3. **Parse Every Output**: Extract required data from each step output for next step
4. **Auto-Continue**: Phase 1 → Phase 2 automatically (for full pipeline entry)
5. **Track Progress**: Update TaskCreate/TaskUpdate dynamically with task attachment/collapse pattern
6. **Task Attachment Model**: Sub-tasks **attached** during phase, **collapsed** after completion
7. **DO NOT STOP**: Continuous workflow until quality gate met or max iterations reached
8. **Progressive Loading**: Read phase doc ONLY when that phase is about to execute
9. **Entry Point Routing**: `/workflow:test-fix-gen` → Phase 1 + Phase 2; `/workflow:test-cycle-execute` → Phase 2 only

## Input Processing

### test-fix-gen Entry (Full Pipeline)
```
User input → Detect type:
  ├─ Starts with "WFS-" → MODE=session, sourceSessionId=input
  ├─ Ends with ".md"    → MODE=prompt, description=Read(input)
  └─ Otherwise          → MODE=prompt, description=input
```

### test-cycle-execute Entry (Phase 2 Only)
```
Arguments → Parse flags:
  ├─ --resume-session="WFS-xxx" → sessionId=WFS-xxx
  ├─ --max-iterations=N         → maxIterations=N (default: 10)
  └─ (no args)                  → auto-discover active test session
```

## Data Flow

```
User Input (session ID | description | file path)
    ↓
[Detect Mode: session | prompt]
    ↓
Phase 1: Test Generation ─────────────────────────────────────────
    ↓ 1.1: session:start → testSessionId
    ↓ 1.2: test-context-gather/context-gather → contextPath
    ↓ 1.3: test-concept-enhanced → TEST_ANALYSIS_RESULTS.md
    ↓ 1.4: test-task-generate → IMPL_PLAN.md, IMPL-*.json, TODO_LIST.md
    ↓ 1.5: Summary with next step
    ↓
Phase 2: Test Cycle Execution ────────────────────────────────────
    ↓ 2.1: Load session + tasks + iteration state
    ↓ 2.2: Execute IMPL-001 → 001.3 → 001.5 → 002
    ↓ 2.3: Fix loop (analyze → fix → retest) until pass_rate >= 95%
    ↓ 2.4: Completion → summary → session archive
```

## Test Strategy Overview

Progressive Test Layers (L0-L3):

| Layer | Name | Focus |
|-------|------|-------|
| **L0** | Static Analysis | Compilation, imports, types, AI code issues |
| **L1** | Unit Tests | Function/class behavior (happy/negative/edge cases) |
| **L2** | Integration Tests | Component interactions, API contracts, failure modes |
| **L3** | E2E Tests | User journeys, critical paths (optional) |

**Quality Thresholds**:
- Code Validation (IMPL-001.3): Zero CRITICAL issues, zero compilation errors
- Minimum Coverage: 80% line, 70% branch
- Static Analysis (IMPL-001.5): Zero critical anti-patterns
- Pass Rate Gate: >= 95% (criticality-aware) or 100%
- Max Fix Iterations: 10 (default, adjustable)

## Strategy Engine (Phase 2)

| Strategy | Trigger | Behavior |
|----------|---------|----------|
| **Conservative** | Iteration 1-2 (default) | Single targeted fix, full validation |
| **Aggressive** | Pass rate >80% + similar failures | Batch fix related issues |
| **Surgical** | Regression detected (pass rate drops >10%) | Minimal changes, rollback focus |

Selection logic and CLI fallback chain (Gemini → Qwen → Codex) are detailed in Phase 2.

## Agent Roles

| Agent | Used In | Responsibility |
|-------|---------|---------------|
| **Orchestrator** | Both phases | Route entry, track progress, pass context |
| **@code-developer** | Phase 2 (IMPL-001) | Test generation (L1-L3) |
| **@test-fix-agent** | Phase 2 | Test execution, code fixes, criticality assignment |
| **@cli-planning-agent** | Phase 2 (fix loop) | CLI analysis, root cause extraction, fix task generation |

## TodoWrite Pattern

**Core Concept**: Dynamic task tracking with attachment/collapse for real-time visibility.

> **Implementation Note**: Phase files use `TodoWrite` syntax to describe the conceptual tracking pattern. At runtime, these are implemented via `TaskCreate/TaskUpdate/TaskList` tools from the allowed-tools list. Map `TodoWrite` examples as follows:
> - Initial list creation → `TaskCreate` for each item
> - Status changes → `TaskUpdate({ taskId, status })`
> - Sub-task attachment → `TaskCreate` + `TaskUpdate({ addBlockedBy })`
> - Sub-task collapse → `TaskUpdate({ status: "completed" })` + `TaskUpdate({ status: "deleted" })` for collapsed sub-items

### Full Pipeline (Phase 1 + Phase 2)

```json
[
  {"content": "Phase 1: Test Generation", "status": "in_progress"},
  {"content": "  → Create test session", "status": "in_progress"},
  {"content": "  → Gather test context", "status": "pending"},
  {"content": "  → Test analysis (Gemini)", "status": "pending"},
  {"content": "  → Generate test tasks", "status": "pending"},
  {"content": "Phase 2: Test Cycle Execution", "status": "pending"}
]
```

### Phase 1 Collapsed → Phase 2 Active

```json
[
  {"content": "Phase 1: Test Generation", "status": "completed"},
  {"content": "Phase 2: Test Cycle Execution", "status": "in_progress"},
  {"content": "  → Execute IMPL-001 [code-developer]", "status": "in_progress"},
  {"content": "  → Execute IMPL-001.3 [test-fix-agent]", "status": "pending"},
  {"content": "  → Execute IMPL-001.5 [test-fix-agent]", "status": "pending"},
  {"content": "  → Execute IMPL-002 [test-fix-agent]", "status": "pending"},
  {"content": "  → Fix Loop", "status": "pending"}
]
```

### Fix Loop Iterations

```json
[
  {"content": "Phase 1: Test Generation", "status": "completed"},
  {"content": "Phase 2: Test Cycle Execution", "status": "in_progress"},
  {"content": "  → Initial tasks", "status": "completed"},
  {"content": "  → Iteration 1: Initial test (pass: 70%, conservative)", "status": "completed"},
  {"content": "  → Iteration 2: Fix validation (pass: 82%, conservative)", "status": "completed"},
  {"content": "  → Iteration 3: Batch fix (pass: 89%, aggressive)", "status": "in_progress"}
]
```

## Session File Structure

```
.workflow/active/WFS-test-{session}/
├── workflow-session.json              # Session metadata
├── IMPL_PLAN.md                       # Test generation and execution strategy
├── TODO_LIST.md                       # Task checklist
├── .task/
│   ├── IMPL-001.json                  # Test understanding & generation
│   ├── IMPL-001.3-validation.json     # Code validation gate
│   ├── IMPL-001.5-review.json         # Test quality gate
│   ├── IMPL-002.json                  # Test execution & fix cycle
│   └── IMPL-fix-{N}.json             # Generated fix tasks (Phase 2 fix loop)
├── .process/
│   ├── [test-]context-package.json    # Context and coverage analysis
│   ├── TEST_ANALYSIS_RESULTS.md       # Test requirements (L0-L3)
│   ├── iteration-state.json           # Current iteration + strategy + stuck tests
│   ├── test-results.json              # Latest results (pass_rate, criticality)
│   ├── test-output.log                # Full test output
│   ├── fix-history.json               # All fix attempts
│   ├── iteration-{N}-analysis.md      # CLI analysis report
│   └── iteration-{N}-cli-output.txt
└── .summaries/
    └── iteration-summaries/
```

## Error Handling

### Phase 1 (Generation)

| Step | Error Condition | Action |
|------|----------------|--------|
| Session create | Source session not found (session mode) | Return error with session ID |
| Session create | No completed IMPL tasks (session mode) | Return error, source incomplete |
| Context gather | Context gathering failed | Return error, check source artifacts |
| Analysis | Gemini analysis failed | Return error, check context package |
| Task gen | Task generation failed | Retry once, then return error |

### Phase 2 (Execution)

| Scenario | Action |
|----------|--------|
| Test execution error | Log, retry with error context |
| CLI analysis failure | Fallback: Gemini → Qwen → Codex → manual |
| Agent execution error | Save state, retry with simplified context |
| Max iterations reached | Generate failure report, mark blocked |
| Regression detected | Rollback last fix, switch to surgical strategy |
| Stuck tests detected | Continue with alternative strategy, document |

## Commit Strategy (Phase 2)

Automatic commits at key checkpoints:
1. **After successful iteration** (pass rate increased): `test-cycle: iteration N - strategy (pass: old% → new%)`
2. **Before rollback** (regression detected): `test-cycle: rollback iteration N - regression detected`

## Completion Conditions

| Condition | Pass Rate | Action |
|-----------|-----------|--------|
| **Full Success** | 100% | Auto-complete session |
| **Partial Success** | >= 95%, all failures low criticality | Auto-approve with review note |
| **Failure** | < 95% after max iterations | Failure report, mark blocked |

## Post-Completion Expansion

After completion, ask user if they want to expand into issues (test/enhance/refactor/doc). Selected items call `/issue:new "{summary} - {dimension}"`.

## Coordinator Checklist

### Phase 1 (test-fix-gen)
- [ ] Detect input type (session ID / description / file path)
- [ ] Initialize TaskCreate before any execution
- [ ] Read Phase 1 doc, execute all 5 internal steps
- [ ] Parse testSessionId from step output, store in memory
- [ ] Verify all Phase 1 outputs (4 task JSONs, IMPL_PLAN.md, TODO_LIST.md)
- [ ] Collapse Phase 1 tasks, auto-continue to Phase 2

### Phase 2 (test-cycle-execute)
- [ ] Read Phase 2 doc
- [ ] Load session, tasks, iteration state
- [ ] Execute initial tasks sequentially
- [ ] Calculate pass rate from test-results.json
- [ ] If pass_rate < 95%: Enter fix loop
- [ ] Track iteration count, stuck tests, regression
- [ ] If pass_rate >= 95% or max iterations: Complete
- [ ] Generate completion summary
- [ ] Offer post-completion expansion

## Related Skills

**Prerequisite Skills**:
- `/workflow:plan` or `/workflow:execute` - Complete implementation (Session Mode source)
- None for Prompt Mode

**Called During Execution**:
- `/workflow:session:start` - Phase 1: Create test session
- `/workflow:tools:test-context-gather` - Phase 1 (Session Mode)
- `/workflow:tools:context-gather` - Phase 1 (Prompt Mode)
- `/workflow:tools:test-concept-enhanced` - Phase 1: Gemini analysis
- `/workflow:tools:test-task-generate` - Phase 1: Task generation
- `/workflow:session:complete` - Phase 2: Archive session

**Follow-up Skills**:
- `/workflow:status` - Review workflow state
- `/workflow:review` - Post-implementation review
- `/issue:new` - Create follow-up issues
