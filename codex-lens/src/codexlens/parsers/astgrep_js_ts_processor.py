"""Ast-grep processors for JavaScript/TypeScript relationship extraction.

These processors are intentionally narrower than the tree-sitter relationship
extractor: they focus on stable, high-signal edges for static graph usage:
- IMPORTS: ES module imports + CommonJS require() (string literal only)
- INHERITS: class/interface extends

They are used when Config.use_astgrep is True.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Callable, List, Optional, Sequence, Set, Tuple

from codexlens.entities import CodeRelationship, IndexedFile, RelationshipType
from codexlens.parsers.astgrep_processor import BaseAstGrepProcessor


_IDENT_RE = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")
_BRACE_IMPORT_RE = re.compile(
    r"\bimport\s+(?:type\s+)?(?:[A-Za-z_$][A-Za-z0-9_$]*\s*,\s*)?\{\s*(?P<names>[^}]*)\}\s*from\b",
    re.MULTILINE,
)


def _strip_quotes(value: str) -> str:
    value = (value or "").strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"', "`"}:
        return value[1:-1]
    return value


def _module_from_literal(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        return ""
    return _strip_quotes(raw).strip()


def _extract_named_imports(raw: str) -> List[str]:
    raw = (raw or "").strip()
    if not raw:
        return []

    # Normalize any surrounding braces the match might include.
    if raw.startswith("{") and raw.endswith("}"):
        raw = raw[1:-1].strip()

    # Split by commas at top-level; named imports do not nest in JS/TS syntax.
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    names: List[str] = []
    for part in parts:
        # TS: "type Foo" inside braces
        if part.startswith("type "):
            part = part[5:].strip()
        # Handle `foo as bar` (TS) / `foo as bar` (proposed) / `foo as bar`-style text.
        if " as " in part:
            part = part.split(" as ", 1)[0].strip()
        if _IDENT_RE.match(part):
            names.append(part)
    return names


def _extract_brace_import_names(statement: str) -> str:
    statement = (statement or "").strip()
    if not statement:
        return ""
    match = _BRACE_IMPORT_RE.search(statement)
    if not match:
        return ""
    return (match.group("names") or "").strip()


def _dedupe_relationships(rels: Sequence[CodeRelationship]) -> List[CodeRelationship]:
    seen: Set[Tuple[str, str, str]] = set()
    out: List[CodeRelationship] = []
    for r in rels:
        key = (r.source_symbol, r.target_symbol, r.relationship_type.value)
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


class _AstGrepJsTsProcessor(BaseAstGrepProcessor):
    def __init__(
        self,
        language_id: str,
        *,
        path: Optional[Path] = None,
        get_pattern: Callable[[str], str],
    ) -> None:
        super().__init__(language_id, path)
        self._get_pattern = get_pattern

    def parse(self, text: str, path: Path) -> Optional[IndexedFile]:
        if not self.is_available():
            return None

        try:
            relationships = self._extract_relationships(text, path)
            return IndexedFile(
                path=str(path.resolve()),
                language=self.language_id,
                symbols=[],
                chunks=[],
                relationships=relationships,
            )
        except Exception:
            return None

    def process_matches(  # type: ignore[override]
        self,
        matches,  # SgNode list (runtime-only type)
        source_code: str,
        path: Path,
    ) -> List[CodeRelationship]:
        # Not used by the current JS/TS processors; keep the interface for parity.
        _ = (matches, source_code, path)
        return []

    def _extract_relationships(self, source_code: str, path: Path) -> List[CodeRelationship]:
        source_file = str(path.resolve())
        rels: List[CodeRelationship] = []

        rels.extend(self._extract_imports(source_code, source_file=source_file))
        rels.extend(self._extract_inherits(source_code, source_file=source_file))

        return _dedupe_relationships(rels)

    def _extract_imports(self, source_code: str, *, source_file: str) -> List[CodeRelationship]:
        rels: List[CodeRelationship] = []

        def record(module_name: str, line: int) -> None:
            if not module_name:
                return
            rels.append(
                CodeRelationship(
                    source_symbol="<module>",
                    target_symbol=module_name,
                    relationship_type=RelationshipType.IMPORTS,
                    source_file=source_file,
                    target_file=None,
                    source_line=line,
                )
            )

        # Any `import ... from "mod"` form
        for pat_name in ("import_from_dq", "import_from_sq"):
            for node in self.run_ast_grep(source_code, self._get_pattern(pat_name)):
                mod = _module_from_literal(self._get_match(node, "MODULE"))
                if mod:
                    record(mod, self._get_line_number(node))

        # Side-effect import: import "mod"
        for pat_name in ("import_side_effect_dq", "import_side_effect_sq"):
            for node in self.run_ast_grep(source_code, self._get_pattern(pat_name)):
                mod = _module_from_literal(self._get_match(node, "MODULE"))
                if mod:
                    record(mod, self._get_line_number(node))

        # Named imports (named-only): import { a, b as c } from "mod"
        for pat_name in ("import_named_only_dq", "import_named_only_sq"):
            for node in self.run_ast_grep(source_code, self._get_pattern(pat_name)):
                mod = _module_from_literal(self._get_match(node, "MODULE"))
                if not mod:
                    continue
                raw_names = _extract_brace_import_names(self._get_node_text(node))
                for name in _extract_named_imports(raw_names):
                    record(f"{mod}.{name}", self._get_line_number(node))

        # Named imports (default + named): import X, { a, b as c } from "mod"
        for pat_name in ("import_default_named_dq", "import_default_named_sq"):
            for node in self.run_ast_grep(source_code, self._get_pattern(pat_name)):
                mod = _module_from_literal(self._get_match(node, "MODULE"))
                if not mod:
                    continue
                raw_names = _extract_brace_import_names(self._get_node_text(node))
                for name in _extract_named_imports(raw_names):
                    record(f"{mod}.{name}", self._get_line_number(node))

        # CommonJS require("mod") (string literal only)
        for pat_name in ("require_call_dq", "require_call_sq"):
            for node in self.run_ast_grep(source_code, self._get_pattern(pat_name)):
                mod = _module_from_literal(self._get_match(node, "MODULE"))
                if mod:
                    record(mod, self._get_line_number(node))

        return rels

    def _extract_inherits(self, source_code: str, *, source_file: str) -> List[CodeRelationship]:
        rels: List[CodeRelationship] = []

        for node in self.run_ast_grep(source_code, self._get_pattern("class_extends")):
            class_name = (self._get_match(node, "NAME") or "").strip()
            base_raw = (self._get_match(node, "BASE") or "").strip()
            if not class_name or not base_raw:
                continue
            base = base_raw.split("<", 1)[0].strip()
            if not base:
                continue
            rels.append(
                CodeRelationship(
                    source_symbol=class_name,
                    target_symbol=base,
                    relationship_type=RelationshipType.INHERITS,
                    source_file=source_file,
                    target_file=None,
                    source_line=self._get_line_number(node),
                )
            )

        return rels


class AstGrepJavaScriptProcessor(_AstGrepJsTsProcessor):
    def __init__(self, path: Optional[Path] = None) -> None:
        from codexlens.parsers.patterns.javascript import get_pattern as get_js_pattern

        super().__init__("javascript", path=path, get_pattern=get_js_pattern)


class AstGrepTypeScriptProcessor(_AstGrepJsTsProcessor):
    def __init__(self, path: Optional[Path] = None) -> None:
        from codexlens.parsers.patterns.typescript import get_pattern as get_ts_pattern

        super().__init__("typescript", path=path, get_pattern=get_ts_pattern)

    def _extract_inherits(self, source_code: str, *, source_file: str) -> List[CodeRelationship]:
        rels = super()._extract_inherits(source_code, source_file=source_file)

        # Interface extends: interface Foo extends Bar {}
        for node in self.run_ast_grep(source_code, self._get_pattern("interface_extends")):
            name = (self._get_match(node, "NAME") or "").strip()
            base_raw = (self._get_match(node, "BASE") or "").strip()
            if not name or not base_raw:
                continue
            base = base_raw.split("<", 1)[0].strip()
            if not base:
                continue
            rels.append(
                CodeRelationship(
                    source_symbol=name,
                    target_symbol=base,
                    relationship_type=RelationshipType.INHERITS,
                    source_file=source_file,
                    target_file=None,
                    source_line=self._get_line_number(node),
                )
            )

        return _dedupe_relationships(rels)

    def _extract_imports(self, source_code: str, *, source_file: str) -> List[CodeRelationship]:
        # Reuse JS logic for standard imports
        rels = super()._extract_imports(source_code, source_file=source_file)

        def record(module_name: str, line: int) -> None:
            if not module_name:
                return
            rels.append(
                CodeRelationship(
                    source_symbol="<module>",
                    target_symbol=module_name,
                    relationship_type=RelationshipType.IMPORTS,
                    source_file=source_file,
                    target_file=None,
                    source_line=line,
                )
            )

        # Type-only imports: import type ... from "mod"
        for pat_name in ("import_type_from_dq", "import_type_from_sq"):
            for node in self.run_ast_grep(source_code, self._get_pattern(pat_name)):
                mod = _module_from_literal(self._get_match(node, "MODULE"))
                if mod:
                    record(mod, self._get_line_number(node))

        for pat_name in ("import_type_named_only_dq", "import_type_named_only_sq"):
            for node in self.run_ast_grep(source_code, self._get_pattern(pat_name)):
                mod = _module_from_literal(self._get_match(node, "MODULE"))
                if not mod:
                    continue
                raw_names = _extract_brace_import_names(self._get_node_text(node))
                for name in _extract_named_imports(raw_names):
                    record(f"{mod}.{name}", self._get_line_number(node))

        for pat_name in ("import_type_default_named_dq", "import_type_default_named_sq"):
            for node in self.run_ast_grep(source_code, self._get_pattern(pat_name)):
                mod = _module_from_literal(self._get_match(node, "MODULE"))
                if not mod:
                    continue
                raw_names = _extract_brace_import_names(self._get_node_text(node))
                for name in _extract_named_imports(raw_names):
                    record(f"{mod}.{name}", self._get_line_number(node))

        return _dedupe_relationships(rels)


__all__ = [
    "AstGrepJavaScriptProcessor",
    "AstGrepTypeScriptProcessor",
]
