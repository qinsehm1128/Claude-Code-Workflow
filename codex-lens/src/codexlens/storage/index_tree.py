"""Hierarchical index tree builder for CodexLens.

Constructs a bottom-up directory index tree with parallel processing support.
Each directory maintains its own _index.db with files and subdirectory links.
"""

from __future__ import annotations

import logging
import os
import re
import sqlite3
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from codexlens.config import Config
from codexlens.parsers.factory import ParserFactory
from codexlens.storage.dir_index import DirIndexStore
from codexlens.storage.global_index import GlobalSymbolIndex
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import ProjectInfo, RegistryStore


@dataclass
class BuildResult:
    """Complete build operation result."""

    project_id: int
    source_root: Path
    index_root: Path
    total_files: int
    total_dirs: int
    errors: List[str]


@dataclass
class DirBuildResult:
    """Single directory build result."""

    source_path: Path
    index_path: Path
    files_count: int
    symbols_count: int
    subdirs: List[str]  # Subdirectory names
    error: Optional[str] = None


class IndexTreeBuilder:
    """Hierarchical index tree builder with parallel processing.

    Builds directory indexes bottom-up to enable proper subdirectory linking.
    Each directory gets its own _index.db containing:
    - Files in that directory
    - Links to child directory indexes
    - Symbols and FTS5 search

    Attributes:
        registry: Global project registry
        mapper: Path mapping between source and index
        config: CodexLens configuration
        parser_factory: Parser factory for symbol extraction
        logger: Logger instance
        IGNORE_DIRS: Set of directory names to skip during indexing
    """

    # Directories to skip during indexing
    IGNORE_DIRS: Set[str] = {
        ".git",
        ".venv",
        "venv",
        "node_modules",
        "__pycache__",
        ".codexlens",
        ".idea",
        ".vscode",
    }

    def __init__(
        self, registry: RegistryStore, mapper: PathMapper, config: Config = None, incremental: bool = True
    ):
        """Initialize the index tree builder.

        Args:
            registry: Global registry store for project tracking
            mapper: Path mapper for source to index conversions
            config: CodexLens configuration (uses defaults if None)
            incremental: Enable incremental indexing (default True)
        """
        self.registry = registry
        self.mapper = mapper
        self.config = config or Config()
        self.parser_factory = ParserFactory(self.config)
        self.logger = logging.getLogger(__name__)
        self.incremental = incremental

    def build(
        self,
        source_root: Path,
        languages: List[str] = None,
        workers: int = None,
        force_full: bool = False,
    ) -> BuildResult:
        """Build complete index tree for a project.

        Process:
        1. Register project in registry
        2. Collect all directories grouped by depth
        3. Build indexes bottom-up (deepest first)
        4. Link subdirectories to parents
        5. Update project statistics
        6. Cleanup deleted files (if incremental mode)

        Args:
            source_root: Project root directory to index
            languages: Optional list of language IDs to limit indexing
            workers: Number of parallel worker processes
            force_full: Force full reindex (override incremental mode)

        Returns:
            BuildResult with statistics and errors

        Raises:
            ValueError: If source_root doesn't exist
        """
        source_root = source_root.resolve()
        if not source_root.exists():
            raise ValueError(f"Source root does not exist: {source_root}")

        # Auto-detect optimal worker count if not specified
        if workers is None:
            workers = min(os.cpu_count() or 4, 16)  # Cap at 16 workers
            self.logger.debug("Auto-detected %d workers for parallel indexing", workers)

        # Override incremental mode if force_full is True
        use_incremental = self.incremental and not force_full
        if force_full:
            self.logger.info("Building index tree for %s (FULL reindex)", source_root)
        else:
            self.logger.info("Building index tree for %s (incremental=%s)", source_root, use_incremental)

        # Register project
        index_root = self.mapper.source_to_index_dir(source_root)
        project_info = self.registry.register_project(source_root, index_root)
        global_index_db_path = index_root / GlobalSymbolIndex.DEFAULT_DB_NAME

        global_index: GlobalSymbolIndex | None = None
        if self.config.global_symbol_index_enabled:
            global_index = GlobalSymbolIndex(global_index_db_path, project_id=project_info.id)
            global_index.initialize()

        # Report progress: discovering files (5%)
        print("Discovering files...", flush=True)

        # Collect directories by depth
        dirs_by_depth = self._collect_dirs_by_depth(source_root, languages)

        if not dirs_by_depth:
            self.logger.warning("No indexable directories found in %s", source_root)
            if global_index is not None:
                global_index.close()
            return BuildResult(
                project_id=project_info.id,
                source_root=source_root,
                index_root=index_root,
                total_files=0,
                total_dirs=0,
                errors=["No indexable directories found"],
            )

        # Calculate total directories for progress tracking
        total_dirs_to_process = sum(len(dirs) for dirs in dirs_by_depth.values())
        processed_dirs = 0

        # Report progress: building index (10%)
        print("Building index...", flush=True)

        total_files = 0
        total_dirs = 0
        all_errors: List[str] = []
        all_results: List[DirBuildResult] = []  # Store all results for subdir linking

        # Build bottom-up (highest depth first)
        max_depth = max(dirs_by_depth.keys())
        for depth in range(max_depth, -1, -1):
            if depth not in dirs_by_depth:
                continue

            dirs = dirs_by_depth[depth]
            self.logger.info("Building %d directories at depth %d", len(dirs), depth)

            # Build directories at this level in parallel
            results = self._build_level_parallel(
                dirs,
                languages,
                workers,
                project_id=project_info.id,
                global_index_db_path=global_index_db_path,
            )
            all_results.extend(results)

            # Process results
            for result in results:
                if result.error:
                    all_errors.append(f"{result.source_path}: {result.error}")
                    processed_dirs += 1
                    continue

                total_files += result.files_count
                total_dirs += 1
                processed_dirs += 1

                # Report progress for each processed directory (10-80%)
                # Use "Processing file" format for frontend parser compatibility
                progress_percent = 10 + int((processed_dirs / total_dirs_to_process) * 70)
                print(f"Processing file {processed_dirs}/{total_dirs_to_process}: {result.source_path.name}", flush=True)

                # Register directory in registry
                self.registry.register_dir(
                    project_id=project_info.id,
                    source_path=result.source_path,
                    index_path=result.index_path,
                    depth=self.mapper.get_relative_depth(result.source_path, source_root),
                    files_count=result.files_count,
                )

        # Report progress: linking subdirectories (80%)
        print("Linking subdirectories...", flush=True)

        # After building all directories, link subdirectories to parents
        # This needs to happen after all indexes exist
        for result in all_results:
            if result.error:
                continue
            # Link children to this directory
            self._link_children_to_parent(result.source_path, all_results)

        # Cleanup deleted files if in incremental mode
        if use_incremental:
            # Report progress: cleaning up (90%)
            print("Cleaning up deleted files...", flush=True)
            self.logger.info("Cleaning up deleted files...")
            total_deleted = 0
            for result in all_results:
                if result.error:
                    continue
                try:
                    with DirIndexStore(result.index_path, config=self.config, global_index=global_index) as store:
                        deleted_count = store.cleanup_deleted_files(result.source_path)
                        if deleted_count > 0:
                            _compute_graph_neighbors(store, logger=self.logger)
                        store.update_merkle_root()
                        total_deleted += deleted_count
                        if deleted_count > 0:
                            self.logger.debug("Removed %d deleted files from %s", deleted_count, result.source_path)
                except Exception as exc:
                    self.logger.warning("Cleanup failed for %s: %s", result.source_path, exc)

            if total_deleted > 0:
                self.logger.info("Removed %d deleted files from index", total_deleted)

        # Report progress: finalizing (95%)
        print("Finalizing...", flush=True)

        # Update project statistics
        self.registry.update_project_stats(source_root, total_files, total_dirs)

        # Report completion (100%)
        print(f"Indexed {total_files} files", flush=True)

        self.logger.info(
            "Index build complete: %d files, %d directories, %d errors",
            total_files,
            total_dirs,
            len(all_errors),
        )

        if global_index is not None:
            global_index.close()

        return BuildResult(
            project_id=project_info.id,
            source_root=source_root,
            index_root=index_root,
            total_files=total_files,
            total_dirs=total_dirs,
            errors=all_errors,
        )

    def update_subtree(
        self,
        source_path: Path,
        languages: List[str] = None,
        workers: int = None,
    ) -> BuildResult:
        """Incrementally update a subtree.

        Rebuilds indexes for the specified directory and all subdirectories.
        Useful for incremental updates when only part of the tree changed.

        Args:
            source_path: Root of subtree to update
            languages: Optional list of language IDs to limit indexing
            workers: Number of parallel worker processes

        Returns:
            BuildResult for the subtree

        Raises:
            ValueError: If source_path is not indexed
        """
        source_path = source_path.resolve()
        project_root = self.mapper.get_project_root(source_path)

        # Get project info
        project_info = self.registry.get_project(project_root)
        if not project_info:
            raise ValueError(f"Directory not indexed: {source_path}")

        self.logger.info("Updating subtree at %s", source_path)

        # Use build logic but start from source_path
        return self.build(source_path, languages, workers)

    def rebuild_dir(self, source_path: Path) -> DirBuildResult:
        """Rebuild index for a single directory.

        Only rebuilds the specified directory, does not touch subdirectories.
        Useful for updating a single directory after file changes.

        Args:
            source_path: Directory to rebuild

        Returns:
            DirBuildResult for the directory
        """
        source_path = source_path.resolve()
        self.logger.info("Rebuilding directory %s", source_path)
        project_root = self.mapper.get_project_root(source_path)
        project_info = self.registry.get_project(project_root)
        if not project_info:
            raise ValueError(f"Directory not indexed: {source_path}")

        global_index_db_path = project_info.index_root / GlobalSymbolIndex.DEFAULT_DB_NAME
        return self._build_single_dir(
            source_path,
            languages=None,
            project_id=project_info.id,
            global_index_db_path=global_index_db_path,
        )

    # === Internal Methods ===

    def _collect_dirs_by_depth(
        self, source_root: Path, languages: List[str] = None
    ) -> Dict[int, List[Path]]:
        """Collect all indexable directories grouped by depth.

        Walks the directory tree and groups directories by their depth
        relative to source_root. Depth 0 is the root itself.

        Args:
            source_root: Root directory to start from
            languages: Optional language filter

        Returns:
            Dictionary mapping depth to list of directory paths
            Example: {0: [root], 1: [src, tests], 2: [src/api, src/utils]}
        """
        source_root = source_root.resolve()
        dirs_by_depth: Dict[int, List[Path]] = {}

        # Always include the root directory at depth 0 for chain search entry point
        dirs_by_depth[0] = [source_root]

        for root, dirnames, _ in os.walk(source_root):
            # Filter out ignored directories
            dirnames[:] = [
                d
                for d in dirnames
                if d not in self.IGNORE_DIRS and not d.startswith(".")
            ]

            root_path = Path(root)

            # Skip root (already added)
            if root_path == source_root:
                continue

            # Check if this directory should be indexed
            if not self._should_index_dir(root_path, languages):
                continue

            # Calculate depth relative to source_root
            try:
                depth = len(root_path.relative_to(source_root).parts)
            except ValueError:
                continue

            if depth not in dirs_by_depth:
                dirs_by_depth[depth] = []

            dirs_by_depth[depth].append(root_path)

        return dirs_by_depth

    def _should_index_dir(self, dir_path: Path, languages: List[str] = None) -> bool:
        """Check if directory should be indexed.

        A directory is indexed if:
        1. It's not in IGNORE_DIRS
        2. It doesn't start with '.'
        3. It contains at least one supported language file, OR
        4. It has subdirectories that contain supported files (transitive)

        Args:
            dir_path: Directory to check
            languages: Optional language filter

        Returns:
            True if directory should be indexed
        """
        # Check directory name
        if dir_path.name in self.IGNORE_DIRS or dir_path.name.startswith("."):
            return False

        # Check for supported files in this directory
        source_files = self._iter_source_files(dir_path, languages)
        if len(source_files) > 0:
            return True

        # Check if any subdirectory has indexable files (transitive)
        # This handles cases like 'src' which has no direct files but has 'src/codexlens'
        for item in dir_path.iterdir():
            if not item.is_dir():
                continue
            if item.name in self.IGNORE_DIRS or item.name.startswith("."):
                continue
            # Recursively check subdirectories
            if self._has_indexable_files_recursive(item, languages):
                return True

        return False

    def _has_indexable_files_recursive(self, dir_path: Path, languages: List[str] = None) -> bool:
        """Check if directory or any subdirectory has indexable files.

        Args:
            dir_path: Directory to check
            languages: Optional language filter

        Returns:
            True if directory tree contains indexable files
        """
        # Check for supported files in this directory
        source_files = self._iter_source_files(dir_path, languages)
        if len(source_files) > 0:
            return True

        # Check subdirectories
        try:
            for item in dir_path.iterdir():
                if not item.is_dir():
                    continue
                if item.name in self.IGNORE_DIRS or item.name.startswith("."):
                    continue
                if self._has_indexable_files_recursive(item, languages):
                    return True
        except PermissionError:
            pass

        return False

    def _build_level_parallel(
        self,
        dirs: List[Path],
        languages: List[str],
        workers: int,
        *,
        project_id: int,
        global_index_db_path: Path,
    ) -> List[DirBuildResult]:
        """Build multiple directories in parallel.

        Uses ProcessPoolExecutor to build directories concurrently.
        All directories at the same level are independent and can be
        processed in parallel.

        Args:
            dirs: List of directories to build
            languages: Language filter
            workers: Number of worker processes

        Returns:
            List of DirBuildResult objects
        """
        results: List[DirBuildResult] = []

        if not dirs:
            return results

        # For single directory, avoid overhead of process pool
        if len(dirs) == 1:
            result = self._build_single_dir(
                dirs[0],
                languages,
                project_id=project_id,
                global_index_db_path=global_index_db_path,
            )
            return [result]

        # Prepare arguments for worker processes
        config_dict = {
            "data_dir": str(self.config.data_dir),
            "supported_languages": self.config.supported_languages,
            "parsing_rules": self.config.parsing_rules,
            "global_symbol_index_enabled": self.config.global_symbol_index_enabled,
            "static_graph_enabled": self.config.static_graph_enabled,
            "static_graph_relationship_types": self.config.static_graph_relationship_types,
            "use_astgrep": getattr(self.config, "use_astgrep", False),
        }

        worker_args = [
            (
                dir_path,
                self.mapper.source_to_index_db(dir_path),
                languages,
                config_dict,
                int(project_id),
                str(global_index_db_path),
            )
            for dir_path in dirs
        ]

        # Execute in parallel
        with ProcessPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(_build_dir_worker, args): args[0]
                for args in worker_args
            }

            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as exc:
                    dir_path = futures[future]
                    self.logger.error("Failed to build %s: %s", dir_path, exc)
                    results.append(
                        DirBuildResult(
                            source_path=dir_path,
                            index_path=self.mapper.source_to_index_db(dir_path),
                            files_count=0,
                            symbols_count=0,
                            subdirs=[],
                            error=str(exc),
                        )
                    )

        return results

    def _build_single_dir(
        self,
        dir_path: Path,
        languages: List[str] = None,
        *,
        project_id: int,
        global_index_db_path: Path,
    ) -> DirBuildResult:
        """Build index for a single directory.

        Creates _index.db and indexes all files in the directory.
        Does not recurse into subdirectories.

        Args:
            dir_path: Directory to index
            languages: Optional language filter

        Returns:
            DirBuildResult with statistics and subdirectory list
        """
        dir_path = dir_path.resolve()
        index_db_path = self.mapper.source_to_index_db(dir_path)

        global_index: GlobalSymbolIndex | None = None
        try:
            # Ensure index directory exists
            index_db_path.parent.mkdir(parents=True, exist_ok=True)

            # Create directory index
            if self.config.global_symbol_index_enabled:
                global_index = GlobalSymbolIndex(global_index_db_path, project_id=project_id)
                global_index.initialize()

            store = DirIndexStore(index_db_path, config=self.config, global_index=global_index)
            store.initialize()

            # Get source files in this directory only
            source_files = self._iter_source_files(dir_path, languages)

            files_count = 0
            symbols_count = 0
            skipped_count = 0

            for file_path in source_files:
                try:
                    # Check if file needs reindexing (incremental mode)
                    if self.incremental and not store.needs_reindex(file_path):
                        skipped_count += 1
                        continue

                    # Read and parse file
                    text = file_path.read_text(encoding="utf-8", errors="ignore")
                    language_id = self.config.language_for_path(file_path)
                    if not language_id:
                        continue

                    parser = self.parser_factory.get_parser(language_id)
                    indexed_file = parser.parse(text, file_path)

                    # Add to directory index
                    store.add_file(
                        name=file_path.name,
                        full_path=file_path,
                        content=text,
                        language=language_id,
                        symbols=indexed_file.symbols,
                        relationships=indexed_file.relationships,
                    )

                    # Write global relationships if enabled
                    if (
                        self.config.static_graph_enabled
                        and global_index is not None
                        and indexed_file.relationships
                    ):
                        try:
                            filtered_rels = [
                                r for r in indexed_file.relationships
                                if r.relationship_type.value in self.config.static_graph_relationship_types
                            ]
                            if filtered_rels:
                                global_index.update_file_relationships(
                                    file_path, filtered_rels
                                )
                        except Exception as rel_exc:
                            self.logger.warning(
                                "Failed to write global relationships for %s: %s",
                                file_path, rel_exc,
                            )

                    files_count += 1
                    symbols_count += len(indexed_file.symbols)

                except Exception as exc:
                    self.logger.debug("Failed to index %s: %s", file_path, exc)
                    continue

            if files_count > 0:
                _compute_graph_neighbors(store, logger=self.logger)

            # Get list of subdirectories
            subdirs = [
                d.name
                for d in dir_path.iterdir()
                if d.is_dir()
                and d.name not in self.IGNORE_DIRS
                and not d.name.startswith(".")
            ]

            store.update_merkle_root()
            store.close()
            if global_index is not None:
                global_index.close()

            if skipped_count > 0:
                self.logger.debug(
                    "Built %s: %d files indexed, %d skipped (unchanged), %d symbols, %d subdirs",
                    dir_path,
                    files_count,
                    skipped_count,
                    symbols_count,
                    len(subdirs),
                )
            else:
                self.logger.debug(
                    "Built %s: %d files, %d symbols, %d subdirs",
                    dir_path,
                    files_count,
                    symbols_count,
                    len(subdirs),
                )

            return DirBuildResult(
                source_path=dir_path,
                index_path=index_db_path,
                files_count=files_count,
                symbols_count=symbols_count,
                subdirs=subdirs,
            )

        except Exception as exc:
            self.logger.error("Failed to build directory %s: %s", dir_path, exc)
            if global_index is not None:
                try:
                    global_index.close()
                except Exception:
                    pass
            return DirBuildResult(
                source_path=dir_path,
                index_path=index_db_path,
                files_count=0,
                symbols_count=0,
                subdirs=[],
                error=str(exc),
            )

    def _link_children_to_parent(
        self, parent_path: Path, all_results: List[DirBuildResult]
    ) -> None:
        """Link child directory indexes to parent's subdirs table.

        Finds all direct children of parent_path in all_results and
        registers them as subdirectories in the parent's index.

        Args:
            parent_path: Parent directory path
            all_results: List of all build results
        """
        parent_index_db = self.mapper.source_to_index_db(parent_path)

        try:
            with DirIndexStore(parent_index_db, config=self.config) as store:
                for result in all_results:
                    # Only register direct children (parent is one level up)
                    if result.source_path.parent != parent_path:
                        continue

                    if result.error:
                        continue

                    # Register subdirectory link
                    store.register_subdir(
                        name=result.source_path.name,
                        index_path=result.index_path,
                        files_count=result.files_count,
                        direct_files=result.files_count,
                    )
                    self.logger.debug(
                        "Linked %s to parent %s",
                        result.source_path.name,
                        parent_path,
                    )

                store.update_merkle_root()

        except Exception as exc:
            self.logger.error(
                "Failed to link children to %s: %s", parent_path, exc
            )

    def _iter_source_files(
        self, dir_path: Path, languages: List[str] = None
    ) -> List[Path]:
        """Iterate source files in directory (non-recursive).

        Returns files in the specified directory that match language filters.
        Does not recurse into subdirectories.

        Args:
            dir_path: Directory to scan
            languages: Optional language filter

        Returns:
            List of source file paths
        """
        files: List[Path] = []

        if not dir_path.is_dir():
            return files

        for item in dir_path.iterdir():
            if not item.is_file():
                continue

            if item.name.startswith("."):
                continue

            # Check language support
            language_id = self.config.language_for_path(item)
            if not language_id:
                continue

            # Apply language filter
            if languages and language_id not in languages:
                continue

            files.append(item)

        return files


def _normalize_relationship_target(target: str) -> str:
    """Best-effort normalization of a relationship target into a local symbol name."""
    target = (target or "").strip()
    if not target:
        return ""

    # Drop trailing call parentheses when present (e.g., "foo()" -> "foo").
    if target.endswith("()"):
        target = target[:-2]

    # Keep the leaf identifier for common qualified formats.
    for sep in ("::", ".", "#"):
        if sep in target:
            target = target.split(sep)[-1]

    # Strip non-identifier suffix/prefix noise.
    target = re.sub(r"^[^A-Za-z0-9_]+", "", target)
    target = re.sub(r"[^A-Za-z0-9_]+$", "", target)
    return target


def _compute_graph_neighbors(
    store: DirIndexStore,
    *,
    max_depth: int = 2,
    logger: Optional[logging.Logger] = None,
) -> None:
    """Compute and persist N-hop neighbors for all symbols in a directory index."""
    if max_depth <= 0:
        return

    log = logger or logging.getLogger(__name__)

    with store._lock:
        conn = store._get_connection()
        conn.row_factory = sqlite3.Row

        # Ensure schema exists even for older databases pinned to the same user_version.
        try:
            from codexlens.storage.migrations.migration_007_add_graph_neighbors import upgrade

            upgrade(conn)
        except Exception as exc:
            log.debug("Graph neighbor schema ensure failed: %s", exc)

        cursor = conn.cursor()

        try:
            cursor.execute("DELETE FROM graph_neighbors")
        except sqlite3.Error:
            # Table missing or schema mismatch; skip gracefully.
            return

        try:
            symbol_rows = cursor.execute(
                "SELECT id, file_id, name FROM symbols"
            ).fetchall()
            rel_rows = cursor.execute(
                "SELECT source_symbol_id, target_qualified_name FROM code_relationships"
            ).fetchall()
        except sqlite3.Error:
            return

        if not symbol_rows or not rel_rows:
            try:
                conn.commit()
            except sqlite3.Error:
                pass
            return

        symbol_file_by_id: Dict[int, int] = {}
        symbols_by_file_and_name: Dict[Tuple[int, str], List[int]] = {}
        symbols_by_name: Dict[str, List[int]] = {}

        for row in symbol_rows:
            symbol_id = int(row["id"])
            file_id = int(row["file_id"])
            name = str(row["name"])
            symbol_file_by_id[symbol_id] = file_id
            symbols_by_file_and_name.setdefault((file_id, name), []).append(symbol_id)
            symbols_by_name.setdefault(name, []).append(symbol_id)

        adjacency: Dict[int, Set[int]] = {}

        for row in rel_rows:
            source_id = int(row["source_symbol_id"])
            target_raw = str(row["target_qualified_name"] or "")
            target_name = _normalize_relationship_target(target_raw)
            if not target_name:
                continue

            source_file_id = symbol_file_by_id.get(source_id)
            if source_file_id is None:
                continue

            candidate_ids = symbols_by_file_and_name.get((source_file_id, target_name))
            if not candidate_ids:
                global_candidates = symbols_by_name.get(target_name, [])
                # Only resolve cross-file by name when unambiguous.
                candidate_ids = global_candidates if len(global_candidates) == 1 else []

            for target_id in candidate_ids:
                if target_id == source_id:
                    continue
                adjacency.setdefault(source_id, set()).add(target_id)
                adjacency.setdefault(target_id, set()).add(source_id)

        if not adjacency:
            try:
                conn.commit()
            except sqlite3.Error:
                pass
            return

        insert_rows: List[Tuple[int, int, int]] = []
        max_depth = min(int(max_depth), 2)

        for source_id, first_hop in adjacency.items():
            if not first_hop:
                continue
            for neighbor_id in first_hop:
                insert_rows.append((source_id, neighbor_id, 1))

            if max_depth < 2:
                continue

            second_hop: Set[int] = set()
            for neighbor_id in first_hop:
                second_hop.update(adjacency.get(neighbor_id, set()))

            second_hop.discard(source_id)
            second_hop.difference_update(first_hop)

            for neighbor_id in second_hop:
                insert_rows.append((source_id, neighbor_id, 2))

        if not insert_rows:
            try:
                conn.commit()
            except sqlite3.Error:
                pass
            return

        try:
            cursor.executemany(
                """
                INSERT INTO graph_neighbors(
                    source_symbol_id, neighbor_symbol_id, relationship_depth
                )
                VALUES(?, ?, ?)
                """,
                insert_rows,
            )
            conn.commit()
        except sqlite3.Error:
            return


# === Worker Function for ProcessPoolExecutor ===


def _build_dir_worker(args: tuple) -> DirBuildResult:
    """Worker function for parallel directory building.

    Must be at module level for ProcessPoolExecutor pickling.
    Reconstructs necessary objects from serializable arguments.

    Args:
        args: Tuple of (dir_path, index_db_path, languages, config_dict, project_id, global_index_db_path)

    Returns:
        DirBuildResult for the directory
    """
    dir_path, index_db_path, languages, config_dict, project_id, global_index_db_path = args

    # Reconstruct config
    config = Config(
        data_dir=Path(config_dict["data_dir"]),
        supported_languages=config_dict["supported_languages"],
        parsing_rules=config_dict["parsing_rules"],
        global_symbol_index_enabled=bool(config_dict.get("global_symbol_index_enabled", True)),
        static_graph_enabled=bool(config_dict.get("static_graph_enabled", False)),
        static_graph_relationship_types=list(config_dict.get("static_graph_relationship_types", ["imports", "inherits"])),
        use_astgrep=bool(config_dict.get("use_astgrep", False)),
    )

    parser_factory = ParserFactory(config)

    global_index: GlobalSymbolIndex | None = None
    try:
        # Ensure index directory exists
        index_db_path.parent.mkdir(parents=True, exist_ok=True)

        # Create directory index
        if config.global_symbol_index_enabled and global_index_db_path:
            global_index = GlobalSymbolIndex(Path(global_index_db_path), project_id=int(project_id))
            global_index.initialize()

        store = DirIndexStore(index_db_path, config=config, global_index=global_index)
        store.initialize()

        files_count = 0
        symbols_count = 0

        # Index files in this directory
        for item in dir_path.iterdir():
            if not item.is_file():
                continue

            if item.name.startswith("."):
                continue

            language_id = config.language_for_path(item)
            if not language_id:
                continue

            if languages and language_id not in languages:
                continue

            try:
                text = item.read_text(encoding="utf-8", errors="ignore")
                parser = parser_factory.get_parser(language_id)
                indexed_file = parser.parse(text, item)

                store.add_file(
                    name=item.name,
                    full_path=item,
                    content=text,
                    language=language_id,
                    symbols=indexed_file.symbols,
                    relationships=indexed_file.relationships,
                )

                # Write global relationships if enabled
                if (
                    config.static_graph_enabled
                    and global_index is not None
                    and indexed_file.relationships
                ):
                    try:
                        allowed_types = config.static_graph_relationship_types
                        filtered_rels = [
                            r for r in indexed_file.relationships
                            if r.relationship_type.value in allowed_types
                        ]
                        if filtered_rels:
                            global_index.update_file_relationships(
                                item, filtered_rels
                            )
                    except Exception:
                        pass  # Don't block indexing

                files_count += 1
                symbols_count += len(indexed_file.symbols)

            except Exception:
                continue

        if files_count > 0:
            _compute_graph_neighbors(store)

        # Get subdirectories
        ignore_dirs = {
            ".git",
            ".venv",
            "venv",
            "node_modules",
            "__pycache__",
            ".codexlens",
            ".idea",
            ".vscode",
        }

        subdirs = [
            d.name
            for d in dir_path.iterdir()
            if d.is_dir() and d.name not in ignore_dirs and not d.name.startswith(".")
        ]

        store.update_merkle_root()
        store.close()
        if global_index is not None:
            global_index.close()

        return DirBuildResult(
            source_path=dir_path,
            index_path=index_db_path,
            files_count=files_count,
            symbols_count=symbols_count,
            subdirs=subdirs,
        )

    except Exception as exc:
        if global_index is not None:
            try:
                global_index.close()
            except Exception:
                pass
        return DirBuildResult(
            source_path=dir_path,
            index_path=index_db_path,
            files_count=0,
            symbols_count=0,
            subdirs=[],
            error=str(exc),
        )
