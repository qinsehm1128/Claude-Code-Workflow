"""Embedding Manager - Manage semantic embeddings for code indexes.

This module provides functions for generating and managing semantic embeddings
for code indexes, supporting both fastembed and litellm backends.

Example Usage:
    Generate embeddings for a single index:

    >>> from pathlib import Path
    >>> from codexlens.cli.embedding_manager import generate_embeddings
    >>> result = generate_embeddings(
    ...     index_path=Path("path/to/_index.db"),
    ...     force=True
    ... )
    >>> if result["success"]:
    ...     print(f"Generated {result['total_chunks_created']} embeddings")

    Generate embeddings for an entire project with centralized index:

    >>> from codexlens.cli.embedding_manager import generate_dense_embeddings_centralized
    >>> result = generate_dense_embeddings_centralized(
    ...     index_root=Path("path/to/project"),
    ...     force=True,
    ...     progress_callback=lambda msg: print(msg)
    ... )

    Check if embeddings exist:

    >>> from codexlens.cli.embedding_manager import check_index_embeddings
    >>> status = check_index_embeddings(Path("path/to/_index.db"))
    >>> print(status["result"]["has_embeddings"])

Backward Compatibility:
    The deprecated `discover_all_index_dbs()` function is maintained for compatibility.
    `generate_embeddings_recursive()` is deprecated but functional; use
    `generate_dense_embeddings_centralized()` instead.
    The `EMBEDDING_BATCH_SIZE` constant is kept as a reference but actual batch size
    is calculated dynamically via `calculate_dynamic_batch_size()`.
"""

import gc
import json
import logging
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from itertools import islice
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

try:
    from codexlens.semantic import SEMANTIC_AVAILABLE, is_embedding_backend_available
except ImportError:
    SEMANTIC_AVAILABLE = False
    def is_embedding_backend_available(_backend: str):  # type: ignore[no-redef]
        return False, "codexlens.semantic not available"

try:
    from codexlens.config import VECTORS_META_DB_NAME
except ImportError:
    VECTORS_META_DB_NAME = "_vectors_meta.db"

try:
    from codexlens.search.ranking import get_file_category
except ImportError:
    def get_file_category(path: str):  # type: ignore[no-redef]
        """Fallback: map common extensions to category."""
        ext = Path(path).suffix.lower()
        code_exts = {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".c", ".cpp", ".rs"}
        doc_exts = {".md", ".mdx", ".txt", ".rst"}
        if ext in code_exts:
            return "code"
        elif ext in doc_exts:
            return "doc"
        return None

logger = logging.getLogger(__name__)

# Embedding batch size - larger values improve throughput on modern hardware
# Benchmark: 256 gives ~2.35x speedup over 64 with DirectML GPU acceleration
EMBEDDING_BATCH_SIZE = 256


def calculate_dynamic_batch_size(config, embedder) -> int:
    """Calculate batch size dynamically based on model token capacity.

    This function computes an optimal batch size by considering:
    - Maximum chunk character size from parsing rules
    - Estimated tokens per chunk (chars / chars_per_token_estimate)
    - Model's maximum token capacity
    - Utilization factor (default 80% to leave headroom)

    Args:
        config: Config object with api_batch_size_* settings.
        embedder: Embedding model object with max_tokens property.

    Returns:
        int: Calculated batch size, clamped to [1, api_batch_size_max].
    """
    # If dynamic calculation is disabled, return static value
    if not getattr(config, 'api_batch_size_dynamic', False):
        return getattr(config, 'api_batch_size', 8)

    # Get maximum chunk character size from ALL parsing rules (not just default)
    # This ensures we use the worst-case chunk size across all languages
    parsing_rules = getattr(config, 'parsing_rules', {})
    all_max_chunk_chars = [
        rule.get('max_chunk_chars', 0)
        for rule in parsing_rules.values()
        if isinstance(rule, dict)
    ]
    max_chunk_chars = max(all_max_chunk_chars) if all_max_chunk_chars else 4000
    if max_chunk_chars <= 0:
        max_chunk_chars = 4000  # Final fallback

    # Get characters per token estimate
    chars_per_token = getattr(config, 'chars_per_token_estimate', 4)
    if chars_per_token <= 0:
        chars_per_token = 4  # Safe default

    # Estimate tokens per chunk
    estimated_tokens_per_chunk = max_chunk_chars / chars_per_token

    # Prevent division by zero
    if estimated_tokens_per_chunk <= 0:
        return getattr(config, 'api_batch_size', 8)

    # Get model's maximum token capacity
    model_max_tokens = getattr(embedder, 'max_tokens', 8192)

    # Get utilization factor (default 80%, max 95% to leave safety margin)
    utilization_factor = getattr(config, 'api_batch_size_utilization_factor', 0.8)
    if utilization_factor <= 0 or utilization_factor > 0.95:
        if utilization_factor > 0.95:
            logger.warning(
                "Utilization factor %.2f exceeds safe limit 0.95. "
                "Token estimation is approximate, high values risk API errors. "
                "Clamping to 0.95.",
                utilization_factor
            )
            utilization_factor = 0.95
        else:
            utilization_factor = 0.8

    # Calculate safe token limit
    safe_token_limit = model_max_tokens * utilization_factor

    # Calculate dynamic batch size
    dynamic_batch_size = int(safe_token_limit / estimated_tokens_per_chunk)

    # Get maximum batch size limit
    batch_size_max = getattr(config, 'api_batch_size_max', 2048)

    # Clamp to [1, batch_size_max]
    result = max(1, min(dynamic_batch_size, batch_size_max))

    logger.debug(
        "Dynamic batch size calculated: %d (max_chunk_chars=%d, chars_per_token=%d, "
        "model_max_tokens=%d, utilization=%.1f%%, limit=%d)",
        result, max_chunk_chars, chars_per_token, model_max_tokens,
        utilization_factor * 100, batch_size_max
    )

    return result


def _build_categories_from_batch(chunk_batch: List[Tuple[Any, str]]) -> List[str]:
    """Build categories list from chunk batch for index-level category filtering.

    Args:
        chunk_batch: List of (chunk, file_path) tuples

    Returns:
        List of category strings ('code' or 'doc'), defaulting to 'code' for unknown
    """
    categories = []
    for _, file_path in chunk_batch:
        cat = get_file_category(file_path)
        categories.append(cat if cat else "code")  # Default to 'code' for unknown extensions
    return categories


def _cleanup_fastembed_resources() -> None:
    """Best-effort cleanup for fastembed/ONNX resources (no-op for other backends)."""
    try:
        from codexlens.semantic.embedder import clear_embedder_cache
        clear_embedder_cache()
    except (ImportError, AttributeError):
        # Expected when semantic module unavailable or cache function doesn't exist
        pass
    except Exception as exc:
        # Log unexpected errors but don't fail cleanup
        logger.debug(f"Unexpected error during fastembed cleanup: {exc}")


def _generate_chunks_from_cursor(
    cursor,
    chunker,
    path_column: str,
    file_batch_size: int,
    failed_files: List[Tuple[str, str]],
) -> Generator[Tuple, None, Tuple[int, int]]:
    """Generator that yields chunks from database cursor in a streaming fashion.

    This avoids loading all chunks into memory at once, significantly reducing
    peak memory usage for large codebases.

    Args:
        cursor: SQLite cursor with file data
        chunker: Chunker instance for splitting files
        path_column: Column name for file path
        file_batch_size: Number of files to fetch at a time
        failed_files: List to append failed files to

    Yields:
        (chunk, file_path) tuples

    Returns:
        (total_files_processed, batch_count) after iteration completes
    """
    total_files = 0
    batch_count = 0

    while True:
        file_batch = cursor.fetchmany(file_batch_size)
        if not file_batch:
            break

        batch_count += 1

        for file_row in file_batch:
            file_path = file_row[path_column]
            content = file_row["content"]
            language = file_row["language"] or "python"

            try:
                chunks = chunker.chunk_sliding_window(
                    content,
                    file_path=file_path,
                    language=language
                )
                if chunks:
                    total_files += 1
                    for chunk in chunks:
                        yield (chunk, file_path)
            except (OSError, UnicodeDecodeError) as e:
                # File access or encoding errors
                logger.error(f"Failed to read file {file_path}: {e}")
                failed_files.append((file_path, f"File read error: {e}"))
            except ValueError as e:
                # Chunking configuration errors
                logger.error(f"Chunking config error for {file_path}: {e}")
                failed_files.append((file_path, f"Chunking error: {e}"))
            except Exception as e:
                # Other unexpected errors
                logger.error(f"Unexpected error processing {file_path}: {e}")
                failed_files.append((file_path, f"Unexpected error: {e}"))


def _create_token_aware_batches(
    chunk_generator: Generator,
    max_tokens_per_batch: int = 8000,
) -> Generator[List[Tuple], None, None]:
    """Group chunks by total token count instead of fixed count.

    Uses fast token estimation (len(content) // 4) for efficiency.
    Yields batches when approaching the token limit.

    Args:
        chunk_generator: Generator yielding (chunk, file_path) tuples
        max_tokens_per_batch: Maximum tokens per batch (default: 8000)

    Yields:
        List of (chunk, file_path) tuples representing a batch
    """
    current_batch = []
    current_tokens = 0

    for chunk, file_path in chunk_generator:
        # Fast token estimation: len(content) // 4
        chunk_tokens = len(chunk.content) // 4

        # If adding this chunk would exceed limit and we have items, yield current batch
        if current_tokens + chunk_tokens > max_tokens_per_batch and current_batch:
            yield current_batch
            current_batch = []
            current_tokens = 0

        # Add chunk to current batch
        current_batch.append((chunk, file_path))
        current_tokens += chunk_tokens

    # Yield final batch if not empty
    if current_batch:
        yield current_batch


def _get_path_column(conn: sqlite3.Connection) -> str:
    """Detect whether files table uses 'path' or 'full_path' column.

    Args:
        conn: SQLite connection to the index database

    Returns:
        Column name ('path' or 'full_path')

    Raises:
        ValueError: If neither column exists in files table
    """
    cursor = conn.execute("PRAGMA table_info(files)")
    columns = {row[1] for row in cursor.fetchall()}
    if 'full_path' in columns:
        return 'full_path'
    elif 'path' in columns:
        return 'path'
    raise ValueError("files table has neither 'path' nor 'full_path' column")


def check_index_embeddings(index_path: Path) -> Dict[str, any]:
    """Check if an index has embeddings and return statistics.

    Args:
        index_path: Path to _index.db file

    Returns:
        Dictionary with embedding statistics and status
    """
    if not index_path.exists():
        return {
            "success": False,
            "error": f"Index not found: {index_path}",
        }

    try:
        with sqlite3.connect(index_path) as conn:
            # Check if semantic_chunks table exists
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='semantic_chunks'"
            )
            table_exists = cursor.fetchone() is not None

            if not table_exists:
                # Count total indexed files even without embeddings
                cursor = conn.execute("SELECT COUNT(*) FROM files")
                total_files = cursor.fetchone()[0]

                return {
                    "success": True,
                    "result": {
                        "has_embeddings": False,
                        "total_chunks": 0,
                        "total_files": total_files,
                        "files_with_chunks": 0,
                        "files_without_chunks": total_files,
                        "coverage_percent": 0.0,
                        "missing_files_sample": [],
                        "index_path": str(index_path),
                    },
                }

            # Count total chunks
            cursor = conn.execute("SELECT COUNT(*) FROM semantic_chunks")
            total_chunks = cursor.fetchone()[0]

            # Count total indexed files
            cursor = conn.execute("SELECT COUNT(*) FROM files")
            total_files = cursor.fetchone()[0]

            # Count files with embeddings
            cursor = conn.execute(
                "SELECT COUNT(DISTINCT file_path) FROM semantic_chunks"
            )
            files_with_chunks = cursor.fetchone()[0]

            # Get a sample of files without embeddings
            path_column = _get_path_column(conn)
            cursor = conn.execute(f"""
                SELECT {path_column}
                FROM files
                WHERE {path_column} NOT IN (
                    SELECT DISTINCT file_path FROM semantic_chunks
                )
                LIMIT 5
            """)
            missing_files = [row[0] for row in cursor.fetchall()]

            return {
                "success": True,
                "result": {
                    "has_embeddings": total_chunks > 0,
                    "total_chunks": total_chunks,
                    "total_files": total_files,
                    "files_with_chunks": files_with_chunks,
                    "files_without_chunks": total_files - files_with_chunks,
                    "coverage_percent": round((files_with_chunks / total_files * 100) if total_files > 0 else 0, 1),
                    "missing_files_sample": missing_files,
                    "index_path": str(index_path),
                },
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to check embeddings: {str(e)}",
        }


def _get_embedding_defaults() -> tuple[str, str, bool, List, str, float]:
    """Get default embedding settings from config.

    Returns:
        Tuple of (backend, model, use_gpu, endpoints, strategy, cooldown)
    """
    try:
        from codexlens.config import Config
        config = Config.load()
        return (
            config.embedding_backend,
            config.embedding_model,
            config.embedding_use_gpu,
            config.embedding_endpoints,
            config.embedding_strategy,
            config.embedding_cooldown,
        )
    except (ImportError, AttributeError, OSError, ValueError) as exc:
        # Config not available or malformed - use defaults
        logger.debug(f"Using default embedding config (config load failed): {exc}")
        return "fastembed", "code", True, [], "latency_aware", 60.0
    except Exception as exc:
        # Unexpected error - still use defaults but log
        logger.warning(f"Unexpected error loading embedding config: {exc}")
        return "fastembed", "code", True, [], "latency_aware", 60.0


def _apply_embedding_config_defaults(
    embedding_backend: Optional[str],
    model_profile: Optional[str],
    use_gpu: Optional[bool],
    endpoints: Optional[List],
    strategy: Optional[str],
    cooldown: Optional[float],
) -> tuple[str, str, bool, List, str, float]:
    """Apply config defaults to embedding parameters.

    This helper function reduces code duplication across embedding generation
    functions by centralizing the default value application logic.

    Args:
        embedding_backend: Embedding backend (fastembed/litellm) or None for default
        model_profile: Model profile/name or None for default
        use_gpu: GPU flag or None for default
        endpoints: API endpoints list or None for default
        strategy: Selection strategy or None for default
        cooldown: Cooldown seconds or None for default

    Returns:
        Tuple of (backend, model, use_gpu, endpoints, strategy, cooldown) with
        defaults applied where None was passed.
    """
    (default_backend, default_model, default_gpu,
     default_endpoints, default_strategy, default_cooldown) = _get_embedding_defaults()

    backend = embedding_backend if embedding_backend is not None else default_backend
    model = model_profile if model_profile is not None else default_model
    gpu = use_gpu if use_gpu is not None else default_gpu
    eps = endpoints if endpoints is not None else default_endpoints
    strat = strategy if strategy is not None else default_strategy
    cool = cooldown if cooldown is not None else default_cooldown

    return backend, model, gpu, eps, strat, cool


def _calculate_max_workers(
    embedding_backend: str,
    endpoints: Optional[List],
    max_workers: Optional[int],
) -> int:
    """Calculate optimal max_workers based on backend and endpoint count.

    Args:
        embedding_backend: The embedding backend being used
        endpoints: List of API endpoints (for litellm multi-endpoint mode)
        max_workers: Explicitly specified max_workers or None for auto-calculation

    Returns:
        Calculated or specified max_workers value
    """
    if max_workers is not None:
        return max_workers

    endpoint_count = len(endpoints) if endpoints else 1

    # Set dynamic max_workers default based on backend type and endpoint count
    # - FastEmbed: CPU-bound, sequential is optimal (1 worker)
    # - LiteLLM single endpoint: 4 workers default
    # - LiteLLM multi-endpoint: workers = endpoint_count * 2 (to saturate all APIs)
    if embedding_backend == "litellm":
        if endpoint_count > 1:
            return endpoint_count * 2  # No cap, scale with endpoints
        else:
            return 4
    else:
        return 1


def _initialize_embedder_and_chunker(
    embedding_backend: str,
    model_profile: str,
    use_gpu: bool,
    endpoints: Optional[List],
    strategy: str,
    cooldown: float,
    chunk_size: int,
    overlap: int,
) -> tuple:
    """Initialize embedder and chunker for embedding generation.

    This helper function reduces code duplication by centralizing embedder
    and chunker initialization logic.

    Args:
        embedding_backend: The embedding backend (fastembed/litellm)
        model_profile: Model profile or name
        use_gpu: Whether to use GPU acceleration
        endpoints: Optional API endpoints for load balancing
        strategy: Selection strategy for multi-endpoint mode
        cooldown: Cooldown seconds for rate-limited endpoints
        chunk_size: Maximum chunk size in characters
        overlap: Overlap size in characters

    Returns:
        Tuple of (embedder, chunker, endpoint_count)

    Raises:
        ValueError: If embedding_backend is invalid
    """
    from codexlens.semantic.factory import get_embedder as get_embedder_factory
    from codexlens.semantic.chunker import Chunker, ChunkConfig
    from codexlens.config import Config

    # Initialize embedder using factory (supports fastembed, litellm, and rotational)
    # For fastembed: model_profile is a profile name (fast/code/multilingual/balanced)
    # For litellm: model_profile is a model name (e.g., qwen3-embedding)
    # For multi-endpoint: endpoints list enables load balancing
    if embedding_backend == "fastembed":
        embedder = get_embedder_factory(backend="fastembed", profile=model_profile, use_gpu=use_gpu)
    elif embedding_backend == "litellm":
        embedder = get_embedder_factory(
            backend="litellm",
            model=model_profile,
            endpoints=endpoints if endpoints else None,
            strategy=strategy,
            cooldown=cooldown,
        )
    else:
        raise ValueError(f"Invalid embedding backend: {embedding_backend}. Must be 'fastembed' or 'litellm'.")

    # skip_token_count=True: Use fast estimation (len/4) instead of expensive tiktoken
    # This significantly reduces CPU usage with minimal impact on metadata accuracy
    # Load chunk stripping config from settings
    chunk_cfg = Config.load()
    chunker = Chunker(config=ChunkConfig(
        max_chunk_size=chunk_size,
        overlap=overlap,
        skip_token_count=True,
        strip_comments=getattr(chunk_cfg, 'chunk_strip_comments', True),
        strip_docstrings=getattr(chunk_cfg, 'chunk_strip_docstrings', True),
    ))

    endpoint_count = len(endpoints) if endpoints else 1
    return embedder, chunker, endpoint_count


def generate_embeddings(
    index_path: Path,
    embedding_backend: Optional[str] = None,
    model_profile: Optional[str] = None,
    force: bool = False,
    chunk_size: int = 2000,
    overlap: int = 200,
    progress_callback: Optional[callable] = None,
    use_gpu: Optional[bool] = None,
    max_tokens_per_batch: Optional[int] = None,
    max_workers: Optional[int] = None,
    endpoints: Optional[List] = None,
    strategy: Optional[str] = None,
    cooldown: Optional[float] = None,
) -> Dict[str, any]:
    """Generate embeddings for an index using memory-efficient batch processing.

    This function processes files in small batches to keep memory usage under 2GB,
    regardless of the total project size. Supports concurrent API calls for
    LiteLLM backend to improve throughput.

    Args:
        index_path: Path to _index.db file.
        embedding_backend: Embedding backend to use (fastembed or litellm).
                          Defaults to config setting.
        model_profile: Model profile for fastembed (fast, code, multilingual, balanced)
                      or model name for litellm (e.g., qwen3-embedding).
                      Defaults to config setting.
        force: If True, regenerate even if embeddings exist.
        chunk_size: Maximum chunk size in characters.
        overlap: Overlap size in characters for sliding window chunking (default: 200).
        progress_callback: Optional callback for progress updates.
        use_gpu: Whether to use GPU acceleration (fastembed only).
                Defaults to config setting.
        max_tokens_per_batch: Maximum tokens per batch for token-aware batching.
                             If None, attempts to get from embedder.max_tokens,
                             then falls back to 8000. If set, overrides automatic detection.
        max_workers: Maximum number of concurrent API calls.
                    If None, uses dynamic defaults based on backend and endpoint count.
        endpoints: Optional list of endpoint configurations for multi-API load balancing.
                  Each dict has keys: model, api_key, api_base, weight.
        strategy: Selection strategy for multi-endpoint mode (round_robin, latency_aware).
        cooldown: Default cooldown seconds for rate-limited endpoints.

    Returns:
        Dict[str, any]: Result dictionary with generation statistics.
            Contains keys: success, error (if failed), files_processed,
            total_chunks_created, execution_time, etc.

    Raises:
        ValueError: If embedding_backend is invalid.
        ImportError: If semantic module is not available.
    """
    # Apply config defaults
    embedding_backend, model_profile, use_gpu, endpoints, strategy, cooldown = \
        _apply_embedding_config_defaults(
            embedding_backend, model_profile, use_gpu, endpoints, strategy, cooldown
        )

    # Calculate max_workers
    max_workers = _calculate_max_workers(embedding_backend, endpoints, max_workers)

    backend_available, backend_error = is_embedding_backend_available(embedding_backend)
    if not backend_available:
        return {"success": False, "error": backend_error or "Embedding backend not available"}

    if not index_path.exists():
        return {
            "success": False,
            "error": f"Index not found: {index_path}",
        }

    # Check existing chunks
    status = check_index_embeddings(index_path)
    if not status["success"]:
        return status

    existing_chunks = status["result"]["total_chunks"]

    if existing_chunks > 0 and not force:
        return {
            "success": False,
            "error": f"Index already has {existing_chunks} chunks. Use --force to regenerate.",
            "existing_chunks": existing_chunks,
        }

    if force and existing_chunks > 0:
        if progress_callback:
            progress_callback(f"Clearing {existing_chunks} existing chunks...")

        try:
            with sqlite3.connect(index_path) as conn:
                conn.execute("DELETE FROM semantic_chunks")
                conn.commit()
        except sqlite3.DatabaseError as e:
            return {
                "success": False,
                "error": f"Database error clearing chunks: {str(e)}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to clear existing chunks: {str(e)}",
            }

    # Initialize embedder and chunker using helper
    try:
        embedder, chunker, endpoint_count = _initialize_embedder_and_chunker(
            embedding_backend, model_profile, use_gpu, endpoints, strategy, cooldown,
            chunk_size, overlap
        )

        # Log embedder info with endpoint count for multi-endpoint mode
        if progress_callback:
            if endpoint_count > 1:
                progress_callback(f"Using {endpoint_count} API endpoints with {strategy} strategy")
            progress_callback(f"Using model: {embedder.model_name} ({embedder.embedding_dim} dimensions)")

        # Calculate dynamic batch size based on model capacity
        from codexlens.config import Config
        batch_config = Config.load()
        effective_batch_size = calculate_dynamic_batch_size(batch_config, embedder)

        if progress_callback and batch_config.api_batch_size_dynamic:
            progress_callback(f"Dynamic batch size: {effective_batch_size} (model max_tokens={getattr(embedder, 'max_tokens', 8192)})")

    except (ImportError, ValueError) as e:
        # Missing dependency or invalid configuration
        return {
            "success": False,
            "error": f"Failed to initialize embedding components: {str(e)}",
        }
    except Exception as e:
        # Other unexpected errors
        return {
            "success": False,
            "error": f"Unexpected error initializing components: {str(e)}",
        }

    # --- STREAMING PROCESSING ---
    # Process files in batches to control memory usage
    start_time = time.time()
    failed_files = []
    total_chunks_created = 0
    total_files_processed = 0
    FILE_BATCH_SIZE = 100  # Process 100 files at a time
    # effective_batch_size is calculated above (dynamic or EMBEDDING_BATCH_SIZE fallback)

    try:
        with VectorStore(index_path) as vector_store:
            # Check model compatibility with existing embeddings
            if not force:
                is_compatible, warning = vector_store.check_model_compatibility(
                    model_profile, embedder.model_name, embedder.embedding_dim
                )
                if not is_compatible:
                    return {
                        "success": False,
                        "error": warning,
                    }

            # Set/update model configuration for this index
            vector_store.set_model_config(
                model_profile, embedder.model_name, embedder.embedding_dim, backend=embedding_backend
            )
            # Use bulk insert mode for efficient batch ANN index building
            # This defers ANN updates until end_bulk_insert() is called
            with vector_store.bulk_insert():
                with sqlite3.connect(index_path) as conn:
                    conn.row_factory = sqlite3.Row
                    path_column = _get_path_column(conn)

                    # Get total file count for progress reporting
                    total_files = conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]
                    if total_files == 0:
                        return {"success": False, "error": "No files found in index"}

                    if progress_callback:
                        # Format must match Node.js parseProgressLine: "Processing N files" with 'embed' keyword
                        progress_callback(f"Processing {total_files} files for embeddings in batches of {FILE_BATCH_SIZE}...")

                    cursor = conn.execute(f"SELECT {path_column}, content, language FROM files")

                    # --- STREAMING GENERATOR APPROACH ---
                    # Instead of accumulating all chunks from 100 files, we use a generator
                    # that yields chunks on-demand, keeping memory usage low and constant.
                    chunk_generator = _generate_chunks_from_cursor(
                        cursor, chunker, path_column, FILE_BATCH_SIZE, failed_files
                    )

                    # Determine max tokens per batch
                    # Priority: explicit parameter > embedder.max_tokens > default 8000
                    if max_tokens_per_batch is None:
                        max_tokens_per_batch = getattr(embedder, 'max_tokens', 8000)

                    # Create token-aware batches or fall back to fixed-size batching
                    if max_tokens_per_batch:
                        batch_generator = _create_token_aware_batches(
                            chunk_generator, max_tokens_per_batch
                        )
                    else:
                        # Fallback to fixed-size batching for backward compatibility
                        def fixed_size_batches():
                            while True:
                                batch = list(islice(chunk_generator, effective_batch_size))
                                if not batch:
                                    break
                                yield batch
                        batch_generator = fixed_size_batches()

                    batch_number = 0
                    files_seen = set()

                    def compute_embeddings_only(batch_data: Tuple[int, List[Tuple]]):
                        """Compute embeddings for a batch (no DB write) with retry logic.

                        Args:
                            batch_data: Tuple of (batch_number, chunk_batch)

                        Returns:
                            Tuple of (batch_num, chunk_batch, embeddings_numpy, batch_files, error)
                        """
                        import random

                        batch_num, chunk_batch = batch_data
                        batch_files = set()
                        for _, file_path in chunk_batch:
                            batch_files.add(file_path)

                        max_retries = 5
                        base_delay = 2.0

                        for attempt in range(max_retries + 1):
                            try:
                                batch_contents = [chunk.content for chunk, _ in chunk_batch]
                                embeddings_numpy = embedder.embed_to_numpy(batch_contents, batch_size=effective_batch_size)
                                return batch_num, chunk_batch, embeddings_numpy, batch_files, None

                            except Exception as e:
                                error_str = str(e).lower()
                                # Check for retryable errors (rate limit, connection, backend issues)
                                # Note: Some backends (e.g., ModelScope) return 400 with nested 500 errors
                                is_retryable = any(x in error_str for x in [
                                    "429", "rate limit", "connection", "timeout",
                                    "502", "503", "504", "service unavailable",
                                    "500", "400", "badrequesterror", "internal server error",
                                    "11434"  # Ollama port - indicates backend routing issue
                                ])

                                if attempt < max_retries and is_retryable:
                                    sleep_time = base_delay * (2 ** attempt) + random.uniform(0, 0.5)
                                    logger.warning(f"Batch {batch_num} failed (attempt {attempt+1}/{max_retries+1}). "
                                                   f"Retrying in {sleep_time:.1f}s. Error: {e}")
                                    time.sleep(sleep_time)
                                    continue

                                error_msg = f"Batch {batch_num}: {str(e)}"
                                logger.error(f"Failed to compute embeddings for batch {batch_num}: {str(e)}")
                                return batch_num, chunk_batch, None, batch_files, error_msg

                        # Should not reach here, but just in case
                        return batch_num, chunk_batch, None, batch_files, f"Batch {batch_num}: Max retries exceeded"

                    # Process batches based on max_workers setting
                    if max_workers <= 1:
                        # Sequential processing - stream directly from generator (no pre-materialization)
                        for chunk_batch in batch_generator:
                            batch_number += 1

                            # Track files in this batch
                            batch_files = set()
                            for _, file_path in chunk_batch:
                                batch_files.add(file_path)

                            # Retry logic for transient backend errors
                            max_retries = 5
                            base_delay = 2.0
                            success = False

                            for attempt in range(max_retries + 1):
                                try:
                                    # Generate embeddings
                                    batch_contents = [chunk.content for chunk, _ in chunk_batch]
                                    embeddings_numpy = embedder.embed_to_numpy(batch_contents, batch_size=effective_batch_size)

                                    # Store embeddings with category
                                    categories = _build_categories_from_batch(chunk_batch)
                                    vector_store.add_chunks_batch_numpy(chunk_batch, embeddings_numpy, categories=categories)

                                    files_seen.update(batch_files)
                                    total_chunks_created += len(chunk_batch)
                                    total_files_processed = len(files_seen)
                                    success = True
                                    break

                                except Exception as e:
                                    error_str = str(e).lower()
                                    # Check for retryable errors (rate limit, connection, backend issues)
                                    is_retryable = any(x in error_str for x in [
                                        "429", "rate limit", "connection", "timeout",
                                        "502", "503", "504", "service unavailable",
                                        "500", "400", "badrequesterror", "internal server error",
                                        "11434"  # Ollama port - indicates backend routing issue
                                    ])

                                    if attempt < max_retries and is_retryable:
                                        import random
                                        sleep_time = base_delay * (2 ** attempt) + random.uniform(0, 0.5)
                                        logger.warning(f"Batch {batch_number} failed (attempt {attempt+1}/{max_retries+1}). "
                                                       f"Retrying in {sleep_time:.1f}s. Error: {e}")
                                        time.sleep(sleep_time)
                                        continue

                                    logger.error(f"Failed to process batch {batch_number}: {str(e)}")
                                    files_seen.update(batch_files)
                                    break

                            if success and progress_callback and batch_number % 10 == 0:
                                progress_callback(f"  Batch {batch_number}: {total_chunks_created} chunks, {total_files_processed} files")
                    else:
                        # Concurrent processing - main thread iterates batches (SQLite safe),
                        # workers compute embeddings (parallel), main thread writes to DB (serial)
                        if progress_callback:
                            progress_callback(f"Processing with {max_workers} concurrent embedding workers...")

                        with ThreadPoolExecutor(max_workers=max_workers) as executor:
                            pending_futures = {}  # future -> (batch_num, chunk_batch)
                            completed_batches = 0
                            last_reported_batch = 0

                            def process_completed_futures():
                                """Process any completed futures and write to DB."""
                                nonlocal total_chunks_created, total_files_processed, completed_batches, last_reported_batch
                                done_futures = [f for f in pending_futures if f.done()]
                                for f in done_futures:
                                    try:
                                        batch_num, chunk_batch, embeddings_numpy, batch_files, error = f.result()
                                        if embeddings_numpy is not None and error is None:
                                            # Write to DB in main thread (no contention)
                                            categories = _build_categories_from_batch(chunk_batch)
                                            vector_store.add_chunks_batch_numpy(chunk_batch, embeddings_numpy, categories=categories)
                                            total_chunks_created += len(chunk_batch)
                                        files_seen.update(batch_files)
                                        total_files_processed = len(files_seen)
                                        completed_batches += 1
                                    except Exception as e:
                                        logger.error(f"Future raised exception: {e}")
                                        completed_batches += 1
                                    del pending_futures[f]

                                # Report progress based on completed batches (every 5 batches)
                                if progress_callback and completed_batches >= last_reported_batch + 5:
                                    progress_callback(f"  Batch {completed_batches}: {total_chunks_created} chunks, {total_files_processed} files")
                                    last_reported_batch = completed_batches

                            # Iterate batches in main thread (SQLite cursor is main-thread bound)
                            for chunk_batch in batch_generator:
                                batch_number += 1

                                # Submit compute task to worker pool
                                future = executor.submit(compute_embeddings_only, (batch_number, chunk_batch))
                                pending_futures[future] = batch_number

                                # Process any completed futures to free memory and write to DB
                                process_completed_futures()

                                # Backpressure: wait if too many pending
                                while len(pending_futures) >= max_workers * 2:
                                    process_completed_futures()
                                    if len(pending_futures) >= max_workers * 2:
                                        time.sleep(0.1)  # time is imported at module level

                            # Wait for remaining futures
                            for future in as_completed(list(pending_futures.keys())):
                                try:
                                    batch_num, chunk_batch, embeddings_numpy, batch_files, error = future.result()
                                    if embeddings_numpy is not None and error is None:
                                        categories = _build_categories_from_batch(chunk_batch)
                                        vector_store.add_chunks_batch_numpy(chunk_batch, embeddings_numpy, categories=categories)
                                        total_chunks_created += len(chunk_batch)
                                    files_seen.update(batch_files)
                                    total_files_processed = len(files_seen)
                                    completed_batches += 1

                                    # Report progress for remaining batches
                                    if progress_callback and completed_batches >= last_reported_batch + 5:
                                        progress_callback(f"  Batch {completed_batches}: {total_chunks_created} chunks, {total_files_processed} files")
                                        last_reported_batch = completed_batches
                                except Exception as e:
                                    logger.error(f"Future raised exception: {e}")

                # Notify before ANN index finalization (happens when bulk_insert context exits)
                if progress_callback:
                    progress_callback(f"Finalizing index... Building ANN index for {total_chunks_created} chunks")

    except Exception as e:
        # Cleanup on error to prevent process hanging
        try:
            _cleanup_fastembed_resources()
            gc.collect()
        except Exception as cleanup_exc:
            logger.debug(f"Cleanup error during exception handling: {cleanup_exc}")
        return {"success": False, "error": f"Failed to read or process files: {str(e)}"}

    elapsed_time = time.time() - start_time

    # Final cleanup: release ONNX resources to allow process exit
    # This is critical - without it, ONNX Runtime threads prevent Python from exiting
    try:
        _cleanup_fastembed_resources()
        gc.collect()
    except Exception as cleanup_exc:
        logger.debug(f"Cleanup error during finalization: {cleanup_exc}")

    return {
        "success": True,
        "result": {
            "chunks_created": total_chunks_created,
            "files_processed": total_files_processed,
            "files_failed": len(failed_files),
            "elapsed_time": elapsed_time,
            "model_profile": model_profile,
            "model_name": embedder.model_name,
            "failed_files": failed_files[:5],  # First 5 failures
            "index_path": str(index_path),
        },
    }


def _discover_index_dbs_internal(index_root: Path) -> List[Path]:
    """Internal helper to find all _index.db files (no deprecation warning).

    Used internally by generate_dense_embeddings_centralized.

    Args:
        index_root: Root directory to scan for _index.db files

    Returns:
        Sorted list of paths to _index.db files
    """
    if not index_root.exists():
        return []

    return sorted(index_root.rglob("_index.db"))


def build_centralized_binary_vectors_from_existing(
    index_root: Path,
    *,
    force: bool = False,
    embedding_dim: Optional[int] = None,
    progress_callback: Optional[callable] = None,
) -> Dict[str, Any]:
    """Build centralized binary vectors + metadata from existing semantic_chunks embeddings.

    This is a fast-path for enabling the staged binary coarse search without
    regenerating embeddings (and without triggering global model locks).

    It scans all distributed `_index.db` files under `index_root`, reads
    existing `semantic_chunks.embedding` blobs, assigns new global chunk_ids,
    and writes:
      - `<index_root>/_binary_vectors.mmap` (+ `.meta.json`)
      - `<index_root>/_vectors_meta.db` (chunk_metadata + binary_vectors)
    """
    from codexlens.config import BINARY_VECTORS_MMAP_NAME, VECTORS_META_DB_NAME
    from codexlens.storage.vector_meta_store import VectorMetadataStore

    index_root = Path(index_root).resolve()
    vectors_meta_path = index_root / VECTORS_META_DB_NAME
    mmap_path = index_root / BINARY_VECTORS_MMAP_NAME
    meta_path = mmap_path.with_suffix(".meta.json")

    index_files = _discover_index_dbs_internal(index_root)
    if not index_files:
        return {"success": False, "error": f"No _index.db files found under {index_root}"}

    if progress_callback:
        progress_callback(f"Scanning {len(index_files)} index databases for existing embeddings...")

    # First pass: detect embedding dims present.
    dims_seen: Dict[int, int] = {}
    selected_config: Optional[Dict[str, Any]] = None

    for index_path in index_files:
        try:
            with sqlite3.connect(index_path) as conn:
                conn.row_factory = sqlite3.Row
                has_table = conn.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='semantic_chunks'"
                ).fetchone()
                if not has_table:
                    continue

                dim_row = conn.execute(
                    "SELECT backend, model_profile, model_name, embedding_dim FROM embeddings_config WHERE id=1"
                ).fetchone()
                if dim_row and dim_row[3]:
                    dim_val = int(dim_row[3])
                    dims_seen[dim_val] = dims_seen.get(dim_val, 0) + 1
                    if selected_config is None:
                        selected_config = {
                            "backend": dim_row[0],
                            "model_profile": dim_row[1],
                            "model_name": dim_row[2],
                            "embedding_dim": dim_val,
                        }

                # We count per-dim later after selecting a target dim.
        except (sqlite3.DatabaseError, ValueError, TypeError):
            # Skip corrupted or malformed indexes
            continue

    if not dims_seen:
        return {"success": False, "error": "No embeddings_config found under index_root"}

    if embedding_dim is None:
        # Default: pick the most common embedding dim across indexes.
        embedding_dim = max(dims_seen.items(), key=lambda kv: kv[1])[0]

    embedding_dim = int(embedding_dim)

    if progress_callback and len(dims_seen) > 1:
        progress_callback(f"Mixed embedding dims detected, selecting dim={embedding_dim} (seen={dims_seen})")

    # Re-detect the selected model config for this dim (do not reuse an arbitrary first-seen config).
    selected_config = None

    # Second pass: count only chunks matching selected dim.
    total_chunks = 0
    for index_path in index_files:
        try:
            with sqlite3.connect(index_path) as conn:
                conn.row_factory = sqlite3.Row
                has_table = conn.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='semantic_chunks'"
                ).fetchone()
                if not has_table:
                    continue

                dim_row = conn.execute(
                    "SELECT backend, model_profile, model_name, embedding_dim FROM embeddings_config WHERE id=1"
                ).fetchone()
                dim_val = int(dim_row[3]) if dim_row and dim_row[3] else None
                if dim_val != embedding_dim:
                    continue

                if selected_config is None:
                    selected_config = {
                        "backend": dim_row[0],
                        "model_profile": dim_row[1],
                        "model_name": dim_row[2],
                        "embedding_dim": dim_val,
                    }

                row = conn.execute(
                    "SELECT COUNT(*) FROM semantic_chunks WHERE embedding IS NOT NULL AND length(embedding) > 0"
                ).fetchone()
                total_chunks += int(row[0] if row else 0)
        except (sqlite3.DatabaseError, ValueError, TypeError):
            # Skip corrupted or malformed indexes
            continue

    if not total_chunks:
        return {
            "success": False,
            "error": f"No existing embeddings found for embedding_dim={embedding_dim}",
            "dims_seen": dims_seen,
        }

    if progress_callback:
        progress_callback(f"Found {total_chunks} embedded chunks (dim={embedding_dim}). Building binary vectors...")

    # Prepare output files / DB.
    try:
        import numpy as np
    except ImportError as exc:
        return {"success": False, "error": f"numpy required to build binary vectors: {exc}"}

    store = VectorMetadataStore(vectors_meta_path)
    store._ensure_schema()

    if force:
        try:
            store.clear()
        except Exception:
            pass
        try:
            store.clear_binary_vectors()
        except Exception:
            pass
        try:
            if mmap_path.exists():
                mmap_path.unlink()
        except Exception:
            pass
        try:
            if meta_path.exists():
                meta_path.unlink()
        except Exception:
            pass

    bytes_per_vec = (int(embedding_dim) + 7) // 8
    mmap = np.memmap(
        str(mmap_path),
        dtype=np.uint8,
        mode="w+",
        shape=(int(total_chunks), int(bytes_per_vec)),
    )

    chunk_ids: List[int] = []
    chunks_batch: List[Dict[str, Any]] = []
    bin_ids_batch: List[int] = []
    bin_vecs_batch: List[bytes] = []
    batch_limit = 500

    global_id = 1
    write_idx = 0

    skipped_indexes: Dict[str, int] = {}
    for index_path in index_files:
        try:
            with sqlite3.connect(index_path) as conn:
                conn.row_factory = sqlite3.Row
                has_table = conn.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='semantic_chunks'"
                ).fetchone()
                if not has_table:
                    continue

                dim_row = conn.execute(
                    "SELECT embedding_dim FROM embeddings_config WHERE id=1"
                ).fetchone()
                dim_val = int(dim_row[0]) if dim_row and dim_row[0] else None
                if dim_val != embedding_dim:
                    skipped_indexes[str(index_path)] = dim_val or -1
                    continue

                rows = conn.execute(
                    "SELECT file_path, content, embedding, metadata, category FROM semantic_chunks "
                    "WHERE embedding IS NOT NULL AND length(embedding) > 0"
                ).fetchall()

                for row in rows:
                    emb = np.frombuffer(row["embedding"], dtype=np.float32)
                    if emb.size != int(embedding_dim):
                        continue

                    packed = np.packbits((emb > 0).astype(np.uint8))
                    if packed.size != bytes_per_vec:
                        continue

                    mmap[write_idx] = packed
                    write_idx += 1

                    cid = global_id
                    global_id += 1
                    chunk_ids.append(cid)

                    meta_raw = row["metadata"]
                    meta_dict: Dict[str, Any] = {}
                    if meta_raw:
                        try:
                            meta_dict = json.loads(meta_raw) if isinstance(meta_raw, str) else dict(meta_raw)
                        except Exception:
                            meta_dict = {}

                    chunks_batch.append(
                        {
                            "chunk_id": cid,
                            "file_path": row["file_path"],
                            "content": row["content"],
                            "start_line": meta_dict.get("start_line"),
                            "end_line": meta_dict.get("end_line"),
                            "category": row["category"],
                            "metadata": meta_dict,
                            "source_index_db": str(index_path),
                        }
                    )

                    bin_ids_batch.append(cid)
                    bin_vecs_batch.append(packed.tobytes())

                    if len(chunks_batch) >= batch_limit:
                        store.add_chunks(chunks_batch)
                        store.add_binary_vectors(bin_ids_batch, bin_vecs_batch)
                        chunks_batch = []
                        bin_ids_batch = []
                        bin_vecs_batch = []

        except Exception:
            continue

    if chunks_batch:
        store.add_chunks(chunks_batch)
        store.add_binary_vectors(bin_ids_batch, bin_vecs_batch)

    mmap.flush()
    del mmap

    # If we skipped inconsistent vectors, truncate metadata to actual write count.
    chunk_ids = chunk_ids[:write_idx]

    # Write sidecar metadata.
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "shape": [int(write_idx), int(bytes_per_vec)],
                "chunk_ids": chunk_ids,
                "embedding_dim": int(embedding_dim),
                "backend": (selected_config or {}).get("backend"),
                "model_profile": (selected_config or {}).get("model_profile"),
                "model_name": (selected_config or {}).get("model_name"),
            },
            f,
        )

    if progress_callback:
        progress_callback(f"Binary vectors ready: {mmap_path} (rows={write_idx})")

    return {
        "success": True,
        "result": {
            "index_root": str(index_root),
            "index_files_scanned": len(index_files),
            "chunks_total": int(total_chunks),
            "chunks_written": int(write_idx),
            "embedding_dim": int(embedding_dim),
            "bytes_per_vector": int(bytes_per_vec),
            "skipped_indexes": len(skipped_indexes),
            "vectors_meta_db": str(vectors_meta_path),
            "binary_mmap": str(mmap_path),
            "binary_meta_json": str(meta_path),
        },
    }


def discover_all_index_dbs(index_root: Path) -> List[Path]:
    """Recursively find all _index.db files in an index tree.

    .. deprecated::
        This function is deprecated. Use centralized indexing with
        ``generate_dense_embeddings_centralized`` instead, which handles
        index discovery internally.

    Args:
        index_root: Root directory to scan for _index.db files

    Returns:
        Sorted list of paths to _index.db files
    """
    import warnings
    warnings.warn(
        "discover_all_index_dbs is deprecated. Use centralized indexing with "
        "generate_dense_embeddings_centralized instead.",
        DeprecationWarning,
        stacklevel=2
    )
    return _discover_index_dbs_internal(index_root)


def find_all_indexes(scan_dir: Path) -> List[Path]:
    """Find all _index.db files in directory tree.

    Args:
        scan_dir: Directory to scan

    Returns:
        List of paths to _index.db files
    """
    if not scan_dir.exists():
        return []

    return list(scan_dir.rglob("_index.db"))



def generate_embeddings_recursive(
    index_root: Path,
    embedding_backend: Optional[str] = None,
    model_profile: Optional[str] = None,
    force: bool = False,
    chunk_size: int = 2000,
    overlap: int = 200,
    progress_callback: Optional[callable] = None,
    use_gpu: Optional[bool] = None,
    max_tokens_per_batch: Optional[int] = None,
    max_workers: Optional[int] = None,
    endpoints: Optional[List] = None,
    strategy: Optional[str] = None,
    cooldown: Optional[float] = None,
) -> Dict[str, any]:
    """Generate embeddings for all index databases in a project recursively.

    .. deprecated::
        This function is deprecated. Use ``generate_dense_embeddings_centralized``
        instead, which creates a single centralized vector index for the entire project
        rather than per-directory indexes.

    Args:
        index_root: Root index directory containing _index.db files
        embedding_backend: Embedding backend to use (fastembed or litellm).
                          Defaults to config setting.
        model_profile: Model profile for fastembed (fast, code, multilingual, balanced)
                      or model name for litellm (e.g., qwen3-embedding).
                      Defaults to config setting.
        force: If True, regenerate even if embeddings exist
        chunk_size: Maximum chunk size in characters
        overlap: Overlap size in characters for sliding window chunking (default: 200)
        progress_callback: Optional callback for progress updates
        use_gpu: Whether to use GPU acceleration (fastembed only).
                Defaults to config setting.
        max_tokens_per_batch: Maximum tokens per batch for token-aware batching.
                             If None, attempts to get from embedder.max_tokens,
                             then falls back to 8000. If set, overrides automatic detection.
        max_workers: Maximum number of concurrent API calls.
                    If None, uses dynamic defaults based on backend and endpoint count.
        endpoints: Optional list of endpoint configurations for multi-API load balancing.
        strategy: Selection strategy for multi-endpoint mode.
        cooldown: Default cooldown seconds for rate-limited endpoints.

    Returns:
        Aggregated result dictionary with generation statistics
    """
    import warnings
    warnings.warn(
        "generate_embeddings_recursive is deprecated. Use "
        "generate_dense_embeddings_centralized instead for centralized indexing.",
        DeprecationWarning,
        stacklevel=2
    )

    # Apply config defaults
    embedding_backend, model_profile, use_gpu, endpoints, strategy, cooldown = \
        _apply_embedding_config_defaults(
            embedding_backend, model_profile, use_gpu, endpoints, strategy, cooldown
        )

    # Calculate max_workers
    max_workers = _calculate_max_workers(embedding_backend, endpoints, max_workers)

    # Discover all _index.db files (using internal helper to avoid double deprecation warning)
    index_files = _discover_index_dbs_internal(index_root)

    if not index_files:
        return {
            "success": False,
            "error": f"No index databases found in {index_root}",
        }

    if progress_callback:
        progress_callback(f"Found {len(index_files)} index databases to process")

    # Process each index database
    all_results = []
    total_chunks = 0
    total_files_processed = 0
    total_files_failed = 0

    for idx, index_path in enumerate(index_files, 1):
        if progress_callback:
            try:
                rel_path = index_path.relative_to(index_root)
            except ValueError:
                rel_path = index_path
            # Format: "Processing file X/Y: path" to match Node.js parseProgressLine
            progress_callback(f"Processing file {idx}/{len(index_files)}: {rel_path}")

        result = generate_embeddings(
            index_path,
            embedding_backend=embedding_backend,
            model_profile=model_profile,
            force=force,
            chunk_size=chunk_size,
            overlap=overlap,
            progress_callback=None,  # Don't cascade callbacks
            use_gpu=use_gpu,
            max_tokens_per_batch=max_tokens_per_batch,
            max_workers=max_workers,
            endpoints=endpoints,
            strategy=strategy,
            cooldown=cooldown,
        )

        all_results.append({
            "path": str(index_path),
            "success": result["success"],
            "result": result.get("result"),
            "error": result.get("error"),
        })

        if result["success"]:
            data = result["result"]
            total_chunks += data["chunks_created"]
            total_files_processed += data["files_processed"]
            total_files_failed += data["files_failed"]

    successful = sum(1 for r in all_results if r["success"])

    # Final cleanup after processing all indexes
    # Each generate_embeddings() call does its own cleanup, but do a final one to be safe
    try:
        _cleanup_fastembed_resources()
        gc.collect()
    except Exception:
        pass

    return {
        "success": successful > 0,
        "result": {
            "indexes_processed": len(index_files),
            "indexes_successful": successful,
            "indexes_failed": len(index_files) - successful,
            "total_chunks_created": total_chunks,
            "total_files_processed": total_files_processed,
            "total_files_failed": total_files_failed,
            "model_profile": model_profile,
            "details": all_results,
        },
    }


def generate_dense_embeddings_centralized(
    index_root: Path,
    embedding_backend: Optional[str] = None,
    model_profile: Optional[str] = None,
    force: bool = False,
    chunk_size: int = 2000,
    overlap: int = 200,
    progress_callback: Optional[callable] = None,
    use_gpu: Optional[bool] = None,
    max_tokens_per_batch: Optional[int] = None,
    max_workers: Optional[int] = None,
    endpoints: Optional[List] = None,
    strategy: Optional[str] = None,
    cooldown: Optional[float] = None,
) -> Dict[str, any]:
    """Generate dense embeddings with centralized vector storage.

    This function creates a single HNSW index at the project root instead of
    per-directory indexes. All chunks from all _index.db files are combined
    into one central _vectors.hnsw file.

    Target architecture:
        <index_root>/
        |-- _vectors.hnsw         # Centralized dense vector ANN index
        |-- src/
            |-- _index.db         # No longer contains .hnsw file

    Args:
        index_root: Root index directory containing _index.db files
        embedding_backend: Embedding backend (fastembed or litellm)
        model_profile: Model profile or name
        force: If True, regenerate even if embeddings exist
        chunk_size: Maximum chunk size in characters
        overlap: Overlap size in characters
        progress_callback: Optional callback for progress updates
        use_gpu: Whether to use GPU acceleration
        max_tokens_per_batch: Maximum tokens per batch
        max_workers: Maximum concurrent workers
        endpoints: Multi-endpoint configurations
        strategy: Endpoint selection strategy
        cooldown: Rate-limit cooldown seconds

    Returns:
        Result dictionary with generation statistics
    """
    from codexlens.config import VECTORS_HNSW_NAME

    # Apply config defaults
    embedding_backend, model_profile, use_gpu, endpoints, strategy, cooldown = \
        _apply_embedding_config_defaults(
            embedding_backend, model_profile, use_gpu, endpoints, strategy, cooldown
        )

    # Calculate max_workers
    max_workers = _calculate_max_workers(embedding_backend, endpoints, max_workers)

    backend_available, backend_error = is_embedding_backend_available(embedding_backend)
    if not backend_available:
        return {"success": False, "error": backend_error or "Embedding backend not available"}

    # Discover all _index.db files
    index_files = _discover_index_dbs_internal(index_root)

    if not index_files:
        return {
            "success": False,
            "error": f"No index databases found in {index_root}",
        }

    if progress_callback:
        progress_callback(f"Found {len(index_files)} index databases for centralized embedding")

    # Pre-calculate estimated chunk count for HNSW capacity
    # This avoids expensive resize operations during indexing
    estimated_total_files = 0
    for index_path in index_files:
        try:
            with sqlite3.connect(index_path) as conn:
                cursor = conn.execute("SELECT COUNT(*) FROM files")
                estimated_total_files += cursor.fetchone()[0]
        except Exception:
            pass
    # Heuristic: ~15 chunks per file on average
    estimated_chunks = max(100000, estimated_total_files * 15)

    if progress_callback:
        progress_callback(f"Estimated {estimated_total_files} files, ~{estimated_chunks} chunks")

    # Check for existing centralized index
    central_hnsw_path = index_root / VECTORS_HNSW_NAME
    if central_hnsw_path.exists() and not force:
        return {
            "success": False,
            "error": f"Centralized vector index already exists at {central_hnsw_path}. Use --force to regenerate.",
        }

    # Initialize embedder and chunker using helper
    try:
        from codexlens.semantic.ann_index import ANNIndex

        embedder, chunker, endpoint_count = _initialize_embedder_and_chunker(
            embedding_backend, model_profile, use_gpu, endpoints, strategy, cooldown,
            chunk_size, overlap
        )

        # Load chunk stripping config for batch size calculation
        from codexlens.config import Config
        batch_config = Config.load()

        if progress_callback:
            if endpoint_count > 1:
                progress_callback(f"Using {endpoint_count} API endpoints with {strategy} strategy")
            progress_callback(f"Using model: {embedder.model_name} ({embedder.embedding_dim} dimensions)")

        # Calculate dynamic batch size based on model capacity
        effective_batch_size = calculate_dynamic_batch_size(batch_config, embedder)

        if progress_callback and batch_config.api_batch_size_dynamic:
            progress_callback(f"Dynamic batch size: {effective_batch_size} (model max_tokens={getattr(embedder, 'max_tokens', 8192)})")

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to initialize components: {str(e)}",
        }

    # Create centralized ANN index with pre-calculated capacity
    # Using estimated_chunks avoids expensive resize operations during indexing
    central_ann_index = ANNIndex.create_central(
        index_root=index_root,
        dim=embedder.embedding_dim,
        initial_capacity=estimated_chunks,
        auto_save=False,
    )

    # Process all index databases
    start_time = time.time()
    failed_files = []
    total_chunks_created = 0
    total_files_processed = 0
    all_chunk_ids = []
    all_embeddings = []

    # Track chunk ID to file_path mapping for metadata
    chunk_id_to_info: Dict[int, Dict[str, Any]] = {}
    next_chunk_id = 1
    # Track current index_path for source_index_db field
    current_index_path: Optional[str] = None

    for idx, index_path in enumerate(index_files, 1):
        if progress_callback:
            try:
                rel_path = index_path.relative_to(index_root)
            except ValueError:
                rel_path = index_path
            progress_callback(f"Processing {idx}/{len(index_files)}: {rel_path}")

        # Track current index_path for source_index_db
        current_index_path = str(index_path)

        try:
            with sqlite3.connect(index_path) as conn:
                conn.row_factory = sqlite3.Row
                path_column = _get_path_column(conn)

                # Get files from this index
                cursor = conn.execute(f"SELECT {path_column}, content, language FROM files")
                file_rows = cursor.fetchall()

                for file_row in file_rows:
                    file_path = file_row[path_column]
                    content = file_row["content"]
                    language = file_row["language"] or "python"

                    try:
                        chunks = chunker.chunk_sliding_window(
                            content,
                            file_path=file_path,
                            language=language
                        )

                        if not chunks:
                            continue

                        total_files_processed += 1

                        # Generate embeddings for this file's chunks
                        batch_contents = [chunk.content for chunk in chunks]
                        embeddings_numpy = embedder.embed_to_numpy(batch_contents, batch_size=effective_batch_size)

                        # Assign chunk IDs and store embeddings
                        for i, chunk in enumerate(chunks):
                            chunk_id = next_chunk_id
                            next_chunk_id += 1

                            all_chunk_ids.append(chunk_id)
                            all_embeddings.append(embeddings_numpy[i])

                            # Store metadata for later retrieval
                            chunk_id_to_info[chunk_id] = {
                                "file_path": file_path,
                                "content": chunk.content,
                                "metadata": chunk.metadata,
                                "category": get_file_category(file_path) or "code",
                                "source_index_db": current_index_path,
                            }
                            total_chunks_created += 1

                    except Exception as e:
                        logger.error(f"Failed to process {file_path}: {e}")
                        failed_files.append((file_path, str(e)))

        except Exception as e:
            logger.error(f"Failed to read index {index_path}: {e}")
            failed_files.append((str(index_path), str(e)))

    # Add all embeddings to centralized ANN index
    if all_embeddings:
        if progress_callback:
            progress_callback(f"Building centralized ANN index with {len(all_embeddings)} vectors...")

        try:
            import numpy as np
            embeddings_matrix = np.vstack(all_embeddings)
            central_ann_index.add_vectors(all_chunk_ids, embeddings_matrix)
            central_ann_index.save()

            if progress_callback:
                progress_callback(f"Saved centralized index to {central_hnsw_path}")

        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to build centralized ANN index: {str(e)}",
            }

    # Store chunk metadata in a centralized metadata database
    vectors_meta_path = index_root / VECTORS_META_DB_NAME
    if chunk_id_to_info:
        if progress_callback:
            progress_callback(f"Storing {len(chunk_id_to_info)} chunk metadata records...")

        try:
            from codexlens.storage.vector_meta_store import VectorMetadataStore

            with VectorMetadataStore(vectors_meta_path) as meta_store:
                # Convert chunk_id_to_info dict to list of dicts for batch insert
                chunks_to_store = []
                for cid, info in chunk_id_to_info.items():
                    metadata = info.get("metadata", {})
                    chunks_to_store.append({
                        "chunk_id": cid,
                        "file_path": info["file_path"],
                        "content": info["content"],
                        "start_line": metadata.get("start_line"),
                        "end_line": metadata.get("end_line"),
                        "category": info.get("category"),
                        "metadata": metadata,
                        "source_index_db": info.get("source_index_db"),
                    })

                meta_store.add_chunks(chunks_to_store)

            if progress_callback:
                progress_callback(f"Saved metadata to {vectors_meta_path}")

        except Exception as e:
            logger.warning("Failed to store vector metadata: %s", e)
            # Non-fatal: continue without centralized metadata

    # --- Binary Vector Generation for Cascade Search (Memory-Mapped) ---
    binary_success = False
    binary_count = 0
    try:
        from codexlens.config import Config, BINARY_VECTORS_MMAP_NAME
        config = Config.load()

        if getattr(config, 'enable_binary_cascade', True) and all_embeddings:
            import numpy as np

            if progress_callback:
                progress_callback(f"Generating binary vectors for {len(all_embeddings)} chunks...")

            # Binarize dense vectors: sign(x) -> 1 if x > 0, 0 otherwise
            # Pack into bytes for efficient storage and Hamming distance computation
            embeddings_matrix = np.vstack(all_embeddings)
            binary_matrix = (embeddings_matrix > 0).astype(np.uint8)

            # Pack bits into bytes (8 bits per byte) - vectorized for all rows
            packed_matrix = np.packbits(binary_matrix, axis=1)
            binary_count = len(packed_matrix)

            # Save as memory-mapped file for efficient loading
            binary_mmap_path = index_root / BINARY_VECTORS_MMAP_NAME
            mmap_array = np.memmap(
                str(binary_mmap_path),
                dtype=np.uint8,
                mode='w+',
                shape=packed_matrix.shape
            )
            mmap_array[:] = packed_matrix
            mmap_array.flush()
            del mmap_array  # Close the memmap

            # Save metadata (shape and chunk_ids) to sidecar JSON
            import json
            meta_path = binary_mmap_path.with_suffix('.meta.json')
            with open(meta_path, 'w') as f:
                json.dump({
                    'shape': list(packed_matrix.shape),
                    'chunk_ids': all_chunk_ids,
                    'embedding_dim': embeddings_matrix.shape[1],
                }, f)

            # Also store in DB for backward compatibility
            from codexlens.storage.vector_meta_store import VectorMetadataStore
            binary_packed_bytes = [row.tobytes() for row in packed_matrix]
            with VectorMetadataStore(vectors_meta_path) as meta_store:
                meta_store.add_binary_vectors(all_chunk_ids, binary_packed_bytes)

            binary_success = True
            if progress_callback:
                progress_callback(f"Generated {binary_count} binary vectors ({embeddings_matrix.shape[1]} dims -> {packed_matrix.shape[1]} bytes, mmap: {binary_mmap_path.name})")

    except Exception as e:
        logger.warning("Binary vector generation failed: %s", e)
        # Non-fatal: continue without binary vectors

    elapsed_time = time.time() - start_time

    # Cleanup
    try:
        _cleanup_fastembed_resources()
        gc.collect()
    except Exception:
        pass

    return {
        "success": True,
        "result": {
            "chunks_created": total_chunks_created,
            "files_processed": total_files_processed,
            "files_failed": len(failed_files),
            "elapsed_time": elapsed_time,
            "model_profile": model_profile,
            "model_name": embedder.model_name,
            "central_index_path": str(central_hnsw_path),
            "failed_files": failed_files[:5],
            "binary_success": binary_success,
            "binary_count": binary_count,
        },
    }


def get_embeddings_status(index_root: Path) -> Dict[str, any]:
    """Get comprehensive embeddings coverage status for all indexes.

    Args:
        index_root: Root index directory

    Returns:
        Aggregated status with coverage statistics, model info, and timestamps
    """
    index_files = _discover_index_dbs_internal(index_root)

    if not index_files:
        return {
            "success": True,
            "result": {
                "total_indexes": 0,
                "total_files": 0,
                "files_with_embeddings": 0,
                "files_without_embeddings": 0,
                "total_chunks": 0,
                "coverage_percent": 0.0,
                "indexes_with_embeddings": 0,
                "indexes_without_embeddings": 0,
                "model_info": None,
            },
        }

    total_files = 0
    files_with_embeddings = 0
    total_chunks = 0
    indexes_with_embeddings = 0
    model_info = None
    latest_updated_at = None

    for index_path in index_files:
        status = check_index_embeddings(index_path)
        if status["success"]:
            result = status["result"]
            total_files += result["total_files"]
            files_with_embeddings += result["files_with_chunks"]
            total_chunks += result["total_chunks"]
            if result["has_embeddings"]:
                indexes_with_embeddings += 1

                # Get model config from first index with embeddings (they should all match)
                if model_info is None:
                    try:
                        from codexlens.semantic.vector_store import VectorStore
                        with VectorStore(index_path) as vs:
                            config = vs.get_model_config()
                            if config:
                                model_info = {
                                    "model_profile": config.get("model_profile"),
                                    "model_name": config.get("model_name"),
                                    "embedding_dim": config.get("embedding_dim"),
                                    "backend": config.get("backend"),
                                    "created_at": config.get("created_at"),
                                    "updated_at": config.get("updated_at"),
                                }
                                latest_updated_at = config.get("updated_at")
                    except Exception:
                        pass
                else:
                    # Track the latest updated_at across all indexes
                    try:
                        from codexlens.semantic.vector_store import VectorStore
                        with VectorStore(index_path) as vs:
                            config = vs.get_model_config()
                            if config and config.get("updated_at"):
                                if latest_updated_at is None or config["updated_at"] > latest_updated_at:
                                    latest_updated_at = config["updated_at"]
                    except Exception:
                        pass

    # Update model_info with latest timestamp
    if model_info and latest_updated_at:
        model_info["updated_at"] = latest_updated_at

    return {
        "success": True,
        "result": {
            "total_indexes": len(index_files),
            "total_files": total_files,
            "files_with_embeddings": files_with_embeddings,
            "files_without_embeddings": total_files - files_with_embeddings,
            "total_chunks": total_chunks,
            "coverage_percent": round((files_with_embeddings / total_files * 100) if total_files > 0 else 0, 1),
            "indexes_with_embeddings": indexes_with_embeddings,
            "indexes_without_embeddings": len(index_files) - indexes_with_embeddings,
            "model_info": model_info,
        },
    }


def get_embedding_stats_summary(index_root: Path) -> Dict[str, any]:
    """Get summary statistics for all indexes in root directory.

    Args:
        index_root: Root directory containing indexes

    Returns:
        Summary statistics for all indexes
    """
    indexes = find_all_indexes(index_root)

    if not indexes:
        return {
            "success": True,
            "result": {
                "total_indexes": 0,
                "indexes_with_embeddings": 0,
                "total_chunks": 0,
                "indexes": [],
            },
        }

    total_chunks = 0
    indexes_with_embeddings = 0
    index_stats = []

    for index_path in indexes:
        status = check_index_embeddings(index_path)

        if status["success"]:
            result = status["result"]
            has_emb = result["has_embeddings"]
            chunks = result["total_chunks"]

            if has_emb:
                indexes_with_embeddings += 1
                total_chunks += chunks

            # Extract project name from path
            project_name = index_path.parent.name

            index_stats.append({
                "project": project_name,
                "path": str(index_path),
                "has_embeddings": has_emb,
                "total_chunks": chunks,
                "total_files": result["total_files"],
                "coverage_percent": result.get("coverage_percent", 0),
            })

    return {
        "success": True,
        "result": {
            "total_indexes": len(indexes),
            "indexes_with_embeddings": indexes_with_embeddings,
            "total_chunks": total_chunks,
            "indexes": index_stats,
        },
    }


def scan_for_model_conflicts(
    index_root: Path,
    target_backend: str,
    target_model: str,
) -> Dict[str, any]:
    """Scan for model conflicts across all indexes in a directory.

    Checks if any existing embeddings were generated with a different
    backend or model than the target configuration.

    Args:
        index_root: Root index directory to scan
        target_backend: Target embedding backend (fastembed or litellm)
        target_model: Target model profile/name

    Returns:
        Dictionary with:
        - has_conflict: True if any index has different model config
        - existing_config: Config from first index with embeddings (if any)
        - target_config: The requested configuration
        - conflicts: List of conflicting index paths with their configs
        - indexes_with_embeddings: Count of indexes that have embeddings
    """
    index_files = _discover_index_dbs_internal(index_root)

    if not index_files:
        return {
            "has_conflict": False,
            "existing_config": None,
            "target_config": {"backend": target_backend, "model": target_model},
            "conflicts": [],
            "indexes_with_embeddings": 0,
        }

    conflicts = []
    existing_config = None
    indexes_with_embeddings = 0

    for index_path in index_files:
        try:
            from codexlens.semantic.vector_store import VectorStore

            with VectorStore(index_path) as vs:
                config = vs.get_model_config()
                if config and config.get("model_profile"):
                    indexes_with_embeddings += 1

                    # Store first existing config as reference
                    if existing_config is None:
                        existing_config = {
                            "backend": config.get("backend"),
                            "model": config.get("model_profile"),
                            "model_name": config.get("model_name"),
                            "embedding_dim": config.get("embedding_dim"),
                        }

                    # Check for conflict: different backend OR different model
                    existing_backend = config.get("backend", "")
                    existing_model = config.get("model_profile", "")

                    if existing_backend != target_backend or existing_model != target_model:
                        conflicts.append({
                            "path": str(index_path),
                            "existing": {
                                "backend": existing_backend,
                                "model": existing_model,
                                "model_name": config.get("model_name"),
                            },
                        })
        except Exception as e:
            logger.debug(f"Failed to check model config for {index_path}: {e}")
            continue

    return {
        "has_conflict": len(conflicts) > 0,
        "existing_config": existing_config,
        "target_config": {"backend": target_backend, "model": target_model},
        "conflicts": conflicts,
        "indexes_with_embeddings": indexes_with_embeddings,
    }


def _get_global_settings_path() -> Path:
    """Get the path to global embedding settings file."""
    return Path.home() / ".codexlens" / "embedding_lock.json"


def get_locked_model_config() -> Optional[Dict[str, Any]]:
    """Get the globally locked embedding model configuration.

    Returns:
        Dictionary with backend and model if locked, None otherwise.
    """
    settings_path = _get_global_settings_path()
    if not settings_path.exists():
        return None

    try:
        with open(settings_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if data.get("locked"):
                return {
                    "backend": data.get("backend"),
                    "model": data.get("model"),
                    "locked_at": data.get("locked_at"),
                }
    except (json.JSONDecodeError, OSError):
        pass

    return None


def set_locked_model_config(backend: str, model: str) -> None:
    """Set the globally locked embedding model configuration.

    This is called after the first successful embedding generation
    to lock the model for all future operations.

    Args:
        backend: Embedding backend (fastembed or litellm)
        model: Model profile/name
    """
    import datetime

    settings_path = _get_global_settings_path()
    settings_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "locked": True,
        "backend": backend,
        "model": model,
        "locked_at": datetime.datetime.now().isoformat(),
    }

    with open(settings_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def clear_locked_model_config() -> bool:
    """Clear the globally locked embedding model configuration.

    Returns:
        True if lock was cleared, False if no lock existed.
    """
    settings_path = _get_global_settings_path()
    if settings_path.exists():
        settings_path.unlink()
        return True
    return False


def check_global_model_lock(
    target_backend: str,
    target_model: str,
) -> Dict[str, Any]:
    """Check if the target model conflicts with the global lock.

    Args:
        target_backend: Requested embedding backend
        target_model: Requested model profile/name

    Returns:
        Dictionary with:
        - is_locked: True if a global lock exists
        - has_conflict: True if target differs from locked config
        - locked_config: The locked configuration (if any)
        - target_config: The requested configuration
    """
    locked_config = get_locked_model_config()

    if locked_config is None:
        return {
            "is_locked": False,
            "has_conflict": False,
            "locked_config": None,
            "target_config": {"backend": target_backend, "model": target_model},
        }

    has_conflict = (
        locked_config["backend"] != target_backend or
        locked_config["model"] != target_model
    )

    return {
        "is_locked": True,
        "has_conflict": has_conflict,
        "locked_config": locked_config,
        "target_config": {"backend": target_backend, "model": target_model},
    }
