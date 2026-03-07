"""Pydantic models for DeepWiki index storage.

DeepWiki stores mappings between source files, symbols, and generated documentation
for the DeepWiki documentation generation system.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional, Tuple

from pydantic import BaseModel, Field, field_validator


class DeepWikiSymbol(BaseModel):
    """A symbol record in the DeepWiki index.

    Maps a code symbol to its generated documentation file and anchor.
    """

    id: Optional[int] = Field(default=None, description="Database row ID")
    name: str = Field(..., min_length=1, description="Symbol name (function, class, etc.)")
    type: str = Field(..., min_length=1, description="Symbol type (function, class, method, variable)")
    source_file: str = Field(..., min_length=1, description="Path to source file containing the symbol")
    doc_file: str = Field(..., min_length=1, description="Path to generated documentation file")
    anchor: str = Field(..., min_length=1, description="HTML anchor ID for linking to specific section")
    line_range: Tuple[int, int] = Field(
        ...,
        description="(start_line, end_line) in source file, 1-based inclusive"
    )
    created_at: Optional[datetime] = Field(default=None, description="Record creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Record update timestamp")
    staleness_score: float = Field(default=0.0, ge=0.0, le=1.0, description="Staleness score (0.0=fresh, 1.0=stale)")
    last_checked_commit: Optional[str] = Field(default=None, description="Git commit hash at last freshness check")
    last_checked_at: Optional[float] = Field(default=None, description="Timestamp of last freshness check")
    staleness_factors: Optional[dict[str, Any]] = Field(default=None, description="JSON factors contributing to staleness score")

    @field_validator("line_range")
    @classmethod
    def validate_line_range(cls, value: Tuple[int, int]) -> Tuple[int, int]:
        """Validate line range is proper tuple with start <= end."""
        if len(value) != 2:
            raise ValueError("line_range must be a (start_line, end_line) tuple")
        start_line, end_line = value
        if start_line < 1 or end_line < 1:
            raise ValueError("line_range lines must be >= 1")
        if end_line < start_line:
            raise ValueError("end_line must be >= start_line")
        return value

    @field_validator("name", "type", "source_file", "doc_file", "anchor")
    @classmethod
    def strip_and_validate_nonempty(cls, value: str) -> str:
        """Strip whitespace and validate non-empty."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("value cannot be blank")
        return cleaned


class DeepWikiDoc(BaseModel):
    """A documentation file record in the DeepWiki index.

    Tracks generated documentation files and their associated symbols.
    """

    id: Optional[int] = Field(default=None, description="Database row ID")
    path: str = Field(..., min_length=1, description="Path to documentation file")
    content_hash: str = Field(..., min_length=1, description="SHA256 hash of file content for change detection")
    symbols: List[str] = Field(
        default_factory=list,
        description="List of symbol names documented in this file"
    )
    generated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when documentation was generated"
    )
    llm_tool: Optional[str] = Field(
        default=None,
        description="LLM tool used to generate documentation (gemini/qwen)"
    )

    @field_validator("path", "content_hash")
    @classmethod
    def strip_and_validate_nonempty(cls, value: str) -> str:
        """Strip whitespace and validate non-empty."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("value cannot be blank")
        return cleaned


class DeepWikiFile(BaseModel):
    """A source file record in the DeepWiki index.

    Tracks indexed source files and their content hashes for incremental updates.
    """

    id: Optional[int] = Field(default=None, description="Database row ID")
    path: str = Field(..., min_length=1, description="Path to source file")
    content_hash: str = Field(..., min_length=1, description="SHA256 hash of file content")
    last_indexed: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when file was last indexed"
    )
    symbols_count: int = Field(default=0, ge=0, description="Number of symbols indexed from this file")
    docs_generated: bool = Field(default=False, description="Whether documentation has been generated")
    staleness_score: float = Field(default=0.0, ge=0.0, le=1.0, description="Staleness score (0.0=fresh, 1.0=stale)")
    last_checked_commit: Optional[str] = Field(default=None, description="Git commit hash at last freshness check")
    last_checked_at: Optional[float] = Field(default=None, description="Timestamp of last freshness check")
    staleness_factors: Optional[dict[str, Any]] = Field(default=None, description="JSON factors contributing to staleness score")

    @field_validator("path", "content_hash")
    @classmethod
    def strip_and_validate_nonempty(cls, value: str) -> str:
        """Strip whitespace and validate non-empty."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("value cannot be blank")
        return cleaned
