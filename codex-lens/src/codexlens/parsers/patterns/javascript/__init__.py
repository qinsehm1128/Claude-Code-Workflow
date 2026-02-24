"""JavaScript ast-grep patterns for relationship extraction.

These patterns are used by CodexLens' optional ast-grep processors to extract:
- IMPORTS: ES module imports + CommonJS require()
- INHERITS: class extends relationships

Pattern Syntax (ast-grep-py 0.40+):
    $VAR       - Single metavariable (matches one AST node)
    $$$VAR     - Multiple metavariable (matches zero or more nodes)
"""

from __future__ import annotations

from typing import Dict, List


JAVASCRIPT_PATTERNS: Dict[str, str] = {
    # ES module imports
    # import React from "react"
    # import React, { useEffect } from "react"
    # import { useEffect } from "react"
    # import * as fs from "fs"
    "import_from_dq": "import $$$IMPORTS from \"$MODULE\"",
    "import_from_sq": "import $$$IMPORTS from '$MODULE'",
    "import_named_only_dq": "import {$$$NAMES} from \"$MODULE\"",
    "import_named_only_sq": "import {$$$NAMES} from '$MODULE'",
    "import_default_named_dq": "import $DEFAULT, {$$$NAMES} from \"$MODULE\"",
    "import_default_named_sq": "import $DEFAULT, {$$$NAMES} from '$MODULE'",
    # Side-effect import: import "./styles.css"
    "import_side_effect_dq": "import \"$MODULE\"",
    "import_side_effect_sq": "import '$MODULE'",

    # CommonJS require(): const fs = require("fs")
    "require_call_dq": "require(\"$MODULE\")",
    "require_call_sq": "require('$MODULE')",

    # Class inheritance: class Child extends Base {}
    # Note: `{...}` form matches both JS and TS grammars more reliably.
    "class_extends": "class $NAME extends $BASE {$$$BODY}",
}


METAVARS = {
    "module": "MODULE",
    "import_names": "NAMES",
    "import_default": "DEFAULT",
    "class_name": "NAME",
    "class_base": "BASE",
}


RELATIONSHIP_PATTERNS: Dict[str, List[str]] = {
    "imports": [
        "import_from_dq",
        "import_from_sq",
        "import_named_only_dq",
        "import_named_only_sq",
        "import_default_named_dq",
        "import_default_named_sq",
        "import_side_effect_dq",
        "import_side_effect_sq",
        "require_call_dq",
        "require_call_sq",
    ],
    "inheritance": ["class_extends"],
}


def get_pattern(pattern_name: str) -> str:
    if pattern_name not in JAVASCRIPT_PATTERNS:
        raise KeyError(
            f"Unknown JS pattern: {pattern_name}. Available: {list(JAVASCRIPT_PATTERNS.keys())}"
        )
    return JAVASCRIPT_PATTERNS[pattern_name]


def get_patterns_for_relationship(rel_type: str) -> List[str]:
    return RELATIONSHIP_PATTERNS.get(rel_type, [])


def get_metavar(name: str) -> str:
    return METAVARS.get(name, name.upper())


__all__ = [
    "JAVASCRIPT_PATTERNS",
    "METAVARS",
    "RELATIONSHIP_PATTERNS",
    "get_pattern",
    "get_patterns_for_relationship",
    "get_metavar",
]
