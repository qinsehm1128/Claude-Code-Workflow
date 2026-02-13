"""Global cross-directory symbol index for fast lookups.

Stores symbols for an entire project in a single SQLite database so symbol search
does not require traversing every directory _index.db.

This index is updated incrementally during file indexing (delete+insert per file)
to avoid expensive batch rebuilds.
"""

from __future__ import annotations

import logging
import sqlite3
import threading
from pathlib import Path
from typing import List, Optional, Tuple

from codexlens.entities import CodeRelationship, Symbol
from codexlens.errors import StorageError


class GlobalSymbolIndex:
    """Project-wide symbol index with incremental updates."""

    SCHEMA_VERSION = 2
    DEFAULT_DB_NAME = "_global_symbols.db"

    def __init__(self, db_path: str | Path, project_id: int) -> None:
        self.db_path = Path(db_path).resolve()
        self.project_id = int(project_id)
        self._lock = threading.RLock()
        self._conn: Optional[sqlite3.Connection] = None
        self.logger = logging.getLogger(__name__)

    def initialize(self) -> None:
        """Create database and schema if not exists."""
        with self._lock:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            conn = self._get_connection()

            current_version = self._get_schema_version(conn)
            if current_version > self.SCHEMA_VERSION:
                raise StorageError(
                    f"Database schema version {current_version} is newer than "
                    f"supported version {self.SCHEMA_VERSION}. "
                    f"Please update the application or use a compatible database.",
                    db_path=str(self.db_path),
                    operation="initialize",
                    details={
                        "current_version": current_version,
                        "supported_version": self.SCHEMA_VERSION,
                    },
                )

            if current_version == 0:
                self._create_schema(conn)
                self._set_schema_version(conn, self.SCHEMA_VERSION)
            elif current_version < self.SCHEMA_VERSION:
                self._apply_migrations(conn, current_version)
                self._set_schema_version(conn, self.SCHEMA_VERSION)

            conn.commit()

    def close(self) -> None:
        """Close database connection."""
        with self._lock:
            if self._conn is not None:
                try:
                    self._conn.close()
                except Exception:
                    pass
                finally:
                    self._conn = None

    def __enter__(self) -> "GlobalSymbolIndex":
        self.initialize()
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        self.close()

    def add_symbol(self, symbol: Symbol, file_path: str | Path, index_path: str | Path) -> None:
        """Insert a single symbol (idempotent) for incremental updates."""
        file_path_str = str(Path(file_path).resolve())
        index_path_str = str(Path(index_path).resolve())

        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute(
                    """
                    INSERT INTO global_symbols(
                        project_id, symbol_name, symbol_kind,
                        file_path, start_line, end_line, index_path
                    )
                    VALUES(?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(
                        project_id, symbol_name, symbol_kind,
                        file_path, start_line, end_line
                    )
                    DO UPDATE SET
                        index_path=excluded.index_path
                    """,
                    (
                        self.project_id,
                        symbol.name,
                        symbol.kind,
                        file_path_str,
                        symbol.range[0],
                        symbol.range[1],
                        index_path_str,
                    ),
                )
                conn.commit()
            except sqlite3.DatabaseError as exc:
                conn.rollback()
                raise StorageError(
                    f"Failed to add symbol {symbol.name}: {exc}",
                    db_path=str(self.db_path),
                    operation="add_symbol",
                ) from exc

    def update_file_symbols(
        self,
        file_path: str | Path,
        symbols: List[Symbol],
        index_path: str | Path | None = None,
    ) -> None:
        """Replace all symbols for a file atomically (delete + insert)."""
        file_path_str = str(Path(file_path).resolve())

        index_path_str: Optional[str]
        if index_path is not None:
            index_path_str = str(Path(index_path).resolve())
        else:
            index_path_str = self._get_existing_index_path(file_path_str)

        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute("BEGIN")
                conn.execute(
                    "DELETE FROM global_symbols WHERE project_id=? AND file_path=?",
                    (self.project_id, file_path_str),
                )

                if symbols:
                    if not index_path_str:
                        raise StorageError(
                            "index_path is required when inserting symbols for a new file",
                            db_path=str(self.db_path),
                            operation="update_file_symbols",
                            details={"file_path": file_path_str},
                        )

                    rows = [
                        (
                            self.project_id,
                            s.name,
                            s.kind,
                            file_path_str,
                            s.range[0],
                            s.range[1],
                            index_path_str,
                        )
                        for s in symbols
                    ]
                    conn.executemany(
                        """
                        INSERT INTO global_symbols(
                            project_id, symbol_name, symbol_kind,
                            file_path, start_line, end_line, index_path
                        )
                        VALUES(?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(
                            project_id, symbol_name, symbol_kind,
                            file_path, start_line, end_line
                        )
                        DO UPDATE SET
                            index_path=excluded.index_path
                        """,
                        rows,
                    )

                conn.commit()
            except sqlite3.DatabaseError as exc:
                conn.rollback()
                raise StorageError(
                    f"Failed to update symbols for {file_path_str}: {exc}",
                    db_path=str(self.db_path),
                    operation="update_file_symbols",
                ) from exc

    def delete_file_symbols(self, file_path: str | Path) -> int:
        """Remove all symbols for a file. Returns number of rows deleted."""
        file_path_str = str(Path(file_path).resolve())
        with self._lock:
            conn = self._get_connection()
            try:
                cur = conn.execute(
                    "DELETE FROM global_symbols WHERE project_id=? AND file_path=?",
                    (self.project_id, file_path_str),
                )
                conn.commit()
                return int(cur.rowcount or 0)
            except sqlite3.DatabaseError as exc:
                conn.rollback()
                raise StorageError(
                    f"Failed to delete symbols for {file_path_str}: {exc}",
                    db_path=str(self.db_path),
                    operation="delete_file_symbols",
                ) from exc

    def search(
        self,
        name: str,
        kind: Optional[str] = None,
        limit: int = 50,
        prefix_mode: bool = True,
    ) -> List[Symbol]:
        """Search symbols and return full Symbol objects."""
        if prefix_mode:
            pattern = f"{name}%"
        else:
            pattern = f"%{name}%"

        with self._lock:
            conn = self._get_connection()
            if kind:
                rows = conn.execute(
                    """
                    SELECT symbol_name, symbol_kind, file_path, start_line, end_line
                    FROM global_symbols
                    WHERE project_id=? AND symbol_name LIKE ? AND symbol_kind=?
                    ORDER BY symbol_name
                    LIMIT ?
                    """,
                    (self.project_id, pattern, kind, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT symbol_name, symbol_kind, file_path, start_line, end_line
                    FROM global_symbols
                    WHERE project_id=? AND symbol_name LIKE ?
                    ORDER BY symbol_name
                    LIMIT ?
                    """,
                    (self.project_id, pattern, limit),
                ).fetchall()

            return [
                Symbol(
                    name=row["symbol_name"],
                    kind=row["symbol_kind"],
                    range=(row["start_line"], row["end_line"]),
                    file=row["file_path"],
                )
                for row in rows
            ]

    def search_symbols(
        self,
        name: str,
        kind: Optional[str] = None,
        limit: int = 50,
        prefix_mode: bool = True,
    ) -> List[Tuple[str, Tuple[int, int]]]:
        """Search symbols and return only (file_path, (start_line, end_line))."""
        symbols = self.search(name=name, kind=kind, limit=limit, prefix_mode=prefix_mode)
        return [(s.file or "", s.range) for s in symbols]

    def get_file_symbols(self, file_path: str | Path) -> List[Symbol]:
        """Get all symbols in a specific file, sorted by start_line.

        Args:
            file_path: Full path to the file

        Returns:
            List of Symbol objects sorted by start_line
        """
        file_path_str = str(Path(file_path).resolve())

        with self._lock:
            conn = self._get_connection()
            rows = conn.execute(
                """
                SELECT symbol_name, symbol_kind, file_path, start_line, end_line
                FROM global_symbols
                WHERE project_id=? AND file_path=?
                ORDER BY start_line
                """,
                (self.project_id, file_path_str),
            ).fetchall()

            return [
                Symbol(
                    name=row["symbol_name"],
                    kind=row["symbol_kind"],
                    range=(row["start_line"], row["end_line"]),
                    file=row["file_path"],
                )
                for row in rows
            ]

    # ------------------------------------------------------------------
    # Relationship CRUD
    # ------------------------------------------------------------------

    def update_file_relationships(
        self,
        file_path: str | Path,
        relationships: List[CodeRelationship],
    ) -> None:
        """Replace all relationships for a file atomically (delete + insert).

        Uses the same delete-then-insert pattern as ``update_file_symbols``.
        The *target_qualified_name* stored in the DB is built from
        ``target_file`` (when available) and ``target_symbol`` so that
        cross-directory lookups work correctly.
        """
        file_path_str = str(Path(file_path).resolve())

        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute("BEGIN")
                conn.execute(
                    "DELETE FROM global_relationships WHERE project_id=? AND source_file=?",
                    (self.project_id, file_path_str),
                )

                if relationships:
                    rows = [
                        (
                            self.project_id,
                            file_path_str,
                            rel.source_symbol,
                            self._build_qualified_name(rel),
                            rel.relationship_type.value,
                            rel.source_line,
                        )
                        for rel in relationships
                    ]
                    conn.executemany(
                        """
                        INSERT INTO global_relationships(
                            project_id, source_file, source_symbol,
                            target_qualified_name, relationship_type, source_line
                        )
                        VALUES(?, ?, ?, ?, ?, ?)
                        """,
                        rows,
                    )

                conn.commit()
            except sqlite3.DatabaseError as exc:
                conn.rollback()
                raise StorageError(
                    f"Failed to update relationships for {file_path_str}: {exc}",
                    db_path=str(self.db_path),
                    operation="update_file_relationships",
                ) from exc

    def query_by_target(
        self,
        target_name: str,
        limit: int = 50,
        prefix_mode: bool = True,
    ) -> List[Tuple[str, str, str, int]]:
        """Query relationships by target_qualified_name.

        Returns list of ``(source_file, source_symbol, relationship_type, source_line)``.
        When *prefix_mode* is True the target_name is matched as a prefix;
        otherwise an exact match is required.
        """
        if prefix_mode:
            pattern = f"{target_name}%"
        else:
            pattern = target_name

        with self._lock:
            conn = self._get_connection()
            if prefix_mode:
                rows = conn.execute(
                    """
                    SELECT source_file, source_symbol, relationship_type, source_line
                    FROM global_relationships
                    WHERE project_id=? AND target_qualified_name LIKE ?
                    ORDER BY source_file, source_line
                    LIMIT ?
                    """,
                    (self.project_id, pattern, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT source_file, source_symbol, relationship_type, source_line
                    FROM global_relationships
                    WHERE project_id=? AND target_qualified_name=?
                    ORDER BY source_file, source_line
                    LIMIT ?
                    """,
                    (self.project_id, pattern, limit),
                ).fetchall()

            return [
                (
                    row["source_file"],
                    row["source_symbol"],
                    row["relationship_type"],
                    row["source_line"],
                )
                for row in rows
            ]

    def query_relationships_for_symbols(
        self,
        symbol_names: List[str],
        limit: int = 100,
    ) -> List[sqlite3.Row]:
        """Query all relationships involving any of *symbol_names*.

        Matches against both ``source_symbol`` and ``target_qualified_name``
        (the target column is checked with a LIKE ``%name%`` pattern so that
        qualified names like ``mod.ClassName`` still match ``ClassName``).
        """
        if not symbol_names:
            return []

        with self._lock:
            conn = self._get_connection()
            # Build WHERE clause: (source_symbol IN (...)) OR (target LIKE ...)
            source_placeholders = ",".join("?" for _ in symbol_names)
            target_clauses = " OR ".join(
                "target_qualified_name LIKE ?" for _ in symbol_names
            )
            target_patterns = [f"%{name}" for name in symbol_names]

            sql = f"""
                SELECT id, project_id, source_file, source_symbol,
                       target_qualified_name, relationship_type, source_line
                FROM global_relationships
                WHERE project_id=?
                  AND (
                      source_symbol IN ({source_placeholders})
                      OR ({target_clauses})
                  )
                ORDER BY source_file, source_line
                LIMIT ?
            """
            params: list = [self.project_id, *symbol_names, *target_patterns, limit]
            return conn.execute(sql, params).fetchall()

    def delete_file_relationships(self, file_path: str | Path) -> int:
        """Remove all relationships for a file. Returns number of rows deleted."""
        file_path_str = str(Path(file_path).resolve())
        with self._lock:
            conn = self._get_connection()
            try:
                cur = conn.execute(
                    "DELETE FROM global_relationships WHERE project_id=? AND source_file=?",
                    (self.project_id, file_path_str),
                )
                conn.commit()
                return int(cur.rowcount or 0)
            except sqlite3.DatabaseError as exc:
                conn.rollback()
                raise StorageError(
                    f"Failed to delete relationships for {file_path_str}: {exc}",
                    db_path=str(self.db_path),
                    operation="delete_file_relationships",
                ) from exc

    @staticmethod
    def _build_qualified_name(rel: CodeRelationship) -> str:
        """Build a qualified name from a CodeRelationship.

        Format: ``<target_file>::<target_symbol>`` when target_file is known,
        otherwise just ``<target_symbol>``.
        """
        if rel.target_file:
            return f"{rel.target_file}::{rel.target_symbol}"
        return rel.target_symbol

    def _get_existing_index_path(self, file_path_str: str) -> Optional[str]:
        with self._lock:
            conn = self._get_connection()
            row = conn.execute(
                """
                SELECT index_path
                FROM global_symbols
                WHERE project_id=? AND file_path=?
                LIMIT 1
                """,
                (self.project_id, file_path_str),
            ).fetchone()
            return str(row["index_path"]) if row else None

    def _get_schema_version(self, conn: sqlite3.Connection) -> int:
        try:
            row = conn.execute("PRAGMA user_version").fetchone()
            return int(row[0]) if row else 0
        except Exception:
            return 0

    def _set_schema_version(self, conn: sqlite3.Connection, version: int) -> None:
        conn.execute(f"PRAGMA user_version = {int(version)}")

    def _apply_migrations(self, conn: sqlite3.Connection, from_version: int) -> None:
        if from_version < 2:
            self._migrate_v1_to_v2(conn)

    def _migrate_v1_to_v2(self, conn: sqlite3.Connection) -> None:
        """Add global_relationships table for v1 -> v2 migration."""
        try:
            self._create_relationships_schema(conn)
        except sqlite3.DatabaseError as exc:
            raise StorageError(
                f"Failed to migrate schema from v1 to v2: {exc}",
                db_path=str(self.db_path),
                operation="_migrate_v1_to_v2",
            ) from exc

    def _get_connection(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA synchronous=NORMAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
            self._conn.execute("PRAGMA mmap_size=30000000000")
        return self._conn

    def _create_schema(self, conn: sqlite3.Connection) -> None:
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS global_symbols (
                    id INTEGER PRIMARY KEY,
                    project_id INTEGER NOT NULL,
                    symbol_name TEXT NOT NULL,
                    symbol_kind TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    start_line INTEGER,
                    end_line INTEGER,
                    index_path TEXT NOT NULL,
                    UNIQUE(
                        project_id, symbol_name, symbol_kind,
                        file_path, start_line, end_line
                    )
                )
                """
            )

            # Required by optimization spec.
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_global_symbols_name_kind
                ON global_symbols(symbol_name, symbol_kind)
                """
            )
            # Used by common queries (project-scoped name lookups).
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_global_symbols_project_name_kind
                ON global_symbols(project_id, symbol_name, symbol_kind)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_global_symbols_project_file
                ON global_symbols(project_id, file_path)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_global_symbols_project_index_path
                ON global_symbols(project_id, index_path)
                """
            )

            self._create_relationships_schema(conn)
        except sqlite3.DatabaseError as exc:
            raise StorageError(
                f"Failed to initialize global symbol schema: {exc}",
                db_path=str(self.db_path),
                operation="_create_schema",
            ) from exc

    def _create_relationships_schema(self, conn: sqlite3.Connection) -> None:
        """Create the global_relationships table and indexes (idempotent)."""
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS global_relationships (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL,
                source_file TEXT NOT NULL,
                source_symbol TEXT NOT NULL,
                target_qualified_name TEXT NOT NULL,
                relationship_type TEXT NOT NULL,
                source_line INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_global_rel_project_target
            ON global_relationships(project_id, target_qualified_name)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_global_rel_project_source
            ON global_relationships(project_id, source_file)
            """
        )

