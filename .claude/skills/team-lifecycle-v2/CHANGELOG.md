# Changelog

## v2.1 - Architecture Fix (2026-03-05)

### Fixed
- **Critical**: Removed subagent calls from worker role-specs
- Workers now correctly use CLI tools instead of attempting Agent() spawn
- Removed subagents directory (workers cannot use it)
- Updated SKILL.md to clarify architectural constraints

### Changed
- Multi-perspective critique: Now uses parallel CLI calls
- Codebase exploration: Now uses `ccw cli --tool gemini`
- Document generation: Now uses `ccw cli --tool gemini --mode write`

### Impact
- No functional change for users
- Implementation now architecturally correct
- Workers will no longer fail with "Unknown skill: Agent"

### Files Modified
- `SKILL.md`: Replaced "Subagent Registry" with "CLI Tool Usage in Workers"
- `role-specs/analyst.md`: Removed `subagents: [discuss]`, replaced discuss subagent call with parallel CLI calls
- `role-specs/writer.md`: Removed `subagents: [discuss]`, replaced discuss subagent call with parallel CLI calls
- `role-specs/reviewer.md`: Removed `subagents: [discuss]`, replaced discuss subagent call with parallel CLI calls
- `role-specs/planner.md`: Updated complexity routing table to reference CLI exploration
- `role-specs/architect.md`: Removed `subagents: [explore]`
- `subagents/`: Directory removed

### Technical Details

**Why Workers Cannot Spawn Subagents**:
When a worker attempts `Agent()`, it fails with "Unknown skill: Agent". Only the Coordinator (main conversation context) can spawn agents.

**Worker Capabilities**:
- ✅ Built-in tools: Read, Write, Edit, Bash, Grep, Glob
- ✅ CLI tools: `ccw cli --tool gemini/codex/qwen`
- ❌ Agent spawn: Cannot call `Agent()` to spawn subagents

**Multi-Perspective Critique Implementation**:
Workers now use parallel CLI calls with `run_in_background: true`:
```bash
Bash(`ccw cli -p "..." --tool gemini --mode analysis`, { run_in_background: true })
Bash(`ccw cli -p "..." --tool codex --mode analysis`, { run_in_background: true })
Bash(`ccw cli -p "..." --tool claude --mode analysis`, { run_in_background: true })
```
