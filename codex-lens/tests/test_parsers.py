"""Tests for CodexLens parsers."""

import tempfile
from pathlib import Path

import pytest

from codexlens.config import Config
from codexlens.parsers.factory import (
    ParserFactory,
    SimpleRegexParser,
    _parse_go_symbols,
    _parse_java_symbols,
    _parse_js_ts_symbols,
    _parse_python_symbols,
    _parse_generic_symbols,
)


TREE_SITTER_JS_AVAILABLE = True
try:
    import tree_sitter_javascript  # type: ignore[import-not-found]  # noqa: F401
except Exception:
    TREE_SITTER_JS_AVAILABLE = False


class TestPythonParser:
    """Tests for Python symbol parsing."""

    def test_parse_function(self):
        code = "def hello():\n    pass"
        symbols = _parse_python_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "hello"
        assert symbols[0].kind == "function"

    def test_parse_async_function(self):
        code = "async def fetch_data():\n    pass"
        symbols = _parse_python_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "fetch_data"
        assert symbols[0].kind == "function"

    def test_parse_class(self):
        code = "class MyClass:\n    pass"
        symbols = _parse_python_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "MyClass"
        assert symbols[0].kind == "class"

    def test_parse_method(self):
        code = "class MyClass:\n    def method(self):\n        pass"
        symbols = _parse_python_symbols(code)
        assert len(symbols) == 2
        assert symbols[0].name == "MyClass"
        assert symbols[0].kind == "class"
        assert symbols[1].name == "method"
        assert symbols[1].kind == "method"

    def test_parse_async_method(self):
        code = "class MyClass:\n    async def async_method(self):\n        pass"
        symbols = _parse_python_symbols(code)
        assert len(symbols) == 2
        assert symbols[1].name == "async_method"
        assert symbols[1].kind == "method"


class TestJavaScriptParser:
    """Tests for JavaScript/TypeScript symbol parsing."""

    def test_parse_function(self):
        code = "function hello() {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "hello"
        assert symbols[0].kind == "function"

    def test_parse_async_function(self):
        code = "async function fetchData() {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "fetchData"
        assert symbols[0].kind == "function"

    def test_parse_arrow_function(self):
        code = "const hello = () => {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "hello"
        assert symbols[0].kind == "function"

    def test_parse_async_arrow_function(self):
        code = "const fetchData = async () => {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "fetchData"
        assert symbols[0].kind == "function"

    def test_parse_class(self):
        code = "class MyClass {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "MyClass"
        assert symbols[0].kind == "class"

    def test_parse_export_function(self):
        code = "export function hello() {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "hello"
        assert symbols[0].kind == "function"

    def test_parse_export_class(self):
        code = "export class MyClass {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "MyClass"
        assert symbols[0].kind == "class"

    def test_parse_export_arrow_function(self):
        code = "export const hello = () => {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "hello"
        assert symbols[0].kind == "function"

    @pytest.mark.skipif(not TREE_SITTER_JS_AVAILABLE, reason="tree-sitter-javascript not installed")
    def test_parse_class_methods(self):
        code = (
            "class MyClass {\n"
            "  method() {}\n"
            "  async asyncMethod() {}\n"
            "  static staticMethod() {}\n"
            "  constructor() {}\n"
            "}"
        )
        symbols = _parse_js_ts_symbols(code)
        names_kinds = [(s.name, s.kind) for s in symbols]
        assert ("MyClass", "class") in names_kinds
        assert ("method", "method") in names_kinds
        assert ("asyncMethod", "method") in names_kinds
        assert ("staticMethod", "method") in names_kinds
        assert all(name != "constructor" for name, _ in names_kinds)


class TestJavaParser:
    """Tests for Java symbol parsing."""

    def test_parse_class(self):
        code = "public class MyClass {\n}"
        symbols = _parse_java_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "MyClass"
        assert symbols[0].kind == "class"

    def test_parse_class_without_public(self):
        code = "class InternalClass {\n}"
        symbols = _parse_java_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "InternalClass"

    def test_parse_method(self):
        code = "public class Test {\n    public void doSomething() {}\n}"
        symbols = _parse_java_symbols(code)
        assert len(symbols) == 2
        assert symbols[0].name == "Test"
        assert symbols[0].kind == "class"
        assert symbols[1].name == "doSomething"
        assert symbols[1].kind == "method"

    def test_parse_static_method(self):
        code = "public class Test {\n    public static void main(String[] args) {}\n}"
        symbols = _parse_java_symbols(code)
        method_names = [s.name for s in symbols if s.kind == "method"]
        assert "main" in method_names

    def test_parse_private_method(self):
        code = "public class Test {\n    private int calculate() { return 0; }\n}"
        symbols = _parse_java_symbols(code)
        method_names = [s.name for s in symbols if s.kind == "method"]
        assert "calculate" in method_names

    def test_parse_generic_return_type(self):
        code = "public class Test {\n    public List<String> getItems() { return null; }\n}"
        symbols = _parse_java_symbols(code)
        method_names = [s.name for s in symbols if s.kind == "method"]
        assert "getItems" in method_names


class TestGoParser:
    """Tests for Go symbol parsing."""

    def test_parse_function(self):
        code = "func hello() {\n}"
        symbols = _parse_go_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "hello"
        assert symbols[0].kind == "function"

    def test_parse_function_with_params(self):
        code = "func greet(name string) string {\n    return name\n}"
        symbols = _parse_go_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "greet"

    def test_parse_method(self):
        code = "func (s *Server) Start() error {\n    return nil\n}"
        symbols = _parse_go_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "Start"
        assert symbols[0].kind == "function"

    def test_parse_struct(self):
        code = "type User struct {\n    Name string\n}"
        symbols = _parse_go_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "User"
        assert symbols[0].kind == "class"

    def test_parse_interface(self):
        code = "type Reader interface {\n    Read(p []byte) (n int, err error)\n}"
        symbols = _parse_go_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "Reader"
        assert symbols[0].kind == "class"

    def test_parse_multiple_symbols(self):
        code = """type Config struct {
    Port int
}

func NewConfig() *Config {
    return &Config{}
}

func (c *Config) Validate() error {
    return nil
}
"""
        symbols = _parse_go_symbols(code)
        names = [s.name for s in symbols]
        assert "Config" in names
        assert "NewConfig" in names
        assert "Validate" in names


class TestGenericParser:
    """Tests for generic symbol parsing."""

    def test_parse_def_keyword(self):
        code = "def something():\n    pass"
        symbols = _parse_generic_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "something"
        assert symbols[0].kind == "function"

    def test_parse_function_keyword(self):
        code = "function doIt() {}"
        symbols = _parse_generic_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "doIt"

    def test_parse_func_keyword(self):
        code = "func test() {}"
        symbols = _parse_generic_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "test"

    def test_parse_class_keyword(self):
        code = "class MyClass {}"
        symbols = _parse_generic_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "MyClass"
        assert symbols[0].kind == "class"

    def test_parse_struct_keyword(self):
        code = "struct Point { x: i32, y: i32 }"
        symbols = _parse_generic_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "Point"
        assert symbols[0].kind == "class"

    def test_parse_interface_keyword(self):
        code = "interface Drawable {}"
        symbols = _parse_generic_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "Drawable"
        assert symbols[0].kind == "class"


class TestParserInterface:
    """High-level interface tests."""

    def test_simple_parser_parse(self):
        parser = SimpleRegexParser("python")
        indexed = parser.parse("def hello():\n    pass", Path("test.py"))
        assert indexed.language == "python"
        assert len(indexed.symbols) == 1
        assert indexed.symbols[0].name == "hello"

    def test_simple_parser_javascript(self):
        parser = SimpleRegexParser("javascript")
        indexed = parser.parse("function test() {}", Path("test.js"))
        assert indexed.language == "javascript"
        assert len(indexed.symbols) == 1

    def test_simple_parser_typescript(self):
        parser = SimpleRegexParser("typescript")
        indexed = parser.parse("export class Service {}", Path("test.ts"))
        assert indexed.language == "typescript"
        assert len(indexed.symbols) == 1

    def test_simple_parser_java(self):
        parser = SimpleRegexParser("java")
        indexed = parser.parse("public class Main {}", Path("Main.java"))
        assert indexed.language == "java"
        assert len(indexed.symbols) == 1

    def test_simple_parser_go(self):
        parser = SimpleRegexParser("go")
        indexed = parser.parse("func main() {}", Path("main.go"))
        assert indexed.language == "go"
        assert len(indexed.symbols) == 1

    def test_simple_parser_unknown_language(self):
        parser = SimpleRegexParser("zig")
        indexed = parser.parse("fn main() void {}", Path("main.zig"))
        assert indexed.language == "zig"
        # Uses generic parser
        assert indexed.chunks == []

    def test_indexed_file_path_resolved(self):
        parser = SimpleRegexParser("python")
        indexed = parser.parse("def test(): pass", Path("./test.py"))
        # Path should be resolved to absolute
        assert Path(indexed.path).is_absolute()


class TestParserFactory:
    """Tests for ParserFactory."""

    def test_factory_creates_parser(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            import os
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                config = Config()
                factory = ParserFactory(config)
                parser = factory.get_parser("python")
                assert parser is not None
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]

    def test_factory_caches_parsers(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            import os
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                config = Config()
                factory = ParserFactory(config)
                parser1 = factory.get_parser("python")
                parser2 = factory.get_parser("python")
                assert parser1 is parser2
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]

    def test_factory_different_languages(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            import os
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                config = Config()
                factory = ParserFactory(config)
                py_parser = factory.get_parser("python")
                js_parser = factory.get_parser("javascript")
                assert py_parser is not js_parser
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]

    def test_factory_passes_config_to_treesitter(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Ensure ParserFactory config is forwarded into TreeSitterSymbolParser."""
        from codexlens.entities import IndexedFile

        captured: dict = {}

        class FakeTreeSitterSymbolParser:
            def __init__(self, language_id, path=None, config=None) -> None:
                captured["config"] = config
                self.language_id = language_id

            def is_available(self) -> bool:
                return True

            def parse(self, text: str, path: Path) -> IndexedFile:
                return IndexedFile(
                    path=str(path.resolve()),
                    language=self.language_id,
                    symbols=[],
                    chunks=[],
                    relationships=[],
                )

        monkeypatch.setattr(
            "codexlens.parsers.factory.TreeSitterSymbolParser",
            FakeTreeSitterSymbolParser,
        )

        config = Config()
        config.use_astgrep = True

        factory = ParserFactory(config)
        parser = factory.get_parser("python")
        parser.parse("def hello():\n    pass\n", Path("test.py"))

        assert captured.get("config") is config


class TestParserEdgeCases:
    """Edge case tests for parsers."""

    def test_empty_code(self):
        symbols = _parse_python_symbols("")
        assert len(symbols) == 0

    def test_only_comments(self):
        code = "# This is a comment\n# Another comment"
        symbols = _parse_python_symbols(code)
        assert len(symbols) == 0

    def test_nested_functions(self):
        code = """def outer():
    def inner():
        pass
    return inner
"""
        symbols = _parse_python_symbols(code)
        names = [s.name for s in symbols]
        assert "outer" in names
        assert "inner" in names

    def test_unicode_function_name(self):
        code = "def 你好():\n    pass"
        symbols = _parse_python_symbols(code)
        # Regex may not support unicode function names, tree-sitter does
        # So we just verify it doesn't crash
        assert isinstance(symbols, list)

    def test_long_file(self):
        # Generate a file with many functions
        lines = []
        for i in range(100):
            lines.append(f"def func_{i}():\n    pass\n")
        code = "\n".join(lines)
        symbols = _parse_python_symbols(code)
        assert len(symbols) == 100

    def test_malformed_code(self):
        # Parser should handle malformed code gracefully
        code = "def broken(\n    pass"
        # Should not crash
        symbols = _parse_python_symbols(code)
        # May or may not find symbols depending on regex
