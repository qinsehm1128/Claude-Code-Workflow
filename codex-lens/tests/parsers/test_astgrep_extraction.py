"""Tests for dedicated extraction methods: extract_inherits, extract_calls, extract_imports.

Tests pattern-based relationship extraction from Python source code
using ast-grep-py bindings for INHERITS, CALL, and IMPORTS relationships.
"""

from pathlib import Path

import pytest

from codexlens.parsers.astgrep_processor import (
    AstGrepPythonProcessor,
    is_astgrep_processor_available,
)
from codexlens.entities import RelationshipType


# Check if ast-grep is available for conditional test skipping
ASTGREP_AVAILABLE = is_astgrep_processor_available()


@pytest.mark.skipif(not ASTGREP_AVAILABLE, reason="ast-grep-py not installed")
class TestExtractInherits:
    """Tests for extract_inherits method - INHERITS relationship extraction."""

    def test_single_inheritance(self):
        """Test extraction of single inheritance relationship."""
        processor = AstGrepPythonProcessor()
        code = """
class Animal:
    pass

class Dog(Animal):
    pass
"""
        relationships = processor.extract_inherits(code, "test.py")

        assert len(relationships) == 1
        rel = relationships[0]
        assert rel.source_symbol == "Dog"
        assert rel.target_symbol == "Animal"
        assert rel.relationship_type == RelationshipType.INHERITS

    def test_multiple_inheritance(self):
        """Test extraction of multiple inheritance relationships."""
        processor = AstGrepPythonProcessor()
        code = """
class A:
    pass

class B:
    pass

class C(A, B):
    pass
"""
        relationships = processor.extract_inherits(code, "test.py")

        # Should have 2 relationships: C->A and C->B
        assert len(relationships) == 2
        targets = {r.target_symbol for r in relationships}
        assert "A" in targets
        assert "B" in targets
        for rel in relationships:
            assert rel.source_symbol == "C"

    def test_no_inheritance(self):
        """Test that classes without inheritance return empty list."""
        processor = AstGrepPythonProcessor()
        code = """
class Standalone:
    pass
"""
        relationships = processor.extract_inherits(code, "test.py")

        assert len(relationships) == 0

    def test_nested_class_inheritance(self):
        """Test extraction of inheritance in nested classes."""
        processor = AstGrepPythonProcessor()
        code = """
class Outer:
    class Inner(Base):
        pass
"""
        relationships = processor.extract_inherits(code, "test.py")

        assert len(relationships) == 1
        assert relationships[0].source_symbol == "Inner"
        assert relationships[0].target_symbol == "Base"

    def test_inheritance_with_complex_bases(self):
        """Test extraction with generic or complex base classes."""
        processor = AstGrepPythonProcessor()
        code = """
class Service(BaseService, mixins.Loggable):
    pass
"""
        relationships = processor.extract_inherits(code, "test.py")

        assert len(relationships) == 2
        targets = {r.target_symbol for r in relationships}
        assert "BaseService" in targets
        assert "mixins.Loggable" in targets


@pytest.mark.skipif(not ASTGREP_AVAILABLE, reason="ast-grep-py not installed")
class TestExtractCalls:
    """Tests for extract_calls method - CALL relationship extraction."""

    def test_simple_function_call(self):
        """Test extraction of simple function calls."""
        processor = AstGrepPythonProcessor()
        code = """
def main():
    print("hello")
    len([1, 2, 3])
"""
        relationships = processor.extract_calls(code, "test.py", "main")

        targets = {r.target_symbol for r in relationships}
        assert "print" in targets
        assert "len" in targets

    def test_method_call(self):
        """Test extraction of method calls."""
        processor = AstGrepPythonProcessor()
        code = """
def process():
    obj.method()
    items.append(1)
"""
        relationships = processor.extract_calls(code, "test.py", "process")

        targets = {r.target_symbol for r in relationships}
        assert "obj.method" in targets
        assert "items.append" in targets

    def test_skips_self_calls(self):
        """Test that self.method() calls are filtered."""
        processor = AstGrepPythonProcessor()
        code = """
class Service:
    def process(self):
        self.internal()
        external_func()
"""
        relationships = processor.extract_calls(code, "test.py", "Service")

        targets = {r.target_symbol for r in relationships}
        # self.internal should be filtered
        assert "self.internal" not in targets
        assert "internal" not in targets
        assert "external_func" in targets

    def test_skips_cls_calls(self):
        """Test that cls.method() calls are filtered."""
        processor = AstGrepPythonProcessor()
        code = """
class Factory:
    @classmethod
    def create(cls):
        cls.helper()
        other_func()
"""
        relationships = processor.extract_calls(code, "test.py", "Factory")

        targets = {r.target_symbol for r in relationships}
        assert "cls.helper" not in targets
        assert "other_func" in targets

    def test_alias_resolution(self):
        """Test call alias resolution using import map."""
        processor = AstGrepPythonProcessor()
        code = """
def main():
    np.array([1, 2, 3])
"""
        alias_map = {"np": "numpy"}
        relationships = processor.extract_calls(code, "test.py", "main", alias_map)

        assert len(relationships) >= 1
        # Should resolve np.array to numpy.array
        assert any("numpy.array" in r.target_symbol for r in relationships)

    def test_no_calls(self):
        """Test that code without calls returns empty list."""
        processor = AstGrepPythonProcessor()
        code = """
x = 1
y = x + 2
"""
        relationships = processor.extract_calls(code, "test.py")

        assert len(relationships) == 0


@pytest.mark.skipif(not ASTGREP_AVAILABLE, reason="ast-grep-py not installed")
class TestExtractImports:
    """Tests for extract_imports method - IMPORTS relationship extraction."""

    def test_simple_import(self):
        """Test extraction of simple import statements."""
        processor = AstGrepPythonProcessor()
        code = "import os"

        relationships, alias_map = processor.extract_imports(code, "test.py")

        assert len(relationships) == 1
        assert relationships[0].target_symbol == "os"
        assert relationships[0].relationship_type == RelationshipType.IMPORTS
        assert alias_map.get("os") == "os"

    def test_import_with_alias(self):
        """Test extraction of import with alias."""
        processor = AstGrepPythonProcessor()
        code = "import numpy as np"

        relationships, alias_map = processor.extract_imports(code, "test.py")

        assert len(relationships) == 1
        assert relationships[0].target_symbol == "numpy"
        assert alias_map.get("np") == "numpy"

    def test_from_import(self):
        """Test extraction of from-import statements."""
        processor = AstGrepPythonProcessor()
        code = "from typing import List, Dict"

        relationships, alias_map = processor.extract_imports(code, "test.py")

        assert len(relationships) == 1
        assert relationships[0].target_symbol == "typing"
        assert alias_map.get("List") == "typing.List"
        assert alias_map.get("Dict") == "typing.Dict"

    def test_from_import_with_alias(self):
        """Test extraction of from-import with alias."""
        processor = AstGrepPythonProcessor()
        code = "from collections import defaultdict as dd"

        relationships, alias_map = processor.extract_imports(code, "test.py")

        assert len(relationships) == 1
        # The alias map should map dd to collections.defaultcount
        assert "dd" in alias_map
        assert "defaultdict" in alias_map.get("dd", "")

    def test_star_import(self):
        """Test extraction of star imports."""
        processor = AstGrepPythonProcessor()
        code = "from module import *"

        relationships, alias_map = processor.extract_imports(code, "test.py")

        assert len(relationships) >= 1
        # Star import should be recorded
        star_imports = [r for r in relationships if "*" in r.target_symbol]
        assert len(star_imports) >= 1

    def test_relative_import(self):
        """Test extraction of relative imports."""
        processor = AstGrepPythonProcessor()
        code = "from .utils import helper"

        relationships, alias_map = processor.extract_imports(code, "test.py")

        # Should capture the relative import
        assert len(relationships) >= 1
        rel_imports = [r for r in relationships if r.target_symbol.startswith(".")]
        assert len(rel_imports) >= 1

    def test_multiple_imports(self):
        """Test extraction of multiple import types."""
        processor = AstGrepPythonProcessor()
        code = """
import os
import sys
from typing import List
from collections import defaultdict as dd
"""

        relationships, alias_map = processor.extract_imports(code, "test.py")

        assert len(relationships) >= 4
        targets = {r.target_symbol for r in relationships}
        assert "os" in targets
        assert "sys" in targets
        assert "typing" in targets
        assert "collections" in targets

    def test_no_imports(self):
        """Test that code without imports returns empty list."""
        processor = AstGrepPythonProcessor()
        code = """
x = 1
def foo():
    pass
"""
        relationships, alias_map = processor.extract_imports(code, "test.py")

        assert len(relationships) == 0
        assert len(alias_map) == 0


@pytest.mark.skipif(not ASTGREP_AVAILABLE, reason="ast-grep-py not installed")
class TestExtractMethodsIntegration:
    """Integration tests combining multiple extraction methods."""

    def test_full_file_extraction(self):
        """Test extracting all relationships from a complete file."""
        processor = AstGrepPythonProcessor()
        code = """
import os
from typing import List, Optional

class Base:
    pass

class Service(Base):
    def __init__(self):
        self.data = []
    
    def process(self):
        result = os.path.join("a", "b")
        items = List([1, 2, 3])
        return result

def main():
    svc = Service()
    svc.process()
"""
        source_file = "test.py"

        # Extract all relationship types
        imports, alias_map = processor.extract_imports(code, source_file)
        inherits = processor.extract_inherits(code, source_file)
        calls = processor.extract_calls(code, source_file, alias_map=alias_map)

        # Verify we got all expected relationships
        assert len(imports) >= 2  # os and typing
        assert len(inherits) == 1  # Service -> Base
        assert len(calls) >= 2  # os.path.join and others

        # Verify inheritance
        assert any(r.source_symbol == "Service" and r.target_symbol == "Base"
                   for r in inherits)

    def test_alias_propagation(self):
        """Test that import aliases propagate to call resolution."""
        processor = AstGrepPythonProcessor()
        code = """
import numpy as np

def compute():
    arr = np.array([1, 2, 3])
    return np.sum(arr)
"""
        source_file = "test.py"

        imports, alias_map = processor.extract_imports(code, source_file)
        calls = processor.extract_calls(code, source_file, alias_map=alias_map)

        # Alias map should have np -> numpy
        assert alias_map.get("np") == "numpy"

        # Calls should resolve np.array and np.sum
        resolved_targets = {r.target_symbol for r in calls}
        # At minimum, np.array and np.sum should be captured
        np_calls = [t for t in resolved_targets if "np" in t or "numpy" in t]
        assert len(np_calls) >= 2


class TestExtractMethodFallback:
    """Tests for fallback behavior when ast-grep unavailable."""

    def test_extract_inherits_empty_when_unavailable(self):
        """Test extract_inherits returns empty list when unavailable."""
        processor = AstGrepPythonProcessor()
        if not processor.is_available():
            code = "class Dog(Animal): pass"
            relationships = processor.extract_inherits(code, "test.py")
            assert relationships == []

    def test_extract_calls_empty_when_unavailable(self):
        """Test extract_calls returns empty list when unavailable."""
        processor = AstGrepPythonProcessor()
        if not processor.is_available():
            code = "print('hello')"
            relationships = processor.extract_calls(code, "test.py")
            assert relationships == []

    def test_extract_imports_empty_when_unavailable(self):
        """Test extract_imports returns empty tuple when unavailable."""
        processor = AstGrepPythonProcessor()
        if not processor.is_available():
            code = "import os"
            relationships, alias_map = processor.extract_imports(code, "test.py")
            assert relationships == []
            assert alias_map == {}


class TestHelperMethods:
    """Tests for internal helper methods."""

    def test_parse_base_classes_single(self):
        """Test _parse_base_classes with single base."""
        processor = AstGrepPythonProcessor()
        result = processor._parse_base_classes("BaseClass")
        assert result == ["BaseClass"]

    def test_parse_base_classes_multiple(self):
        """Test _parse_base_classes with multiple bases."""
        processor = AstGrepPythonProcessor()
        result = processor._parse_base_classes("A, B, C")
        assert result == ["A", "B", "C"]

    def test_parse_base_classes_with_generics(self):
        """Test _parse_base_classes with generic types."""
        processor = AstGrepPythonProcessor()
        result = processor._parse_base_classes("Generic[T], Mixin")
        assert "Generic[T]" in result
        assert "Mixin" in result

    def test_resolve_call_alias_simple(self):
        """Test _resolve_call_alias with simple name."""
        processor = AstGrepPythonProcessor()
        alias_map = {"np": "numpy"}
        result = processor._resolve_call_alias("np", alias_map)
        assert result == "numpy"

    def test_resolve_call_alias_qualified(self):
        """Test _resolve_call_alias with qualified name."""
        processor = AstGrepPythonProcessor()
        alias_map = {"np": "numpy"}
        result = processor._resolve_call_alias("np.array", alias_map)
        assert result == "numpy.array"

    def test_resolve_call_alias_no_match(self):
        """Test _resolve_call_alias when no alias exists."""
        processor = AstGrepPythonProcessor()
        alias_map = {}
        result = processor._resolve_call_alias("myfunc", alias_map)
        assert result == "myfunc"
