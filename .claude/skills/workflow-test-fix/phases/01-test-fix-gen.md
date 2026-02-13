# Phase 1: Test Fix Generation (test-fix-gen)

Create test-fix workflow session with progressive test layers (L0-L3), AI code validation, and test task generation. This phase runs 5 internal steps sequentially, calling existing sub-commands via Skill().

## Objective

- Detect input mode (session ID vs description)
- Create test workflow session
- Gather test context (coverage analysis or codebase scan)
- Analyze test requirements with Gemini (L0-L3 layers)
- Generate test task JSONs via action-planning-agent

## Test Strategy Overview

This workflow generates tests using **Progressive Test Layers (L0-L3)**:

| Layer | Name | Focus |
|-------|------|-------|
| **L0** | Static Analysis | Compilation, imports, types, AI code issues |
| **L1** | Unit Tests | Function/class behavior (happy/negative/edge cases) |
| **L2** | Integration Tests | Component interactions, API contracts, failure modes |
| **L3** | E2E Tests | User journeys, critical paths (optional) |

**Key Features**:
- **AI Code Issue Detection** - Validates against common AI-generated code problems (hallucinated imports, placeholder code, mock leakage, etc.)
- **Project Type Detection** - Applies appropriate test templates (React, Node API, CLI, Library, etc.)
- **Quality Gates** - IMPL-001.3 (code validation) and IMPL-001.5 (test quality) ensure high standards

**Detailed specifications**: See `/workflow:tools:test-task-generate` for complete L0-L3 requirements and quality thresholds.

## Execution

### Step 1.0: Detect Input Mode

```
// Automatic mode detection based on input pattern
if (input.startsWith("WFS-")) {
  MODE = "session"
  // Load source session to preserve original task description
  Read(".workflow/active/[sourceSessionId]/workflow-session.json")
} else {
  MODE = "prompt"
}
```

### Step 1.1: Create Test Session

```
// Session Mode - preserve original task description
Skill(skill="workflow:session:start", args="--type test --new \"Test validation for [sourceSessionId]: [originalTaskDescription]\"")

// Prompt Mode - use user's description directly
Skill(skill="workflow:session:start", args="--type test --new \"Test generation for: [description]\"")
```

**Parse Output**:
- Extract: `SESSION_ID: WFS-test-[slug]` (store as `testSessionId`)

**Validation**:
- Session Mode: Source session `.workflow/active/[sourceSessionId]/` exists with completed IMPL tasks
- Both Modes: New test session directory created with metadata

**TodoWrite**: Mark step 1.1 completed, step 1.2 in_progress

### Step 1.2: Gather Test Context

```
// Session Mode - gather from source session
Skill(skill="workflow:tools:test-context-gather", args="--session [testSessionId]")

// Prompt Mode - gather from codebase
Skill(skill="workflow:tools:context-gather", args="--session [testSessionId] \"[task_description]\"")
```

**Input**: `testSessionId` from Step 1.1

**Parse Output**:
- Extract: context package path (store as `contextPath`)
- Pattern: `.workflow/active/[testSessionId]/.process/[test-]context-package.json`

**Validation**:
- Context package file exists and is valid JSON
- Contains coverage analysis (session mode) or codebase analysis (prompt mode)
- Test framework detected

**TodoWrite Update (tasks attached)**:
```json
[
  {"content": "Phase 1: Test Generation", "status": "in_progress"},
  {"content": "  → Create test session", "status": "completed"},
  {"content": "  → Gather test context", "status": "in_progress"},
  {"content": "    → Load source/codebase context", "status": "in_progress"},
  {"content": "    → Analyze test coverage", "status": "pending"},
  {"content": "    → Generate context package", "status": "pending"},
  {"content": "  → Test analysis (Gemini)", "status": "pending"},
  {"content": "  → Generate test tasks", "status": "pending"},
  {"content": "Phase 2: Test Cycle Execution", "status": "pending"}
]
```

**TodoWrite Update (tasks collapsed)**:
```json
[
  {"content": "Phase 1: Test Generation", "status": "in_progress"},
  {"content": "  → Create test session", "status": "completed"},
  {"content": "  → Gather test context", "status": "completed"},
  {"content": "  → Test analysis (Gemini)", "status": "pending"},
  {"content": "  → Generate test tasks", "status": "pending"},
  {"content": "Phase 2: Test Cycle Execution", "status": "pending"}
]
```

### Step 1.3: Test Generation Analysis

```
Skill(skill="workflow:tools:test-concept-enhanced", args="--session [testSessionId] --context [contextPath]")
```

**Input**:
- `testSessionId` from Step 1.1
- `contextPath` from Step 1.2

**Expected Behavior**:
- Use Gemini to analyze coverage gaps
- Detect project type and apply appropriate test templates
- Generate **multi-layered test requirements** (L0-L3)
- Scan for AI code issues
- Generate `TEST_ANALYSIS_RESULTS.md`

**Output**: `.workflow/[testSessionId]/.process/TEST_ANALYSIS_RESULTS.md`

**Validation** - TEST_ANALYSIS_RESULTS.md must include:
- Project Type Detection (with confidence)
- Coverage Assessment (current vs target)
- Test Framework & Conventions
- Multi-Layered Test Plan (L0-L3)
- AI Issue Scan Results
- Test Requirements by File (with layer annotations)
- Quality Assurance Criteria
- Success Criteria

**Note**: Detailed specifications for project types, L0-L3 layers, and AI issue detection are defined in `/workflow:tools:test-concept-enhanced`.

### Step 1.4: Generate Test Tasks

```
Skill(skill="workflow:tools:test-task-generate", args="--session [testSessionId]")
```

**Input**: `testSessionId` from Step 1.1

**Note**: test-task-generate invokes action-planning-agent to generate test-specific IMPL_PLAN.md and task JSONs based on TEST_ANALYSIS_RESULTS.md.

**Expected Output** (minimum 4 tasks):

| Task | Type | Agent | Purpose |
|------|------|-------|---------|
| IMPL-001 | test-gen | @code-developer | Test understanding & generation (L1-L3) |
| IMPL-001.3 | code-validation | @test-fix-agent | Code validation gate (L0 + AI issues) |
| IMPL-001.5 | test-quality-review | @test-fix-agent | Test quality gate |
| IMPL-002 | test-fix | @test-fix-agent | Test execution & fix cycle |

**Validation**:
- `.workflow/active/[testSessionId]/.task/IMPL-001.json` exists
- `.workflow/active/[testSessionId]/.task/IMPL-001.3-validation.json` exists
- `.workflow/active/[testSessionId]/.task/IMPL-001.5-review.json` exists
- `.workflow/active/[testSessionId]/.task/IMPL-002.json` exists
- `.workflow/active/[testSessionId]/IMPL_PLAN.md` exists
- `.workflow/active/[testSessionId]/TODO_LIST.md` exists

### Step 1.5: Return Summary

**Return to Orchestrator**:
```
Test-fix workflow created successfully!

Input: [original input]
Mode: [Session|Prompt]
Test Session: [testSessionId]

Tasks Created:
- IMPL-001: Test Understanding & Generation (@code-developer)
- IMPL-001.3: Code Validation Gate - AI Error Detection (@test-fix-agent)
- IMPL-001.5: Test Quality Gate - Static Analysis & Coverage (@test-fix-agent)
- IMPL-002: Test Execution & Fix Cycle (@test-fix-agent)

Quality Thresholds:
- Code Validation: Zero CRITICAL issues, zero compilation errors
- Minimum Coverage: 80% line, 70% branch
- Static Analysis: Zero critical anti-patterns
- Max Fix Iterations: 5

Review artifacts:
- Test plan: .workflow/[testSessionId]/IMPL_PLAN.md
- Task list: .workflow/[testSessionId]/TODO_LIST.md
- Analysis: .workflow/[testSessionId]/.process/TEST_ANALYSIS_RESULTS.md
```

**CRITICAL - Next Step**: Auto-continue to Phase 2: Test Cycle Execution.
Pass `testSessionId` to Phase 2 for test execution pipeline. Do NOT wait for user confirmation — the unified pipeline continues automatically.

## Execution Flow Diagram

```
User triggers: /workflow:test-fix-gen "Test user authentication"
  ↓
[Input Detection] → MODE: prompt
  ↓
[TodoWrite Init] Phase 1 sub-steps + Phase 2
  ↓
Step 1.1: Create Test Session
  → /workflow:session:start --type test
  → testSessionId extracted (WFS-test-user-auth)
  ↓
Step 1.2: Gather Test Context (Skill executed)
  → ATTACH 3 sub-tasks: ← ATTACHED
    - → Load codebase context
    - → Analyze test coverage
    - → Generate context package
  → Execute sub-tasks sequentially
  → COLLAPSE tasks ← COLLAPSED
  → contextPath extracted
  ↓
Step 1.3: Test Generation Analysis (Skill executed)
  → ATTACH 3 sub-tasks: ← ATTACHED
    - → Analyze coverage gaps with Gemini
    - → Detect AI code issues (L0.5)
    - → Generate L0-L3 test requirements
  → Execute sub-tasks sequentially
  → COLLAPSE tasks ← COLLAPSED
  → TEST_ANALYSIS_RESULTS.md created
  ↓
Step 1.4: Generate Test Tasks (Skill executed)
  → Single agent task (test-task-generate → action-planning-agent)
  → Agent autonomously generates:
    - IMPL-001.json (test generation)
    - IMPL-001.3-validation.json (code validation)
    - IMPL-001.5-review.json (test quality)
    - IMPL-002.json (test execution)
    - IMPL_PLAN.md
    - TODO_LIST.md
  ↓
Step 1.5: Return Summary
  → Display summary
  → Phase 1 complete
```

## Output Artifacts

### Directory Structure

```
.workflow/active/WFS-test-[session]/
├── workflow-session.json              # Session metadata
├── IMPL_PLAN.md                       # Test generation and execution strategy
├── TODO_LIST.md                       # Task checklist
├── .task/
│   ├── IMPL-001.json                  # Test understanding & generation
│   ├── IMPL-001.3-validation.json     # Code validation gate
│   ├── IMPL-001.5-review.json         # Test quality gate
│   ├── IMPL-002.json                  # Test execution & fix cycle
│   └── IMPL-*.json                    # Additional tasks (if applicable)
└── .process/
    ├── [test-]context-package.json    # Context and coverage analysis
    └── TEST_ANALYSIS_RESULTS.md       # Test requirements and strategy (L0-L3)
```

### Session Metadata

**File**: `workflow-session.json`

| Mode | Fields |
|------|--------|
| **Session** | `type: "test"`, `source_session_id: "[sourceId]"` |
| **Prompt** | `type: "test"` (no source_session_id) |

## Error Handling

| Step | Error Condition | Action |
|------|----------------|--------|
| 1.1 | Source session not found (session mode) | Return error with session ID |
| 1.1 | No completed IMPL tasks (session mode) | Return error, source incomplete |
| 1.2 | Context gathering failed | Return error, check source artifacts |
| 1.3 | Gemini analysis failed | Return error, check context package |
| 1.4 | Task generation failed | Retry once, then return error |

## Usage Examples

```bash
# Session Mode - test validation for completed implementation
/workflow:test-fix-gen WFS-user-auth-v2

# Prompt Mode - text description
/workflow:test-fix-gen "Test the user authentication API endpoints in src/auth/api.ts"

# Prompt Mode - file reference
/workflow:test-fix-gen ./docs/api-requirements.md
```

## Output

- **Variable**: `testSessionId` (WFS-test-xxx)
- **Variable**: `contextPath` (context-package.json path)
- **Files**: IMPL_PLAN.md, IMPL-*.json (4+), TODO_LIST.md, TEST_ANALYSIS_RESULTS.md
- **TodoWrite**: Mark Phase 1 completed, Phase 2 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 2: Test Cycle Execution](02-test-cycle-execute.md).
