"""Tests for AstGrepPythonProcessor.

Tests pattern-based relationship extraction from Python source code
using ast-grep-py bindings.
"""

from pathlib import Path

import pytest

from codexlens.parsers.astgrep_processor import (
    AstGrepPythonProcessor,
    BaseAstGrepProcessor,
    is_astgrep_processor_available,
)
from codexlens.parsers.patterns.python import (
    PYTHON_PATTERNS,
    METAVARS,
    RELATIONSHIP_PATTERNS,
    get_pattern,
    get_patterns_for_relationship,
    get_metavar,
)


# Check if ast-grep is available for conditional test skipping
ASTGREP_AVAILABLE = is_astgrep_processor_available()


class TestPatternDefinitions:
    """Tests for Python pattern definitions."""

    def test_python_patterns_exist(self):
        """Verify all expected patterns are defined."""
        expected_patterns = [
            "class_def",
            "class_with_bases",
            "func_def",
            "async_func_def",
            "import_stmt",
            "import_from",
            "call",
            "method_call",
        ]
        for pattern_name in expected_patterns:
            assert pattern_name in PYTHON_PATTERNS, f"Missing pattern: {pattern_name}"

    def test_get_pattern_returns_correct_pattern(self):
        """Test get_pattern returns expected pattern strings."""
        # Note: ast-grep-py 0.40+ uses $$$ for zero-or-more multi-match
        assert get_pattern("class_def") == "class $NAME $$$BODY"
        assert get_pattern("func_def") == "def $NAME($$$PARAMS): $$$BODY"
        assert get_pattern("import_stmt") == "import $MODULE"

    def test_get_pattern_raises_for_unknown(self):
        """Test get_pattern raises KeyError for unknown patterns."""
        with pytest.raises(KeyError):
            get_pattern("nonexistent_pattern")

    def test_metavars_defined(self):
        """Verify metavariable mappings are defined."""
        expected_metavars = [
            "class_name",
            "func_name",
            "import_module",
            "call_func",
        ]
        for var in expected_metavars:
            assert var in METAVARS, f"Missing metavar: {var}"

    def test_get_metavar(self):
        """Test get_metavar returns correct values."""
        assert get_metavar("class_name") == "NAME"
        assert get_metavar("func_name") == "NAME"
        assert get_metavar("import_module") == "MODULE"

    def test_relationship_patterns_mapping(self):
        """Test relationship type to pattern mapping."""
        assert "class_with_bases" in get_patterns_for_relationship("inheritance")
        assert "import_stmt" in get_patterns_for_relationship("imports")
        assert "import_from" in get_patterns_for_relationship("imports")
        assert "call" in get_patterns_for_relationship("calls")


class TestAstGrepPythonProcessorAvailability:
    """Tests for processor availability."""

    def test_is_available_returns_bool(self):
        """Test is_available returns a boolean."""
        processor = AstGrepPythonProcessor()
        assert isinstance(processor.is_available(), bool)

    def test_is_available_matches_global_check(self):
        """Test is_available matches is_astgrep_processor_available."""
        processor = AstGrepPythonProcessor()
        assert processor.is_available() == is_astgrep_processor_available()

    def test_module_level_check(self):
        """Test module-level availability function."""
        assert isinstance(is_astgrep_processor_available(), bool)


@pytest.mark.skipif(not ASTGREP_AVAILABLE, reason="ast-grep-py not installed")
class TestAstGrepPythonProcessorParsing:
    """Tests for Python parsing with ast-grep."""

    def test_parse_simple_function(self):
        """Test parsing a simple function definition."""
        processor = AstGrepPythonProcessor()
        code = "def hello():\n    pass"
        result = processor.parse(code, Path("test.py"))

        assert result is not None
        assert result.language == "python"
        assert len(result.symbols) == 1
        assert result.symbols[0].name == "hello"
        assert result.symbols[0].kind == "function"

    def test_parse_class(self):
        """Test parsing a class definition."""
        processor = AstGrepPythonProcessor()
        code = "class MyClass:\n    pass"
        result = processor.parse(code, Path("test.py"))

        assert result is not None
        assert len(result.symbols) == 1
        assert result.symbols[0].name == "MyClass"
        assert result.symbols[0].kind == "class"

    def test_parse_async_function(self):
        """Test parsing an async function definition."""
        processor = AstGrepPythonProcessor()
        code = "async def fetch_data():\n    pass"
        result = processor.parse(code, Path("test.py"))

        assert result is not None
        assert len(result.symbols) == 1
        assert result.symbols[0].name == "fetch_data"

    def test_parse_class_with_inheritance(self):
        """Test parsing class with inheritance."""
        processor = AstGrepPythonProcessor()
        code = """
class Base:
    pass

class Child(Base):
    pass
"""
        result = processor.parse(code, Path("test.py"))

        assert result is not None
        names = [s.name for s in result.symbols]
        assert "Base" in names
        assert "Child" in names

        # Check inheritance relationship
        inherits = [
            r for r in result.relationships
            if r.relationship_type.value == "inherits"
        ]
        assert any(r.source_symbol == "Child" for r in inherits)

    def test_parse_imports(self):
        """Test parsing import statements."""
        processor = AstGrepPythonProcessor()
        code = """
import os
from sys import path
"""
        result = processor.parse(code, Path("test.py"))

        assert result is not None
        imports = [
            r for r in result.relationships
            if r.relationship_type.value == "imports"
        ]
        assert len(imports) >= 1
        targets = {r.target_symbol for r in imports}
        assert "os" in targets

    def test_parse_function_calls(self):
        """Test parsing function calls."""
        processor = AstGrepPythonProcessor()
        code = """
def main():
    print("hello")
    len([1, 2, 3])
"""
        result = processor.parse(code, Path("test.py"))

        assert result is not None
        calls = [
            r for r in result.relationships
            if r.relationship_type.value == "calls"
        ]
        targets = {r.target_symbol for r in calls}
        assert "print" in targets
        assert "len" in targets

    def test_parse_empty_file(self):
        """Test parsing an empty file."""
        processor = AstGrepPythonProcessor()
        result = processor.parse("", Path("test.py"))

        assert result is not None
        assert len(result.symbols) == 0

    def test_parse_returns_indexed_file(self):
        """Test that parse returns proper IndexedFile structure."""
        processor = AstGrepPythonProcessor()
        code = "def test():\n    pass"
        result = processor.parse(code, Path("test.py"))

        assert result is not None
        assert result.path.endswith("test.py")
        assert result.language == "python"
        assert isinstance(result.symbols, list)
        assert isinstance(result.chunks, list)
        assert isinstance(result.relationships, list)


@pytest.mark.skipif(not ASTGREP_AVAILABLE, reason="ast-grep-py not installed")
class TestAstGrepPythonProcessorRelationships:
    """Tests for relationship extraction."""

    def test_inheritance_extraction(self):
        """Test extraction of inheritance relationships."""
        processor = AstGrepPythonProcessor()
        code = """
class Animal:
    pass

class Dog(Animal):
    pass

class Cat(Animal):
    pass
"""
        result = processor.parse(code, Path("test.py"))

        assert result is not None
        inherits = [
            r for r in result.relationships
            if r.relationship_type.value == "inherits"
        ]
        # Should have 2 inheritance relationships
        assert len(inherits) >= 2
        sources = {r.source_symbol for r in inherits}
        assert "Dog" in sources
        assert "Cat" in sources

    def test_call_extraction_skips_self(self):
        """Test that self.method() calls are filtered."""
        processor = AstGrepPythonProcessor()
        code = """
class Service:
    def process(self):
        self.internal()
        external_call()

def external_call():
    pass
"""
        result = processor.parse(code, Path("test.py"))

        assert result is not None
        calls = [
            r for r in result.relationships
            if r.relationship_type.value == "calls"
        ]
        targets = {r.target_symbol for r in calls}
        # self.internal should be filtered
        assert "self.internal" not in targets
        assert "external_call" in targets

    def test_import_with_alias_resolution(self):
        """Test import alias resolution in calls."""
        processor = AstGrepPythonProcessor()
        code = """
import os.path as osp

def main():
    osp.join("a", "b")
"""
        result = processor.parse(code, Path("test.py"))

        assert result is not None
        calls = [
            r for r in result.relationships
            if r.relationship_type.value == "calls"
        ]
        targets = {r.target_symbol for r in calls}
        # Should resolve osp to os.path
        assert any("os.path" in t for t in targets)


@pytest.mark.skipif(not ASTGREP_AVAILABLE, reason="ast-grep-py not installed")
class TestAstGrepPythonProcessorRunAstGrep:
    """Tests for run_ast_grep method."""

    def test_run_ast_grep_returns_list(self):
        """Test run_ast_grep returns a list."""
        processor = AstGrepPythonProcessor()
        code = "def hello():\n    pass"
        processor._binding.parse(code) if processor._binding else None

        matches = processor.run_ast_grep(code, "def $NAME($$$PARAMS) $$$BODY")
        assert isinstance(matches, list)

    def test_run_ast_grep_finds_matches(self):
        """Test run_ast_grep finds expected matches."""
        processor = AstGrepPythonProcessor()
        code = "def hello():\n    pass"

        matches = processor.run_ast_grep(code, "def $NAME($$$PARAMS) $$$BODY")
        assert len(matches) >= 1

    def test_run_ast_grep_empty_code(self):
        """Test run_ast_grep with empty code."""
        processor = AstGrepPythonProcessor()
        matches = processor.run_ast_grep("", "def $NAME($$$PARAMS) $$$BODY")
        assert matches == []

    def test_run_ast_grep_no_matches(self):
        """Test run_ast_grep when pattern doesn't match."""
        processor = AstGrepPythonProcessor()
        code = "x = 1"
        matches = processor.run_ast_grep(code, "class $NAME $$$BODY")
        assert matches == []


class TestAstGrepPythonProcessorFallback:
    """Tests for fallback behavior when ast-grep unavailable."""

    def test_parse_returns_none_when_unavailable(self):
        """Test parse returns None when ast-grep unavailable."""
        # This test runs regardless of availability
        # When unavailable, should gracefully return None
        processor = AstGrepPythonProcessor()
        if not processor.is_available():
            code = "def test():\n    pass"
            result = processor.parse(code, Path("test.py"))
            assert result is None

    def test_run_ast_grep_empty_when_unavailable(self):
        """Test run_ast_grep returns empty list when unavailable."""
        processor = AstGrepPythonProcessor()
        if not processor.is_available():
            matches = processor.run_ast_grep("code", "pattern")
            assert matches == []


class TestBaseAstGrepProcessor:
    """Tests for abstract base class."""

    def test_cannot_instantiate_base_class(self):
        """Test that BaseAstGrepProcessor cannot be instantiated directly."""
        with pytest.raises(TypeError):
            BaseAstGrepProcessor("python")  # type: ignore[abstract]

    def test_subclass_implements_abstract_methods(self):
        """Test that AstGrepPythonProcessor implements all abstract methods."""
        processor = AstGrepPythonProcessor()
        # Should have process_matches method
        assert hasattr(processor, "process_matches")
        # Should have parse method
        assert hasattr(processor, "parse")
        # Check methods are callable
        assert callable(processor.process_matches)
        assert callable(processor.parse)


class TestPatternIntegration:
    """Tests for pattern module integration with processor."""

    def test_processor_uses_pattern_module(self):
        """Verify processor uses patterns from pattern module."""
        # The processor should import and use patterns from patterns/python/
        from codexlens.parsers.astgrep_processor import get_pattern

        # Verify pattern access works
        assert get_pattern("class_def") is not None
        assert get_pattern("func_def") is not None

    def test_pattern_consistency(self):
        """Test pattern definitions are consistent."""
        # Patterns used by processor should exist in pattern module
        patterns_needed = [
            "class_def",
            "class_with_bases",
            "func_def",
            "async_func_def",
            "import_stmt",
            "import_from",
            "call",
        ]
        for pattern_name in patterns_needed:
            # Should not raise KeyError
            pattern = get_pattern(pattern_name)
            assert pattern is not None
            assert len(pattern) > 0
