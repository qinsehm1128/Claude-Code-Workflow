"""Tests for semantic_search API."""
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from codexlens.api import SemanticResult
from codexlens.api.semantic import (
    semantic_search,
    _build_search_options,
    _generate_match_reason,
    _split_camel_case,
    _transform_results,
)


class TestSemanticSearchFunctionSignature:
    """Test that semantic_search has the correct function signature."""

    def test_function_accepts_all_parameters(self):
        """Verify function signature matches spec."""
        import inspect
        sig = inspect.signature(semantic_search)
        params = list(sig.parameters.keys())

        expected_params = [
            "project_root",
            "query",
            "mode",
            "vector_weight",
            "structural_weight",
            "keyword_weight",
            "fusion_strategy",
            "staged_stage2_mode",
            "kind_filter",
            "limit",
            "include_match_reason",
        ]

        assert params == expected_params

    def test_default_parameter_values(self):
        """Verify default parameter values match spec."""
        import inspect
        sig = inspect.signature(semantic_search)

        assert sig.parameters["mode"].default == "fusion"
        assert sig.parameters["vector_weight"].default == 0.5
        assert sig.parameters["structural_weight"].default == 0.3
        assert sig.parameters["keyword_weight"].default == 0.2
        assert sig.parameters["fusion_strategy"].default == "rrf"
        assert sig.parameters["staged_stage2_mode"].default is None
        assert sig.parameters["kind_filter"].default is None
        assert sig.parameters["limit"].default == 20
        assert sig.parameters["include_match_reason"].default is False


class TestBuildSearchOptions:
    """Test _build_search_options helper function."""

    def test_vector_mode_options(self):
        """Test options for pure vector mode."""
        options = _build_search_options(
            mode="vector",
            vector_weight=1.0,
            structural_weight=0.0,
            keyword_weight=0.0,
            limit=20,
        )

        assert options.hybrid_mode is True
        assert options.enable_vector is True
        assert options.pure_vector is True
        assert options.enable_fuzzy is False

    def test_structural_mode_options(self):
        """Test options for structural mode."""
        options = _build_search_options(
            mode="structural",
            vector_weight=0.0,
            structural_weight=1.0,
            keyword_weight=0.0,
            limit=20,
        )

        assert options.hybrid_mode is True
        assert options.enable_vector is False
        assert options.enable_fuzzy is True
        assert options.include_symbols is True

    def test_fusion_mode_options(self):
        """Test options for fusion mode (default)."""
        options = _build_search_options(
            mode="fusion",
            vector_weight=0.5,
            structural_weight=0.3,
            keyword_weight=0.2,
            limit=20,
        )

        assert options.hybrid_mode is True
        assert options.enable_vector is True  # vector_weight > 0
        assert options.enable_fuzzy is True   # keyword_weight > 0
        assert options.include_symbols is True  # structural_weight > 0


class TestTransformResults:
    """Test _transform_results helper function."""

    def test_transforms_basic_result(self):
        """Test basic result transformation."""
        mock_result = MagicMock()
        mock_result.path = "/project/src/auth.py"
        mock_result.score = 0.85
        mock_result.excerpt = "def authenticate():"
        mock_result.symbol_name = "authenticate"
        mock_result.symbol_kind = "function"
        mock_result.start_line = 10
        mock_result.symbol = None
        mock_result.metadata = {}

        results = _transform_results(
            results=[mock_result],
            mode="fusion",
            vector_weight=0.5,
            structural_weight=0.3,
            keyword_weight=0.2,
            kind_filter=None,
            include_match_reason=False,
            query="auth",
        )

        assert len(results) == 1
        assert results[0].symbol_name == "authenticate"
        assert results[0].kind == "function"
        assert results[0].file_path == "/project/src/auth.py"
        assert results[0].line == 10
        assert results[0].fusion_score == 0.85

    def test_kind_filter_excludes_non_matching(self):
        """Test that kind_filter excludes non-matching results."""
        mock_result = MagicMock()
        mock_result.path = "/project/src/auth.py"
        mock_result.score = 0.85
        mock_result.excerpt = "AUTH_TOKEN = 'secret'"
        mock_result.symbol_name = "AUTH_TOKEN"
        mock_result.symbol_kind = "variable"
        mock_result.start_line = 5
        mock_result.symbol = None
        mock_result.metadata = {}

        results = _transform_results(
            results=[mock_result],
            mode="fusion",
            vector_weight=0.5,
            structural_weight=0.3,
            keyword_weight=0.2,
            kind_filter=["function", "class"],  # Exclude variable
            include_match_reason=False,
            query="auth",
        )

        assert len(results) == 0

    def test_kind_filter_includes_matching(self):
        """Test that kind_filter includes matching results."""
        mock_result = MagicMock()
        mock_result.path = "/project/src/auth.py"
        mock_result.score = 0.85
        mock_result.excerpt = "class AuthManager:"
        mock_result.symbol_name = "AuthManager"
        mock_result.symbol_kind = "class"
        mock_result.start_line = 1
        mock_result.symbol = None
        mock_result.metadata = {}

        results = _transform_results(
            results=[mock_result],
            mode="fusion",
            vector_weight=0.5,
            structural_weight=0.3,
            keyword_weight=0.2,
            kind_filter=["function", "class"],  # Include class
            include_match_reason=False,
            query="auth",
        )

        assert len(results) == 1
        assert results[0].symbol_name == "AuthManager"

    def test_include_match_reason_generates_reason(self):
        """Test that include_match_reason generates match reasons."""
        mock_result = MagicMock()
        mock_result.path = "/project/src/auth.py"
        mock_result.score = 0.85
        mock_result.excerpt = "def authenticate(user, password):"
        mock_result.symbol_name = "authenticate"
        mock_result.symbol_kind = "function"
        mock_result.start_line = 10
        mock_result.symbol = None
        mock_result.metadata = {}

        results = _transform_results(
            results=[mock_result],
            mode="fusion",
            vector_weight=0.5,
            structural_weight=0.3,
            keyword_weight=0.2,
            kind_filter=None,
            include_match_reason=True,
            query="authenticate",
        )

        assert len(results) == 1
        assert results[0].match_reason is not None
        assert "authenticate" in results[0].match_reason.lower()


class TestGenerateMatchReason:
    """Test _generate_match_reason helper function."""

    def test_direct_name_match(self):
        """Test match reason for direct name match."""
        reason = _generate_match_reason(
            query="authenticate",
            symbol_name="authenticate",
            symbol_kind="function",
            snippet="def authenticate(user): pass",
            vector_score=0.8,
            structural_score=None,
        )

        assert "authenticate" in reason.lower()

    def test_keyword_match(self):
        """Test match reason for keyword match in snippet."""
        reason = _generate_match_reason(
            query="password validation",
            symbol_name="verify_user",
            symbol_kind="function",
            snippet="def verify_user(password): validate(password)",
            vector_score=0.6,
            structural_score=None,
        )

        assert "password" in reason.lower() or "validation" in reason.lower()

    def test_high_semantic_similarity(self):
        """Test match reason mentions semantic similarity for high vector score."""
        reason = _generate_match_reason(
            query="authentication",
            symbol_name="login_handler",
            symbol_kind="function",
            snippet="def login_handler(): pass",
            vector_score=0.85,
            structural_score=None,
        )

        assert "semantic" in reason.lower()

    def test_returns_string_even_with_no_matches(self):
        """Test that a reason string is always returned."""
        reason = _generate_match_reason(
            query="xyz123",
            symbol_name="abc456",
            symbol_kind="function",
            snippet="completely unrelated code",
            vector_score=0.3,
            structural_score=None,
        )

        assert isinstance(reason, str)
        assert len(reason) > 0


class TestSplitCamelCase:
    """Test _split_camel_case helper function."""

    def test_camel_case(self):
        """Test splitting camelCase."""
        result = _split_camel_case("authenticateUser")
        assert "authenticate" in result.lower()
        assert "user" in result.lower()

    def test_pascal_case(self):
        """Test splitting PascalCase."""
        result = _split_camel_case("AuthManager")
        assert "auth" in result.lower()
        assert "manager" in result.lower()

    def test_snake_case(self):
        """Test splitting snake_case."""
        result = _split_camel_case("auth_manager")
        assert "auth" in result.lower()
        assert "manager" in result.lower()

    def test_mixed_case(self):
        """Test splitting mixed case."""
        result = _split_camel_case("HTTPRequestHandler")
        # Should handle acronyms
        assert "http" in result.lower() or "request" in result.lower()


class TestSemanticResultDataclass:
    """Test SemanticResult dataclass structure."""

    def test_semantic_result_fields(self):
        """Test SemanticResult has all required fields."""
        result = SemanticResult(
            symbol_name="test",
            kind="function",
            file_path="/test.py",
            line=1,
            vector_score=0.8,
            structural_score=0.6,
            fusion_score=0.7,
            snippet="def test(): pass",
            match_reason="Test match",
        )

        assert result.symbol_name == "test"
        assert result.kind == "function"
        assert result.file_path == "/test.py"
        assert result.line == 1
        assert result.vector_score == 0.8
        assert result.structural_score == 0.6
        assert result.fusion_score == 0.7
        assert result.snippet == "def test(): pass"
        assert result.match_reason == "Test match"

    def test_semantic_result_optional_fields(self):
        """Test SemanticResult with optional None fields."""
        result = SemanticResult(
            symbol_name="test",
            kind="function",
            file_path="/test.py",
            line=1,
            vector_score=None,  # Degraded - no vector index
            structural_score=None,  # Degraded - no relationships
            fusion_score=0.5,
            snippet="def test(): pass",
            match_reason=None,  # Not requested
        )

        assert result.vector_score is None
        assert result.structural_score is None
        assert result.match_reason is None

    def test_semantic_result_to_dict(self):
        """Test SemanticResult.to_dict() filters None values."""
        result = SemanticResult(
            symbol_name="test",
            kind="function",
            file_path="/test.py",
            line=1,
            vector_score=None,
            structural_score=0.6,
            fusion_score=0.7,
            snippet="def test(): pass",
            match_reason=None,
        )

        d = result.to_dict()

        assert "symbol_name" in d
        assert "vector_score" not in d  # None values filtered
        assert "structural_score" in d
        assert "match_reason" not in d  # None values filtered


class TestFusionStrategyMapping:
    """Test fusion_strategy parameter mapping via _execute_search."""

    def test_rrf_strategy_calls_search(self):
        """Test that rrf strategy maps to standard search."""
        from codexlens.api.semantic import _execute_search

        mock_engine = MagicMock()
        mock_engine.search.return_value = MagicMock(results=[])
        mock_options = MagicMock()

        _execute_search(
            engine=mock_engine,
            query="test query",
            source_path=Path("/test"),
            fusion_strategy="rrf",
            options=mock_options,
            limit=20,
        )

        mock_engine.search.assert_called_once()

    def test_staged_strategy_calls_staged_cascade_search(self):
        """Test that staged strategy maps to staged_cascade_search."""
        from codexlens.api.semantic import _execute_search

        mock_engine = MagicMock()
        mock_engine.staged_cascade_search.return_value = MagicMock(results=[])
        mock_options = MagicMock()

        _execute_search(
            engine=mock_engine,
            query="test query",
            source_path=Path("/test"),
            fusion_strategy="staged",
            options=mock_options,
            limit=20,
        )

        mock_engine.staged_cascade_search.assert_called_once()

    def test_binary_strategy_calls_binary_cascade_search(self):
        """Test that binary strategy maps to binary_cascade_search."""
        from codexlens.api.semantic import _execute_search

        mock_engine = MagicMock()
        mock_engine.binary_cascade_search.return_value = MagicMock(results=[])
        mock_options = MagicMock()

        _execute_search(
            engine=mock_engine,
            query="test query",
            source_path=Path("/test"),
            fusion_strategy="binary",
            options=mock_options,
            limit=20,
        )

        mock_engine.binary_cascade_search.assert_called_once()

    def test_hybrid_strategy_maps_to_binary_rerank(self):
        """Test that hybrid strategy maps to binary_rerank_cascade_search (backward compat)."""
        from codexlens.api.semantic import _execute_search

        mock_engine = MagicMock()
        mock_engine.binary_rerank_cascade_search.return_value = MagicMock(results=[])
        mock_options = MagicMock()

        _execute_search(
            engine=mock_engine,
            query="test query",
            source_path=Path("/test"),
            fusion_strategy="hybrid",
            options=mock_options,
            limit=20,
        )

        mock_engine.binary_rerank_cascade_search.assert_called_once()

    def test_unknown_strategy_defaults_to_rrf(self):
        """Test that unknown strategy defaults to standard search (rrf)."""
        from codexlens.api.semantic import _execute_search

        mock_engine = MagicMock()
        mock_engine.search.return_value = MagicMock(results=[])
        mock_options = MagicMock()

        _execute_search(
            engine=mock_engine,
            query="test query",
            source_path=Path("/test"),
            fusion_strategy="unknown_strategy",
            options=mock_options,
            limit=20,
        )

        mock_engine.search.assert_called_once()


class TestGracefulDegradation:
    """Test graceful degradation behavior."""

    def test_vector_score_none_when_no_vector_index(self):
        """Test vector_score=None when vector index unavailable."""
        mock_result = MagicMock()
        mock_result.path = "/project/src/auth.py"
        mock_result.score = 0.5
        mock_result.excerpt = "def auth(): pass"
        mock_result.symbol_name = "auth"
        mock_result.symbol_kind = "function"
        mock_result.start_line = 1
        mock_result.symbol = None
        mock_result.metadata = {}  # No vector score in metadata

        results = _transform_results(
            results=[mock_result],
            mode="fusion",
            vector_weight=0.5,
            structural_weight=0.3,
            keyword_weight=0.2,
            kind_filter=None,
            include_match_reason=False,
            query="auth",
        )

        assert len(results) == 1
        # When no source_scores in metadata, vector_score should be None
        assert results[0].vector_score is None

    def test_structural_score_extracted_from_fts(self):
        """Test structural_score extracted from FTS scores."""
        mock_result = MagicMock()
        mock_result.path = "/project/src/auth.py"
        mock_result.score = 0.8
        mock_result.excerpt = "def auth(): pass"
        mock_result.symbol_name = "auth"
        mock_result.symbol_kind = "function"
        mock_result.start_line = 1
        mock_result.symbol = None
        mock_result.metadata = {
            "source_scores": {
                "exact": 0.9,
                "fuzzy": 0.7,
            }
        }

        results = _transform_results(
            results=[mock_result],
            mode="fusion",
            vector_weight=0.5,
            structural_weight=0.3,
            keyword_weight=0.2,
            kind_filter=None,
            include_match_reason=False,
            query="auth",
        )

        assert len(results) == 1
        assert results[0].structural_score == 0.9  # max of exact/fuzzy
