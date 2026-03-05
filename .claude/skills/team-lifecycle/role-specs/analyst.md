---
role: analyst
prefix: RESEARCH
inner_loop: false
discuss_rounds: [DISCUSS-001]
cli_tools: [discuss]
message_types:
  success: research_ready
  progress: research_progress
  error: error
---

# Analyst — Phase 2-4

## Phase 2: Seed Analysis

**Objective**: Extract structured seed information from the topic/idea.

1. Extract session folder from task description (`Session: <path>`)
2. Parse topic from task description (first non-metadata line)
3. If topic starts with `@` or ends with `.md`/`.txt` → Read the referenced file as topic content
4. Run Gemini CLI seed analysis:

```
Bash({
  command: `ccw cli -p "PURPOSE: Analyze topic and extract structured seed information.
TASK: * Extract problem statement * Identify target users * Determine domain context
* List constraints and assumptions * Identify 3-5 exploration dimensions * Assess complexity
TOPIC: <topic-content>
MODE: analysis
EXPECTED: JSON with: problem_statement, target_users[], domain, constraints[], exploration_dimensions[], complexity_assessment" --tool gemini --mode analysis`,
  run_in_background: true
})
```

5. Wait for CLI result, parse seed analysis JSON

## Phase 3: Codebase Exploration (conditional)

**Objective**: Gather codebase context if an existing project is detected.

| Condition | Action |
|-----------|--------|
| package.json / Cargo.toml / pyproject.toml / go.mod exists | Explore codebase |
| No project files | Skip → codebase context = null |

**When project detected**: Use CLI exploration with Gemini.

```
Bash({
  command: `ccw cli -p "PURPOSE: Explore codebase for general context to inform spec generation
TASK: • Identify tech stack and frameworks • Map architecture patterns • Document conventions • List integration points
MODE: analysis
CONTEXT: @**/* | Memory: Seed analysis keywords: <keywords>
EXPECTED: JSON with: tech_stack[], architecture_patterns[], conventions[], integration_points[]
CONSTRAINTS: Focus on general context" --tool gemini --mode analysis --rule analysis-analyze-code-patterns`,
  run_in_background: false
})
```

Parse CLI output to build codebase context: tech_stack, architecture_patterns, conventions, integration_points.

## Phase 4: Context Packaging + Inline Discuss

### 4a: Context Packaging

**spec-config.json** → `<session-folder>/spec/spec-config.json`:
- session_id, topic, status="research_complete", complexity, depth, focus_areas, mode="interactive"

**discovery-context.json** → `<session-folder>/spec/discovery-context.json`:
- session_id, phase=1, seed_analysis (all fields), codebase_context (or null), recommendations

**design-intelligence.json** → `<session-folder>/analysis/design-intelligence.json` (UI mode only):
- Produced when frontend keywords detected in seed_analysis
- Fields: industry, style_direction, ux_patterns, color_strategy, typography, component_patterns

### 4b: Inline Discuss (DISCUSS-001)

Invoke multi-perspective discussion using CLI tools:
- Artifact: `<session-folder>/spec/discovery-context.json`
- Round: DISCUSS-001
- Perspectives: product, risk, coverage

Handle discuss verdict per team-worker consensus handling protocol.

**Report**: complexity, codebase presence, problem statement, exploration dimensions, discuss verdict + severity, output paths.

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Gemini CLI failure | Fallback to direct Claude analysis |
| Codebase detection failed | Continue as new project |
| Topic too vague | Report with clarification questions |
| CLI exploration fails | Continue without codebase context |
| Multi-perspective discussion fails | Proceed without discuss, log warning |
