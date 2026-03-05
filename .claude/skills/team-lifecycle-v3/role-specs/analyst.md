---
role: analyst
prefix: RESEARCH
inner_loop: false
discuss_rounds: [DISCUSS-001]
input_artifact_types: []
message_types:
  success: research_ready
  progress: research_progress
  error: error
---

# Analyst — Phase 2-4

## Phase 2: Seed Analysis

**Objective**: Extract structured seed information from the topic.

1. Read upstream artifacts from `context-artifacts.json` (if exists)
2. Extract session folder from task description (`Session: <path>`)
3. Parse topic from task description
4. If topic starts with `@` or ends with `.md`/`.txt` → Read referenced file
5. Run CLI seed analysis:

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

6. Parse seed analysis JSON

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

### 4b: Generate Artifact Manifest

Create `<session>/artifacts/<task-id>/artifact-manifest.json`:

```json
{
  "artifact_id": "uuid-...",
  "creator_role": "analyst",
  "artifact_type": "spec",
  "version": "1.0.0",
  "path": "./spec/discovery-context.json",
  "dependencies": [],
  "validation_status": "passed",
  "validation_summary": "Seed analysis complete, codebase explored",
  "metadata": {
    "complexity": "low | medium | high",
    "has_codebase": true | false
  }
}
```

### 4c: Inline Discuss (DISCUSS-001)

Call discuss subagent:
- Artifact: `<session>/spec/discovery-context.json`
- Round: DISCUSS-001
- Perspectives: product, risk, coverage

Handle verdict per consensus protocol.

**Report**: complexity, codebase presence, problem statement, dimensions, discuss verdict, output paths.

## Error Handling

| Scenario | Resolution |
|----------|------------|
| CLI failure | Fallback to direct Claude analysis |
| Codebase detection failed | Continue as new project |
| Topic too vague | Report with clarification questions |
| Discuss subagent fails | Proceed without discuss, log warning |
