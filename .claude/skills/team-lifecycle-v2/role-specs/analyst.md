---
role: analyst
prefix: RESEARCH
inner_loop: false
discuss_rounds: [DISCUSS-001]
message_types:
  success: research_ready
  progress: research_progress
  error: error
---

# Analyst — Phase 2-4

## Phase 2: Seed Analysis

**Objective**: Extract structured seed information from the topic.

1. Extract session folder from task description (`Session: <path>`)
2. Parse topic from task description
3. If topic starts with `@` or ends with `.md`/`.txt` → Read referenced file
4. Run CLI seed analysis:

```
Bash({
  command: `ccw cli -p "PURPOSE: Analyze topic and extract structured seed information.
TASK: * Extract problem statement * Identify target users * Determine domain context
* List constraints * Identify 3-5 exploration dimensions * Assess complexity
TOPIC: <topic-content>
MODE: analysis
EXPECTED: JSON with: problem_statement, target_users[], domain, constraints[], exploration_dimensions[], complexity_assessment" --tool gemini --mode analysis`,
  run_in_background: false
})
```

5. Parse seed analysis JSON

## Phase 3: Codebase Exploration (conditional)

**Objective**: Gather codebase context if project detected.

| Condition | Action |
|-----------|--------|
| package.json / Cargo.toml / pyproject.toml / go.mod exists | Explore |
| No project files | Skip (codebase_context = null) |

**When project detected**: Use CLI exploration.

```
Bash({
  command: `ccw cli -p "PURPOSE: Explore codebase for context to inform spec generation
TASK: • Identify tech stack • Map architecture patterns • Document conventions • List integration points
MODE: analysis
CONTEXT: @**/*
EXPECTED: JSON with: tech_stack[], architecture_patterns[], conventions[], integration_points[]" --tool gemini --mode analysis --rule analysis-analyze-code-patterns`,
  run_in_background: false
})
```

## Phase 4: Context Packaging + Discuss

### 4a: Context Packaging

**spec-config.json** → `<session>/spec/spec-config.json`
**discovery-context.json** → `<session>/spec/discovery-context.json`
**design-intelligence.json** → `<session>/analysis/design-intelligence.json` (UI mode only)

### 4b: Inline Discuss (DISCUSS-001)

**Multi-perspective critique via parallel CLI calls**:

```bash
# Product perspective
Bash(`ccw cli -p "PURPOSE: Review discovery context from product perspective
CONTEXT: @<session>/spec/discovery-context.json
EXPECTED: Rating (1-5) + concerns + recommendations
CONSTRAINTS: Focus on market fit, user value, scope clarity" --tool gemini --mode analysis`, { run_in_background: true })

# Risk perspective
Bash(`ccw cli -p "PURPOSE: Review discovery context from risk perspective
CONTEXT: @<session>/spec/discovery-context.json
EXPECTED: Rating (1-5) + risks + mitigation strategies
CONSTRAINTS: Focus on technical risks, dependencies, unknowns" --tool codex --mode analysis`, { run_in_background: true })

# Coverage perspective
Bash(`ccw cli -p "PURPOSE: Review discovery context from coverage perspective
CONTEXT: @<session>/spec/discovery-context.json
EXPECTED: Rating (1-5) + gaps + missing dimensions
CONSTRAINTS: Focus on completeness, edge cases, requirements coverage" --tool claude --mode analysis`, { run_in_background: true })
```

Wait for all results, aggregate ratings and feedback, determine consensus verdict:
- **HIGH**: Any rating <= 2 → User pause required
- **MEDIUM**: All ratings 3-4 → Proceed with caution
- **LOW**: All ratings >= 4 → Proceed

Handle verdict per consensus protocol.

**Report**: complexity, codebase presence, problem statement, dimensions, discuss verdict, output paths.

## Error Handling

| Scenario | Resolution |
|----------|------------|
| CLI failure | Fallback to direct Claude analysis |
| Codebase detection failed | Continue as new project |
| Topic too vague | Report with clarification questions |
| CLI critique fails | Proceed without critique, log warning |
