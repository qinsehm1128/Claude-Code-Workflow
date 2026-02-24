"""Incremental indexer for processing file changes."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from codexlens.config import Config
from codexlens.parsers.factory import ParserFactory
from codexlens.storage.dir_index import DirIndexStore
from codexlens.storage.global_index import GlobalSymbolIndex
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore

from .events import ChangeType, FileEvent, IndexResult

logger = logging.getLogger(__name__)


@dataclass
class FileIndexResult:
    """Result of indexing a single file."""
    path: Path
    symbols_count: int
    success: bool
    error: Optional[str] = None


class IncrementalIndexer:
    """Incremental indexer for processing file change events.
    
    Processes file events (create, modify, delete, move) and updates
    the corresponding index databases incrementally.
    
    Reuses existing infrastructure:
    - ParserFactory for symbol extraction
    - DirIndexStore for per-directory storage
    - GlobalSymbolIndex for cross-file symbols
    - PathMapper for source-to-index path conversion
    
    Example:
        indexer = IncrementalIndexer(registry, mapper, config)
        result = indexer.process_changes([
            FileEvent(Path("foo.py"), ChangeType.MODIFIED, time.time()),
        ])
        print(f"Indexed {result.files_indexed} files")
    """
    
    def __init__(
        self,
        registry: RegistryStore,
        mapper: PathMapper,
        config: Optional[Config] = None,
    ) -> None:
        """Initialize incremental indexer.
        
        Args:
            registry: Global project registry
            mapper: Path mapper for source-to-index conversion
            config: CodexLens configuration (uses defaults if None)
        """
        self.registry = registry
        self.mapper = mapper
        self.config = config or Config()
        self.parser_factory = ParserFactory(self.config)
        
        self._global_index: Optional[GlobalSymbolIndex] = None
        self._dir_stores: dict[Path, DirIndexStore] = {}
        self._lock = __import__("threading").RLock()
    
    def _get_global_index(self, index_root: Path, source_root: Optional[Path] = None) -> Optional[GlobalSymbolIndex]:
        """Get or create global symbol index.

        Args:
            index_root: Root directory containing the global symbol index DB
            source_root: Source directory root for looking up project_id from registry
        """
        if not self.config.global_symbol_index_enabled:
            return None

        if self._global_index is None:
            global_db_path = index_root / GlobalSymbolIndex.DEFAULT_DB_NAME
            if global_db_path.exists():
                # Get project_id from registry using source_root
                project_id = 0  # Default fallback
                if source_root:
                    project_info = self.registry.get_project(source_root)
                    if project_info:
                        project_id = project_info.id
                try:
                    self._global_index = GlobalSymbolIndex(global_db_path, project_id=project_id)
                    # Ensure schema exists (best-effort). The DB should already be initialized
                    # by `codexlens index init`, but watcher/index-update should be robust.
                    self._global_index.initialize()
                except Exception as exc:
                    logger.debug(
                        "Failed to initialize global symbol index at %s: %s",
                        global_db_path,
                        exc,
                    )
                    self._global_index = None

        return self._global_index
    
    def _get_dir_store(self, dir_path: Path) -> Optional[DirIndexStore]:
        """Get DirIndexStore for a directory, if indexed."""
        with self._lock:
            if dir_path in self._dir_stores:
                return self._dir_stores[dir_path]
            
            index_db = self.mapper.source_to_index_db(dir_path)
            if not index_db.exists():
                logger.debug("No index found for directory: %s", dir_path)
                return None
            
            # Get index root for global index
            source_root = self.mapper.get_project_root(dir_path) or dir_path
            index_root = self.mapper.source_to_index_dir(source_root)
            global_index = self._get_global_index(index_root, source_root=source_root)
            
            store = DirIndexStore(
                index_db,
                config=self.config,
                global_index=global_index,
            )
            self._dir_stores[dir_path] = store
            return store
    
    def process_changes(self, events: List[FileEvent]) -> IndexResult:
        """Process a batch of file change events.
        
        Args:
            events: List of file events to process
            
        Returns:
            IndexResult with statistics
        """
        result = IndexResult()
        
        for event in events:
            try:
                if event.change_type == ChangeType.CREATED:
                    file_result = self._index_file(event.path)
                    if file_result.success:
                        result.files_indexed += 1
                        result.symbols_added += file_result.symbols_count
                    else:
                        result.errors.append(file_result.error or f"Failed to index: {event.path}")
                
                elif event.change_type == ChangeType.MODIFIED:
                    file_result = self._index_file(event.path)
                    if file_result.success:
                        result.files_indexed += 1
                        result.symbols_added += file_result.symbols_count
                    else:
                        result.errors.append(file_result.error or f"Failed to index: {event.path}")
                
                elif event.change_type == ChangeType.DELETED:
                    self._remove_file(event.path)
                    result.files_removed += 1
                
                elif event.change_type == ChangeType.MOVED:
                    # Remove from old location, add at new location
                    if event.old_path:
                        self._remove_file(event.old_path)
                        result.files_removed += 1
                    file_result = self._index_file(event.path)
                    if file_result.success:
                        result.files_indexed += 1
                        result.symbols_added += file_result.symbols_count
                    else:
                        result.errors.append(file_result.error or f"Failed to index: {event.path}")
                
            except Exception as exc:
                error_msg = f"Error processing {event.path}: {type(exc).__name__}: {exc}"
                logger.error(error_msg)
                result.errors.append(error_msg)
        
        return result
    
    def _index_file(self, path: Path) -> FileIndexResult:
        """Index a single file.

        Args:
            path: Path to the file to index

        Returns:
            FileIndexResult with status
        """
        path = Path(path).resolve()

        # Check if file exists
        if not path.exists():
            return FileIndexResult(
                path=path,
                symbols_count=0,
                success=False,
                error=f"File not found: {path}",
            )

        # Check if language is supported
        language = self.config.language_for_path(path)
        if not language:
            return FileIndexResult(
                path=path,
                symbols_count=0,
                success=False,
                error=f"Unsupported language for: {path}",
            )

        # Get directory store
        dir_path = path.parent
        store = self._get_dir_store(dir_path)
        if store is None:
            return FileIndexResult(
                path=path,
                symbols_count=0,
                success=False,
                error=f"Directory not indexed: {dir_path}",
            )

        # Read file content with fallback encodings
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            logger.debug("UTF-8 decode failed for %s, using fallback with errors='ignore'", path)
            try:
                content = path.read_text(encoding="utf-8", errors="ignore")
            except Exception as exc:
                return FileIndexResult(
                    path=path,
                    symbols_count=0,
                    success=False,
                    error=f"Failed to read file: {exc}",
                )
        except Exception as exc:
            return FileIndexResult(
                path=path,
                symbols_count=0,
                success=False,
                error=f"Failed to read file: {exc}",
            )

        # Parse symbols
        try:
            parser = self.parser_factory.get_parser(language)
            indexed_file = parser.parse(content, path)
        except Exception as exc:
            error_msg = f"Failed to parse {path}: {type(exc).__name__}: {exc}"
            logger.error(error_msg)
            return FileIndexResult(
                path=path,
                symbols_count=0,
                success=False,
                error=error_msg,
            )

        # Update store with retry logic for transient database errors
        max_retries = 3
        for attempt in range(max_retries):
            try:
                store.add_file(
                    name=path.name,
                    full_path=str(path),
                    content=content,
                    language=language,
                    symbols=indexed_file.symbols,
                    relationships=indexed_file.relationships,
                )

                # Update merkle root
                store.update_merkle_root()

                # Update global relationships for static graph expansion (best-effort).
                if getattr(self.config, "static_graph_enabled", False):
                    try:
                        source_root = self.mapper.get_project_root(path) or dir_path
                        index_root = self.mapper.source_to_index_dir(source_root)
                        global_index = self._get_global_index(index_root, source_root=source_root)
                        if global_index is not None:
                            allowed_types = set(
                                getattr(
                                    self.config,
                                    "static_graph_relationship_types",
                                    ["imports", "inherits"],
                                )
                                or []
                            )
                            filtered_rels = [
                                r
                                for r in (indexed_file.relationships or [])
                                if r.relationship_type.value in allowed_types
                            ]
                            global_index.update_file_relationships(path, filtered_rels)
                    except Exception as exc:
                        logger.debug(
                            "Failed to update global relationships for %s: %s",
                            path,
                            exc,
                        )

                logger.debug("Indexed file: %s (%d symbols)", path, len(indexed_file.symbols))

                return FileIndexResult(
                    path=path,
                    symbols_count=len(indexed_file.symbols),
                    success=True,
                )

            except __import__("sqlite3").OperationalError as exc:
                # Transient database errors (e.g., database locked)
                if attempt < max_retries - 1:
                    import time
                    wait_time = 0.1 * (2 ** attempt)  # Exponential backoff
                    logger.debug("Database operation failed (attempt %d/%d), retrying in %.2fs: %s",
                                attempt + 1, max_retries, wait_time, exc)
                    time.sleep(wait_time)
                    continue
                else:
                    error_msg = f"Failed to store {path} after {max_retries} attempts: {exc}"
                    logger.error(error_msg)
                    return FileIndexResult(
                        path=path,
                        symbols_count=0,
                        success=False,
                        error=error_msg,
                    )
            except Exception as exc:
                error_msg = f"Failed to store {path}: {type(exc).__name__}: {exc}"
                logger.error(error_msg)
                return FileIndexResult(
                    path=path,
                    symbols_count=0,
                    success=False,
                    error=error_msg,
                )

        # Should never reach here
        return FileIndexResult(
            path=path,
            symbols_count=0,
            success=False,
            error="Unexpected error in indexing loop",
        )
    
    def _remove_file(self, path: Path) -> bool:
        """Remove a file from the index.

        Args:
            path: Path to the file to remove

        Returns:
            True if removed successfully
        """
        path = Path(path).resolve()
        dir_path = path.parent

        store = self._get_dir_store(dir_path)
        if store is None:
            logger.debug("Cannot remove file, directory not indexed: %s", dir_path)
            return False

        # Retry logic for transient database errors
        max_retries = 3
        for attempt in range(max_retries):
            try:
                store.remove_file(str(path))
                store.update_merkle_root()

                # Best-effort cleanup of static graph relationships (keeps global DB consistent).
                if getattr(self.config, "static_graph_enabled", False):
                    try:
                        source_root = self.mapper.get_project_root(path) or dir_path
                        index_root = self.mapper.source_to_index_dir(source_root)
                        global_index = self._get_global_index(index_root, source_root=source_root)
                        if global_index is not None:
                            global_index.delete_file_relationships(path)
                    except Exception as exc:
                        logger.debug(
                            "Failed to delete global relationships for %s: %s",
                            path,
                            exc,
                        )
                logger.debug("Removed file from index: %s", path)
                return True

            except __import__("sqlite3").OperationalError as exc:
                # Transient database errors (e.g., database locked)
                if attempt < max_retries - 1:
                    import time
                    wait_time = 0.1 * (2 ** attempt)  # Exponential backoff
                    logger.debug("Database operation failed (attempt %d/%d), retrying in %.2fs: %s",
                                attempt + 1, max_retries, wait_time, exc)
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error("Failed to remove %s after %d attempts: %s", path, max_retries, exc)
                    return False
            except Exception as exc:
                logger.error("Failed to remove %s: %s", path, exc)
                return False

        # Should never reach here
        return False
    
    def close(self) -> None:
        """Close all open stores."""
        with self._lock:
            for store in self._dir_stores.values():
                try:
                    store.close()
                except Exception:
                    pass
            self._dir_stores.clear()
            
            if self._global_index:
                try:
                    self._global_index.close()
                except Exception:
                    pass
                self._global_index = None
