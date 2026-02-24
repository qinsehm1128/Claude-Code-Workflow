"""ast-grep based parser binding for CodexLens.

Provides AST-level pattern matching via ast-grep-py (PyO3 bindings).

Note: This module wraps the official ast-grep Python bindings for pattern-based
code analysis. If ast-grep-py is unavailable, the parser returns None gracefully.
Callers should use tree-sitter or regex-based fallbacks.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Import patterns from centralized definition (avoid duplication)
from codexlens.parsers.patterns.python import get_pattern, PYTHON_PATTERNS

# Graceful import pattern following treesitter_parser.py convention
try:
    from ast_grep_py import SgNode, SgRoot
    ASTGREP_AVAILABLE = True
except ImportError:
    SgNode = None  # type: ignore[assignment,misc]
    SgRoot = None  # type: ignore[assignment,misc]
    ASTGREP_AVAILABLE = False

log = logging.getLogger(__name__)


class AstGrepBinding:
    """Wrapper for ast-grep-py bindings with CodexLens integration.

    Provides pattern-based AST matching for code relationship extraction.
    Uses declarative patterns with metavariables ($A, $$ARGS) for matching.
    """

    # Language ID mapping to ast-grep language names
    LANGUAGE_MAP = {
        "python": "python",
        "javascript": "javascript",
        "typescript": "typescript",
        "tsx": "tsx",
    }

    def __init__(self, language_id: str, path: Optional[Path] = None) -> None:
        """Initialize ast-grep binding for a language.

        Args:
            language_id: Language identifier (python, javascript, typescript, tsx)
            path: Optional file path for language variant detection
        """
        self.language_id = language_id
        self.path = path
        self._language: Optional[str] = None
        self._root: Optional[SgRoot] = None  # type: ignore[valid-type]

        if ASTGREP_AVAILABLE:
            self._initialize_language()

    def _initialize_language(self) -> None:
        """Initialize ast-grep language setting."""
        # Detect TSX from file extension
        if self.language_id == "typescript" and self.path is not None:
            if self.path.suffix.lower() == ".tsx":
                self._language = "tsx"
                return

        self._language = self.LANGUAGE_MAP.get(self.language_id)

    def is_available(self) -> bool:
        """Check if ast-grep binding is available and ready.

        Returns:
            True if ast-grep-py is installed and language is supported
        """
        return ASTGREP_AVAILABLE and self._language is not None

    def parse(self, source_code: str) -> bool:
        """Parse source code into ast-grep syntax tree.

        Args:
            source_code: Source code text to parse

        Returns:
            True if parsing succeeds, False otherwise
        """
        if not self.is_available() or SgRoot is None:
            return False

        try:
            self._root = SgRoot(source_code, self._language)  # type: ignore[misc]
            return True
        except (ValueError, TypeError, RuntimeError) as e:
            log.debug(f"ast-grep parse error: {e}")
            self._root = None
            return False

    def find_all(self, pattern: str) -> List[SgNode]:  # type: ignore[valid-type]
        """Find all matches for a pattern in the parsed source.

        Args:
            pattern: ast-grep pattern string (e.g., "class $NAME($$$BASES) $$$BODY")

        Returns:
            List of matching SgNode objects, empty if no matches or not parsed
        """
        if not self.is_available() or self._root is None:
            return []

        try:
            root_node = self._root.root()
            # ast-grep-py 0.40+ requires dict config format
            config = {"rule": {"pattern": pattern}}
            return list(root_node.find_all(config))
        except (ValueError, TypeError, AttributeError) as e:
            log.debug(f"ast-grep find_all error: {e}")
            return []

    def find_inheritance(self) -> List[Dict[str, str]]:
        """Find all class inheritance declarations.

        Returns:
            List of dicts with 'class_name' and 'bases' keys
        """
        if self.language_id != "python":
            return []

        matches = self.find_all(get_pattern("class_with_bases"))
        results: List[Dict[str, str]] = []

        for node in matches:
            class_name = self._get_match(node, "NAME")
            if class_name:
                results.append({
                    "class_name": class_name,
                    "bases": self._get_match(node, "BASES"),  # Base classes text
                })

        return results

    def find_calls(self) -> List[Dict[str, str]]:
        """Find all function/method calls.

        Returns:
            List of dicts with 'function' and 'line' keys
        """
        if self.language_id != "python":
            return []

        matches = self.find_all(get_pattern("call"))
        results: List[Dict[str, str]] = []

        for node in matches:
            func_name = self._get_match(node, "FUNC")
            if func_name:
                # Skip self. and cls. prefixed calls
                base = func_name.split(".", 1)[0]
                if base not in {"self", "cls"}:
                    results.append({
                        "function": func_name,
                        "line": str(self._get_line_number(node)),
                    })

        return results

    def find_imports(self) -> List[Dict[str, str]]:
        """Find all import statements.

        Returns:
            List of dicts with 'module' and 'type' keys
        """
        if self.language_id != "python":
            return []

        results: List[Dict[str, str]] = []

        # Find 'import X' statements
        import_matches = self.find_all(get_pattern("import_stmt"))
        for node in import_matches:
            module = self._get_match(node, "MODULE")
            if module:
                results.append({
                    "module": module,
                    "type": "import",
                    "line": str(self._get_line_number(node)),
                })

        # Find 'from X import Y' statements
        from_matches = self.find_all(get_pattern("import_from"))
        for node in from_matches:
            module = self._get_match(node, "MODULE")
            names = self._get_match(node, "NAMES")
            if module:
                results.append({
                    "module": module,
                    "names": names or "",
                    "type": "from_import",
                    "line": str(self._get_line_number(node)),
                })

        return results

    def _get_match(self, node: SgNode, metavar: str) -> str:  # type: ignore[valid-type]
        """Extract matched metavariable value from node.

        Args:
            node: SgNode with match
            metavar: Metavariable name (without $ prefix)

        Returns:
            Matched text or empty string
        """
        if node is None:
            return ""
        try:
            match = node.get_match(metavar)
            if match is not None:
                return match.text()
        except (ValueError, AttributeError, KeyError) as e:
            log.debug(f"ast-grep get_match error for {metavar}: {e}")
        return ""

    def _get_node_text(self, node: SgNode) -> str:  # type: ignore[valid-type]
        """Get full text of a node.

        Args:
            node: SgNode to extract text from

        Returns:
            Node's text content
        """
        if node is None:
            return ""
        try:
            return node.text()
        except (ValueError, AttributeError) as e:
            log.debug(f"ast-grep get_node_text error: {e}")
            return ""

    def _get_line_number(self, node: SgNode) -> int:  # type: ignore[valid-type]
        """Get starting line number of a node.

        Args:
            node: SgNode to get line number for

        Returns:
            1-based line number
        """
        if node is None:
            return 0
        try:
            range_info = node.range()
            # ast-grep-py 0.40+ returns Range object with .start.line attribute
            if hasattr(range_info, 'start') and hasattr(range_info.start, 'line'):
                return range_info.start.line + 1  # Convert to 1-based
            # Fallback for string format "(0,0)-(1,8)"
            if isinstance(range_info, str) and range_info:
                start_part = range_info.split('-')[0].strip('()')
                start_line = int(start_part.split(',')[0])
                return start_line + 1
        except (ValueError, AttributeError, TypeError, IndexError) as e:
            log.debug(f"ast-grep get_line_number error: {e}")
        return 0

    def _get_line_range(self, node: SgNode) -> Tuple[int, int]:  # type: ignore[valid-type]
        """Get line range (start, end) of a node.

        Args:
            node: SgNode to get line range for

        Returns:
            Tuple of (start_line, end_line), both 1-based inclusive
        """
        if node is None:
            return (0, 0)
        try:
            range_info = node.range()
            # ast-grep-py 0.40+ returns Range object with .start.line and .end.line
            if hasattr(range_info, 'start') and hasattr(range_info, 'end'):
                start_line = getattr(range_info.start, 'line', 0)
                end_line = getattr(range_info.end, 'line', 0)
                return (start_line + 1, end_line + 1)  # Convert to 1-based
            # Fallback for string format "(0,0)-(1,8)"
            if isinstance(range_info, str) and range_info:
                parts = range_info.split('-')
                start_part = parts[0].strip('()')
                end_part = parts[1].strip('()')
                start_line = int(start_part.split(',')[0])
                end_line = int(end_part.split(',')[0])
                return (start_line + 1, end_line + 1)
        except (ValueError, AttributeError, TypeError, IndexError) as e:
            log.debug(f"ast-grep get_line_range error: {e}")
        return (0, 0)

    def get_language(self) -> Optional[str]:
        """Get the configured ast-grep language.

        Returns:
            Language string or None if not configured
        """
        return self._language


def is_astgrep_available() -> bool:
    """Check if ast-grep-py is installed and available.

    Returns:
        True if ast-grep bindings can be imported
    """
    return ASTGREP_AVAILABLE


def get_supported_languages() -> List[str]:
    """Get list of supported languages for ast-grep.

    Returns:
        List of language identifiers
    """
    return list(AstGrepBinding.LANGUAGE_MAP.keys())
