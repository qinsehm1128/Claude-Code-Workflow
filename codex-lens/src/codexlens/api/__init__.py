"""Codexlens Public API Layer.

This module exports all public API functions and dataclasses for the
codexlens LSP-like functionality.

Dataclasses (from models.py):
    - CallInfo: Call relationship information
    - MethodContext: Method context with call relationships
    - FileContextResult: File context result with method summaries
    - DefinitionResult: Definition lookup result
    - ReferenceResult: Reference lookup result
    - GroupedReferences: References grouped by definition
    - SymbolInfo: Symbol information for workspace search
    - HoverInfo: Hover information for a symbol
    - SemanticResult: Semantic search result

Utility functions (from utils.py):
    - resolve_project: Resolve and validate project root path
    - normalize_relationship_type: Normalize relationship type to canonical form
    - rank_by_proximity: Rank results by file path proximity

Example:
    >>> from codexlens.api import (
    ...     DefinitionResult,
    ...     resolve_project,
    ...     normalize_relationship_type
    ... )
    >>> project = resolve_project("/path/to/project")
    >>> rel_type = normalize_relationship_type("calls")
    >>> print(rel_type)
    'call'
"""

from __future__ import annotations

# Dataclasses
from .models import (
    CallInfo,
    MethodContext,
    FileContextResult,
    DefinitionResult,
    ReferenceResult,
    GroupedReferences,
    SymbolInfo,
    HoverInfo,
    SemanticResult,
)

# Utility functions
from .utils import (
    resolve_project,
    normalize_relationship_type,
    rank_by_proximity,
    rank_by_score,
)

# API functions
from .definition import find_definition
from .symbols import workspace_symbols
from .hover import get_hover
from .file_context import file_context
from .references import find_references
from .semantic import semantic_search
from .lsp_lifecycle import lsp_start, lsp_stop, lsp_restart

__all__ = [
    # Dataclasses
    "CallInfo",
    "MethodContext",
    "FileContextResult",
    "DefinitionResult",
    "ReferenceResult",
    "GroupedReferences",
    "SymbolInfo",
    "HoverInfo",
    "SemanticResult",
    # Utility functions
    "resolve_project",
    "normalize_relationship_type",
    "rank_by_proximity",
    "rank_by_score",
    # API functions
    "find_definition",
    "workspace_symbols",
    "get_hover",
    "file_context",
    "find_references",
    "semantic_search",
    # LSP lifecycle
    "lsp_start",
    "lsp_stop",
    "lsp_restart",
]
