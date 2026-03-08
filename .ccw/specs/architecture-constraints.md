# Architecture Constraints

## Schema Evolution

- [compatibility] When enhancing existing schemas, use optional fields and additionalProperties rather than creating new schemas. Avoid breaking changes.
- [portability] Use relative paths for cross-artifact navigation to ensure portability across different environments and installations.
