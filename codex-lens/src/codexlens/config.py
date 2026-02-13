"""Configuration system for CodexLens."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path
from typing import Any, Dict, List, Optional

from .errors import ConfigError


# Workspace-local directory name
WORKSPACE_DIR_NAME = ".codexlens"

# Settings file name
SETTINGS_FILE_NAME = "settings.json"

# Dense vector storage names (centralized storage)
VECTORS_HNSW_NAME = "_vectors.hnsw"
VECTORS_META_DB_NAME = "_vectors_meta.db"
BINARY_VECTORS_MMAP_NAME = "_binary_vectors.mmap"

log = logging.getLogger(__name__)


def _default_global_dir() -> Path:
    """Get global CodexLens data directory."""
    env_override = os.getenv("CODEXLENS_DATA_DIR")
    if env_override:
        return Path(env_override).expanduser().resolve()
    return (Path.home() / ".codexlens").resolve()


def find_workspace_root(start_path: Path) -> Optional[Path]:
    """Find the workspace root by looking for .codexlens directory.

    Searches from start_path upward to find an existing .codexlens directory.
    Returns None if not found.
    """
    current = start_path.resolve()

    # Search up to filesystem root
    while current != current.parent:
        workspace_dir = current / WORKSPACE_DIR_NAME
        if workspace_dir.is_dir():
            return current
        current = current.parent

    # Check root as well
    workspace_dir = current / WORKSPACE_DIR_NAME
    if workspace_dir.is_dir():
        return current

    return None


@dataclass
class Config:
    """Runtime configuration for CodexLens.

    - data_dir: Base directory for all persistent CodexLens data.
    - venv_path: Optional virtualenv used for language tooling.
    - supported_languages: Language IDs and their associated file extensions.
    - parsing_rules: Per-language parsing and chunking hints.
    """

    data_dir: Path = field(default_factory=_default_global_dir)
    venv_path: Path = field(default_factory=lambda: _default_global_dir() / "venv")
    supported_languages: Dict[str, Dict[str, Any]] = field(
        default_factory=lambda: {
            # Source code languages (category: "code")
            "python": {"extensions": [".py"], "tree_sitter_language": "python", "category": "code"},
            "javascript": {"extensions": [".js", ".jsx"], "tree_sitter_language": "javascript", "category": "code"},
            "typescript": {"extensions": [".ts", ".tsx"], "tree_sitter_language": "typescript", "category": "code"},
            "java": {"extensions": [".java"], "tree_sitter_language": "java", "category": "code"},
            "go": {"extensions": [".go"], "tree_sitter_language": "go", "category": "code"},
            "zig": {"extensions": [".zig"], "tree_sitter_language": "zig", "category": "code"},
            "objective-c": {"extensions": [".m", ".mm"], "tree_sitter_language": "objc", "category": "code"},
            "c": {"extensions": [".c", ".h"], "tree_sitter_language": "c", "category": "code"},
            "cpp": {"extensions": [".cc", ".cpp", ".hpp", ".cxx"], "tree_sitter_language": "cpp", "category": "code"},
            "rust": {"extensions": [".rs"], "tree_sitter_language": "rust", "category": "code"},
        }
    )
    parsing_rules: Dict[str, Dict[str, Any]] = field(
        default_factory=lambda: {
            "default": {
                "max_chunk_chars": 4000,
                "max_chunk_lines": 200,
                "overlap_lines": 20,
            }
        }
    )

    llm_enabled: bool = False
    llm_tool: str = "gemini"
    llm_timeout_ms: int = 300000
    llm_batch_size: int = 5

    # Hybrid chunker configuration
    hybrid_max_chunk_size: int = 2000  # Max characters per chunk before LLM refinement
    hybrid_llm_refinement: bool = False  # Enable LLM-based semantic boundary refinement

    # Embedding configuration
    embedding_backend: str = "fastembed"  # "fastembed" (local) or "litellm" (API)
    embedding_model: str = "code"  # For fastembed: profile (fast/code/multilingual/balanced)
                                   # For litellm: model name from config (e.g., "qwen3-embedding")
    embedding_use_gpu: bool = True  # For fastembed: whether to use GPU acceleration

    # Indexing/search optimizations
    global_symbol_index_enabled: bool = True  # Enable project-wide symbol index fast path
    enable_merkle_detection: bool = True  # Enable content-hash based incremental indexing

    # Graph expansion (search-time, uses precomputed neighbors)
    enable_graph_expansion: bool = False
    graph_expansion_depth: int = 2

    # Optional search reranking (disabled by default)
    enable_reranking: bool = False
    reranking_top_k: int = 50
    symbol_boost_factor: float = 1.5

    # Optional cross-encoder reranking (second stage; requires optional reranker deps)
    enable_cross_encoder_rerank: bool = False
    reranker_backend: str = "onnx"
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    reranker_top_k: int = 50
    reranker_max_input_tokens: int = 8192  # Maximum tokens for reranker API batching
    reranker_chunk_type_weights: Optional[Dict[str, float]] = None  # Weights for chunk types: {"code": 1.0, "docstring": 0.7}
    reranker_test_file_penalty: float = 0.0  # Penalty for test files (0.0-1.0, e.g., 0.2 = 20% reduction)

    # Chunk stripping configuration (for semantic embedding)
    chunk_strip_comments: bool = True  # Strip comments from code chunks
    chunk_strip_docstrings: bool = True  # Strip docstrings from code chunks

    # Cascade search configuration (two-stage retrieval)
    enable_cascade_search: bool = False  # Enable cascade search (coarse + fine ranking)
    cascade_coarse_k: int = 100  # Number of coarse candidates from first stage
    cascade_fine_k: int = 10  # Number of final results after reranking
    cascade_strategy: str = "binary"  # "binary", "binary_rerank", "dense_rerank", or "staged"

    # Staged cascade search configuration (4-stage pipeline)
    staged_coarse_k: int = 200  # Number of coarse candidates from Stage 1 binary search
    staged_lsp_depth: int = 2  # LSP relationship expansion depth in Stage 2
    staged_stage2_mode: str = "precomputed"  # "precomputed" (graph_neighbors) | "realtime" (LSP) | "static_global_graph" (global_relationships)

    # Static graph configuration (write relationships to global index during build)
    static_graph_enabled: bool = False
    static_graph_relationship_types: List[str] = field(default_factory=lambda: ["imports", "inherits"])

    staged_realtime_lsp_timeout_s: float = 30.0  # Max time budget for realtime LSP expansion
    staged_realtime_lsp_depth: int = 1  # BFS depth for realtime LSP expansion
    staged_realtime_lsp_max_nodes: int = 50  # Node cap for realtime graph expansion
    staged_realtime_lsp_max_seeds: int = 1  # Seed cap for realtime graph expansion
    staged_realtime_lsp_max_concurrent: int = 2  # Max concurrent LSP requests during graph expansion
    staged_realtime_lsp_warmup_s: float = 3.0  # Wait for server analysis after opening seed docs
    staged_realtime_lsp_resolve_symbols: bool = False  # If True, resolves symbol names via documentSymbol (slower)
    staged_clustering_strategy: str = "auto"  # "auto", "hdbscan", "dbscan", "frequency", "noop", "score", "dir_rr", "path"
    staged_clustering_min_size: int = 3  # Minimum cluster size for Stage 3 grouping
    enable_staged_rerank: bool = True  # Enable optional cross-encoder reranking in Stage 4

    # RRF fusion configuration
    fusion_method: str = "rrf"  # "simple" (weighted sum) or "rrf" (reciprocal rank fusion)
    rrf_k: int = 60  # RRF constant (default 60)

    # Category-based filtering to separate code/doc results
    enable_category_filter: bool = True  # Enable code/doc result separation

    # Multi-endpoint configuration for litellm backend
    embedding_endpoints: List[Dict[str, Any]] = field(default_factory=list)
    # List of endpoint configs: [{"model": "...", "api_key": "...", "api_base": "...", "weight": 1.0}]
    embedding_pool_enabled: bool = False  # Enable high availability pool for embeddings
    embedding_strategy: str = "latency_aware"  # round_robin, latency_aware, weighted_random
    embedding_cooldown: float = 60.0  # Default cooldown seconds for rate-limited endpoints

    # Reranker multi-endpoint configuration
    reranker_pool_enabled: bool = False  # Enable high availability pool for reranker
    reranker_strategy: str = "latency_aware"  # round_robin, latency_aware, weighted_random
    reranker_cooldown: float = 60.0  # Default cooldown seconds for rate-limited endpoints

    # API concurrency settings
    api_max_workers: int = 4  # Max concurrent API calls for embedding/reranking
    api_batch_size: int = 8  # Batch size for API requests
    api_batch_size_dynamic: bool = False  # Enable dynamic batch size calculation
    api_batch_size_utilization_factor: float = 0.8  # Use 80% of model token capacity
    api_batch_size_max: int = 2048  # Absolute upper limit for batch size
    chars_per_token_estimate: int = 4  # Characters per token estimation ratio

    def __post_init__(self) -> None:
        try:
            self.data_dir = self.data_dir.expanduser().resolve()
            self.venv_path = self.venv_path.expanduser().resolve()
            self.data_dir.mkdir(parents=True, exist_ok=True)
        except PermissionError as exc:
            raise ConfigError(
                f"Permission denied initializing paths (data_dir={self.data_dir}, venv_path={self.venv_path}) "
                f"[{type(exc).__name__}]: {exc}"
            ) from exc
        except OSError as exc:
            raise ConfigError(
                f"Filesystem error initializing paths (data_dir={self.data_dir}, venv_path={self.venv_path}) "
                f"[{type(exc).__name__}]: {exc}"
            ) from exc
        except Exception as exc:
            raise ConfigError(
                f"Unexpected error initializing paths (data_dir={self.data_dir}, venv_path={self.venv_path}) "
                f"[{type(exc).__name__}]: {exc}"
            ) from exc

    @cached_property
    def cache_dir(self) -> Path:
        """Directory for transient caches."""
        return self.data_dir / "cache"

    @cached_property
    def index_dir(self) -> Path:
        """Directory where index artifacts are stored."""
        return self.data_dir / "index"

    @cached_property
    def db_path(self) -> Path:
        """Default SQLite index path."""
        return self.index_dir / "codexlens.db"

    def ensure_runtime_dirs(self) -> None:
        """Create standard runtime directories if missing."""
        for directory in (self.cache_dir, self.index_dir):
            try:
                directory.mkdir(parents=True, exist_ok=True)
            except PermissionError as exc:
                raise ConfigError(
                    f"Permission denied creating directory {directory} [{type(exc).__name__}]: {exc}"
                ) from exc
            except OSError as exc:
                raise ConfigError(
                    f"Filesystem error creating directory {directory} [{type(exc).__name__}]: {exc}"
                ) from exc
            except Exception as exc:
                raise ConfigError(
                    f"Unexpected error creating directory {directory} [{type(exc).__name__}]: {exc}"
                ) from exc

    def language_for_path(self, path: str | Path) -> str | None:
        """Infer a supported language ID from a file path."""
        extension = Path(path).suffix.lower()
        for language_id, spec in self.supported_languages.items():
            extensions: List[str] = spec.get("extensions", [])
            if extension in extensions:
                return language_id
        return None

    def category_for_path(self, path: str | Path) -> str | None:
        """Get file category ('code' or 'doc') from a file path."""
        language = self.language_for_path(path)
        if language is None:
            return None
        spec = self.supported_languages.get(language, {})
        return spec.get("category")

    def rules_for_language(self, language_id: str) -> Dict[str, Any]:
        """Get parsing rules for a specific language, falling back to defaults."""
        return {**self.parsing_rules.get("default", {}), **self.parsing_rules.get(language_id, {})}

    @cached_property
    def settings_path(self) -> Path:
        """Path to the settings file."""
        return self.data_dir / SETTINGS_FILE_NAME

    def save_settings(self) -> None:
        """Save embedding and other settings to file."""
        embedding_config = {
            "backend": self.embedding_backend,
            "model": self.embedding_model,
            "use_gpu": self.embedding_use_gpu,
            "pool_enabled": self.embedding_pool_enabled,
            "strategy": self.embedding_strategy,
            "cooldown": self.embedding_cooldown,
        }
        # Include multi-endpoint config if present
        if self.embedding_endpoints:
            embedding_config["endpoints"] = self.embedding_endpoints

        settings = {
            "embedding": embedding_config,
            "llm": {
                "enabled": self.llm_enabled,
                "tool": self.llm_tool,
                "timeout_ms": self.llm_timeout_ms,
                "batch_size": self.llm_batch_size,
            },
            "reranker": {
                "enabled": self.enable_cross_encoder_rerank,
                "backend": self.reranker_backend,
                "model": self.reranker_model,
                "top_k": self.reranker_top_k,
                "max_input_tokens": self.reranker_max_input_tokens,
                "pool_enabled": self.reranker_pool_enabled,
                "strategy": self.reranker_strategy,
                "cooldown": self.reranker_cooldown,
            },
            "cascade": {
                "strategy": self.cascade_strategy,
                "coarse_k": self.cascade_coarse_k,
                "fine_k": self.cascade_fine_k,
            },
            "api": {
                "max_workers": self.api_max_workers,
                "batch_size": self.api_batch_size,
                "batch_size_dynamic": self.api_batch_size_dynamic,
                "batch_size_utilization_factor": self.api_batch_size_utilization_factor,
                "batch_size_max": self.api_batch_size_max,
                "chars_per_token_estimate": self.chars_per_token_estimate,
            },
        }
        with open(self.settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)

    def load_settings(self) -> None:
        """Load settings from file if exists."""
        if self.settings_path.exists():
            try:
                with open(self.settings_path, "r", encoding="utf-8") as f:
                    settings = json.load(f)

                # Load embedding settings
                embedding = settings.get("embedding", {})
                if "backend" in embedding:
                    backend = embedding["backend"]
                    # Support 'api' as alias for 'litellm'
                    if backend == "api":
                        backend = "litellm"
                    if backend in {"fastembed", "litellm"}:
                        self.embedding_backend = backend
                    else:
                        log.warning(
                            "Invalid embedding backend in %s: %r (expected 'fastembed' or 'litellm')",
                            self.settings_path,
                            embedding["backend"],
                        )
                if "model" in embedding:
                    self.embedding_model = embedding["model"]
                if "use_gpu" in embedding:
                    self.embedding_use_gpu = embedding["use_gpu"]

                # Load multi-endpoint configuration
                if "endpoints" in embedding:
                    self.embedding_endpoints = embedding["endpoints"]
                if "pool_enabled" in embedding:
                    self.embedding_pool_enabled = embedding["pool_enabled"]
                if "strategy" in embedding:
                    self.embedding_strategy = embedding["strategy"]
                if "cooldown" in embedding:
                    self.embedding_cooldown = embedding["cooldown"]

                # Load LLM settings
                llm = settings.get("llm", {})
                if "enabled" in llm:
                    self.llm_enabled = llm["enabled"]
                if "tool" in llm:
                    self.llm_tool = llm["tool"]
                if "timeout_ms" in llm:
                    self.llm_timeout_ms = llm["timeout_ms"]
                if "batch_size" in llm:
                    self.llm_batch_size = llm["batch_size"]

                # Load reranker settings
                reranker = settings.get("reranker", {})
                if "enabled" in reranker:
                    self.enable_cross_encoder_rerank = reranker["enabled"]
                if "backend" in reranker:
                    backend = reranker["backend"]
                    if backend in {"fastembed", "onnx", "api", "litellm", "legacy"}:
                        self.reranker_backend = backend
                    else:
                        log.warning(
                            "Invalid reranker backend in %s: %r (expected 'fastembed', 'onnx', 'api', 'litellm', or 'legacy')",
                            self.settings_path,
                            backend,
                        )
                if "model" in reranker:
                    self.reranker_model = reranker["model"]
                if "top_k" in reranker:
                    self.reranker_top_k = reranker["top_k"]
                if "max_input_tokens" in reranker:
                    self.reranker_max_input_tokens = reranker["max_input_tokens"]
                if "pool_enabled" in reranker:
                    self.reranker_pool_enabled = reranker["pool_enabled"]
                if "strategy" in reranker:
                    self.reranker_strategy = reranker["strategy"]
                if "cooldown" in reranker:
                    self.reranker_cooldown = reranker["cooldown"]

                # Load cascade settings
                cascade = settings.get("cascade", {})
                if "strategy" in cascade:
                    strategy = cascade["strategy"]
                    if strategy in {"binary", "binary_rerank", "dense_rerank", "staged"}:
                        self.cascade_strategy = strategy
                    else:
                        log.warning(
                            "Invalid cascade strategy in %s: %r (expected 'binary', 'binary_rerank', 'dense_rerank', or 'staged')",
                            self.settings_path,
                            strategy,
                        )
                if "coarse_k" in cascade:
                    self.cascade_coarse_k = cascade["coarse_k"]
                if "fine_k" in cascade:
                    self.cascade_fine_k = cascade["fine_k"]

                # Load API settings
                api = settings.get("api", {})
                if "max_workers" in api:
                    self.api_max_workers = api["max_workers"]
                if "batch_size" in api:
                    self.api_batch_size = api["batch_size"]
                if "batch_size_dynamic" in api:
                    self.api_batch_size_dynamic = api["batch_size_dynamic"]
                if "batch_size_utilization_factor" in api:
                    self.api_batch_size_utilization_factor = api["batch_size_utilization_factor"]
                if "batch_size_max" in api:
                    self.api_batch_size_max = api["batch_size_max"]
                if "chars_per_token_estimate" in api:
                    self.chars_per_token_estimate = api["chars_per_token_estimate"]
            except Exception as exc:
                log.warning(
                    "Failed to load settings from %s (%s): %s",
                    self.settings_path,
                    type(exc).__name__,
                    exc,
                )

        # Apply .env overrides (highest priority)
        self._apply_env_overrides()

    def _apply_env_overrides(self) -> None:
        """Apply environment variable overrides from .env file.

        Priority: default → settings.json → .env (highest)

        Supported variables (with or without CODEXLENS_ prefix):
            EMBEDDING_MODEL: Override embedding model/profile
            EMBEDDING_BACKEND: Override embedding backend (fastembed/litellm)
            EMBEDDING_POOL_ENABLED: Enable embedding high availability pool
            EMBEDDING_STRATEGY: Load balance strategy for embedding
            EMBEDDING_COOLDOWN: Rate limit cooldown for embedding
            RERANKER_MODEL: Override reranker model
            RERANKER_BACKEND: Override reranker backend
            RERANKER_ENABLED: Override reranker enabled state (true/false)
            RERANKER_POOL_ENABLED: Enable reranker high availability pool
            RERANKER_STRATEGY: Load balance strategy for reranker
            RERANKER_COOLDOWN: Rate limit cooldown for reranker
        """
        from .env_config import load_env_file

        env_vars = load_env_file(self.data_dir / ".env")
        if not env_vars:
            return

        def get_env(key: str) -> str | None:
            """Get env var with or without CODEXLENS_ prefix."""
            # Check prefixed version first (Dashboard format), then unprefixed
            return env_vars.get(f"CODEXLENS_{key}") or env_vars.get(key)

        def _parse_bool(value: str) -> bool:
            return value.strip().lower() in {"true", "1", "yes", "on"}

        # Cascade overrides
        cascade_enabled = get_env("ENABLE_CASCADE_SEARCH")
        if cascade_enabled:
            self.enable_cascade_search = _parse_bool(cascade_enabled)
            log.debug(
                "Overriding enable_cascade_search from .env: %s",
                self.enable_cascade_search,
            )

        cascade_strategy = get_env("CASCADE_STRATEGY")
        if cascade_strategy:
            strategy = cascade_strategy.strip().lower()
            if strategy in {"binary", "binary_rerank", "dense_rerank", "staged"}:
                self.cascade_strategy = strategy
                log.debug("Overriding cascade_strategy from .env: %s", self.cascade_strategy)
            else:
                log.warning("Invalid CASCADE_STRATEGY in .env: %r", cascade_strategy)

        cascade_coarse_k = get_env("CASCADE_COARSE_K")
        if cascade_coarse_k:
            try:
                self.cascade_coarse_k = int(cascade_coarse_k)
                log.debug("Overriding cascade_coarse_k from .env: %s", self.cascade_coarse_k)
            except ValueError:
                log.warning("Invalid CASCADE_COARSE_K in .env: %r", cascade_coarse_k)

        cascade_fine_k = get_env("CASCADE_FINE_K")
        if cascade_fine_k:
            try:
                self.cascade_fine_k = int(cascade_fine_k)
                log.debug("Overriding cascade_fine_k from .env: %s", self.cascade_fine_k)
            except ValueError:
                log.warning("Invalid CASCADE_FINE_K in .env: %r", cascade_fine_k)

        # Embedding overrides
        embedding_model = get_env("EMBEDDING_MODEL")
        if embedding_model:
            self.embedding_model = embedding_model
            log.debug("Overriding embedding_model from .env: %s", self.embedding_model)

        embedding_backend = get_env("EMBEDDING_BACKEND")
        if embedding_backend:
            backend = embedding_backend.lower()
            # Support 'api' as alias for 'litellm'
            if backend == "api":
                backend = "litellm"
            if backend in {"fastembed", "litellm"}:
                self.embedding_backend = backend
                log.debug("Overriding embedding_backend from .env: %s", backend)
            else:
                log.warning("Invalid EMBEDDING_BACKEND in .env: %r", embedding_backend)

        embedding_pool = get_env("EMBEDDING_POOL_ENABLED")
        if embedding_pool:
            value = embedding_pool.lower()
            self.embedding_pool_enabled = value in {"true", "1", "yes", "on"}
            log.debug("Overriding embedding_pool_enabled from .env: %s", self.embedding_pool_enabled)

        embedding_strategy = get_env("EMBEDDING_STRATEGY")
        if embedding_strategy:
            strategy = embedding_strategy.lower()
            if strategy in {"round_robin", "latency_aware", "weighted_random"}:
                self.embedding_strategy = strategy
                log.debug("Overriding embedding_strategy from .env: %s", strategy)
            else:
                log.warning("Invalid EMBEDDING_STRATEGY in .env: %r", embedding_strategy)

        embedding_cooldown = get_env("EMBEDDING_COOLDOWN")
        if embedding_cooldown:
            try:
                self.embedding_cooldown = float(embedding_cooldown)
                log.debug("Overriding embedding_cooldown from .env: %s", self.embedding_cooldown)
            except ValueError:
                log.warning("Invalid EMBEDDING_COOLDOWN in .env: %r", embedding_cooldown)

        # Reranker overrides
        reranker_model = get_env("RERANKER_MODEL")
        if reranker_model:
            self.reranker_model = reranker_model
            log.debug("Overriding reranker_model from .env: %s", self.reranker_model)

        reranker_backend = get_env("RERANKER_BACKEND")
        if reranker_backend:
            backend = reranker_backend.lower()
            if backend in {"fastembed", "onnx", "api", "litellm", "legacy"}:
                self.reranker_backend = backend
                log.debug("Overriding reranker_backend from .env: %s", backend)
            else:
                log.warning("Invalid RERANKER_BACKEND in .env: %r", reranker_backend)

        reranker_enabled = get_env("RERANKER_ENABLED")
        if reranker_enabled:
            value = reranker_enabled.lower()
            self.enable_cross_encoder_rerank = value in {"true", "1", "yes", "on"}
            log.debug("Overriding reranker_enabled from .env: %s", self.enable_cross_encoder_rerank)

        reranker_pool = get_env("RERANKER_POOL_ENABLED")
        if reranker_pool:
            value = reranker_pool.lower()
            self.reranker_pool_enabled = value in {"true", "1", "yes", "on"}
            log.debug("Overriding reranker_pool_enabled from .env: %s", self.reranker_pool_enabled)

        reranker_strategy = get_env("RERANKER_STRATEGY")
        if reranker_strategy:
            strategy = reranker_strategy.lower()
            if strategy in {"round_robin", "latency_aware", "weighted_random"}:
                self.reranker_strategy = strategy
                log.debug("Overriding reranker_strategy from .env: %s", strategy)
            else:
                log.warning("Invalid RERANKER_STRATEGY in .env: %r", reranker_strategy)

        reranker_cooldown = get_env("RERANKER_COOLDOWN")
        if reranker_cooldown:
            try:
                self.reranker_cooldown = float(reranker_cooldown)
                log.debug("Overriding reranker_cooldown from .env: %s", self.reranker_cooldown)
            except ValueError:
                log.warning("Invalid RERANKER_COOLDOWN in .env: %r", reranker_cooldown)

        reranker_max_tokens = get_env("RERANKER_MAX_INPUT_TOKENS")
        if reranker_max_tokens:
            try:
                self.reranker_max_input_tokens = int(reranker_max_tokens)
                log.debug("Overriding reranker_max_input_tokens from .env: %s", self.reranker_max_input_tokens)
            except ValueError:
                log.warning("Invalid RERANKER_MAX_INPUT_TOKENS in .env: %r", reranker_max_tokens)

        # Reranker tuning from environment
        test_penalty = get_env("RERANKER_TEST_FILE_PENALTY")
        if test_penalty:
            try:
                self.reranker_test_file_penalty = float(test_penalty)
                log.debug("Overriding reranker_test_file_penalty from .env: %s", self.reranker_test_file_penalty)
            except ValueError:
                log.warning("Invalid RERANKER_TEST_FILE_PENALTY in .env: %r", test_penalty)

        docstring_weight = get_env("RERANKER_DOCSTRING_WEIGHT")
        if docstring_weight:
            try:
                weight = float(docstring_weight)
                self.reranker_chunk_type_weights = {"code": 1.0, "docstring": weight}
                log.debug("Overriding reranker docstring weight from .env: %s", weight)
            except ValueError:
                log.warning("Invalid RERANKER_DOCSTRING_WEIGHT in .env: %r", docstring_weight)

        # Chunk stripping from environment
        strip_comments = get_env("CHUNK_STRIP_COMMENTS")
        if strip_comments:
            self.chunk_strip_comments = strip_comments.lower() in ("true", "1", "yes")
            log.debug("Overriding chunk_strip_comments from .env: %s", self.chunk_strip_comments)

        strip_docstrings = get_env("CHUNK_STRIP_DOCSTRINGS")
        if strip_docstrings:
            self.chunk_strip_docstrings = strip_docstrings.lower() in ("true", "1", "yes")
            log.debug("Overriding chunk_strip_docstrings from .env: %s", self.chunk_strip_docstrings)

        # Staged cascade overrides
        staged_stage2_mode = get_env("STAGED_STAGE2_MODE")
        if staged_stage2_mode:
            mode = staged_stage2_mode.strip().lower()
            if mode in {"precomputed", "realtime", "static_global_graph"}:
                self.staged_stage2_mode = mode
                log.debug("Overriding staged_stage2_mode from .env: %s", self.staged_stage2_mode)
            elif mode in {"live"}:
                self.staged_stage2_mode = "realtime"
                log.debug("Overriding staged_stage2_mode from .env: %s", self.staged_stage2_mode)
            else:
                log.warning("Invalid STAGED_STAGE2_MODE in .env: %r", staged_stage2_mode)

        staged_clustering_strategy = get_env("STAGED_CLUSTERING_STRATEGY")
        if staged_clustering_strategy:
            strategy = staged_clustering_strategy.strip().lower()
            if strategy in {"auto", "hdbscan", "dbscan", "frequency", "noop", "score", "dir_rr", "path"}:
                self.staged_clustering_strategy = strategy
                log.debug(
                    "Overriding staged_clustering_strategy from .env: %s",
                    self.staged_clustering_strategy,
                )
            elif strategy in {"none", "off"}:
                self.staged_clustering_strategy = "noop"
                log.debug(
                    "Overriding staged_clustering_strategy from .env: %s",
                    self.staged_clustering_strategy,
                )
            else:
                log.warning(
                    "Invalid STAGED_CLUSTERING_STRATEGY in .env: %r",
                    staged_clustering_strategy,
                )

        staged_clustering_min_size = get_env("STAGED_CLUSTERING_MIN_SIZE")
        if staged_clustering_min_size:
            try:
                self.staged_clustering_min_size = int(staged_clustering_min_size)
                log.debug(
                    "Overriding staged_clustering_min_size from .env: %s",
                    self.staged_clustering_min_size,
                )
            except ValueError:
                log.warning(
                    "Invalid STAGED_CLUSTERING_MIN_SIZE in .env: %r",
                    staged_clustering_min_size,
                )

        enable_staged_rerank = get_env("ENABLE_STAGED_RERANK")
        if enable_staged_rerank:
            self.enable_staged_rerank = _parse_bool(enable_staged_rerank)
            log.debug("Overriding enable_staged_rerank from .env: %s", self.enable_staged_rerank)

        rt_timeout = get_env("STAGED_REALTIME_LSP_TIMEOUT_S")
        if rt_timeout:
            try:
                self.staged_realtime_lsp_timeout_s = float(rt_timeout)
                log.debug(
                    "Overriding staged_realtime_lsp_timeout_s from .env: %s",
                    self.staged_realtime_lsp_timeout_s,
                )
            except ValueError:
                log.warning("Invalid STAGED_REALTIME_LSP_TIMEOUT_S in .env: %r", rt_timeout)

        rt_depth = get_env("STAGED_REALTIME_LSP_DEPTH")
        if rt_depth:
            try:
                self.staged_realtime_lsp_depth = int(rt_depth)
                log.debug(
                    "Overriding staged_realtime_lsp_depth from .env: %s",
                    self.staged_realtime_lsp_depth,
                )
            except ValueError:
                log.warning("Invalid STAGED_REALTIME_LSP_DEPTH in .env: %r", rt_depth)

        rt_max_nodes = get_env("STAGED_REALTIME_LSP_MAX_NODES")
        if rt_max_nodes:
            try:
                self.staged_realtime_lsp_max_nodes = int(rt_max_nodes)
                log.debug(
                    "Overriding staged_realtime_lsp_max_nodes from .env: %s",
                    self.staged_realtime_lsp_max_nodes,
                )
            except ValueError:
                log.warning("Invalid STAGED_REALTIME_LSP_MAX_NODES in .env: %r", rt_max_nodes)

        rt_max_seeds = get_env("STAGED_REALTIME_LSP_MAX_SEEDS")
        if rt_max_seeds:
            try:
                self.staged_realtime_lsp_max_seeds = int(rt_max_seeds)
                log.debug(
                    "Overriding staged_realtime_lsp_max_seeds from .env: %s",
                    self.staged_realtime_lsp_max_seeds,
                )
            except ValueError:
                log.warning("Invalid STAGED_REALTIME_LSP_MAX_SEEDS in .env: %r", rt_max_seeds)

        rt_max_concurrent = get_env("STAGED_REALTIME_LSP_MAX_CONCURRENT")
        if rt_max_concurrent:
            try:
                self.staged_realtime_lsp_max_concurrent = int(rt_max_concurrent)
                log.debug(
                    "Overriding staged_realtime_lsp_max_concurrent from .env: %s",
                    self.staged_realtime_lsp_max_concurrent,
                )
            except ValueError:
                log.warning(
                    "Invalid STAGED_REALTIME_LSP_MAX_CONCURRENT in .env: %r",
                    rt_max_concurrent,
                )

        rt_warmup = get_env("STAGED_REALTIME_LSP_WARMUP_S")
        if rt_warmup:
            try:
                self.staged_realtime_lsp_warmup_s = float(rt_warmup)
                log.debug(
                    "Overriding staged_realtime_lsp_warmup_s from .env: %s",
                    self.staged_realtime_lsp_warmup_s,
                )
            except ValueError:
                log.warning("Invalid STAGED_REALTIME_LSP_WARMUP_S in .env: %r", rt_warmup)

        rt_resolve = get_env("STAGED_REALTIME_LSP_RESOLVE_SYMBOLS")
        if rt_resolve:
            self.staged_realtime_lsp_resolve_symbols = _parse_bool(rt_resolve)
            log.debug(
                "Overriding staged_realtime_lsp_resolve_symbols from .env: %s",
                self.staged_realtime_lsp_resolve_symbols,
            )

    @classmethod
    def load(cls) -> "Config":
        """Load config with settings from file."""
        config = cls()
        config.load_settings()
        return config


@dataclass
class WorkspaceConfig:
    """Workspace-local configuration for CodexLens.

    Stores index data in project/.codexlens/ directory.
    """

    workspace_root: Path

    def __post_init__(self) -> None:
        self.workspace_root = Path(self.workspace_root).resolve()

    @property
    def codexlens_dir(self) -> Path:
        """The .codexlens directory in workspace root."""
        return self.workspace_root / WORKSPACE_DIR_NAME

    @property
    def db_path(self) -> Path:
        """SQLite index path for this workspace."""
        return self.codexlens_dir / "index.db"

    @property
    def cache_dir(self) -> Path:
        """Cache directory for this workspace."""
        return self.codexlens_dir / "cache"

    @property
    def env_path(self) -> Path:
        """Path to workspace .env file."""
        return self.codexlens_dir / ".env"

    def load_env(self, *, override: bool = False) -> int:
        """Load .env file and apply to os.environ.

        Args:
            override: If True, override existing environment variables

        Returns:
            Number of variables applied
        """
        from .env_config import apply_workspace_env
        return apply_workspace_env(self.workspace_root, override=override)

    def get_api_config(self, prefix: str) -> dict:
        """Get API configuration from environment.

        Args:
            prefix: Environment variable prefix (e.g., "RERANKER", "EMBEDDING")

        Returns:
            Dictionary with api_key, api_base, model, etc.
        """
        from .env_config import get_api_config
        return get_api_config(prefix, workspace_root=self.workspace_root)

    def initialize(self) -> None:
        """Create the .codexlens directory structure."""
        try:
            self.codexlens_dir.mkdir(parents=True, exist_ok=True)
            self.cache_dir.mkdir(parents=True, exist_ok=True)

            # Create .gitignore to exclude cache but keep index
            gitignore_path = self.codexlens_dir / ".gitignore"
            if not gitignore_path.exists():
                gitignore_path.write_text(
                    "# CodexLens workspace data\n"
                    "cache/\n"
                    "*.log\n"
                    ".env\n"  # Exclude .env from git
                )
        except Exception as exc:
            raise ConfigError(f"Failed to initialize workspace at {self.codexlens_dir}: {exc}") from exc

    def exists(self) -> bool:
        """Check if workspace is already initialized."""
        return self.codexlens_dir.is_dir() and self.db_path.exists()

    @classmethod
    def from_path(cls, path: Path) -> Optional["WorkspaceConfig"]:
        """Create WorkspaceConfig from a path by finding workspace root.

        Returns None if no workspace found.
        """
        root = find_workspace_root(path)
        if root is None:
            return None
        return cls(workspace_root=root)

    @classmethod
    def create_at(cls, path: Path) -> "WorkspaceConfig":
        """Create a new workspace at the given path."""
        config = cls(workspace_root=path)
        config.initialize()
        return config
