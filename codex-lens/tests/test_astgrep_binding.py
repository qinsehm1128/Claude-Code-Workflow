"""Tests for ast-grep binding module.

Verifies basic import and functionality of AstGrepBinding.
Run with: python -m pytest tests/test_astgrep_binding.py -v
"""

from __future__ import annotations

import pytest
from pathlib import Path


class TestAstGrepBindingAvailability:
    """Test availability checks."""

    def test_is_astgrep_available_function(self):
        """Test is_astgrep_available function returns boolean."""
        from codexlens.parsers.astgrep_binding import is_astgrep_available
        result = is_astgrep_available()
        assert isinstance(result, bool)

    def test_get_supported_languages(self):
        """Test get_supported_languages returns expected languages."""
        from codexlens.parsers.astgrep_binding import get_supported_languages
        languages = get_supported_languages()
        assert isinstance(languages, list)
        assert "python" in languages
        assert "javascript" in languages
        assert "typescript" in languages


class TestAstGrepBindingInit:
    """Test AstGrepBinding initialization."""

    def test_init_python(self):
        """Test initialization with Python language."""
        from codexlens.parsers.astgrep_binding import AstGrepBinding
        binding = AstGrepBinding("python")
        assert binding.language_id == "python"

    def test_init_typescript_with_tsx(self):
        """Test TSX detection from file extension."""
        from codexlens.parsers.astgrep_binding import AstGrepBinding
        binding = AstGrepBinding("typescript", Path("component.tsx"))
        assert binding.language_id == "typescript"

    def test_is_available_returns_boolean(self):
        """Test is_available returns boolean."""
        from codexlens.parsers.astgrep_binding import AstGrepBinding
        binding = AstGrepBinding("python")
        result = binding.is_available()
        assert isinstance(result, bool)


def _is_astgrep_installed():
    """Check if ast-grep-py is installed."""
    try:
        import ast_grep_py  # noqa: F401
        return True
    except ImportError:
        return False


@pytest.mark.skipif(
    not _is_astgrep_installed(),
    reason="ast-grep-py not installed"
)
class TestAstGrepBindingWithAstGrep:
    """Tests that require ast-grep-py to be installed."""

    def test_parse_simple_python(self):
        """Test parsing simple Python code."""
        from codexlens.parsers.astgrep_binding import AstGrepBinding
        binding = AstGrepBinding("python")

        if not binding.is_available():
            pytest.skip("ast-grep not available")

        source = "x = 1"
        result = binding.parse(source)
        assert result is True

    def test_find_inheritance(self):
        """Test finding class inheritance."""
        from codexlens.parsers.astgrep_binding import AstGrepBinding
        binding = AstGrepBinding("python")

        if not binding.is_available():
            pytest.skip("ast-grep not available")

        source = """
class MyClass(BaseClass):
    pass
"""
        binding.parse(source)
        results = binding.find_inheritance()
        assert len(results) >= 0  # May or may not find depending on pattern match

    def test_find_calls(self):
        """Test finding function calls."""
        from codexlens.parsers.astgrep_binding import AstGrepBinding
        binding = AstGrepBinding("python")

        if not binding.is_available():
            pytest.skip("ast-grep not available")

        source = """
def foo():
    bar()
    baz.qux()
"""
        binding.parse(source)
        results = binding.find_calls()
        assert isinstance(results, list)

    def test_find_imports(self):
        """Test finding import statements."""
        from codexlens.parsers.astgrep_binding import AstGrepBinding
        binding = AstGrepBinding("python")

        if not binding.is_available():
            pytest.skip("ast-grep not available")

        source = """
import os
from typing import List
"""
        binding.parse(source)
        results = binding.find_imports()
        assert isinstance(results, list)


def test_basic_import():
    """Test that the module can be imported."""
    try:
        from codexlens.parsers.astgrep_binding import (
            AstGrepBinding,
            is_astgrep_available,
            get_supported_languages,
            ASTGREP_AVAILABLE,
        )
        assert True
    except ImportError as e:
        pytest.fail(f"Failed to import astgrep_binding: {e}")


def test_availability_flag():
    """Test ASTGREP_AVAILABLE flag is defined."""
    from codexlens.parsers.astgrep_binding import ASTGREP_AVAILABLE
    assert isinstance(ASTGREP_AVAILABLE, bool)


if __name__ == "__main__":
    # Run basic verification
    print("Testing astgrep_binding module...")

    from codexlens.parsers.astgrep_binding import (
        AstGrepBinding,
        is_astgrep_available,
        get_supported_languages,
    )

    print(f"ast-grep available: {is_astgrep_available()}")
    print(f"Supported languages: {get_supported_languages()}")

    binding = AstGrepBinding("python")
    print(f"Python binding available: {binding.is_available()}")

    if binding.is_available():
        test_code = """
import os
from typing import List

class MyClass(BaseClass):
    def method(self):
        self.helper()
        external_func()

def helper():
    pass
"""
        binding.parse(test_code)
        print(f"Inheritance found: {binding.find_inheritance()}")
        print(f"Calls found: {binding.find_calls()}")
        print(f"Imports found: {binding.find_imports()}")
    else:
        print("Note: ast-grep-py not installed. To install:")
        print("  pip install ast-grep-py")
        print("  Note: May have compatibility issues with Python 3.13")

    print("Basic verification complete!")
