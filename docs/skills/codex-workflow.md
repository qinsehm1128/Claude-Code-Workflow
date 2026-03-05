# Codex Skills - Workflow Category

## One-Liner

**Workflow Codex Skills is a collaborative analysis and parallel development workflow system** — enabling efficient team collaboration through documented discussions, multi-perspective analysis, and collaborative planning.

## Pain Points Solved

| Pain Point | Current State | Codex Skills Solution |
| --- | --- | --- |
| **Discussion process lost** | Only conclusions saved from discussions | Documented discussion timeline |
| **Repeated exploration** | Codebase re-explored for each analysis | Shared discovery board |
| **Blind debugging** | No hypothesis verification mechanism | Hypothesis-driven debugging |
| **Fragmented collaboration** | Roles work independently | Multi-perspective parallel analysis |

## Skills List

| Skill | Function | Trigger |
| --- | --- | --- |
| `analyze-with-file` | Collaborative analysis (4 perspectives) | `/analyze-with-file TOPIC="..."` |
| `brainstorm-with-file` | Brainstorming (4 perspectives) | `/brainstorm-with-file TOPIC="..."` |
| `debug-with-file` | Hypothesis-driven debugging | `/debug-with-file BUG="..."` |
| `collaborative-plan-with-file` | Collaborative planning | `/collaborative-plan-with-file <task>` |
| `unified-execute-with-file` | Universal execution engine | `/unified-execute-with-file <session>` |
| `roadmap-with-file` | Requirement roadmap | `/roadmap-with-file <requirements>` |
| `review-cycle` | Review cycle | `/review-cycle <target>` |
| `workflow-test-fix-cycle` | Test-fix workflow | `/workflow-test-fix-cycle <tests>` |

## Skills Details

### analyze-with-file

**One-Liner**: Collaborative analysis — interactive analysis with documented discussions, inline exploration, and evolving understanding

**Core Workflow**:
```
Topic → Explore → Discuss → Document → Refine → Conclude → (Optional) Quick Execute
```

**Key Features**:
- **Documented discussion timeline**: Capture understanding evolution across all phases
- **Decision logging at every key point**: Force recording of key findings, direction changes, trade-offs
- **Multi-perspective analysis**: Support up to 4 analysis perspectives (serial, inline)
- **Interactive discussion**: Multi-round Q&A, user feedback and direction adjustment
- **Quick execute**: Direct conversion of conclusions to executable tasks

**Decision Recording Protocol**:
| Trigger | Content to Record | Target Section |
|------|-------------------|----------------|
| **Direction choice** | Choice, reason, alternatives | `#### Decision Log` |
| **Key findings** | Finding, impact scope, confidence | `#### Key Findings` |
| **Assumption change** | Old assumption → New understanding, reason, impact | `#### Corrected Assumptions` |
| **User feedback** | User's raw input, adoption/adjustment reason | `#### User Input` |

**Analysis Perspectives** (serial, inline):
| Perspective | CLI Tool | Role | Focus Areas |
|------------|----------|------|-------------|
| Product | gemini | Product Manager | Market fit, user value, business viability |
| Technical | codex | Tech Lead | Feasibility, tech debt, performance, security |
| Quality | claude | QA Lead | Completeness, testability, consistency |
| Risk | gemini | Risk Analyst | Risk identification, dependencies, failure modes |

**Session Folder Structure**:
```
{projectRoot}/.workflow/.analyze/ANL-{slug}-{date}/
├── discussion.md               # Discussion timeline + understanding evolution
├── explorations/               # Codebase exploration reports
│   ├── exploration-summary.md
│   ├── relevant-files.md
│   └── patterns.md
└── conclusion.md               # Final conclusion + Quick execute task
```

**Execution Flow**:
```
Phase 1: Topic Analysis
    ├─ Detect depth mode (quick/standard/deep)
    ├─ Session detection: {projectRoot}/.workflow/.analyze/ANL-{slug}-{date}/
    └─ Output: sessionId, depth, continueMode

Phase 2: Exploration
    ├─ Detect context: discovery-context.json, prep-package.json
    ├─ Codebase exploration: Glob + Read + Grep tools
    ├─ Write: explorations/exploration-summary.md
    └─ Output: explorationResults

Phase 3: Discussion (Multiple Rounds)
    ├─ Initialize: discussion.md (Section: Exploration Summary)
    ├─ Round 1: Generate initial analysis based on explorationResults
    ├─ Iterate: User feedback → Refine understanding → Update discussion.md
    └─ Per-round update: Decision Log, Key Findings, Current Understanding

Phase 4: Refinement
    ├─ Merge: explorations/ content merged into discussion.md
    ├─ Check: All key points recorded
    └─ Output: refinedDiscussion

Phase 5: Conclusion
    ├─ Generate: conclusion.md (Executive Summary, Findings, Recommendations)
    └─ Quick Execute (optional): Generate executable tasks

Phase 6: (Optional) Quick Execute
    ├─ Convert conclusions to: task JSON or plan file
    └─ Invoke: workflow-execute or direct execution
```

**Depth Modes**:
| Mode | Exploration Scope | Analysis Rounds |
|------|-------------------|-----------------|
| quick | Basic search, 10 files | 1 round |
| standard | Standard exploration, 30 files | 2-3 rounds |
| deep | Deep exploration, 100+ files | 3-5 rounds |

---

### brainstorm-with-file

**One-Liner**: Multi-perspective brainstorming — 4 perspectives (Product, Technical, Risk, User) parallel analysis

**Key Features**:
- 4-perspective parallel analysis: Product, Technical, Risk, User
- Consistency scoring and convergence determination
- Feasibility recommendations and action items

**Perspectives**:
| Perspective | Focus Areas |
|-------------|-------------|
| **Product** | Market fit, user value, business viability |
| **Technical** | Feasibility, tech debt, performance, security |
| **Risk** | Risk identification, dependencies, failure modes |
| **User** | Usability, user experience, adoption barriers |

**Output Format**:
```
## Consensus Determination
Status: <consensus_reached | consensus_blocked>
Average Rating: <N>/5
Convergence Points: <list>
Divergence Points: <list>

## Feasibility Recommendation
Recommendation: <proceed | proceed-with-caution | revise | reject>
Reasoning: <reasoning>
Action Items: <action items>
```

---

### debug-with-file

**One-Liner**: Hypothesis-driven debugging — documented exploration, understanding evolution, analysis-assisted correction

**Core Workflow**:
```
Explore → Document → Log → Analyze → Correct Understanding → Fix → Verify
```

**Key Enhancements**:
- **understanding.md**: Timeline of exploration and learning
- **Analysis-assisted correction**: Verify and correct assumptions
- **Consolidation**: Simplify proven-misunderstood concepts to avoid confusion
- **Learning preservation**: Retain insights from failed attempts

**Session Folder Structure**:
```
{projectRoot}/.workflow/.debug/DBG-{slug}-{date}/
├── debug.log           # NDJSON log (execution evidence)
├── understanding.md    # Exploration timeline + consolidated understanding
└── hypotheses.json     # Hypothesis history (with determination)
```

**Modes**:
| Mode | Trigger Condition | Behavior |
|------|-------------------|----------|
| **Explore** | No session or no understanding.md | Locate error source, record initial understanding, generate hypotheses, add logs |
| **Continue** | Session exists but no debug.log content | Wait for user reproduction |
| **Analyze** | debug.log has content | Parse logs, evaluate hypotheses, update understanding |

**Hypothesis Generation**:
Generate targeted hypotheses based on error patterns:

| Error Pattern | Hypothesis Type |
|---------------|-----------------|
| not found / missing / undefined | data_mismatch |
| 0 / empty / zero / registered | logic_error |
| timeout / connection / sync | integration_issue |
| type / format / parse | type_mismatch |

**NDJSON Log Format**:
```json
{"sid":"DBG-xxx-2025-01-21","hid":"H1","loc":"file.py:func:42","msg":"Check dict keys","data":{"keys":["a","b"],"target":"c","found":false},"ts":1734567890123}
```

**Understanding Document Template**:
```markdown
# Understanding Document

**Session ID**: DBG-xxx-2025-01-21
**Bug Description**: [original description]
**Started**: 2025-01-21T10:00:00+08:00

---

## Exploration Timeline

### Iteration 1 - Initial Exploration (2025-01-21 10:00)

#### Current Understanding
...

#### Evidence from Code Search
...

#### Hypotheses Generated
...

---

## Current Consolidated Understanding

### What We Know
- [valid understanding points]

### What Was Disproven
- ~~[disproven assumptions]~~

### Current Investigation Focus
[current focus]
```

---

### collaborative-plan-with-file

**One-Liner**: Collaborative planning — multi-agent collaborative planning (alternative to team-planex)

**Features**:
- Multi-agent collaborative planning
- planner and executor work in parallel
- Intermediate artifact files pass solution

**Wave Pipeline** (per-issue beat):
```
Issue 1:  planner plans solution → write intermediate artifact → conflict check → create EXEC-* → issue_ready
                ↓ (executor starts immediately)
Issue 2:  planner plans solution → write intermediate artifact → conflict check → create EXEC-* → issue_ready
                ↓ (executor consumes in parallel)
Issue N:  ...
Final:    planner sends all_planned → executor completes remaining EXEC-* → finish
```

---

### unified-execute-with-file

**One-Liner**: Universal execution engine — alternative to workflow-execute

**Features**:
- Universal execution engine
- Support multiple task types
- Automatic session recovery

**Session Discovery**:
1. Count active sessions in .workflow/active/
2. Decision:
   - count=0 → Error: No active session
   - count=1 → Auto-select session
   - count>1 → AskUserQuestion (max 4 options)

---

### roadmap-with-file

**One-Liner**: Requirement roadmap planning

**Features**:
- Requirement to roadmap planning
- Priority sorting
- Milestone definition

**Output Structure**:
```
.workflow/.roadmap/{session-id}/
├── roadmap.md                 # Roadmap document
├── milestones.md              # Milestone definitions
└── priorities.json            # Priority sorting
```

---

### review-cycle

**One-Liner**: Review cycle (Codex version)

**Features**:
- Code review
- Fix loop
- Verify fix effectiveness

**Loop Flow**:
```
Review code → Find issues → [Has issues] → Fix code → Verify → [Still has issues] → Fix code
                          ↑______________|
```

---

### workflow-test-fix-cycle

**One-Liner**: Test-fix workflow

**Features**:
- Diagnose test failure causes
- Fix code or tests
- Verify fixes
- Loop until passing

**Flow**:
```
Diagnose failure → Identify root cause → [Code issue] → Fix code → Verify
                          ↑___________|
```

## Related Commands

- [Codex Skills - Lifecycle](./codex-lifecycle.md)
- [Codex Skills - Specialized](./codex-specialized.md)
- [Claude Skills - Workflow](./claude-workflow.md)

## Best Practices

1. **Choose the right workflow**:
   - Collaborative analysis → `analyze-with-file`
   - Brainstorming → `brainstorm-with-file`
   - Debugging → `debug-with-file`
   - Planning → `collaborative-plan-with-file`

2. **Documented discussions**: Utilize documented discussion timeline to capture understanding evolution

3. **Decision logging**: Record decisions at key points to preserve decision history

4. **Hypothesis-driven debugging**: Use hypothesis-driven debugging to systematically solve problems

5. **Multi-perspective analysis**: Leverage multi-perspective parallel analysis for comprehensive understanding

## Usage Examples

```bash
# Collaborative analysis
/analyze-with-file TOPIC="How to optimize database queries?"

# Deep analysis
/analyze-with-file TOPIC="Architecture for microservices" --depth=deep

# Brainstorming
/brainstorm-with-file TOPIC="Design payment system"

# Debugging
/debug-with-file BUG="System crashes intermittently"

# Collaborative planning
/collaborative-plan-with-file "Add user notifications"

# Test-fix
/workflow-test-fix-cycle "Unit tests failing"
```
