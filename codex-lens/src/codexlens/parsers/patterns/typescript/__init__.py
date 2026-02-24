"""TypeScript ast-grep patterns for relationship extraction.

This module extends the JavaScript patterns with TypeScript-specific syntax
such as `import type` and `interface ... extends ...`.
"""

from __future__ import annotations

from typing import Dict, List

from codexlens.parsers.patterns.javascript import (
    METAVARS,
    RELATIONSHIP_PATTERNS as _JS_RELATIONSHIP_PATTERNS,
    JAVASCRIPT_PATTERNS,
)


TYPESCRIPT_PATTERNS: Dict[str, str] = {
    **JAVASCRIPT_PATTERNS,
    # Type-only imports
    "import_type_from_dq": "import type $$$IMPORTS from \"$MODULE\"",
    "import_type_from_sq": "import type $$$IMPORTS from '$MODULE'",
    "import_type_named_only_dq": "import type {$$$NAMES} from \"$MODULE\"",
    "import_type_named_only_sq": "import type {$$$NAMES} from '$MODULE'",
    "import_type_default_named_dq": "import type $DEFAULT, {$$$NAMES} from \"$MODULE\"",
    "import_type_default_named_sq": "import type $DEFAULT, {$$$NAMES} from '$MODULE'",
    # Interface inheritance: interface Foo extends Bar {}
    "interface_extends": "interface $NAME extends $BASE $$$BODY",
}


RELATIONSHIP_PATTERNS: Dict[str, List[str]] = {
    **_JS_RELATIONSHIP_PATTERNS,
    "imports": [
        *_JS_RELATIONSHIP_PATTERNS.get("imports", []),
        "import_type_from_dq",
        "import_type_from_sq",
        "import_type_named_only_dq",
        "import_type_named_only_sq",
        "import_type_default_named_dq",
        "import_type_default_named_sq",
    ],
    "inheritance": [
        *_JS_RELATIONSHIP_PATTERNS.get("inheritance", []),
        "interface_extends",
    ],
}


def get_pattern(pattern_name: str) -> str:
    if pattern_name not in TYPESCRIPT_PATTERNS:
        raise KeyError(
            f"Unknown TS pattern: {pattern_name}. Available: {list(TYPESCRIPT_PATTERNS.keys())}"
        )
    return TYPESCRIPT_PATTERNS[pattern_name]


def get_patterns_for_relationship(rel_type: str) -> List[str]:
    return RELATIONSHIP_PATTERNS.get(rel_type, [])


def get_metavar(name: str) -> str:
    return METAVARS.get(name, name.upper())


__all__ = [
    "TYPESCRIPT_PATTERNS",
    "METAVARS",
    "RELATIONSHIP_PATTERNS",
    "get_pattern",
    "get_patterns_for_relationship",
    "get_metavar",
]
