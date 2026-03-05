# Codex Skills - Specialized Category

## One-Liner

**Specialized Codex Skills is a toolset for specific domains** — solving domain-specific problems through specialized skills like code cleanup, data pipelines, memory management, CLI tools, and issue discovery.

## Skills List

| Skill | Function | Trigger |
| --- | --- | --- |
| `clean` | Intelligent code cleanup | `/clean <target>` |
| `csv-wave-pipeline` | CSV wave processing pipeline | `/csv-wave-pipeline <csv-file>` |
| `memory-compact` | Memory compression | `/memory-compact` |
| `ccw-cli-tools` | CLI tool execution specification | `/ccw-cli-tools <command>` |
| `issue-discover` | Issue discovery | `/issue-discover <context>` |

## Skills Details

### clean

**One-Liner**: Intelligent code cleanup — automated code cleanup, formatting, dead code removal

**Features**:
- Automated code cleanup
- Code formatting
- Dead code removal
- Import sorting
- Comment organization

**Cleanup Types**:
| Type | Description |
|------|-------------|
| **Format** | Unify code format |
| **Dead Code** | Remove unused code |
| **Imports** | Sort and remove unused imports |
| **Comments** | Organize and remove outdated comments |
| **Naming** | Unify naming conventions |

**Usage Examples**:
```bash
# Clean current directory
/clean .

# Clean specific directory
/clean src/

# Format only
/clean --format-only src/

# Remove dead code only
/clean --dead-code-only src/
```

---

### csv-wave-pipeline

**One-Liner**: CSV wave processing pipeline — CSV data processing, wave processing, data conversion and export

**Features**:
- CSV data reading and parsing
- Wave processing (batch processing for large data)
- Data conversion and validation
- Export to multiple formats

**Processing Flow**:
```
Read CSV → Validate Data → Wave Processing → Convert Data → Export Results
```

**Output Formats**:
| Format | Description |
|--------|-------------|
| CSV | Standard CSV format |
| JSON | JSON array |
| NDJSON | NDJSON (one JSON per line) |
| Excel | Excel file |

**Usage Examples**:
```bash
# Process CSV
/csv-wave-pipeline data.csv

# Specify output format
/csv-wave-pipeline data.csv --output-format=json

# Specify wave batch size
/csv-wave-pipeline data.csv --batch-size=1000
```

---

### memory-compact

**One-Liner**: Memory compression (Codex version) — Memory compression and merging, cleanup redundant data, optimize storage

**Features**:
- Memory compression and merging
- Clean redundant data
- Optimize storage
- Generate Memory summary

**Compression Types**:
| Type | Description |
|------|-------------|
| **Merge** | Merge similar entries |
| **Deduplicate** | Remove duplicate entries |
| **Archive** | Archive old entries |
| **Summary** | Generate summary |

**Usage Examples**:
```bash
# Compress Memory
/memory-compact

# Merge similar entries
/memory-compact --merge

# Generate summary
/memory-compact --summary
```

---

### ccw-cli-tools

**One-Liner**: CLI tool execution specification — standardized CLI tool execution, parameter specification, unified output format

**Features**:
- Standardized CLI tool execution
- Parameter specification
- Unified output format
- Error handling

**Supported CLI Tools**:
| Tool | Description |
|------|-------------|
| gemini | Gemini CLI |
| codex | Codex CLI |
| claude | Claude CLI |
| qwen | Qwen CLI |

**Execution Specification**:
```javascript
{
  "tool": "gemini",
  "mode": "write",
  "prompt": "...",
  "context": "...",
  "output": "..."
}
```

**Usage Examples**:
```bash
# Execute CLI tool
/ccw-cli-tools --tool=gemini --mode=write "Implement feature"

# Batch execution
/ccw-cli-tools --batch tasks.json
```

---

### issue-discover

**One-Liner**: Issue discovery — discover issues from context, issue classification, priority assessment

**Features**:
- Discover issues from context
- Issue classification
- Priority assessment
- Generate issue reports

**Issue Types**:
| Type | Description |
|------|-------------|
| **Bug** | Defect or error |
| **Feature** | New feature request |
| **Improvement** | Improvement suggestion |
| **Task** | Task |
| **Documentation** | Documentation issue |

**Priority Assessment**:
| Priority | Criteria |
|----------|----------|
| **Critical** | Blocking issue |
| **High** | Important issue |
| **Medium** | Normal issue |
| **Low** | Low priority |

**Usage Examples**:
```bash
# Discover issues from codebase
/issue-discover src/

# Discover issues from documentation
/issue-discover docs/

# Discover issues from test results
/issue-discover test-results/
```

## Related Commands

- [Codex Skills - Lifecycle](./codex-lifecycle.md)
- [Codex Skills - Workflow](./codex-workflow.md)
- [Claude Skills - Meta](./claude-meta.md)

## Best Practices

1. **Code cleanup**: Regularly use `clean` to clean up code
2. **Data processing**: Use `csv-wave-pipeline` for processing large data
3. **Memory management**: Regularly use `memory-compact` to optimize Memory
4. **CLI tools**: Use `ccw-cli-tools` for standardized CLI execution
5. **Issue discovery**: Use `issue-discover` to discover and classify issues

## Usage Examples

```bash
# Clean code
/clean src/

# Process CSV
/csv-wave-pipeline data.csv --output-format=json

# Compress Memory
/memory-compact --merge

# Execute CLI tool
/ccw-cli-tools --tool=gemini "Analyze code"

# Discover issues
/issue-discover src/
```
