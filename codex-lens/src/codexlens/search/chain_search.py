"""Chain search engine for recursive multi-directory searching.

Provides parallel search across directory hierarchies using indexed _index.db files.
Supports depth-limited traversal, result aggregation, and symbol search.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict, Any, Literal, Tuple, TYPE_CHECKING
import json
import logging
import os
import threading
import time

from codexlens.entities import SearchResult, Symbol

if TYPE_CHECKING:
    import numpy as np

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
from codexlens.config import Config
from codexlens.storage.registry import RegistryStore, DirMapping
from codexlens.storage.dir_index import DirIndexStore, SubdirLink
from codexlens.storage.global_index import GlobalSymbolIndex
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.sqlite_store import SQLiteStore
from codexlens.storage.vector_meta_store import VectorMetadataStore
from codexlens.config import BINARY_VECTORS_MMAP_NAME, VECTORS_META_DB_NAME
from codexlens.search.hybrid_search import HybridSearchEngine


@dataclass
class SearchOptions:
    """Configuration options for chain search.

    Attributes:
        depth: Maximum search depth (-1 = unlimited, 0 = current dir only)
        max_workers: Number of parallel worker threads
        limit_per_dir: Maximum results per directory
        total_limit: Total result limit across all directories
        offset: Pagination offset - skip first N results (default 0)
        include_symbols: Whether to include symbol search results
        files_only: Return only file paths without excerpts
        include_semantic: Whether to include semantic keyword search results
        code_only: Only return code files (excludes md, txt, json, yaml, xml, etc.)
        exclude_extensions: List of file extensions to exclude (e.g., ["md", "txt", "json"])
        hybrid_mode: Enable hybrid search with RRF fusion (default False)
        enable_fuzzy: Enable fuzzy FTS in hybrid mode (default True)
        enable_vector: Enable vector semantic search (default False)
        pure_vector: If True, only use vector search without FTS fallback (default False)
        enable_cascade: Enable cascade (binary+dense) two-stage retrieval (default False)
        hybrid_weights: Custom RRF weights for hybrid search (optional)
        group_results: Enable grouping of similar results (default False)
        grouping_threshold: Score threshold for grouping similar results (default 0.01)
    """
    depth: int = -1
    max_workers: int = 8
    limit_per_dir: int = 10
    total_limit: int = 100
    offset: int = 0
    include_symbols: bool = False
    files_only: bool = False
    include_semantic: bool = False
    code_only: bool = False
    exclude_extensions: Optional[List[str]] = None
    hybrid_mode: bool = False
    enable_fuzzy: bool = True
    enable_vector: bool = False
    pure_vector: bool = False
    enable_cascade: bool = False
    hybrid_weights: Optional[Dict[str, float]] = None
    group_results: bool = False
    grouping_threshold: float = 0.01


@dataclass
class SearchStats:
    """Statistics collected during search execution.

    Attributes:
        dirs_searched: Number of directories searched
        files_matched: Number of files with matches
        time_ms: Total search time in milliseconds
        errors: List of error messages encountered
    """
    dirs_searched: int = 0
    files_matched: int = 0
    time_ms: float = 0
    errors: List[str] = field(default_factory=list)


@dataclass
class ChainSearchResult:
    """Comprehensive search result with metadata.

    Attributes:
        query: Original search query
        results: List of SearchResult objects
        related_results: Expanded results from graph neighbors (optional)
        symbols: List of Symbol objects (if include_symbols=True)
        stats: SearchStats with execution metrics
    """
    query: str
    results: List[SearchResult]
    symbols: List[Symbol]
    stats: SearchStats
    related_results: List[SearchResult] = field(default_factory=list)


@dataclass
class ReferenceResult:
    """Result from reference search in code_relationships table.

    Attributes:
        file_path: Path to the file containing the reference
        line: Line number where the reference occurs (1-based)
        column: Column number where the reference occurs (0-based)
        context: Surrounding code snippet for context
        relationship_type: Type of relationship (call, import, inheritance, etc.)
    """
    file_path: str
    line: int
    column: int
    context: str
    relationship_type: str


class ChainSearchEngine:
    """Parallel chain search engine for hierarchical directory indexes.

    Searches across multiple directory indexes in parallel, following subdirectory
    links to recursively traverse the file tree. Supports depth limits, result
    aggregation, and both content and symbol searches.

    Thread-safe with configurable parallelism.

    Attributes:
        registry: Global project registry
        mapper: Path mapping utility
        logger: Python logger instance
    """

    def __init__(self,
                 registry: RegistryStore,
                 mapper: PathMapper,
                 max_workers: int = 8,
                 config: Config | None = None):
        """Initialize chain search engine.

        Args:
            registry: Global project registry for path lookups
            mapper: Path mapper for source/index conversions
            max_workers: Maximum parallel workers (default 8)
        """
        self.registry = registry
        self.mapper = mapper
        self.logger = logging.getLogger(__name__)
        self._max_workers = max_workers
        self._executor: Optional[ThreadPoolExecutor] = None
        self._config = config
        self._realtime_lsp_keepalive_lock = threading.RLock()
        self._realtime_lsp_keepalive = None
        self._realtime_lsp_keepalive_key = None
        # Track which (workspace_root, config_file) pairs have already been warmed up.
        # This avoids paying the warmup sleep on every query when using keep-alive LSP servers.
        self._realtime_lsp_warmed_ids: set[tuple[str, str | None]] = set()

    def _get_executor(self, max_workers: Optional[int] = None) -> ThreadPoolExecutor:
        """Get or create the shared thread pool executor.

        Lazy initialization to avoid creating executor if never used.

        Args:
            max_workers: Override default max_workers if specified

        Returns:
            ThreadPoolExecutor instance
        """
        workers = max_workers or self._max_workers
        if self._executor is None:
            self._executor = ThreadPoolExecutor(max_workers=workers)
        return self._executor

    def close(self) -> None:
        """Shutdown the thread pool executor."""
        if self._executor is not None:
            self._executor.shutdown(wait=True)
            self._executor = None
        with self._realtime_lsp_keepalive_lock:
            keepalive = self._realtime_lsp_keepalive
            self._realtime_lsp_keepalive = None
            self._realtime_lsp_keepalive_key = None
        if keepalive is not None:
            try:
                keepalive.stop()
            except Exception:
                pass

    def __enter__(self) -> "ChainSearchEngine":
        """Context manager entry."""
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        """Context manager exit."""
        self.close()

    def search(self, query: str,
               source_path: Path,
               options: Optional[SearchOptions] = None) -> ChainSearchResult:
        """Execute chain search from source_path with recursive traversal.

        Process:
        1. Locate starting index for source_path
        2. Collect all child indexes based on depth limit
        3. Search indexes in parallel using ThreadPoolExecutor
        4. Aggregate, deduplicate, and rank results

        Args:
            query: FTS5 search query string
            source_path: Starting directory path
            options: Search configuration (uses defaults if None)

        Returns:
            ChainSearchResult with results, symbols, and statistics

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper)
            >>> result = engine.search("authentication", Path("D:/project/src"))
            >>> for r in result.results[:5]:
            ...     print(f"{r.path}: {r.score:.2f}")
        """
        options = options or SearchOptions()
        start_time = time.time()
        stats = SearchStats()

        # Step 1: Find starting index
        start_index = self._find_start_index(source_path)
        if not start_index:
            self.logger.warning(f"No index found for {source_path}")
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # Step 2: Collect all index paths to search
        index_paths = self._collect_index_paths(start_index, options.depth)
        stats.dirs_searched = len(index_paths)

        if not index_paths:
            self.logger.warning(f"No indexes collected from {start_index}")
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # Step 3: Parallel search
        results, search_stats = self._search_parallel(
            index_paths, query, options
        )
        stats.errors = search_stats.errors

        # Step 3.5: Filter by extension if requested
        if options.code_only or options.exclude_extensions:
            results = self._filter_by_extension(
                results, options.code_only, options.exclude_extensions
            )

        # Step 4: Merge and rank
        final_results = self._merge_and_rank(results, options.total_limit, options.offset)

        # Step 5: Optional grouping of similar results
        if options.group_results:
            from codexlens.search.ranking import group_similar_results
            final_results = group_similar_results(
                final_results, score_threshold_abs=options.grouping_threshold
            )

        stats.files_matched = len(final_results)

        # Optional: Symbol search
        symbols = []
        if options.include_symbols:
            symbols = self._search_symbols_parallel(
                index_paths, query, None, options.total_limit
            )

        # Optional: graph expansion using precomputed neighbors
        related_results: List[SearchResult] = []
        if self._config is not None and getattr(self._config, "enable_graph_expansion", False):
            try:
                from codexlens.search.enrichment import SearchEnrichmentPipeline

                pipeline = SearchEnrichmentPipeline(self.mapper, config=self._config)
                related_results = pipeline.expand_related_results(final_results)
            except Exception as exc:
                self.logger.debug("Graph expansion failed: %s", exc)
                related_results = []

        stats.time_ms = (time.time() - start_time) * 1000

        return ChainSearchResult(
            query=query,
            results=final_results,
            symbols=symbols,
            stats=stats,
            related_results=related_results,
        )

    def binary_cascade_search(
        self,
        query: str,
        source_path: Path,
        k: int = 10,
        coarse_k: int = 100,
        options: Optional[SearchOptions] = None,
    ) -> ChainSearchResult:
        """Execute binary cascade search with binary coarse ranking and dense fine ranking.

        Binary cascade search process:
        1. Stage 1 (Coarse): Fast binary vector search using Hamming distance
           to quickly filter to coarse_k candidates (256-dim binary, 32 bytes/vector)
        2. Stage 2 (Fine): Dense vector cosine similarity for precise reranking
           of candidates (2048-dim float32)

        This approach leverages the speed of binary search (~100x faster) while
        maintaining precision through dense vector reranking.

        Performance characteristics:
        - Binary search: O(N) with SIMD-accelerated XOR + popcount
        - Dense rerank: Only applied to top coarse_k candidates
        - Memory: 32 bytes (binary) + 8KB (dense) per chunk

        Args:
            query: Natural language or keyword query string
            source_path: Starting directory path
            k: Number of final results to return (default 10)
            coarse_k: Number of coarse candidates from first stage (default 100)
            options: Search configuration (uses defaults if None)

        Returns:
            ChainSearchResult with reranked results and statistics

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper, config=config)
            >>> result = engine.binary_cascade_search(
            ...     "how to authenticate users",
            ...     Path("D:/project/src"),
            ...     k=10,
            ...     coarse_k=100
            ... )
            >>> for r in result.results:
            ...     print(f"{r.path}: {r.score:.3f}")
        """
        if not NUMPY_AVAILABLE:
            self.logger.warning(
                "NumPy not available, falling back to standard search"
            )
            return self.search(query, source_path, options=options)

        options = options or SearchOptions()
        start_time = time.time()
        stats = SearchStats()

        # Use config defaults if available
        if self._config is not None:
            if hasattr(self._config, "cascade_coarse_k"):
                coarse_k = coarse_k or self._config.cascade_coarse_k
            if hasattr(self._config, "cascade_fine_k"):
                k = k or self._config.cascade_fine_k

        # Step 1: Find starting index
        start_index = self._find_start_index(source_path)
        if not start_index:
            self.logger.warning(f"No index found for {source_path}")
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # Step 2: Collect all index paths
        index_paths = self._collect_index_paths(start_index, options.depth)
        stats.dirs_searched = len(index_paths)

        if not index_paths:
            self.logger.warning(f"No indexes collected from {start_index}")
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # Initialize embedding backends
        try:
            from codexlens.indexing.embedding import (
                BinaryEmbeddingBackend,
                DenseEmbeddingBackend,
            )
            from codexlens.semantic.ann_index import BinaryANNIndex
        except ImportError as exc:
            self.logger.warning(
                "Binary cascade dependencies not available: %s. "
                "Falling back to standard search.",
                exc
            )
            return self.search(query, source_path, options=options)

        # Stage 1: Binary vector coarse retrieval
        self.logger.debug(
            "Binary Cascade Stage 1: Binary coarse retrieval for %d candidates",
            coarse_k,
        )

        use_gpu = True
        if self._config is not None:
            use_gpu = getattr(self._config, "embedding_use_gpu", True)

        try:
            binary_backend = BinaryEmbeddingBackend(use_gpu=use_gpu)
            query_binary_packed = binary_backend.embed_packed([query])[0]
        except Exception as exc:
            self.logger.warning(
                "Failed to generate binary query embedding: %s. "
                "Falling back to standard search.",
                exc
            )
            return self.search(query, source_path, options=options)

        # Try centralized BinarySearcher first (preferred for mmap indexes)
        # The index root is the parent of the first index path
        index_root = index_paths[0].parent if index_paths else None
        all_candidates: List[Tuple[int, int, Path]] = []  # (chunk_id, distance, index_path)
        used_centralized = False

        if index_root:
            centralized_searcher = self._get_centralized_binary_searcher(index_root)
            if centralized_searcher is not None:
                try:
                    # BinarySearcher expects dense vector, not packed binary
                    from codexlens.semantic.embedder import Embedder
                    embedder = Embedder()
                    query_dense = embedder.embed_to_numpy([query])[0]

                    # Centralized search - returns (chunk_id, hamming_distance) tuples
                    results = centralized_searcher.search(query_dense, top_k=coarse_k)
                    for chunk_id, dist in results:
                        all_candidates.append((chunk_id, dist, index_root))
                    used_centralized = True
                    self.logger.debug(
                        "Centralized binary search found %d candidates", len(results)
                    )
                except Exception as exc:
                    self.logger.debug(
                        "Centralized binary search failed: %s, falling back to per-directory",
                        exc
                    )
                    centralized_searcher.clear()

        # Fallback: Search per-directory indexes with legacy BinaryANNIndex
        if not used_centralized:
            for index_path in index_paths:
                try:
                    # Get or create binary index for this path (uses deprecated BinaryANNIndex)
                    binary_index = self._get_or_create_binary_index(index_path)
                    if binary_index is None or binary_index.count() == 0:
                        continue

                    # Search binary index
                    ids, distances = binary_index.search(query_binary_packed, coarse_k)
                    for chunk_id, dist in zip(ids, distances):
                        all_candidates.append((chunk_id, dist, index_path))

                except Exception as exc:
                    self.logger.debug(
                        "Binary search failed for %s: %s", index_path, exc
                    )
                    stats.errors.append(f"Binary search failed for {index_path}: {exc}")

        if not all_candidates:
            self.logger.debug("No binary candidates found, falling back to standard search")
            return self.search(query, source_path, options=options)

        # Sort by Hamming distance and take top coarse_k
        all_candidates.sort(key=lambda x: x[1])
        coarse_candidates = all_candidates[:coarse_k]

        self.logger.debug(
            "Binary Cascade Stage 1 complete: %d candidates retrieved",
            len(coarse_candidates),
        )

        # Stage 2: Dense vector fine ranking
        self.logger.debug(
            "Binary Cascade Stage 2: Dense reranking %d candidates to top-%d",
            len(coarse_candidates),
            k,
        )

        try:
            dense_backend = DenseEmbeddingBackend(use_gpu=use_gpu)
            query_dense = dense_backend.embed_to_numpy([query])[0]
        except Exception as exc:
            self.logger.warning(
                "Failed to generate dense query embedding: %s. "
                "Using Hamming distance scores only.",
                exc
            )
            # Fall back to using Hamming distance as score
            return self._build_results_from_candidates(
                coarse_candidates[:k], index_paths, stats, query, start_time,
                use_centralized=used_centralized
            )

        # Group candidates by index path for batch retrieval
        candidates_by_index: Dict[Path, List[int]] = {}
        for chunk_id, _, index_path in coarse_candidates:
            if index_path not in candidates_by_index:
                candidates_by_index[index_path] = []
            candidates_by_index[index_path].append(chunk_id)

        # Retrieve dense embeddings and compute cosine similarity
        scored_results: List[Tuple[float, SearchResult]] = []
        import sqlite3

        for index_path, chunk_ids in candidates_by_index.items():
            try:
                # Collect valid rows and dense vectors for batch processing
                valid_rows: List[Dict[str, Any]] = []
                dense_vectors: List["np.ndarray"] = []

                if used_centralized:
                    # Centralized mode: index_path is actually index_root directory
                    # Dense embeddings are in per-directory _index.db files
                    # referenced by source_index_db in chunk_metadata
                    meta_db_path = index_path / VECTORS_META_DB_NAME
                    if not meta_db_path.exists():
                        self.logger.debug(
                            "VectorMetadataStore not found at %s, skipping dense reranking", meta_db_path
                        )
                        continue

                    # Get chunk metadata with source_index_db references
                    meta_store = VectorMetadataStore(meta_db_path)
                    chunks_meta = meta_store.get_chunks_by_ids(chunk_ids)

                    # Group chunks by source_index_db
                    chunks_by_source: Dict[str, List[Dict[str, Any]]] = {}
                    for chunk in chunks_meta:
                        source_db = chunk.get("source_index_db")
                        if source_db:
                            if source_db not in chunks_by_source:
                                chunks_by_source[source_db] = []
                            chunks_by_source[source_db].append(chunk)

                    # Retrieve dense embeddings from each source_index_db
                    for source_db, source_chunks in chunks_by_source.items():
                        try:
                            source_chunk_ids = [c["chunk_id"] for c in source_chunks]
                            conn = sqlite3.connect(source_db)
                            conn.row_factory = sqlite3.Row

                            placeholders = ",".join("?" * len(source_chunk_ids))
                            # Try semantic_chunks first (newer schema), fall back to chunks
                            try:
                                rows = conn.execute(
                                    f"SELECT id, embedding_dense FROM semantic_chunks WHERE id IN ({placeholders})",
                                    source_chunk_ids
                                ).fetchall()
                            except sqlite3.OperationalError:
                                rows = conn.execute(
                                    f"SELECT id, embedding_dense FROM chunks WHERE id IN ({placeholders})",
                                    source_chunk_ids
                                ).fetchall()
                            conn.close()

                            # Build dense vector lookup
                            dense_lookup = {row["id"]: row["embedding_dense"] for row in rows}

                            # Process chunks with their embeddings
                            for chunk in source_chunks:
                                chunk_id = chunk["chunk_id"]
                                dense_bytes = dense_lookup.get(chunk_id)
                                if dense_bytes is not None:
                                    valid_rows.append({
                                        "id": chunk_id,
                                        "file_path": chunk["file_path"],
                                        "content": chunk["content"],
                                    })
                                    dense_vectors.append(np.frombuffer(dense_bytes, dtype=np.float32))
                        except Exception as exc:
                            self.logger.debug(
                                "Failed to get dense embeddings from %s: %s", source_db, exc
                            )
                else:
                    # Per-directory mode: index_path is the _index.db file
                    conn = sqlite3.connect(str(index_path))
                    conn.row_factory = sqlite3.Row

                    placeholders = ",".join("?" * len(chunk_ids))
                    rows = conn.execute(
                        f"SELECT id, file_path, content, embedding_dense FROM semantic_chunks WHERE id IN ({placeholders})",
                        chunk_ids
                    ).fetchall()
                    conn.close()

                    for row in rows:
                        dense_bytes = row["embedding_dense"]
                        if dense_bytes is not None:
                            valid_rows.append(dict(row))
                            dense_vectors.append(np.frombuffer(dense_bytes, dtype=np.float32))

                # Skip if no dense embeddings found
                if not dense_vectors:
                    continue

                # Stack into matrix for batch computation
                doc_matrix = np.vstack(dense_vectors)

                # Batch compute cosine similarities
                scores = self._compute_cosine_similarity_batch(query_dense, doc_matrix)

                # Create search results
                for i, row in enumerate(valid_rows):
                    score = float(scores[i])
                    excerpt = (row.get("content") or "")[:500]
                    result = SearchResult(
                        path=row.get("file_path") or "",
                        score=score,
                        excerpt=excerpt,
                    )
                    scored_results.append((score, result))

            except Exception as exc:
                self.logger.debug(
                    "Dense reranking failed for %s: %s", index_path, exc
                )
                stats.errors.append(f"Dense reranking failed for {index_path}: {exc}")

        # Sort by score descending and deduplicate by path
        scored_results.sort(key=lambda x: x[0], reverse=True)

        path_to_result: Dict[str, SearchResult] = {}
        for score, result in scored_results:
            if result.path not in path_to_result:
                path_to_result[result.path] = result

        final_results = list(path_to_result.values())[:k]

        # Optional: grouping of similar results
        if options.group_results:
            from codexlens.search.ranking import group_similar_results
            final_results = group_similar_results(
                final_results, score_threshold_abs=options.grouping_threshold
            )

        stats.files_matched = len(final_results)
        stats.time_ms = (time.time() - start_time) * 1000

        self.logger.debug(
            "Binary cascade search complete: %d results in %.2fms",
            len(final_results),
            stats.time_ms,
        )

        return ChainSearchResult(
            query=query,
            results=final_results,
            symbols=[],
            stats=stats,
        )

    def cascade_search(
        self,
        query: str,
        source_path: Path,
        k: int = 10,
        coarse_k: int = 100,
        options: Optional[SearchOptions] = None,
        strategy: Optional[Literal["binary", "binary_rerank", "dense_rerank", "staged", "hybrid"]] = None,
    ) -> ChainSearchResult:
        """Unified cascade search entry point with strategy selection.

        Provides a single interface for cascade search with configurable strategy:
        - "binary": Uses binary vector coarse ranking + dense fine ranking (fastest)
        - "binary_rerank": Uses binary vector coarse ranking + cross-encoder reranking (best balance)
        - "hybrid": Alias for "binary_rerank" (backward compat)
        - "dense_rerank": Uses dense vector coarse ranking + cross-encoder reranking
        - "staged": 4-stage pipeline: binary -> LSP expand -> clustering -> optional rerank

        The strategy is determined with the following priority:
        1. The `strategy` parameter (e.g., from CLI --cascade-strategy option)
        2. Config `cascade_strategy` setting from settings.json
        3. Default: "binary"

        Args:
            query: Natural language or keyword query string
            source_path: Starting directory path
            k: Number of final results to return (default 10)
            coarse_k: Number of coarse candidates from first stage (default 100)
            options: Search configuration (uses defaults if None)
            strategy: Cascade strategy - "binary", "binary_rerank", "dense_rerank", or "staged".

        Returns:
            ChainSearchResult with reranked results and statistics

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper, config=config)
            >>> # Use binary cascade (default, fastest)
            >>> result = engine.cascade_search("auth", Path("D:/project"))
            >>> # Use binary + cross-encoder (best balance of speed and quality)
            >>> result = engine.cascade_search("auth", Path("D:/project"), strategy="binary_rerank")
            >>> # Use 4-stage pipeline (binary + LSP expand + clustering + optional rerank)
            >>> result = engine.cascade_search("auth", Path("D:/project"), strategy="staged")
        """
        # Strategy priority: parameter > config > default
        effective_strategy = strategy
        valid_strategies = ("binary", "binary_rerank", "dense_rerank", "staged", "hybrid")
        if effective_strategy is None:
            # Not passed via parameter, check config
            if self._config is not None:
                config_strategy = getattr(self._config, "cascade_strategy", None)
                if config_strategy in valid_strategies:
                    effective_strategy = config_strategy

        # If still not set, apply default
        if effective_strategy not in valid_strategies:
            effective_strategy = "binary"

        # Normalize backward-compat alias
        if effective_strategy == "hybrid":
            effective_strategy = "binary_rerank"

        if effective_strategy == "binary":
            return self.binary_cascade_search(query, source_path, k, coarse_k, options)
        elif effective_strategy == "binary_rerank":
            return self.binary_rerank_cascade_search(query, source_path, k, coarse_k, options)
        elif effective_strategy == "dense_rerank":
            return self.dense_rerank_cascade_search(query, source_path, k, coarse_k, options)
        elif effective_strategy == "staged":
            return self.staged_cascade_search(query, source_path, k, coarse_k, options)
        else:
            return self.binary_cascade_search(query, source_path, k, coarse_k, options)

    def staged_cascade_search(
        self,
        query: str,
        source_path: Path,
        k: int = 10,
        coarse_k: int = 100,
        options: Optional[SearchOptions] = None,
    ) -> ChainSearchResult:
        """Execute 4-stage cascade search pipeline with binary, LSP expansion, clustering, and optional reranking.

        Staged cascade search process:
        1. Stage 1 (Binary Coarse): Fast binary vector search using Hamming distance
           to quickly filter to coarse_k candidates (256-bit binary vectors)
        2. Stage 2 (LSP Expansion): Expand coarse candidates using GraphExpander to
           include related symbols (definitions, references, callers/callees)
        3. Stage 3 (Clustering): Use configurable clustering strategy to group similar
           results and select representative results from each cluster
        4. Stage 4 (Optional Rerank): If config.enable_staged_rerank is True, apply
           cross-encoder reranking for final precision

        This approach combines the speed of binary search with graph-based context
        expansion and diversity-preserving clustering for high-quality results.

        Performance characteristics:
        - Stage 1: O(N) binary search with SIMD acceleration (~8ms)
        - Stage 2: O(k * d) graph traversal where d is expansion depth
        - Stage 3: O(n^2) clustering on expanded candidates
        - Stage 4: Optional cross-encoder reranking (API call)

        Args:
            query: Natural language or keyword query string
            source_path: Starting directory path
            k: Number of final results to return (default 10)
            coarse_k: Number of coarse candidates from first stage (default 100)
            options: Search configuration (uses defaults if None)

        Returns:
            ChainSearchResult with per-stage statistics

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper, config=config)
            >>> result = engine.staged_cascade_search(
            ...     "authentication handler",
            ...     Path("D:/project/src"),
            ...     k=10,
            ...     coarse_k=100
            ... )
            >>> for r in result.results:
            ...     print(f"{r.path}: {r.score:.3f}")
        """
        if not NUMPY_AVAILABLE:
            self.logger.warning(
                "NumPy not available, falling back to standard search"
            )
            return self.search(query, source_path, options=options)

        options = options or SearchOptions()
        start_time = time.time()
        stats = SearchStats()

        # Per-stage timing stats
        stage_times: Dict[str, float] = {}
        stage_counts: Dict[str, int] = {}

        # Use config defaults if available
        if self._config is not None:
            if hasattr(self._config, "cascade_coarse_k"):
                coarse_k = coarse_k or self._config.cascade_coarse_k
            if hasattr(self._config, "cascade_fine_k"):
                k = k or self._config.cascade_fine_k

        # Step 1: Find starting index
        start_index = self._find_start_index(source_path)
        if not start_index:
            self.logger.warning(f"No index found for {source_path}")
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # Step 2: Collect all index paths
        index_paths = self._collect_index_paths(start_index, options.depth)
        stats.dirs_searched = len(index_paths)

        if not index_paths:
            self.logger.warning(f"No indexes collected from {start_index}")
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # ========== Stage 1: Binary Coarse Search ==========
        stage1_start = time.time()
        coarse_results, index_root = self._stage1_binary_search(
            query,
            index_paths,
            coarse_k,
            stats,
            index_root=start_index.parent,
        )
        stage_times["stage1_binary_ms"] = (time.time() - stage1_start) * 1000
        stage_counts["stage1_candidates"] = len(coarse_results)

        self.logger.debug(
            "Staged Stage 1: Binary search found %d candidates in %.2fms",
            len(coarse_results), stage_times["stage1_binary_ms"]
        )

        if not coarse_results:
            # Keep the staged pipeline running even when Stage 1 yields no candidates.
            # This makes "realtime LSP graph → clustering → rerank" comparable across queries.
            self.logger.debug(
                "No Stage 1 candidates found; seeding staged pipeline with FTS results"
            )
            stage1_fallback_start = time.time()
            try:
                seed_opts = SearchOptions(
                    depth=options.depth,
                    max_workers=options.max_workers,
                    limit_per_dir=max(10, int(coarse_k)),
                    total_limit=int(coarse_k),
                    include_symbols=True,
                    enable_vector=False,
                    hybrid_mode=False,
                    enable_cascade=False,
                )
                seed = self.search(query, source_path, options=seed_opts)
                coarse_results = list(seed.results or [])[: int(coarse_k)]
                stage_counts["stage1_fallback_used"] = 1
            except Exception as exc:
                self.logger.debug("Stage 1 fallback seeding failed: %r", exc)
                coarse_results = []

            stage_times["stage1_fallback_search_ms"] = (time.time() - stage1_fallback_start) * 1000
            stage_counts["stage1_candidates"] = len(coarse_results)

        if not coarse_results:
            return ChainSearchResult(query=query, results=[], symbols=[], stats=stats)

        # ========== Stage 2: LSP Graph Expansion ==========
        stage2_start = time.time()
        expanded_results = self._stage2_lsp_expand(coarse_results, index_root, query=query)
        stage_times["stage2_expand_ms"] = (time.time() - stage2_start) * 1000
        stage_counts["stage2_expanded"] = len(expanded_results)
        try:
            stage2_unique_paths = len({(r.path or "").lower() for r in expanded_results if getattr(r, "path", None)})
        except Exception:
            stage2_unique_paths = 0
        stage_counts["stage2_unique_paths"] = stage2_unique_paths
        stage_counts["stage2_duplicate_paths"] = max(0, len(expanded_results) - stage2_unique_paths)

        self.logger.debug(
            "Staged Stage 2: LSP expansion %d -> %d results in %.2fms",
            len(coarse_results), len(expanded_results), stage_times["stage2_expand_ms"]
        )

        # ========== Stage 3: Clustering and Representative Selection ==========
        stage3_start = time.time()
        clustered_results = self._stage3_cluster_prune(expanded_results, k * 2)
        stage_times["stage3_cluster_ms"] = (time.time() - stage3_start) * 1000
        stage_counts["stage3_clustered"] = len(clustered_results)
        if self._config is not None:
            try:
                stage_counts["stage3_strategy"] = str(getattr(self._config, "staged_clustering_strategy", "auto") or "auto")
            except Exception:
                pass

        self.logger.debug(
            "Staged Stage 3: Clustering %d -> %d representatives in %.2fms",
            len(expanded_results), len(clustered_results), stage_times["stage3_cluster_ms"]
        )

        # ========== Stage 4: Optional Cross-Encoder Reranking ==========
        enable_rerank = False
        if self._config is not None:
            enable_rerank = getattr(self._config, "enable_staged_rerank", False)

        if enable_rerank:
            stage4_start = time.time()
            final_results = self._stage4_optional_rerank(query, clustered_results, k)
            stage_times["stage4_rerank_ms"] = (time.time() - stage4_start) * 1000
            stage_counts["stage4_reranked"] = len(final_results)

            self.logger.debug(
                "Staged Stage 4: Reranking %d -> %d results in %.2fms",
                len(clustered_results), len(final_results), stage_times["stage4_rerank_ms"]
            )
        else:
            # Skip reranking, just take top-k by score
            final_results = sorted(
                clustered_results, key=lambda r: r.score, reverse=True
            )[:k]
            stage_counts["stage4_reranked"] = len(final_results)

        # Deduplicate by path (keep highest score)
        path_to_result: Dict[str, SearchResult] = {}
        for result in final_results:
            if result.path not in path_to_result or result.score > path_to_result[result.path].score:
                path_to_result[result.path] = result

        final_results = list(path_to_result.values())[:k]

        # Optional: grouping of similar results
        if options.group_results:
            from codexlens.search.ranking import group_similar_results
            final_results = group_similar_results(
                final_results, score_threshold_abs=options.grouping_threshold
            )

        stats.files_matched = len(final_results)
        stats.time_ms = (time.time() - start_time) * 1000

        # Add per-stage stats to errors field (as JSON for now, will be proper field later)
        stage_stats_json = json.dumps({
            "stage_times": stage_times,
            "stage_counts": stage_counts,
        })
        stats.errors.append(f"STAGE_STATS:{stage_stats_json}")

        self.logger.debug(
            "Staged cascade search complete: %d results in %.2fms "
            "(stage1=%.1fms, stage2=%.1fms, stage3=%.1fms)",
            len(final_results),
            stats.time_ms,
            stage_times.get("stage1_binary_ms", 0),
            stage_times.get("stage2_expand_ms", 0),
            stage_times.get("stage3_cluster_ms", 0),
        )

        return ChainSearchResult(
            query=query,
            results=final_results,
            symbols=[],
            stats=stats,
        )

    def _stage1_binary_search(
        self,
        query: str,
        index_paths: List[Path],
        coarse_k: int,
        stats: SearchStats,
        *,
        index_root: Optional[Path] = None,
    ) -> Tuple[List[SearchResult], Optional[Path]]:
        """Stage 1: Binary vector coarse search using Hamming distance.

        Reuses the binary coarse search logic from binary_cascade_search.

        Args:
            query: Search query string
            index_paths: List of index database paths to search
            coarse_k: Number of coarse candidates to retrieve
            stats: SearchStats to update with errors

        Returns:
            Tuple of (list of SearchResult objects, index_root path or None)
        """
        # Initialize binary embedding backend
        try:
            from codexlens.indexing.embedding import BinaryEmbeddingBackend
        except ImportError as exc:
            self.logger.warning(
                "BinaryEmbeddingBackend not available: %s", exc
            )
            return [], None

        # Try centralized BinarySearcher first (preferred for mmap indexes).
        # Centralized binary vectors live at a project index root (where `index binary-mmap`
        # was run), which may be an ancestor of the nearest `_index.db` directory.
        index_root = Path(index_root).resolve() if index_root is not None else (index_paths[0].parent if index_paths else None)
        if index_root is not None:
            index_root = self._find_nearest_binary_mmap_root(index_root)
        coarse_candidates: List[Tuple[int, float, Path]] = []  # (chunk_id, distance, index_path)
        used_centralized = False
        using_dense_fallback = False

        if index_root:
            binary_searcher = self._get_centralized_binary_searcher(index_root)
            if binary_searcher is not None:
                try:
                    use_gpu = True
                    if self._config is not None:
                        use_gpu = getattr(self._config, "embedding_use_gpu", True)

                    query_dense = None
                    backend = getattr(binary_searcher, "backend", None)
                    model = getattr(binary_searcher, "model", None)
                    profile = getattr(binary_searcher, "model_profile", None) or "code"

                    if backend == "litellm":
                        try:
                            from codexlens.semantic.factory import get_embedder as get_factory_embedder
                            embedder = get_factory_embedder(backend="litellm", model=model or "code")
                            query_dense = embedder.embed_to_numpy([query])[0]
                        except Exception:
                            query_dense = None
                    if query_dense is None:
                        from codexlens.semantic.embedder import get_embedder
                        embedder = get_embedder(profile=str(profile), use_gpu=use_gpu)
                        query_dense = embedder.embed_to_numpy([query])[0]

                    results = binary_searcher.search(query_dense, top_k=coarse_k)
                    for chunk_id, distance in results:
                        coarse_candidates.append((chunk_id, distance, index_root))
                    if coarse_candidates:
                        used_centralized = True
                        self.logger.debug(
                            "Stage 1 centralized binary search: %d candidates", len(results)
                        )
                except Exception as exc:
                    self.logger.debug(f"Centralized binary search failed: {exc}")

        if not used_centralized:
            # Fallback to per-directory binary indexes (legacy BinaryANNIndex).
            #
            # Generating the query binary embedding can be expensive (depending on embedding backend).
            # If no legacy binary vector files exist, skip this path and fall back to dense ANN search.
            has_legacy_binary_vectors = any(
                (p.parent / f"{p.stem}_binary_vectors.bin").exists() for p in index_paths
            )
            if not has_legacy_binary_vectors:
                self.logger.debug(
                    "No legacy binary vector files found; skipping legacy binary search fallback"
                )
            else:
                use_gpu = True
                if self._config is not None:
                    use_gpu = getattr(self._config, "embedding_use_gpu", True)

                query_binary = None
                try:
                    binary_backend = BinaryEmbeddingBackend(use_gpu=use_gpu)
                    query_binary = binary_backend.embed_packed([query])[0]
                except Exception as exc:
                    self.logger.warning(f"Failed to generate binary query embedding: {exc}")
                    query_binary = None

                if query_binary is not None:
                    for index_path in index_paths:
                        try:
                            binary_index = self._get_or_create_binary_index(index_path)
                            if binary_index is None or binary_index.count() == 0:
                                continue
                            ids, distances = binary_index.search(query_binary, coarse_k)
                            for chunk_id, dist in zip(ids, distances):
                                coarse_candidates.append((chunk_id, float(dist), index_path))
                        except Exception as exc:
                            self.logger.debug(
                                "Binary search failed for %s: %s", index_path, exc
                            )

        if not coarse_candidates:
            # Final fallback: dense ANN coarse search (HNSW) over existing dense vector indexes.
            #
            # This allows the staged pipeline (LSP expansion + clustering) to run even when
            # binary vectors are not generated for the current project.
            dense_candidates: List[Tuple[int, float, Path]] = []
            try:
                from codexlens.semantic.ann_index import ANNIndex
                from codexlens.semantic.embedder import Embedder

                embedder = Embedder()
                query_dense = embedder.embed_to_numpy([query])[0]
                dim = int(getattr(query_dense, "shape", (len(query_dense),))[0])

                for index_path in index_paths:
                    try:
                        ann_index = ANNIndex(index_path, dim=dim)
                        if not ann_index.load() or ann_index.count() == 0:
                            continue
                        ids, distances = ann_index.search(query_dense, top_k=coarse_k)
                        for chunk_id, dist in zip(ids, distances):
                            dense_candidates.append((chunk_id, float(dist), index_path))
                    except Exception as exc:
                        self.logger.debug(
                            "Dense coarse search failed for %s: %s", index_path, exc
                        )
            except Exception as exc:
                self.logger.debug("Dense coarse search fallback unavailable: %s", exc)
                dense_candidates = []

            if dense_candidates:
                dense_candidates.sort(key=lambda x: x[1])
                coarse_candidates = dense_candidates[:coarse_k]
                using_dense_fallback = True

        if not coarse_candidates:
            return [], index_root

        # Sort by Hamming distance and take top coarse_k
        coarse_candidates.sort(key=lambda x: x[1])
        coarse_candidates = coarse_candidates[:coarse_k]

        # Build SearchResult objects from candidates
        coarse_results: List[SearchResult] = []

        # Group candidates by index path for efficient retrieval
        candidates_by_index: Dict[Path, List[int]] = {}
        for chunk_id, _, idx_path in coarse_candidates:
            if idx_path not in candidates_by_index:
                candidates_by_index[idx_path] = []
            candidates_by_index[idx_path].append(chunk_id)

        # Retrieve chunk content
        import sqlite3
        central_meta_path = index_root / VECTORS_META_DB_NAME if index_root else None
        central_meta_store = None
        if central_meta_path and central_meta_path.exists():
            central_meta_store = VectorMetadataStore(central_meta_path)

        for idx_path, chunk_ids in candidates_by_index.items():
            try:
                chunks_data = []
                if central_meta_store:
                    chunks_data = central_meta_store.get_chunks_by_ids(chunk_ids)

                if not chunks_data and used_centralized:
                    meta_db_path = idx_path / VECTORS_META_DB_NAME
                    if meta_db_path.exists():
                        meta_store = VectorMetadataStore(meta_db_path)
                        chunks_data = meta_store.get_chunks_by_ids(chunk_ids)

                if not chunks_data:
                    try:
                        conn = sqlite3.connect(str(idx_path))
                        conn.row_factory = sqlite3.Row
                        placeholders = ",".join("?" * len(chunk_ids))
                        cursor = conn.execute(
                            f"""
                            SELECT id, file_path, content, metadata, category
                            FROM semantic_chunks
                            WHERE id IN ({placeholders})
                            """,
                            chunk_ids
                        )
                        chunks_data = [
                            {
                                "id": row["id"],
                                "file_path": row["file_path"],
                                "content": row["content"],
                                "metadata": row["metadata"],
                                "category": row["category"],
                            }
                            for row in cursor.fetchall()
                        ]
                        conn.close()
                    except Exception:
                        pass

                for chunk in chunks_data:
                    chunk_id = chunk.get("id") or chunk.get("chunk_id")
                    distance = next(
                        (d for cid, d, _ in coarse_candidates if cid == chunk_id),
                        256
                    )
                    if using_dense_fallback:
                        # Cosine distance in [0, 2] -> clamp to [0, 1] score
                        score = max(0.0, 1.0 - float(distance))
                    else:
                        score = 1.0 - (int(distance) / 256.0)

                    content = chunk.get("content", "")

                    # Extract symbol info from metadata if available
                    metadata = chunk.get("metadata")
                    symbol_name = None
                    symbol_kind = None
                    start_line = chunk.get("start_line")
                    end_line = chunk.get("end_line")
                    if metadata:
                        try:
                            meta_dict = json.loads(metadata) if isinstance(metadata, str) else metadata
                            symbol_name = meta_dict.get("symbol_name")
                            symbol_kind = meta_dict.get("symbol_kind")
                            start_line = meta_dict.get("start_line", start_line)
                            end_line = meta_dict.get("end_line", end_line)
                        except Exception:
                            pass

                    result = SearchResult(
                        path=chunk.get("file_path", ""),
                        score=float(score),
                        excerpt=content[:500] if content else "",
                        content=content,
                        symbol_name=symbol_name,
                        symbol_kind=symbol_kind,
                        start_line=start_line,
                        end_line=end_line,
                    )
                    coarse_results.append(result)
            except Exception as exc:
                self.logger.debug(
                    "Failed to retrieve chunks from %s: %s", idx_path, exc
                )
                stats.errors.append(f"Stage 1 chunk retrieval failed for {idx_path}: {exc}")

        return coarse_results, index_root

    def _stage2_lsp_expand(
        self,
        coarse_results: List[SearchResult],
        index_root: Optional[Path],
        query: Optional[str] = None,
    ) -> List[SearchResult]:
        """Stage 2: LSP/graph expansion for staged cascade.

        Supports two modes via Config.staged_stage2_mode:
        - "precomputed" (default): GraphExpander over per-dir `graph_neighbors` table
        - "realtime": on-demand graph expansion via live LSP servers (LspBridge + LspGraphBuilder)

        Args:
            coarse_results: Results from Stage 1 binary search
            index_root: Root path of the index (for graph database access)

        Returns:
            Combined list of original results plus expanded related results
        """
        if not coarse_results or index_root is None:
            return coarse_results

        try:
            mode = "precomputed"
            if self._config is not None:
                mode = (getattr(self._config, "staged_stage2_mode", "precomputed") or "precomputed").strip().lower()

            if mode in {"realtime", "live"}:
                return self._stage2_realtime_lsp_expand(
                    coarse_results,
                    index_root=index_root,
                    query=query,
                )

            if mode == "static_global_graph":
                return self._stage2_static_global_graph_expand(coarse_results, index_root=index_root)

            return self._stage2_precomputed_graph_expand(coarse_results, index_root=index_root)

        except ImportError as exc:
            self.logger.debug("GraphExpander not available: %s", exc)
            return coarse_results
        except Exception as exc:
            self.logger.debug("Stage 2 LSP expansion failed: %s", exc)
            return coarse_results

    def _stage2_precomputed_graph_expand(
        self,
        coarse_results: List[SearchResult],
        *,
        index_root: Path,
    ) -> List[SearchResult]:
        """Stage 2 (precomputed): expand using GraphExpander over `graph_neighbors`."""
        from codexlens.search.graph_expander import GraphExpander

        depth = 2
        if self._config is not None:
            depth = getattr(
                self._config,
                "staged_lsp_depth",
                getattr(self._config, "graph_expansion_depth", 2),
            )
        try:
            depth = int(depth)
        except Exception:
            depth = 2

        expander = GraphExpander(self.mapper, config=self._config)

        max_expand = min(10, len(coarse_results))
        max_related = 50

        related_results = expander.expand(
            coarse_results,
            depth=depth,
            max_expand=max_expand,
            max_related=max_related,
        )

        if related_results:
            self.logger.debug(
                "Stage 2 (precomputed) expanded %d base results to %d related symbols",
                len(coarse_results), len(related_results)
            )

        return self._combine_stage2_results(coarse_results, related_results)

    def _stage2_static_global_graph_expand(
        self,
        coarse_results: List[SearchResult],
        *,
        index_root: Path,
    ) -> List[SearchResult]:
        """Stage 2 (static_global_graph): expand using GlobalGraphExpander over global_relationships."""
        from codexlens.search.global_graph_expander import GlobalGraphExpander

        global_db_path = index_root / GlobalSymbolIndex.DEFAULT_DB_NAME
        if not global_db_path.exists():
            self.logger.debug("Global symbol DB not found at %s, skipping static graph expansion", global_db_path)
            return coarse_results

        project_id = 1
        try:
            for p in self.registry.list_projects():
                if p.index_root.resolve() == index_root.resolve():
                    project_id = p.id
                    break
        except Exception:
            pass

        global_index = GlobalSymbolIndex(global_db_path, project_id=project_id)
        global_index.initialize()

        try:
            expander = GlobalGraphExpander(global_index, config=self._config)
            related_results = expander.expand(
                coarse_results,
                top_n=min(10, len(coarse_results)),
                max_related=50,
            )

            if related_results:
                self.logger.debug(
                    "Stage 2 (static_global_graph) expanded %d base results to %d related symbols",
                    len(coarse_results), len(related_results),
                )

            return self._combine_stage2_results(coarse_results, related_results)
        finally:
            global_index.close()

    def _stage2_realtime_lsp_expand(
        self,
        coarse_results: List[SearchResult],
        *,
        index_root: Path,
        query: Optional[str] = None,
    ) -> List[SearchResult]:
        """Stage 2 (realtime): compute expansion graph via live LSP servers."""
        import asyncio
        from concurrent.futures import ThreadPoolExecutor

        from codexlens.hybrid_search.data_structures import CodeSymbolNode, Range
        from codexlens.lsp import LspBridge, LspGraphBuilder

        max_depth = 1
        timeout_s = 30.0
        max_nodes = 50
        max_seeds = 1
        max_concurrent = 2
        warmup_s = 3.0
        resolve_symbols = False
        if self._config is not None:
            max_depth = int(
                getattr(
                    self._config,
                    "staged_realtime_lsp_depth",
                    getattr(self._config, "staged_lsp_depth", 1),
                )
                or 1
            )
            timeout_s = float(getattr(self._config, "staged_realtime_lsp_timeout_s", 30.0) or 30.0)
            max_nodes = int(getattr(self._config, "staged_realtime_lsp_max_nodes", 50) or 50)
            warmup_s = float(getattr(self._config, "staged_realtime_lsp_warmup_s", 3.0) or 0.0)
            max_seeds = int(getattr(self._config, "staged_realtime_lsp_max_seeds", 1) or 1)
            max_concurrent = int(getattr(self._config, "staged_realtime_lsp_max_concurrent", 2) or 2)
            resolve_symbols = bool(getattr(self._config, "staged_realtime_lsp_resolve_symbols", False))

        try:
            source_root = self.mapper.index_to_source(index_root)
        except Exception:
            source_root = Path(coarse_results[0].path).resolve().parent

        lsp_config_file = self._find_lsp_config_file(source_root)
        workspace_root = Path(source_root).resolve()

        max_expand = min(max(1, max_seeds), len(coarse_results))
        seed_nodes: List[CodeSymbolNode] = []
        seed_ids: set[str] = set()

        selected_results = list(coarse_results)
        if query:
            import re

            terms = {
                t.lower()
                for t in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", query)
                if t
            }

            def _priority(result: SearchResult) -> float:
                sym = (result.symbol_name or "").strip().lower()
                stem = Path(result.path).stem.lower() if result.path else ""
                score = 0.0
                if sym and sym in terms:
                    score += 5.0
                if sym:
                    score += 2.0
                if stem and stem in terms:
                    score += 1.0
                if result.symbol_kind:
                    score += 0.5
                if result.start_line:
                    score += 0.2
                return score

            indexed = list(enumerate(selected_results))
            indexed.sort(
                key=lambda pair: (
                    _priority(pair[1]),
                    float(pair[1].score),
                    -pair[0],
                ),
                reverse=True,
            )
            selected_results = [r for _, r in indexed]
        else:
            indexed = list(enumerate(selected_results))
            indexed.sort(
                key=lambda pair: (
                    1.0 if pair[1].symbol_name else 0.0,
                    float(pair[1].score),
                    -pair[0],
                ),
                reverse=True,
            )
            selected_results = [r for _, r in indexed]

        # Prefer symbol-definition seeds when possible (improves LSP reference/call-hierarchy results).
        #
        # NOTE: We avoid relying purely on the stored symbol index here because its ranges may be
        # imprecise in some projects. Instead, we attempt a lightweight definition-line detection
        # for query identifiers within the top coarse candidate files.
        if query:
            try:
                import re

                terms_raw = [
                    t for t in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", query) if t
                ]
                stopwords = {
                    "class", "def", "function", "method", "import", "from", "return",
                    "async", "await", "public", "private", "protected", "static",
                    "const", "let", "var", "new",
                }
                candidate_terms = [
                    t for t in terms_raw
                    if t.lower() not in stopwords and len(t) >= 3
                ]

                candidate_terms.sort(key=len, reverse=True)

                # Candidate files (best-first): de-dupe while preserving ordering.
                candidate_files: List[str] = []
                seen_files: set[str] = set()
                for r in selected_results:
                    if r.path and r.path not in seen_files:
                        seen_files.add(r.path)
                        candidate_files.append(r.path)
                    if len(candidate_files) >= 50:
                        break

                # Also consider files whose *names* match query identifiers (helps when coarse retrieval
                # misses the defining file for a symbol like `Config`).
                try:
                    if source_root and candidate_terms:
                        allow_suffix = {".py", ".ts", ".tsx", ".js", ".jsx"}
                        name_terms = [t.lower() for t in candidate_terms[:3]]
                        for dirpath, _, filenames in os.walk(source_root):
                            for filename in filenames:
                                suffix = Path(filename).suffix.lower()
                                if suffix not in allow_suffix:
                                    continue
                                lowered = filename.lower()
                                if any(t in lowered for t in name_terms):
                                    fp = str(Path(dirpath) / filename)
                                    if fp not in seen_files:
                                        seen_files.add(fp)
                                        candidate_files.append(fp)
                            if len(candidate_files) >= 120:
                                break
                except Exception:
                    pass

                for term in candidate_terms[:5]:
                    if len(seed_nodes) >= max_expand:
                        break

                    escaped = re.escape(term)
                    py_class = re.compile(rf"^\s*class\s+{escaped}\b")
                    py_def = re.compile(rf"^\s*(?:async\s+)?def\s+{escaped}\b")
                    ts_class = re.compile(rf"^\s*(?:export\s+)?class\s+{escaped}\b")
                    ts_func = re.compile(rf"^\s*(?:export\s+)?(?:async\s+)?function\s+{escaped}\b")

                    for file_path in candidate_files:
                        if len(seed_nodes) >= max_expand:
                            break
                        suffix = Path(file_path).suffix.lower()
                        if suffix not in {".py", ".ts", ".tsx", ".js", ".jsx"}:
                            continue

                        try:
                            lines = Path(file_path).read_text(encoding="utf-8", errors="ignore").splitlines()
                        except Exception:
                            continue

                        for i, line in enumerate(lines):
                            kind = None
                            if suffix == ".py":
                                if py_class.search(line):
                                    kind = "class"
                                elif py_def.search(line):
                                    kind = "function"
                            else:
                                if ts_class.search(line):
                                    kind = "class"
                                elif ts_func.search(line):
                                    kind = "function"

                            if not kind:
                                continue

                            start_line = i + 1
                            idx = line.find(term)
                            if idx >= 0:
                                start_character = idx + 1
                            else:
                                stripped = line.lstrip()
                                start_character = (len(line) - len(stripped)) + 1 if stripped else 1

                            node_id = f"{file_path}:{term}:{start_line}"
                            if node_id in seed_ids:
                                break

                            seed_ids.add(node_id)
                            seed_nodes.append(
                                CodeSymbolNode(
                                    id=node_id,
                                    name=term,
                                    kind=kind,
                                    file_path=file_path,
                                    range=Range(
                                        start_line=start_line,
                                        start_character=start_character,
                                        end_line=start_line,
                                        end_character=start_character,
                                    ),
                                )
                            )
                            break
            except Exception:
                pass

        for seed in selected_results:
            if len(seed_nodes) >= max_expand:
                break
            if not seed.path:
                continue
            name = seed.symbol_name or Path(seed.path).stem
            kind = seed.symbol_kind or "unknown"
            start_line = int(seed.start_line or 1)
            end_line = int(seed.end_line or start_line)
            start_character = 1
            try:
                if start_line >= 1:
                    line_text = Path(seed.path).read_text(encoding="utf-8", errors="ignore").splitlines()[start_line - 1]
                    if seed.symbol_name:
                        idx = line_text.find(seed.symbol_name)
                        if idx >= 0:
                            start_character = idx + 1  # 1-based for StandaloneLspManager
                    else:
                        stripped = line_text.lstrip()
                        if stripped:
                            start_character = (len(line_text) - len(stripped)) + 1
            except Exception:
                start_character = 1
            node_id = f"{seed.path}:{name}:{start_line}"
            if node_id in seed_ids:
                continue
            seed_ids.add(node_id)
            seed_nodes.append(
                CodeSymbolNode(
                    id=node_id,
                    name=name,
                    kind=kind,
                    file_path=seed.path,
                    range=Range(
                        start_line=start_line,
                        start_character=start_character,
                        end_line=end_line,
                        end_character=start_character if end_line == start_line else 1,
                    ),
                    raw_code=seed.content or "",
                    docstring=seed.excerpt or "",
                )
            )

        if not seed_nodes:
            return coarse_results

        effective_warmup_s = warmup_s

        async def expand_graph(bridge: LspBridge):
            # Warm up analysis: open seed docs and wait a bit so references/call hierarchy are populated.
            if effective_warmup_s > 0:
                for seed in seed_nodes[:3]:
                    try:
                        await bridge.get_document_symbols(seed.file_path)
                    except Exception:
                        continue
                try:
                    warmup_budget = min(effective_warmup_s, max(0.0, timeout_s * 0.1))
                    await asyncio.sleep(min(warmup_budget, max(0.0, timeout_s - 0.5)))
                except Exception:
                    pass
            builder = LspGraphBuilder(
                max_depth=max_depth,
                max_nodes=max_nodes,
                max_concurrent=max(1, max_concurrent),
                resolve_symbols=resolve_symbols,
            )
            return await builder.build_from_seeds(seed_nodes, bridge)

        try:
            try:
                asyncio.get_running_loop()
                has_running_loop = True
            except RuntimeError:
                has_running_loop = False

            if has_running_loop:
                with ThreadPoolExecutor(max_workers=1) as executor:
                    async def _expand_once():
                        async with LspBridge(
                            workspace_root=str(workspace_root),
                            config_file=str(lsp_config_file) if lsp_config_file else None,
                            timeout=timeout_s,
                        ) as bridge:
                            return await expand_graph(bridge)

                    def _run():
                        return asyncio.run(asyncio.wait_for(_expand_once(), timeout=timeout_s))

                    graph = executor.submit(_run).result(timeout=timeout_s + 1.0)
            else:
                from codexlens.lsp.keepalive_bridge import KeepAliveKey, KeepAliveLspBridge

                key = KeepAliveKey(
                    workspace_root=str(workspace_root),
                    config_file=str(lsp_config_file) if lsp_config_file else None,
                    timeout=float(timeout_s),
                )
                warm_id = (key.workspace_root, key.config_file)
                with self._realtime_lsp_keepalive_lock:
                    if warm_id in self._realtime_lsp_warmed_ids:
                        effective_warmup_s = 0.0
                    keepalive = self._realtime_lsp_keepalive
                    if keepalive is None or self._realtime_lsp_keepalive_key != key:
                        if keepalive is not None:
                            try:
                                keepalive.stop()
                            except Exception:
                                pass
                        keepalive = KeepAliveLspBridge(
                            workspace_root=key.workspace_root,
                            config_file=key.config_file,
                            timeout=key.timeout,
                        )
                        self._realtime_lsp_keepalive = keepalive
                        self._realtime_lsp_keepalive_key = key

                graph = keepalive.run(expand_graph, timeout=timeout_s)
                with self._realtime_lsp_keepalive_lock:
                    self._realtime_lsp_warmed_ids.add(warm_id)
        except Exception as exc:
            self.logger.debug("Stage 2 (realtime) expansion failed: %r", exc)
            return coarse_results

        try:
            node_count = len(getattr(graph, "nodes", {}) or {})
            edge_count = len(getattr(graph, "edges", []) or [])
        except Exception:
            node_count, edge_count = 0, 0
        self.logger.debug(
            "Stage 2 (realtime) graph built: seeds=%d nodes=%d edges=%d",
            len(seed_nodes),
            node_count,
            edge_count,
        )

        related_results: List[SearchResult] = []
        for node_id, node in getattr(graph, "nodes", {}).items():
            if node_id in seed_ids or getattr(node, "id", "") in seed_ids:
                continue

            try:
                start_line = int(getattr(node.range, "start_line", 1) or 1)
                end_line = int(getattr(node.range, "end_line", start_line) or start_line)
            except Exception:
                start_line, end_line = 1, 1

            related_results.append(
                SearchResult(
                    path=node.file_path,
                    score=0.5,
                    excerpt=None,
                    content=getattr(node, "raw_code", "") or None,
                    symbol_name=node.name,
                    symbol_kind=node.kind,
                    start_line=start_line,
                    end_line=end_line,
                    metadata={"stage2_mode": "realtime", "lsp_node_id": node_id},
                )
            )

        if related_results:
            self.logger.debug(
                "Stage 2 (realtime) expanded %d base results to %d related symbols",
                len(coarse_results), len(related_results)
            )

        return self._combine_stage2_results(coarse_results, related_results)

    def _combine_stage2_results(
        self,
        coarse_results: List[SearchResult],
        related_results: List[SearchResult],
    ) -> List[SearchResult]:
        combined = list(coarse_results)
        seen_keys = {(r.path, r.symbol_name, r.start_line) for r in coarse_results}

        for related in related_results:
            key = (related.path, related.symbol_name, related.start_line)
            if key not in seen_keys:
                seen_keys.add(key)
                combined.append(related)

        return combined

    def _find_lsp_workspace_root(self, start_path: Path) -> Path:
        """Best-effort workspace root selection for LSP initialization.

        Many language servers (e.g. Pyright) use workspace-relative include/exclude
        patterns, so using a deep subdir (like "src") as root can break reference
        and call-hierarchy queries.
        """
        start = Path(start_path).resolve()
        if start.is_file():
            start = start.parent

        # Prefer an explicit LSP config file in the workspace.
        for current in [start, *list(start.parents)]:
            try:
                if (current / "lsp-servers.json").is_file():
                    return current
            except OSError:
                continue

        # Fallback heuristics for project root markers.
        for current in [start, *list(start.parents)]:
            try:
                if (current / ".git").exists() or (current / "pyproject.toml").is_file():
                    return current
            except OSError:
                continue

        return start

    def _find_lsp_config_file(self, start_path: Path) -> Optional[Path]:
        """Find a lsp-servers.json by walking up from start_path."""
        start = Path(start_path).resolve()
        if start.is_file():
            start = start.parent

        for current in [start, *list(start.parents)]:
            try:
                candidate = current / "lsp-servers.json"
                if candidate.is_file():
                    return candidate
            except OSError:
                continue
        return None

    def _stage3_cluster_prune(
        self,
        expanded_results: List[SearchResult],
        target_count: int,
    ) -> List[SearchResult]:
        """Stage 3: Cluster expanded results and select representatives.

        Uses the extensible clustering infrastructure from codexlens.search.clustering
        to group similar results and select the best representative from each cluster.

        Args:
            expanded_results: Results from Stage 2 expansion
            target_count: Target number of representative results

        Returns:
            List of representative results (one per cluster)
        """
        if not expanded_results:
            return []

        # If few results, skip clustering
        if len(expanded_results) <= target_count:
            return expanded_results

        strategy_name = "auto"
        if self._config is not None:
            strategy_name = getattr(self._config, "staged_clustering_strategy", "auto") or "auto"
        strategy_name = str(strategy_name).strip().lower()

        if strategy_name in {"noop", "none", "off"}:
            return sorted(expanded_results, key=lambda r: r.score, reverse=True)[:target_count]

        if strategy_name in {"score", "top", "rank"}:
            return sorted(expanded_results, key=lambda r: r.score, reverse=True)[:target_count]

        if strategy_name in {"path", "file"}:
            best_by_path: Dict[str, SearchResult] = {}
            for r in expanded_results:
                if not r.path:
                    continue
                key = str(r.path).lower()
                if key not in best_by_path or r.score > best_by_path[key].score:
                    best_by_path[key] = r
            candidates = list(best_by_path.values()) or expanded_results
            candidates.sort(key=lambda r: r.score, reverse=True)
            return candidates[:target_count]

        if strategy_name in {"dir_rr", "rr_dir", "round_robin_dir"}:
            results_sorted = sorted(expanded_results, key=lambda r: r.score, reverse=True)
            buckets: Dict[str, List[SearchResult]] = {}
            dir_order: List[str] = []
            for r in results_sorted:
                try:
                    d = str(Path(r.path).parent).lower()
                except Exception:
                    d = ""
                if d not in buckets:
                    buckets[d] = []
                    dir_order.append(d)
                buckets[d].append(r)

            out: List[SearchResult] = []
            while len(out) < target_count:
                progressed = False
                for d in dir_order:
                    if not buckets.get(d):
                        continue
                    out.append(buckets[d].pop(0))
                    progressed = True
                    if len(out) >= target_count:
                        break
                if not progressed:
                    break
            return out

        try:
            from codexlens.search.clustering import (
                ClusteringConfig,
                get_strategy,
            )

            # Get clustering config from config
            strategy_name = "auto"
            min_cluster_size = 3

            if self._config is not None:
                strategy_name = getattr(self._config, "staged_clustering_strategy", "auto")
                min_cluster_size = getattr(self._config, "staged_clustering_min_size", 3)

            # Get embeddings for clustering
            # Try to get dense embeddings from results' content
            embeddings = self._get_embeddings_for_clustering(expanded_results)

            if embeddings is None or len(embeddings) == 0:
                # No embeddings available, fall back to score-based selection
                self.logger.debug("No embeddings for clustering, using score-based selection")
                return sorted(
                    expanded_results, key=lambda r: r.score, reverse=True
                )[:target_count]

            # Create clustering config
            config = ClusteringConfig(
                min_cluster_size=min(min_cluster_size, max(2, len(expanded_results) // 5)),
                min_samples=2,
                metric="cosine",
            )

            # Get strategy with fallback
            strategy = get_strategy(strategy_name, config, fallback=True)

            # Cluster and select representatives
            representatives = strategy.fit_predict(embeddings, expanded_results)

            self.logger.debug(
                "Stage 3 clustered %d results into %d representatives using %s",
                len(expanded_results), len(representatives), type(strategy).__name__
            )

            # If clustering returned too few, supplement with top-scored unclustered
            if len(representatives) < target_count:
                rep_paths = {r.path for r in representatives}
                remaining = [r for r in expanded_results if r.path not in rep_paths]
                remaining_sorted = sorted(remaining, key=lambda r: r.score, reverse=True)
                representatives.extend(remaining_sorted[:target_count - len(representatives)])

            return representatives[:target_count]

        except ImportError as exc:
            self.logger.debug("Clustering not available: %s", exc)
            return sorted(
                expanded_results, key=lambda r: r.score, reverse=True
            )[:target_count]
        except Exception as exc:
            self.logger.debug("Stage 3 clustering failed: %s", exc)
            return sorted(
                expanded_results, key=lambda r: r.score, reverse=True
            )[:target_count]

    def _stage4_optional_rerank(
        self,
        query: str,
        clustered_results: List[SearchResult],
        k: int,
    ) -> List[SearchResult]:
        """Stage 4: Optional cross-encoder reranking.

        Applies cross-encoder reranking if enabled in config.

        Args:
            query: Search query string
            clustered_results: Results from Stage 3 clustering
            k: Number of final results to return

        Returns:
            Reranked results sorted by cross-encoder score
        """
        if not clustered_results:
            return []

        # Use existing _cross_encoder_rerank method
        return self._cross_encoder_rerank(query, clustered_results, k)

    def _get_embeddings_for_clustering(
        self,
        results: List[SearchResult],
    ) -> Optional["np.ndarray"]:
        """Get dense embeddings for clustering results.

        Tries to generate embeddings from result content for clustering.

        Args:
            results: List of SearchResult objects

        Returns:
            NumPy array of embeddings or None if not available
        """
        if not NUMPY_AVAILABLE:
            return None

        if not results:
            return None

        try:
            from codexlens.semantic.factory import get_embedder

            # Get embedding settings from config
            embedding_backend = "fastembed"
            embedding_model = "code"
            use_gpu = True

            if self._config is not None:
                embedding_backend = getattr(self._config, "embedding_backend", "fastembed")
                embedding_model = getattr(self._config, "embedding_model", "code")
                use_gpu = getattr(self._config, "embedding_use_gpu", True)

            # Create embedder
            if embedding_backend == "litellm":
                embedder = get_embedder(backend="litellm", model=embedding_model)
            else:
                embedder = get_embedder(backend="fastembed", profile=embedding_model, use_gpu=use_gpu)

            # Extract text content from results
            texts = []
            for result in results:
                # Use content if available, otherwise use excerpt
                text = result.content or result.excerpt or ""
                if not text and result.path:
                    text = result.path
                texts.append(text[:2000])  # Limit text length

            # Generate embeddings
            embeddings = embedder.embed_to_numpy(texts)
            return embeddings

        except ImportError as exc:
            self.logger.debug("Embedder not available for clustering: %s", exc)
            return None
        except Exception as exc:
            self.logger.debug("Failed to generate embeddings for clustering: %s", exc)
            return None

    def binary_rerank_cascade_search(
        self,
        query: str,
        source_path: Path,
        k: int = 10,
        coarse_k: int = 100,
        options: Optional[SearchOptions] = None,
    ) -> ChainSearchResult:
        """Execute binary cascade search with cross-encoder reranking.

        Combines the speed of binary vector coarse search with the quality of
        cross-encoder reranking for the best balance of speed and accuracy.

        Binary + Reranker cascade process:
        1. Stage 1 (Coarse): Fast binary vector search using Hamming distance
           to quickly filter to coarse_k candidates (256-dim binary, 32 bytes/vector)
        2. Stage 2 (Fine): Cross-encoder reranking for precise semantic ranking
           of candidates using query-document attention

        This approach is typically faster than binary_cascade_search while
        achieving similar or better quality through cross-encoder reranking.

        Performance characteristics:
        - Binary search: O(N) with SIMD-accelerated XOR + popcount (~8ms)
        - Cross-encoder: Applied to top coarse_k candidates (~15-20s for API)
        - Total: Faster coarse + high-quality fine = best balance

        Args:
            query: Natural language or keyword query string
            source_path: Starting directory path
            k: Number of final results to return (default 10)
            coarse_k: Number of coarse candidates from first stage (default 100)
            options: Search configuration (uses defaults if None)

        Returns:
            ChainSearchResult with cross-encoder reranked results and statistics

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper, config=config)
            >>> result = engine.binary_rerank_cascade_search(
            ...     "how to authenticate users",
            ...     Path("D:/project/src"),
            ...     k=10,
            ...     coarse_k=100
            ... )
            >>> for r in result.results:
            ...     print(f"{r.path}: {r.score:.3f}")
        """
        if not NUMPY_AVAILABLE:
            self.logger.warning(
                "NumPy not available, falling back to standard search"
            )
            return self.search(query, source_path, options=options)

        options = options or SearchOptions()
        start_time = time.time()
        stats = SearchStats()

        # Use config defaults if available
        if self._config is not None:
            if hasattr(self._config, "cascade_coarse_k"):
                coarse_k = coarse_k or self._config.cascade_coarse_k
            if hasattr(self._config, "cascade_fine_k"):
                k = k or self._config.cascade_fine_k

        # Step 1: Find starting index
        start_index = self._find_start_index(source_path)
        if not start_index:
            self.logger.warning(f"No index found for {source_path}")
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # Step 2: Collect all index paths
        index_paths = self._collect_index_paths(start_index, options.depth)
        stats.dirs_searched = len(index_paths)

        if not index_paths:
            self.logger.warning(f"No indexes collected from {start_index}")
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # Initialize binary embedding backend
        try:
            from codexlens.indexing.embedding import BinaryEmbeddingBackend
        except ImportError as exc:
            self.logger.warning(
                "BinaryEmbeddingBackend not available: %s, falling back to standard search",
                exc
            )
            return self.search(query, source_path, options=options)

        # Step 4: Binary coarse search (same as binary_cascade_search)
        binary_coarse_time = time.time()
        coarse_candidates: List[Tuple[int, int, Path]] = []

        # Try centralized BinarySearcher first (preferred for mmap indexes)
        # The index root is the parent of the first index path
        index_root = index_paths[0].parent if index_paths else None
        used_centralized = False

        if index_root:
            binary_searcher = self._get_centralized_binary_searcher(index_root)
            if binary_searcher is not None:
                try:
                    # BinarySearcher expects dense vector, not packed binary
                    from codexlens.semantic.embedder import Embedder
                    embedder = Embedder()
                    query_dense = embedder.embed_to_numpy([query])[0]

                    results = binary_searcher.search(query_dense, top_k=coarse_k)
                    for chunk_id, distance in results:
                        coarse_candidates.append((chunk_id, distance, index_root))
                    # Only mark as used if we got actual results
                    if coarse_candidates:
                        used_centralized = True
                        self.logger.debug(
                            "Binary coarse search (centralized): %d candidates in %.2fms",
                            len(results), (time.time() - binary_coarse_time) * 1000
                        )
                except Exception as exc:
                    self.logger.debug(f"Centralized binary search failed: {exc}")

        if not used_centralized:
            # Get GPU preference from config
            use_gpu = True
            if self._config is not None:
                use_gpu = getattr(self._config, "embedding_use_gpu", True)

            try:
                binary_backend = BinaryEmbeddingBackend(use_gpu=use_gpu)
                query_binary = binary_backend.embed_packed([query])[0]
            except Exception as exc:
                self.logger.warning(f"Failed to generate binary query embedding: {exc}")
                return self.search(query, source_path, options=options)

            # Fallback to per-directory binary indexes
            for index_path in index_paths:
                try:
                    binary_index = self._get_or_create_binary_index(index_path)
                    if binary_index is None or binary_index.count() == 0:
                        continue
                    # BinaryANNIndex returns (ids, distances) arrays
                    ids, distances = binary_index.search(query_binary, coarse_k)
                    for chunk_id, dist in zip(ids, distances):
                        coarse_candidates.append((chunk_id, dist, index_path))
                except Exception as exc:
                    self.logger.debug(
                        "Binary search failed for %s: %s", index_path, exc
                    )

        if not coarse_candidates:
            self.logger.info("No binary candidates found, falling back to standard search for reranking")
            # Fall back to standard search which uses FTS+Vector
            return self.search(query, source_path, options=options)

        # Sort by Hamming distance and take top coarse_k
        coarse_candidates.sort(key=lambda x: x[1])
        coarse_candidates = coarse_candidates[:coarse_k]

        self.logger.debug(
            "Binary coarse search: %d candidates in %.2fms",
            len(coarse_candidates), (time.time() - binary_coarse_time) * 1000
        )

        # Step 5: Build SearchResult objects for cross-encoder reranking
        # Group candidates by index path for efficient retrieval
        candidates_by_index: Dict[Path, List[int]] = {}
        for chunk_id, distance, index_path in coarse_candidates:
            if index_path not in candidates_by_index:
                candidates_by_index[index_path] = []
            candidates_by_index[index_path].append(chunk_id)

        # Retrieve chunk content for reranking
        # Always use centralized VectorMetadataStore since chunks are stored there
        import sqlite3
        coarse_results: List[SearchResult] = []

        # Find the centralized metadata store path (project root)
        # index_root was computed earlier, use it for chunk retrieval
        central_meta_path = index_root / VECTORS_META_DB_NAME if index_root else None
        central_meta_store = None
        if central_meta_path and central_meta_path.exists():
            central_meta_store = VectorMetadataStore(central_meta_path)

        for index_path, chunk_ids in candidates_by_index.items():
            try:
                chunks_data = []
                if central_meta_store:
                    # Try centralized VectorMetadataStore first (preferred)
                    chunks_data = central_meta_store.get_chunks_by_ids(chunk_ids)

                if not chunks_data and used_centralized:
                    # Fallback to per-index-path meta store
                    meta_db_path = index_path / VECTORS_META_DB_NAME
                    if meta_db_path.exists():
                        meta_store = VectorMetadataStore(meta_db_path)
                        chunks_data = meta_store.get_chunks_by_ids(chunk_ids)

                if not chunks_data:
                    # Final fallback: query semantic_chunks table directly
                    # This handles per-directory indexes with semantic_chunks table
                    try:
                        conn = sqlite3.connect(str(index_path))
                        conn.row_factory = sqlite3.Row
                        placeholders = ",".join("?" * len(chunk_ids))
                        cursor = conn.execute(
                            f"""
                            SELECT id, file_path, content, metadata, category
                            FROM semantic_chunks
                            WHERE id IN ({placeholders})
                            """,
                            chunk_ids
                        )
                        chunks_data = [
                            {
                                "id": row["id"],
                                "file_path": row["file_path"],
                                "content": row["content"],
                                "metadata": row["metadata"],
                                "category": row["category"],
                            }
                            for row in cursor.fetchall()
                        ]
                        conn.close()
                    except Exception:
                        pass  # Skip if table doesn't exist

                for chunk in chunks_data:
                    # Find the Hamming distance for this chunk
                    chunk_id = chunk.get("id") or chunk.get("chunk_id")
                    distance = next(
                        (d for cid, d, _ in coarse_candidates if cid == chunk_id),
                        256
                    )
                    # Initial score from Hamming distance (will be replaced by reranker)
                    score = 1.0 - (distance / 256.0)

                    content = chunk.get("content", "")
                    result = SearchResult(
                        path=chunk.get("file_path", ""),
                        score=float(score),
                        excerpt=content[:500] if content else "",
                        content=content,
                    )
                    coarse_results.append(result)
            except Exception as exc:
                self.logger.debug(
                    "Failed to retrieve chunks from %s: %s", index_path, exc
                )

        if not coarse_results:
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query, results=[], symbols=[], stats=stats
            )

        self.logger.debug(
            "Retrieved %d chunks for cross-encoder reranking", len(coarse_results)
        )

        # Step 6: Cross-encoder reranking
        rerank_time = time.time()
        reranked_results = self._cross_encoder_rerank(query, coarse_results, top_k=k)

        self.logger.debug(
            "Cross-encoder reranking: %d results in %.2fms",
            len(reranked_results), (time.time() - rerank_time) * 1000
        )

        # Deduplicate by path (keep highest score)
        path_to_result: Dict[str, SearchResult] = {}
        for result in reranked_results:
            if result.path not in path_to_result or result.score > path_to_result[result.path].score:
                path_to_result[result.path] = result

        final_results = list(path_to_result.values())[:k]

        stats.files_matched = len(final_results)
        stats.time_ms = (time.time() - start_time) * 1000

        self.logger.debug(
            "Binary+Rerank cascade search complete: %d results in %.2fms",
            len(final_results),
            stats.time_ms,
        )

        return ChainSearchResult(
            query=query,
            results=final_results,
            symbols=[],
            stats=stats,
        )

    def dense_rerank_cascade_search(
        self,
        query: str,
        source_path: Path,
        k: int = 10,
        coarse_k: int = 100,
        options: Optional[SearchOptions] = None,
    ) -> ChainSearchResult:
        """Execute dense cascade search with cross-encoder reranking.

        Combines dense vector coarse search (HNSW) with cross-encoder reranking
        for comparison with binary_rerank strategy.

        Dense + Reranker cascade process:
        1. Stage 1 (Coarse): Dense vector search using HNSW (cosine similarity)
           to get coarse_k candidates (2048-dim float32)
        2. Stage 2 (Fine): Cross-encoder reranking for precise semantic ranking

        Args:
            query: Natural language or keyword query string
            source_path: Starting directory path
            k: Number of final results to return (default 10)
            coarse_k: Number of coarse candidates from first stage (default 100)
            options: Search configuration (uses defaults if None)

        Returns:
            ChainSearchResult with cross-encoder reranked results and statistics
        """
        if not NUMPY_AVAILABLE:
            self.logger.warning(
                "NumPy not available, falling back to standard search"
            )
            return self.search(query, source_path, options=options)

        options = options or SearchOptions()
        start_time = time.time()
        stats = SearchStats()

        # Use config defaults if available
        if self._config is not None:
            if hasattr(self._config, "cascade_coarse_k"):
                coarse_k = coarse_k or self._config.cascade_coarse_k
            if hasattr(self._config, "cascade_fine_k"):
                k = k or self._config.cascade_fine_k

        # Step 1: Find starting index
        start_index = self._find_start_index(source_path)
        if not start_index:
            self.logger.warning(f"No index found for {source_path}")
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # Step 2: Collect all index paths
        index_paths = self._collect_index_paths(start_index, options.depth)
        stats.dirs_searched = len(index_paths)

        if not index_paths:
            self.logger.warning(f"No indexes collected from {start_index}")
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # Step 3: Find centralized HNSW index and read model config
        from codexlens.config import VECTORS_HNSW_NAME
        central_hnsw_path = None
        index_root = start_index.parent
        current_dir = index_root
        for _ in range(10):  # Limit search depth
            candidate = current_dir / VECTORS_HNSW_NAME
            if candidate.exists():
                central_hnsw_path = candidate
                index_root = current_dir  # Update to where HNSW was found
                break
            parent = current_dir.parent
            if parent == current_dir:  # Reached root
                break
            current_dir = parent

        # Step 4: Generate query dense embedding using same model as centralized index
        # Read embedding config to match the model used during indexing
        dense_coarse_time = time.time()
        try:
            from codexlens.semantic.factory import get_embedder

            # Get embedding settings from centralized index config (preferred) or fallback to self._config
            embedding_backend = "litellm"  # Default to API for dense
            embedding_model = "qwen3-embedding-sf"  # Default model
            use_gpu = True

            # Try to read model config from centralized index's embeddings_config table
            central_index_db = index_root / "_index.db"
            if central_index_db.exists():
                try:
                    from codexlens.semantic.vector_store import VectorStore
                    with VectorStore(central_index_db) as vs:
                        model_config = vs.get_model_config()
                        if model_config:
                            embedding_backend = model_config.get("backend", embedding_backend)
                            embedding_model = model_config.get("model_name", embedding_model)
                            self.logger.debug(
                                "Read model config from centralized index: %s/%s",
                                embedding_backend, embedding_model
                            )
                except Exception as e:
                    self.logger.debug("Failed to read centralized model config: %s", e)

            # Fallback to self._config if not read from index
            if self._config is not None:
                if embedding_backend == "litellm" and embedding_model == "qwen3-embedding-sf":
                    # Only use config values if we didn't read from centralized index
                    config_backend = getattr(self._config, "embedding_backend", None)
                    config_model = getattr(self._config, "embedding_model", None)
                    if config_backend:
                        embedding_backend = config_backend
                    if config_model:
                        embedding_model = config_model
                use_gpu = getattr(self._config, "embedding_use_gpu", True)

            # Create embedder matching index configuration
            if embedding_backend == "litellm":
                embedder = get_embedder(backend="litellm", model=embedding_model)
            else:
                embedder = get_embedder(backend="fastembed", profile=embedding_model, use_gpu=use_gpu)

            query_dense = embedder.embed_to_numpy([query])[0]
            self.logger.debug(f"Dense query embedding: {query_dense.shape[0]}-dim via {embedding_backend}/{embedding_model}")
        except Exception as exc:
            self.logger.warning(f"Failed to generate dense query embedding: {exc}")
            return self.search(query, source_path, options=options)

        # Step 5: Dense coarse search using centralized HNSW index
        coarse_candidates: List[Tuple[int, float, Path]] = []  # (chunk_id, distance, index_path)

        if central_hnsw_path is not None:
            # Use centralized index
            try:
                from codexlens.semantic.ann_index import ANNIndex
                ann_index = ANNIndex.create_central(
                    index_root=index_root,
                    dim=query_dense.shape[0],
                )
                if ann_index.load() and ann_index.count() > 0:
                    # Search centralized HNSW index
                    ids, distances = ann_index.search(query_dense, top_k=coarse_k)
                    for chunk_id, dist in zip(ids, distances):
                        coarse_candidates.append((chunk_id, dist, index_root / "_index.db"))
                    self.logger.debug(
                        "Centralized dense search: %d candidates from %s",
                        len(ids), central_hnsw_path
                    )
            except Exception as exc:
                self.logger.debug(
                    "Centralized dense search failed for %s: %s", central_hnsw_path, exc
                )

        # Fallback: try per-directory HNSW indexes if centralized not found
        if not coarse_candidates:
            for index_path in index_paths:
                try:
                    # Load HNSW index
                    from codexlens.semantic.ann_index import ANNIndex
                    ann_index = ANNIndex(index_path, dim=query_dense.shape[0])
                    if not ann_index.load():
                        continue

                    if ann_index.count() == 0:
                        continue

                    # Search HNSW index
                    ids, distances = ann_index.search(query_dense, top_k=coarse_k)
                    for chunk_id, dist in zip(ids, distances):
                        coarse_candidates.append((chunk_id, dist, index_path))

                except Exception as exc:
                    self.logger.debug(
                        "Dense search failed for %s: %s", index_path, exc
                    )

        if not coarse_candidates:
            self.logger.info("No dense candidates found, falling back to standard search")
            return self.search(query, source_path, options=options)

        # Sort by distance (ascending for cosine distance) and take top coarse_k
        coarse_candidates.sort(key=lambda x: x[1])
        coarse_candidates = coarse_candidates[:coarse_k]

        self.logger.debug(
            "Dense coarse search: %d candidates in %.2fms",
            len(coarse_candidates), (time.time() - dense_coarse_time) * 1000
        )

        # Step 6: Build SearchResult objects for cross-encoder reranking
        candidates_by_index: Dict[Path, List[int]] = {}
        for chunk_id, distance, index_path in coarse_candidates:
            if index_path not in candidates_by_index:
                candidates_by_index[index_path] = []
            candidates_by_index[index_path].append(chunk_id)

        # Retrieve chunk content for reranking
        import sqlite3
        coarse_results: List[SearchResult] = []

        for index_path, chunk_ids in candidates_by_index.items():
            try:
                # For centralized index, use _vectors_meta.db for chunk metadata
                # which contains file_path, content, start_line, end_line
                if central_hnsw_path is not None and index_path == index_root / "_index.db":
                    # Use centralized metadata from _vectors_meta.db
                    meta_db_path = index_root / "_vectors_meta.db"
                    if meta_db_path.exists():
                        conn = sqlite3.connect(str(meta_db_path))
                        conn.row_factory = sqlite3.Row
                        placeholders = ",".join("?" * len(chunk_ids))
                        cursor = conn.execute(
                            f"""
                            SELECT chunk_id, file_path, content, start_line, end_line
                            FROM chunk_metadata
                            WHERE chunk_id IN ({placeholders})
                            """,
                            chunk_ids
                        )
                        chunks_data = [
                            {
                                "id": row["chunk_id"],
                                "file_path": row["file_path"],
                                "content": row["content"],
                                "metadata": json.dumps({
                                    "start_line": row["start_line"],
                                    "end_line": row["end_line"]
                                }),
                                "category": "code" if row["file_path"].endswith(('.py', '.ts', '.js', '.java', '.go', '.rs', '.cpp', '.c')) else "doc",
                            }
                            for row in cursor.fetchall()
                        ]
                        conn.close()
                    else:
                        chunks_data = []
                else:
                    # Fall back to per-directory semantic_chunks table
                    conn = sqlite3.connect(str(index_path))
                    conn.row_factory = sqlite3.Row
                    placeholders = ",".join("?" * len(chunk_ids))
                    cursor = conn.execute(
                        f"""
                        SELECT id, file_path, content, metadata, category
                        FROM semantic_chunks
                        WHERE id IN ({placeholders})
                        """,
                        chunk_ids
                    )
                    chunks_data = [
                        {
                            "id": row["id"],
                            "file_path": row["file_path"],
                            "content": row["content"],
                            "metadata": row["metadata"],
                            "category": row["category"],
                        }
                        for row in cursor.fetchall()
                    ]
                    conn.close()

                for chunk in chunks_data:
                    chunk_id = chunk.get("id")
                    distance = next(
                        (d for cid, d, _ in coarse_candidates if cid == chunk_id),
                        1.0
                    )
                    # Convert cosine distance to score (clamp to [0, 1] for Pydantic validation)
                    # Cosine distance can be > 1 for anti-correlated vectors, causing negative scores
                    score = max(0.0, 1.0 - distance)

                    content = chunk.get("content", "")
                    result = SearchResult(
                        path=chunk.get("file_path", ""),
                        score=float(score),
                        excerpt=content[:500] if content else "",
                        content=content,
                    )
                    coarse_results.append(result)
            except Exception as exc:
                self.logger.debug(
                    "Failed to retrieve chunks from %s: %s", index_path, exc
                )

        if not coarse_results:
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query, results=[], symbols=[], stats=stats
            )

        self.logger.debug(
            "Retrieved %d chunks for cross-encoder reranking", len(coarse_results)
        )

        # Step 6: Cross-encoder reranking
        rerank_time = time.time()
        reranked_results = self._cross_encoder_rerank(query, coarse_results, top_k=k)

        self.logger.debug(
            "Cross-encoder reranking: %d results in %.2fms",
            len(reranked_results), (time.time() - rerank_time) * 1000
        )

        # Deduplicate by path (keep highest score)
        path_to_result: Dict[str, SearchResult] = {}
        for result in reranked_results:
            if result.path not in path_to_result or result.score > path_to_result[result.path].score:
                path_to_result[result.path] = result

        final_results = list(path_to_result.values())[:k]

        stats.files_matched = len(final_results)
        stats.time_ms = (time.time() - start_time) * 1000

        self.logger.debug(
            "Dense+Rerank cascade search complete: %d results in %.2fms",
            len(final_results),
            stats.time_ms,
        )

        return ChainSearchResult(
            query=query,
            results=final_results,
            symbols=[],
            stats=stats,
        )

    def _get_or_create_binary_index(self, index_path: Path) -> Optional[Any]:
        """Get or create a BinaryANNIndex for the given index path.

        .. deprecated::
            This method uses the deprecated BinaryANNIndex. For centralized indexes,
            use _get_centralized_binary_searcher() instead.

        Attempts to load an existing binary index from disk. If not found,
        returns None (binary index should be built during indexing).

        Args:
            index_path: Path to the _index.db file

        Returns:
            BinaryANNIndex instance or None if not available
        """
        try:
            import warnings
            # Suppress deprecation warning since we're using it intentionally for legacy support
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", category=DeprecationWarning)
                from codexlens.semantic.ann_index import BinaryANNIndex

                binary_index = BinaryANNIndex(index_path, dim=256)
                if binary_index.load():
                    return binary_index
            return None
        except Exception as exc:
            self.logger.debug("Failed to load binary index for %s: %s", index_path, exc)
            return None

    def _get_centralized_binary_searcher(self, index_root: Path) -> Optional[Any]:
        """Get centralized BinarySearcher for memory-mapped binary vectors.

        This is the preferred method for centralized indexes, providing faster
        search via memory-mapped files.

        Args:
            index_root: Root directory containing centralized index files

        Returns:
            BinarySearcher instance or None if not available
        """
        try:
            from codexlens.search.binary_searcher import BinarySearcher

            binary_searcher = BinarySearcher(index_root)
            if binary_searcher.load():
                self.logger.debug(
                    "Using centralized BinarySearcher with %d vectors (mmap=%s)",
                    binary_searcher.vector_count,
                    binary_searcher.is_memmap
                )
                return binary_searcher
            return None
        except Exception as exc:
            self.logger.debug("Failed to load centralized binary searcher: %s", exc)
            return None

    def _find_nearest_binary_mmap_root(self, index_root: Path, *, max_levels: int = 10) -> Path:
        """Walk up index_root parents to find the nearest centralized binary mmap.

        Centralized staged-binary artifacts are stored at a project index root
        (e.g. `.../project/src/_binary_vectors.mmap`), but staged search often starts
        from the nearest ancestor `_index.db` path, which can be nested deeper.

        This helper makes Stage 1 robust by locating the nearest ancestor directory
        that contains the centralized `_binary_vectors.mmap`.
        """
        current_dir = Path(index_root).resolve()
        for _ in range(max(0, int(max_levels)) + 1):
            try:
                if (current_dir / BINARY_VECTORS_MMAP_NAME).exists():
                    return current_dir
            except Exception:
                return Path(index_root).resolve()

            parent = current_dir.parent
            if parent == current_dir:
                break
            current_dir = parent

        return Path(index_root).resolve()

    def _compute_cosine_similarity(
        self,
        query_vec: "np.ndarray",
        doc_vec: "np.ndarray",
    ) -> float:
        """Compute cosine similarity between query and document vectors.

        Args:
            query_vec: Query embedding vector
            doc_vec: Document embedding vector

        Returns:
            Cosine similarity score in range [-1, 1]
        """
        if not NUMPY_AVAILABLE:
            return 0.0

        # Ensure same shape
        min_len = min(len(query_vec), len(doc_vec))
        q = query_vec[:min_len]
        d = doc_vec[:min_len]

        # Compute cosine similarity
        dot_product = np.dot(q, d)
        norm_q = np.linalg.norm(q)
        norm_d = np.linalg.norm(d)

        if norm_q == 0 or norm_d == 0:
            return 0.0

        return float(dot_product / (norm_q * norm_d))

    def _compute_cosine_similarity_batch(
        self,
        query_vec: "np.ndarray",
        doc_matrix: "np.ndarray",
    ) -> "np.ndarray":
        """Compute cosine similarity between query and multiple document vectors.

        Uses vectorized matrix operations for efficient batch computation.

        Args:
            query_vec: Query embedding vector of shape (dim,)
            doc_matrix: Document embeddings matrix of shape (n_docs, dim)

        Returns:
            Array of cosine similarity scores of shape (n_docs,)
        """
        if not NUMPY_AVAILABLE:
            return np.zeros(doc_matrix.shape[0])

        # Ensure query is 1D
        if query_vec.ndim > 1:
            query_vec = query_vec.flatten()

        # Handle dimension mismatch by truncating to smaller dimension
        min_dim = min(len(query_vec), doc_matrix.shape[1])
        q = query_vec[:min_dim]
        docs = doc_matrix[:, :min_dim]

        # Compute query norm once
        norm_q = np.linalg.norm(q)
        if norm_q == 0:
            return np.zeros(docs.shape[0])

        # Normalize query
        q_normalized = q / norm_q

        # Compute document norms (vectorized)
        doc_norms = np.linalg.norm(docs, axis=1)

        # Avoid division by zero
        nonzero_mask = doc_norms > 0
        scores = np.zeros(docs.shape[0], dtype=np.float32)

        if np.any(nonzero_mask):
            # Normalize documents with non-zero norms
            docs_normalized = docs[nonzero_mask] / doc_norms[nonzero_mask, np.newaxis]

            # Batch dot product: (n_docs, dim) @ (dim,) = (n_docs,)
            scores[nonzero_mask] = docs_normalized @ q_normalized

        return scores

    def _build_results_from_candidates(
        self,
        candidates: List[Tuple[int, int, Path]],
        index_paths: List[Path],
        stats: SearchStats,
        query: str,
        start_time: float,
        use_centralized: bool = False,
    ) -> ChainSearchResult:
        """Build ChainSearchResult from binary candidates using Hamming distance scores.

        Used as fallback when dense embeddings are not available.

        Args:
            candidates: List of (chunk_id, hamming_distance, index_path) tuples
            index_paths: List of all searched index paths
            stats: SearchStats to update
            query: Original query string
            start_time: Search start time for timing
            use_centralized: If True, index_path is the index_root directory
                and VectorMetadataStore should be used instead of SQLiteStore

        Returns:
            ChainSearchResult with results scored by Hamming distance
        """
        results: List[SearchResult] = []

        # Group by index path
        candidates_by_index: Dict[Path, List[Tuple[int, int]]] = {}
        for chunk_id, distance, index_path in candidates:
            if index_path not in candidates_by_index:
                candidates_by_index[index_path] = []
            candidates_by_index[index_path].append((chunk_id, distance))

        for index_path, chunk_tuples in candidates_by_index.items():
            try:
                chunk_ids = [c[0] for c in chunk_tuples]

                # Use VectorMetadataStore for centralized search, SQLiteStore for per-directory
                if use_centralized:
                    # index_path is actually index_root directory for centralized search
                    meta_db_path = index_path / VECTORS_META_DB_NAME
                    if not meta_db_path.exists():
                        self.logger.debug(
                            "VectorMetadataStore not found at %s, skipping", meta_db_path
                        )
                        continue
                    meta_store = VectorMetadataStore(meta_db_path)
                    chunks_data = meta_store.get_chunks_by_ids(chunk_ids)
                else:
                    store = SQLiteStore(index_path)
                    chunks_data = store.get_chunks_by_ids(chunk_ids)

                chunk_content: Dict[int, Dict[str, Any]] = {
                    c["id"]: c for c in chunks_data
                }

                for chunk_id, distance in chunk_tuples:
                    chunk_info = chunk_content.get(chunk_id)
                    if chunk_info is None:
                        continue

                    # Convert Hamming distance to score (lower distance = higher score)
                    # Max Hamming distance for 256-bit is 256
                    score = 1.0 - (distance / 256.0)

                    excerpt = chunk_info.get("content", "")[:500]
                    result = SearchResult(
                        path=chunk_info.get("file_path", ""),
                        score=float(score),
                        excerpt=excerpt,
                    )
                    results.append(result)

            except Exception as exc:
                self.logger.debug(
                    "Failed to build results from %s: %s", index_path, exc
                )

        # Deduplicate by path
        path_to_result: Dict[str, SearchResult] = {}
        for result in results:
            if result.path not in path_to_result or result.score > path_to_result[result.path].score:
                path_to_result[result.path] = result

        final_results = sorted(
            path_to_result.values(),
            key=lambda r: r.score,
            reverse=True,
        )

        stats.files_matched = len(final_results)
        stats.time_ms = (time.time() - start_time) * 1000

        return ChainSearchResult(
            query=query,
            results=final_results,
            symbols=[],
            stats=stats,
        )

    def _cross_encoder_rerank(
        self,
        query: str,
        results: List[SearchResult],
        top_k: int,
    ) -> List[SearchResult]:
        """Rerank results using cross-encoder model.

        Args:
            query: Search query string
            results: Candidate results to rerank
            top_k: Number of top results to return

        Returns:
            Reranked results sorted by cross-encoder score
        """
        if not results:
            return []

        # Try to get reranker from config or create new one
        reranker = None
        try:
            from codexlens.semantic.reranker import (
                check_reranker_available,
                get_reranker,
            )

            # Determine backend and model from config
            backend = "onnx"
            model_name = None
            use_gpu = True

            if self._config is not None:
                backend = getattr(self._config, "reranker_backend", "onnx") or "onnx"
                model_name = getattr(self._config, "reranker_model", None)
                use_gpu = getattr(self._config, "embedding_use_gpu", True)

            ok, err = check_reranker_available(backend)
            if not ok:
                self.logger.debug("Reranker backend unavailable (%s): %s", backend, err)
                return results[:top_k]

            # Create reranker
            kwargs = {}
            if backend == "onnx":
                kwargs["use_gpu"] = use_gpu
            elif backend == "api":
                # Pass max_input_tokens for adaptive batching
                max_tokens = getattr(self._config, "reranker_max_input_tokens", None)
                if max_tokens:
                    kwargs["max_input_tokens"] = max_tokens

            reranker = get_reranker(backend=backend, model_name=model_name, **kwargs)

        except ImportError as exc:
            self.logger.debug("Reranker not available: %s", exc)
            return results[:top_k]
        except Exception as exc:
            self.logger.debug("Failed to initialize reranker: %s", exc)
            return results[:top_k]

        # Use cross_encoder_rerank from ranking module
        from codexlens.search.ranking import cross_encoder_rerank

        # Get chunk_type weights and test_file_penalty from config
        chunk_type_weights = None
        test_file_penalty = 0.0

        if self._config is not None:
            chunk_type_weights = getattr(self._config, "reranker_chunk_type_weights", None)
            test_file_penalty = getattr(self._config, "reranker_test_file_penalty", 0.0)

        return cross_encoder_rerank(
            query=query,
            results=results,
            reranker=reranker,
            top_k=top_k,
            batch_size=32,
            chunk_type_weights=chunk_type_weights,
            test_file_penalty=test_file_penalty,
        )

    def search_files_only(self, query: str,
                          source_path: Path,
                          options: Optional[SearchOptions] = None) -> List[str]:
        """Search and return only matching file paths.

        Faster than full search when excerpts are not needed.

        Args:
            query: FTS5 search query string
            source_path: Starting directory path
            options: Search configuration (uses defaults if None)

        Returns:
            List of file paths as strings

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper)
            >>> paths = engine.search_files_only("TODO", Path("D:/project"))
            >>> print(f"Found {len(paths)} files with TODOs")
        """
        options = options or SearchOptions()
        options.files_only = True

        result = self.search(query, source_path, options)
        return [r.path for r in result.results]

    def search_symbols(self, name: str,
                       source_path: Path,
                       kind: Optional[str] = None,
                       options: Optional[SearchOptions] = None) -> List[Symbol]:
        """Chain symbol search across directory hierarchy.

        Args:
            name: Symbol name pattern (partial match supported)
            source_path: Starting directory path
            kind: Optional symbol kind filter (e.g., 'function', 'class')
            options: Search configuration (uses defaults if None)

        Returns:
            List of Symbol objects sorted by name

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper)
            >>> funcs = engine.search_symbols("init", Path("D:/project"), kind="function")
            >>> for sym in funcs[:10]:
            ...     print(f"{sym.name} ({sym.kind}): lines {sym.range}")
        """
        options = options or SearchOptions()

        start_index = self._find_start_index(source_path)
        if not start_index:
            self.logger.warning(f"No index found for {source_path}")
            return []

        # Fast path: project-wide global symbol index (avoids chain traversal).
        if self._config is None or getattr(self._config, "global_symbol_index_enabled", True):
            try:
                # Avoid relying on index_to_source() here; use the same logic as _find_start_index
                # to determine the effective search root directory.
                search_root = source_path.resolve()
                exact_index = self.mapper.source_to_index_db(search_root)
                if not exact_index.exists():
                    nearest = self.registry.find_nearest_index(search_root)
                    if nearest:
                        search_root = nearest.source_path

                project = self.registry.find_by_source_path(str(search_root))
                if project:
                    global_db_path = Path(project["index_root"]) / GlobalSymbolIndex.DEFAULT_DB_NAME
                    if global_db_path.exists():
                        query_limit = max(int(options.total_limit) * 10, int(options.total_limit))
                        with GlobalSymbolIndex(global_db_path, project_id=int(project["id"])) as global_index:
                            candidates = global_index.search(name=name, kind=kind, limit=query_limit)

                        # Apply depth constraint relative to the start index directory.
                        filtered: List[Symbol] = []
                        for sym in candidates:
                            if not sym.file:
                                continue
                            try:
                                root_str = str(search_root)
                                file_dir_str = str(Path(sym.file).parent)

                                # Normalize Windows long-path prefix (\\?\) if present.
                                if root_str.startswith("\\\\?\\"):
                                    root_str = root_str[4:]
                                if file_dir_str.startswith("\\\\?\\"):
                                    file_dir_str = file_dir_str[4:]

                                root_cmp = root_str.lower().rstrip("\\/")
                                dir_cmp = file_dir_str.lower().rstrip("\\/")

                                # Guard against Windows cross-drive comparisons (ValueError).
                                if os.name == "nt":
                                    root_drive, _ = os.path.splitdrive(root_cmp)
                                    dir_drive, _ = os.path.splitdrive(dir_cmp)
                                    if root_drive and dir_drive and root_drive != dir_drive:
                                        self.logger.debug(
                                            "Skipping symbol due to cross-drive path (root=%s file=%s name=%s)",
                                            root_cmp,
                                            sym.file,
                                            sym.name,
                                        )
                                        continue

                                if os.path.commonpath([root_cmp, dir_cmp]) != root_cmp:
                                    continue

                                rel = os.path.relpath(dir_cmp, root_cmp)
                                rel_depth = 0 if rel == "." else len(rel.split(os.sep))
                            except ValueError as exc:
                                self.logger.debug(
                                    "Skipping symbol due to path operation failure (root=%s file=%s name=%s): %s",
                                    str(search_root),
                                    sym.file,
                                    sym.name,
                                    exc,
                                )
                                continue
                            except Exception as exc:
                                self.logger.debug(
                                    "Skipping symbol due to unexpected path error (root=%s file=%s name=%s): %s",
                                    str(search_root),
                                    sym.file,
                                    sym.name,
                                    exc,
                                )
                                continue

                            if options.depth >= 0 and rel_depth > options.depth:
                                continue
                            filtered.append(sym)

                        if filtered:
                            # Match existing semantics: dedupe by (name, kind, range), sort by name.
                            seen = set()
                            unique_symbols: List[Symbol] = []
                            for sym in filtered:
                                key = (sym.name, sym.kind, sym.range)
                                if key in seen:
                                    continue
                                seen.add(key)
                                unique_symbols.append(sym)
                            unique_symbols.sort(key=lambda s: s.name)
                            return unique_symbols[: options.total_limit]
            except Exception as exc:
                self.logger.debug("Global symbol index fast path failed: %s", exc)

        index_paths = self._collect_index_paths(start_index, options.depth)
        if not index_paths:
            return []

        return self._search_symbols_parallel(
            index_paths, name, kind, options.total_limit
        )

    def search_references(
        self,
        symbol_name: str,
        source_path: Optional[Path] = None,
        depth: int = -1,
        limit: int = 100,
    ) -> List[ReferenceResult]:
        """Find all references to a symbol across the project.

        Searches the code_relationships table in all index databases to find
        where the given symbol is referenced (called, imported, inherited, etc.).

        Args:
            symbol_name: Fully qualified or simple name of the symbol to find references to
            source_path: Starting path for search (default: workspace root from registry)
            depth: Search depth (-1 = unlimited, 0 = current dir only)
            limit: Maximum results to return (default 100)

        Returns:
            List of ReferenceResult objects sorted by file path and line number

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper)
            >>> refs = engine.search_references("authenticate", Path("D:/project/src"))
            >>> for ref in refs[:10]:
            ...     print(f"{ref.file_path}:{ref.line} ({ref.relationship_type})")
        """
        import sqlite3
        from concurrent.futures import as_completed

        # Determine starting path
        if source_path is None:
            # Try to get workspace root from registry
            mappings = self.registry.list_mappings()
            if mappings:
                source_path = Path(mappings[0].source_path)
            else:
                self.logger.warning("No source path provided and no mappings in registry")
                return []

        # Find starting index
        start_index = self._find_start_index(source_path)
        if not start_index:
            self.logger.warning(f"No index found for {source_path}")
            return []

        # Collect all index paths
        index_paths = self._collect_index_paths(start_index, depth)
        if not index_paths:
            self.logger.debug(f"No indexes collected from {start_index}")
            return []

        self.logger.debug(
            "Searching %d indexes for references to '%s'",
            len(index_paths), symbol_name
        )

        # Search in parallel
        all_results: List[ReferenceResult] = []
        executor = self._get_executor()

        def search_single_index(index_path: Path) -> List[ReferenceResult]:
            """Search a single index for references."""
            results: List[ReferenceResult] = []
            try:
                conn = sqlite3.connect(str(index_path), check_same_thread=False)
                conn.row_factory = sqlite3.Row

                # Query code_relationships for references to this symbol
                # Match either target_qualified_name containing the symbol name
                # or an exact match on the last component
                # Try full_path first (new schema), fallback to path (old schema)
                try:
                    rows = conn.execute(
                        """
                        SELECT DISTINCT
                            f.full_path as source_file,
                            cr.source_line,
                            cr.relationship_type,
                            f.content
                        FROM code_relationships cr
                        JOIN symbols s ON s.id = cr.source_symbol_id
                        JOIN files f ON f.id = s.file_id
                        WHERE cr.target_qualified_name LIKE ?
                           OR cr.target_qualified_name LIKE ?
                           OR cr.target_qualified_name = ?
                        ORDER BY f.full_path, cr.source_line
                        LIMIT ?
                        """,
                        (
                            f"%{symbol_name}",      # Ends with symbol name
                            f"%.{symbol_name}",     # Qualified name ending with .symbol_name
                            symbol_name,            # Exact match
                            limit,
                        )
                    ).fetchall()
                except sqlite3.OperationalError:
                    # Fallback for old schema with 'path' column
                    rows = conn.execute(
                        """
                        SELECT DISTINCT
                            f.path as source_file,
                            cr.source_line,
                            cr.relationship_type,
                            f.content
                        FROM code_relationships cr
                        JOIN symbols s ON s.id = cr.source_symbol_id
                        JOIN files f ON f.id = s.file_id
                        WHERE cr.target_qualified_name LIKE ?
                           OR cr.target_qualified_name LIKE ?
                           OR cr.target_qualified_name = ?
                        ORDER BY f.path, cr.source_line
                        LIMIT ?
                        """,
                        (
                            f"%{symbol_name}",      # Ends with symbol name
                            f"%.{symbol_name}",     # Qualified name ending with .symbol_name
                            symbol_name,            # Exact match
                            limit,
                        )
                    ).fetchall()

                for row in rows:
                    file_path = row["source_file"]
                    line = row["source_line"] or 1
                    rel_type = row["relationship_type"]
                    content = row["content"] or ""

                    # Extract context (3 lines around reference)
                    context = self._extract_context(content, line, context_lines=3)

                    results.append(ReferenceResult(
                        file_path=file_path,
                        line=line,
                        column=0,  # Column info not stored in code_relationships
                        context=context,
                        relationship_type=rel_type,
                    ))

                conn.close()
            except sqlite3.DatabaseError as exc:
                self.logger.debug(
                    "Failed to search references in %s: %s", index_path, exc
                )
            except Exception as exc:
                self.logger.debug(
                    "Unexpected error searching references in %s: %s", index_path, exc
                )

            return results

        # Submit parallel searches
        futures = {
            executor.submit(search_single_index, idx_path): idx_path
            for idx_path in index_paths
        }

        for future in as_completed(futures):
            try:
                results = future.result()
                all_results.extend(results)
            except Exception as exc:
                idx_path = futures[future]
                self.logger.debug(
                    "Reference search failed for %s: %s", idx_path, exc
                )

        # Deduplicate by (file_path, line)
        seen: set = set()
        unique_results: List[ReferenceResult] = []
        for ref in all_results:
            key = (ref.file_path, ref.line)
            if key not in seen:
                seen.add(key)
                unique_results.append(ref)

        # Sort by file path and line
        unique_results.sort(key=lambda r: (r.file_path, r.line))

        # Apply limit
        return unique_results[:limit]

    def _extract_context(
        self,
        content: str,
        line: int,
        context_lines: int = 3
    ) -> str:
        """Extract lines around a given line number from file content.

        Args:
            content: Full file content
            line: Target line number (1-based)
            context_lines: Number of lines to include before and after

        Returns:
            Context snippet as a string
        """
        if not content:
            return ""

        lines = content.splitlines()
        total_lines = len(lines)

        if line < 1 or line > total_lines:
            return ""

        # Calculate range (0-indexed internally)
        start = max(0, line - 1 - context_lines)
        end = min(total_lines, line + context_lines)

        context = lines[start:end]
        return "\n".join(context)

    # === Internal Methods ===

    def _find_start_index(self, source_path: Path) -> Optional[Path]:
        """Find index database path for source directory.

        Attempts exact match first, then searches for nearest ancestor index.

        Args:
            source_path: Source directory path

        Returns:
            Path to _index.db file, or None if not found
        """
        source_path = source_path.resolve()

        # Try exact match first
        exact_index = self.mapper.source_to_index_db(source_path)
        if exact_index.exists():
            self.logger.debug(f"Found exact index: {exact_index}")
            return exact_index

        # Try nearest ancestor via registry
        nearest = self.registry.find_nearest_index(source_path)
        if nearest:
            self.logger.debug(f"Found nearest index: {nearest.index_path}")
            return nearest.index_path

        self.logger.warning(f"No index found for {source_path}")
        return None

    def _collect_index_paths(self, start_index: Path,
                              depth: int) -> List[Path]:
        """Recursively collect all subdirectory index paths.

        Traverses directory tree via subdirs table in each _index.db,
        respecting depth limit.

        Args:
            start_index: Starting _index.db path
            depth: Maximum depth (-1 = unlimited, 0 = current only)

        Returns:
            List of _index.db paths to search
        """
        collected = []
        visited = set()

        def _collect_recursive(index_path: Path, current_depth: int):
            # Normalize path to avoid duplicates
            normalized = index_path.resolve()
            if normalized in visited:
                return
            visited.add(normalized)

            # Add current index
            if normalized.exists():
                collected.append(normalized)
            else:
                self.logger.debug(f"Index does not exist: {normalized}")
                return

            # Check depth limit
            if depth >= 0 and current_depth >= depth:
                return

            # Read subdirs and recurse
            try:
                with DirIndexStore(normalized) as store:
                    subdirs = store.get_subdirs()
                    for subdir in subdirs:
                        _collect_recursive(subdir.index_path, current_depth + 1)
            except Exception as exc:
                self.logger.warning(f"Failed to read subdirs from {normalized}: {exc}")

        _collect_recursive(start_index, 0)
        self.logger.info(f"Collected {len(collected)} indexes (depth={depth})")
        return collected

    def _search_parallel(self, index_paths: List[Path],
                          query: str,
                          options: SearchOptions) -> tuple[List[SearchResult], SearchStats]:
        """Search multiple indexes in parallel using shared ThreadPoolExecutor.

        Args:
            index_paths: List of _index.db paths to search
            query: FTS5 query string
            options: Search configuration

        Returns:
            Tuple of (all results, search statistics)
        """
        all_results = []
        stats = SearchStats()

        # Force single-threaded execution for vector/hybrid search to avoid GPU crashes
        # DirectML/ONNX have threading issues when multiple threads access GPU resources
        effective_workers = options.max_workers
        if options.enable_vector or options.hybrid_mode:
            effective_workers = 1
            self.logger.debug("Using single-threaded mode for vector search (GPU safety)")
            # Pre-load embedder to avoid initialization overhead per-search
            try:
                from codexlens.semantic.embedder import get_embedder
                get_embedder(profile="code", use_gpu=True)
            except Exception:
                pass  # Ignore pre-load failures

        executor = self._get_executor(effective_workers)
        # Submit all search tasks
        future_to_path = {
            executor.submit(
                self._search_single_index,
                idx_path,
                query,
                options.limit_per_dir,
                options.files_only,
                options.include_semantic,
                options.hybrid_mode,
                options.enable_fuzzy,
                options.enable_vector,
                options.pure_vector,
                options.hybrid_weights
            ): idx_path
            for idx_path in index_paths
        }

        # Collect results as they complete
        for future in as_completed(future_to_path):
            idx_path = future_to_path[future]
            try:
                results = future.result()
                all_results.extend(results)
                self.logger.debug(f"Got {len(results)} results from {idx_path.parent.name}")
            except Exception as exc:
                error_msg = f"Search failed for {idx_path}: {exc}"
                self.logger.error(error_msg)
                stats.errors.append(error_msg)

        return all_results, stats

    def _search_single_index(self, index_path: Path,
                              query: str,
                              limit: int,
                              files_only: bool = False,
                              include_semantic: bool = False,
                              hybrid_mode: bool = False,
                              enable_fuzzy: bool = True,
                              enable_vector: bool = False,
                              pure_vector: bool = False,
                              hybrid_weights: Optional[Dict[str, float]] = None) -> List[SearchResult]:
        """Search a single index database.

        Handles exceptions gracefully, returning empty list on failure.

        Args:
            index_path: Path to _index.db file
            query: FTS5 query string (for FTS) or natural language query (for vector)
            limit: Maximum results from this index
            files_only: If True, skip snippet generation for faster search
            include_semantic: If True, also search semantic keywords and merge results
            hybrid_mode: If True, use hybrid search with RRF fusion
            enable_fuzzy: Enable fuzzy FTS in hybrid mode
            enable_vector: Enable vector semantic search
            pure_vector: If True, only use vector search without FTS fallback
            hybrid_weights: Custom RRF weights for hybrid search

        Returns:
            List of SearchResult objects (empty on error)
        """
        try:
            # Use hybrid search if enabled
            if hybrid_mode:
                hybrid_engine = HybridSearchEngine(weights=hybrid_weights)
                fts_results = hybrid_engine.search(
                    index_path,
                    query,
                    limit=limit,
                    enable_fuzzy=enable_fuzzy,
                    enable_vector=enable_vector,
                    pure_vector=pure_vector,
                )
            else:
                # Single-FTS search (exact or fuzzy mode)
                with DirIndexStore(index_path) as store:
                    # Get FTS results
                    if files_only:
                        # Fast path: return paths only without snippets
                        paths = store.search_files_only(query, limit=limit)
                        fts_results = [SearchResult(path=p, score=0.0, excerpt="") for p in paths]
                    else:
                        # Use fuzzy FTS if enable_fuzzy=True (mode="fuzzy"), otherwise exact FTS
                        if enable_fuzzy:
                            fts_results = store.search_fts_fuzzy(
                                query, limit=limit, return_full_content=True
                            )
                        else:
                            fts_results = store.search_fts_exact(
                                query, limit=limit, return_full_content=True
                            )

                    # Optionally add semantic keyword results
                    if include_semantic:
                        try:
                            semantic_matches = store.search_semantic_keywords(query)
                            # Convert semantic matches to SearchResult with 0.8x weight
                            for file_entry, keywords in semantic_matches:
                                # Create excerpt from keywords
                                excerpt = f"Keywords: {', '.join(keywords[:5])}"
                                # Use a base score of 10.0 for semantic matches, weighted by 0.8
                                semantic_result = SearchResult(
                                    path=str(file_entry.full_path),
                                    score=10.0 * 0.8,
                                    excerpt=excerpt
                                )
                                fts_results.append(semantic_result)
                        except Exception as sem_exc:
                            self.logger.debug(f"Semantic search error in {index_path}: {sem_exc}")

            return fts_results
        except Exception as exc:
            self.logger.debug(f"Search error in {index_path}: {exc}")
            return []

    def _filter_by_extension(self, results: List[SearchResult],
                              code_only: bool = False,
                              exclude_extensions: Optional[List[str]] = None) -> List[SearchResult]:
        """Filter search results by file extension.

        Args:
            results: Search results to filter
            code_only: If True, exclude non-code files (md, txt, json, yaml, xml, etc.)
            exclude_extensions: List of extensions to exclude (e.g., ["md", "txt"])

        Returns:
            Filtered results
        """
        # Non-code file extensions (same as MCP tool smart-search.ts)
        NON_CODE_EXTENSIONS = {
            'md', 'txt', 'json', 'yaml', 'yml', 'xml', 'csv', 'log',
            'ini', 'cfg', 'conf', 'toml', 'env', 'properties',
            'html', 'htm', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp',
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
            'lock', 'sum', 'mod',
        }

        # Build exclusion set
        excluded_exts = set()
        if exclude_extensions:
            # Normalize extensions (remove leading dots, lowercase)
            excluded_exts = {ext.lower().lstrip('.') for ext in exclude_extensions}
        if code_only:
            excluded_exts.update(NON_CODE_EXTENSIONS)

        if not excluded_exts:
            return results

        # Filter results
        filtered = []
        for result in results:
            path_str = result.path
            if not path_str:
                continue

            # Extract extension from path
            if '.' in path_str:
                ext = path_str.rsplit('.', 1)[-1].lower()
                if ext in excluded_exts:
                    continue  # Skip this result

            filtered.append(result)

        return filtered

    def _merge_and_rank(self, results: List[SearchResult],
                         limit: int, offset: int = 0) -> List[SearchResult]:
        """Aggregate, deduplicate, and rank results.

        Process:
        1. Deduplicate by path (keep highest score)
        2. Sort by score descending
        3. Apply offset and limit for pagination

        Args:
            results: Raw results from all indexes
            limit: Maximum results to return
            offset: Number of results to skip (pagination offset)

        Returns:
            Deduplicated and ranked results with pagination
        """
        # Deduplicate by path, keeping best score
        path_to_result: Dict[str, SearchResult] = {}
        for result in results:
            path = result.path
            if path not in path_to_result or result.score > path_to_result[path].score:
                path_to_result[path] = result

        # Sort by score descending
        unique_results = list(path_to_result.values())
        unique_results.sort(key=lambda r: r.score, reverse=True)

        # Apply offset and limit for pagination
        return unique_results[offset:offset + limit]

    def _search_symbols_parallel(self, index_paths: List[Path],
                                  name: str,
                                  kind: Optional[str],
                                  limit: int) -> List[Symbol]:
        """Search symbols across multiple indexes in parallel.

        Args:
            index_paths: List of _index.db paths to search
            name: Symbol name pattern
            kind: Optional symbol kind filter
            limit: Total symbol limit

        Returns:
            Deduplicated and sorted symbols
        """
        all_symbols = []

        executor = self._get_executor()
        # Submit all symbol search tasks
        future_to_path = {
            executor.submit(
                self._search_symbols_single,
                idx_path,
                name,
                kind
            ): idx_path
            for idx_path in index_paths
        }

        # Collect results
        for future in as_completed(future_to_path):
            try:
                symbols = future.result()
                all_symbols.extend(symbols)
            except Exception as exc:
                self.logger.error(f"Symbol search failed: {exc}")

        # Deduplicate by (name, kind, range)
        seen = set()
        unique_symbols = []
        for sym in all_symbols:
            key = (sym.name, sym.kind, sym.range)
            if key not in seen:
                seen.add(key)
                unique_symbols.append(sym)

        # Sort by name
        unique_symbols.sort(key=lambda s: s.name)

        return unique_symbols[:limit]

    def _search_symbols_single(self, index_path: Path,
                                name: str,
                                kind: Optional[str]) -> List[Symbol]:
        """Search symbols in a single index.

        Args:
            index_path: Path to _index.db file
            name: Symbol name pattern
            kind: Optional symbol kind filter

        Returns:
            List of Symbol objects (empty on error)
        """
        try:
            with DirIndexStore(index_path) as store:
                return store.search_symbols(name, kind=kind)
        except Exception as exc:
            self.logger.debug(f"Symbol search error in {index_path}: {exc}")
            return []


# === Convenience Functions ===

def quick_search(query: str,
                 source_path: Path,
                 depth: int = -1) -> List[SearchResult]:
    """Quick search convenience function with automatic initialization.

    Creates temporary registry and mapper instances for one-off searches.
    For repeated searches, create a ChainSearchEngine instance directly.

    Args:
        query: FTS5 search query string
        source_path: Starting directory path
        depth: Maximum search depth (-1 = unlimited)

    Returns:
        List of SearchResult objects sorted by relevance

    Examples:
        >>> from pathlib import Path
        >>> results = quick_search("authentication", Path("D:/project/src"))
        >>> print(f"Found {len(results)} matches")
    """
    registry = RegistryStore()
    registry.initialize()

    mapper = PathMapper()

    with ChainSearchEngine(registry, mapper) as engine:
        options = SearchOptions(depth=depth)
        result = engine.search(query, source_path, options)

    registry.close()

    return result.results
