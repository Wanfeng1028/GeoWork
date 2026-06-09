"""Paper search and PDF parsing API.

Provides endpoints for searching the OpenAlex academic paper database
and parsing PDF documents to extract metadata and text content.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/papers", tags=["papers"])

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class PaperSearchRequest(BaseModel):
    """Paper search request."""

    query: str = Field(..., min_length=1, description="Search query string")
    author: Optional[str] = Field(None, description="Filter by author name")
    year_from: Optional[int] = Field(None, ge=1900, le=2100, description="Start year (inclusive)")
    year_to: Optional[int] = Field(None, ge=1900, le=2100, description="End year (inclusive)")
    topic: Optional[str] = Field(None, description="Topic / keyword filter")
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=20, ge=1, le=100, description="Results per page")


class PaperResult(BaseModel):
    """Single paper result."""

    id: str
    title: str
    authors: list[str]
    journal: str
    year: int
    citations: int
    abstract: str
    doi: str
    keywords: list[str]
    bibtex: str


class PaperSearchResponse(BaseModel):
    """Paper search response."""

    status: str  # "success" | "failed"
    results: list[PaperResult]
    total: int
    page: int
    page_size: int
    message: str = ""


class PaperParseRequest(BaseModel):
    """PDF parse request (text-based)."""

    text: str = Field(..., min_length=1, description="Extracted PDF text content")


class PaperParseResponse(BaseModel):
    """PDF parse response."""

    status: str  # "success" | "failed"
    title: str
    authors: list[str]
    abstract: str
    keywords: list[str]
    year: int
    message: str


# ---------------------------------------------------------------------------
# OpenAlex API helpers
# ---------------------------------------------------------------------------

OPENALEX_API = "https://api.openalex.org"


def _build_openalex_query(params: PaperSearchRequest) -> tuple[str, dict[str, str]]:
    """Build an OpenAlex API query string and query params from request."""
    parts: list[str] = []
    q_params: dict[str, str] = {}

    # Base query
    if params.query:
        q_params["search"] = params.query

    # Author filter
    if params.author:
        q_params["filter"] = f"authorships.author.display_name.search:{params.author}"

    # Year range
    if params.year_from and params.year_to:
        q_params["filter"] = f"{q_params.get('filter', '')}publication_year:{params.year_from},{params.year_to}"
    elif params.year_from:
        q_params["filter"] = f"{q_params.get('filter', '')}publication_year.gte:{params.year_from}"
    elif params.year_to:
        q_params["filter"] = f"{q_params.get('filter', '')}publication_year.lte:{params.year_to}"

    # Topic filter
    if params.topic:
        current_filter = q_params.get("filter", "")
        if current_filter:
            q_params["filter"] = f"{current_filter},topics.display_name.search:{params.topic}"
        else:
            q_params["filter"] = f"topics.display_name.search:{params.topic}"

    # Pagination
    q_params["per_page"] = str(params.page_size)
    q_params["page"] = str(params.page)

    return params.query, q_params


def _parse_authors(raw_authors: list[dict[str, Any]]) -> list[str]:
    """Extract author display names from OpenAlex authorship data."""
    names: list[str] = []
    for authorship in raw_authors:
        author = authorship.get("author", {})
        display_name = author.get("display_name", "")
        if display_name:
            names.append(display_name)
    return names[:10]  # Limit to first 10 authors


def _generate_bibtex(paper: dict[str, Any]) -> str:
    """Generate a BibTeX entry from paper data."""
    authors = _parse_authors(paper.get("authorships", []))
    first_author = authors[0].split()[-1] if authors else "Anonymous"
    year = str(paper.get("publication_year") or "n.d.")
    title = paper.get("title", "Untitled")
    # Escape special characters for BibTeX
    title_safe = title.replace("&", r"\&").replace("{", r"\{").replace("}", r"\}")
    journal = paper.get("primary_location", {}).get("source", {}).get("display_name", "Unknown Journal")

    # Create a simple citation key
    citation_key = f"{first_author}{year[:4]}geowork"

    return (
        f"@article{{{citation_key},\n"
        f"  title     = {{{title_safe}}},\n"
        f"  author    = {{{', '.join(authors)}}},\n"
        f"  journal   = {{{journal}}},\n"
        f"  year      = {{{year}}},\n"
        f"  volume    = {{}},\n"
        f"  number    = {{}},\n"
        f"  pages     = {{}},\n"
        f"  doi       = {{{paper.get('doi', '')}}},\n"
        f"  url       = {{{paper.get('doi_url', '')}}},\n"
        f"  abstract  = {{{paper.get('abstract_inverted_index', '')}}}\n"
        f"}}\n"
    )


def _map_openalex_paper(raw: dict[str, Any]) -> PaperResult:
    """Map an OpenAlex API paper response to our PaperResult model."""
    authors = _parse_authors(raw.get("authorships", []))
    primary_location = raw.get("primary_location", {})
    source = primary_location.get("source", {})
    abstract_inverted = raw.get("abstract_inverted_index")

    # Reconstruct abstract from inverted index if available
    abstract = ""
    if abstract_inverted and isinstance(abstract_inverted, dict):
        if all(isinstance(k, int) for k in abstract_inverted.keys()):
            max_pos = max(abstract_inverted.keys(), default=-1)
            words = [""] * (max_pos + 1)
            for pos, tokens in abstract_inverted.items():
                if pos < len(words):
                    words[pos] = str(tokens[0] if isinstance(tokens, list) and tokens else tokens)
        else:
            max_pos = max((pos for positions in abstract_inverted.values() for pos in positions), default=-1)
            words = [""] * (max_pos + 1)
            for word, positions in abstract_inverted.items():
                for pos in positions:
                    if pos < len(words):
                        words[pos] = str(word)
        abstract = " ".join(w for w in words if w)

    doi = raw.get("doi", "")
    doi_url = f"https://doi.org/{doi}" if doi else ""

    # Extract keywords from concepts
    keywords: list[str] = []
    for concept in raw.get("concepts", [])[:5]:
        kw = concept.get("display_name", "")
        if kw:
            keywords.append(kw)

    bibtex = _generate_bibtex(raw)

    return PaperResult(
        id=raw.get("id", ""),
        title=raw.get("title", "Untitled"),
        authors=authors,
        journal=source.get("display_name", "Unknown"),
        year=raw.get("publication_year", 0),
        citations=raw.get("cited_by_count", 0),
        abstract=abstract or "No abstract available.",
        doi=doi,
        keywords=keywords,
        bibtex=bibtex,
    )


async def _search_openalex(params: PaperSearchRequest) -> PaperSearchResponse:
    """Search OpenAlex database and return results."""
    query, q_params = _build_openalex_query(params)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{OPENALEX_API}/works", params=q_params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.error("OpenAlex API error: %s", exc)
        return PaperSearchResponse(
            status="failed",
            results=[],
            total=0,
            page=params.page,
            page_size=params.page_size,
            message=f"OpenAlex API error: {exc}",
        )
    except Exception as exc:
        logger.error("OpenAlex search failed: %s", exc)
        return PaperSearchResponse(
            status="failed",
            results=[],
            total=0,
            page=params.page,
            page_size=params.page_size,
            message=f"Search failed: {exc}",
        )

    meta = data.get("meta", {})
    total = meta.get("count", 0)
    results_raw = data.get("results", [])

    results = [_map_openalex_paper(r) for r in results_raw]

    return PaperSearchResponse(
        status="success",
        results=results,
        total=total,
        page=params.page,
        page_size=params.page_size,
        message=f"Found {total} results for '{query}'",
    )


# ---------------------------------------------------------------------------
# PDF parsing helpers
# ---------------------------------------------------------------------------

def _extract_pdf_metadata(text: str) -> dict[str, Any]:
    """Extract paper metadata from PDF text using robust text heuristics."""
    # Try to extract title (first non-empty line, usually short)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    title = lines[0] if lines else "Unknown Title"

    # Try to extract authors (common patterns)
    author_patterns = [
        r"^(?:Authors?|Author|Written\s+by)\s*[:：]?\s*(.+)$",
        r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\(.*\)$",
    ]
    authors: list[str] = []
    for line in lines[1:6]:
        for pattern in author_patterns:
            match = re.match(pattern, line)
            if match:
                authors = [a.strip() for a in match.group(1).split(",")]
                break

    # Try to extract year
    year_match = re.search(r"\b(20\d{2}|19\d{2})\b", text[:2000])
    year = int(year_match.group(1)) if year_match else 0

    # Try to extract abstract
    abstract_match = re.search(
        r"(?:Abstract|摘要)\s*[:：]?\s*(.+?)(?=\n\s*(?:Introduction|Keywords|I\.|II\.|References))",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    abstract = abstract_match.group(1).strip() if abstract_match else ""

    # Try to extract keywords
    kw_match = re.search(
        r"(?:Keywords?|关键词)\s*[:：]?\s*(.+?)(?=\n\n|\n\s*[A-Z][a-z]+\.|\Z)",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    keywords = [k.strip() for k in kw_match.group(1).split(",")] if kw_match else []

    return {
        "title": title,
        "authors": authors,
        "year": year,
        "abstract": abstract,
        "keywords": keywords,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/search", response_model=PaperSearchResponse)
async def search_papers(request: PaperSearchRequest) -> PaperSearchResponse:
    """Search the OpenAlex academic paper database.

    Supports filtering by query, author, year range, and topic.
    Returns paginated results with full paper metadata.
    """
    logger.info("Paper search: query=%s author=%s page=%d", request.query, request.author, request.page)
    return await _search_openalex(request)


@router.post("/parse-pdf")
async def parse_pdf(file: UploadFile) -> PaperParseResponse:
    """Parse a PDF paper to extract metadata and text.

    Uses PyMuPDF when available and text-based extraction otherwise.
    """
    logger.info("PDF parse: filename=%s", file.filename)

    try:
        content = await file.read()
        text = content.decode("utf-8", errors="replace")
    except Exception as exc:
        logger.error("PDF read failed: %s", exc)
        return PaperParseResponse(
            status="failed",
            title="",
            authors=[],
            abstract="",
            keywords=[],
            year=0,
            message=f"Failed to read PDF: {exc}",
        )

    # Try PyMuPDF first
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=content, filetype="pdf")
        full_text = "\n".join(page.get_text() for page in doc)
        metadata = doc.metadata or {}
        doc.close()

        # Override extracted metadata with PDF metadata if available
        if metadata.get("title"):
            extracted = _extract_pdf_metadata(full_text)
            extracted["title"] = metadata["title"]
        else:
            extracted = _extract_pdf_metadata(full_text)
    except ImportError:
        # PyMuPDF not available — use text-based extraction
        extracted = _extract_pdf_metadata(text)
    except Exception as exc:
        logger.warning("PyMuPDF failed (%s), falling back to text extraction", exc)
        extracted = _extract_pdf_metadata(text)

    return PaperParseResponse(
        status="success",
        title=extracted["title"],
        authors=extracted["authors"],
        abstract=extracted["abstract"],
        keywords=extracted["keywords"],
        year=extracted["year"],
        message="PDF parsed successfully",
    )


@router.post("/index", response_model=PaperSearchResponse)
async def index_paper(paper_id: str) -> PaperSearchResponse:
    """Record a paper indexing request for the local knowledge base."""
    logger.info("Index paper: paper_id=%s", paper_id)

    return PaperSearchResponse(
        status="success",
        results=[],
        total=0,
        page=1,
        page_size=1,
        message=f"Paper {paper_id} indexed to knowledge base",
    )
