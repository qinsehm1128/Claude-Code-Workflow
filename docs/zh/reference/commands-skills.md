# CCW Commands & Skills Reference Manual

> Generated: 2026-03-08 | Project: Claude Code Workspace (CCW)

This reference manual provides quick lookup for all slash commands and skills in the CCW system.

---

## Table of Contents

- [Section 1: Slash Commands](#section-1-slash-commands)
  - [Core](#core)
  - [DDD (Document-Driven Development)](#ddd-document-driven-development)
  - [Issue](#issue)
  - [IDAW (Iterative Development Automation Workflow)](#idaw-iterative-development-automation-workflow)
  - [Workflow](#workflow)
  - [Memory](#memory)
  - [CLI](#cli)
- [Section 2: Skills](#section-2-skills)
  - [Workflow Skills](#workflow-skills)
  - [Team Skills](#team-skills)
  - [Utility Skills](#utility-skills)
- [Appendix A: Quick Reference Table](#appendix-a-quick-reference-table)
- [Appendix B: Command Chain Examples](#appendix-b-command-chain-examples)

---

## Section 1: Slash Commands

### Core

#### `/ccw`

| Field | Description |
|-------|-------------|
| **Who** | Developer starting any task |
| **When** | Entry point for workflow orchestration |
| **What** | Main workflow orchestrator that analyzes intent, dispatches to appropriate skill chain. Example: `/ccw "implement user authentication"` |
| **How** | Parses intent -> Selects skill chain -> Executes orchestrator |
| **Output** | Delegates to workflow-plan, issue-manage, or other skills |
| **Done** | Appropriate skill completes execution |
| **Failure & Recovery** | Fallback to manual skill selection if intent unclear |
| **Impact & Boundary** | Project-wide orchestration entry point |

#### `/ccw-coordinator`

| Field | Description |
|-------|-------------|
| **Who** | System needing command orchestration |
| **When** | Multi-command coordination required |
| **What** | Command orchestration tool that analyzes requirements and dispatches commands. Example: `/ccw-coordinator "review and fix auth module"` |
| **How** | Requirement analysis -> Command selection -> Sequential execution |
| **Output** | Coordinated command execution results |
| **Done** | All dispatched commands complete |
| **Failure & Recovery** | Partial results preserved, user notified of failures |
| **Impact & Boundary** | Cross-command coordination |

#### `/flow-create`

| Field | Description |
|-------|-------------|
| **Who** | Developer creating reusable workflow templates |
| **When** | Need to document and share workflow patterns |
| **What** | Flow template generator for creating reusable command chains. Example: `/flow-create "auth-feature-flow"` |
| **How** | Template definition -> Parameter extraction -> Flow file generation |
| **Output** | Flow template file in `.claude/flows/` |
| **Done** | Template file created and validated |
| **Failure & Recovery** | Validation errors show specific issues |
| **Impact & Boundary** | Workflow template creation only |

---

### DDD (Document-Driven Development)

#### `/ddd:scan`

| Field | Description |
|-------|-------------|
| **Who** | Developer onboarding to existing project without specs |
| **When** | Starting doc-driven workflow on legacy codebase |
| **What** | Scans codebase to build doc-index by reverse-engineering structure. Example: `/ddd:scan -y "existing project"` |
| **How** | Framework detection -> Component discovery -> Feature inference -> Requirement extraction -> doc-index.json |
| **Output** | `.workflow/.doc-index/doc-index.json` + feature-maps/ + tech-registry/ |
| **Done** | doc-index.json created with components, features, IREQ entries |
| **Failure & Recovery** | Graceful degradation if DeepWiki unavailable |
| **Impact & Boundary** | Code-first entry point, can upgrade to spec-first later |

#### `/ddd:index-build`

| Field | Description |
|-------|-------------|
| **Who** | Developer with existing spec-generator outputs |
| **When** | Building index from REQ, ADR, EPIC documents |
| **What** | Builds doc-index from spec outputs and maps entities to code. Example: `/ddd:index-build --spec SPEC-auth-2026-03-08` |
| **How** | Parse specs -> Codebase mapping via CLI -> Feature grouping -> doc-index.json |
| **Output** | `.workflow/.doc-index/doc-index.json` with spec-first traceability |
| **Done** | All spec entities linked to code components |
| **Failure & Recovery** | Orphan components flagged for review |
| **Impact & Boundary** | Spec-first entry point, merges with existing code-first index |

#### `/ddd:plan`

| Field | Description |
|-------|-------------|
| **Who** | Developer planning document-driven task |
| **When** | Before any development task in DDD workflow |
| **What** | Queries doc-index, explores codebase with doc-aware angles, produces plan.json. Example: `/ddd:plan -y "add rate limiting"` |
| **How** | Doc-index query -> Guided exploration -> Clarification -> Task planning -> Handoff |
| **Output** | `.workflow/.doc-index/planning/{session}/plan.json` + TASK-*.json |
| **Done** | Plan with doc_context traceability generated |
| **Failure & Recovery** | Schema version mismatch warns but continues |
| **Impact & Boundary** | Requires existing doc-index.json |

#### `/ddd:execute`

| Field | Description |
|-------|-------------|
| **Who** | Developer executing document-aware tasks |
| **When** | After /ddd:plan produces plan.json |
| **What** | Document-aware execution engine with doc-context loading. Example: `/ddd:execute --in-memory` |
| **How** | Load plan -> Read doc-context -> Execute task -> Update doc-index |
| **Output** | Code changes + updated doc-index traceability |
| **Done** | All tasks executed, doc-index updated |
| **Failure & Recovery** | Task failures logged, recovery options presented |
| **Impact & Boundary** | Requires plan.json from /ddd:plan |

#### `/ddd:doc-generate`

| Field | Description |
|-------|-------------|
| **Who** | Developer regenerating documentation |
| **When** | After doc-index built or needs refresh |
| **What** | Generates full document tree from doc-index.json. Example: `/ddd:doc-generate --force --layer all` |
| **How** | Layer 3 (components) -> Layer 2 (features) -> Layer 1 (indexes) |
| **Output** | tech-registry/*.md, feature-maps/*.md, README.md, ARCHITECTURE.md |
| **Done** | All layers generated, SCHEMA.md created |
| **Failure & Recovery** | Existing docs warning, --force to overwrite |
| **Impact & Boundary** | Read-only from doc-index, generates MD files |

#### `/ddd:doc-refresh`

| Field | Description |
|-------|-------------|
| **Who** | Developer after incremental code changes |
| **When** | Code changed, need targeted doc updates |
| **What** | Incrementally updates affected documents after code changes. Example: `/ddd:doc-refresh -y` |
| **How** | Detect changed files -> Find affected docs -> Regenerate only affected |
| **Output** | Updated subset of documentation files |
| **Done** | Affected docs updated, unchanged docs preserved |
| **Failure & Recovery** | Falls back to full regeneration if detection fails |
| **Impact & Boundary** | Incremental update, more efficient than full regenerate |

#### `/ddd:sync`

| Field | Description |
|-------|-------------|
| **Who** | Developer after task completion |
| **When** | Post-task synchronization to update index |
| **What** | Post-task synchronization updates doc-index with completed work. Example: `/ddd:sync -y "auth feature complete"` |
| **How** | Detect changes -> Update components -> Update requirements status -> Add action log |
| **Output** | Updated doc-index.json with action entries |
| **Done** | Index reflects current codebase state |
| **Failure & Recovery** | Merge conflicts resolved automatically |
| **Impact & Boundary** | Post-execution sync only |

#### `/ddd:update`

| Field | Description |
|-------|-------------|
| **Who** | Developer maintaining doc-index |
| **When** | Detecting drift between code and docs |
| **What** | Incremental index update detecting code changes. Example: `/ddd:update --scope src/auth` |
| **How** | File hash comparison -> Detect changes -> Update affected entries |
| **Output** | Updated doc-index.json entries |
| **Done** | Index entries match current code |
| **Failure & Recovery** | Unchanged files skipped |
| **Impact & Boundary** | Lightweight incremental update |

#### `/ddd:auto`

| Field | Description |
|-------|-------------|
| **Who** | Developer wanting full automation |
| **When** | Quick feature implementation with docs |
| **What** | Chain command for automated DDD workflow. Example: `/ddd:auto -y "implement search feature"` |
| **How** | plan -> execute -> sync in single command |
| **Output** | Complete implementation + updated docs |
| **Done** | Feature implemented and documented |
| **Failure & Recovery** | Stops at first failing phase |
| **Impact & Boundary** | Full automation, less control |

---

### Issue

#### `/issue:new`

| Field | Description |
|-------|-------------|
| **Who** | Developer creating structured issue |
| **When** | Starting issue tracking for a task |
| **What** | Creates structured issue from GitHub URL or description. Example: `/issue:new "Fix login timeout bug"` |
| **How** | Parse input -> Structure issue -> Create in issues.jsonl |
| **Output** | Issue entry in `.workflow/issues/issues.jsonl` |
| **Done** | Issue created with status "registered" |
| **Failure & Recovery** | Duplicate detection warns user |
| **Impact & Boundary** | Issue creation only, no planning |

#### `/issue:discover`

| Field | Description |
|-------|-------------|
| **Who** | Developer finding potential issues |
| **When** | Starting issue management workflow |
| **What** | Discovers potential issues from multiple sources. Example: `/issue:discover --scope src/auth` |
| **How** | Scan codebase -> Detect patterns -> Generate issue candidates |
| **Output** | List of discovered issue candidates |
| **Done** | Candidates presented for user selection |
| **Failure & Recovery** | Empty results suggest manual creation |
| **Impact & Boundary** | Discovery only, no automatic creation |

#### `/issue:discover-by-prompt`

| Field | Description |
|-------|-------------|
| **Who** | Developer with natural language query |
| **When** | Finding issues via description |
| **What** | Discovers issues from user prompt with Gemini analysis. Example: `/issue:discover-by-prompt "authentication problems"` |
| **How** | Gemini analysis -> Pattern matching -> Issue suggestions |
| **Output** | Issue candidates matching prompt |
| **Done** | Candidates presented for confirmation |
| **Failure & Recovery** | Falls back to keyword search |
| **Impact & Boundary** | Natural language discovery |

#### `/issue:from-brainstorm`

| Field | Description |
|-------|-------------|
| **Who** | Developer converting ideas to issues |
| **When** | After brainstorm session |
| **What** | Converts brainstorm session ideas into issues. Example: `/issue:from-brainstorm BRAIN-2026-03-08` |
| **How** | Parse brainstorm -> Extract actionables -> Create issues |
| **Output** | Multiple issues from brainstorm artifacts |
| **Done** | All actionables converted to issues |
| **Failure & Recovery** | Partial conversion on parse errors |
| **Impact & Boundary** | Requires completed brainstorm session |

#### `/issue:plan`

| Field | Description |
|-------|-------------|
| **Who** | Developer planning issue resolution |
| **When** | Issue registered, needs solution |
| **What** | Batch plans issue resolution using issue-planning-agent. Example: `/issue:plan ISS-001 ISS-002` |
| **How** | Load issues -> Generate solutions -> Bind to issues |
| **Output** | Solution files in `.workflow/issues/solutions/` |
| **Done** | Issues have bound solutions |
| **Failure & Recovery** | Partial planning on complex issues |
| **Impact & Boundary** | Planning only, no execution |

#### `/issue:queue`

| Field | Description |
|-------|-------------|
| **Who** | Developer forming execution queue |
| **When** | Solutions planned, ready to execute |
| **What** | Forms execution queue from bound solutions. Example: `/issue:queue ISS-001 ISS-002` |
| **How** | Build DAG -> Resolve dependencies -> Create queue |
| **Output** | Queue file in `.workflow/issues/queues/` |
| **Done** | Queue ready for execution |
| **Failure & Recovery** | Circular dependency detection |
| **Impact & Boundary** | Queue formation only |

#### `/issue:execute`

| Field | Description |
|-------|-------------|
| **Who** | Developer executing queued issues |
| **When** | Queue formed, ready to run |
| **What** | Executes queue with DAG-based parallel orchestration. Example: `/issue:execute -y` |
| **How** | DAG traversal -> Parallel execution -> Progress tracking |
| **Output** | Task execution results, code changes |
| **Done** | All queued tasks completed |
| **Failure & Recovery** | Failed tasks skipped, dependents notified |
| **Impact & Boundary** | Execution engine for issue workflow |

#### `/issue:convert-to-plan`

| Field | Description |
|-------|-------------|
| **Who** | Developer with existing planning artifacts |
| **When** | Converting lite-plan or brainstorm to issue |
| **What** | Converts planning artifacts to issue format. Example: `/issue:convert-to-plan plan.json` |
| **How** | Parse artifact -> Extract tasks -> Create issue + solution |
| **Output** | Issue and solution from plan |
| **Done** | Plan converted to trackable issue |
| **Failure & Recovery** | Partial conversion preserved |
| **Impact & Boundary** | Artifact conversion only |

---

### IDAW (Iterative Development Automation Workflow)

#### `/idaw:status`

| Field | Description |
|-------|-------------|
| **Who** | Developer checking IDAW progress |
| **When** | During IDAW session |
| **What** | Views IDAW task and session progress. Example: `/idaw:status` |
| **How** | Read session state -> Display progress |
| **Output** | Status summary of active IDAW session |
| **Done** | Status displayed |
| **Failure & Recovery** | No active session message |
| **Impact & Boundary** | Read-only status check |

#### `/idaw:add`

| Field | Description |
|-------|-------------|
| **Who** | Developer adding IDAW tasks |
| **When** | Building IDAW task list |
| **What** | Adds IDAW tasks via manual creation or import. Example: `/idaw:add "Implement caching layer"` |
| **How** | Parse input -> Create task entry -> Add to session |
| **Output** | Task added to IDAW session |
| **Done** | Task registered in session |
| **Failure & Recovery** | Duplicate task warning |
| **Impact & Boundary** | Task creation only |

#### `/idaw:run`

| Field | Description |
|-------|-------------|
| **Who** | Developer starting IDAW execution |
| **When** | Tasks added, ready to run |
| **What** | IDAW orchestrator executing task skill chain. Example: `/idaw:run -y` |
| **How** | Task dispatch -> Skill execution -> Progress tracking |
| **Output** | Task execution results |
| **Done** | All tasks processed |
| **Failure & Recovery** | Failed tasks logged, continue others |
| **Impact & Boundary** | Main IDAW execution engine |

#### `/idaw:run-coordinate`

| Field | Description |
|-------|-------------|
| **Who** | Developer needing coordinated execution |
| **When** | Complex multi-task IDAW session |
| **What** | IDAW coordinator executing task skill chain. Example: `/idaw:run-coordinate` |
| **How** | Coordinate multiple task executions -> Handle dependencies |
| **Output** | Coordinated execution results |
| **Done** | All coordinated tasks complete |
| **Failure & Recovery** | Dependency failures handled |
| **Impact & Boundary** | Coordinated execution mode |

#### `/idaw:resume`

| Field | Description |
|-------|-------------|
| **Who** | Developer resuming interrupted IDAW |
| **When** | IDAW session interrupted |
| **What** | Resumes interrupted IDAW session from last checkpoint. Example: `/idaw:resume` |
| **How** | Load state -> Resume from checkpoint -> Continue execution |
| **Output** | Continued execution from interruption point |
| **Done** | Session completes |
| **Failure & Recovery** | Checkpoint validation on load |
| **Impact & Boundary** | Resume capability for IDAW |

---

### Workflow

#### `/workflow:session:start`

| Field | Description |
|-------|-------------|
| **Who** | Developer starting workflow session |
| **When** | Beginning any workflow work |
| **What** | Discovers or starts workflow session with conflict detection. Example: `/workflow:session:start --auto "implement OAuth2"` |
| **How** | Check active -> Detect conflicts -> Create/reuse session |
| **Output** | `SESSION_ID: WFS-{slug}` |
| **Done** | Session ready for work |
| **Failure & Recovery** | Multiple sessions warning |
| **Impact & Boundary** | Session initialization, calls /workflow:spec:setup if needed |

#### `/workflow:session:list`

| Field | Description |
|-------|-------------|
| **Who** | Developer reviewing sessions |
| **When** | Checking available sessions |
| **What** | Lists all workflow sessions with status filtering. Example: `/workflow:session:list --status active` |
| **How** | Scan .workflow/active -> Parse session metadata -> Display |
| **Output** | Session list with status, dates |
| **Done** | List displayed |
| **Failure & Recovery** | Empty list if no sessions |
| **Impact & Boundary** | Read-only listing |

#### `/workflow:session:sync`

| Field | Description |
|-------|-------------|
| **Who** | Developer syncing session work |
| **When** | After completing work in session |
| **What** | Quick-sync session work to specs/*.md and project-tech. Example: `/workflow:session:sync -y "auth complete"` |
| **How** | Gather context -> Extract updates -> Write specs + project-tech |
| **Output** | Updated specs/*.md and project-tech.json |
| **Done** | Sync complete message |
| **Failure & Recovery** | Duplicate rules skipped silently |
| **Impact & Boundary** | Updates project guidelines |

#### `/workflow:session:resume`

| Field | Description |
|-------|-------------|
| **Who** | Developer resuming paused session |
| **When** | Returning to paused work |
| **What** | Resumes most recently paused workflow session. Example: `/workflow:session:resume` |
| **How** | Find paused session -> Load state -> Continue |
| **Output** | Session context restored |
| **Done** | Ready to continue work |
| **Failure & Recovery** | No paused session error |
| **Impact & Boundary** | Session resumption |

#### `/workflow:session:complete`

| Field | Description |
|-------|-------------|
| **Who** | Developer finishing session |
| **When** | Session work complete |
| **What** | Archives completed session and removes from active. Example: `/workflow:session:complete -y` |
| **How** | Finalize state -> Archive -> Remove from active |
| **Output** | Archived session in .workflow/archived/ |
| **Done** | Session archived, specs updated |
| **Failure & Recovery** | Pending tasks warning |
| **Impact & Boundary** | Session finalization |

#### `/workflow:spec:setup`

| Field | Description |
|-------|-------------|
| **Who** | Developer initializing project specs |
| **When** | First time setup or regenerating |
| **What** | Initializes project-level state via cli-explore-agent analysis. Example: `/workflow:spec:setup --regenerate` |
| **How** | cli-explore-agent -> Generate project-tech.json -> Interactive questionnaire -> Write specs |
| **Output** | `.workflow/project-tech.json` + `.ccw/specs/*.md` |
| **Done** | Project specs configured |
| **Failure & Recovery** | Agent failure falls back to basic init |
| **Impact & Boundary** | Project-level initialization |

#### `/workflow:spec:add`

| Field | Description |
|-------|-------------|
| **Who** | Developer adding project rules |
| **When** | Adding conventions, constraints, or learnings |
| **What** | Adds specs, conventions, constraints to project guidelines. Example: `/workflow:spec:add -y "Use functional components"` |
| **How** | Parse input -> Auto-detect type -> Append to spec file |
| **Output** | Updated spec file in .ccw/specs/ |
| **Done** | Rule added confirmation |
| **Failure & Recovery** | Duplicate detection |
| **Impact & Boundary** | Single rule addition |

#### `/workflow:clean`

| Field | Description |
|-------|-------------|
| **Who** | Developer cleaning code |
| **When** | Before commits or after refactoring |
| **What** | Intelligent code cleanup with mainline detection. Example: `/workflow:clean -y` |
| **How** | Detect unused -> Remove dead code -> Format |
| **Output** | Cleaned code files |
| **Done** | Cleanup report displayed |
| **Failure & Recovery** | Preserves files with unclear usage |
| **Impact & Boundary** | Code cleanup only |

#### `/workflow:debug-with-file`

| Field | Description |
|-------|-------------|
| **Who** | Developer debugging issues |
| **When** | Encountering bugs or errors |
| **What** | Interactive hypothesis-driven debugging with file output. Example: `/workflow:debug-with-file "login fails on timeout"` |
| **How** | Hypothesis generation -> Evidence collection -> Validation -> Fix |
| **Output** | Debug report + potential fixes |
| **Done** | Root cause identified or fix applied |
| **Failure & Recovery** | Multiple hypothesis iteration |
| **Impact & Boundary** | Debugging workflow |

#### `/workflow:analyze-with-file`

| Field | Description |
|-------|-------------|
| **Who** | Developer analyzing code |
| **When** | Understanding codebase or issues |
| **What** | Interactive collaborative analysis with multi-CLI support. Example: `/workflow:analyze-with-file "analyze auth flow"` |
| **How** | Discovery -> Analysis -> Synthesis -> Report |
| **Output** | Analysis report in session folder |
| **Done** | Analysis complete with insights |
| **Failure & Recovery** | Partial analysis on errors |
| **Impact & Boundary** | Analysis workflow |

#### `/workflow:brainstorm-with-file`

| Field | Description |
|-------|-------------|
| **Who** | Developer exploring solutions |
| **When** | Starting new feature or solving complex problem |
| **What** | Interactive brainstorming with multi-CLI support. Example: `/workflow:brainstorm-with-file "caching strategy"` |
| **How** | Multi-perspective analysis -> Idea synthesis -> Recommendations |
| **Output** | Brainstorm report with actionables |
| **Done** | Ideas documented and prioritized |
| **Failure & Recovery** | Partial results preserved |
| **Impact & Boundary** | Ideation workflow |

#### `/workflow:collaborative-plan-with-file`

| Field | Description |
|-------|-------------|
| **Who** | Developer planning collaboratively |
| **When** | Complex feature planning |
| **What** | Collaborative planning with Plan Note output. Example: `/workflow:collaborative-plan-with-file "user dashboard redesign"` |
| **How** | Context gathering -> Planning -> Plan Note generation |
| **Output** | Plan with structured notes |
| **Done** | Plan ready for execution |
| **Failure & Recovery** | Iterative refinement |
| **Impact & Boundary** | Planning workflow |

#### `/workflow:integration-test-cycle`

| Field | Description |
|-------|-------------|
| **Who** | Developer running integration tests |
| **When** | After implementation, before merge |
| **What** | Self-iterating integration test workflow with reflection log. Example: `/workflow:integration-test-cycle -y "test auth flow"` |
| **How** | Generate tests -> Execute -> Reflect -> Iterate until pass |
| **Output** | Passing tests + reflection-log.md |
| **Done** | All tests passing |
| **Failure & Recovery** | Reflection-driven adjustment loop |
| **Impact & Boundary** | Integration testing workflow |

#### `/workflow:refactor-cycle`

| Field | Description |
|-------|-------------|
| **Who** | Developer addressing tech debt |
| **When** | Systematic code improvement |
| **What** | Tech debt discovery and self-iterating refactoring. Example: `/workflow:refactor-cycle -y "src/auth module"` |
| **How** | Debt discovery -> Prioritization -> Refactor -> Validate -> Reflect |
| **Output** | reflection-log.md + state.json + code changes |
| **Done** | All queued debt items processed |
| **Failure & Recovery** | Per-item validation with rollback |
| **Impact & Boundary** | Tech debt lifecycle management |

#### `/workflow:roadmap-with-file`

| Field | Description |
|-------|-------------|
| **Who** | Developer planning strategic requirements |
| **When** | Large feature or project planning |
| **What** | Strategic requirement roadmap with iterative decomposition. Example: `/workflow:roadmap-with-file -y "implement auth system"` |
| **How** | Understand -> Decompose -> Iterate -> Validate -> Handoff |
| **Output** | roadmap.md + issues.jsonl |
| **Done** | Roadmap approved, issues ready |
| **Failure & Recovery** | Max iteration rounds force proceed |
| **Impact & Boundary** | Strategic planning workflow |

#### `/workflow:unified-execute-with-file`

| Field | Description |
|-------|-------------|
| **Who** | Developer executing plans |
| **When** | After planning, ready to implement |
| **What** | Universal execution engine for any planning output. Example: `/workflow:unified-execute-with-file -y plan.json` |
| **How** | Load plan -> Validate -> Wave execution -> Track progress |
| **Output** | Code changes + execution-events.md |
| **Done** | All tasks executed |
| **Failure & Recovery** | Per-task retry with rollback |
| **Impact & Boundary** | Universal execution engine |

#### UI Design Commands

| Command | Who | When | What | Output |
|---------|-----|------|------|--------|
| `/workflow:ui-design:explore-auto` | Designer/Developer | Starting UI design | Interactive exploratory workflow | Style variants + layout templates + prototypes |
| `/workflow:ui-design:imitate-auto` | Designer/Developer | Imitating reference | UI design imitation workflow | Prototypes matching reference style |
| `/workflow:ui-design:generate` | Designer/Developer | Assembling prototypes | Pure assembler combining layouts + tokens | HTML/CSS prototypes |
| `/workflow:ui-design:style-extract` | Designer/Developer | Extracting styles | Extract design tokens from images | design-tokens.json + style-guide.md |
| `/workflow:ui-design:layout-extract` | Designer/Developer | Extracting layouts | Extract layout templates | layout-*.json files |
| `/workflow:ui-design:animation-extract` | Designer/Developer | Extracting animations | Extract animation patterns | animation-tokens.json |
| `/workflow:ui-design:codify-style` | Developer | From code to design | Extract styles from code files | Design tokens from CSS/SCSS |
| `/workflow:ui-design:import-from-code` | Developer | Code-based design | Import design from existing code | Design system from codebase |
| `/workflow:ui-design:design-sync` | Designer | Syncing design | Synchronize design references | Updated design system docs |
| `/workflow:ui-design:reference-page-generator` | Developer | Reference docs | Generate component reference pages | Multi-component reference pages |

---

### Memory

#### `/memory:prepare`

| Field | Description |
|-------|-------------|
| **Who** | Developer preparing memory capture |
| **When** | Before capturing session knowledge |
| **What** | Delegates to universal-executor agent to prepare memory. Example: `/memory:prepare "auth session"` |
| **How** | Context gathering -> Memory structure preparation |
| **Output** | Prepared memory structure |
| **Done** | Ready for memory capture |
| **Failure & Recovery** | Agent failure handled |
| **Impact & Boundary** | Memory preparation only |

#### `/memory:style-skill-memory`

| Field | Description |
|-------|-------------|
| **Who** | Developer documenting style knowledge |
| **When** | After learning project patterns |
| **What** | Generates SKILL memory package from style patterns. Example: `/memory:style-skill-memory "React patterns"` |
| **How** | Pattern extraction -> Skill memory generation |
| **Output** | SKILL memory package |
| **Done** | Skill memory documented |
| **Failure & Recovery** | Partial patterns preserved |
| **Impact & Boundary** | Style-specific memory |

---

### CLI

#### `/cli:codex-review`

| Field | Description |
|-------|-------------|
| **Who** | Developer reviewing code |
| **When** | Code review needed |
| **What** | Interactive code review using Codex CLI. Example: `/cli:codex-review --uncommitted` |
| **How** | Codex CLI -> Review analysis -> Interactive feedback |
| **Output** | Code review report |
| **Done** | Review complete with recommendations |
| **Failure & Recovery** | Codex unavailability fallback |
| **Impact & Boundary** | Git-aware code review |

#### `/cli:cli-init`

| Field | Description |
|-------|-------------|
| **Who** | Developer setting up CLI config |
| **When** | First time setup |
| **What** | Generates .gemini/ and .qwen/ config directories. Example: `/cli:cli-init` |
| **How** | Create directories -> Generate default configs |
| **Output** | CLI configuration directories |
| **Done** | Configs ready for customization |
| **Failure & Recovery** | Existing configs preserved |
| **Impact & Boundary** | CLI configuration setup |

---

## Section 2: Skills

### Workflow Skills

#### `workflow-plan`

| Field | Description |
|-------|-------------|
| **Who** | Developer planning tasks |
| **When** | Starting any planned work |
| **What** | Unified 4-phase planning: session discovery -> context gathering -> conflict resolution -> task generation |
| **How** | Phase 0: Session -> Phase 1: Context -> Phase 2: Conflicts -> Phase 3: Tasks |
| **Output** | plan.json + TASK-*.json in session folder |
| **Done** | Plan with TodoWrite tracking complete |
| **Failure & Recovery** | Conflict resolution prompts user |
| **Impact & Boundary** | Core planning skill |

#### `workflow-execute`

| Field | Description |
|-------|-------------|
| **Who** | Developer executing planned tasks |
| **When** | After workflow-plan |
| **What** | Agent execution orchestration with lazy task loading, auto-commit |
| **How** | Load plan -> Spawn agents -> Execute -> Commit |
| **Output** | Code changes + task completion status |
| **Done** | All tasks executed or user-stopped |
| **Failure & Recovery** | Per-task retry, auto-rollback |
| **Impact & Boundary** | Core execution skill |

#### `workflow-lite-plan`

| Field | Description |
|-------|-------------|
| **Who** | Developer needing quick planning |
| **When** | Simple tasks without full session |
| **What** | Lightweight planning - task analysis + breakdown |
| **How** | Analyze -> Break down -> Generate tasks |
| **Output** | Simplified plan.json |
| **Done** | Quick plan ready |
| **Failure & Recovery** | Falls back to workflow-plan for complex cases |
| **Impact & Boundary** | Lightweight alternative |

#### `workflow-lite-execute`

| Field | Description |
|-------|-------------|
| **Who** | Developer executing simple plans |
| **When** | After lite-plan or standalone |
| **What** | Lightweight execution engine - multi-model collaboration |
| **How** | Load tasks -> Execute -> Verify |
| **Output** | Code changes |
| **Done** | Tasks completed |
| **Failure & Recovery** | Simple retry mechanism |
| **Impact & Boundary** | Lightweight alternative |

#### `workflow-tdd-plan`

| Field | Description |
|-------|-------------|
| **Who** | Developer using TDD approach |
| **When** | Test-driven development |
| **What** | TDD workflow combining 6-phase planning with test-first |
| **How** | Plan tests -> Write tests -> Implement -> Verify |
| **Output** | Tests + implementation |
| **Done** | All tests passing |
| **Failure & Recovery** | Test failure iteration |
| **Impact & Boundary** | TDD-specific workflow |

#### `workflow-test-fix`

| Field | Description |
|-------|-------------|
| **Who** | Developer fixing test failures |
| **When** | Tests failing |
| **What** | Test-fix pipeline combining test runner with fix agent |
| **How** | Run tests -> Identify failures -> Fix -> Re-run |
| **Output** | Passing tests |
| **Done** | All tests pass |
| **Failure & Recovery** | Iterative fix loop |
| **Impact & Boundary** | Test fixing workflow |

#### `workflow-multi-cli-plan`

| Field | Description |
|-------|-------------|
| **Who** | Developer using multiple CLIs |
| **When** | Complex multi-perspective planning |
| **What** | Multi-CLI collaborative planning with ACE integration |
| **How** | Parallel CLI analysis -> Merge perspectives -> Generate plan |
| **Output** | Comprehensive plan from multiple models |
| **Done** | Merged plan complete |
| **Failure & Recovery** | Partial results merged |
| **Impact & Boundary** | Multi-model planning |

#### `workflow-skill-designer`

| Field | Description |
|-------|-------------|
| **Who** | Developer creating skills |
| **When** | Building new workflow skills |
| **What** | Meta-skill for designing orchestrator+phase skills |
| **How** | Design -> Template -> Generate skill files |
| **Output** | New skill SKILL.md + phases |
| **Done** | Skill ready for use |
| **Failure & Recovery** | Validation errors guide fixes |
| **Impact & Boundary** | Skill meta-creation |

---

### Team Skills

#### `team-coordinate`

| Field | Description |
|-------|-------------|
| **Who** | Developer coordinating multi-agent work |
| **When** | Complex multi-role tasks |
| **What** | Universal team coordination with dynamic role generation |
| **How** | Analyze task -> Generate role-specs -> Dispatch workers -> Execute -> Deliver |
| **Output** | Coordinated multi-agent results |
| **Done** | Pipeline complete, artifacts delivered |
| **Failure & Recovery** | Role regeneration on capability gaps |
| **Impact & Boundary** | Universal team orchestrator |

#### `team-edict`

| Field | Description |
|-------|-------------|
| **Who** | Developer using Edict architecture |
| **When** | Large-scale multi-agent coordination |
| **What** | Three-Six Ministry multi-agent framework replicating Edict architecture |
| **How** | Ministry-based role assignment -> Task dispatch -> Report aggregation |
| **Output** | Comprehensive multi-role deliverables |
| **Done** | All ministries report complete |
| **Failure & Recovery** | Ministry-level retry |
| **Impact & Boundary** | Large-scale coordination |

#### `team-planex`

| Field | Description |
|-------|-------------|
| **Who** | Developer planning and executing |
| **When** | Plan-and-execute workflow |
| **What** | Unified team skill for plan-and-execute team |
| **How** | Plan -> Execute -> Verify |
| **Output** | Planned and executed work |
| **Done** | Plan executed completely |
| **Failure & Recovery** | Plan adjustment on failures |
| **Impact & Boundary** | Plan-execute team |

#### `team-frontend`

| Field | Description |
|-------|-------------|
| **Who** | Frontend developer |
| **When** | Frontend development work |
| **What** | Unified team skill for frontend development |
| **How** | Component design -> Implementation -> Testing |
| **Output** | Frontend components and features |
| **Done** | Frontend work complete |
| **Failure & Recovery** | Component-level retry |
| **Impact & Boundary** | Frontend-specific team |

#### `team-frontend-debug`

| Field | Description |
|-------|-------------|
| **Who** | Frontend developer debugging |
| **When** | Frontend issues |
| **What** | Frontend debugging team using Chrome DevTools MCP |
| **How** | Inspect -> Diagnose -> Fix -> Verify |
| **Output** | Fixed frontend issues |
| **Done** | Issues resolved |
| **Failure & Recovery** | Iterative debugging |
| **Impact & Boundary** | Frontend debugging specific |

#### `team-testing`

| Field | Description |
|-------|-------------|
| **Who** | Developer writing tests |
| **When** | Test generation needed |
| **What** | Unified team skill for testing team |
| **How** | Test planning -> Generation -> Execution |
| **Output** | Test suites |
| **Done** | Tests passing |
| **Failure & Recovery** | Test iteration |
| **Impact & Boundary** | Testing-specific team |

#### `team-review`

| Field | Description |
|-------|-------------|
| **Who** | Developer reviewing code |
| **When** | Code review needed |
| **What** | Unified team skill for code review |
| **How** | Multi-perspective review -> Feedback aggregation |
| **Output** | Review reports |
| **Done** | Review complete |
| **Failure & Recovery** | Partial review preserved |
| **Impact & Boundary** | Review-specific team |

#### `team-quality-assurance`

| Field | Description |
|-------|-------------|
| **Who** | QA engineer |
| **When** | Quality verification |
| **What** | Unified team skill for quality assurance |
| **How** | Quality checks -> Issue identification -> Remediation |
| **Output** | QA reports and fixes |
| **Done** | Quality verified |
| **Failure & Recovery** | Issue-driven iteration |
| **Impact & Boundary** | QA-specific team |

#### `team-arch-opt`

| Field | Description |
|-------|-------------|
| **Who** | Developer optimizing architecture |
| **When** | Architecture improvement |
| **What** | Unified team skill for architecture optimization |
| **How** | Analysis -> Optimization plan -> Implementation |
| **Output** | Improved architecture |
| **Done** | Optimization complete |
| **Failure & Recovery** | Gradual optimization |
| **Impact & Boundary** | Architecture-specific team |

#### `team-perf-opt`

| Field | Description |
|-------|-------------|
| **Who** | Developer optimizing performance |
| **When** | Performance issues |
| **What** | Unified team skill for performance optimization |
| **How** | Profiling -> Bottleneck identification -> Optimization |
| **Output** | Performance improvements |
| **Done** | Performance targets met |
| **Failure & Recovery** | Iterative optimization |
| **Impact & Boundary** | Performance-specific team |

#### `team-tech-debt`

| Field | Description |
|-------|-------------|
| **Who** | Developer addressing tech debt |
| **When** | Tech debt cleanup |
| **What** | Unified team skill for tech debt identification |
| **How** | Detection -> Prioritization -> Resolution |
| **Output** | Tech debt reduction |
| **Done** | Debt items resolved |
| **Failure & Recovery** | Prioritized resolution |
| **Impact & Boundary** | Tech debt specific |

#### `team-ux-improve`

| Field | Description |
|-------|-------------|
| **Who** | UX designer/developer |
| **When** | UX improvements |
| **What** | Unified team skill for UX improvement |
| **How** | UX audit -> Improvement plan -> Implementation |
| **Output** | UX improvements |
| **Done** | UX enhanced |
| **Failure & Recovery** | User feedback iteration |
| **Impact & Boundary** | UX-specific team |

#### `team-uidesign`

| Field | Description |
|-------|-------------|
| **Who** | UI designer |
| **When** | UI design work |
| **What** | Unified team skill for UI design team |
| **How** | Design system -> Components -> Prototypes |
| **Output** | UI designs and prototypes |
| **Done** | Design complete |
| **Failure & Recovery** | Design iteration |
| **Impact & Boundary** | UI design specific |

#### `team-brainstorm`

| Field | Description |
|-------|-------------|
| **Who** | Team brainstorming |
| **When** | Ideation sessions |
| **What** | Unified team skill for brainstorming team |
| **How** | Multi-perspective ideation -> Synthesis |
| **Output** | Brainstorm results |
| **Done** | Ideas documented |
| **Failure & Recovery** | Partial synthesis |
| **Impact & Boundary** | Brainstorming specific |

#### `team-issue`

| Field | Description |
|-------|-------------|
| **Who** | Developer managing issues |
| **When** | Issue resolution workflow |
| **What** | Unified team skill for issue resolution |
| **How** | Issue analysis -> Resolution -> Verification |
| **Output** | Resolved issues |
| **Done** | Issues closed |
| **Failure & Recovery** | Issue-specific handling |
| **Impact & Boundary** | Issue-specific team |

#### `team-iterdev`

| Field | Description |
|-------|-------------|
| **Who** | Developer in iterative mode |
| **When** | Iterative development |
| **What** | Unified team skill for iterative development |
| **How** | Iteration -> Feedback -> Refinement |
| **Output** | Iteratively improved code |
| **Done** | Iteration goals met |
| **Failure & Recovery** | Iteration adjustment |
| **Impact & Boundary** | Iterative development team |

#### `team-roadmap-dev`

| Field | Description |
|-------|-------------|
| **Who** | Developer on roadmap features |
| **When** | Roadmap-driven development |
| **What** | Unified team skill for roadmap-driven development |
| **How** | Roadmap parsing -> Feature development -> Tracking |
| **Output** | Roadmap feature completions |
| **Done** | Roadmap items complete |
| **Failure & Recovery** | Roadmap adjustment |
| **Impact & Boundary** | Roadmap-specific team |

#### `team-ultra-analyze`

| Field | Description |
|-------|-------------|
| **Who** | Developer needing deep analysis |
| **When** | Complex analysis required |
| **What** | Deep collaborative analysis team skill |
| **How** | Multi-angle analysis -> Deep dive -> Synthesis |
| **Output** | Comprehensive analysis reports |
| **Done** | Analysis complete |
| **Failure & Recovery** | Partial analysis preserved |
| **Impact & Boundary** | Deep analysis team |

#### `team-executor`

| Field | Description |
|-------|-------------|
| **Who** | Developer executing tasks |
| **When** | Task execution needed |
| **What** | Lightweight session execution skill |
| **How** | Load session -> Execute tasks -> Report |
| **Output** | Task execution results |
| **Done** | Session tasks complete |
| **Failure & Recovery** | Task-level retry |
| **Impact & Boundary** | Lightweight execution |

#### `team-lifecycle-v4`

| Field | Description |
|-------|-------------|
| **Who** | Developer managing full lifecycle |
| **When** | Complete feature lifecycle |
| **What** | Full lifecycle team skill with clean architecture |
| **How** | Plan -> Develop -> Test -> Deploy -> Monitor |
| **Output** | Complete feature lifecycle |
| **Done** | Feature fully delivered |
| **Failure & Recovery** | Lifecycle stage retry |
| **Impact & Boundary** | Full lifecycle management |

#### `team-designer`

| Field | Description |
|-------|-------------|
| **Who** | Developer designing teams |
| **When** | Creating new team skills |
| **What** | Meta-skill for generating team skills for different domains |
| **How** | Domain analysis -> Role definition -> Skill generation |
| **Output** | New team skill files |
| **Done** | Team skill ready |
| **Failure & Recovery** | Template validation |
| **Impact & Boundary** | Team skill meta-creation |

---

### Utility Skills

#### `brainstorm`

| Field | Description |
|-------|-------------|
| **Who** | Developer exploring ideas |
| **When** | Starting new work, exploring solutions |
| **What** | Unified brainstorming with dual-mode (auto/single-role) and 9 available roles |
| **How** | Role selection -> Perspective analysis -> Idea synthesis |
| **Output** | Brainstorm report with actionables |
| **Done** | Ideas documented |
| **Failure & Recovery** | Partial analysis preserved |
| **Impact & Boundary** | Ideation support |

#### `spec-generator`

| Field | Description |
|-------|-------------|
| **Who** | Developer creating specifications |
| **When** | Starting new project or feature |
| **What** | 6-phase specification chain producing product brief, PRD, architecture, epics |
| **How** | Phase 1-6 chain: Brief -> PRD -> Architecture -> Epics -> Docs |
| **Output** | Complete specification documents |
| **Done** | All spec documents generated |
| **Failure & Recovery** | Phase-level retry |
| **Impact & Boundary** | Specification generation |

#### `issue-manage`

| Field | Description |
|-------|-------------|
| **Who** | Developer managing issues |
| **When** | Issue CRUD operations |
| **What** | Interactive menu-driven interface for issue CRUD via ccw issue CLI |
| **How** | Menu selection -> CLI execution -> Result display |
| **Output** | Issue management operations |
| **Done** | Operation complete |
| **Failure & Recovery** | CLI error handling |
| **Impact & Boundary** | Issue CRUD only |

#### `review-code`

| Field | Description |
|-------|-------------|
| **Who** | Developer reviewing code |
| **When** | Code review needed |
| **What** | Multi-dimensional code review with 6 dimensions: correctness, readability, performance, security, testing, architecture |
| **How** | Collect context -> Quick scan -> Deep review -> Generate report |
| **Output** | Structured review report |
| **Done** | Review complete |
| **Failure & Recovery** | Partial review preserved |
| **Impact & Boundary** | Code review only |

#### `review-cycle`

| Field | Description |
|-------|-------------|
| **Who** | Developer in review cycle |
| **When** | Iterative code review |
| **What** | Unified multi-dimensional code review with iterative cycle |
| **How** | Review -> Feedback -> Fix -> Re-review |
| **Output** | Iteratively improved code |
| **Done** | All issues addressed |
| **Failure & Recovery** | Cycle iteration |
| **Impact & Boundary** | Iterative review |

#### `memory-capture`

| Field | Description |
|-------|-------------|
| **Who** | Developer capturing knowledge |
| **When** | After important learnings |
| **What** | Unified memory capture with routing - session/tech/module context |
| **How** | Context detection -> Memory extraction -> Storage |
| **Output** | Captured memory entries |
| **Done** | Memory captured |
| **Failure & Recovery** | Partial capture preserved |
| **Impact & Boundary** | Memory capture only |

#### `memory-manage`

| Field | Description |
|-------|-------------|
| **Who** | Developer managing memory |
| **When** | Memory maintenance |
| **What** | Unified memory management - CLAUDE.md updates and memory cleanup |
| **How** | Load memory -> Organize -> Update CLAUDE.md |
| **Output** | Updated memory files |
| **Done** | Memory organized |
| **Failure & Recovery** | Backup before changes |
| **Impact & Boundary** | Memory management |

#### `skill-tuning`

| Field | Description |
|-------|-------------|
| **Who** | Developer improving skills |
| **When** | Skill optimization needed |
| **What** | Universal skill diagnosis and optimization |
| **How** | Diagnose -> Optimize -> Validate |
| **Output** | Improved skill files |
| **Done** | Skill optimized |
| **Failure & Recovery** | Incremental improvement |
| **Impact & Boundary** | Skill optimization |

#### `skill-simplify`

| Field | Description |
|-------|-------------|
| **Who** | Developer simplifying skills |
| **When** | Skill too complex |
| **What** | SKILL.md simplification with functional preservation |
| **How** | Analyze -> Simplify -> Verify functionality |
| **Output** | Simplified skill file |
| **Done** | Skill simplified |
| **Failure & Recovery** | Functional verification |
| **Impact & Boundary** | Skill simplification |

#### `skill-generator`

| Field | Description |
|-------|-------------|
| **Who** | Developer creating skills |
| **When** | New skill needed |
| **What** | Meta-skill for creating new Claude Code skills |
| **How** | Requirements -> Template -> Skill generation |
| **Output** | New skill SKILL.md + supporting files |
| **Done** | Skill ready for use |
| **Failure & Recovery** | Template validation |
| **Impact & Boundary** | Skill creation |

#### `command-generator`

| Field | Description |
|-------|-------------|
| **Who** | Developer creating commands |
| **When** | New slash command needed |
| **What** | Command file generator - 5 phase workflow |
| **How** | Requirements -> Template -> Command generation |
| **Output** | New command .md file |
| **Done** | Command ready for use |
| **Failure & Recovery** | Schema validation |
| **Impact & Boundary** | Command creation |

#### `ccw-help`

| Field | Description |
|-------|-------------|
| **Who** | Developer seeking help |
| **When** | Learning CCW system |
| **What** | CCW command help system - search, browse, documentation |
| **How** | Query -> Search -> Display help |
| **Output** | Help information |
| **Done** | Help displayed |
| **Failure & Recovery** | Fuzzy matching |
| **Impact & Boundary** | Help system only |

---

## Appendix A: Quick Reference Table

### Commands by Category

| Category | Commands | Count |
|----------|----------|-------|
| Core | ccw, ccw-coordinator, flow-create | 3 |
| DDD | scan, index-build, plan, execute, doc-generate, doc-refresh, sync, update, auto | 9 |
| Issue | new, discover, discover-by-prompt, from-brainstorm, plan, queue, execute, convert-to-plan | 8 |
| IDAW | status, add, run, run-coordinate, resume | 5 |
| Workflow Session | start, list, sync, resume, complete | 5 |
| Workflow Spec | setup, add | 2 |
| Workflow Core | clean, debug-with-file, analyze-with-file, brainstorm-with-file, collaborative-plan-with-file | 5 |
| Workflow Cycle | integration-test-cycle, refactor-cycle, roadmap-with-file, unified-execute-with-file | 4 |
| Workflow UI Design | explore-auto, imitate-auto, generate, style-extract, layout-extract, animation-extract, codify-style, import-from-code, design-sync, reference-page-generator | 10 |
| Memory | prepare, style-skill-memory | 2 |
| CLI | codex-review, cli-init | 2 |
| **Total Commands** | | **55** |

### Skills by Category

| Category | Skills | Count |
|----------|--------|-------|
| Workflow | workflow-plan, workflow-execute, workflow-lite-plan, workflow-lite-execute, workflow-tdd-plan, workflow-test-fix, workflow-multi-cli-plan, workflow-skill-designer | 8 |
| Team | team-coordinate, team-edict, team-planex, team-frontend, team-frontend-debug, team-testing, team-review, team-quality-assurance, team-arch-opt, team-perf-opt, team-tech-debt, team-ux-improve, team-uidesign, team-brainstorm, team-issue, team-iterdev, team-roadmap-dev, team-ultra-analyze, team-executor, team-lifecycle-v4, team-designer | 21 |
| Utility | brainstorm, spec-generator, issue-manage, review-code, review-cycle, memory-capture, memory-manage, skill-tuning, skill-simplify, skill-generator, command-generator, ccw-help | 12 |
| **Total Skills** | | **41** |

---

## Appendix B: Command Chain Examples

### Document-Driven Development Flow

```
/ddd:scan                     # Code-first: scan existing codebase
  -> /ddd:plan "add feature"   # Plan with doc context
    -> /ddd:execute            # Execute with doc awareness
      -> /ddd:sync             # Sync changes to docs
```

### Spec-First Development Flow

```
Skill: spec-generator          # Generate specifications
  -> /ddd:index-build          # Build index from specs
    -> /ddd:plan               # Plan with spec context
      -> /ddd:execute          # Execute
        -> /ddd:doc-refresh    # Refresh affected docs
```

### Issue Resolution Flow

```
/issue:new "bug description"  # Create issue
  -> /issue:plan ISS-001       # Generate solution
    -> /issue:queue ISS-001    # Add to queue
      -> /issue:execute        # Execute queue
```

### Team Coordination Flow

```
Skill: team-coordinate "implement auth"
  -> Dynamic role generation
    -> Parallel worker execution
      -> Result aggregation
        -> Completion action
```

### UI Design Flow

```
/workflow:ui-design:explore-auto --input "modern dashboard"
  -> /workflow:ui-design:style-extract    # Extract styles
    -> /workflow:ui-design:layout-extract # Extract layouts
      -> /workflow:ui-design:generate     # Assemble prototypes
```

### Integration Test Flow

```
/workflow:integration-test-cycle "test auth flow"
  -> Generate tests
    -> Execute tests
      -> Reflect on failures
        -> Iterate until pass
          -> Reflection log
```

### Refactoring Flow

```
/workflow:refactor-cycle "src/auth"
  -> Debt discovery
    -> Prioritization
      -> Per-item refactor
        -> Validation
          -> Reflection
```

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Commands** | 55 |
| **Total Skills** | 41 |
| **DDD Commands** | 9 |
| **Issue Commands** | 8 |
| **Team Skills** | 21 |
| **Workflow Skills** | 8 |

---

*End of Reference Manual*
