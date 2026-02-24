"""Tree-sitter based parser for CodexLens.

Provides precise AST-level parsing via tree-sitter.

Note: This module does not provide a regex fallback inside `TreeSitterSymbolParser`.
If tree-sitter (or a language binding) is unavailable, `parse()`/`parse_symbols()`
return `None`; callers should use a regex-based fallback such as
`codexlens.parsers.factory.SimpleRegexParser`.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional, TYPE_CHECKING

try:
    from tree_sitter import Language as TreeSitterLanguage
    from tree_sitter import Node as TreeSitterNode
    from tree_sitter import Parser as TreeSitterParser
    TREE_SITTER_AVAILABLE = True
except ImportError:
    TreeSitterLanguage = None  # type: ignore[assignment]
    TreeSitterNode = None  # type: ignore[assignment]
    TreeSitterParser = None  # type: ignore[assignment]
    TREE_SITTER_AVAILABLE = False

from codexlens.entities import CodeRelationship, IndexedFile, RelationshipType, Symbol
from codexlens.parsers.tokenizer import get_default_tokenizer

if TYPE_CHECKING:
    from codexlens.config import Config


class TreeSitterSymbolParser:
    """Parser using tree-sitter for AST-level symbol extraction.

    Supports optional ast-grep integration for relationship extraction
    (Python/JavaScript/TypeScript) when config.use_astgrep is True and
    ast-grep-py is available.
    """

    def __init__(
        self,
        language_id: str,
        path: Optional[Path] = None,
        config: Optional["Config"] = None,
    ) -> None:
        """Initialize tree-sitter parser for a language.

        Args:
            language_id: Language identifier (python, javascript, typescript, etc.)
            path: Optional file path for language variant detection (e.g., .tsx)
            config: Optional Config instance for parser feature toggles
        """
        self.language_id = language_id
        self.path = path
        self._config = config
        self._parser: Optional[object] = None
        self._language: Optional[TreeSitterLanguage] = None
        self._tokenizer = get_default_tokenizer()
        self._astgrep_processor = None

        if TREE_SITTER_AVAILABLE:
            self._initialize_parser()

        # Initialize ast-grep processor for Python if config enables it
        if self._should_use_astgrep():
            self._initialize_astgrep_processor()

    def _initialize_parser(self) -> None:
        """Initialize tree-sitter parser and language."""
        if TreeSitterParser is None or TreeSitterLanguage is None:
            return

        try:
            # Load language grammar
            if self.language_id == "python":
                import tree_sitter_python
                self._language = TreeSitterLanguage(tree_sitter_python.language())
            elif self.language_id == "javascript":
                import tree_sitter_javascript
                self._language = TreeSitterLanguage(tree_sitter_javascript.language())
            elif self.language_id == "typescript":
                import tree_sitter_typescript
                # Detect TSX files by extension
                if self.path is not None and self.path.suffix.lower() == ".tsx":
                    self._language = TreeSitterLanguage(tree_sitter_typescript.language_tsx())
                else:
                    self._language = TreeSitterLanguage(tree_sitter_typescript.language_typescript())
            else:
                return

            # Create parser
            self._parser = TreeSitterParser()
            if hasattr(self._parser, "set_language"):
                self._parser.set_language(self._language)  # type: ignore[attr-defined]
            else:
                self._parser.language = self._language  # type: ignore[assignment]

        except Exception:
            # Gracefully handle missing language bindings
            self._parser = None
            self._language = None

    def _should_use_astgrep(self) -> bool:
        """Check if ast-grep should be used for relationship extraction.

        Returns:
            True if config.use_astgrep is True and language is supported
        """
        if self._config is None:
            return False
        if not getattr(self._config, "use_astgrep", False):
            return False
        return self.language_id in {"python", "javascript", "typescript"}

    def _initialize_astgrep_processor(self) -> None:
        """Initialize ast-grep processor for relationship extraction."""
        try:
            from codexlens.parsers.astgrep_processor import (
                AstGrepPythonProcessor,
                is_astgrep_processor_available,
            )
            from codexlens.parsers.astgrep_js_ts_processor import (
                AstGrepJavaScriptProcessor,
                AstGrepTypeScriptProcessor,
            )

            if is_astgrep_processor_available():
                if self.language_id == "python":
                    self._astgrep_processor = AstGrepPythonProcessor(self.path)
                elif self.language_id == "javascript":
                    self._astgrep_processor = AstGrepJavaScriptProcessor(self.path)
                elif self.language_id == "typescript":
                    self._astgrep_processor = AstGrepTypeScriptProcessor(self.path)
        except ImportError:
            self._astgrep_processor = None

    def is_available(self) -> bool:
        """Check if tree-sitter parser is available.

        Returns:
            True if parser is initialized and ready
        """
        return self._parser is not None and self._language is not None

    def _parse_tree(self, text: str) -> Optional[tuple[bytes, TreeSitterNode]]:
        if not self.is_available() or self._parser is None:
            return None

        try:
            source_bytes = text.encode("utf8")
            tree = self._parser.parse(source_bytes)  # type: ignore[attr-defined]
            return source_bytes, tree.root_node
        except Exception:
            return None

    def parse_symbols(self, text: str) -> Optional[List[Symbol]]:
        """Parse source code and extract symbols without creating IndexedFile.

        Args:
            text: Source code text

        Returns:
            List of symbols if parsing succeeds, None if tree-sitter unavailable
        """
        parsed = self._parse_tree(text)
        if parsed is None:
            return None

        source_bytes, root = parsed
        try:
            return self._extract_symbols(source_bytes, root)
        except Exception:
            # Gracefully handle extraction errors
            return None

    def parse(self, text: str, path: Path) -> Optional[IndexedFile]:
        """Parse source code and extract symbols.

        Args:
            text: Source code text
            path: File path

        Returns:
            IndexedFile if parsing succeeds, None if tree-sitter unavailable
        """
        parsed = self._parse_tree(text)
        if parsed is None:
            return None

        source_bytes, root = parsed
        try:
            symbols = self._extract_symbols(source_bytes, root)
            # Pass source_code for ast-grep integration
            relationships = self._extract_relationships(
                source_bytes, root, path, source_code=text
            )

            return IndexedFile(
                path=str(path.resolve()),
                language=self.language_id,
                symbols=symbols,
                chunks=[],
                relationships=relationships,
            )
        except Exception:
            # Gracefully handle parsing errors
            return None

    def _extract_symbols(self, source_bytes: bytes, root: TreeSitterNode) -> List[Symbol]:
        """Extract symbols from AST.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node

        Returns:
            List of extracted symbols
        """
        if self.language_id == "python":
            return self._extract_python_symbols(source_bytes, root)
        elif self.language_id in {"javascript", "typescript"}:
            return self._extract_js_ts_symbols(source_bytes, root)
        else:
            return []

    def _extract_relationships(
        self,
        source_bytes: bytes,
        root: TreeSitterNode,
        path: Path,
        source_code: Optional[str] = None,
    ) -> List[CodeRelationship]:
        """Extract relationships, optionally using ast-grep.

        When config.use_astgrep is True and an ast-grep processor is available,
        uses ast-grep for relationship extraction. Otherwise, uses tree-sitter.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node from tree-sitter
            path: File path
            source_code: Optional source code string (required for ast-grep)

        Returns:
            List of extracted relationships
        """
        # Try ast-grep first if configured and available for this language.
        if self._astgrep_processor is not None and source_code is not None:
            try:
                astgrep_rels = self._extract_relationships_astgrep(source_code, path)
                if astgrep_rels is not None:
                    return astgrep_rels
            except Exception:
                # Fall back to tree-sitter on ast-grep failure
                pass

        if self.language_id == "python":
            return self._extract_python_relationships(source_bytes, root, path)
        if self.language_id in {"javascript", "typescript"}:
            return self._extract_js_ts_relationships(source_bytes, root, path)
        return []

    def _extract_relationships_astgrep(
        self,
        source_code: str,
        path: Path,
    ) -> Optional[List[CodeRelationship]]:
        """Extract relationships using ast-grep processor.

        Args:
            source_code: Source code text
            path: File path

        Returns:
            List of relationships, or None if ast-grep unavailable
        """
        if self._astgrep_processor is None:
            return None

        if not self._astgrep_processor.is_available():
            return None

        try:
            indexed = self._astgrep_processor.parse(source_code, path)
            if indexed is not None:
                return indexed.relationships
        except Exception:
            pass

        return None

    def _extract_python_relationships(
        self,
        source_bytes: bytes,
        root: TreeSitterNode,
        path: Path,
    ) -> List[CodeRelationship]:
        source_file = str(path.resolve())
        relationships: List[CodeRelationship] = []

        # Use a synthetic module scope so module-level imports/calls can be recorded
        # (useful for static global graph persistence).
        scope_stack: List[str] = ["<module>"]
        alias_stack: List[Dict[str, str]] = [{}]

        def record_import(target_symbol: str, source_line: int) -> None:
            if not target_symbol.strip() or not scope_stack:
                return
            relationships.append(
                CodeRelationship(
                    source_symbol=scope_stack[-1],
                    target_symbol=target_symbol,
                    relationship_type=RelationshipType.IMPORTS,
                    source_file=source_file,
                    target_file=None,
                    source_line=source_line,
                )
            )

        def record_call(target_symbol: str, source_line: int) -> None:
            if not target_symbol.strip() or not scope_stack:
                return
            base = target_symbol.split(".", 1)[0]
            if base in {"self", "cls"}:
                return
            relationships.append(
                CodeRelationship(
                    source_symbol=scope_stack[-1],
                    target_symbol=target_symbol,
                    relationship_type=RelationshipType.CALL,
                    source_file=source_file,
                    target_file=None,
                    source_line=source_line,
                )
            )

        def record_inherits(target_symbol: str, source_line: int) -> None:
            if not target_symbol.strip() or not scope_stack:
                return
            relationships.append(
                CodeRelationship(
                    source_symbol=scope_stack[-1],
                    target_symbol=target_symbol,
                    relationship_type=RelationshipType.INHERITS,
                    source_file=source_file,
                    target_file=None,
                    source_line=source_line,
                )
            )

        def visit(node: TreeSitterNode) -> None:
            pushed_scope = False
            pushed_aliases = False

            if node.type in {"class_definition", "function_definition", "async_function_definition"}:
                name_node = node.child_by_field_name("name")
                if name_node is not None:
                    scope_name = self._node_text(source_bytes, name_node).strip()
                    if scope_name:
                        scope_stack.append(scope_name)
                        pushed_scope = True
                        alias_stack.append(dict(alias_stack[-1]))
                        pushed_aliases = True

                if node.type == "class_definition" and pushed_scope:
                    superclasses = node.child_by_field_name("superclasses")
                    if superclasses is not None:
                        for child in superclasses.children:
                            dotted = self._python_expression_to_dotted(source_bytes, child)
                            if not dotted:
                                continue
                            resolved = self._resolve_alias_dotted(dotted, alias_stack[-1])
                            record_inherits(resolved, self._node_start_line(node))

            if node.type in {"import_statement", "import_from_statement"}:
                updates, imported_targets = self._python_import_aliases_and_targets(source_bytes, node)
                if updates:
                    alias_stack[-1].update(updates)
                for target_symbol in imported_targets:
                    record_import(target_symbol, self._node_start_line(node))

            if node.type == "call":
                fn_node = node.child_by_field_name("function")
                if fn_node is not None:
                    dotted = self._python_expression_to_dotted(source_bytes, fn_node)
                    if dotted:
                        resolved = self._resolve_alias_dotted(dotted, alias_stack[-1])
                        record_call(resolved, self._node_start_line(node))

            for child in node.children:
                visit(child)

            if pushed_aliases:
                alias_stack.pop()
            if pushed_scope:
                scope_stack.pop()

        visit(root)
        return relationships

    def _extract_js_ts_relationships(
        self,
        source_bytes: bytes,
        root: TreeSitterNode,
        path: Path,
    ) -> List[CodeRelationship]:
        source_file = str(path.resolve())
        relationships: List[CodeRelationship] = []

        # Use a synthetic module scope so module-level imports/calls can be recorded
        # (useful for static global graph persistence).
        scope_stack: List[str] = ["<module>"]
        alias_stack: List[Dict[str, str]] = [{}]

        def record_import(target_symbol: str, source_line: int) -> None:
            if not target_symbol.strip() or not scope_stack:
                return
            relationships.append(
                CodeRelationship(
                    source_symbol=scope_stack[-1],
                    target_symbol=target_symbol,
                    relationship_type=RelationshipType.IMPORTS,
                    source_file=source_file,
                    target_file=None,
                    source_line=source_line,
                )
            )

        def record_call(target_symbol: str, source_line: int) -> None:
            if not target_symbol.strip() or not scope_stack:
                return
            base = target_symbol.split(".", 1)[0]
            if base in {"this", "super"}:
                return
            relationships.append(
                CodeRelationship(
                    source_symbol=scope_stack[-1],
                    target_symbol=target_symbol,
                    relationship_type=RelationshipType.CALL,
                    source_file=source_file,
                    target_file=None,
                    source_line=source_line,
                )
            )

        def record_inherits(target_symbol: str, source_line: int) -> None:
            if not target_symbol.strip() or not scope_stack:
                return
            relationships.append(
                CodeRelationship(
                    source_symbol=scope_stack[-1],
                    target_symbol=target_symbol,
                    relationship_type=RelationshipType.INHERITS,
                    source_file=source_file,
                    target_file=None,
                    source_line=source_line,
                )
            )

        def visit(node: TreeSitterNode) -> None:
            pushed_scope = False
            pushed_aliases = False

            if node.type in {"function_declaration", "generator_function_declaration"}:
                name_node = node.child_by_field_name("name")
                if name_node is not None:
                    scope_name = self._node_text(source_bytes, name_node).strip()
                    if scope_name:
                        scope_stack.append(scope_name)
                        pushed_scope = True
                        alias_stack.append(dict(alias_stack[-1]))
                        pushed_aliases = True

            if node.type in {"class_declaration", "class"}:
                name_node = node.child_by_field_name("name")
                if name_node is not None:
                    scope_name = self._node_text(source_bytes, name_node).strip()
                    if scope_name:
                        scope_stack.append(scope_name)
                        pushed_scope = True
                        alias_stack.append(dict(alias_stack[-1]))
                        pushed_aliases = True

                if pushed_scope:
                    superclass = node.child_by_field_name("superclass")
                    if superclass is not None:
                        dotted = self._js_expression_to_dotted(source_bytes, superclass)
                        if dotted:
                            resolved = self._resolve_alias_dotted(dotted, alias_stack[-1])
                            record_inherits(resolved, self._node_start_line(node))

            if node.type == "variable_declarator":
                name_node = node.child_by_field_name("name")
                value_node = node.child_by_field_name("value")
                if (
                    name_node is not None
                    and value_node is not None
                    and name_node.type in {"identifier", "property_identifier"}
                    and value_node.type == "arrow_function"
                ):
                    scope_name = self._node_text(source_bytes, name_node).strip()
                    if scope_name:
                        scope_stack.append(scope_name)
                        pushed_scope = True
                        alias_stack.append(dict(alias_stack[-1]))
                        pushed_aliases = True

            if node.type == "method_definition" and self._has_class_ancestor(node):
                name_node = node.child_by_field_name("name")
                if name_node is not None:
                    scope_name = self._node_text(source_bytes, name_node).strip()
                    if scope_name and scope_name != "constructor":
                        scope_stack.append(scope_name)
                        pushed_scope = True
                        alias_stack.append(dict(alias_stack[-1]))
                        pushed_aliases = True

            if node.type in {"import_declaration", "import_statement"}:
                updates, imported_targets = self._js_import_aliases_and_targets(source_bytes, node)
                if updates:
                    alias_stack[-1].update(updates)
                for target_symbol in imported_targets:
                    record_import(target_symbol, self._node_start_line(node))

            # Best-effort support for CommonJS require() imports:
            # const fs = require("fs")
            if node.type == "variable_declarator":
                name_node = node.child_by_field_name("name")
                value_node = node.child_by_field_name("value")
                if (
                    name_node is not None
                    and value_node is not None
                    and name_node.type == "identifier"
                    and value_node.type == "call_expression"
                ):
                    callee = value_node.child_by_field_name("function")
                    args = value_node.child_by_field_name("arguments")
                    if (
                        callee is not None
                        and self._node_text(source_bytes, callee).strip() == "require"
                        and args is not None
                    ):
                        module_name = self._js_first_string_argument(source_bytes, args)
                        if module_name:
                            alias_stack[-1][self._node_text(source_bytes, name_node).strip()] = module_name
                            record_import(module_name, self._node_start_line(node))

            if node.type == "call_expression":
                fn_node = node.child_by_field_name("function")
                if fn_node is not None:
                    dotted = self._js_expression_to_dotted(source_bytes, fn_node)
                    if dotted:
                        resolved = self._resolve_alias_dotted(dotted, alias_stack[-1])
                        record_call(resolved, self._node_start_line(node))

            for child in node.children:
                visit(child)

            if pushed_aliases:
                alias_stack.pop()
            if pushed_scope:
                scope_stack.pop()

        visit(root)
        return relationships

    def _node_start_line(self, node: TreeSitterNode) -> int:
        return node.start_point[0] + 1

    def _resolve_alias_dotted(self, dotted: str, aliases: Dict[str, str]) -> str:
        dotted = (dotted or "").strip()
        if not dotted:
            return ""

        base, sep, rest = dotted.partition(".")
        resolved_base = aliases.get(base, base)
        if not rest:
            return resolved_base
        if resolved_base and rest:
            return f"{resolved_base}.{rest}"
        return resolved_base

    def _python_expression_to_dotted(self, source_bytes: bytes, node: TreeSitterNode) -> str:
        if node.type in {"identifier", "dotted_name"}:
            return self._node_text(source_bytes, node).strip()
        if node.type == "attribute":
            obj = node.child_by_field_name("object")
            attr = node.child_by_field_name("attribute")
            obj_text = self._python_expression_to_dotted(source_bytes, obj) if obj is not None else ""
            attr_text = self._node_text(source_bytes, attr).strip() if attr is not None else ""
            if obj_text and attr_text:
                return f"{obj_text}.{attr_text}"
            return obj_text or attr_text
        return ""

    def _python_import_aliases_and_targets(
        self,
        source_bytes: bytes,
        node: TreeSitterNode,
    ) -> tuple[Dict[str, str], List[str]]:
        aliases: Dict[str, str] = {}
        targets: List[str] = []

        if node.type == "import_statement":
            for i, child in enumerate(node.children):
                if child.type == "aliased_import":
                    name_node = child.child_by_field_name("name")
                    alias_node = child.child_by_field_name("alias")
                    if name_node is None:
                        continue
                    module_name = self._node_text(source_bytes, name_node).strip()
                    if not module_name:
                        continue
                    bound_name = (
                        self._node_text(source_bytes, alias_node).strip()
                        if alias_node is not None
                        else module_name.split(".", 1)[0]
                    )
                    if bound_name:
                        aliases[bound_name] = module_name
                    targets.append(module_name)
                elif child.type == "dotted_name":
                    module_name = self._node_text(source_bytes, child).strip()
                    if not module_name:
                        continue
                    bound_name = module_name.split(".", 1)[0]
                    if bound_name:
                        aliases[bound_name] = bound_name
                    targets.append(module_name)

        if node.type == "import_from_statement":
            module_name = ""
            module_node = node.child_by_field_name("module_name")
            if module_node is None:
                for child in node.children:
                    if child.type == "dotted_name":
                        module_node = child
                        break
            if module_node is not None:
                module_name = self._node_text(source_bytes, module_node).strip()

            for i, child in enumerate(node.children):
                if child.type == "aliased_import":
                    name_node = child.child_by_field_name("name")
                    alias_node = child.child_by_field_name("alias")
                    if name_node is None:
                        continue
                    imported_name = self._node_text(source_bytes, name_node).strip()
                    if not imported_name or imported_name == "*":
                        continue
                    target = f"{module_name}.{imported_name}" if module_name else imported_name
                    bound_name = (
                        self._node_text(source_bytes, alias_node).strip()
                        if alias_node is not None
                        else imported_name
                    )
                    if bound_name:
                        aliases[bound_name] = target
                    targets.append(target)
                elif child.type == "dotted_name" and node.field_name_for_child(i) == "name":
                    # tree-sitter-python represents `from X import A, B, C` as
                    # multiple dotted_name nodes (field: "name").
                    imported_name = self._node_text(source_bytes, child).strip()
                    if not imported_name:
                        continue
                    target = (
                        f"{module_name}.{imported_name}" if module_name else imported_name
                    )
                    aliases[imported_name] = target
                    targets.append(target)
                elif child.type == "identifier" and node.field_name_for_child(i) == "name":
                    imported_name = self._node_text(source_bytes, child).strip()
                    if not imported_name or imported_name in {"from", "import", "*"}:
                        continue
                    target = f"{module_name}.{imported_name}" if module_name else imported_name
                    aliases[imported_name] = target
                    targets.append(target)

        return aliases, targets

    def _js_expression_to_dotted(self, source_bytes: bytes, node: TreeSitterNode) -> str:
        if node.type in {"this", "super"}:
            return node.type
        if node.type in {"identifier", "property_identifier"}:
            return self._node_text(source_bytes, node).strip()
        if node.type == "member_expression":
            obj = node.child_by_field_name("object")
            prop = node.child_by_field_name("property")
            obj_text = self._js_expression_to_dotted(source_bytes, obj) if obj is not None else ""
            prop_text = self._js_expression_to_dotted(source_bytes, prop) if prop is not None else ""
            if obj_text and prop_text:
                return f"{obj_text}.{prop_text}"
            return obj_text or prop_text
        return ""

    def _js_import_aliases_and_targets(
        self,
        source_bytes: bytes,
        node: TreeSitterNode,
    ) -> tuple[Dict[str, str], List[str]]:
        aliases: Dict[str, str] = {}
        targets: List[str] = []

        module_name = ""
        source_node = node.child_by_field_name("source")
        if source_node is not None:
            module_name = self._node_text(source_bytes, source_node).strip().strip("\"'").strip()
        if module_name:
            targets.append(module_name)

        for child in node.children:
            if child.type == "import_clause":
                for clause_child in child.children:
                    if clause_child.type == "identifier":
                        # Default import: import React from "react"
                        local = self._node_text(source_bytes, clause_child).strip()
                        if local and module_name:
                            aliases[local] = module_name
                    if clause_child.type == "namespace_import":
                        # Namespace import: import * as fs from "fs"
                        name_node = clause_child.child_by_field_name("name")
                        if name_node is not None and module_name:
                            local = self._node_text(source_bytes, name_node).strip()
                            if local:
                                aliases[local] = module_name
                    if clause_child.type == "named_imports":
                        for spec in clause_child.children:
                            if spec.type != "import_specifier":
                                continue
                            name_node = spec.child_by_field_name("name")
                            alias_node = spec.child_by_field_name("alias")
                            if name_node is None:
                                continue
                            imported = self._node_text(source_bytes, name_node).strip()
                            if not imported:
                                continue
                            local = (
                                self._node_text(source_bytes, alias_node).strip()
                                if alias_node is not None
                                else imported
                            )
                            if local and module_name:
                                aliases[local] = f"{module_name}.{imported}"
                                targets.append(f"{module_name}.{imported}")

        return aliases, targets

    def _js_first_string_argument(self, source_bytes: bytes, args_node: TreeSitterNode) -> str:
        for child in args_node.children:
            if child.type == "string":
                return self._node_text(source_bytes, child).strip().strip("\"'").strip()
        return ""

    def _extract_python_symbols(self, source_bytes: bytes, root: TreeSitterNode) -> List[Symbol]:
        """Extract Python symbols from AST.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node

        Returns:
            List of Python symbols (classes, functions, methods)
        """
        symbols: List[Symbol] = []

        for node in self._iter_nodes(root):
            if node.type == "class_definition":
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    continue
                symbols.append(Symbol(
                    name=self._node_text(source_bytes, name_node),
                    kind="class",
                    range=self._node_range(node),
                ))
            elif node.type in {"function_definition", "async_function_definition"}:
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    continue
                symbols.append(Symbol(
                    name=self._node_text(source_bytes, name_node),
                    kind=self._python_function_kind(node),
                    range=self._node_range(node),
                ))

        return symbols

    def _extract_js_ts_symbols(self, source_bytes: bytes, root: TreeSitterNode) -> List[Symbol]:
        """Extract JavaScript/TypeScript symbols from AST.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node

        Returns:
            List of JS/TS symbols (classes, functions, methods)
        """
        symbols: List[Symbol] = []

        for node in self._iter_nodes(root):
            if node.type in {"class_declaration", "class"}:
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    continue
                symbols.append(Symbol(
                    name=self._node_text(source_bytes, name_node),
                    kind="class",
                    range=self._node_range(node),
                ))
            elif node.type in {"function_declaration", "generator_function_declaration"}:
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    continue
                symbols.append(Symbol(
                    name=self._node_text(source_bytes, name_node),
                    kind="function",
                    range=self._node_range(node),
                ))
            elif node.type == "variable_declarator":
                name_node = node.child_by_field_name("name")
                value_node = node.child_by_field_name("value")
                if (
                    name_node is None
                    or value_node is None
                    or name_node.type not in {"identifier", "property_identifier"}
                    or value_node.type != "arrow_function"
                ):
                    continue
                symbols.append(Symbol(
                    name=self._node_text(source_bytes, name_node),
                    kind="function",
                    range=self._node_range(node),
                ))
            elif node.type == "method_definition" and self._has_class_ancestor(node):
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    continue
                name = self._node_text(source_bytes, name_node)
                if name == "constructor":
                    continue
                symbols.append(Symbol(
                    name=name,
                    kind="method",
                    range=self._node_range(node),
                ))

        return symbols

    def _python_function_kind(self, node: TreeSitterNode) -> str:
        """Determine if Python function is a method or standalone function.

        Args:
            node: Function definition node

        Returns:
            'method' if inside a class, 'function' otherwise
        """
        parent = node.parent
        while parent is not None:
            if parent.type in {"function_definition", "async_function_definition"}:
                return "function"
            if parent.type == "class_definition":
                return "method"
            parent = parent.parent
        return "function"

    def _has_class_ancestor(self, node: TreeSitterNode) -> bool:
        """Check if node has a class ancestor.

        Args:
            node: AST node to check

        Returns:
            True if node is inside a class
        """
        parent = node.parent
        while parent is not None:
            if parent.type in {"class_declaration", "class"}:
                return True
            parent = parent.parent
        return False

    def _iter_nodes(self, root: TreeSitterNode):
        """Iterate over all nodes in AST.

        Args:
            root: Root node to start iteration

        Yields:
            AST nodes in depth-first order
        """
        stack = [root]
        while stack:
            node = stack.pop()
            yield node
            for child in reversed(node.children):
                stack.append(child)

    def _node_text(self, source_bytes: bytes, node: TreeSitterNode) -> str:
        """Extract text for a node.

        Args:
            source_bytes: Source code as bytes
            node: AST node

        Returns:
            Text content of node
        """
        return source_bytes[node.start_byte:node.end_byte].decode("utf8")

    def _node_range(self, node: TreeSitterNode) -> tuple[int, int]:
        """Get line range for a node.

        Args:
            node: AST node

        Returns:
            (start_line, end_line) tuple, 1-based inclusive
        """
        start_line = node.start_point[0] + 1
        end_line = node.end_point[0] + 1
        return (start_line, max(start_line, end_line))

    def count_tokens(self, text: str) -> int:
        """Count tokens in text.

        Args:
            text: Text to count tokens for

        Returns:
            Token count
        """
        return self._tokenizer.count_tokens(text)
