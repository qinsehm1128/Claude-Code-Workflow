"""file_context API implementation.

This module provides the file_context() function for retrieving
method call graphs from a source file.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import List, Optional, Tuple

from ..entities import Symbol
from ..storage.global_index import GlobalSymbolIndex
from ..storage.dir_index import DirIndexStore
from ..storage.registry import RegistryStore
from ..errors import IndexNotFoundError
from .models import (
    FileContextResult,
    MethodContext,
    CallInfo,
)
from .utils import resolve_project, normalize_relationship_type

logger = logging.getLogger(__name__)


def file_context(
    project_root: str,
    file_path: str,
    include_calls: bool = True,
    include_callers: bool = True,
    max_depth: int = 1,
    format: str = "brief"
) -> FileContextResult:
    """Get method call context for a code file.

    Retrieves all methods/functions in the file along with their
    outgoing calls and incoming callers.

    Args:
        project_root: Project root directory (for index location)
        file_path: Path to the code file to analyze
        include_calls: Whether to include outgoing calls
        include_callers: Whether to include incoming callers
        max_depth: Call chain depth (V1 only supports 1)
        format: Output format (brief | detailed | tree)

    Returns:
        FileContextResult with method contexts and summary

    Raises:
        IndexNotFoundError: If project is not indexed
        FileNotFoundError: If file does not exist
        ValueError: If max_depth > 1 (V1 limitation)
    """
    # V1 limitation: only depth=1 supported
    if max_depth > 1:
        raise ValueError(
            f"max_depth > 1 not supported in V1. "
            f"Requested: {max_depth}, supported: 1"
        )

    project_path = resolve_project(project_root)
    file_path_resolved = Path(file_path).resolve()

    # Validate file exists
    if not file_path_resolved.exists():
        raise FileNotFoundError(f"File not found: {file_path_resolved}")

    # Get project info from registry
    registry = RegistryStore()
    project_info = registry.get_project(project_path)
    if project_info is None:
        raise IndexNotFoundError(f"Project not indexed: {project_path}")

    # Open global symbol index
    index_db = project_info.index_root / "_global_symbols.db"
    if not index_db.exists():
        raise IndexNotFoundError(f"Global symbol index not found: {index_db}")

    global_index = GlobalSymbolIndex(str(index_db), project_info.id)

    # Get all symbols in the file
    symbols = global_index.get_file_symbols(str(file_path_resolved))

    # Filter to functions, methods, and classes
    method_symbols = [
        s for s in symbols
        if s.kind in ("function", "method", "class")
    ]

    logger.debug(f"Found {len(method_symbols)} methods in {file_path}")

    # Try to find dir_index for relationship queries
    dir_index = _find_dir_index(project_info, file_path_resolved)

    # Build method contexts
    methods: List[MethodContext] = []
    outgoing_resolved = True
    incoming_resolved = True
    targets_resolved = True

    for symbol in method_symbols:
        calls: List[CallInfo] = []
        callers: List[CallInfo] = []

        if include_calls and dir_index:
            try:
                outgoing = dir_index.get_outgoing_calls(
                    str(file_path_resolved),
                    symbol.name
                )
                for target_name, rel_type, line, target_file in outgoing:
                    calls.append(CallInfo(
                        symbol_name=target_name,
                        file_path=target_file,
                        line=line,
                        relationship=normalize_relationship_type(rel_type)
                    ))
                    if target_file is None:
                        targets_resolved = False
            except Exception as e:
                logger.debug(f"Failed to get outgoing calls: {e}")
                outgoing_resolved = False

        if include_callers and dir_index:
            try:
                incoming = dir_index.get_incoming_calls(symbol.name)
                for source_name, rel_type, line, source_file in incoming:
                    callers.append(CallInfo(
                        symbol_name=source_name,
                        file_path=source_file,
                        line=line,
                        relationship=normalize_relationship_type(rel_type)
                    ))
            except Exception as e:
                logger.debug(f"Failed to get incoming calls: {e}")
                incoming_resolved = False

        methods.append(MethodContext(
            name=symbol.name,
            kind=symbol.kind,
            line_range=symbol.range if symbol.range else (1, 1),
            signature=None,  # Could extract from source
            calls=calls,
            callers=callers
        ))

    # Detect language from file extension
    language = _detect_language(file_path_resolved)

    # Generate summary
    summary = _generate_summary(file_path_resolved, methods, format)

    return FileContextResult(
        file_path=str(file_path_resolved),
        language=language,
        methods=methods,
        summary=summary,
        discovery_status={
            "outgoing_resolved": outgoing_resolved,
            "incoming_resolved": incoming_resolved,
            "targets_resolved": targets_resolved
        }
    )


def _find_dir_index(project_info, file_path: Path) -> Optional[DirIndexStore]:
    """Find the dir_index that contains the file.

    Args:
        project_info: Project information from registry
        file_path: Path to the file

    Returns:
        DirIndexStore if found, None otherwise
    """
    try:
        # Look for _index.db in file's directory or parent directories
        current = file_path.parent
        while current != current.parent:
            index_db = current / "_index.db"
            if index_db.exists():
                return DirIndexStore(str(index_db))

            # Also check in project's index_root
            relative = current.relative_to(project_info.source_root)
            index_in_cache = project_info.index_root / relative / "_index.db"
            if index_in_cache.exists():
                return DirIndexStore(str(index_in_cache))

            current = current.parent
    except Exception as e:
        logger.debug(f"Failed to find dir_index: {e}")

    return None


def _detect_language(file_path: Path) -> str:
    """Detect programming language from file extension.

    Args:
        file_path: Path to the file

    Returns:
        Language name
    """
    ext_map = {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".jsx": "javascript",
        ".tsx": "typescript",
        ".go": "go",
        ".rs": "rust",
        ".java": "java",
        ".swift": "swift",
        ".c": "c",
        ".cpp": "cpp",
        ".h": "c",
        ".hpp": "cpp",
    }
    return ext_map.get(file_path.suffix.lower(), "unknown")


def _generate_summary(
    file_path: Path,
    methods: List[MethodContext],
    format: str
) -> str:
    """Generate human-readable summary of file context.

    Args:
        file_path: Path to the file
        methods: List of method contexts
        format: Output format (brief | detailed | tree)

    Returns:
        Markdown-formatted summary
    """
    lines = [f"## {file_path.name} ({len(methods)} methods)\n"]

    for method in methods:
        start, end = method.line_range
        lines.append(f"### {method.name} (line {start}-{end})")

        if method.calls:
            calls_str = ", ".join(
                f"{c.symbol_name} ({c.file_path or 'unresolved'}:{c.line})"
                if format == "detailed"
                else c.symbol_name
                for c in method.calls
            )
            lines.append(f"- Calls: {calls_str}")

        if method.callers:
            callers_str = ", ".join(
                f"{c.symbol_name} ({c.file_path}:{c.line})"
                if format == "detailed"
                else c.symbol_name
                for c in method.callers
            )
            lines.append(f"- Called by: {callers_str}")

        if not method.calls and not method.callers:
            lines.append("- (no call relationships)")

        lines.append("")

    return "\n".join(lines)
