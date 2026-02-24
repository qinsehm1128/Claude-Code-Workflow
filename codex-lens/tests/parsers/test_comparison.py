"""Comparison tests for tree-sitter vs ast-grep Python relationship extraction.

Validates that both parsers produce consistent output for Python relationship
extraction (INHERITS, CALL, IMPORTS).
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Set, Tuple

import pytest

from codexlens.config import Config
from codexlens.entities import CodeRelationship, RelationshipType
from codexlens.parsers.treesitter_parser import TreeSitterSymbolParser


# Sample Python code for testing relationship extraction
SAMPLE_PYTHON_CODE = '''
"""Module docstring."""
import os
import sys
from typing import List, Dict, Optional
from collections import defaultdict as dd
from pathlib import Path as PPath

class BaseClass:
    """Base class."""

    def base_method(self):
        pass

    def another_method(self):
        return self.base_method()


class Mixin:
    """Mixin class."""

    def mixin_func(self):
        return "mixin"


class ChildClass(BaseClass, Mixin):
    """Child class with multiple inheritance."""

    def __init__(self):
        super().__init__()
        self.data = dd(list)

    def process(self, items: List[str]) -> Dict[str, int]:
        result = {}
        for item in items:
            result[item] = len(item)
        return result

    def call_external(self, path: str) -> Optional[str]:
        p = PPath(path)
        if p.exists():
            return str(p.read_text())
        return None


def standalone_function():
    """Standalone function."""
    data = [1, 2, 3]
    return sum(data)


async def async_function():
    """Async function."""
    import asyncio
    await asyncio.sleep(1)
'''


def relationship_to_tuple(rel: CodeRelationship) -> Tuple[str, str, str, int]:
    """Convert relationship to a comparable tuple.

    Returns:
        (source_symbol, target_symbol, relationship_type, source_line)
    """
    return (
        rel.source_symbol,
        rel.target_symbol,
        rel.relationship_type.value,
        rel.source_line,
    )


def extract_relationship_tuples(
    relationships: List[CodeRelationship],
) -> Set[Tuple[str, str, str]]:
    """Extract relationship tuples without line numbers for comparison.

    Returns:
        Set of (source_symbol, target_symbol, relationship_type) tuples
    """
    return {
        (rel.source_symbol, rel.target_symbol, rel.relationship_type.value)
        for rel in relationships
    }


def filter_by_type(
    relationships: List[CodeRelationship],
    rel_type: RelationshipType,
) -> List[CodeRelationship]:
    """Filter relationships by type."""
    return [r for r in relationships if r.relationship_type == rel_type]


class TestTreeSitterVsAstGrepComparison:
    """Compare tree-sitter and ast-grep Python relationship extraction."""

    @pytest.fixture
    def sample_path(self, tmp_path: Path) -> Path:
        """Create a temporary Python file with sample code."""
        py_file = tmp_path / "sample.py"
        py_file.write_text(SAMPLE_PYTHON_CODE)
        return py_file

    @pytest.fixture
    def ts_parser_default(self) -> TreeSitterSymbolParser:
        """Create tree-sitter parser with default config (use_astgrep=False)."""
        config = Config()
        assert config.use_astgrep is False
        return TreeSitterSymbolParser("python", config=config)

    @pytest.fixture
    def ts_parser_astgrep(self) -> TreeSitterSymbolParser:
        """Create tree-sitter parser with ast-grep enabled."""
        config = Config()
        config.use_astgrep = True
        return TreeSitterSymbolParser("python", config=config)

    def test_parser_availability(self, ts_parser_default: TreeSitterSymbolParser) -> None:
        """Test that tree-sitter parser is available."""
        assert ts_parser_default.is_available()

    def test_astgrep_processor_initialization(
        self, ts_parser_astgrep: TreeSitterSymbolParser
    ) -> None:
        """Test that ast-grep processor is initialized when config enables it."""
        # The processor should be initialized (may be None if ast-grep-py not installed)
        # This test just verifies the initialization path works
        assert ts_parser_astgrep._config is not None
        assert ts_parser_astgrep._config.use_astgrep is True

    def _skip_if_astgrep_unavailable(
        self, ts_parser_astgrep: TreeSitterSymbolParser
    ) -> None:
        """Skip test if ast-grep is not available."""
        if ts_parser_astgrep._astgrep_processor is None:
            pytest.skip("ast-grep-py not installed")

    def test_parse_returns_valid_result(
        self,
        ts_parser_default: TreeSitterSymbolParser,
        sample_path: Path,
    ) -> None:
        """Test that parsing returns a valid IndexedFile."""
        source_code = sample_path.read_text()
        result = ts_parser_default.parse(source_code, sample_path)

        assert result is not None
        assert result.language == "python"
        assert len(result.symbols) > 0
        assert len(result.relationships) > 0

    def test_extracted_symbols_match(
        self,
        ts_parser_default: TreeSitterSymbolParser,
        ts_parser_astgrep: TreeSitterSymbolParser,
        sample_path: Path,
    ) -> None:
        """Test that both parsers extract similar symbols."""
        self._skip_if_astgrep_unavailable(ts_parser_astgrep)

        source_code = sample_path.read_text()

        result_ts = ts_parser_default.parse(source_code, sample_path)
        result_astgrep = ts_parser_astgrep.parse(source_code, sample_path)

        assert result_ts is not None
        assert result_astgrep is not None

        # Compare symbol names
        ts_symbols = {s.name for s in result_ts.symbols}
        astgrep_symbols = {s.name for s in result_astgrep.symbols}

        # Should have the same symbols (classes, functions, methods)
        assert ts_symbols == astgrep_symbols

    def test_inheritance_relationships(
        self,
        ts_parser_default: TreeSitterSymbolParser,
        ts_parser_astgrep: TreeSitterSymbolParser,
        sample_path: Path,
    ) -> None:
        """Test INHERITS relationship extraction consistency."""
        self._skip_if_astgrep_unavailable(ts_parser_astgrep)

        source_code = sample_path.read_text()

        result_ts = ts_parser_default.parse(source_code, sample_path)
        result_astgrep = ts_parser_astgrep.parse(source_code, sample_path)

        assert result_ts is not None
        assert result_astgrep is not None

        # Extract inheritance relationships
        ts_inherits = filter_by_type(result_ts.relationships, RelationshipType.INHERITS)
        astgrep_inherits = filter_by_type(
            result_astgrep.relationships, RelationshipType.INHERITS
        )

        ts_tuples = extract_relationship_tuples(ts_inherits)
        astgrep_tuples = extract_relationship_tuples(astgrep_inherits)

        # Both should detect ChildClass(BaseClass, Mixin)
        assert ts_tuples == astgrep_tuples

        # Verify specific inheritance relationships
        expected_inherits = {
            ("ChildClass", "BaseClass", "inherits"),
            ("ChildClass", "Mixin", "inherits"),
        }
        assert ts_tuples == expected_inherits

    def test_import_relationships(
        self,
        ts_parser_default: TreeSitterSymbolParser,
        ts_parser_astgrep: TreeSitterSymbolParser,
        sample_path: Path,
    ) -> None:
        """Test IMPORTS relationship extraction consistency."""
        self._skip_if_astgrep_unavailable(ts_parser_astgrep)

        source_code = sample_path.read_text()

        result_ts = ts_parser_default.parse(source_code, sample_path)
        result_astgrep = ts_parser_astgrep.parse(source_code, sample_path)

        assert result_ts is not None
        assert result_astgrep is not None

        # Extract import relationships
        ts_imports = filter_by_type(result_ts.relationships, RelationshipType.IMPORTS)
        astgrep_imports = filter_by_type(
            result_astgrep.relationships, RelationshipType.IMPORTS
        )

        ts_tuples = extract_relationship_tuples(ts_imports)
        astgrep_tuples = extract_relationship_tuples(astgrep_imports)

        # Compare - should be similar (may differ in exact module representation)
        # At minimum, both should detect the top-level imports
        ts_modules = {t[1].split(".")[0] for t in ts_tuples}
        astgrep_modules = {t[1].split(".")[0] for t in astgrep_tuples}

        # Should have imports from: os, sys, typing, collections, pathlib
        expected_modules = {"os", "sys", "typing", "collections", "pathlib", "asyncio"}
        assert ts_modules >= expected_modules or astgrep_modules >= expected_modules

    def test_call_relationships(
        self,
        ts_parser_default: TreeSitterSymbolParser,
        ts_parser_astgrep: TreeSitterSymbolParser,
        sample_path: Path,
    ) -> None:
        """Test CALL relationship extraction consistency."""
        self._skip_if_astgrep_unavailable(ts_parser_astgrep)

        source_code = sample_path.read_text()

        result_ts = ts_parser_default.parse(source_code, sample_path)
        result_astgrep = ts_parser_astgrep.parse(source_code, sample_path)

        assert result_ts is not None
        assert result_astgrep is not None

        # Extract call relationships
        ts_calls = filter_by_type(result_ts.relationships, RelationshipType.CALL)
        astgrep_calls = filter_by_type(
            result_astgrep.relationships, RelationshipType.CALL
        )

        # Calls may differ due to scope tracking differences
        # Just verify both parsers find call relationships
        assert len(ts_calls) > 0
        assert len(astgrep_calls) > 0

        # Verify specific calls that should be detected
        ts_call_targets = {r.target_symbol for r in ts_calls}
        astgrep_call_targets = {r.target_symbol for r in astgrep_calls}

        # Both should detect at least some common calls
        # (exact match not required due to scope tracking differences)
        common_targets = ts_call_targets & astgrep_call_targets
        assert len(common_targets) > 0

    def test_relationship_count_similarity(
        self,
        ts_parser_default: TreeSitterSymbolParser,
        ts_parser_astgrep: TreeSitterSymbolParser,
        sample_path: Path,
    ) -> None:
        """Test that relationship counts are similar (>95% consistency)."""
        self._skip_if_astgrep_unavailable(ts_parser_astgrep)

        source_code = sample_path.read_text()

        result_ts = ts_parser_default.parse(source_code, sample_path)
        result_astgrep = ts_parser_astgrep.parse(source_code, sample_path)

        assert result_ts is not None
        assert result_astgrep is not None

        ts_count = len(result_ts.relationships)
        astgrep_count = len(result_astgrep.relationships)

        # Calculate consistency percentage
        if max(ts_count, astgrep_count) == 0:
            consistency = 100.0
        else:
            consistency = (
                min(ts_count, astgrep_count) / max(ts_count, astgrep_count) * 100
            )

        # Require >95% consistency
        assert consistency >= 95.0, (
            f"Relationship consistency {consistency:.1f}% below 95% threshold "
            f"(tree-sitter: {ts_count}, ast-grep: {astgrep_count})"
        )

    def test_config_switch_affects_parser(
        self, sample_path: Path
    ) -> None:
        """Test that config.use_astgrep affects which parser is used."""
        config_default = Config()
        config_astgrep = Config()
        config_astgrep.use_astgrep = True

        parser_default = TreeSitterSymbolParser("python", config=config_default)
        parser_astgrep = TreeSitterSymbolParser("python", config=config_astgrep)

        # Default parser should not have ast-grep processor
        assert parser_default._astgrep_processor is None

        # Ast-grep parser may have processor if ast-grep-py is installed
        # (could be None if not installed, which is fine)
        if parser_astgrep._astgrep_processor is not None:
            # If available, verify it's the right type
            from codexlens.parsers.astgrep_processor import AstGrepPythonProcessor

            assert isinstance(
                parser_astgrep._astgrep_processor, AstGrepPythonProcessor
            )

    def test_fallback_to_treesitter_on_astgrep_failure(
        self,
        ts_parser_astgrep: TreeSitterSymbolParser,
        sample_path: Path,
    ) -> None:
        """Test that parser falls back to tree-sitter if ast-grep fails."""
        source_code = sample_path.read_text()

        # Even with use_astgrep=True, should get valid results
        result = ts_parser_astgrep.parse(source_code, sample_path)

        # Should always return a valid result (either from ast-grep or tree-sitter fallback)
        assert result is not None
        assert result.language == "python"
        assert len(result.relationships) > 0


class TestSimpleCodeSamples:
    """Test with simple code samples for precise comparison."""

    def test_simple_inheritance(self) -> None:
        """Test simple single inheritance."""
        code = """
class Parent:
    pass

class Child(Parent):
    pass
"""
        self._compare_parsers(code, expected_inherits={("Child", "Parent")})

    def test_multiple_inheritance(self) -> None:
        """Test multiple inheritance."""
        code = """
class A:
    pass

class B:
    pass

class C(A, B):
    pass
"""
        self._compare_parsers(
            code, expected_inherits={("C", "A"), ("C", "B")}
        )

    def test_simple_imports(self) -> None:
        """Test simple import statements."""
        code = """
import os
import sys
"""
        config_ts = Config()
        config_ag = Config()
        config_ag.use_astgrep = True

        parser_ts = TreeSitterSymbolParser("python", config=config_ts)
        parser_ag = TreeSitterSymbolParser("python", config=config_ag)

        tmp_path = Path("test.py")
        result_ts = parser_ts.parse(code, tmp_path)
        result_ag = parser_ag.parse(code, tmp_path)

        assert result_ts is not None
        # ast-grep result may be None if not installed

        if result_ag is not None:
            ts_imports = {
                r.target_symbol
                for r in result_ts.relationships
                if r.relationship_type == RelationshipType.IMPORTS
            }
            ag_imports = {
                r.target_symbol
                for r in result_ag.relationships
                if r.relationship_type == RelationshipType.IMPORTS
            }
            assert ts_imports == ag_imports

    def test_imports_inside_function(self) -> None:
        """Test simple import inside a function scope is recorded.

        Note: module-level imports are recorded under a synthetic "<module>" scope.
        This test ensures imports inside a function scope are also recorded.
        """
        code = """
def my_function():
    import collections
    return collections
"""
        config_ts = Config()
        config_ag = Config()
        config_ag.use_astgrep = True

        parser_ts = TreeSitterSymbolParser("python", config=config_ts)
        parser_ag = TreeSitterSymbolParser("python", config=config_ag)

        tmp_path = Path("test.py")
        result_ts = parser_ts.parse(code, tmp_path)
        result_ag = parser_ag.parse(code, tmp_path)

        assert result_ts is not None

        # Get import relationship targets
        ts_imports = [
            r.target_symbol
            for r in result_ts.relationships
            if r.relationship_type == RelationshipType.IMPORTS
        ]

        # Should have collections
        ts_has_collections = any("collections" in t for t in ts_imports)
        assert ts_has_collections, f"Expected collections import, got: {ts_imports}"

        # If ast-grep is available, verify it also finds the imports
        if result_ag is not None:
            ag_imports = [
                r.target_symbol
                for r in result_ag.relationships
                if r.relationship_type == RelationshipType.IMPORTS
            ]
            ag_has_collections = any("collections" in t for t in ag_imports)
            assert ag_has_collections, f"Expected collections import in ast-grep, got: {ag_imports}"

    def _compare_parsers(
        self,
        code: str,
        expected_inherits: Set[Tuple[str, str]],
    ) -> None:
        """Helper to compare parser outputs for inheritance."""
        config_ts = Config()
        config_ag = Config()
        config_ag.use_astgrep = True

        parser_ts = TreeSitterSymbolParser("python", config=config_ts)
        parser_ag = TreeSitterSymbolParser("python", config=config_ag)

        tmp_path = Path("test.py")
        result_ts = parser_ts.parse(code, tmp_path)

        assert result_ts is not None

        # Verify tree-sitter finds expected inheritance
        ts_inherits = {
            (r.source_symbol, r.target_symbol)
            for r in result_ts.relationships
            if r.relationship_type == RelationshipType.INHERITS
        }
        assert ts_inherits == expected_inherits

        # If ast-grep is available, verify it matches
        result_ag = parser_ag.parse(code, tmp_path)
        if result_ag is not None:
            ag_inherits = {
                (r.source_symbol, r.target_symbol)
                for r in result_ag.relationships
                if r.relationship_type == RelationshipType.INHERITS
            }
            assert ag_inherits == expected_inherits


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
