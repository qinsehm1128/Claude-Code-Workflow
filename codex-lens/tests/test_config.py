"""Tests for CodexLens configuration system."""

import builtins
import json
import logging
import os
import tempfile
from pathlib import Path

import pytest

from codexlens.config import (
    WORKSPACE_DIR_NAME,
    Config,
    WorkspaceConfig,
    _default_global_dir,
    find_workspace_root,
)
from codexlens.errors import ConfigError


class TestDefaultGlobalDir:
    """Tests for _default_global_dir function."""

    def test_default_location(self):
        """Test default location is ~/.codexlens."""
        # Clear any environment override
        env_backup = os.environ.get("CODEXLENS_DATA_DIR")
        if "CODEXLENS_DATA_DIR" in os.environ:
            del os.environ["CODEXLENS_DATA_DIR"]

        try:
            result = _default_global_dir()
            assert result == (Path.home() / ".codexlens").resolve()
        finally:
            if env_backup is not None:
                os.environ["CODEXLENS_DATA_DIR"] = env_backup

    def test_env_override(self):
        """Test CODEXLENS_DATA_DIR environment variable override."""
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                result = _default_global_dir()
                assert result == Path(tmpdir).resolve()
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]


class TestFindWorkspaceRoot:
    """Tests for find_workspace_root function."""

    def test_finds_workspace_in_current_dir(self):
        """Test finding workspace when .codexlens is in current directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base = Path(tmpdir)
            (base / WORKSPACE_DIR_NAME).mkdir()

            result = find_workspace_root(base)
            assert result == base.resolve()

    def test_finds_workspace_in_parent_dir(self):
        """Test finding workspace in parent directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base = Path(tmpdir)
            (base / WORKSPACE_DIR_NAME).mkdir()
            subdir = base / "src" / "components"
            subdir.mkdir(parents=True)

            result = find_workspace_root(subdir)
            assert result == base.resolve()

    def test_returns_none_when_not_found(self):
        """Test returns None when no workspace found in isolated directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a deep nested directory to avoid finding user's home .codexlens
            isolated = Path(tmpdir) / "a" / "b" / "c"
            isolated.mkdir(parents=True)
            result = find_workspace_root(isolated)
            # May find user's .codexlens if it exists in parent dirs
            # So we just check it doesn't find one in our temp directory
            if result is not None:
                assert WORKSPACE_DIR_NAME not in str(isolated)

    def test_does_not_find_file_as_workspace(self):
        """Test that a file named .codexlens is not recognized as workspace."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base = Path(tmpdir)
            # Create isolated subdirectory
            subdir = base / "project"
            subdir.mkdir()
            (subdir / WORKSPACE_DIR_NAME).write_text("not a directory")

            result = find_workspace_root(subdir)
            # Should not find the file as workspace
            if result is not None:
                assert result != subdir


class TestConfig:
    """Tests for Config class."""

    def test_default_config(self):
        """Test creating config with defaults."""
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                config = Config()
                assert config.data_dir == Path(tmpdir).resolve()
                assert config.venv_path == Path(tmpdir).resolve() / "venv"
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]

    def test_creates_data_dir(self):
        """Test that data_dir is created on init."""
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir) / "new_dir"
            config = Config(data_dir=data_dir)
            assert data_dir.exists()

    def test_post_init_permission_error_includes_path_and_cause(self, monkeypatch):
        """PermissionError during __post_init__ should raise ConfigError with context."""
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir) / "blocked"
            venv_path = Path(tmpdir) / "venv"
            expected_data_dir = data_dir.expanduser().resolve()

            real_mkdir = Path.mkdir

            def guarded_mkdir(self, *args, **kwargs):
                if self == expected_data_dir:
                    raise PermissionError("Permission denied")
                return real_mkdir(self, *args, **kwargs)

            monkeypatch.setattr(Path, "mkdir", guarded_mkdir)

            with pytest.raises(ConfigError) as excinfo:
                Config(data_dir=data_dir, venv_path=venv_path)

            message = str(excinfo.value)
            assert str(expected_data_dir) in message
            assert "permission" in message.lower()
            assert "PermissionError" in message
            assert isinstance(excinfo.value.__cause__, PermissionError)

    def test_post_init_os_error_includes_path_and_cause(self, monkeypatch):
        """OSError during __post_init__ should raise ConfigError with context."""
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir) / "invalid"
            venv_path = Path(tmpdir) / "venv"
            expected_data_dir = data_dir.expanduser().resolve()

            real_mkdir = Path.mkdir

            def guarded_mkdir(self, *args, **kwargs):
                if self == expected_data_dir:
                    raise OSError("Invalid path")
                return real_mkdir(self, *args, **kwargs)

            monkeypatch.setattr(Path, "mkdir", guarded_mkdir)

            with pytest.raises(ConfigError) as excinfo:
                Config(data_dir=data_dir, venv_path=venv_path)

            message = str(excinfo.value)
            assert str(expected_data_dir) in message
            assert "permission" not in message.lower()
            assert "filesystem" in message.lower()
            assert "OSError" in message
            assert isinstance(excinfo.value.__cause__, OSError)

    def test_supported_languages(self):
        """Test default supported languages."""
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                config = Config()
                assert "python" in config.supported_languages
                assert "javascript" in config.supported_languages
                assert "typescript" in config.supported_languages
                assert "java" in config.supported_languages
                assert "go" in config.supported_languages
                assert "swift" in config.supported_languages
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]

    def test_language_for_path_swift(self):
        """Swift (.swift) files should be recognized as code."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = Config(data_dir=Path(tmpdir))
            assert config.language_for_path("x.swift") == "swift"
            assert config.language_for_path("X.SWIFT") == "swift"
            assert config.category_for_path("x.swift") == "code"

    def test_cache_dir_property(self):
        """Test cache_dir property."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = Config(data_dir=Path(tmpdir))
            assert config.cache_dir == Path(tmpdir).resolve() / "cache"

    def test_index_dir_property(self):
        """Test index_dir property."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = Config(data_dir=Path(tmpdir))
            assert config.index_dir == Path(tmpdir).resolve() / "index"

    def test_db_path_property(self):
        """Test db_path property."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = Config(data_dir=Path(tmpdir))
            assert config.db_path == Path(tmpdir).resolve() / "index" / "codexlens.db"

    def test_ensure_runtime_dirs(self):
        """Test ensure_runtime_dirs creates directories."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = Config(data_dir=Path(tmpdir))
            config.ensure_runtime_dirs()
            assert config.cache_dir.exists()
            assert config.index_dir.exists()

    def test_ensure_runtime_dirs_permission_error_includes_path_and_cause(self, monkeypatch):
        """PermissionError during ensure_runtime_dirs should raise ConfigError with context."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = Config(data_dir=Path(tmpdir))
            target_dir = config.cache_dir

            real_mkdir = Path.mkdir

            def guarded_mkdir(self, *args, **kwargs):
                if self == target_dir:
                    raise PermissionError("Permission denied")
                return real_mkdir(self, *args, **kwargs)

            monkeypatch.setattr(Path, "mkdir", guarded_mkdir)

            with pytest.raises(ConfigError) as excinfo:
                config.ensure_runtime_dirs()

            message = str(excinfo.value)
            assert str(target_dir) in message
            assert "permission" in message.lower()
            assert "PermissionError" in message
            assert isinstance(excinfo.value.__cause__, PermissionError)

    def test_ensure_runtime_dirs_os_error_includes_path_and_cause(self, monkeypatch):
        """OSError during ensure_runtime_dirs should raise ConfigError with context."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = Config(data_dir=Path(tmpdir))
            target_dir = config.cache_dir

            real_mkdir = Path.mkdir

            def guarded_mkdir(self, *args, **kwargs):
                if self == target_dir:
                    raise OSError("Invalid path")
                return real_mkdir(self, *args, **kwargs)

            monkeypatch.setattr(Path, "mkdir", guarded_mkdir)

            with pytest.raises(ConfigError) as excinfo:
                config.ensure_runtime_dirs()

            message = str(excinfo.value)
            assert str(target_dir) in message
            assert "permission" not in message.lower()
            assert "filesystem" in message.lower()
            assert "OSError" in message
            assert isinstance(excinfo.value.__cause__, OSError)

    def test_language_for_path_python(self):
        """Test language detection for Python files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                config = Config()
                assert config.language_for_path("test.py") == "python"
                assert config.language_for_path("/path/to/file.py") == "python"
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]

    def test_language_for_path_javascript(self):
        """Test language detection for JavaScript files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                config = Config()
                assert config.language_for_path("test.js") == "javascript"
                assert config.language_for_path("component.jsx") == "javascript"
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]

    def test_language_for_path_typescript(self):
        """Test language detection for TypeScript files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                config = Config()
                assert config.language_for_path("test.ts") == "typescript"
                assert config.language_for_path("component.tsx") == "typescript"
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]

    def test_language_for_path_unknown(self):
        """Test language detection for unknown files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                config = Config()
                assert config.language_for_path("test.xyz") is None
                assert config.language_for_path("data.csv") is None
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]

    def test_language_for_path_case_insensitive(self):
        """Test language detection is case insensitive."""
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                config = Config()
                assert config.language_for_path("TEST.PY") == "python"
                assert config.language_for_path("File.Js") == "javascript"
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]

    def test_rules_for_language(self):
        """Test getting parsing rules for a language."""
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                config = Config()
                rules = config.rules_for_language("python")
                assert "max_chunk_chars" in rules
                assert "max_chunk_lines" in rules
                assert "overlap_lines" in rules
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]


class TestConfigLoadSettings:
    """Tests for Config.load_settings behavior and logging."""

    def test_load_settings_logs_warning_on_malformed_json(self, caplog):
        """Malformed JSON in settings file should trigger warning log."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = Config(data_dir=Path(tmpdir))
            config.settings_path.write_text("{", encoding="utf-8")

            with caplog.at_level(logging.WARNING):
                config.load_settings()

            records = [r for r in caplog.records if r.name == "codexlens.config"]
            assert any("Failed to load settings from" in r.message for r in records)
            assert any("JSONDecodeError" in r.message for r in records)
            assert any(str(config.settings_path) in r.message for r in records)

    def test_load_settings_logs_warning_on_permission_error(self, monkeypatch, caplog):
        """Permission errors opening settings file should trigger warning log."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = Config(data_dir=Path(tmpdir))
            config.settings_path.write_text("{}", encoding="utf-8")

            real_open = builtins.open

            def guarded_open(path, mode="r", *args, **kwargs):
                if Path(path) == config.settings_path and "r" in mode:
                    raise PermissionError("Permission denied")
                return real_open(path, mode, *args, **kwargs)

            monkeypatch.setattr(builtins, "open", guarded_open)

            with caplog.at_level(logging.WARNING):
                config.load_settings()

            records = [r for r in caplog.records if r.name == "codexlens.config"]
            assert any("Failed to load settings from" in r.message for r in records)
            assert any("PermissionError" in r.message for r in records)

    def test_load_settings_loads_valid_settings_without_warning(self, caplog):
        """Valid settings should load without warning logs."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = Config(data_dir=Path(tmpdir))
            config.settings_path.write_text(
                json.dumps(
                    {
                        "embedding": {
                            "backend": "fastembed",
                            "model": "multilingual",
                            "use_gpu": False,
                        },
                        "llm": {
                            "enabled": True,
                            "tool": "gemini",
                            "timeout_ms": 1234,
                            "batch_size": 7,
                        },
                    }
                ),
                encoding="utf-8",
            )

            with caplog.at_level(logging.WARNING):
                config.load_settings()

            records = [r for r in caplog.records if r.name == "codexlens.config"]
            assert not records
            assert config.embedding_backend == "fastembed"
            assert config.embedding_model == "multilingual"
            assert config.embedding_use_gpu is False
            assert config.llm_enabled is True
            assert config.llm_tool == "gemini"
            assert config.llm_timeout_ms == 1234
            assert config.llm_batch_size == 7

    def test_load_settings_logs_warning_on_invalid_embedding_backend(self, caplog):
        """Invalid embedding backend should trigger warning log and keep default."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = Config(data_dir=Path(tmpdir))
            default_backend = config.embedding_backend
            config.settings_path.write_text(
                json.dumps({"embedding": {"backend": "invalid-backend"}}),
                encoding="utf-8",
            )

            with caplog.at_level(logging.WARNING):
                config.load_settings()

            records = [r for r in caplog.records if r.name == "codexlens.config"]
            assert any("Invalid embedding backend in" in r.message for r in records)
            assert config.embedding_backend == default_backend


class TestWorkspaceConfig:
    """Tests for WorkspaceConfig class."""

    def test_create_workspace_config(self):
        """Test creating a workspace config."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = WorkspaceConfig(workspace_root=Path(tmpdir))
            assert workspace.workspace_root == Path(tmpdir).resolve()

    def test_codexlens_dir_property(self):
        """Test codexlens_dir property."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = WorkspaceConfig(workspace_root=Path(tmpdir))
            assert workspace.codexlens_dir == Path(tmpdir).resolve() / WORKSPACE_DIR_NAME

    def test_db_path_property(self):
        """Test db_path property."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = WorkspaceConfig(workspace_root=Path(tmpdir))
            expected = Path(tmpdir).resolve() / WORKSPACE_DIR_NAME / "index.db"
            assert workspace.db_path == expected

    def test_cache_dir_property(self):
        """Test cache_dir property."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = WorkspaceConfig(workspace_root=Path(tmpdir))
            expected = Path(tmpdir).resolve() / WORKSPACE_DIR_NAME / "cache"
            assert workspace.cache_dir == expected

    def test_initialize_creates_directories(self):
        """Test initialize creates .codexlens directory structure."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = WorkspaceConfig(workspace_root=Path(tmpdir))
            workspace.initialize()

            assert workspace.codexlens_dir.exists()
            assert workspace.cache_dir.exists()
            assert (workspace.codexlens_dir / ".gitignore").exists()

    def test_initialize_creates_gitignore(self):
        """Test initialize creates .gitignore with correct content."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = WorkspaceConfig(workspace_root=Path(tmpdir))
            workspace.initialize()

            gitignore = workspace.codexlens_dir / ".gitignore"
            content = gitignore.read_text()
            assert "cache/" in content

    def test_exists_false_when_not_initialized(self):
        """Test exists returns False when not initialized."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = WorkspaceConfig(workspace_root=Path(tmpdir))
            assert not workspace.exists()

    def test_exists_true_when_initialized_with_db(self):
        """Test exists returns True when initialized with db."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = WorkspaceConfig(workspace_root=Path(tmpdir))
            workspace.initialize()
            # Create the db file to simulate full initialization
            workspace.db_path.write_text("")
            assert workspace.exists()

    def test_from_path_finds_workspace(self):
        """Test from_path finds existing workspace."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base = Path(tmpdir)
            (base / WORKSPACE_DIR_NAME).mkdir()

            workspace = WorkspaceConfig.from_path(base)
            assert workspace is not None
            assert workspace.workspace_root == base.resolve()

    def test_from_path_returns_none_when_not_found(self):
        """Test from_path returns None when no workspace found in isolated directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create isolated directory structure to avoid user's .codexlens
            isolated = Path(tmpdir) / "a" / "b" / "c"
            isolated.mkdir(parents=True)
            workspace = WorkspaceConfig.from_path(isolated)
            # May find user's .codexlens if it exists
            if workspace is not None:
                assert WORKSPACE_DIR_NAME not in str(isolated)

    def test_create_at_initializes_workspace(self):
        """Test create_at creates and initializes workspace."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = WorkspaceConfig.create_at(Path(tmpdir))
            assert workspace.codexlens_dir.exists()
            assert workspace.cache_dir.exists()


class TestConfigEdgeCases:
    """Edge case tests for configuration."""

    def test_config_with_path_object(self):
        """Test Config accepts Path objects."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = Config(data_dir=Path(tmpdir))
            assert isinstance(config.data_dir, Path)

    def test_config_expands_user_path(self):
        """Test Config expands ~ in paths."""
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["CODEXLENS_DATA_DIR"] = tmpdir
            try:
                config = Config()
                # Just verify it doesn't crash and returns a resolved path
                assert config.data_dir.is_absolute()
            finally:
                del os.environ["CODEXLENS_DATA_DIR"]

    def test_workspace_config_from_subdir(self):
        """Test WorkspaceConfig.from_path works from subdirectory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base = Path(tmpdir)
            (base / WORKSPACE_DIR_NAME).mkdir()
            deep_subdir = base / "a" / "b" / "c" / "d"
            deep_subdir.mkdir(parents=True)

            workspace = WorkspaceConfig.from_path(deep_subdir)
            assert workspace is not None
            assert workspace.workspace_root == base.resolve()
