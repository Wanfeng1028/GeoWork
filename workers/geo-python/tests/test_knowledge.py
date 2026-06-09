"""Tests for the knowledge base indexing API."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(app):
    """Return a TestClient for the FastAPI app."""
    return TestClient(app)


class TestKnowledgeIndex:
    """Tests for the /knowledge/index endpoint."""

    def test_index_basic(self, client, app):
        """Test basic knowledge indexing."""
        payload = {
            "title": "Test NDVI Paper",
            "content": "This paper discusses NDVI analysis methods.",
            "source": "paper_id",
            "tags": ["NDVI", "remote-sensing"],
        }
        response = client.post("/api/knowledge/index", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "indexed"
        assert "entry" in data
        assert data["entry"]["title"] == "Test NDVI Paper"
        assert data["entry"]["source"] == "paper_id"

    def test_index_missing_title(self, client):
        """Test that indexing without title returns 400."""
        payload = {"content": "Some content"}
        response = client.post("/api/knowledge/index", json=payload)
        assert response.status_code == 400

    def test_index_missing_content(self, client):
        """Test that indexing without content returns 400."""
        payload = {"title": "Some title"}
        response = client.post("/api/knowledge/index", json=payload)
        assert response.status_code == 400

    def test_index_with_category(self, client, app):
        """Test indexing with a category."""
        payload = {
            "title": "Categorized Entry",
            "content": "Content with category.",
            "category": "cat_001",
        }
        response = client.post("/api/knowledge/index", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["entry"]["category"] == "cat_001"


class TestKnowledgeSearch:
    """Tests for the /knowledge/search endpoint."""

    def test_search_found(self, client, app):
        """Test search returns matching entries."""
        # First index an entry
        client.post("/api/knowledge/index", json={
            "title": "NDVI Analysis Methods",
            "content": "This paper covers NDVI analysis.",
        })
        response = client.get("/api/knowledge/search?q=NDVI")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 1
        assert len(data["results"]) >= 1

    def test_search_not_found(self, client, app):
        """Test search with no matches returns empty results."""
        response = client.get("/api/knowledge/search?q=zzzznonexistent")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
        assert data["results"] == []


class TestKnowledgeEntry:
    """Tests for individual entry retrieval."""

    def test_get_entry(self, client, app):
        """Test retrieving a specific entry by ID."""
        # Index an entry first
        index_resp = client.post("/api/knowledge/index", json={
            "title": "Test Entry",
            "content": "Test content.",
        })
        entry_id = index_resp.json()["entry"]["id"]

        response = client.get(f"/api/knowledge/{entry_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["entry"]["title"] == "Test Entry"

    def test_get_entry_not_found(self, client):
        """Test retrieving a non-existent entry returns 404."""
        response = client.get("/api/knowledge/nonexistent_id")
        assert response.status_code == 404


class TestKnowledgeList:
    """Tests for listing all knowledge entries."""

    def test_list_empty(self, client, app):
        """Test listing when no entries exist."""
        response = client.get("/api/knowledge/")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0

    def test_list_after_index(self, client, app):
        """Test listing returns entries after indexing."""
        client.post("/api/knowledge/index", json={
            "title": "Entry 1",
            "content": "Content 1.",
        })
        client.post("/api/knowledge/index", json={
            "title": "Entry 2",
            "content": "Content 2.",
        })
        response = client.get("/api/knowledge/")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 2


class TestKnowledgeImport:
    """Tests for the /knowledge/import endpoint."""

    def test_import_text_file(self, client, app, tmp_path):
        """Test importing a text file."""
        test_file = tmp_path / "test.txt"
        test_file.write_text("This is test content from a text file.")

        payload = {
            "filePath": str(test_file),
            "title": "Imported Text File",
            "source": "manual",
        }
        response = client.post("/api/knowledge/import", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "imported"
        assert "entry" in data

    def test_import_missing_fields(self, client):
        """Test that import without required fields returns 400."""
        payload = {"filePath": "/some/path.txt"}
        response = client.post("/api/knowledge/import", json=payload)
        assert response.status_code == 400

    def test_import_unsupported_type(self, client, app, tmp_path):
        """Test importing an unsupported file type."""
        test_file = tmp_path / "test.xyz"
        test_file.write_text("Some content")

        payload = {
            "filePath": str(test_file),
            "title": "Unsupported Import",
        }
        response = client.post("/api/knowledge/import", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "imported"
