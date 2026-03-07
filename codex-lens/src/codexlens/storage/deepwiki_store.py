"""DeepWiki SQLite storage for documentation index.

Stores mappings between source files, code symbols, and generated documentation
for the DeepWiki documentation generation system.

Schema:
- deepwiki_files: Tracked source files with content hashes
- deepwiki_docs: Generated documentation files
- deepwiki_symbols: Symbol-to-documentation mappings
"""

from __future__ import annotations

import hashlib
import json
import logging
import math  # noqa: F401 - used in calculate_staleness_score
import sqlite3
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from codexlens.errors import StorageError
from codexlens.storage.deepwiki_models import DeepWikiDoc, DeepWikiFile, DeepWikiSymbol

logger = logging.getLogger(__name__)


class DeepWikiStore:
    """SQLite storage for DeepWiki documentation index.

    Provides:
    - File tracking with content hashes for incremental updates
    - Symbol-to-documentation mappings for navigation
    - Documentation file metadata tracking

    Thread-safe with connection pooling and WAL mode.
    """

    DEFAULT_DB_PATH = Path.home() / ".codexlens" / "deepwiki_index.db"
    SCHEMA_VERSION = 2

    def __init__(self, db_path: Path | None = None) -> None:
        """Initialize DeepWiki store.

        Args:
            db_path: Path to SQLite database file. Uses default if None.
        """
        self.db_path = (db_path or self.DEFAULT_DB_PATH).resolve()
        self._lock = threading.RLock()
        self._local = threading.local()
        self._pool_lock = threading.Lock()
        self._pool: Dict[int, sqlite3.Connection] = {}
        self._pool_generation = 0

    def _get_connection(self) -> sqlite3.Connection:
        """Get or create a thread-local database connection.

        Each thread gets its own connection with WAL mode enabled.
        """
        thread_id = threading.get_ident()
        if getattr(self._local, "generation", None) == self._pool_generation:
            conn = getattr(self._local, "conn", None)
            if conn is not None:
                return conn

        with self._pool_lock:
            conn = self._pool.get(thread_id)
            if conn is None:
                conn = sqlite3.connect(self.db_path, check_same_thread=False)
                conn.row_factory = sqlite3.Row
                conn.execute("PRAGMA journal_mode=WAL")
                conn.execute("PRAGMA synchronous=NORMAL")
                conn.execute("PRAGMA foreign_keys=ON")
                self._pool[thread_id] = conn

            self._local.conn = conn
            self._local.generation = self._pool_generation
            return conn

    def close(self) -> None:
        """Close all pooled connections."""
        with self._lock:
            with self._pool_lock:
                for conn in self._pool.values():
                    conn.close()
                self._pool.clear()
                self._pool_generation += 1

            if hasattr(self._local, "conn"):
                self._local.conn = None
            if hasattr(self._local, "generation"):
                self._local.generation = self._pool_generation

    def __enter__(self) -> DeepWikiStore:
        self.initialize()
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        self.close()

    def initialize(self) -> None:
        """Create database and schema if not exists."""
        with self._lock:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            conn = self._get_connection()
            self._create_schema(conn)

    def _create_schema(self, conn: sqlite3.Connection) -> None:
        """Create DeepWiki database schema."""
        try:
            # Schema version tracking
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS deepwiki_schema (
                    version INTEGER PRIMARY KEY,
                    applied_at REAL
                )
                """
            )

            # Files table: track indexed source files
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS deepwiki_files (
                    id INTEGER PRIMARY KEY,
                    path TEXT UNIQUE NOT NULL,
                    content_hash TEXT NOT NULL,
                    last_indexed REAL NOT NULL,
                    symbols_count INTEGER DEFAULT 0,
                    docs_generated INTEGER DEFAULT 0,
                    staleness_score REAL DEFAULT 0.0,
                    last_checked_commit TEXT,
                    last_checked_at REAL,
                    staleness_factors TEXT
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_deepwiki_files_path ON deepwiki_files(path)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_deepwiki_files_hash ON deepwiki_files(content_hash)"
            )

            # Docs table: track generated documentation files
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS deepwiki_docs (
                    id INTEGER PRIMARY KEY,
                    path TEXT UNIQUE NOT NULL,
                    content_hash TEXT NOT NULL,
                    symbols TEXT DEFAULT '[]',
                    generated_at REAL NOT NULL,
                    llm_tool TEXT
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_deepwiki_docs_path ON deepwiki_docs(path)"
            )

            # Symbols table: map source symbols to documentation
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS deepwiki_symbols (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    source_file TEXT NOT NULL,
                    doc_file TEXT NOT NULL,
                    anchor TEXT NOT NULL,
                    start_line INTEGER NOT NULL,
                    end_line INTEGER NOT NULL,
                    created_at REAL,
                    updated_at REAL,
                    staleness_score REAL DEFAULT 0.0,
                    last_checked_commit TEXT,
                    last_checked_at REAL,
                    staleness_factors TEXT,
                    UNIQUE(name, source_file)
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_deepwiki_symbols_name ON deepwiki_symbols(name)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_deepwiki_symbols_source ON deepwiki_symbols(source_file)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_deepwiki_symbols_doc ON deepwiki_symbols(doc_file)"
            )

            # Generation progress table for LLM document generation tracking
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS generation_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol_key TEXT NOT NULL UNIQUE,
                    file_path TEXT NOT NULL,
                    symbol_name TEXT NOT NULL,
                    symbol_type TEXT NOT NULL,
                    layer INTEGER NOT NULL,
                    source_hash TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    attempts INTEGER DEFAULT 0,
                    last_tool TEXT,
                    last_error TEXT,
                    generated_at REAL,
                    created_at REAL,
                    updated_at REAL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_progress_status ON generation_progress(status)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_progress_file ON generation_progress(file_path)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_progress_hash ON generation_progress(source_hash)"
            )

            # Record schema version
            conn.execute(
                """
                INSERT OR IGNORE INTO deepwiki_schema(version, applied_at)
                VALUES(?, ?)
                """,
                (self.SCHEMA_VERSION, time.time()),
            )

            # Schema v2 migration: add staleness columns
            staleness_columns = [
                ("deepwiki_files", "staleness_score", "REAL DEFAULT 0.0"),
                ("deepwiki_files", "last_checked_commit", "TEXT"),
                ("deepwiki_files", "last_checked_at", "REAL"),
                ("deepwiki_files", "staleness_factors", "TEXT"),
                ("deepwiki_symbols", "staleness_score", "REAL DEFAULT 0.0"),
                ("deepwiki_symbols", "last_checked_commit", "TEXT"),
                ("deepwiki_symbols", "last_checked_at", "REAL"),
                ("deepwiki_symbols", "staleness_factors", "TEXT"),
            ]
            for table, col, col_type in staleness_columns:
                try:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                except sqlite3.OperationalError:
                    pass  # Column already exists

            # Legacy migration: some earlier DeepWiki DBs stored timestamps as TEXT (ISO strings).
            # better-sqlite3 + JS code expects numeric (REAL) seconds, so ensure timestamp columns
            # have REAL affinity by rebuilding affected tables when needed.
            self._migrate_text_timestamps_to_real(conn)

            conn.commit()
        except sqlite3.DatabaseError as exc:
            raise StorageError(
                f"Failed to initialize DeepWiki schema: {exc}",
                db_path=str(self.db_path),
                operation="initialize",
            ) from exc

    def _normalize_path(self, path: str | Path) -> str:
        """Normalize path for storage (forward slashes).

        Args:
            path: Path to normalize.

        Returns:
            Normalized path string with forward slashes.
        """
        return str(Path(path).resolve()).replace("\\", "/")

    def _migrate_text_timestamps_to_real(self, conn: sqlite3.Connection) -> None:
        """Migrate legacy TEXT timestamp columns to REAL affinity.

        SQLite's type system is dynamic, but column affinity influences how values are stored and
        returned. Older DeepWiki databases used TEXT timestamps (often ISO strings). The current
        schema uses REAL epoch seconds. When we detect TEXT affinity on timestamp columns, we
        rebuild the table with REAL columns and convert existing values during copy.
        """

        self._rebuild_table_with_timestamp_conversion(
            conn,
            table="deepwiki_files",
            create_sql="""
                CREATE TABLE deepwiki_files (
                    id INTEGER PRIMARY KEY,
                    path TEXT UNIQUE NOT NULL,
                    content_hash TEXT NOT NULL,
                    last_indexed REAL NOT NULL,
                    symbols_count INTEGER DEFAULT 0,
                    docs_generated INTEGER DEFAULT 0,
                    staleness_score REAL DEFAULT 0.0,
                    last_checked_commit TEXT,
                    last_checked_at REAL,
                    staleness_factors TEXT
                )
            """,
            timestamp_columns={"last_indexed", "last_checked_at"},
            required_timestamp_columns={"last_indexed"},
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_deepwiki_files_path ON deepwiki_files(path)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_deepwiki_files_hash ON deepwiki_files(content_hash)"
        )

        self._rebuild_table_with_timestamp_conversion(
            conn,
            table="deepwiki_docs",
            create_sql="""
                CREATE TABLE deepwiki_docs (
                    id INTEGER PRIMARY KEY,
                    path TEXT UNIQUE NOT NULL,
                    content_hash TEXT NOT NULL,
                    symbols TEXT DEFAULT '[]',
                    generated_at REAL NOT NULL,
                    llm_tool TEXT
                )
            """,
            timestamp_columns={"generated_at"},
            required_timestamp_columns={"generated_at"},
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_deepwiki_docs_path ON deepwiki_docs(path)")

        self._rebuild_table_with_timestamp_conversion(
            conn,
            table="deepwiki_symbols",
            create_sql="""
                CREATE TABLE deepwiki_symbols (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    source_file TEXT NOT NULL,
                    doc_file TEXT NOT NULL,
                    anchor TEXT NOT NULL,
                    start_line INTEGER NOT NULL,
                    end_line INTEGER NOT NULL,
                    created_at REAL,
                    updated_at REAL,
                    staleness_score REAL DEFAULT 0.0,
                    last_checked_commit TEXT,
                    last_checked_at REAL,
                    staleness_factors TEXT,
                    UNIQUE(name, source_file)
                )
            """,
            timestamp_columns={"created_at", "updated_at", "last_checked_at"},
            required_timestamp_columns=set(),
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_deepwiki_symbols_name ON deepwiki_symbols(name)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_deepwiki_symbols_source ON deepwiki_symbols(source_file)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_deepwiki_symbols_doc ON deepwiki_symbols(doc_file)"
        )

        self._rebuild_table_with_timestamp_conversion(
            conn,
            table="generation_progress",
            create_sql="""
                CREATE TABLE generation_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol_key TEXT NOT NULL UNIQUE,
                    file_path TEXT NOT NULL,
                    symbol_name TEXT NOT NULL,
                    symbol_type TEXT NOT NULL,
                    layer INTEGER NOT NULL,
                    source_hash TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    attempts INTEGER DEFAULT 0,
                    last_tool TEXT,
                    last_error TEXT,
                    generated_at REAL,
                    created_at REAL,
                    updated_at REAL
                )
            """,
            timestamp_columns={"generated_at", "created_at", "updated_at"},
            required_timestamp_columns=set(),
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_progress_status ON generation_progress(status)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_progress_file ON generation_progress(file_path)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_progress_hash ON generation_progress(source_hash)"
        )

    def _rebuild_table_with_timestamp_conversion(
        self,
        conn: sqlite3.Connection,
        *,
        table: str,
        create_sql: str,
        timestamp_columns: set[str],
        required_timestamp_columns: set[str],
    ) -> None:
        info = conn.execute(f"PRAGMA table_info({table})").fetchall()
        if not info:
            return

        declared_types = {
            row["name"]: str(row["type"] or "").strip().upper() for row in info
        }
        needs_migration = any(
            declared_types.get(col) == "TEXT" for col in timestamp_columns if col in declared_types
        )
        if not needs_migration:
            return

        old_table = f"{table}__old_ts"
        conn.execute(f"ALTER TABLE {table} RENAME TO {old_table}")
        conn.execute(create_sql)

        old_cols = [
            r["name"]
            for r in conn.execute(f"PRAGMA table_info({old_table})").fetchall()
        ]
        new_cols = [r["name"] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
        common_cols = [c for c in new_cols if c in old_cols]

        select_exprs: list[str] = []
        for col in common_cols:
            if col in timestamp_columns:
                expr = self._sql_timestamp_to_real(col)
                if col in required_timestamp_columns:
                    expr = f"COALESCE({expr}, CAST(strftime('%s','now') AS REAL))"
                select_exprs.append(f"{expr} AS {col}")
            else:
                select_exprs.append(col)

        cols_sql = ", ".join(common_cols)
        select_sql = ", ".join(select_exprs)
        conn.execute(
            f"INSERT INTO {table} ({cols_sql}) SELECT {select_sql} FROM {old_table}"
        )
        conn.execute(f"DROP TABLE {old_table}")

    def _sql_timestamp_to_real(self, col: str) -> str:
        # Convert various timestamp representations to epoch seconds (REAL).
        # - numeric types: keep as REAL
        # - numeric strings: CAST to REAL
        # - ISO datetime strings: strftime('%s', ...) to epoch seconds
        return f"""(
            CASE
                WHEN {col} IS NULL THEN NULL
                WHEN typeof({col}) IN ('integer', 'real') THEN CAST({col} AS REAL)
                WHEN trim({col}) GLOB '[0-9]*' THEN CAST({col} AS REAL)
                ELSE CAST(strftime('%s', replace(substr({col}, 1, 19), 'T', ' ')) AS REAL)
            END
        )"""

    # === File Operations ===

    def add_file(
        self,
        file_path: str | Path,
        content_hash: str,
        symbols_count: int = 0,
        docs_generated: bool = False,
    ) -> DeepWikiFile:
        """Add or update a tracked source file.

        Args:
            file_path: Path to the source file.
            content_hash: SHA256 hash of file content.
            symbols_count: Number of symbols indexed from this file.
            docs_generated: Whether documentation has been generated.

        Returns:
            DeepWikiFile record.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(file_path)
            now = time.time()

            conn.execute(
                """
                INSERT INTO deepwiki_files(path, content_hash, last_indexed, symbols_count, docs_generated)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET
                    content_hash=excluded.content_hash,
                    last_indexed=excluded.last_indexed,
                    symbols_count=excluded.symbols_count,
                    docs_generated=excluded.docs_generated
                """,
                (path_str, content_hash, now, symbols_count, 1 if docs_generated else 0),
            )
            conn.commit()

            row = conn.execute(
                "SELECT * FROM deepwiki_files WHERE path=?", (path_str,)
            ).fetchone()

            if not row:
                raise StorageError(
                    f"Failed to add file: {file_path}",
                    db_path=str(self.db_path),
                    operation="add_file",
                )

            return self._row_to_deepwiki_file(row)

    def get_file(self, file_path: str | Path) -> Optional[DeepWikiFile]:
        """Get a tracked file by path.

        Args:
            file_path: Path to the source file.

        Returns:
            DeepWikiFile if found, None otherwise.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(file_path)
            row = conn.execute(
                "SELECT * FROM deepwiki_files WHERE path=?", (path_str,)
            ).fetchone()
            return self._row_to_deepwiki_file(row) if row else None

    def get_file_hash(self, file_path: str | Path) -> Optional[str]:
        """Get content hash for a file.

        Used for incremental update detection.

        Args:
            file_path: Path to the source file.

        Returns:
            SHA256 content hash if file is tracked, None otherwise.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(file_path)
            row = conn.execute(
                "SELECT content_hash FROM deepwiki_files WHERE path=?", (path_str,)
            ).fetchone()
            return row["content_hash"] if row else None

    def update_file_hash(self, file_path: str | Path, content_hash: str) -> None:
        """Update content hash for a tracked file.

        Args:
            file_path: Path to the source file.
            content_hash: New SHA256 hash of file content.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(file_path)
            now = time.time()

            conn.execute(
                """
                UPDATE deepwiki_files
                SET content_hash=?, last_indexed=?
                WHERE path=?
                """,
                (content_hash, now, path_str),
            )
            conn.commit()

    def update_file_staleness(
        self,
        file_path: str | Path,
        staleness_score: float,
        commit: str | None = None,
        factors: Dict[str, Any] | None = None,
    ) -> None:
        """Update staleness data for a tracked file.

        Args:
            file_path: Path to the source file.
            staleness_score: Staleness score (0.0-1.0).
            commit: Git commit hash at check time.
            factors: Dict of factors contributing to the score.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(file_path)
            now = time.time()
            factors_json = json.dumps(factors) if factors else None

            conn.execute(
                """
                UPDATE deepwiki_files
                SET staleness_score=?, last_checked_commit=?, last_checked_at=?, staleness_factors=?
                WHERE path=?
                """,
                (staleness_score, commit, now, factors_json, path_str),
            )
            conn.commit()

    def update_symbol_staleness(
        self,
        name: str,
        source_file: str | Path,
        staleness_score: float,
        commit: str | None = None,
        factors: Dict[str, Any] | None = None,
    ) -> None:
        """Update staleness data for a symbol.

        Args:
            name: Symbol name.
            source_file: Path to the source file.
            staleness_score: Staleness score (0.0-1.0).
            commit: Git commit hash at check time.
            factors: Dict of factors contributing to the score.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(source_file)
            now = time.time()
            factors_json = json.dumps(factors) if factors else None

            conn.execute(
                """
                UPDATE deepwiki_symbols
                SET staleness_score=?, last_checked_commit=?, last_checked_at=?, staleness_factors=?
                WHERE name=? AND source_file=?
                """,
                (staleness_score, commit, now, factors_json, name, path_str),
            )
            conn.commit()

    def remove_file(self, file_path: str | Path) -> bool:
        """Remove a tracked file and its associated symbols.

        Args:
            file_path: Path to the source file.

        Returns:
            True if file was removed, False if not found.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(file_path)

            row = conn.execute(
                "SELECT id FROM deepwiki_files WHERE path=?", (path_str,)
            ).fetchone()

            if not row:
                return False

            # Delete associated symbols first
            conn.execute("DELETE FROM deepwiki_symbols WHERE source_file=?", (path_str,))
            conn.execute("DELETE FROM deepwiki_files WHERE path=?", (path_str,))
            conn.commit()
            return True

    def list_files(
        self, needs_docs: bool = False, limit: int = 1000
    ) -> List[DeepWikiFile]:
        """List tracked files.

        Args:
            needs_docs: If True, only return files that need documentation generated.
            limit: Maximum number of files to return.

        Returns:
            List of DeepWikiFile records.
        """
        with self._lock:
            conn = self._get_connection()

            if needs_docs:
                rows = conn.execute(
                    """
                    SELECT * FROM deepwiki_files
                    WHERE docs_generated = 0
                    ORDER BY last_indexed DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT * FROM deepwiki_files
                    ORDER BY last_indexed DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()

            return [self._row_to_deepwiki_file(row) for row in rows]

    def get_stats(self) -> Dict[str, int]:
        """Get statistics about the DeepWiki index.

        Returns:
            Dictionary with counts of files, symbols, and docs.
        """
        with self._lock:
            conn = self._get_connection()

            files_count = conn.execute(
                "SELECT COUNT(*) as count FROM deepwiki_files"
            ).fetchone()["count"]

            symbols_count = conn.execute(
                "SELECT COUNT(*) as count FROM deepwiki_symbols"
            ).fetchone()["count"]

            docs_count = conn.execute(
                "SELECT COUNT(*) as count FROM deepwiki_docs"
            ).fetchone()["count"]

            return {
                "files_count": files_count,
                "symbols_count": symbols_count,
                "docs_count": docs_count,
            }

    # === Symbol Operations ===

    def add_symbol(self, symbol: DeepWikiSymbol) -> DeepWikiSymbol:
        """Add or update a symbol in the index.

        Args:
            symbol: DeepWikiSymbol to add.

        Returns:
            DeepWikiSymbol with ID populated.
        """
        with self._lock:
            conn = self._get_connection()
            source_file = self._normalize_path(symbol.source_file)
            doc_file = self._normalize_path(symbol.doc_file)
            now = time.time()

            conn.execute(
                """
                INSERT INTO deepwiki_symbols(
                    name, type, source_file, doc_file, anchor,
                    start_line, end_line, created_at, updated_at
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name, source_file) DO UPDATE SET
                    type=excluded.type,
                    doc_file=excluded.doc_file,
                    anchor=excluded.anchor,
                    start_line=excluded.start_line,
                    end_line=excluded.end_line,
                    updated_at=excluded.updated_at
                """,
                (
                    symbol.name,
                    symbol.type,
                    source_file,
                    doc_file,
                    symbol.anchor,
                    symbol.line_range[0],
                    symbol.line_range[1],
                    now,
                    now,
                ),
            )
            conn.commit()

            row = conn.execute(
                """
                SELECT * FROM deepwiki_symbols
                WHERE name=? AND source_file=?
                """,
                (symbol.name, source_file),
            ).fetchone()

            if not row:
                raise StorageError(
                    f"Failed to add symbol: {symbol.name}",
                    db_path=str(self.db_path),
                    operation="add_symbol",
                )

            return self._row_to_deepwiki_symbol(row)

    def get_symbols_for_file(self, file_path: str | Path) -> List[DeepWikiSymbol]:
        """Get all symbols for a source file.

        Args:
            file_path: Path to the source file.

        Returns:
            List of DeepWikiSymbol records for the file.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(file_path)
            rows = conn.execute(
                """
                SELECT * FROM deepwiki_symbols
                WHERE source_file=?
                ORDER BY start_line
                """,
                (path_str,),
            ).fetchall()
            return [self._row_to_deepwiki_symbol(row) for row in rows]

    def get_symbol(self, name: str, source_file: str | Path) -> Optional[DeepWikiSymbol]:
        """Get a specific symbol by name and source file.

        Args:
            name: Symbol name.
            source_file: Path to the source file.

        Returns:
            DeepWikiSymbol if found, None otherwise.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(source_file)
            row = conn.execute(
                """
                SELECT * FROM deepwiki_symbols
                WHERE name=? AND source_file=?
                """,
                (name, path_str),
            ).fetchone()
            return self._row_to_deepwiki_symbol(row) if row else None

    def search_symbols(self, query: str, limit: int = 50) -> List[DeepWikiSymbol]:
        """Search symbols by name.

        Args:
            query: Search query (supports LIKE pattern).
            limit: Maximum number of results.

        Returns:
            List of matching DeepWikiSymbol records.
        """
        with self._lock:
            conn = self._get_connection()
            pattern = f"%{query}%"
            rows = conn.execute(
                """
                SELECT * FROM deepwiki_symbols
                WHERE name LIKE ?
                ORDER BY name
                LIMIT ?
                """,
                (pattern, limit),
            ).fetchall()
            return [self._row_to_deepwiki_symbol(row) for row in rows]

    def delete_symbols_for_file(self, file_path: str | Path) -> int:
        """Delete all symbols for a source file.

        Args:
            file_path: Path to the source file.

        Returns:
            Number of symbols deleted.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(file_path)
            cursor = conn.execute(
                "DELETE FROM deepwiki_symbols WHERE source_file=?", (path_str,)
            )
            conn.commit()
            return cursor.rowcount

    # === Doc Operations ===

    def add_doc(self, doc: DeepWikiDoc) -> DeepWikiDoc:
        """Add or update a documentation file record.

        Args:
            doc: DeepWikiDoc to add.

        Returns:
            DeepWikiDoc with ID populated.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(doc.path)
            symbols_json = json.dumps(doc.symbols)
            now = time.time()

            conn.execute(
                """
                INSERT INTO deepwiki_docs(path, content_hash, symbols, generated_at, llm_tool)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET
                    content_hash=excluded.content_hash,
                    symbols=excluded.symbols,
                    generated_at=excluded.generated_at,
                    llm_tool=excluded.llm_tool
                """,
                (path_str, doc.content_hash, symbols_json, now, doc.llm_tool),
            )
            conn.commit()

            row = conn.execute(
                "SELECT * FROM deepwiki_docs WHERE path=?", (path_str,)
            ).fetchone()

            if not row:
                raise StorageError(
                    f"Failed to add doc: {doc.path}",
                    db_path=str(self.db_path),
                    operation="add_doc",
                )

            return self._row_to_deepwiki_doc(row)

    def get_doc(self, doc_path: str | Path) -> Optional[DeepWikiDoc]:
        """Get a documentation file by path.

        Args:
            doc_path: Path to the documentation file.

        Returns:
            DeepWikiDoc if found, None otherwise.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(doc_path)
            row = conn.execute(
                "SELECT * FROM deepwiki_docs WHERE path=?", (path_str,)
            ).fetchone()
            return self._row_to_deepwiki_doc(row) if row else None

    def list_docs(self, limit: int = 1000) -> List[DeepWikiDoc]:
        """List all documentation files.

        Args:
            limit: Maximum number of docs to return.

        Returns:
            List of DeepWikiDoc records.
        """
        with self._lock:
            conn = self._get_connection()
            rows = conn.execute(
                """
                SELECT * FROM deepwiki_docs
                ORDER BY generated_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            return [self._row_to_deepwiki_doc(row) for row in rows]

    def delete_doc(self, doc_path: str | Path) -> bool:
        """Delete a documentation file record.

        Args:
            doc_path: Path to the documentation file.

        Returns:
            True if deleted, False if not found.
        """
        with self._lock:
            conn = self._get_connection()
            path_str = self._normalize_path(doc_path)

            row = conn.execute(
                "SELECT id FROM deepwiki_docs WHERE path=?", (path_str,)
            ).fetchone()

            if not row:
                return False

            conn.execute("DELETE FROM deepwiki_docs WHERE path=?", (path_str,))
            conn.commit()
            return True

    # === Utility Methods ===

    def compute_file_hash(self, file_path: str | Path) -> str:
        """Compute SHA256 hash of a file's content.

        Args:
            file_path: Path to the file.

        Returns:
            SHA256 hash string.
        """
        sha256 = hashlib.sha256()
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)

        return sha256.hexdigest()

    @staticmethod
    def calculate_staleness_score(
        days_since_update: float,
        commits_since: int = 0,
        files_changed: int = 0,
        lines_changed: int = 0,
        proportion_changed: float = 0.0,
        is_deleted: bool = False,
        weights: tuple[float, float, float] = (0.1, 0.4, 0.5),
        decay_k: float = 0.05,
    ) -> float:
        """Calculate staleness score using three-factor formula.

        S = min(1.0, w_t * T + w_c * C + w_s * M)

        Args:
            days_since_update: Days since last documentation update.
            commits_since: Number of commits since last check.
            files_changed: Number of files changed.
            lines_changed: Total lines changed.
            proportion_changed: Proportion of symbol body changed (0.0-1.0).
            is_deleted: Whether the symbol was deleted.
            weights: (w_t, w_c, w_s) weights for time, churn, symbol factors.
            decay_k: Time decay constant (default 0.05, ~14 days to 50%).

        Returns:
            Staleness score between 0.0 and 1.0.
        """
        w_t, w_c, w_s = weights

        # T: Time decay factor
        T = 1 - math.exp(-decay_k * max(0, days_since_update))

        # C: Code churn factor (sigmoid normalization)
        churn_raw = (
            math.log1p(commits_since)
            + math.log1p(files_changed)
            + math.log1p(lines_changed)
        )
        C = 1 / (1 + math.exp(-churn_raw + 3))  # sigmoid centered at 3

        # M: Symbol modification factor
        if is_deleted:
            M = 1.0
        else:
            M = min(1.0, max(0.0, proportion_changed))

        return min(1.0, w_t * T + w_c * C + w_s * M)

    def get_stale_files(
        self, files: list[dict[str, str]]
    ) -> list[dict[str, str]]:
        """Check which files have stale documentation by comparing hashes.

        Args:
            files: List of dicts with 'path' and 'hash' keys.

        Returns:
            List of file dicts where stored hash differs from provided hash.
        """
        with self._lock:
            conn = self._get_connection()
            if not files:
                return []

            # Build lookup: normalized_path -> original file dict
            lookup: dict[str, dict[str, str]] = {}
            normalized: list[str] = []
            for f in files:
                path_str = self._normalize_path(f["path"])
                lookup[path_str] = f
                normalized.append(path_str)

            placeholders = ",".join("?" * len(normalized))
            rows = conn.execute(
                f"SELECT path, content_hash FROM deepwiki_files WHERE path IN ({placeholders})",
                normalized,
            ).fetchall()

            stored: dict[str, str] = {row["path"]: row["content_hash"] for row in rows}

            stale = []
            for path_str, f in lookup.items():
                stored_hash = stored.get(path_str)
                if stored_hash is None:
                    stale.append({"path": f["path"], "stored_hash": None, "current_hash": f["hash"]})
                elif stored_hash != f["hash"]:
                    stale.append({"path": f["path"], "stored_hash": stored_hash, "current_hash": f["hash"]})

            return stale

    def get_symbols_for_paths(
        self, paths: list[str | Path]
    ) -> dict[str, list[DeepWikiSymbol]]:
        """Get all symbols for multiple source files.

        Args:
            paths: List of source file paths.

        Returns:
            Dict mapping normalized path to list of DeepWikiSymbol records.
        """
        with self._lock:
            conn = self._get_connection()
            result: dict[str, list[DeepWikiSymbol]] = {}

            if not paths:
                return result

            normalized = [self._normalize_path(p) for p in paths]
            placeholders = ",".join("?" * len(normalized))
            rows = conn.execute(
                f"""
                SELECT * FROM deepwiki_symbols
                WHERE source_file IN ({placeholders})
                ORDER BY source_file, start_line
                """,
                normalized,
            ).fetchall()

            for row in rows:
                sf = row["source_file"]
                result.setdefault(sf, []).append(
                    self._row_to_deepwiki_symbol(row)
                )

            return result

    def stats(self) -> Dict[str, Any]:
        """Get storage statistics.

        Returns:
            Dict with counts and metadata.
        """
        with self._lock:
            conn = self._get_connection()
            file_count = conn.execute(
                "SELECT COUNT(*) AS c FROM deepwiki_files"
            ).fetchone()["c"]
            symbol_count = conn.execute(
                "SELECT COUNT(*) AS c FROM deepwiki_symbols"
            ).fetchone()["c"]
            doc_count = conn.execute(
                "SELECT COUNT(*) AS c FROM deepwiki_docs"
            ).fetchone()["c"]
            files_needing_docs = conn.execute(
                "SELECT COUNT(*) AS c FROM deepwiki_files WHERE docs_generated = 0"
            ).fetchone()["c"]

            return {
                "files": int(file_count),
                "symbols": int(symbol_count),
                "docs": int(doc_count),
                "files_needing_docs": int(files_needing_docs),
                "db_path": str(self.db_path),
            }

    # === Generation Progress Operations ===

    def get_progress(self, symbol_key: str) -> Optional[Dict[str, Any]]:
        """Get generation progress for a symbol.

        Args:
            symbol_key: Unique symbol identifier (file_path:symbol_name:line_start).

        Returns:
            Progress record dict if found, None otherwise.
        """
        with self._lock:
            conn = self._get_connection()
            row = conn.execute(
                "SELECT * FROM generation_progress WHERE symbol_key=?",
                (symbol_key,),
            ).fetchone()
            return dict(row) if row else None

    def update_progress(self, symbol_key: str, data: Dict[str, Any]) -> None:
        """Update or create generation progress for a symbol.

        Args:
            symbol_key: Unique symbol identifier (file_path:symbol_name:line_start).
            data: Dict with fields to update (file_path, symbol_name, symbol_type,
                  layer, source_hash, status, attempts, last_tool, last_error, generated_at).
        """
        with self._lock:
            conn = self._get_connection()
            now = time.time()

            # Build update query dynamically
            fields = list(data.keys())
            placeholders = ["?"] * len(fields)
            values = [data[f] for f in fields]

            conn.execute(
                f"""
                INSERT INTO generation_progress(symbol_key, {', '.join(fields)}, created_at, updated_at)
                VALUES(?, {', '.join(placeholders)}, ?, ?)
                ON CONFLICT(symbol_key) DO UPDATE SET
                    {', '.join(f'{f}=excluded.{f}' for f in fields)},
                    updated_at=excluded.updated_at
                """,
                [symbol_key] + values + [now, now],
            )
            conn.commit()

    def mark_completed(self, symbol_key: str, tool: str) -> None:
        """Mark a symbol's documentation as completed.

        Args:
            symbol_key: Unique symbol identifier.
            tool: The LLM tool that generated the documentation.
        """
        with self._lock:
            conn = self._get_connection()
            now = time.time()

            conn.execute(
                """
                UPDATE generation_progress
                SET status='completed', last_tool=?, generated_at=?, updated_at=?
                WHERE symbol_key=?
                """,
                (tool, now, now, symbol_key),
            )
            conn.commit()

    def mark_failed(self, symbol_key: str, error: str, tool: str | None = None) -> None:
        """Mark a symbol's documentation generation as failed.

        Args:
            symbol_key: Unique symbol identifier.
            error: Error message describing the failure.
            tool: The LLM tool that was used (optional).
        """
        with self._lock:
            conn = self._get_connection()
            now = time.time()

            if tool:
                conn.execute(
                    """
                    UPDATE generation_progress
                    SET status='failed', last_error=?, last_tool=?,
                        attempts=attempts+1, updated_at=?
                    WHERE symbol_key=?
                    """,
                    (error, tool, now, symbol_key),
                )
            else:
                conn.execute(
                    """
                    UPDATE generation_progress
                    SET status='failed', last_error=?, attempts=attempts+1, updated_at=?
                    WHERE symbol_key=?
                    """,
                    (error, now, symbol_key),
                )
            conn.commit()

    def get_pending_symbols(self, limit: int = 1000) -> List[Dict[str, Any]]:
        """Get all symbols with pending or failed status for retry.

        Args:
            limit: Maximum number of records to return.

        Returns:
            List of progress records with pending or failed status.
        """
        with self._lock:
            conn = self._get_connection()
            rows = conn.execute(
                """
                SELECT * FROM generation_progress
                WHERE status IN ('pending', 'failed')
                ORDER BY updated_at ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            return [dict(row) for row in rows]

    def get_completed_symbol_keys(self) -> set:
        """Get set of all completed symbol keys for orphan detection.

        Returns:
            Set of symbol_key strings for completed symbols.
        """
        with self._lock:
            conn = self._get_connection()
            rows = conn.execute(
                "SELECT symbol_key FROM generation_progress WHERE status='completed'"
            ).fetchall()
            return {row["symbol_key"] for row in rows}

    def delete_progress(self, symbol_keys: List[str]) -> int:
        """Delete progress records for orphaned symbols.

        Args:
            symbol_keys: List of symbol keys to delete.

        Returns:
            Number of records deleted.
        """
        if not symbol_keys:
            return 0

        with self._lock:
            conn = self._get_connection()
            placeholders = ",".join("?" * len(symbol_keys))
            cursor = conn.execute(
                f"DELETE FROM generation_progress WHERE symbol_key IN ({placeholders})",
                symbol_keys,
            )
            conn.commit()
            return cursor.rowcount

    # === Row Conversion Methods ===

    def _row_to_deepwiki_file(self, row: sqlite3.Row) -> DeepWikiFile:
        """Convert database row to DeepWikiFile."""
        staleness_factors = None
        try:
            factors_str = row["staleness_factors"]
            if factors_str:
                staleness_factors = json.loads(factors_str)
        except (KeyError, IndexError):
            pass

        return DeepWikiFile(
            id=int(row["id"]),
            path=row["path"],
            content_hash=row["content_hash"],
            last_indexed=datetime.fromtimestamp(row["last_indexed"])
            if row["last_indexed"]
            else datetime.utcnow(),
            symbols_count=int(row["symbols_count"]) if row["symbols_count"] else 0,
            docs_generated=bool(row["docs_generated"]),
            staleness_score=float(row["staleness_score"]) if row["staleness_score"] else 0.0,
            last_checked_commit=row["last_checked_commit"] if "last_checked_commit" in row.keys() else None,
            last_checked_at=row["last_checked_at"] if "last_checked_at" in row.keys() else None,
            staleness_factors=staleness_factors,
        )

    def _row_to_deepwiki_symbol(self, row: sqlite3.Row) -> DeepWikiSymbol:
        """Convert database row to DeepWikiSymbol."""
        created_at = None
        if row["created_at"]:
            created_at = datetime.fromtimestamp(row["created_at"])

        updated_at = None
        if row["updated_at"]:
            updated_at = datetime.fromtimestamp(row["updated_at"])

        staleness_factors = None
        try:
            factors_str = row["staleness_factors"]
            if factors_str:
                staleness_factors = json.loads(factors_str)
        except (KeyError, IndexError):
            pass

        return DeepWikiSymbol(
            id=int(row["id"]),
            name=row["name"],
            type=row["type"],
            source_file=row["source_file"],
            doc_file=row["doc_file"],
            anchor=row["anchor"],
            line_range=(int(row["start_line"]), int(row["end_line"])),
            created_at=created_at,
            updated_at=updated_at,
            staleness_score=float(row["staleness_score"]) if row["staleness_score"] else 0.0,
            last_checked_commit=row["last_checked_commit"] if "last_checked_commit" in row.keys() else None,
            last_checked_at=row["last_checked_at"] if "last_checked_at" in row.keys() else None,
            staleness_factors=staleness_factors,
        )

    def _row_to_deepwiki_doc(self, row: sqlite3.Row) -> DeepWikiDoc:
        """Convert database row to DeepWikiDoc."""
        symbols = []
        if row["symbols"]:
            try:
                symbols = json.loads(row["symbols"])
            except json.JSONDecodeError:
                pass

        generated_at = datetime.utcnow()
        if row["generated_at"]:
            generated_at = datetime.fromtimestamp(row["generated_at"])

        return DeepWikiDoc(
            id=int(row["id"]),
            path=row["path"],
            content_hash=row["content_hash"],
            symbols=symbols,
            generated_at=generated_at,
            llm_tool=row["llm_tool"],
        )
