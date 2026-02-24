"""Comparison tests for tree-sitter vs ast-grep JS/TS relationship extraction.

These tests focus on stable, high-signal relationship types used by the
static graph pipeline:
- IMPORTS
- INHERITS

If ast-grep-py is not installed, tests are skipped.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Set, Tuple

import pytest

from codexlens.config import Config
from codexlens.entities import CodeRelationship, RelationshipType
from codexlens.parsers.treesitter_parser import TreeSitterSymbolParser


SAMPLE_JS_CODE = """
import React, { useEffect as useEf } from "react";
import { foo } from "./foo";
import "./styles.css";
const fs = require("fs");

class Base {}
class Child extends Base {
  method() {
    console.log("hi");
  }
}
"""


SAMPLE_TS_CODE = """
import type { Foo } from "pkg";
import { bar as baz } from "./bar";

interface MyInterface extends Foo {}

class Base {}
class Child extends Base {}
"""


def extract_relationship_tuples(
    relationships: List[CodeRelationship],
    *,
    only_types: Set[RelationshipType],
) -> Set[Tuple[str, str, str]]:
    return {
        (rel.source_symbol, rel.target_symbol, rel.relationship_type.value)
        for rel in relationships
        if rel.relationship_type in only_types
    }


def _skip_if_astgrep_unavailable(parser: TreeSitterSymbolParser) -> None:
    if parser._astgrep_processor is None or not parser._astgrep_processor.is_available():  # type: ignore[attr-defined]
        pytest.skip("ast-grep-py not installed or language not supported")


def test_js_imports_and_inherits_match(tmp_path: Path) -> None:
    js_file = tmp_path / "sample.js"
    js_file.write_text(SAMPLE_JS_CODE, encoding="utf-8")
    source = js_file.read_text(encoding="utf-8")

    config_default = Config()
    config_default.use_astgrep = False
    ts_default = TreeSitterSymbolParser("javascript", js_file, config=config_default)

    config_ast = Config()
    config_ast.use_astgrep = True
    ts_ast = TreeSitterSymbolParser("javascript", js_file, config=config_ast)
    _skip_if_astgrep_unavailable(ts_ast)

    result_ts = ts_default.parse(source, js_file)
    result_ast = ts_ast.parse(source, js_file)

    assert result_ts is not None
    assert result_ast is not None

    ts_imports = extract_relationship_tuples(
        result_ts.relationships,
        only_types={RelationshipType.IMPORTS},
    )
    ast_imports = extract_relationship_tuples(
        result_ast.relationships,
        only_types={RelationshipType.IMPORTS},
    )
    assert ast_imports == ts_imports

    ts_inherits = extract_relationship_tuples(
        result_ts.relationships,
        only_types={RelationshipType.INHERITS},
    )
    ast_inherits = extract_relationship_tuples(
        result_ast.relationships,
        only_types={RelationshipType.INHERITS},
    )
    # Ast-grep may include inheritance edges that the tree-sitter extractor does not currently emit.
    assert ts_inherits.issubset(ast_inherits)
    assert ("Child", "Base", "inherits") in ast_inherits


def test_ts_imports_match_and_inherits_superset(tmp_path: Path) -> None:
    ts_file = tmp_path / "sample.ts"
    ts_file.write_text(SAMPLE_TS_CODE, encoding="utf-8")
    source = ts_file.read_text(encoding="utf-8")

    config_default = Config()
    config_default.use_astgrep = False
    ts_default = TreeSitterSymbolParser("typescript", ts_file, config=config_default)

    config_ast = Config()
    config_ast.use_astgrep = True
    ts_ast = TreeSitterSymbolParser("typescript", ts_file, config=config_ast)
    _skip_if_astgrep_unavailable(ts_ast)

    result_ts = ts_default.parse(source, ts_file)
    result_ast = ts_ast.parse(source, ts_file)

    assert result_ts is not None
    assert result_ast is not None

    ts_imports = extract_relationship_tuples(
        result_ts.relationships,
        only_types={RelationshipType.IMPORTS},
    )
    ast_imports = extract_relationship_tuples(
        result_ast.relationships,
        only_types={RelationshipType.IMPORTS},
    )
    assert ast_imports == ts_imports

    ts_inherits = extract_relationship_tuples(
        result_ts.relationships,
        only_types={RelationshipType.INHERITS},
    )
    ast_inherits = extract_relationship_tuples(
        result_ast.relationships,
        only_types={RelationshipType.INHERITS},
    )
    # Ast-grep may include additional TypeScript inheritance edges (e.g., interface extends).
    assert ts_inherits.issubset(ast_inherits)
    # But at minimum, class inheritance should be present.
    assert ("Child", "Base", "inherits") in ast_inherits
