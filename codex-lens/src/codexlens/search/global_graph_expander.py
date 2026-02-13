"""Global graph expansion for search results using cross-directory relationships.

Expands top search results with related symbols by querying the global_relationships
table in GlobalSymbolIndex, enabling project-wide code graph traversal.
"""

from __future__ import annotations

import logging
import sqlite3
from typing import Dict, List, Optional, Sequence, Tuple

from codexlens.config import Config
from codexlens.entities import SearchResult
from codexlens.storage.global_index import GlobalSymbolIndex

logger = logging.getLogger(__name__)

# Score decay factors by relationship type.
# INHERITS has highest factor (strongest semantic link),
# IMPORTS next (explicit dependency), CALLS lowest (may be indirect).
DECAY_FACTORS: Dict[str, float] = {
    "imports": 0.4,
    "inherits": 0.5,
    "calls": 0.3,
}
DEFAULT_DECAY = 0.3


class GlobalGraphExpander:
    """Expands search results with cross-directory related symbols from the global graph."""

    def __init__(
        self,
        global_index: GlobalSymbolIndex,
        *,
        config: Optional[Config] = None,
    ) -> None:
        self._global_index = global_index
        self._config = config
        self._logger = logging.getLogger(__name__)

    def expand(
        self,
        results: Sequence[SearchResult],
        *,
        top_n: int = 10,
        max_related: int = 50,
    ) -> List[SearchResult]:
        """Expand top-N results with related symbols from global relationships.

        Args:
            results: Base ranked results from Stage 1.
            top_n: Only expand the top-N base results.
            max_related: Maximum related results to return.

        Returns:
            List of related SearchResult objects (does NOT include the input results).
        """
        if not results:
            return []

        # 1. Extract symbol names from top results
        symbols_with_scores = self._resolve_symbols(results, top_n)
        if not symbols_with_scores:
            return []

        symbol_names = [s[0] for s in symbols_with_scores]
        base_scores = {s[0]: s[1] for s in symbols_with_scores}

        # 2. Query global relationships
        relationships = self._query_relationships(symbol_names, limit=max_related * 3)
        if not relationships:
            return []

        # 3. Build expanded results with score decay
        expanded = self._build_expanded_results(
            relationships, base_scores, max_related
        )

        # 4. Deduplicate against input results
        input_keys: set[Tuple[str, Optional[str], Optional[int]]] = set()
        for r in results:
            input_keys.add((r.path, r.symbol_name, r.start_line))

        deduped: List[SearchResult] = []
        seen: set[Tuple[str, Optional[str], Optional[int]]] = set()
        for r in expanded:
            key = (r.path, r.symbol_name, r.start_line)
            if key not in input_keys and key not in seen:
                seen.add(key)
                deduped.append(r)

        return deduped[:max_related]

    def _resolve_symbols(
        self,
        results: Sequence[SearchResult],
        top_n: int,
    ) -> List[Tuple[str, float]]:
        """Extract (symbol_name, score) pairs from top results."""
        symbols: List[Tuple[str, float]] = []
        seen: set[str] = set()
        for r in list(results)[:top_n]:
            name = r.symbol_name
            if not name or name in seen:
                continue
            seen.add(name)
            symbols.append((name, float(r.score)))
        return symbols

    def _query_relationships(
        self,
        symbol_names: List[str],
        limit: int = 150,
    ) -> List[sqlite3.Row]:
        """Query global_relationships for symbols."""
        try:
            return self._global_index.query_relationships_for_symbols(
                symbol_names, limit=limit
            )
        except Exception as exc:
            self._logger.debug("Global graph query failed: %s", exc)
            return []

    def _resolve_target_to_file(
        self,
        target_qualified_name: str,
    ) -> Optional[Tuple[str, int, int]]:
        """Resolve target_qualified_name to (file_path, start_line, end_line).

        Tries ``file_path::symbol_name`` format first, then falls back to
        symbol name search in the global index.
        """
        # Format: "file_path::symbol_name"
        if "::" in target_qualified_name:
            parts = target_qualified_name.split("::", 1)
            target_file = parts[0]
            target_symbol = parts[1]
            try:
                symbols = self._global_index.search(target_symbol, limit=5)
                for sym in symbols:
                    if sym.file and str(sym.file) == target_file:
                        return (
                            target_file,
                            sym.range[0] if sym.range else 1,
                            sym.range[1] if sym.range else 1,
                        )
                # File path known but line info unavailable
                return (target_file, 1, 1)
            except Exception:
                return (target_file, 1, 1)

        # Plain symbol name (possibly dot-qualified like "mod.ClassName")
        try:
            leaf_name = target_qualified_name.rsplit(".", 1)[-1]
            symbols = self._global_index.search(leaf_name, limit=5)
            if symbols:
                sym = symbols[0]
                file_path = str(sym.file) if sym.file else None
                if file_path:
                    return (
                        file_path,
                        sym.range[0] if sym.range else 1,
                        sym.range[1] if sym.range else 1,
                    )
        except Exception:
            pass

        return None

    def _build_expanded_results(
        self,
        relationships: List[sqlite3.Row],
        base_scores: Dict[str, float],
        max_related: int,
    ) -> List[SearchResult]:
        """Build SearchResult list from relationships with score decay."""
        results: List[SearchResult] = []

        for rel in relationships:
            source_file = rel["source_file"]
            source_symbol = rel["source_symbol"]
            target_qname = rel["target_qualified_name"]
            rel_type = rel["relationship_type"]
            source_line = rel["source_line"]

            # Determine base score from the matched symbol
            base_score = base_scores.get(source_symbol, 0.0)
            if base_score == 0.0:
                # Try matching against the target leaf name
                leaf = target_qname.rsplit(".", 1)[-1] if "." in target_qname else target_qname
                if "::" in leaf:
                    leaf = leaf.split("::")[-1]
                base_score = base_scores.get(leaf, 0.0)
            if base_score == 0.0:
                base_score = 0.5  # Default when no match found

            # Apply decay factor
            decay = DECAY_FACTORS.get(rel_type, DEFAULT_DECAY)
            score = base_score * decay

            # Try to resolve target to file for a richer result
            target_info = self._resolve_target_to_file(target_qname)
            if target_info:
                t_file, t_start, t_end = target_info
                results.append(SearchResult(
                    path=t_file,
                    score=score,
                    excerpt=None,
                    content=None,
                    start_line=t_start,
                    end_line=t_end,
                    symbol_name=(
                        target_qname.split("::")[-1]
                        if "::" in target_qname
                        else target_qname.rsplit(".", 1)[-1]
                    ),
                    symbol_kind=None,
                    metadata={
                        "source": "static_graph",
                        "relationship_type": rel_type,
                        "from_symbol": source_symbol,
                        "from_file": source_file,
                    },
                ))
            else:
                # Use source file as fallback (we know the source exists)
                results.append(SearchResult(
                    path=source_file,
                    score=score * 0.8,  # Slight penalty for unresolved target
                    excerpt=None,
                    content=None,
                    start_line=source_line,
                    end_line=source_line,
                    symbol_name=source_symbol,
                    symbol_kind=None,
                    metadata={
                        "source": "static_graph",
                        "relationship_type": rel_type,
                        "target_qualified_name": target_qname,
                    },
                ))

            if len(results) >= max_related:
                break

        # Sort by score descending
        results.sort(key=lambda r: r.score, reverse=True)
        return results
