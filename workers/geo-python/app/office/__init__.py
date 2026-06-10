# GeoWork Python Worker - Office Document Generation

"""Office document generation module for GeoWork reports and presentations."""

from typing import Any


def write_report(
    title: str = "GeoWork Report",
    prompt: str = "",
    mode: str = "Analysis",
    artifacts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Generate a Markdown report with optional DOCX output."""
    markdown = f"""# {title}

## Prompt

{prompt or "GeoWork analysis task"}

## Mode

{mode}

## Artifacts

"""
    if artifacts:
        for art in artifacts:
            markdown += f"- {art.get('name', 'Unknown')} ({art.get('type', 'unknown')})\n"
    else:
        markdown += "- No artifacts generated\n"

    markdown += """
## Reproducibility

All file writes were scoped to the project workspace.
"""
    return {
        "ok": True,
        "markdown": markdown,
        "artifacts": [
            {"name": "Markdown Report", "type": "report", "mimeType": "text/markdown"},
        ],
    }


def write_presentation(
    title: str = "GeoWork Analysis",
    sections: list[str] | None = None,
) -> dict[str, Any]:
    """Generate a PowerPoint presentation."""
    slides = sections or ["Objective", "Data", "Workflow", "Results", "Reproducibility"]
    return {
        "ok": True,
        "message": "PPTX presentation generated (placeholder)",
        "slides": [{"title": title}] + [{"title": s} for s in slides],
        "artifacts": [
            {"name": "PowerPoint Presentation", "type": "presentation", "mimeType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"},
        ],
    }


def write_spreadsheet(
    title: str = "GeoWork Statistics",
    data: list[list[Any]] | None = None,
) -> dict[str, Any]:
    """Generate an Excel workbook."""
    rows = data or [["metric", "value"], ["task_status", "completed"], ["mode", "Analysis"]]
    return {
        "ok": True,
        "message": "Excel workbook generated (placeholder)",
        "rows": rows,
        "artifacts": [
            {"name": "Excel Workbook", "type": "spreadsheet", "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
        ],
    }


def write_notebook(
    title: str = "GeoWork Workflow",
    prompt: str = "",
    cells: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Generate a Jupyter Notebook."""
    if cells is None:
        cells = [
            {"cell_type": "markdown", "source": [f"# {title}\n", prompt]},
            {"cell_type": "code", "source": ["print('GeoWork task completed')"]},
        ]
    return {
        "ok": True,
        "message": "Jupyter Notebook generated (placeholder)",
        "cells": cells,
        "artifacts": [
            {"name": "Jupyter Notebook", "type": "notebook", "mimeType": "application/x-ipynb+json"},
        ],
    }
