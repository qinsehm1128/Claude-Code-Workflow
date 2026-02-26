"""Pytest configuration and shared fixtures for codex-lens tests.

This module provides common fixtures and test utilities to reduce code duplication
across the test suite. Using fixtures ensures consistent test setup and makes tests
more maintainable.

Common Fixtures:
- temp_dir: Temporary directory for test files
- sample_index_db: Sample index database with test data
- mock_config: Mock configuration object
- sample_code_files: Factory for creating sample code files
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Any
import sqlite3


@pytest.fixture
def temp_dir():
    """Create a temporary directory for test files.

    The directory is automatically cleaned up after the test.

    Yields:
        Path: Path to the temporary directory.
    """
    temp_path = Path(tempfile.mkdtemp())
    yield temp_path
    # Cleanup
    if temp_path.exists():
        shutil.rmtree(temp_path)


@pytest.fixture
def sample_index_db(temp_dir):
    """Create a sample index database with test data.

    The database has a basic schema with files and chunks tables
    populated with sample data.

    Args:
        temp_dir: Temporary directory fixture.

    Yields:
        Path: Path to the sample index database.
    """
    db_path = temp_dir / "_index.db"

    # Create database with basic schema
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Files table
    cursor.execute("""
        CREATE TABLE files (
            id INTEGER PRIMARY KEY,
            path TEXT NOT NULL UNIQUE,
            content TEXT,
            language TEXT,
            hash TEXT,
            indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Insert sample files
    sample_files = [
        ("test.py", "def hello():\n    print('world')", "python", "hash1"),
        ("test.js", "function hello() { console.log('world'); }", "javascript", "hash2"),
        ("README.md", "# Test Project", "markdown", "hash3"),
    ]
    cursor.executemany(
        "INSERT INTO files (path, content, language, hash) VALUES (?, ?, ?, ?)",
        sample_files
    )

    conn.commit()
    conn.close()

    yield db_path


@pytest.fixture
def mock_config():
    """Create a mock configuration object with default values.

    Returns:
        Mock: Mock object with common config attributes.
    """
    from unittest.mock import Mock

    config = Mock()
    config.index_path = Path("/tmp/test_index")
    config.chunk_size = 2000
    config.overlap = 200
    config.embedding_backend = "fastembed"
    config.embedding_model = "code"
    config.max_results = 10

    return config


@pytest.fixture
def sample_code_factory(temp_dir):
    """Factory for creating sample code files.

    Args:
        temp_dir: Temporary directory fixture.

    Returns:
        callable: Function that creates sample code files.
    """
    def _create_file(filename: str, content: str, language: str = "python") -> Path:
        """Create a sample code file.

        Args:
            filename: Name of the file to create.
            content: Content of the file.
            language: Programming language (default: python).

        Returns:
            Path: Path to the created file.
        """
        file_path = temp_dir / filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content)
        return file_path

    return _create_file


@pytest.fixture
def sample_python_code():
    """Sample Python code for testing.

    Returns:
        str: Sample Python code snippet.
    """
    return '''
def calculate_sum(a: int, b: int) -> int:
    """Calculate the sum of two integers."""
    return a + b

class Calculator:
    """A simple calculator class."""

    def __init__(self):
        self.value = 0

    def add(self, x: int) -> None:
        """Add a value to the calculator."""
        self.value += x

if __name__ == "__main__":
    calc = Calculator()
    calc.add(5)
    print(f"Result: {calc.value}")
'''


@pytest.fixture
def sample_javascript_code():
    """Sample JavaScript code for testing.

    Returns:
        str: Sample JavaScript code snippet.
    """
    return '''
// Simple utility functions
function add(a, b) {
    return a + b;
}

const Calculator = class {
    constructor() {
        this.value = 0;
    }

    add(x) {
        this.value += x;
    }
};

// Example usage
const calc = new Calculator();
calc.add(5);
console.log(`Result: ${calc.value}`);
'''


class CodeSampleFactory:
    """Factory class for generating various code samples.

    This class provides methods to generate code samples in different
    languages with various patterns (classes, functions, imports, etc.).
    """

    @staticmethod
    def python_function(name: str = "example", docstring: bool = True) -> str:
        """Generate a Python function sample.

        Args:
            name: Function name.
            docstring: Whether to include docstring.

        Returns:
            str: Python function code.
        """
        doc = f'    """Example function."""\n' if docstring else ''
        return f'''
def {name}(param1: str, param2: int = 10) -> str:
{doc}    return param1 * param2
'''.strip()

    @staticmethod
    def python_class(name: str = "Example") -> str:
        """Generate a Python class sample.

        Args:
            name: Class name.

        Returns:
            str: Python class code.
        """
        return f'''
class {name}:
    """Example class."""

    def __init__(self, value: int = 0):
        self.value = value

    def increment(self) -> None:
        """Increment the value."""
        self.value += 1
'''.strip()

    @staticmethod
    def javascript_function(name: str = "example") -> str:
        """Generate a JavaScript function sample.

        Args:
            name: Function name.

        Returns:
            str: JavaScript function code.
        """
        return f'''function {name}(param1, param2 = 10) {{
    return param1 * param2;
}}'''.strip()

    @staticmethod
    def typescript_interface(name: str = "Example") -> str:
        """Generate a TypeScript interface sample.

        Args:
            name: Interface name.

        Returns:
            str: TypeScript interface code.
        """
        return f'''interface {name} {{
    id: number;
    name: string;
    getValue(): number;
}}'''.strip()


@pytest.fixture
def code_sample_factory():
    """Create a code sample factory instance.

    Returns:
        CodeSampleFactory: Factory for generating code samples.
    """
    return CodeSampleFactory()
