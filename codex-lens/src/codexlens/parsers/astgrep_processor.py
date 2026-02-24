"""Ast-grep based processor for Python relationship extraction.

Provides pattern-based AST matching for extracting code relationships
(inheritance, calls, imports) from Python source code.

This processor wraps the ast-grep-py bindings and provides a higher-level
interface for relationship extraction, similar to TreeSitterSymbolParser.

Design Pattern:
    - Follows TreeSitterSymbolParser class structure for consistency
    - Uses declarative patterns defined in patterns/python/__init__.py
    - Provides scope-aware relationship extraction with alias resolution
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from codexlens.entities import CodeRelationship, IndexedFile, RelationshipType, Symbol

# Import patterns module
from codexlens.parsers.patterns.python import (
    PYTHON_PATTERNS,
    get_pattern,
    get_metavar,
)

# Graceful import pattern following existing convention
try:
    from ast_grep_py import SgNode, SgRoot
    from codexlens.parsers.astgrep_binding import AstGrepBinding, ASTGREP_AVAILABLE
except ImportError:
    SgNode = None  # type: ignore[assignment,misc]
    SgRoot = None  # type: ignore[assignment,misc]
    AstGrepBinding = None  # type: ignore[assignment,misc]
    ASTGREP_AVAILABLE = False


class BaseAstGrepProcessor(ABC):
    """Abstract base class for ast-grep based processors.

    Provides common infrastructure for pattern-based AST processing.
    Subclasses implement language-specific pattern processing logic.
    """

    def __init__(self, language_id: str, path: Optional[Path] = None) -> None:
        """Initialize processor for a language.

        Args:
            language_id: Language identifier (python, javascript, typescript)
            path: Optional file path for language variant detection
        """
        self.language_id = language_id
        self.path = path
        self._binding: Optional[AstGrepBinding] = None

        if ASTGREP_AVAILABLE and AstGrepBinding is not None:
            self._binding = AstGrepBinding(language_id, path)

    def is_available(self) -> bool:
        """Check if ast-grep processor is available.

        Returns:
            True if ast-grep binding is ready
        """
        return self._binding is not None and self._binding.is_available()

    def run_ast_grep(self, source_code: str, pattern: str) -> List[SgNode]:  # type: ignore[valid-type]
        """Execute ast-grep pattern matching on source code.

        Args:
            source_code: Source code text to analyze
            pattern: ast-grep pattern string

        Returns:
            List of matching SgNode objects, empty if no matches or unavailable
        """
        if not self.is_available() or self._binding is None:
            return []

        if not self._binding.parse(source_code):
            return []

        return self._binding.find_all(pattern)

    def _get_match(self, node: SgNode, metavar: str) -> str:  # type: ignore[valid-type]
        """Extract matched metavariable value from node (best-effort)."""
        if self._binding is None or node is None:
            return ""
        return self._binding._get_match(node, metavar)

    def _get_line_number(self, node: SgNode) -> int:  # type: ignore[valid-type]
        """Get 1-based starting line number of a node (best-effort)."""
        if self._binding is None or node is None:
            return 0
        return self._binding._get_line_number(node)

    def _get_line_range(self, node: SgNode) -> Tuple[int, int]:  # type: ignore[valid-type]
        """Get (start_line, end_line) range of a node (best-effort)."""
        if self._binding is None or node is None:
            return (0, 0)
        return self._binding._get_line_range(node)

    def _get_node_text(self, node: SgNode) -> str:  # type: ignore[valid-type]
        """Get the full text of a node (best-effort)."""
        if self._binding is None or node is None:
            return ""
        return self._binding._get_node_text(node)

    @abstractmethod
    def process_matches(
        self,
        matches: List[SgNode],  # type: ignore[valid-type]
        source_code: str,
        path: Path,
    ) -> List[CodeRelationship]:
        """Process ast-grep matches into code relationships.

        Args:
            matches: List of matched SgNode objects
            source_code: Original source code
            path: File path being processed

        Returns:
            List of extracted code relationships
        """
        pass

    @abstractmethod
    def parse(self, text: str, path: Path) -> Optional[IndexedFile]:
        """Parse source code and extract relationships.

        Args:
            text: Source code text
            path: File path

        Returns:
            IndexedFile with symbols and relationships, None if unavailable
        """
        pass


class AstGrepPythonProcessor(BaseAstGrepProcessor):
    """Python-specific ast-grep processor for relationship extraction.

    Extracts INHERITS, CALLS, and IMPORTS relationships from Python code
    using declarative ast-grep patterns with scope-aware processing.
    """

    def __init__(self, path: Optional[Path] = None) -> None:
        """Initialize Python processor.

        Args:
            path: Optional file path (for consistency with base class)
        """
        super().__init__("python", path)

    def parse(self, text: str, path: Path) -> Optional[IndexedFile]:
        """Parse Python source code and extract relationships.

        Args:
            text: Python source code text
            path: File path

        Returns:
            IndexedFile with symbols and relationships, None if unavailable
        """
        if not self.is_available():
            return None

        try:
            symbols = self._extract_symbols(text)
            relationships = self._extract_relationships(text, path)

            return IndexedFile(
                path=str(path.resolve()),
                language="python",
                symbols=symbols,
                chunks=[],
                relationships=relationships,
            )
        except (ValueError, TypeError, AttributeError) as e:
            # Log specific parsing errors for debugging
            import logging
            logging.getLogger(__name__).debug(f"ast-grep parsing error: {e}")
            return None

    def _extract_symbols(self, source_code: str) -> List[Symbol]:
        """Extract Python symbols (classes, functions, methods).

        Args:
            source_code: Python source code

        Returns:
            List of Symbol objects
        """
        symbols: List[Symbol] = []

        # Collect all scope definitions with line ranges for proper method detection
        # Format: (start_line, end_line, kind, name)
        scope_defs: List[Tuple[int, int, str, str]] = []

        # Track async function positions to avoid duplicates
        async_positions: set = set()

        # Extract class definitions
        class_matches = self.run_ast_grep(source_code, get_pattern("class_def"))
        for node in class_matches:
            name = self._get_match(node, "NAME")
            if name:
                start_line, end_line = self._get_line_range(node)
                scope_defs.append((start_line, end_line, "class", name))

        # Extract async function definitions FIRST (before regular functions)
        async_matches = self.run_ast_grep(source_code, get_pattern("async_func_def"))
        for node in async_matches:
            name = self._get_match(node, "NAME")
            if name:
                start_line, end_line = self._get_line_range(node)
                scope_defs.append((start_line, end_line, "function", name))
                async_positions.add(start_line)  # Mark this position as async

        # Extract function definitions (skip those already captured as async)
        func_matches = self.run_ast_grep(source_code, get_pattern("func_def"))
        for node in func_matches:
            name = self._get_match(node, "NAME")
            if name:
                start_line, end_line = self._get_line_range(node)
                # Skip if already captured as async function (same position)
                if start_line not in async_positions:
                    scope_defs.append((start_line, end_line, "function", name))

        # Sort by start line for scope-aware processing
        scope_defs.sort(key=lambda x: x[0])

        # Process with scope tracking to determine method vs function
        scope_stack: List[Tuple[str, int, str]] = []  # (name, end_line, kind)

        for start_line, end_line, kind, name in scope_defs:
            # Pop scopes that have ended
            while scope_stack and scope_stack[-1][1] < start_line:
                scope_stack.pop()

            if kind == "class":
                symbols.append(Symbol(
                    name=name,
                    kind="class",
                    range=(start_line, end_line),
                ))
                scope_stack.append((name, end_line, "class"))
            else:  # function
                # Determine if it's a method (inside a class) or function
                is_method = bool(scope_stack) and scope_stack[-1][2] == "class"
                symbols.append(Symbol(
                    name=name,
                    kind="method" if is_method else "function",
                    range=(start_line, end_line),
                ))
                scope_stack.append((name, end_line, "function"))

        return symbols

    def _extract_relationships(self, source_code: str, path: Path) -> List[CodeRelationship]:
        """Extract code relationships with scope and alias resolution.

        Args:
            source_code: Python source code
            path: File path

        Returns:
            List of CodeRelationship objects
        """
        if not self.is_available() or self._binding is None:
            return []

        source_file = str(path.resolve())

        # Collect all matches with line numbers and end lines for scope processing
        # Format: (start_line, end_line, match_type, symbol, node)
        all_matches: List[Tuple[int, int, str, str, Any]] = []

        # Get class definitions (with and without bases) for scope tracking
        class_with_bases = self.run_ast_grep(source_code, get_pattern("class_with_bases"))
        for node in class_with_bases:
            class_name = self._get_match(node, "NAME")
            start_line, end_line = self._get_line_range(node)
            if class_name:
                # Record class scope and inheritance
                all_matches.append((start_line, end_line, "class_def", class_name, node))
                # Extract bases from node text (ast-grep-py 0.40+ doesn't capture $$$)
                node_text = self._binding._get_node_text(node) if self._binding else ""
                bases_text = self._extract_bases_from_class_text(node_text)
                if bases_text:
                    # Also record inheritance relationship
                    all_matches.append((start_line, end_line, "inherits", bases_text, node))

        # Get classes without bases for scope tracking
        class_no_bases = self.run_ast_grep(source_code, get_pattern("class_def"))
        for node in class_no_bases:
            class_name = self._get_match(node, "NAME")
            start_line, end_line = self._get_line_range(node)
            if class_name:
                # Check if not already recorded (avoid duplicates from class_with_bases)
                existing = [m for m in all_matches if m[2] == "class_def" and m[3] == class_name and m[0] == start_line]
                if not existing:
                    all_matches.append((start_line, end_line, "class_def", class_name, node))

        # Get function definitions for scope tracking
        func_matches = self.run_ast_grep(source_code, get_pattern("func_def"))
        for node in func_matches:
            func_name = self._get_match(node, "NAME")
            start_line, end_line = self._get_line_range(node)
            if func_name:
                all_matches.append((start_line, end_line, "func_def", func_name, node))

        # Get async function definitions for scope tracking
        async_func_matches = self.run_ast_grep(source_code, get_pattern("async_func_def"))
        for node in async_func_matches:
            func_name = self._get_match(node, "NAME")
            start_line, end_line = self._get_line_range(node)
            if func_name:
                all_matches.append((start_line, end_line, "func_def", func_name, node))

        # Get import matches (process import_with_alias first to avoid duplicates)
        import_alias_positions: set = set()

        # Process import with alias: import X as Y
        import_alias_matches = self.run_ast_grep(source_code, get_pattern("import_with_alias"))
        for node in import_alias_matches:
            module = self._get_match(node, "MODULE")
            alias = self._get_match(node, "ALIAS")
            start_line, end_line = self._get_line_range(node)
            if module and alias:
                import_alias_positions.add(start_line)
                all_matches.append((start_line, end_line, "import_alias", f"{module}:{alias}", node))

        # Process simple imports: import X (skip lines with aliases)
        import_matches = self.run_ast_grep(source_code, get_pattern("import_stmt"))
        for node in import_matches:
            module = self._get_match(node, "MODULE")
            start_line, end_line = self._get_line_range(node)
            if module and start_line not in import_alias_positions:
                all_matches.append((start_line, end_line, "import", module, node))

        from_matches = self.run_ast_grep(source_code, get_pattern("import_from"))
        for node in from_matches:
            module = self._get_match(node, "MODULE")
            names = self._get_match(node, "NAMES")
            # Prefer parsing from full node text to handle multiple imports
            # (ast-grep-py capture may only include the first name).
            try:
                node_text = self._binding._get_node_text(node) if self._binding else ""
            except Exception:
                node_text = ""
            parsed_names = self._extract_import_names_from_text(node_text) if node_text else ""
            if parsed_names:
                names = parsed_names
            start_line, end_line = self._get_line_range(node)
            if module:
                all_matches.append((start_line, end_line, "from_import", f"{module}:{names}", node))

        # Get call matches
        call_matches = self.run_ast_grep(source_code, get_pattern("call"))
        for node in call_matches:
            func = self._get_match(node, "FUNC")
            start_line, end_line = self._get_line_range(node)
            if func:
                # Skip self. and cls. prefixed calls
                base = func.split(".", 1)[0]
                if base not in {"self", "cls"}:
                    all_matches.append((start_line, end_line, "call", func, node))

        # Sort by start line number for scope processing
        all_matches.sort(key=lambda x: (x[0], x[2] == "call"))  # Process scope defs before calls on same line

        # Process with scope tracking
        relationships = self._process_scope_and_aliases(all_matches, source_file)

        return relationships

    def _process_scope_and_aliases(
        self,
        matches: List[Tuple[int, int, str, str, Any]],
        source_file: str,
    ) -> List[CodeRelationship]:
        """Process matches with scope and alias resolution.

        Implements proper scope tracking similar to treesitter_parser.py:
        - Maintains scope_stack for tracking current scope (class/function names)
        - Maintains alias_stack with per-scope alias mappings (inherited from parent)
        - Pops scopes when current line passes their end line
        - Resolves call targets using current scope's alias map

        Args:
            matches: Sorted list of (start_line, end_line, type, symbol, node) tuples
            source_file: Source file path

        Returns:
            List of resolved CodeRelationship objects
        """
        relationships: List[CodeRelationship] = []

        # Scope stack: list of (name, end_line) tuples
        scope_stack: List[Tuple[str, int]] = [("<module>", float("inf"))]

        # Alias stack: list of alias dicts, one per scope level
        # Each new scope inherits parent's aliases (copy on write)
        alias_stack: List[Dict[str, str]] = [{}]

        def get_current_scope() -> str:
            """Get the name of the current (innermost) scope."""
            return scope_stack[-1][0]

        def pop_scopes_before(line: int) -> None:
            """Pop all scopes that have ended before the given line."""
            while len(scope_stack) > 1 and scope_stack[-1][1] < line:
                scope_stack.pop()
                alias_stack.pop()

        def push_scope(name: str, end_line: int) -> None:
            """Push a new scope onto the stack."""
            scope_stack.append((name, end_line))
            # Copy parent scope's aliases for inheritance
            alias_stack.append(dict(alias_stack[-1]))

        def update_aliases(updates: Dict[str, str]) -> None:
            """Update current scope's alias map."""
            alias_stack[-1].update(updates)

        def resolve_alias(symbol: str) -> str:
            """Resolve a symbol using current scope's alias map."""
            if "." not in symbol:
                # Simple name - check if it's an alias
                return alias_stack[-1].get(symbol, symbol)

            # Dotted name - resolve the base
            parts = symbol.split(".", 1)
            base = parts[0]
            rest = parts[1]

            if base in alias_stack[-1]:
                return f"{alias_stack[-1][base]}.{rest}"
            return symbol

        for start_line, end_line, match_type, symbol, node in matches:
            # Pop any scopes that have ended
            pop_scopes_before(start_line)

            if match_type == "class_def":
                # Push class scope
                push_scope(symbol, end_line)

            elif match_type == "func_def":
                # Push function scope
                push_scope(symbol, end_line)

            elif match_type == "inherits":
                # Record inheritance relationship
                # Parse base classes from the bases text
                base_classes = self._parse_base_classes(symbol)
                for base_class in base_classes:
                    base_class = base_class.strip()
                    if base_class:
                        # Resolve alias for base class
                        resolved_base = resolve_alias(base_class)
                        relationships.append(CodeRelationship(
                            source_symbol=get_current_scope(),
                            target_symbol=resolved_base,
                            relationship_type=RelationshipType.INHERITS,
                            source_file=source_file,
                            target_file=None,
                            source_line=start_line,
                        ))

            elif match_type == "import":
                # Process simple import statement
                module = symbol
                # Simple import: add base name to alias map
                base_name = module.split(".", 1)[0]
                update_aliases({base_name: module})
                relationships.append(CodeRelationship(
                    source_symbol=get_current_scope(),
                    target_symbol=module,
                    relationship_type=RelationshipType.IMPORTS,
                    source_file=source_file,
                    target_file=None,
                    source_line=start_line,
                ))

            elif match_type == "import_alias":
                # Process import with alias: import X as Y
                parts = symbol.split(":", 1)
                module = parts[0]
                alias = parts[1] if len(parts) > 1 else ""
                if alias:
                    update_aliases({alias: module})
                relationships.append(CodeRelationship(
                    source_symbol=get_current_scope(),
                    target_symbol=module,
                    relationship_type=RelationshipType.IMPORTS,
                    source_file=source_file,
                    target_file=None,
                    source_line=start_line,
                ))

            elif match_type == "from_import":
                # Process from-import statement
                parts = symbol.split(":", 1)
                module = parts[0]
                names = parts[1] if len(parts) > 1 else ""

                names = (names or "").strip()
                if names.startswith("(") and names.endswith(")"):
                    names = names[1:-1].strip()

                # Record IMPORTS edges for the imported names (module.symbol), and
                # update aliases for call/usage resolution.
                if names and names != "*":
                    for name in names.split(","):
                        name = name.strip()
                        if not name or name == "*":
                            continue

                        if " as " in name:
                            as_parts = name.split(" as ", 1)
                            original = as_parts[0].strip()
                            alias = as_parts[1].strip()
                            if not original:
                                continue
                            target = f"{module}.{original}" if module else original
                            if alias:
                                update_aliases({alias: target})
                            relationships.append(CodeRelationship(
                                source_symbol=get_current_scope(),
                                target_symbol=target,
                                relationship_type=RelationshipType.IMPORTS,
                                source_file=source_file,
                                target_file=None,
                                source_line=start_line,
                            ))
                        else:
                            target = f"{module}.{name}" if module else name
                            update_aliases({name: target})
                            relationships.append(CodeRelationship(
                                source_symbol=get_current_scope(),
                                target_symbol=target,
                                relationship_type=RelationshipType.IMPORTS,
                                source_file=source_file,
                                target_file=None,
                                source_line=start_line,
                            ))

            elif match_type == "call":
                # Resolve alias for call target
                resolved = resolve_alias(symbol)
                relationships.append(CodeRelationship(
                    source_symbol=get_current_scope(),
                    target_symbol=resolved,
                    relationship_type=RelationshipType.CALL,
                    source_file=source_file,
                    target_file=None,
                    source_line=start_line,
                ))

        return relationships

    def process_matches(
        self,
        matches: List[SgNode],  # type: ignore[valid-type]
        source_code: str,
        path: Path,
    ) -> List[CodeRelationship]:
        """Process ast-grep matches into code relationships.

        This is a simplified interface for direct match processing.
        For full relationship extraction with scope tracking, use parse().

        Args:
            matches: List of matched SgNode objects
            source_code: Original source code
            path: File path being processed

        Returns:
            List of extracted code relationships
        """
        if not self.is_available() or self._binding is None:
            return []

        source_file = str(path.resolve())
        relationships: List[CodeRelationship] = []

        for node in matches:
            # Default to call relationship for generic matches
            func = self._get_match(node, "FUNC")
            line = self._get_line_number(node)
            if func:
                base = func.split(".", 1)[0]
                if base not in {"self", "cls"}:
                    relationships.append(CodeRelationship(
                        source_symbol="<module>",
                        target_symbol=func,
                        relationship_type=RelationshipType.CALL,
                        source_file=source_file,
                        target_file=None,
                        source_line=line,
                    ))

        return relationships

    def _get_match(self, node: SgNode, metavar: str) -> str:  # type: ignore[valid-type]
        """Extract matched metavariable value from node.

        Args:
            node: SgNode with match
            metavar: Metavariable name (without $ prefix)

        Returns:
            Matched text or empty string
        """
        if self._binding is None or node is None:
            return ""
        return self._binding._get_match(node, metavar)

    def _get_line_number(self, node: SgNode) -> int:  # type: ignore[valid-type]
        """Get starting line number of a node.

        Args:
            node: SgNode to get line number for

        Returns:
            1-based line number
        """
        if self._binding is None or node is None:
            return 0
        return self._binding._get_line_number(node)

    def _get_line_range(self, node: SgNode) -> Tuple[int, int]:  # type: ignore[valid-type]
        """Get line range for a node.

        Args:
            node: SgNode to get range for

        Returns:
            (start_line, end_line) tuple, 1-based inclusive
        """
        if self._binding is None or node is None:
            return (0, 0)
        return self._binding._get_line_range(node)


    # =========================================================================
    # Dedicated extraction methods for INHERITS, CALL, IMPORTS relationships
    # =========================================================================

    def extract_inherits(
        self,
        source_code: str,
        source_file: str,
        source_symbol: str = "<module>",
    ) -> List[CodeRelationship]:
        """Extract INHERITS relationships from Python code.

        Identifies class inheritance patterns including:
        - Single inheritance: class Child(Parent):
        - Multiple inheritance: class Child(A, B, C):

        Args:
            source_code: Python source code to analyze
            source_file: Path to the source file
            source_symbol: The containing scope (class or module)

        Returns:
            List of CodeRelationship objects with INHERITS type
        """
        if not self.is_available():
            return []

        relationships: List[CodeRelationship] = []

        # Use class_with_bases pattern to find classes with inheritance
        matches = self.run_ast_grep(source_code, get_pattern("class_with_bases"))

        for node in matches:
            class_name = self._get_match(node, "NAME")
            line = self._get_line_number(node)

            if class_name:
                # Extract bases from the node text (first line: "class ClassName(Base1, Base2):")
                # ast-grep-py 0.40+ doesn't capture $$$ multi-matches, so parse from text
                node_text = self._binding._get_node_text(node) if self._binding else ""
                bases_text = self._extract_bases_from_class_text(node_text)

                if bases_text:
                    # Parse individual base classes from the bases text
                    base_classes = self._parse_base_classes(bases_text)

                    for base_class in base_classes:
                        base_class = base_class.strip()
                        if base_class:
                            relationships.append(CodeRelationship(
                                source_symbol=class_name,
                                target_symbol=base_class,
                                relationship_type=RelationshipType.INHERITS,
                                source_file=source_file,
                                target_file=None,
                                source_line=line,
                            ))

        return relationships

    def _extract_bases_from_class_text(self, class_text: str) -> str:
        """Extract base classes text from class definition.

        Args:
            class_text: Full text of class definition (e.g., "class Dog(Animal):\\n    pass")

        Returns:
            Text inside parentheses (e.g., "Animal") or empty string
        """
        import re
        # Match "class Name(BASES):" - extract BASES
        match = re.search(r'class\s+\w+\s*\(([^)]*)\)\s*:', class_text)
        if match:
            return match.group(1).strip()
        return ""

    def _extract_import_names_from_text(self, import_text: str) -> str:
        """Extract imported names from from-import statement.

        Args:
            import_text: Full text of import statement (e.g., "from typing import List, Dict")

        Returns:
            Names text (e.g., "List, Dict") or empty string
        """
        import re
        # Match "from MODULE import NAMES" - extract NAMES
        match = re.search(r'from\s+[\w.]+\s+import\s+(.+)$', import_text, re.MULTILINE)
        if match:
            return match.group(1).strip()
        return ""

    def extract_calls(
        self,
        source_code: str,
        source_file: str,
        source_symbol: str = "<module>",
        alias_map: Optional[Dict[str, str]] = None,
    ) -> List[CodeRelationship]:
        """Extract CALL relationships from Python code.

        Identifies function and method call patterns including:
        - Simple calls: func()
        - Calls with arguments: func(arg1, arg2)
        - Method calls: obj.method()
        - Chained calls: obj.method1().method2()

        Args:
            source_code: Python source code to analyze
            source_file: Path to the source file
            source_symbol: The containing scope (class or module)
            alias_map: Optional alias map for resolving imported names

        Returns:
            List of CodeRelationship objects with CALL type
        """
        if not self.is_available():
            return []

        relationships: List[CodeRelationship] = []
        alias_map = alias_map or {}

        # Use the generic call pattern
        matches = self.run_ast_grep(source_code, get_pattern("call"))

        for node in matches:
            func = self._get_match(node, "FUNC")
            line = self._get_line_number(node)

            if func:
                # Skip self. and cls. prefixed calls (internal method calls)
                base = func.split(".", 1)[0]
                if base in {"self", "cls", "super"}:
                    continue

                # Resolve alias if available
                resolved = self._resolve_call_alias(func, alias_map)

                relationships.append(CodeRelationship(
                    source_symbol=source_symbol,
                    target_symbol=resolved,
                    relationship_type=RelationshipType.CALL,
                    source_file=source_file,
                    target_file=None,
                    source_line=line,
                ))

        return relationships

    def extract_imports(
        self,
        source_code: str,
        source_file: str,
        source_symbol: str = "<module>",
    ) -> Tuple[List[CodeRelationship], Dict[str, str]]:
        """Extract IMPORTS relationships from Python code.

        Identifies import patterns including:
        - Simple import: import os
        - Import with alias: import numpy as np
        - From import: from typing import List
        - From import with alias: from collections import defaultdict as dd
        - Relative import: from .module import func
        - Star import: from module import *

        Args:
            source_code: Python source code to analyze
            source_file: Path to the source file
            source_symbol: The containing scope (class or module)

        Returns:
            Tuple of:
            - List of CodeRelationship objects with IMPORTS type
            - Dict mapping local names to fully qualified module names (alias map)
        """
        if not self.is_available():
            return [], {}

        relationships: List[CodeRelationship] = []
        alias_map: Dict[str, str] = {}

        # Track processed lines to avoid duplicates
        processed_lines: set = set()

        # Process import with alias FIRST: import X as Y
        alias_matches = self.run_ast_grep(source_code, get_pattern("import_with_alias"))
        for node in alias_matches:
            module = self._get_match(node, "MODULE")
            alias = self._get_match(node, "ALIAS")
            line = self._get_line_number(node)

            if module and alias:
                alias_map[alias] = module
                processed_lines.add(line)

                relationships.append(CodeRelationship(
                    source_symbol=source_symbol,
                    target_symbol=module,
                    relationship_type=RelationshipType.IMPORTS,
                    source_file=source_file,
                    target_file=None,
                    source_line=line,
                ))

        # Process simple imports: import X (skip lines already processed)
        import_matches = self.run_ast_grep(source_code, get_pattern("import_stmt"))
        for node in import_matches:
            module = self._get_match(node, "MODULE")
            line = self._get_line_number(node)

            if module and line not in processed_lines:
                # Add to alias map: first part of module
                base_name = module.split(".", 1)[0]
                alias_map[base_name] = module

                relationships.append(CodeRelationship(
                    source_symbol=source_symbol,
                    target_symbol=module,
                    relationship_type=RelationshipType.IMPORTS,
                    source_file=source_file,
                    target_file=None,
                    source_line=line,
                ))

        # Process from imports: from X import Y
        from_matches = self.run_ast_grep(source_code, get_pattern("import_from"))
        for node in from_matches:
            module = self._get_match(node, "MODULE")
            line = self._get_line_number(node)

            if module:
                # Add relationship for the module
                relationships.append(CodeRelationship(
                    source_symbol=source_symbol,
                    target_symbol=module,
                    relationship_type=RelationshipType.IMPORTS,
                    source_file=source_file,
                    target_file=None,
                    source_line=line,
                ))

                # Parse names from node text (ast-grep-py 0.40+ doesn't capture $$$ multi-match)
                node_text = self._binding._get_node_text(node) if self._binding else ""
                names = self._extract_import_names_from_text(node_text)

                # Add aliases for imported names
                if names and names != "*":
                    for name in names.split(","):
                        name = name.strip()
                        # Handle "name as alias" syntax
                        if " as " in name:
                            parts = name.split(" as ")
                            original = parts[0].strip()
                            alias = parts[1].strip()
                            alias_map[alias] = f"{module}.{original}"
                        elif name:
                            alias_map[name] = f"{module}.{name}"

        # Process star imports: from X import *
        star_matches = self.run_ast_grep(source_code, get_pattern("from_import_star"))
        for node in star_matches:
            module = self._get_match(node, "MODULE")
            line = self._get_line_number(node)

            if module:
                relationships.append(CodeRelationship(
                    source_symbol=source_symbol,
                    target_symbol=f"{module}.*",
                    relationship_type=RelationshipType.IMPORTS,
                    source_file=source_file,
                    target_file=None,
                    source_line=line,
                ))

        # Process relative imports: from .X import Y
        relative_matches = self.run_ast_grep(source_code, get_pattern("relative_import"))
        for node in relative_matches:
            module = self._get_match(node, "MODULE")
            names = self._get_match(node, "NAMES")
            line = self._get_line_number(node)

            # Prepend dot for relative module path
            rel_module = f".{module}" if module else "."

            relationships.append(CodeRelationship(
                source_symbol=source_symbol,
                target_symbol=rel_module,
                relationship_type=RelationshipType.IMPORTS,
                source_file=source_file,
                target_file=None,
                source_line=line,
            ))

        return relationships, alias_map

    # =========================================================================
    # Helper methods for pattern processing
    # =========================================================================

    def _parse_base_classes(self, bases_text: str) -> List[str]:
        """Parse base class names from inheritance text.

        Handles single and multiple inheritance with proper comma splitting.
        Accounts for nested parentheses and complex type annotations.

        Args:
            bases_text: Text inside the parentheses of class definition

        Returns:
            List of base class names
        """
        if not bases_text:
            return []

        # Simple comma split (may not handle all edge cases)
        bases = []
        depth = 0
        current = []

        for char in bases_text:
            if char == "(":
                depth += 1
                current.append(char)
            elif char == ")":
                depth -= 1
                current.append(char)
            elif char == "," and depth == 0:
                base = "".join(current).strip()
                if base:
                    bases.append(base)
                current = []
            else:
                current.append(char)

        # Add the last base class
        if current:
            base = "".join(current).strip()
            if base:
                bases.append(base)

        return bases

    def _resolve_call_alias(self, func_name: str, alias_map: Dict[str, str]) -> str:
        """Resolve a function call name using import aliases.

        Args:
            func_name: The function/method name as it appears in code
            alias_map: Mapping of local names to fully qualified names

        Returns:
            Resolved function name (fully qualified if possible)
        """
        if "." not in func_name:
            # Simple function call - check if it's an alias
            return alias_map.get(func_name, func_name)

        # Method call or qualified name - resolve the base
        parts = func_name.split(".", 1)
        base = parts[0]
        rest = parts[1]

        if base in alias_map:
            return f"{alias_map[base]}.{rest}"

        return func_name


def is_astgrep_processor_available() -> bool:
    """Check if ast-grep processor is available.

    Returns:
        True if ast-grep-py is installed and processor can be used
    """
    return ASTGREP_AVAILABLE


__all__ = [
    "BaseAstGrepProcessor",
    "AstGrepPythonProcessor",
    "is_astgrep_processor_available",
]
