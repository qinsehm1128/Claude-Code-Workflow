"""Python ast-grep patterns for relationship extraction.

This module defines declarative patterns for extracting code relationships
(inheritance, calls, imports) from Python source code using ast-grep.

Pattern Syntax (ast-grep-py 0.40+):
    $VAR       - Single metavariable (matches one AST node)
    $$$VAR     - Multiple metavariable (matches zero or more nodes)

Example:
    "class $CLASS_NAME($$$BASES) $$$BODY" matches:
        class MyClass(BaseClass):
            pass
    with $CLASS_NAME = "MyClass", $$$BASES = "BaseClass", $$$BODY = "pass"

YAML Pattern Files:
    inherits.yaml - INHERITS relationship patterns (single/multiple inheritance)
    imports.yaml  - IMPORTS relationship patterns (import, from...import, as)
    call.yaml     - CALL relationship patterns (function/method calls)
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional

# Directory containing YAML pattern files
PATTERNS_DIR = Path(__file__).parent

# Python ast-grep patterns organized by relationship type
# Note: ast-grep-py 0.40+ uses $$$ for zero-or-more multi-match
PYTHON_PATTERNS: Dict[str, str] = {
    # Class definitions with inheritance
    "class_def": "class $NAME $$$BODY",
    "class_with_bases": "class $NAME($$$BASES) $$$BODY",

    # Single inheritance: class Child(Parent):
    "single_inheritance": "class $CLASS_NAME($BASE) $$$BODY",

    # Multiple inheritance: class Child(A, B, C):
    "multiple_inheritance": "class $CLASS_NAME($BASE, $$$MORE_BASES) $$$BODY",

    # Function definitions (use $$$ for zero-or-more params)
    "func_def": "def $NAME($$$PARAMS): $$$BODY",
    "async_func_def": "async def $NAME($$$PARAMS): $$$BODY",

    # Import statements - basic forms
    "import_stmt": "import $MODULE",
    "import_from": "from $MODULE import $NAMES",

    # Import statements - extended forms
    "import_with_alias": "import $MODULE as $ALIAS",
    "import_multiple": "import $FIRST, $$$REST",
    "from_import_single": "from $MODULE import $NAME",
    "from_import_with_alias": "from $MODULE import $NAME as $ALIAS",
    "from_import_multiple": "from $MODULE import $FIRST, $$$REST",
    "from_import_star": "from $MODULE import *",
    "relative_import": "from .$$$MODULE import $NAMES",

    # Function/method calls - basic form (use $$$ for zero-or-more args)
    "call": "$FUNC($$$ARGS)",
    "method_call": "$OBJ.$METHOD($$$ARGS)",

    # Function/method calls - specific forms
    "simple_call": "$FUNC()",
    "call_with_args": "$FUNC($$$ARGS)",
    "chained_call": "$OBJ.$METHOD($$$ARGS).$$$CHAIN",
    "constructor_call": "$CLASS($$$ARGS)",
}

# Metavariable names for extracting match data
METAVARS = {
    # Class patterns
    "class_name": "NAME",
    "class_bases": "BASES",
    "class_body": "BODY",
    "inherit_class": "CLASS_NAME",
    "inherit_base": "BASE",
    "inherit_more_bases": "MORE_BASES",

    # Function patterns
    "func_name": "NAME",
    "func_params": "PARAMS",
    "func_body": "BODY",

    # Import patterns
    "import_module": "MODULE",
    "import_names": "NAMES",
    "import_alias": "ALIAS",
    "import_first": "FIRST",
    "import_rest": "REST",

    # Call patterns
    "call_func": "FUNC",
    "call_obj": "OBJ",
    "call_method": "METHOD",
    "call_args": "ARGS",
    "call_class": "CLASS",
    "call_chain": "CHAIN",
}

# Relationship pattern mapping - expanded for new patterns
RELATIONSHIP_PATTERNS: Dict[str, List[str]] = {
    "inheritance": ["class_with_bases", "single_inheritance", "multiple_inheritance"],
    "imports": [
        "import_stmt", "import_from",
        "import_with_alias", "import_multiple",
        "from_import_single", "from_import_with_alias",
        "from_import_multiple", "from_import_star",
        "relative_import",
    ],
    "calls": ["call", "method_call", "simple_call", "call_with_args", "constructor_call"],
}

# YAML pattern file mapping
YAML_PATTERN_FILES = {
    "inheritance": "inherits.yaml",
    "imports": "imports.yaml",
    "calls": "call.yaml",
}


def get_pattern(pattern_name: str) -> str:
    """Get an ast-grep pattern by name.

    Args:
        pattern_name: Key from PYTHON_PATTERNS dict

    Returns:
        Pattern string

    Raises:
        KeyError: If pattern name not found
    """
    if pattern_name not in PYTHON_PATTERNS:
        raise KeyError(f"Unknown pattern: {pattern_name}. Available: {list(PYTHON_PATTERNS.keys())}")
    return PYTHON_PATTERNS[pattern_name]


def get_patterns_for_relationship(rel_type: str) -> List[str]:
    """Get all patterns that can extract a given relationship type.

    Args:
        rel_type: Relationship type (inheritance, imports, calls)

    Returns:
        List of pattern names
    """
    return RELATIONSHIP_PATTERNS.get(rel_type, [])


def get_metavar(name: str) -> str:
    """Get metavariable name without $ prefix.

    Args:
        name: Key from METAVARS dict

    Returns:
        Metavariable name (e.g., "NAME" not "$NAME")
    """
    return METAVARS.get(name, name.upper())


def get_yaml_pattern_path(rel_type: str) -> Optional[Path]:
    """Get the path to a YAML pattern file for a relationship type.

    Args:
        rel_type: Relationship type (inheritance, imports, calls)

    Returns:
        Path to YAML file or None if not found
    """
    filename = YAML_PATTERN_FILES.get(rel_type)
    if filename:
        return PATTERNS_DIR / filename
    return None


def list_yaml_pattern_files() -> Dict[str, Path]:
    """List all available YAML pattern files.

    Returns:
        Dict mapping relationship type to YAML file path
    """
    result = {}
    for rel_type, filename in YAML_PATTERN_FILES.items():
        path = PATTERNS_DIR / filename
        if path.exists():
            result[rel_type] = path
    return result


__all__ = [
    "PYTHON_PATTERNS",
    "METAVARS",
    "RELATIONSHIP_PATTERNS",
    "YAML_PATTERN_FILES",
    "PATTERNS_DIR",
    "get_pattern",
    "get_patterns_for_relationship",
    "get_metavar",
    "get_yaml_pattern_path",
    "list_yaml_pattern_files",
]
