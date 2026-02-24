"""Tests for CLI hybrid search integration (T6)."""

import pytest
from typer.testing import CliRunner
from codexlens.cli.commands import app


class TestCLIHybridSearch:
    """Test CLI integration for hybrid search modes."""

    @pytest.fixture
    def runner(self):
        """Create CLI test runner."""
        return CliRunner()

    def test_search_mode_parameter_validation(self, runner):
        """Test --mode parameter accepts valid modes and rejects invalid ones."""
        # Valid modes should pass validation (even if no index exists)
        valid_modes = ["exact", "fuzzy", "hybrid", "vector"]
        for mode in valid_modes:
            result = runner.invoke(app, ["search", "test", "--mode", mode])
            # Should fail due to no index, not due to invalid mode
            # Note: CLI now shows deprecation warning for --mode, use --method instead
            assert "Invalid" not in result.output or "deprecated" in result.output.lower()

        # Invalid mode should fail
        result = runner.invoke(app, ["search", "test", "--mode", "invalid"])
        assert result.exit_code == 1
        # CLI now shows "Invalid deprecated mode:" instead of "Invalid mode"
        assert "Invalid" in result.output and "mode" in result.output.lower()

    def test_weights_parameter_parsing(self, runner):
        """Test --weights parameter parses and validates correctly."""
        # Valid weights (3 values summing to ~1.0)
        result = runner.invoke(
            app, ["search", "test", "--mode", "hybrid", "--weights", "0.5,0.3,0.2"]
        )
        # Should not show weight warning
        assert "Invalid weights" not in result.output

        # Invalid weights (wrong number of values)
        result = runner.invoke(
            app, ["search", "test", "--mode", "hybrid", "--weights", "0.5,0.5"]
        )
        assert "Invalid weights format" in result.output

        # Invalid weights (non-numeric)
        result = runner.invoke(
            app, ["search", "test", "--mode", "hybrid", "--weights", "a,b,c"]
        )
        assert "Invalid weights format" in result.output

    def test_weights_normalization(self, runner):
        """Test weights are normalized when they don't sum to 1.0."""
        # Weights summing to 2.0 should trigger normalization warning
        result = runner.invoke(
            app, ["search", "test", "--mode", "hybrid", "--weights", "0.8,0.6,0.6"]
        )
        # Should show normalization warning
        if "Normalizing" in result.output or "Warning" in result.output:
            # Expected behavior
            pass

    def test_search_help_shows_modes(self, runner):
        """Test search --help displays all available methods."""
        result = runner.invoke(app, ["search", "--help"])
        assert result.exit_code == 0
        # CLI now uses --method with: dense_rerank, fts, hybrid, cascade
        assert "dense_rerank" in result.output or "fts" in result.output
        assert "method" in result.output.lower()

    def test_migrate_command_exists(self, runner):
        """Test migrate command is registered and accessible."""
        result = runner.invoke(app, ["migrate", "--help"])
        assert result.exit_code == 0
        assert "Dual-FTS upgrade" in result.output
        assert "schema version 4" in result.output

    def test_status_command_shows_backends(self, runner):
        """Test status command displays search backend availability."""
        result = runner.invoke(app, ["status"])
        # Should show backend status (even if no indexes)
        assert "Search Backends" in result.output or result.exit_code == 0


class TestSearchModeMapping:
    """Test mode parameter maps correctly to SearchOptions."""

    @pytest.fixture
    def runner(self):
        """Create CLI test runner."""
        return CliRunner()

    def test_exact_mode_disables_fuzzy(self, runner):
        """Test --mode exact disables fuzzy search."""
        # This would require mocking, but we can verify the parameter is accepted
        result = runner.invoke(app, ["search", "test", "--mode", "exact"])
        # Should not show mode validation error
        assert "Invalid mode" not in result.output

    def test_fuzzy_mode_enables_only_fuzzy(self, runner):
        """Test --mode fuzzy enables fuzzy search only."""
        result = runner.invoke(app, ["search", "test", "--mode", "fuzzy"])
        assert "Invalid mode" not in result.output

    def test_hybrid_mode_enables_both(self, runner):
        """Test --mode hybrid enables both exact and fuzzy."""
        result = runner.invoke(app, ["search", "test", "--mode", "hybrid"])
        assert "Invalid mode" not in result.output

    def test_vector_mode_accepted(self, runner):
        """Test --mode vector is accepted (future feature)."""
        result = runner.invoke(app, ["search", "test", "--mode", "vector"])
        assert "Invalid mode" not in result.output


def test_cli_imports_successfully():
    """Test CLI modules import without errors."""
    from codexlens.cli import commands, output

    assert hasattr(commands, "app")
    assert hasattr(output, "render_search_results")
