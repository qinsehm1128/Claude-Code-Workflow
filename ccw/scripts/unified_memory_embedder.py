#!/usr/bin/env python3
"""
Unified Memory Embedder - Bridge CCW to CodexLens VectorStore (HNSW)

Uses CodexLens VectorStore for HNSW-indexed vector storage and search,
replacing full-table-scan cosine similarity with sub-10ms approximate
nearest neighbor lookups.

Protocol: JSON via stdin/stdout
Operations: embed, search, search_by_vector, status, reindex

Usage:
    echo '{"operation":"embed","store_path":"...","chunks":[...]}' | python unified_memory_embedder.py
    echo '{"operation":"search","store_path":"...","query":"..."}' | python unified_memory_embedder.py
    echo '{"operation":"status","store_path":"..."}' | python unified_memory_embedder.py
    echo '{"operation":"reindex","store_path":"..."}' | python unified_memory_embedder.py
"""

import json
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

try:
    import numpy as np
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "numpy is required. Install with: pip install numpy"
    }))
    sys.exit(1)

try:
    from codexlens.semantic.factory import get_embedder, clear_embedder_cache
    from codexlens.semantic.vector_store import VectorStore
    from codexlens.entities import SemanticChunk
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "CodexLens not found. Install with: pip install codex-lens[semantic]"
    }))
    sys.exit(1)


# Valid category values for filtering
VALID_CATEGORIES = {"core_memory", "cli_history", "workflow", "entity", "pattern"}


class UnifiedMemoryEmbedder:
    """Unified embedder backed by CodexLens VectorStore (HNSW)."""

    def __init__(self, store_path: str):
        """
        Initialize with path to VectorStore database directory.

        Args:
            store_path: Directory containing vectors.db and vectors.hnsw
        """
        self.store_path = Path(store_path)
        self.store_path.mkdir(parents=True, exist_ok=True)

        db_path = str(self.store_path / "vectors.db")
        self.store = VectorStore(db_path)

        # Lazy-load embedder to avoid ~0.8s model loading for status command
        self._embedder = None

    @property
    def embedder(self):
        """Lazy-load the embedder on first access."""
        if self._embedder is None:
            self._embedder = get_embedder(
                backend="fastembed",
                profile="code",
                use_gpu=True
            )
        return self._embedder

    def embed(self, chunks: List[Dict[str, Any]], batch_size: int = 8) -> Dict[str, Any]:
        """
        Embed chunks and insert into VectorStore.

        Each chunk dict must contain:
          - content: str
          - source_id: str
          - source_type: str (e.g. "core_memory", "workflow", "cli_history")
          - category: str (e.g. "core_memory", "cli_history", "workflow", "entity", "pattern")

        Optional fields:
          - chunk_index: int (default 0)
          - metadata: dict (additional metadata)

        Args:
            chunks: List of chunk dicts to embed
            batch_size: Number of chunks to embed per batch

        Returns:
            Result dict with success, chunks_processed, chunks_failed, elapsed_time
        """
        start_time = time.time()
        chunks_processed = 0
        chunks_failed = 0

        if not chunks:
            return {
                "success": True,
                "chunks_processed": 0,
                "chunks_failed": 0,
                "elapsed_time": 0.0
            }

        # Process in batches
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            texts = [c["content"] for c in batch]

            try:
                # Batch embed
                embeddings = self.embedder.embed_to_numpy(texts)

                # Build SemanticChunks and insert
                semantic_chunks = []
                for j, chunk_data in enumerate(batch):
                    category = chunk_data.get("category", chunk_data.get("source_type", "core_memory"))
                    source_id = chunk_data.get("source_id", "")
                    chunk_index = chunk_data.get("chunk_index", 0)
                    extra_meta = chunk_data.get("metadata", {})

                    # Build metadata dict for VectorStore
                    metadata = {
                        "source_id": source_id,
                        "source_type": chunk_data.get("source_type", ""),
                        "chunk_index": chunk_index,
                        **extra_meta
                    }

                    sc = SemanticChunk(
                        content=chunk_data["content"],
                        embedding=embeddings[j].tolist(),
                        metadata=metadata
                    )
                    semantic_chunks.append((sc, source_id, category))

                # Insert into VectorStore
                for sc, file_path, category in semantic_chunks:
                    try:
                        self.store.add_chunk(sc, file_path=file_path, category=category)
                        chunks_processed += 1
                    except Exception as e:
                        print(f"Error inserting chunk: {e}", file=sys.stderr)
                        chunks_failed += 1

            except Exception as e:
                print(f"Error embedding batch starting at {i}: {e}", file=sys.stderr)
                chunks_failed += len(batch)

        elapsed_time = time.time() - start_time

        return {
            "success": chunks_failed == 0,
            "chunks_processed": chunks_processed,
            "chunks_failed": chunks_failed,
            "elapsed_time": round(elapsed_time, 3)
        }

    def search(
        self,
        query: str,
        top_k: int = 10,
        min_score: float = 0.3,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search VectorStore using HNSW index.

        Args:
            query: Search query text
            top_k: Number of results
            min_score: Minimum similarity threshold
            category: Optional category filter

        Returns:
            Result dict with success and matches list
        """
        try:
            start_time = time.time()

            # Generate query embedding (embed_to_numpy accepts single string)
            query_emb = self.embedder.embed_to_numpy(query)[0].tolist()

            # Search via VectorStore HNSW
            results = self.store.search_similar(
                query_emb,
                top_k=top_k,
                min_score=min_score,
                category=category
            )

            elapsed_time = time.time() - start_time

            matches = []
            for result in results:
                meta = result.metadata if result.metadata else {}
                if isinstance(meta, str):
                    try:
                        meta = json.loads(meta)
                    except (json.JSONDecodeError, TypeError):
                        meta = {}

                matches.append({
                    "content": result.content or result.excerpt or "",
                    "score": round(float(result.score), 4),
                    "source_id": meta.get("source_id", result.path or ""),
                    "source_type": meta.get("source_type", ""),
                    "chunk_index": meta.get("chunk_index", 0),
                    "category": meta.get("category", ""),
                    "metadata": meta
                })

            return {
                "success": True,
                "matches": matches,
                "elapsed_time": round(elapsed_time, 3),
                "total_searched": len(results)
            }

        except Exception as e:
            return {
                "success": False,
                "matches": [],
                "error": str(e)
            }

    def search_by_vector(
        self,
        vector: List[float],
        top_k: int = 10,
        min_score: float = 0.3,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search VectorStore using a pre-computed embedding vector (no re-embedding).

        Args:
            vector: Pre-computed embedding vector (list of floats)
            top_k: Number of results
            min_score: Minimum similarity threshold
            category: Optional category filter

        Returns:
            Result dict with success and matches list
        """
        try:
            start_time = time.time()

            # Search via VectorStore HNSW directly with provided vector
            results = self.store.search_similar(
                vector,
                top_k=top_k,
                min_score=min_score,
                category=category
            )

            elapsed_time = time.time() - start_time

            matches = []
            for result in results:
                meta = result.metadata if result.metadata else {}
                if isinstance(meta, str):
                    try:
                        meta = json.loads(meta)
                    except (json.JSONDecodeError, TypeError):
                        meta = {}

                matches.append({
                    "content": result.content or result.excerpt or "",
                    "score": round(float(result.score), 4),
                    "source_id": meta.get("source_id", result.path or ""),
                    "source_type": meta.get("source_type", ""),
                    "chunk_index": meta.get("chunk_index", 0),
                    "category": meta.get("category", ""),
                    "metadata": meta
                })

            return {
                "success": True,
                "matches": matches,
                "elapsed_time": round(elapsed_time, 3),
                "total_searched": len(results)
            }

        except Exception as e:
            return {
                "success": False,
                "matches": [],
                "error": str(e)
            }

    def status(self) -> Dict[str, Any]:
        """
        Get VectorStore index status.

        Returns:
            Status dict with total_chunks, hnsw_available, dimension, etc.
        """
        try:
            total_chunks = self.store.count_chunks()
            hnsw_available = self.store.ann_available
            hnsw_count = self.store.ann_count
            dimension = self.store.dimension or 768

            # Count per category from SQLite
            categories = {}
            try:
                import sqlite3
                db_path = str(self.store_path / "vectors.db")
                with sqlite3.connect(db_path) as conn:
                    rows = conn.execute(
                        "SELECT category, COUNT(*) FROM semantic_chunks GROUP BY category"
                    ).fetchall()
                    for row in rows:
                        categories[row[0] or "unknown"] = row[1]
            except Exception:
                pass

            return {
                "success": True,
                "total_chunks": total_chunks,
                "hnsw_available": hnsw_available,
                "hnsw_count": hnsw_count,
                "dimension": dimension,
                "categories": categories,
                "model_config": {
                    "backend": "fastembed",
                    "profile": "code",
                    "dimension": 768,
                    "max_tokens": 8192
                }
            }

        except Exception as e:
            return {
                "success": False,
                "total_chunks": 0,
                "hnsw_available": False,
                "hnsw_count": 0,
                "dimension": 0,
                "error": str(e)
            }

    def reindex(self) -> Dict[str, Any]:
        """
        Rebuild HNSW index from scratch.

        Returns:
            Result dict with success and timing
        """
        try:
            start_time = time.time()

            self.store.rebuild_ann_index()

            elapsed_time = time.time() - start_time

            return {
                "success": True,
                "hnsw_count": self.store.ann_count,
                "elapsed_time": round(elapsed_time, 3)
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


def main():
    """Main entry point. Reads JSON from stdin, writes JSON to stdout."""
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({
                "success": False,
                "error": "No input provided. Send JSON via stdin."
            }))
            sys.exit(1)

        request = json.loads(raw_input)
    except json.JSONDecodeError as e:
        print(json.dumps({
            "success": False,
            "error": f"Invalid JSON input: {e}"
        }))
        sys.exit(1)

    operation = request.get("operation")
    store_path = request.get("store_path")

    if not operation:
        print(json.dumps({
            "success": False,
            "error": "Missing required field: operation"
        }))
        sys.exit(1)

    if not store_path:
        print(json.dumps({
            "success": False,
            "error": "Missing required field: store_path"
        }))
        sys.exit(1)

    try:
        embedder = UnifiedMemoryEmbedder(store_path)

        if operation == "embed":
            chunks = request.get("chunks", [])
            batch_size = request.get("batch_size", 8)
            result = embedder.embed(chunks, batch_size=batch_size)

        elif operation == "search":
            query = request.get("query", "")
            if not query:
                result = {"success": False, "error": "Missing required field: query", "matches": []}
            else:
                top_k = request.get("top_k", 10)
                min_score = request.get("min_score", 0.3)
                category = request.get("category")
                result = embedder.search(query, top_k=top_k, min_score=min_score, category=category)

        elif operation == "search_by_vector":
            vector = request.get("vector", [])
            if not vector:
                result = {"success": False, "error": "Missing required field: vector", "matches": []}
            else:
                top_k = request.get("top_k", 10)
                min_score = request.get("min_score", 0.3)
                category = request.get("category")
                result = embedder.search_by_vector(vector, top_k=top_k, min_score=min_score, category=category)

        elif operation == "status":
            result = embedder.status()

        elif operation == "reindex":
            result = embedder.reindex()

        else:
            result = {
                "success": False,
                "error": f"Unknown operation: {operation}. Valid: embed, search, search_by_vector, status, reindex"
            }

        print(json.dumps(result))

        # Clean up ONNX resources to ensure process can exit cleanly
        clear_embedder_cache()

    except Exception as e:
        try:
            clear_embedder_cache()
        except Exception:
            pass
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
