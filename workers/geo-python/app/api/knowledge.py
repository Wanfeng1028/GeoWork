"""Knowledge base indexing API for the Python Geo Worker."""

from __future__ import annotations

import logging
import re
import textwrap
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class KnowledgeIndexer:
    """Lightweight in-process knowledge indexer for the Python worker."""

    def __init__(self) -> None:
        self._entries: Dict[str, Dict[str, Any]] = {}

    def index(
        self,
        title: str,
        content: str,
        source: str = "manual",
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Index a piece of knowledge content.

        Returns a dict with the indexed entry metadata.
        """
        entry_id = f"idx_{len(self._entries) + 1}"
        entry: Dict[str, Any] = {
            "id": entry_id,
            "title": title,
            "content": content,
            "source": source,
            "category": category or "",
            "tags": tags or [],
            "word_count": len(re.findall(r"\w+", content)),
            "indexed_at": "now",
        }
        self._entries[entry_id] = entry
        logger.info("Indexed knowledge entry: %s (%d words)", title, entry["word_count"])
        return entry

    def search(self, query: str) -> List[Dict[str, Any]]:
        """Simple keyword search across indexed entries."""
        query_lower = query.lower()
        results: List[Dict[str, Any]] = []
        for entry in self._entries.values():
            if query_lower in entry["title"].lower() or query_lower in entry["content"].lower():
                results.append(entry)
        return results

    def get(self, entry_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a single entry by ID."""
        return self._entries.get(entry_id)


# Module-level indexer instance
_indexer = KnowledgeIndexer()


def _extract_text_from_pdf(file_path: str) -> str:
    """Attempt to extract text from a PDF file.

    Returns file metadata text when no PDF parser is available.
    """
    try:
        import PyPDF2  # type: ignore

        text_parts: List[str] = []
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n".join(text_parts)
    except ImportError:
        logger.warning("PyPDF2 not installed; returning file metadata only")
        return f"[PDF file: {file_path}]"
    except Exception as exc:
        logger.error("Failed to extract PDF text: %s", exc)
        return f"[PDF extraction error: {exc}]"


def _extract_text_from_txt(file_path: str) -> str:
    """Read a plain-text file and return its content."""
    try:
        return Path(file_path).read_text(encoding="utf-8")
    except Exception as exc:
        logger.error("Failed to read text file: %s", exc)
        return f"[Text extraction error: {exc}]"


def _extract_text_from_file(file_path: str) -> str:
    """Dispatch text extraction based on file extension."""
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return _extract_text_from_pdf(file_path)
    if ext in (".txt", ".md", ".csv", ".json", ".xml", ".html"):
        return _extract_text_from_txt(file_path)
    return f"[Unsupported file type: {ext}]"


@router.post("/index")
async def index_knowledge(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Index paper/file content into the knowledge base.

    Accepts a JSON body with:
    - title (str, required): Entry title
    - content (str, required): Entry content
    - source (str, optional): "paper_id", "pdf", or "manual"
    - category (str, optional): Category ID
    - tags (list[str], optional): Tags

    Returns the indexed entry metadata.
    """
    title = payload.get("title")
    content = payload.get("content")
    if not title or not content:
        raise HTTPException(status_code=400, detail="title and content are required")

    source = payload.get("source", "manual")
    category = payload.get("category")
    tags = payload.get("tags", [])

    entry = _indexer.index(
        title=title,
        content=content,
        source=source,
        category=category,
        tags=tags,
    )
    return {"status": "indexed", "entry": entry}


@router.post("/import")
async def import_knowledge_file(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Import a file into the knowledge base.

    Accepts a JSON body with:
    - filePath (str, required): Path to the file
    - title (str, required): Entry title
    - source (str, optional): "pdf" or "manual"
    - category (str, optional): Category ID
    - tags (list[str], optional): Tags

    Returns the indexed entry metadata.
    """
    file_path = payload.get("filePath")
    title = payload.get("title")
    if not file_path or not title:
        raise HTTPException(status_code=400, detail="filePath and title are required")

    source = payload.get("source", "pdf")
    category = payload.get("category")
    tags = payload.get("tags", [])

    # Extract text from file
    content = _extract_text_from_file(file_path)

    entry = _indexer.index(
        title=title,
        content=content,
        source=source,
        category=category,
        tags=tags,
    )
    return {"status": "imported", "entry": entry}


@router.get("/search")
async def search_knowledge(q: str) -> Dict[str, Any]:
    """Search knowledge entries by keyword.

    Query parameter:
    - q (str): Search query
    """
    results = _indexer.search(q)
    return {"query": q, "count": len(results), "results": results}


@router.get("/{entry_id}")
async def get_knowledge_entry(entry_id: str) -> Dict[str, Any]:
    """Retrieve a single knowledge entry by ID."""
    entry = _indexer.get(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Entry {entry_id} not found")
    return {"entry": entry}


@router.get("/")
async def list_knowledge() -> Dict[str, Any]:
    """List all indexed knowledge entries."""
    entries = list(_indexer._entries.values())
    return {"count": len(entries), "entries": entries}
