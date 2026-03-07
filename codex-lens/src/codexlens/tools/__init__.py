"""DeepWiki document generation tools.

This module provides tools for generating documentation from source code.
"""

from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Protocol, Any

from codexlens.errors import StorageError
from codexlens.indexing.symbol_extractor import SymbolExtractor
from codexlens.parsers.factory import ParserFactory
from codexlens.storage.deepwiki_models import DeepWikiSymbol
from codexlens.storage.deepwiki_store import DeepWikiStore

logger = logging.getLogger(__name__)


# Default timeout for AI generation (30 seconds)
AI_TIMEOUT = 30
# HTML metadata markers for documentation
SYMBOL_START_MARKER = '<!-- deepwiki-symbol-start name="{symbol_name}" -->'
SYMBOL_END_MARKER = "<!-- deepwiki-symbol-end -->"


class MarkdownGenerator(Protocol):
    """Protocol for generating Markdown documentation."""

    def generate(self, symbol: DeepWikiSymbol, source_code: str) -> str:
        """Generate Markdown documentation for a symbol.

        Args:
            symbol: The symbol information
            source_code: The source code content

        Returns:
            Generated Markdown documentation
        """
        pass


class MockMarkdownGenerator(MarkdownGenerator):
    """Mock Markdown generator for testing."""

    def generate(self, symbol: DeepWikiSymbol, source_code: str) -> str:
        """Generate mock Markdown documentation."""
        return f"# {symbol.name}\\n\\n## {symbol.type}\\n\\n```\\n{source_code}\\n```"


class DeepWikiGenerator:
    """Main generator for DeepWiki documentation.

    Scans source code, generates documentation with incremental updates
    using SHA256 hashes for change detection.
    """

    DEFAULT_DB_PATH = DeepWikiStore.DEFAULT_DB_PATH
    SUPPORTED_EXTENSIONS = [
        ".py",
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".java",
        ".go",
        ".rs",
        ".swift",
    ]
    AI_TIMEOUT: int = 30  # Timeout for AI generation
    MAX_SYMBOLS_PER_FILE: int = 100  # Batch size for processing large files

    def __init__(
        self,
        db_path: Path | None = None,
        store: DeepWikiStore | None = None,
        markdown_generator: MarkdownGenerator | None = None,
        max_symbols_per_file: int = 100,
        ai_timeout: int = 30,
    ) -> None:
        """
        Initializes the DeepWikiGenerator.
        """
        if store:
            self.store = store
        else:
            self.store = DeepWikiStore(db_path or self.DEFAULT_DB_PATH)
        
        if markdown_generator:
            self.markdown_generator = markdown_generator
        else:
            logger.debug("No markdown generator provided, using mock")
            self.markdown_generator = MockMarkdownGenerator()

        self._extractor = SymbolExtractor()
        self.max_symbols_per_file = max_symbols_per_file
        self.ai_timeout = ai_timeout
        self._docs_dir = Path("docs")  # Default docs directory

    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of file content."""
        try:
            content = file_path.read_bytes()
            hash_obj = hashlib.sha256(content)
            return hash_obj.hexdigest()
        except IOError as e:
            logger.error(f"Error reading file for hash calculation: {file_path}: {e}")
            return ""

    def _get_language(self, file_path: Path) -> str | None:
        """Determine language from file extension."""
        ext = file_path.suffix.lower()
        if ext not in self.SUPPORTED_EXTENSIONS:
            logger.debug(f"Unsupported file extension: {file_path}, skipping file")
            return None
        
        language_map = {
            ".py": "Python",
            ".ts": "TypeScript",
            ".tsx": "TypeScript React",
            ".js": "JavaScript",
            ".jsx": "JavaScript React",
            ".java": "Java",
            ".go": "Go",
            ".rs": "Rust",
            ".swift": "Swift",
        }
        return language_map.get(ext)

    def _should_process_file(self, file_path: Path, force: bool) -> bool:
        """Check if a file should be processed based on hash."""
        if force:
            return True
        new_hash = self._calculate_file_hash(file_path)
        if not new_hash:
            return False
            
        existing_file = self.store.get_file(str(file_path))
        if existing_file and existing_file.content_hash == new_hash:
            logger.debug(f"File unchanged: {file_path}. Skipping (hash match)")
            return False
        return True

    def _generate_markdown_for_symbol(self, symbol: DeepWikiSymbol, source_code: str) -> str:
        """Generate markdown and wrap it with markers."""
        markdown_content = self.markdown_generator.generate(symbol, source_code)
        return f"{SYMBOL_START_MARKER.format(symbol_name=symbol.name)}\\n{markdown_content}\\n{SYMBOL_END_MARKER}"

    def run(self, path: str, output_dir: Optional[str] = None, force: bool = False) -> Dict[str, Any]:
        """
        Initialize DeepWiki store and generator, and scan the source.
        """
        source_root = Path(path)
        if output_dir:
            self._docs_dir = Path(output_dir)

        stats = {
            "total_files": 0,
            "total_symbols": 0,
            "total_changed_files": 0,
            "total_changed_symbols": 0,
            "total_docs_generated": 0,
            "total_unchanged_files": 0,
        }

        files_to_process = [p for p in source_root.rglob("*") if p.is_file() and p.suffix in self.SUPPORTED_EXTENSIONS]
        stats["total_files"] = len(files_to_process)

        changed_files_count = 0
        unchanged_files_count = 0
        
        for file_path in files_to_process:
            if not self._should_process_file(file_path, force):
                unchanged_files_count += 1
                continue
            
            changed_files_count += 1
            try:
                source_code = file_path.read_text("utf-8")
                symbols = self._extractor.extract_symbols(source_code, file_path.suffix, str(file_path))
                
                if not symbols:
                    logger.debug(f"No symbols found in {file_path}")
                    continue

                logger.debug(f"Found {len(symbols)} symbols in {file_path}")
                stats["total_symbols"] += len(symbols)
                docs_generated_count = 0

                for symbol in symbols:
                    # Generate documentation
                    doc_content = self._generate_markdown_for_symbol(symbol, source_code)
                    
                    # Define doc path
                    relative_path = file_path.relative_to(source_root)
                    doc_path = (self._docs_dir / relative_path).with_suffix(".md")
                    doc_path.parent.mkdir(parents=True, exist_ok=True)

                    # Save symbol and doc
                    self.store.save_symbol(symbol, str(doc_path), doc_content)
                    docs_generated_count += 1
                
                stats["total_docs_generated"] += docs_generated_count
                stats["total_changed_symbols"] += len(symbols)
                
                # Update file stats in DB
                content_hash = self._calculate_file_hash(file_path)
                self.store.update_file_stats(str(file_path), len(symbols), content_hash)
                logger.debug(f"Generated docs for {len(symbols)} symbols in {file_path}")

            except Exception as e:
                logger.error(f"Error processing file {file_path}: {e}")
                raise StorageError(f"Failed to process {file_path}") from e

        stats["total_changed_files"] = changed_files_count
        stats["total_unchanged_files"] = unchanged_files_count
        
        logger.info(f"Generation complete. Stats: {stats}")
        return stats

    def close(self):
        """Close the store connection."""
        self.store.close()
