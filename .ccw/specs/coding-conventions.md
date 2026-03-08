# Coding Conventions

## Navigation & Path Handling

- [navigation] When creating navigation links between artifacts, always compute relative paths from the artifact's actual location, not from an assumed location. Test path resolution before committing. (learned: 2026-03-07)
- [schema] Always include schema_version field in index/registry files to enable safe evolution and migration detection. (learned: 2026-03-07)
- [error-handling] When adding version checks or validation, always continue with degraded functionality rather than failing hard. Log warnings but don't block execution. (learned: 2026-03-07)

## Document Generation

- [architecture] For document generation systems, adopt Layer 3→2→1 pattern (components → features → indexes) for efficient incremental updates. (learned: 2026-03-07)

## Implementation Quality

- [validation] Path calculation errors are subtle and hard to spot in static review. Always verify path resolution from the actual file location, not from documentation. (learned: 2026-03-07)
- [implementation] Declaring "add X to Y" in documentation is not enough - the actual logic must be implemented in the target files. (learned: 2026-03-07)
- [clarity] Explicit instructions are better than implicit ones. Vague instructions like "Update _index.md files" should be made explicit (e.g., "Update sessions/_index.md"). (learned: 2026-03-07)
