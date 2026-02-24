"""Semantic search API with RRF fusion.

This module provides the semantic_search() function for combining
vector, structural, and keyword search with configurable fusion strategies.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional

from .models import SemanticResult
from .utils import resolve_project

logger = logging.getLogger(__name__)


def semantic_search(
    project_root: str,
    query: str,
    mode: str = "fusion",
    vector_weight: float = 0.5,
    structural_weight: float = 0.3,
    keyword_weight: float = 0.2,
    fusion_strategy: str = "rrf",
    staged_stage2_mode: Optional[str] = None,
    kind_filter: Optional[List[str]] = None,
    limit: int = 20,
    include_match_reason: bool = False,
) -> List[SemanticResult]:
    """Semantic search - combining vector and structural search.

    This function provides a high-level API for semantic code search,
    combining vector similarity, structural (symbol + relationships),
    and keyword-based search methods with configurable fusion.

    Args:
        project_root: Project root directory
        query: Natural language query
        mode: Search mode
            - vector: Vector search only
            - structural: Structural search only (symbol + relationships)
            - fusion: Fusion search (default)
        vector_weight: Vector search weight [0, 1] (default 0.5)
        structural_weight: Structural search weight [0, 1] (default 0.3)
        keyword_weight: Keyword search weight [0, 1] (default 0.2)
        fusion_strategy: Fusion strategy (maps to chain_search.py)
            - rrf: Reciprocal Rank Fusion (recommended, default)
            - staged: Staged cascade -> staged_cascade_search
            - binary: Binary rerank cascade -> binary_cascade_search
            - hybrid: Binary rerank cascade (backward compat) -> binary_rerank_cascade_search
            - dense_rerank: Dense rerank cascade -> dense_rerank_cascade_search
        staged_stage2_mode: Optional override for staged Stage-2 expansion mode
            - precomputed: GraphExpander over per-dir graph_neighbors (default)
            - realtime: Live LSP expansion (requires LSP availability)
            - static_global_graph: GlobalGraphExpander over global_relationships
        kind_filter: Symbol type filter (e.g., ["function", "class"])
        limit: Max return count (default 20)
        include_match_reason: Generate match reason (heuristic, not LLM)

    Returns:
        Results sorted by fusion_score

    Degradation:
        - No vector index: vector_score=None, uses FTS + structural search
        - No relationship data: structural_score=None, vector search only

    Examples:
        >>> results = semantic_search(
        ...     "/path/to/project",
        ...     "authentication handler",
        ...     mode="fusion",
        ...     fusion_strategy="rrf"
        ... )
        >>> for r in results:
        ...     print(f"{r.symbol_name}: {r.fusion_score:.3f}")
    """
    # Validate and resolve project path
    project_path = resolve_project(project_root)

    # Normalize weights to sum to 1.0
    total_weight = vector_weight + structural_weight + keyword_weight
    if total_weight > 0:
        vector_weight = vector_weight / total_weight
        structural_weight = structural_weight / total_weight
        keyword_weight = keyword_weight / total_weight
    else:
        # Default to equal weights if all zero
        vector_weight = structural_weight = keyword_weight = 1.0 / 3.0

    # Initialize search infrastructure
    try:
        from codexlens.config import Config
        from codexlens.storage.registry import RegistryStore
        from codexlens.storage.path_mapper import PathMapper
        from codexlens.search.chain_search import ChainSearchEngine, SearchOptions
    except ImportError as exc:
        logger.error("Failed to import search dependencies: %s", exc)
        return []

    # Load config
    config = Config.load()

    # Optional per-call override for staged cascade Stage-2 mode.
    if staged_stage2_mode:
        stage2 = str(staged_stage2_mode).strip().lower()
        if stage2 in {"live"}:
            stage2 = "realtime"
        valid_stage2 = {"precomputed", "realtime", "static_global_graph"}
        if stage2 in valid_stage2:
            config.staged_stage2_mode = stage2
        else:
            logger.debug("Ignoring invalid staged_stage2_mode: %r", staged_stage2_mode)

    # Get or create registry and mapper
    # Build search options based on mode
    search_options = _build_search_options(
        mode=mode,
        vector_weight=vector_weight,
        structural_weight=structural_weight,
        keyword_weight=keyword_weight,
        limit=limit,
    )

    # Execute search based on fusion_strategy
    try:
        with RegistryStore() as registry:
            mapper = PathMapper()
            with ChainSearchEngine(registry, mapper, config=config) as engine:
                chain_result = _execute_search(
                    engine=engine,
                    query=query,
                    source_path=project_path,
                    fusion_strategy=fusion_strategy,
                    options=search_options,
                    limit=limit,
                )
    except Exception as exc:
        logger.error("Search execution failed: %s", exc)
        return []

    # Transform results to SemanticResult
    semantic_results = _transform_results(
        results=chain_result.results,
        mode=mode,
        vector_weight=vector_weight,
        structural_weight=structural_weight,
        keyword_weight=keyword_weight,
        kind_filter=kind_filter,
        include_match_reason=include_match_reason,
        query=query,
    )

    return semantic_results[:limit]


def _build_search_options(
    mode: str,
    vector_weight: float,
    structural_weight: float,
    keyword_weight: float,
    limit: int,
) -> "SearchOptions":
    """Build SearchOptions based on mode and weights.

    Args:
        mode: Search mode (vector, structural, fusion)
        vector_weight: Vector search weight
        structural_weight: Structural search weight
        keyword_weight: Keyword search weight
        limit: Result limit

    Returns:
        Configured SearchOptions
    """
    from codexlens.search.chain_search import SearchOptions

    # Default options
    options = SearchOptions(
        total_limit=limit * 2,  # Fetch extra for filtering
        limit_per_dir=limit,
        include_symbols=True,  # Always include symbols for structural
    )

    if mode == "vector":
        # Pure vector mode
        options.hybrid_mode = True
        options.enable_vector = True
        options.pure_vector = True
        options.enable_fuzzy = False
    elif mode == "structural":
        # Structural only - use FTS + symbols
        options.hybrid_mode = True
        options.enable_vector = False
        options.enable_fuzzy = True
        options.include_symbols = True
    else:
        # Fusion mode (default)
        options.hybrid_mode = True
        options.enable_vector = vector_weight > 0
        options.enable_fuzzy = keyword_weight > 0
        options.include_symbols = structural_weight > 0

        # Set custom weights for RRF
        if options.enable_vector and keyword_weight > 0:
            options.hybrid_weights = {
                "vector": vector_weight,
                "exact": keyword_weight * 0.7,
                "fuzzy": keyword_weight * 0.3,
            }

    return options


def _execute_search(
    engine: "ChainSearchEngine",
    query: str,
    source_path: Path,
    fusion_strategy: str,
    options: "SearchOptions",
    limit: int,
) -> "ChainSearchResult":
    """Execute search using appropriate strategy.

    Maps fusion_strategy to ChainSearchEngine methods:
    - rrf: Standard hybrid search with RRF fusion
    - staged: staged_cascade_search
    - binary: binary_cascade_search
    - hybrid: binary_rerank_cascade_search (backward compat)
    - dense_rerank: dense_rerank_cascade_search

    Args:
        engine: ChainSearchEngine instance
        query: Search query
        source_path: Project root path
        fusion_strategy: Strategy name
        options: Search options
        limit: Result limit

    Returns:
        ChainSearchResult from the search
    """
    from codexlens.search.chain_search import ChainSearchResult

    if fusion_strategy == "staged":
        # Use staged cascade search (4-stage pipeline)
        return engine.staged_cascade_search(
            query=query,
            source_path=source_path,
            k=limit,
            coarse_k=limit * 5,
            options=options,
        )
    elif fusion_strategy == "binary":
        # Use binary cascade search (binary coarse + dense fine)
        return engine.binary_cascade_search(
            query=query,
            source_path=source_path,
            k=limit,
            coarse_k=limit * 5,
            options=options,
        )
    elif fusion_strategy == "hybrid":
        # Backward compat: hybrid now maps to binary_rerank_cascade_search
        return engine.binary_rerank_cascade_search(
            query=query,
            source_path=source_path,
            k=limit,
            coarse_k=limit * 5,
            options=options,
        )
    else:
        # Default: rrf - Standard search with RRF fusion
        return engine.search(
            query=query,
            source_path=source_path,
            options=options,
        )


def _transform_results(
    results: List,
    mode: str,
    vector_weight: float,
    structural_weight: float,
    keyword_weight: float,
    kind_filter: Optional[List[str]],
    include_match_reason: bool,
    query: str,
) -> List[SemanticResult]:
    """Transform ChainSearchEngine results to SemanticResult.

    Args:
        results: List of SearchResult objects
        mode: Search mode
        vector_weight: Vector weight used
        structural_weight: Structural weight used
        keyword_weight: Keyword weight used
        kind_filter: Optional symbol kind filter
        include_match_reason: Whether to generate match reasons
        query: Original query (for match reason generation)

    Returns:
        List of SemanticResult objects
    """
    semantic_results = []

    for result in results:
        # Extract symbol info
        symbol_name = getattr(result, "symbol_name", None)
        symbol_kind = getattr(result, "symbol_kind", None)
        start_line = getattr(result, "start_line", None)

        # Use symbol object if available
        if hasattr(result, "symbol") and result.symbol:
            symbol_name = symbol_name or result.symbol.name
            symbol_kind = symbol_kind or result.symbol.kind
            if hasattr(result.symbol, "range") and result.symbol.range:
                start_line = start_line or result.symbol.range[0]

        # Filter by kind if specified
        if kind_filter and symbol_kind:
            if symbol_kind.lower() not in [k.lower() for k in kind_filter]:
                continue

        # Determine scores based on mode and metadata
        metadata = getattr(result, "metadata", {}) or {}
        fusion_score = result.score

        # Try to extract source scores from metadata
        source_scores = metadata.get("source_scores", {})
        vector_score: Optional[float] = None
        structural_score: Optional[float] = None

        if mode == "vector":
            # In pure vector mode, the main score is the vector score
            vector_score = result.score
            structural_score = None
        elif mode == "structural":
            # In structural mode, no vector score
            vector_score = None
            structural_score = result.score
        else:
            # Fusion mode - try to extract individual scores
            if "vector" in source_scores:
                vector_score = source_scores["vector"]
            elif metadata.get("fusion_method") == "simple_weighted":
                # From weighted fusion
                vector_score = source_scores.get("vector")

            # Structural score approximation (from exact/fuzzy FTS)
            fts_scores = []
            if "exact" in source_scores:
                fts_scores.append(source_scores["exact"])
            if "fuzzy" in source_scores:
                fts_scores.append(source_scores["fuzzy"])

            if fts_scores:
                structural_score = max(fts_scores)

        # Build snippet
        snippet = getattr(result, "excerpt", "") or getattr(result, "content", "")
        if len(snippet) > 500:
            snippet = snippet[:500] + "..."

        # Generate match reason if requested
        match_reason = None
        if include_match_reason:
            match_reason = _generate_match_reason(
                query=query,
                symbol_name=symbol_name,
                symbol_kind=symbol_kind,
                snippet=snippet,
                vector_score=vector_score,
                structural_score=structural_score,
            )

        semantic_result = SemanticResult(
            symbol_name=symbol_name or Path(result.path).stem,
            kind=symbol_kind or "unknown",
            file_path=result.path,
            line=start_line or 1,
            vector_score=vector_score,
            structural_score=structural_score,
            fusion_score=fusion_score,
            snippet=snippet,
            match_reason=match_reason,
        )

        semantic_results.append(semantic_result)

    # Sort by fusion_score descending
    semantic_results.sort(key=lambda r: r.fusion_score, reverse=True)

    return semantic_results


def _generate_match_reason(
    query: str,
    symbol_name: Optional[str],
    symbol_kind: Optional[str],
    snippet: str,
    vector_score: Optional[float],
    structural_score: Optional[float],
) -> str:
    """Generate human-readable match reason heuristically.

    This is a simple heuristic-based approach, not LLM-powered.

    Args:
        query: Original search query
        symbol_name: Symbol name if available
        symbol_kind: Symbol kind if available
        snippet: Code snippet
        vector_score: Vector similarity score
        structural_score: Structural match score

    Returns:
        Human-readable explanation string
    """
    reasons = []

    # Check for direct name match
    query_lower = query.lower()
    query_words = set(query_lower.split())

    if symbol_name:
        name_lower = symbol_name.lower()
        # Direct substring match
        if query_lower in name_lower or name_lower in query_lower:
            reasons.append(f"Symbol name '{symbol_name}' matches query")
        # Word overlap
        name_words = set(_split_camel_case(symbol_name).lower().split())
        overlap = query_words & name_words
        if overlap and not reasons:
            reasons.append(f"Symbol name contains: {', '.join(overlap)}")

    # Check snippet for keyword matches
    snippet_lower = snippet.lower()
    matching_words = [w for w in query_words if w in snippet_lower and len(w) > 2]
    if matching_words and len(reasons) < 2:
        reasons.append(f"Code contains keywords: {', '.join(matching_words[:3])}")

    # Add score-based reasoning
    if vector_score is not None and vector_score > 0.7:
        reasons.append("High semantic similarity")
    elif vector_score is not None and vector_score > 0.5:
        reasons.append("Moderate semantic similarity")

    if structural_score is not None and structural_score > 0.8:
        reasons.append("Strong structural match")

    # Symbol kind context
    if symbol_kind and len(reasons) < 3:
        reasons.append(f"Matched {symbol_kind}")

    if not reasons:
        reasons.append("Partial relevance based on content analysis")

    return "; ".join(reasons[:3])


def _split_camel_case(name: str) -> str:
    """Split camelCase and PascalCase to words.

    Args:
        name: Symbol name in camelCase or PascalCase

    Returns:
        Space-separated words
    """
    import re

    # Insert space before uppercase letters
    result = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
    # Insert space before uppercase followed by lowercase
    result = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", result)
    # Replace underscores with spaces
    result = result.replace("_", " ")

    return result
