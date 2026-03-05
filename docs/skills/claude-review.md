# Claude Skills - Code Review

## One-Liner

**Code Review Skills is a multi-dimensional code quality analysis system** — Through structured review dimensions and automated checks, it discovers code issues and provides fix recommendations.

## Pain Points Solved

| Pain Point | Current State | Claude Code Workflow Solution |
|------------|---------------|----------------------|
| **Incomplete review dimensions** | Manual review easily misses dimensions | 6-dimension automatic review |
| **Chaotic issue classification** | Hard to distinguish severity | Structured issue classification |
| **Vague fix recommendations** | Lacks specific fix solutions | Actionable fix recommendations |
| **Repeated review process** | Each review repeats same steps | Automated scanning and reporting |

## Skills List

| Skill | Function | Trigger |
|-------|----------|---------|
| `review-code` | Multi-dimensional code review (6 dimensions) | `/review-code <target>` |
| `review-cycle` | Code review and fix loop | `/review-cycle <target>` |

## Skills Details

### review-code

**One-Liner**: Multi-dimensional code review — Analyzes correctness, readability, performance, security, testing, architecture six dimensions

**Trigger**:
```
/review-code <target-path>
/review-code src/auth/**
/review-code --dimensions=sec,perf src/**
```

**Features**:
- 6-dimension review: Correctness, readability, performance, security, test coverage, architecture consistency
- Layered execution: Quick scan identifies high-risk areas, deep review focuses on key issues
- Structured reports: Classified by severity, provides file locations and fix recommendations
- State-driven: Autonomous mode, dynamically selects next action based on review progress

**Architecture Overview**:
```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Phase 0: Specification Study (Mandatory Prerequisite)       │
│              → Read specs/review-dimensions.md                   │
│              → Understand review dimensions and issue standards  │
└───────────────┬─────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────────┐
│           Orchestrator (State-driven decision)                   │
│           → Read state → Select review action → Execute → Update│
└───────────────┬─────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┬───────────┐
    ↓           ↓           ↓           ↓           ↓
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Collect │ │ Quick   │ │ Deep    │ │ Report  │ │Complete │
│ Context │ │ Scan    │ │ Review  │ │ Generate│ │         │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
     ↓           ↓           ↓           ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Review Dimensions                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Correctness│ │Readability│ │Performance│ │ Security │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐                                       │
│  │ Testing  │ │Architecture│                                      │
│  └──────────┘ └──────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

**⚠️ Mandatory Prerequisites**:

> **Do not skip**: Before executing any review operations, you **must** completely read the following documents.

**Specification Documents** (required):
| Document | Purpose | Priority |
|----------|---------|----------|
| [specs/review-dimensions.md](specs/review-dimensions.md) | Review dimension definitions and checkpoints | **P0 - Highest** |
| [specs/issue-classification.md](specs/issue-classification.md) | Issue classification and severity standards | **P0 - Highest** |
| [specs/quality-standards.md](specs/quality-standards.md) | Review quality standards | P1 |

**Template Files** (read before generation):
| Document | Purpose |
|----------|---------|
| [templates/review-report.md](templates/review-report.md) | Review report template |
| [templates/issue-template.md](templates/issue-template.md) | Issue record template |

**Execution Flow**:
```
Phase 0: Specification Study (Mandatory - Do not skip)
  → Read: specs/review-dimensions.md
  → Read: specs/issue-classification.md
  → Understand review standards and issue classification

Action: collect-context
  → Collect target files/directories
  → Identify tech stack and language
  → Output: state.context

Action: quick-scan
  → Quick scan overall structure
  → Identify high-risk areas
  → Output: state.risk_areas, state.scan_summary

Action: deep-review (per dimension)
  → Deep review per dimension
  → Record discovered issues
  → Output: state.findings[]

Action: generate-report
  → Aggregate all findings
  → Generate structured report
  → Output: review-report.md

Action: complete
  → Save final state
  → Output review summary
```

**Review Dimensions**:
| Dimension | Focus Areas | Key Checks |
|-----------|-------------|------------|
| **Correctness** | Logic correctness | Boundary conditions, error handling, null checks |
| **Readability** | Code readability | Naming conventions, function length, comment quality |
| **Performance** | Performance efficiency | Algorithm complexity, I/O optimization, resource usage |
| **Security** | Security | Injection risks, sensitive data, permission control |
| **Testing** | Test coverage | Test adequacy, boundary coverage, maintainability |
| **Architecture** | Architecture consistency | Design patterns, layering, dependency management |

**Issue Severity Levels**:
| Level | Prefix | Description | Required Action |
|-------|--------|-------------|-----------------|
| **Critical** | [C] | Blocking issue, must fix immediately | Must fix before merge |
| **High** | [H] | Important issue, needs fix | Should fix |
| **Medium** | [M] | Suggested improvement | Consider fixing |
| **Low** | [L] | Optional optimization | Nice to have |
| **Info** | [I] | Informational suggestion | Reference only |

**Output Structure**:
```
.workflow/.scratchpad/review-code-{timestamp}/
├── state.json                    # Review state
├── context.json                  # Target context
├── findings/                     # Issue findings
│   ├── correctness.json
│   ├── readability.json
│   ├── performance.json
│   ├── security.json
│   ├── testing.json
│   └── architecture.json
└── review-report.md              # Final review report
```

---

### review-cycle

**One-Liner**: Code review and fix loop — Complete cycle of reviewing code, discovering issues, fixing and verifying

**Trigger**:
```
/review-cycle <target-path>
/review-cycle --full <target-path>
```

**Features**:
- Review code to discover issues
- Generate fix recommendations
- Execute fixes
- Verify fix effectiveness
- Loop until passing

**Loop Flow**:
```
Review Code → Find Issues → [Has issues] → Fix Code → Verify → [Still has issues] → Fix Code
                          ↑______________|
```

**Use Cases**:
- Self-review before PR
- Code quality improvement
- Refactoring verification
- Security audit

## Related Commands

- [Claude Commands - Workflow](../commands/claude/workflow.md)
- [Team Review Collaboration](./claude-collaboration.md#team-review)

## Best Practices

1. **Read specifications completely**: Must read specs/ documents before executing review
2. **Multi-dimensional review**: Use `--dimensions` to specify focus areas, or use default all dimensions
3. **Quick scan**: Use quick-scan first to identify high-risk areas, then deep review
4. **Structured reports**: Use generated review-report.md as fix guide
5. **Continuous improvement**: Use review-cycle to continuously improve until quality standards are met

## Usage Examples

```bash
# Full review (6 dimensions)
/review-code src/auth/**

# Review only security and performance
/review-code --dimensions=sec,perf src/api/

# Review and fix loop
/review-cycle --full src/utils/

# Review specific file
/review-code src/components/Header.tsx
```

## Issue Report Example

```
### [C] SQL Injection Risk

**Location**: `src/auth/login.ts:45`

**Issue**: User input directly concatenated into SQL query without sanitization.

**Severity**: Critical - Must fix before merge

**Recommendation**:
```typescript
// Before (vulnerable):
const query = `SELECT * FROM users WHERE username='${username}'`;

// After (safe):
const query = 'SELECT * FROM users WHERE username = ?';
await db.query(query, [username]);
```

**Reference**: [specs/review-dimensions.md](specs/review-dimensions.md) - Security section
```
