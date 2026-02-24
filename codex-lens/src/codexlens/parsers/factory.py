"""Parser factory for CodexLens.

Python and JavaScript/TypeScript parsing use Tree-Sitter grammars when
available. Regex fallbacks are retained to preserve the existing parser
interface and behavior in minimal environments.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Protocol

from codexlens.config import Config
from codexlens.entities import CodeRelationship, IndexedFile, RelationshipType, Symbol
from codexlens.parsers.treesitter_parser import TreeSitterSymbolParser


class Parser(Protocol):
    def parse(self, text: str, path: Path) -> IndexedFile: ...


@dataclass
class SimpleRegexParser:
    language_id: str
    config: Optional[Config] = None

    def parse(self, text: str, path: Path) -> IndexedFile:
        # Try tree-sitter first for supported languages
        if self.language_id in {"python", "javascript", "typescript"}:
            ts_parser = TreeSitterSymbolParser(
                self.language_id,
                path,
                config=self.config,
            )
            if ts_parser.is_available():
                indexed = ts_parser.parse(text, path)
                if indexed is not None:
                    return indexed

        # Fallback to regex parsing
        if self.language_id == "python":
            symbols = _parse_python_symbols_regex(text)
            relationships = _parse_python_relationships_regex(text, path)
        elif self.language_id in {"javascript", "typescript"}:
            symbols = _parse_js_ts_symbols_regex(text)
            relationships = _parse_js_ts_relationships_regex(text, path)
        elif self.language_id == "java":
            symbols = _parse_java_symbols(text)
            relationships = []
        elif self.language_id == "go":
            symbols = _parse_go_symbols(text)
            relationships = []
        elif self.language_id == "markdown":
            symbols = _parse_markdown_symbols(text)
            relationships = []
        elif self.language_id == "text":
            symbols = _parse_text_symbols(text)
            relationships = []
        else:
            symbols = _parse_generic_symbols(text)
            relationships = []

        return IndexedFile(
            path=str(path.resolve()),
            language=self.language_id,
            symbols=symbols,
            chunks=[],
            relationships=relationships,
        )


class ParserFactory:
    def __init__(self, config: Config) -> None:
        self.config = config
        self._parsers: Dict[str, Parser] = {}

    def get_parser(self, language_id: str) -> Parser:
        if language_id not in self._parsers:
            self._parsers[language_id] = SimpleRegexParser(
                language_id,
                config=self.config,
            )
        return self._parsers[language_id]


# Regex-based fallback parsers
_PY_CLASS_RE = re.compile(r"^\s*class\s+([A-Za-z_]\w*)\b")
_PY_DEF_RE = re.compile(r"^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(")

_PY_IMPORT_RE = re.compile(r"^(?:from\s+([\w.]+)\s+)?import\s+([\w.,\s]+)")
_PY_CALL_RE = re.compile(r"(?<![.\w])(\w+)\s*\(")




def _parse_python_symbols(text: str) -> List[Symbol]:
    """Parse Python symbols, using tree-sitter if available, regex fallback."""
    ts_parser = TreeSitterSymbolParser("python")
    if ts_parser.is_available():
        symbols = ts_parser.parse_symbols(text)
        if symbols is not None:
            return symbols
    return _parse_python_symbols_regex(text)


def _parse_js_ts_symbols(
    text: str,
    language_id: str = "javascript",
    path: Optional[Path] = None,
) -> List[Symbol]:
    """Parse JS/TS symbols, using tree-sitter if available, regex fallback."""
    ts_parser = TreeSitterSymbolParser(language_id, path)
    if ts_parser.is_available():
        symbols = ts_parser.parse_symbols(text)
        if symbols is not None:
            return symbols
    return _parse_js_ts_symbols_regex(text)


def _parse_python_symbols_regex(text: str) -> List[Symbol]:
    symbols: List[Symbol] = []
    current_class_indent: Optional[int] = None
    for i, line in enumerate(text.splitlines(), start=1):
        class_match = _PY_CLASS_RE.match(line)
        if class_match:
            current_class_indent = len(line) - len(line.lstrip(" "))
            symbols.append(Symbol(name=class_match.group(1), kind="class", range=(i, i)))
            continue
        def_match = _PY_DEF_RE.match(line)
        if def_match:
            indent = len(line) - len(line.lstrip(" "))
            kind = "method" if current_class_indent is not None and indent > current_class_indent else "function"
            symbols.append(Symbol(name=def_match.group(1), kind=kind, range=(i, i)))
            continue
        if current_class_indent is not None:
            indent = len(line) - len(line.lstrip(" "))
            if line.strip() and indent <= current_class_indent:
                current_class_indent = None
    return symbols


def _parse_python_relationships_regex(text: str, path: Path) -> List[CodeRelationship]:
    relationships: List[CodeRelationship] = []
    current_scope: str | None = None
    source_file = str(path.resolve())

    for line_num, line in enumerate(text.splitlines(), start=1):
        class_match = _PY_CLASS_RE.match(line)
        if class_match:
            current_scope = class_match.group(1)
            continue

        def_match = _PY_DEF_RE.match(line)
        if def_match:
            current_scope = def_match.group(1)
            continue

        if current_scope is None:
            continue

        import_match = _PY_IMPORT_RE.search(line)
        if import_match:
            import_target = import_match.group(1) or import_match.group(2)
            if import_target:
                relationships.append(
                    CodeRelationship(
                        source_symbol=current_scope,
                        target_symbol=import_target.strip(),
                        relationship_type=RelationshipType.IMPORTS,
                        source_file=source_file,
                        target_file=None,
                        source_line=line_num,
                    )
                )

        for call_match in _PY_CALL_RE.finditer(line):
            call_name = call_match.group(1)
            if call_name in {
                "if",
                "for",
                "while",
                "return",
                "print",
                "len",
                "str",
                "int",
                "float",
                "list",
                "dict",
                "set",
                "tuple",
                current_scope,
            }:
                continue
            relationships.append(
                CodeRelationship(
                    source_symbol=current_scope,
                    target_symbol=call_name,
                    relationship_type=RelationshipType.CALL,
                    source_file=source_file,
                    target_file=None,
                    source_line=line_num,
                )
            )

    return relationships


_JS_FUNC_RE = re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(")
_JS_CLASS_RE = re.compile(r"^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b")
_JS_ARROW_RE = re.compile(
    r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?[^)]*\)?\s*=>"
)
_JS_METHOD_RE = re.compile(r"^\s+(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{")
_JS_IMPORT_RE = re.compile(r"import\s+.*\s+from\s+['\"]([^'\"]+)['\"]")
_JS_CALL_RE = re.compile(r"(?<![.\w])(\w+)\s*\(")


def _parse_js_ts_symbols_regex(text: str) -> List[Symbol]:
    symbols: List[Symbol] = []
    in_class = False
    class_brace_depth = 0
    brace_depth = 0

    for i, line in enumerate(text.splitlines(), start=1):
        brace_depth += line.count("{") - line.count("}")

        class_match = _JS_CLASS_RE.match(line)
        if class_match:
            symbols.append(Symbol(name=class_match.group(1), kind="class", range=(i, i)))
            in_class = True
            class_brace_depth = brace_depth
            continue

        if in_class and brace_depth < class_brace_depth:
            in_class = False

        func_match = _JS_FUNC_RE.match(line)
        if func_match:
            symbols.append(Symbol(name=func_match.group(1), kind="function", range=(i, i)))
            continue

        arrow_match = _JS_ARROW_RE.match(line)
        if arrow_match:
            symbols.append(Symbol(name=arrow_match.group(1), kind="function", range=(i, i)))
            continue

        if in_class:
            method_match = _JS_METHOD_RE.match(line)
            if method_match:
                name = method_match.group(1)
                if name != "constructor":
                    symbols.append(Symbol(name=name, kind="method", range=(i, i)))

    return symbols


def _parse_js_ts_relationships_regex(text: str, path: Path) -> List[CodeRelationship]:
    relationships: List[CodeRelationship] = []
    current_scope: str | None = None
    source_file = str(path.resolve())

    for line_num, line in enumerate(text.splitlines(), start=1):
        class_match = _JS_CLASS_RE.match(line)
        if class_match:
            current_scope = class_match.group(1)
            continue

        func_match = _JS_FUNC_RE.match(line)
        if func_match:
            current_scope = func_match.group(1)
            continue

        arrow_match = _JS_ARROW_RE.match(line)
        if arrow_match:
            current_scope = arrow_match.group(1)
            continue

        if current_scope is None:
            continue

        import_match = _JS_IMPORT_RE.search(line)
        if import_match:
            relationships.append(
                CodeRelationship(
                    source_symbol=current_scope,
                    target_symbol=import_match.group(1),
                    relationship_type=RelationshipType.IMPORTS,
                    source_file=source_file,
                    target_file=None,
                    source_line=line_num,
                )
            )

        for call_match in _JS_CALL_RE.finditer(line):
            call_name = call_match.group(1)
            if call_name in {current_scope}:
                continue
            relationships.append(
                CodeRelationship(
                    source_symbol=current_scope,
                    target_symbol=call_name,
                    relationship_type=RelationshipType.CALL,
                    source_file=source_file,
                    target_file=None,
                    source_line=line_num,
                )
            )

    return relationships


_JAVA_CLASS_RE = re.compile(r"^\s*(?:public\s+)?class\s+([A-Za-z_]\w*)\b")
_JAVA_METHOD_RE = re.compile(
    r"^\s*(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\("
)


def _parse_java_symbols(text: str) -> List[Symbol]:
    symbols: List[Symbol] = []
    for i, line in enumerate(text.splitlines(), start=1):
        class_match = _JAVA_CLASS_RE.match(line)
        if class_match:
            symbols.append(Symbol(name=class_match.group(1), kind="class", range=(i, i)))
            continue
        method_match = _JAVA_METHOD_RE.match(line)
        if method_match:
            symbols.append(Symbol(name=method_match.group(1), kind="method", range=(i, i)))
    return symbols


_GO_FUNC_RE = re.compile(r"^\s*func\s+(?:\([^)]+\)\s+)?([A-Za-z_]\w*)\s*\(")
_GO_TYPE_RE = re.compile(r"^\s*type\s+([A-Za-z_]\w*)\s+(?:struct|interface)\b")


def _parse_go_symbols(text: str) -> List[Symbol]:
    symbols: List[Symbol] = []
    for i, line in enumerate(text.splitlines(), start=1):
        type_match = _GO_TYPE_RE.match(line)
        if type_match:
            symbols.append(Symbol(name=type_match.group(1), kind="class", range=(i, i)))
            continue
        func_match = _GO_FUNC_RE.match(line)
        if func_match:
            symbols.append(Symbol(name=func_match.group(1), kind="function", range=(i, i)))
    return symbols


_GENERIC_DEF_RE = re.compile(r"^\s*(?:def|function|func)\s+([A-Za-z_]\w*)\b")
_GENERIC_CLASS_RE = re.compile(r"^\s*(?:class|struct|interface)\s+([A-Za-z_]\w*)\b")


def _parse_generic_symbols(text: str) -> List[Symbol]:
    symbols: List[Symbol] = []
    for i, line in enumerate(text.splitlines(), start=1):
        class_match = _GENERIC_CLASS_RE.match(line)
        if class_match:
            symbols.append(Symbol(name=class_match.group(1), kind="class", range=(i, i)))
            continue
        def_match = _GENERIC_DEF_RE.match(line)
        if def_match:
            symbols.append(Symbol(name=def_match.group(1), kind="function", range=(i, i)))
    return symbols


# Markdown heading regex: # Heading, ## Heading, etc.
_MD_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$")


def _parse_markdown_symbols(text: str) -> List[Symbol]:
    """Parse Markdown headings as symbols.
    
    Extracts # headings as 'section' symbols with heading level as kind suffix.
    """
    symbols: List[Symbol] = []
    for i, line in enumerate(text.splitlines(), start=1):
        heading_match = _MD_HEADING_RE.match(line)
        if heading_match:
            level = len(heading_match.group(1))
            title = heading_match.group(2).strip()
            # Use 'section' kind with level indicator
            kind = f"h{level}"
            symbols.append(Symbol(name=title, kind=kind, range=(i, i)))
    return symbols


def _parse_text_symbols(text: str) -> List[Symbol]:
    """Parse plain text files - no symbols, just index content."""
    # Text files don't have structured symbols, return empty list
    # The file content will still be indexed for FTS search
    return []
