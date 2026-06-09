"""Tests for paper search and PDF parsing API."""

import pytest
from pydantic import ValidationError

from app.api.papers import (
    PaperParseRequest,
    PaperParseResponse,
    PaperResult,
    PaperSearchRequest,
    PaperSearchResponse,
    _extract_pdf_metadata,
    _generate_bibtex,
    _map_openalex_paper,
    _parse_authors,
)


class TestPaperSearchRequest:
    """Test PaperSearchRequest model validation."""

    def test_valid_request(self):
        req = PaperSearchRequest(query="NDVI remote sensing")
        assert req.query == "NDVI remote sensing"
        assert req.page == 1
        assert req.page_size == 20
        assert req.author is None
        assert req.year_from is None
        assert req.year_to is None
        assert req.topic is None

    def test_full_request(self):
        req = PaperSearchRequest(
            query="Sentinel-2",
            author="Zhang Wei",
            year_from=2020,
            year_to=2024,
            topic="vegetation",
            page=2,
            page_size=10,
        )
        assert req.query == "Sentinel-2"
        assert req.author == "Zhang Wei"
        assert req.year_from == 2020
        assert req.year_to == 2024
        assert req.topic == "vegetation"
        assert req.page == 2
        assert req.page_size == 10

    def test_empty_query_rejected(self):
        with pytest.raises(ValidationError):
            PaperSearchRequest(query="")

    def test_page_size_limits(self):
        with pytest.raises(ValidationError):
            PaperSearchRequest(query="test", page_size=0)

        with pytest.raises(ValidationError):
            PaperSearchRequest(query="test", page_size=101)

    def test_year_range_validation(self):
        with pytest.raises(ValidationError):
            PaperSearchRequest(query="test", year_from=1800)

        with pytest.raises(ValidationError):
            PaperSearchRequest(query="test", year_to=2200)


class TestPaperResult:
    """Test PaperResult model."""

    def test_valid_paper(self):
        paper = PaperResult(
            id="https://openalex.org/W1234567890",
            title="NDVI Analysis of Vegetation Using Sentinel-2",
            authors=["Zhang Wei", "Li Ming"],
            journal="Remote Sensing of Environment",
            year=2023,
            citations=42,
            abstract="This paper presents a novel NDVI analysis method...",
            doi="10.1016/j.rse.2023.123456",
            keywords=["NDVI", "Sentinel-2", "vegetation"],
            bibtex="@article{zhang2023ndvi, ...}",
        )
        assert paper.id.startswith("https://openalex.org/")
        assert len(paper.authors) == 2
        assert paper.citations == 42
        assert len(paper.keywords) == 3

    def test_minimal_paper(self):
        paper = PaperResult(
            id="test-id",
            title="Test Paper",
            authors=[],
            journal="Unknown",
            year=2024,
            citations=0,
            abstract="",
            doi="",
            keywords=[],
            bibtex="",
        )
        assert paper.title == "Test Paper"
        assert paper.citations == 0


class TestPaperSearchResponse:
    """Test PaperSearchResponse model."""

    def test_success_response(self):
        papers = [
            PaperResult(
                id="1",
                title="Paper One",
                authors=["Author A"],
                journal="Journal A",
                year=2023,
                citations=10,
                abstract="Abstract one",
                doi="10.1000/1",
                keywords=["kw1"],
                bibtex="@article{a2023, ...}",
            )
        ]
        resp = PaperSearchResponse(
            status="success",
            results=papers,
            total=1,
            page=1,
            page_size=20,
            message="Found 1 results",
        )
        assert resp.status == "success"
        assert len(resp.results) == 1
        assert resp.total == 1

    def test_failed_response(self):
        resp = PaperSearchResponse(
            status="failed",
            results=[],
            total=0,
            page=1,
            page_size=20,
            message="API error",
        )
        assert resp.status == "failed"
        assert resp.results == []


class TestPaperParseResponse:
    """Test PaperParseResponse model."""

    def test_success_parse(self):
        resp = PaperParseResponse(
            status="success",
            title="Test Paper",
            authors=["Author A"],
            abstract="Test abstract",
            keywords=["kw1", "kw2"],
            year=2024,
            message="Parsed successfully",
        )
        assert resp.status == "success"
        assert resp.title == "Test Paper"

    def test_failed_parse(self):
        resp = PaperParseResponse(
            status="failed",
            title="",
            authors=[],
            abstract="",
            keywords=[],
            year=0,
            message="Parse failed",
        )
        assert resp.status == "failed"


class TestAuthorParsing:
    """Test author name extraction from OpenAlex data."""

    def test_parse_single_author(self):
        raw = [
            {"author": {"display_name": "Zhang Wei"}}
        ]
        authors = _parse_authors(raw)
        assert authors == ["Zhang Wei"]

    def test_parse_multiple_authors(self):
        raw = [
            {"author": {"display_name": "Zhang Wei"}},
            {"author": {"display_name": "Li Ming"}},
            {"author": {"display_name": "Wang Fang"}},
        ]
        authors = _parse_authors(raw)
        assert len(authors) == 3
        assert "Zhang Wei" in authors
        assert "Li Ming" in authors

    def test_parse_empty_authors(self):
        raw = []
        authors = _parse_authors(raw)
        assert authors == []

    def test_parse_missing_display_name(self):
        raw = [
            {"author": {}},
            {"author": {"display_name": "Valid Author"}},
        ]
        authors = _parse_authors(raw)
        assert authors == ["Valid Author"]

    def test_limit_to_ten_authors(self):
        raw = [{"author": {"display_name": f"Author {i}"}} for i in range(15)]
        authors = _parse_authors(raw)
        assert len(authors) == 10


class TestBibtexGeneration:
    """Test BibTeX entry generation."""

    def test_basic_bibtex(self):
        raw = {
            "title": "NDVI Analysis",
            "publication_year": 2023,
            "authorships": [{"author": {"display_name": "Zhang Wei"}}],
            "primary_location": {"source": {"display_name": "Remote Sensing Journal"}},
            "doi": "10.1000/test",
            "doi_url": "https://doi.org/10.1000/test",
        }
        bibtex = _generate_bibtex(raw)
        assert "@article" in bibtex
        assert "Zhang" in bibtex
        assert "2023" in bibtex
        assert "NDVI Analysis" in bibtex

    def test_bibtex_special_chars(self):
        raw = {
            "title": "NDVI & Vegetation {Analysis}",
            "publication_year": 2023,
            "authorships": [{"author": {"display_name": "Zhang Wei"}}],
            "primary_location": {"source": {"display_name": "Journal"}},
            "doi": "",
            "doi_url": "",
        }
        bibtex = _generate_bibtex(raw)
        assert r"\&" in bibtex
        assert r"\{" in bibtex

    def test_bibtex_empty_authors(self):
        raw = {
            "title": "Untitled Paper",
            "publication_year": 2024,
            "authorships": [],
            "primary_location": {"source": {"display_name": "Unknown"}},
            "doi": "",
            "doi_url": "",
        }
        bibtex = _generate_bibtex(raw)
        assert "Anonymous" in bibtex


class TestOpenAlexPaperMapping:
    """Test mapping OpenAlex API response to PaperResult."""

    def test_map_basic_paper(self):
        raw = {
            "id": "https://openalex.org/W1234567890",
            "title": "Test Paper Title",
            "publication_year": 2023,
            "cited_by_count": 15,
            "doi": "10.1000/test",
            "authorships": [{"author": {"display_name": "Test Author"}}],
            "primary_location": {"source": {"display_name": "Test Journal"}},
            "concepts": [{"display_name": "Remote Sensing"}, {"display_name": "NDVI"}],
        }
        paper = _map_openalex_paper(raw)
        assert paper.id == "https://openalex.org/W1234567890"
        assert paper.title == "Test Paper Title"
        assert paper.year == 2023
        assert paper.citations == 15
        assert paper.journal == "Test Journal"
        assert "Remote Sensing" in paper.keywords
        assert "NDVI" in paper.keywords

    def test_map_paper_with_abstract(self):
        raw = {
            "id": "https://openalex.org/W9999999999",
            "title": "Paper With Abstract",
            "publication_year": 2022,
            "cited_by_count": 0,
            "doi": "",
            "authorships": [],
            "primary_location": {"source": {"display_name": "Journal X"}},
            "abstract_inverted_index": {0: ["This"], 1: ["is"], 2: ["an"], 3: ["abstract"]},
            "concepts": [],
        }
        paper = _map_openalex_paper(raw)
        assert "This is an abstract" in paper.abstract

    def test_map_paper_no_abstract(self):
        raw = {
            "id": "https://openalex.org/W0000000000",
            "title": "Paper Without Abstract",
            "publication_year": 2021,
            "cited_by_count": 5,
            "doi": "",
            "authorships": [],
            "primary_location": {"source": {"display_name": "Journal Y"}},
            "concepts": [],
        }
        paper = _map_openalex_paper(raw)
        assert paper.abstract == "No abstract available."


class TestPdfMetadataExtraction:
    """Test PDF metadata extraction heuristics."""

    def test_extract_title(self):
        text = "Sentinel-2 NDVI Analysis\n\nAuthors: Zhang Wei\n\nAbstract: This paper..."
        result = _extract_pdf_metadata(text)
        assert result["title"] == "Sentinel-2 NDVI Analysis"

    def test_extract_year(self):
        text = "2023 NDVI Study\n\nAbstract: Remote sensing analysis..."
        result = _extract_pdf_metadata(text)
        assert result["year"] == 2023

    def test_extract_abstract(self):
        text = (
            "Test Paper Title\n\nAbstract: This is a test abstract for paper parsing.\n\n"
            "Introduction: The background of this study..."
        )
        result = _extract_pdf_metadata(text)
        assert "test abstract" in result["abstract"].lower()

    def test_extract_keywords(self):
        text = (
            "Test Paper\n\nAbstract: Some abstract text.\n\nKeywords: NDVI, remote sensing, vegetation\n\n"
            "Introduction: ..."
        )
        result = _extract_pdf_metadata(text)
        assert "NDVI" in result["keywords"]
        assert "remote sensing" in result["keywords"]

    def test_extract_empty_text(self):
        result = _extract_pdf_metadata("")
        assert result["title"] == "Unknown Title"
        assert result["authors"] == []
        assert result["year"] == 0


class TestPaperParseRequest:
    """Test PaperParseRequest model."""

    def test_valid_parse_request(self):
        req = PaperParseRequest(text="Test PDF content")
        assert req.text == "Test PDF content"

    def test_empty_text_rejected(self):
        with pytest.raises(ValidationError):
            PaperParseRequest(text="")
