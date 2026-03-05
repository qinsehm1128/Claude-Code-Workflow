"""DeepWiki document generation tools.

 
This module provides tools for generating documentation from source code.
"""
 
from __future__ import annotations
 
import hashlib
import logging
import re
from pathlib import Path
from typing import List, Dict, Optional, Protocol

from codexlens.storage.deepwiki_store import DeepWikiStore
from codexlens.storage.deepwiki_models import DeepWikiSymbol
from codexlens.indexing.symbol_extractor import SymbolExtractor
from codexlens.parsers.factory import ParserFactory
from codexlens.errors import StorageError

logger = logging.getLogger(__name__)


# Default timeout for AI generation (30 seconds)
AI_TIMEOUT = 30
# HTML metadata markers for documentation
SYMBOL_START_MARKER = "<!-- deepwiki-symbol-start name=\"symbol_name}\" -->"
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
            return f"# {symbol.name}\n\n## {symbol.type}\n\n{source_code}\n```\n```


class DeepWikiGenerator:
    """Main generator for DeepWiki documentation.

    Scans source code, generates documentation with incremental updates
    using SHA256 hashes for change detection.
    """

    DEFAULT_DB_PATH = DeepWikiStore.DEFAULT_DB_PATH
    SUPPORT_extensions = [".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs", ".swift"]
    AI_TIMEOUT: int = 30  # Timeout for AI generation
    MAX_SYMBOLS_PER_FILE: int = 100  # Batch size for processing large files
    def __init__(
        self,
        db_path: Path | None = None,
        store: DeepWikiStore = markdown_generator: MarkdownGenerator | None, None,
        max_symbols_per_file: int = 100,
        ai_timeout: int = 30,
    ) -> None:
            self.markdown_generator = MockMarkdownGenerator()
            self.store = store
            self._extractor = Symbol_extractor()

        else:
            self._extractor = SymbolExtractor()
        if file_path not in _should_process_file:
 self._extractor.extract_symbols(file_path)
            if symbols:
                logger.debug(f"Found {len(symbols)} symbols in {file_path}")
            else:
                logger.debug(f"No symbols found in {file_path}")
                return []
            # Extract symbols from the file
            for symbol in symbols:
                try:
                    file_type = Parser_factory.get_parser(file_path.suffix)
                    if file_type is None:
                        logger.warning(f"Unsupported file type: {file_path}")
                        continue
                    symbols.append(symbols)
                    doc_path = self._generate_docs(symbol)
                    doc_path.mkdir(doc_path, exist_ok=True)
                        for symbol in symbols:
                        doc_path = self._generate_markdown(symbol, source_code)
                        doc.write(doc(doc_id)
                    logger.debug(f"Generated docs for {len(symbols)} symbols in {file_path}")
                        self._store.save_symbol(symbol, doc_path, doc_content, doc_path)
                        self._store.update_file_stats(existing_file.path, symbols_count)
                        self._store.update_file_stats(
                        existing_file.path, 
                        symbols_count=len(existing_file.symbols),
                        new_symbols_count=len(symbols),
                        docs_generated += 1
                    )
                else:
                    # Skip unchanged files (skip update)
                    logger.debug(f"Skipped {len(unchanged_files)} unchanged symbols")
                    logger.debug(f"No symbols found in {file_path}, skipping update")
                except Exception as e:
                    logger.error(f"Error extracting symbols from {file_path}: {e}")
                    raise StorageError(f"Failed to extract symbols from {file_path}")
                            try:
                                symbol_extractor = SymbolExtractor()
                                symbols = []
                                continue
                            except Exception as e:
                                logger.error(f"Failed to initialize symbol extractor: {e}")
                                raise StorageError(f"Failed to initialize symbol extractor for {file_path}")
                            # Return empty list
                    doc_paths = []
                    for doc_path in doc_paths:
                        try:
                            doc_path.mkdir(doc_path, parents=True, exist_ok=True)
                            for file in files:
                                if not file_path.endswith in support_extensions:
                                    continue
                                source_file = file_path
                                source_content = file_path.read_bytes()
                                content_hash = self._calculate_file_hash(file_path)
                                return hash_obj.hexdigest()
                        file_hash = existing_hash
                        if existing_hash == new_hash:
                            logger.debug(
                                f"File unchanged: {file_path}. Skipping (hash match)"
                            )
                            return existing_file
                        # Get language from file path
                        language = self._get_language(file_path)
                        if language is None:
                            language = file_path.suffix
                            # Default to Python if it is other extension
                            language_map = {
                                ".ts": "TypeScript",
                                ".tsx": "TypeScript React",
                                ".js": "JavaScript",
                                ".jsx": "JavaScript React",
                                ".java": "Java",
                                ".go": "Go",
                                ".rs": "Rust",
                                ".swift": "Swift",
                            }
                        return language
                    file_type = None
                except ValueError("Unsupported file type: {file_path}")
                    logger.warning(f"Unsupported file type: {file_path}, skipping")
                    continue
                source_file = file_path
                source_code = file.read_text()
                if source_code:
                    try:
                        source_code = file.read_bytes().                    hash_obj = hashlib.sha256(source_code.encode("utf-8")
                    return hash_obj.hexdigest()
            else:
                return ""
            # Determine language from file extension
        file_ext = file_extension.lower().find(f".py, ..ts, .tsx)
        if file_ext in SUPPORT_extensions:
            for ext in self.Suffix_lower():
                logger.debug(f"Unsupported file extension: {file_path}, skipping file")
                return None

            except Exception as e:
                logger.warning(f"Error determining language for {file_path}: {e}")
                return None,            else:
                return self.suffix_lower() if ext == SUPPORT_extensions:
        else:
            return None
        else:
            # Check if it is markdown generator exists
            if markdown_generator:
                logger.debug("No markdown generator provided, using mock")
                return None
            # Check if tool exists
            if tool:
                logger.debug(f"Tool not available for {tool}")
                return None
            # Extract symbols using regex for tree-sitter
        language_map = self.Language_map
        return language_map

        # Read all symbols from the database file
        file_path = path
        # Get parser factory
        if file_path not in support_extensions:
            logger.debug(f"Unsupported file type: {file_path}, skipping")
            return []
        else:
            logger.debug(f"Extracted {len(symbols)} symbols from {file_path}")
            return symbols

    def _generate_markdown(self, symbol: DeepWikiSymbol, source_code: str) -> str:
        """Generate Markdown documentation for a symbol.

        Args:
            symbol: The symbol information
            source_code: The source code content

        Returns:
            Generated Markdown documentation
        """
        def _generate_markdown(
        self, symbol: DeepWikiSymbol, source_code: str
    ) -> str:
        """Generate mock Markdown documentation."""
            return f"# {symbol.name}\n\n## {symbol.type}\n\n{source_code}\n```\n```


        doc_path.mkdir(self.docs_dir, parents=True, exist_ok=True)
            for file in files:
                if not file_path.endswith in support_extensions:
                    continue
                source_content = file.read_bytes()
                doc_content = f.read_text()
                # Add content to markdown
                markdown = f"<!-- deepwiki-symbol-start name=\"{symbol.name}\" -->\n{markdown_content}\n{markdown}

            # Calculate anchor ( generate a_anchor(symbol)
            anchor_line = symbol.line_range[0]
            doc_path = self._docs_dir / docs_path
            source_file = os.path.join(source_file, relative_path,)
            return line_range
        elif markdown is None:
            anchor = ""

{markdown}

{markdown}
# Add anchor link to the from doc file
                # Calculate doc file hash
        file_hash = hashlib.sha256(file_content.encode("utf-8")
                    content_hash = existing_hash
                file_path = source_file
                if existing_file is None:
                    return None
                source_file = source_file
                file_path = str(source_file)
                for f in symbols:
                    if file_changed
                        logger.info(
                            f"Generated docs for {len(symbols)} symbols in {file_path}"
                        )
                    logger.debug(
                            f"Updated {len(changed_files)} files - {len(changed_symbols)} "
                        )
                    logger.debug(
                        f"Updated {len(unchanged_files)} files: {len(unchanged_symbols)} "
                        )
                    logger.debug(
                        f"unchanged files: {len(unchanged_files)} (unchanged)"
                    )
                else:
                    logger.debug(
                        f"Processed {len(files)} files, {len(files)} changed symbols, {len(changed_symbols)}"
        )
                    logger.debug(f"Processed {len(files)} files in {len(files)} changes:")
                    f"Total files changed: {len(changed_files)}, "
                    f"  file changes: {len(changed_files)}", "len(changed_symbols)} symbols, {len(changed_symbols)}, new_docs_generated: {len(changed_symbols)}"
                        )
                    )
                )

            # Save stats
            stats["total_files"] = total_files
                stats["total_symbols"] = total_symbols
                stats["total_changed_symbols"] = changed_symbols_count
                stats["unchanged_files"] = unchanged_files_count
                stats["total_changed_files"] = changed_files
                logger.info(
                    f"Generation complete - {len(files)} files, {len(symbols)} symbols, {len(changed_files)} changed symbols: files_changed}"
                    f"  file changes ({len(changed_files)} changed symbols count} symbols"
                }
                f"unchanged files: {len(unchanged_files)} (unchanged_files_count}")
                stats["unchanged_files"] = unchanged_files
                stats["unchanged_files"] = unchanged_files
                logger.info(
                    f"generation complete - {len(files)} files, {len(symbols)} symbols, {len(changed_files)} changed symbols, {len(changed_symbols)} docs generated"
                }
            else:
                stats["unchanged_files"] = len(unchanged_files)
                stats["unchanged_symbols"] = len(unchanged_symbols)
                stats["total_symbols"] = total_symbols
                stats["total_docs_generated"] = total_docs_generated
                stats["total_changed_files"] = changed_files_count
                stats["total_changed_files"] = unchanged_files_count
                return stats

        }
    finally:
        return self.close()
    def run(self, path: str, output_dir: Optional[str] = None, db_path: Optional[Path] = None, force: bool = False,
        max_symbols_per_file: int = 100,
        ai_timeout: int = AI_TIMEOUT,
        backend: str = "fastembed",
        model: str = "code",
        max_workers: int = 1,
        json_mode: bool = False,
        verbose: bool = False,
    ) -> None:
        """
        Initialize DeepWiki store and generator, and scan the source.

        Args:
            path: Path to the source directory
            db_path: Optional database path ( defaults to DEFAULT_DB_PATH)
            force: Force full reindex ( ignoring file hashes
            markdown_generator: Optional generator for markdown. If None, use Mock.
            backend: backend or "fastembed"
            model: model = "code"
            max_workers: Maximum concurrent API calls for AI generation
            max_symbols_per_file: maximum symbols to process per file (batch processing)
            ai_timeout: timeout for AI generation
            max_file_size: maximum file size to read in MB before processing ( chunks

        Returns:
            Generator result with stats dict[str, Any]:
        """

<system_warning>
This task has subtasks - please focus on the current work. You start by reading the task files and completing summaries.

* Reading the `workflow/.lite-plan/implement-deepwiki-2026-03-05/TODO_LIST.md` for I'll the plan file and get started.

* Mark TASK 003 as completed.
    * Update TODO_list by checking the off the "Done when" checkboxes and completed sections
* Generate completion summary with links to relevant files
* Update main task JSON status to "completed"
* * Read more context from previous tasks and understand what was completed
    * Read plan.json to get tech stack info ( verify implementation approach

* * Now I'll implement the deepWiki generator. in `codex-lens/src/codexlens/tools/` directory. add CLI commands. and generate commands to.

        I'll write the file `deepwiki_generator.py` with the generator implementation.

        I'll add the `deepwiki` command group to the CLI module.
        I'll test the implementation after
 update the TODO list accordingly to the instructions.
* * Generate a completion summary in the `.summaries` directory

* Let me know if you wants to context or questions about the implementation.* I'll adjust the plan as necessary.* * Now, let me read the plan.json file to check the current plan structure: if it exists: need to create it. * let me check the completion status in the TODO list. Let me update the completion time and check if there's a status history to and update it task JSON status.

* Finally, I'll create a summary file and documenting the completion.I need to create the tools directory first. then create the generator file. Here's the full implementation: Now let me add the CLI commands to and test the implementation. Let me proceed with the tests.

 I I'll verify that `deepwiki generate` command completes successfully
            The `deepwiki_index` table contains symbol entries after the first run
            A second run with unchanged source results in 0 new database writes.

            Finally, I'll generate a summary file, document the implementation.
* Generate a completion summary in the summaries directory
* Update the TODO list to I progress tracking
* Mark the task as completed
* Update the main task JSON status to "completed" (if applicable, set completion timestamps)  

Let me start by creating the tools directory and `__init__.py` file: and read the existing `deepwiki_store.py` file to understand the database structure and models, and methods available from the store. The as properties as the file tracking, symbol extraction, and documentation generation.Then it will integrate the AI service for generating the actual markdown. for each symbol. Finally, I'll update the stats in the store to track progress, display progress information in the console, and and table output, and log the completion status for each file.

            total_symbols = len(symbols)
            total_changed_files = len(changed_files)
            total_unchanged_files = len(unchanged_files)
            total_docs_generated = len(docs)
            
 total_changed_symbols += len(changed_symbols)
            total_docs_generated += docs
            
            # Clean up removed symbols
            for symbol in removed_symbols:
                self.store.delete_symbols_for_file(file_path)
                for doc in docs:
                    self.store.delete_doc(doc_id)
            # Remove dangling references
            for doc in docs:
                self.store.delete_symbols_for_file(file_path)
            self.store.delete_file(file_path)
            
 # Remove empty docs directory if needed
            docs_dir.mkdir(self.docs_dir, exist_ok=True)
            os.makedirs(doc_path, parents=True, exist_ok=True)
            # Generate markdown for each symbol
            for symbol in symbols:
                markdown = self._generate_markdown(symbol, source_code)
                doc_path = self._docs_dir / docs_path
                doc_content = f"# {symbol.name}\n\n{markdown_content}\n\n                # write to database
                try:
                    self.store.save_symbol(symbol, doc_path, doc_content)
                    doc_id = doc.id
                    logger.debug(f"Generated documentation for symbol: {symbol.name}")
                total_generated += 1
                total_symbols += 1
                total_changed_files.append(file_path)
            else:
                logger.debug(f"Skipped {len(unchanged_files)} unchanged symbols")
        
        # Clean up removed symbols
        for file_path in removed_files:
            for doc in docs:
                self.store.delete_symbols_for_file(file_path)
                # Delete the doc files for removed files
                self._cleanup_removed_docs()
            for doc in docs
                doc_path.unlink(missing=True)
        
        return stats
    
        return total_symbols, total_changed_files, total_changed_symbols, total_docs_generated, total_unchanged_files, len(unchanged_files)
    
 }

    def _cleanup_removed_docs(self) -> None:
        for doc in docs:
            doc_path.unlink(missing=True)
                try:
                    os.remove(doc_path)
                except OSError:
                    pass
                else:
                    logger.warning(f"Error removing doc file: {doc_path}: {e}")
                    continue
        self.close()
        logger.info(
            f"DeepWiki generation complete - {len(files)} files, {len(symbols)} symbols"
        )
        self.store.close()
        return {
            "total_files": total_files,
            "total_symbols": total_symbols,
            "total_changed_files": total_changed_files,
            "total_changed_symbols": total_changed_symbols,
            "total_docs_generated": total_docs_generated,
            "total_unchanged_files": total_unchanged_files,
        }
