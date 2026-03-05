"""DeepWiki document generation tools.

This module provides tools for generating documentation from source code.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import List, Dict, Optional, Protocol, Any

from codexlens.storage.deepwiki_store import DeepWikiStore
from codexlens.storage.deepwiki_models import DeepWikiSymbol, DeepWikiFile, DeepWikiDoc

logger = logging.getLogger(__name__)

# HTML metadata markers for documentation
SYMBOL_START_TEMPLATE = '<!-- deepwiki-symbol-start name="{name}" type="{type}" -->'
SYMBOL_END_MARKER = "<!-- deepwiki-symbol-end -->"


class MarkdownGenerator(Protocol):
    """Protocol for generating Markdown documentation."""

    def generate(self, symbol: DeepWikiSymbol, source_code: str) -> str:
        """Generate Markdown documentation for a symbol."""
        ...


class MockMarkdownGenerator:
    """Mock Markdown generator for testing."""

    def generate(self, symbol: DeepWikiSymbol, source_code: str) -> str:
        """Generate mock Markdown documentation."""
        return f"""{SYMBOL_START_TEMPLATE.format(name=symbol.name, type=symbol.symbol_type)}

## `{symbol.name}`

**Type**: {symbol.symbol_type}
**Location**: `{symbol.source_file}:{symbol.line_start}-{symbol.line_end}`

```{symbol.source_file.split('.')[-1] if '.' in symbol.source_file else 'text'}
{source_code}
```

{SYMBOL_END_MARKER}
"""


class DeepWikiGenerator:
    """Main generator for DeepWiki documentation.

    Scans source code, generates documentation with incremental updates
    using SHA256 hashes for change detection.
    """

    SUPPORTED_EXTENSIONS = [".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs", ".swift"]

    def __init__(
        self,
        store: DeepWikiStore | None = None,
        markdown_generator: MarkdownGenerator | None = None,
    ) -> None:
        """Initialize the generator.

        Args:
            store: DeepWiki storage instance
            markdown_generator: Markdown generator for documentation
        """
        self.store = store or DeepWikiStore()
        self.markdown_generator = markdown_generator or MockMarkdownGenerator()

    def calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of a file.

        Args:
            file_path: Path to the source file

        Returns:
            SHA256 hash string
        """
        content = file_path.read_bytes()
        return hashlib.sha256(content).hexdigest()

    def _should_process_file(self, file_path: Path) -> bool:
        """Check if a file should be processed based on extension."""
        return file_path.suffix.lower() in self.SUPPORTED_EXTENSIONS

    def _extract_symbols_simple(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract symbols from a file using simple regex patterns.

        Args:
            file_path: Path to the source file

        Returns:
            List of symbol dictionaries
        """
        import re

        content = file_path.read_text(encoding="utf-8", errors="ignore")
        lines = content.split("\n")
        symbols = []

        # Python patterns
        py_patterns = [
            (r"^(\s*)def\s+(\w+)\s*\(", "function"),
            (r"^(\s*)async\s+def\s+(\w+)\s*\(", "async_function"),
            (r"^(\s*)class\s+(\w+)", "class"),
        ]

        # TypeScript/JavaScript patterns
        ts_patterns = [
            (r"^(\s*)function\s+(\w+)\s*\(", "function"),
            (r"^(\s*)const\s+(\w+)\s*=\s*(?:async\s*)?\(", "function"),
            (r"^(\s*)export\s+(?:async\s+)?function\s+(\w+)", "function"),
            (r"^(\s*)class\s+(\w+)", "class"),
            (r"^(\s*)interface\s+(\w+)", "interface"),
        ]

        all_patterns = py_patterns + ts_patterns

        for i, line in enumerate(lines, 1):
            for pattern, symbol_type in all_patterns:
                match = re.match(pattern, line)
                if match:
                    name = match.group(2)
                    # Find end line (simple heuristic: next def/class or EOF)
                    end_line = i
                    for j in range(i, min(i + 50, len(lines) + 1)):
                        if j > i:
                            for p, _ in all_patterns:
                                if re.match(p, lines[j - 1]) and not lines[j - 1].startswith(match.group(1)):
                                    end_line = j - 1
                                    break
                            else:
                                continue
                            break
                    else:
                        end_line = min(i + 30, len(lines))

                    symbols.append({
                        "name": name,
                        "type": symbol_type,
                        "line_start": i,
                        "line_end": end_line,
                        "source": "\n".join(lines[i - 1:end_line]),
                    })
                    break

        return symbols

    def generate_for_file(self, file_path: Path) -> Dict[str, Any]:
        """Generate documentation for a single file.

        Args:
            file_path: Path to the source file

        Returns:
            Generation result dictionary
        """
        if not self._should_process_file(file_path):
            return {"skipped": True, "reason": "unsupported_extension"}

        # Calculate hash and check for changes
        current_hash = self.calculate_file_hash(file_path)
        existing_file = self.store.get_file(str(file_path))

        if existing_file and existing_file.content_hash == current_hash:
            logger.debug(f"File unchanged: {file_path}")
            return {"skipped": True, "reason": "unchanged", "hash": current_hash}

        # Extract symbols
        raw_symbols = self._extract_symbols_simple(file_path)

        if not raw_symbols:
            logger.debug(f"No symbols found in: {file_path}")
            return {"skipped": True, "reason": "no_symbols", "hash": current_hash}

        # Generate documentation for each symbol
        docs_generated = 0
        for sym in raw_symbols:
            # Create symbol record
            symbol = DeepWikiSymbol(
                name=sym["name"],
                symbol_type=sym["type"],
                source_file=str(file_path),
                doc_file=f".deepwiki/{file_path.stem}.md",
                anchor=f"#{sym['name'].lower()}",
                line_start=sym["line_start"],
                line_end=sym["line_end"],
            )

            # Generate markdown
            markdown = self.markdown_generator.generate(symbol, sym["source"])

            # Save to store
            self.store.add_symbol(symbol)
            docs_generated += 1

        # Update file hash
        self.store.update_file_hash(str(file_path), current_hash)

        logger.info(f"Generated docs for {docs_generated} symbols in {file_path}")
        return {
            "symbols": len(raw_symbols),
            "docs_generated": docs_generated,
            "hash": current_hash,
        }

    def run(self, path: Path) -> Dict[str, Any]:
        """Run documentation generation for a path.

        Args:
            path: File or directory path to process

        Returns:
            Generation summary
        """
        path = Path(path)

        if path.is_file():
            files = [path]
        elif path.is_dir():
            files = []
            for ext in self.SUPPORTED_EXTENSIONS:
                files.extend(path.rglob(f"*{ext}"))
        else:
            raise ValueError(f"Path not found: {path}")

        results = {
            "total_files": 0,
            "processed_files": 0,
            "skipped_files": 0,
            "total_symbols": 0,
            "docs_generated": 0,
        }

        for file_path in files:
            results["total_files"] += 1
            result = self.generate_for_file(file_path)

            if result.get("skipped"):
                results["skipped_files"] += 1
            else:
                results["processed_files"] += 1
                results["total_symbols"] += result.get("symbols", 0)
                results["docs_generated"] += result.get("docs_generated", 0)

        logger.info(
            f"DeepWiki generation complete: "
            f"{results['processed_files']}/{results['total_files']} files, "
            f"{results['docs_generated']} docs generated"
        )

        return results
