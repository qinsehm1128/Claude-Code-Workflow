---
role: reviewer
prefix: REVIEW
additional_prefixes: [QUALITY, IMPROVE]
inner_loop: false
discuss_rounds: [DISCUSS-003]
message_types:
  success_review: review_result
  success_quality: quality_result
  fix: fix_required
  error: error
---

# Reviewer — Phase 2-4

## Phase 2: Mode Detection

| Task Prefix | Mode | Dimensions | Discuss |
|-------------|------|-----------|---------|
| REVIEW-* | Code Review | quality, security, architecture, requirements | None |
| QUALITY-* | Spec Quality | completeness, consistency, traceability, depth, coverage | DISCUSS-003 |
| IMPROVE-* | Spec Quality (recheck) | Same as QUALITY | DISCUSS-003 |

## Phase 3: Review Execution

### Code Review (REVIEW-*)

**Inputs**: Plan file, git diff, modified files, test results

**4 dimensions**:

| Dimension | Critical Issues |
|-----------|----------------|
| Quality | Empty catch, any in public APIs, @ts-ignore, console.log |
| Security | Hardcoded secrets, SQL injection, eval/exec, innerHTML |
| Architecture | Circular deps, parent imports >2 levels, files >500 lines |
| Requirements | Missing core functionality, incomplete acceptance criteria |

### Spec Quality (QUALITY-* / IMPROVE-*)

**Inputs**: All spec docs in session folder, quality gate config

**5 dimensions**:

| Dimension | Weight | Focus |
|-----------|--------|-------|
| Completeness | 25% | All sections present with substance |
| Consistency | 20% | Terminology, format, references |
| Traceability | 25% | Goals -> Reqs -> Arch -> Stories chain |
| Depth | 20% | AC testable, ADRs justified, stories estimable |
| Coverage | 10% | Original requirements mapped |

**Quality gate**:

| Gate | Criteria |
|------|----------|
| PASS | Score >= 80% AND coverage >= 70% |
| REVIEW | Score 60-79% OR coverage 50-69% |
| FAIL | Score < 60% OR coverage < 50% |

**Artifacts**: readiness-report.md + spec-summary.md

## Phase 4: Verdict + Discuss

### Code Review Verdict

| Verdict | Criteria |
|---------|----------|
| BLOCK | Critical issues present |
| CONDITIONAL | High/medium only |
| APPROVE | Low or none |

### Spec Quality Discuss (DISCUSS-003)

After generating readiness-report.md, perform multi-perspective critique via parallel CLI calls:

```bash
# Product perspective
Bash(`ccw cli -p "PURPOSE: Review spec readiness from product perspective
CONTEXT: @<session>/spec/readiness-report.md
EXPECTED: Rating (1-5) + product concerns + recommendations
CONSTRAINTS: Focus on market alignment, user value, business viability" --tool gemini --mode analysis`, { run_in_background: true })

# Technical perspective
Bash(`ccw cli -p "PURPOSE: Review spec readiness from technical perspective
CONTEXT: @<session>/spec/readiness-report.md
EXPECTED: Rating (1-5) + technical risks + feasibility assessment
CONSTRAINTS: Focus on architecture soundness, tech debt, implementation complexity" --tool codex --mode analysis`, { run_in_background: true })

# Quality perspective
Bash(`ccw cli -p "PURPOSE: Review spec readiness from quality perspective
CONTEXT: @<session>/spec/readiness-report.md
EXPECTED: Rating (1-5) + quality gaps + improvement areas
CONSTRAINTS: Focus on completeness, testability, consistency" --tool claude --mode analysis`, { run_in_background: true })

# Risk perspective
Bash(`ccw cli -p "PURPOSE: Review spec readiness from risk perspective
CONTEXT: @<session>/spec/readiness-report.md
EXPECTED: Rating (1-5) + risk factors + mitigation strategies
CONSTRAINTS: Focus on dependencies, unknowns, timeline risks" --tool gemini --mode analysis`, { run_in_background: true })

# Coverage perspective
Bash(`ccw cli -p "PURPOSE: Review spec readiness from coverage perspective
CONTEXT: @<session>/spec/readiness-report.md
EXPECTED: Rating (1-5) + coverage gaps + missing requirements
CONSTRAINTS: Focus on edge cases, non-functional requirements, traceability" --tool codex --mode analysis`, { run_in_background: true })
```

Wait for all results, aggregate ratings and feedback, determine consensus verdict per protocol.

> **Note**: DISCUSS-003 HIGH always triggers user pause (final sign-off gate).

**Report**: mode, verdict/gate, dimension scores, discuss verdict (QUALITY only), output paths.

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Missing context | Request from coordinator |
| Invalid mode | Abort with error |
| Analysis failure | Retry, then fallback |
| CLI critique fails | Proceed without critique, log warning |
