"""Input validation utilities for GeoWork Python worker.

Provides path safety checks, bounding box validation, CRS format verification,
and file existence checks to prevent injection attacks and invalid inputs.
"""

import os
import re
from pathlib import Path


class ValidationError(ValueError):
    """Raised when input validation fails."""

    pass


def validate_path(path: str, workspace: str | None = None) -> str:
    """Validate that a file path is safe and optionally within a workspace.

    Checks for path traversal attempts (..) and ensures the resolved path
    is within the specified workspace directory if provided.

    Args:
        path: The path string to validate.
        workspace: Optional workspace root directory. If provided, the path
            must resolve to a location within this directory.

    Returns:
        The validated and resolved absolute path as a string.

    Raises:
        ValidationError: If the path contains traversal sequences or escapes
            the workspace boundary.
    """
    if not path or not path.strip():
        raise ValidationError("path is required")

    # Check for obvious traversal patterns before resolving
    if ".." in path.split(os.sep) or ".." in path.split("/"):
        raise ValidationError("path traversal (..) is not allowed")

    resolved = Path(path).expanduser().resolve()

    # If workspace is provided, ensure path is within it
    if workspace:
        workspace_resolved = Path(workspace).expanduser().resolve()
        try:
            resolved.relative_to(workspace_resolved)
        except ValueError:
            raise ValidationError(
                f"path must be within workspace: {workspace_resolved}"
            )

    return str(resolved)


def validate_bbox(bbox: list) -> tuple[float, float, float, float]:
    """Validate a bounding box [minX, minY, maxX, maxY].

    Ensures the bbox has exactly 4 numeric values within valid geographic
    coordinate ranges: longitude -180 to 180, latitude -90 to 90.

    Args:
        bbox: A list of 4 numbers [minX, minY, maxX, maxY].

    Returns:
        A tuple of 4 floats (minX, minY, maxX, maxY).

    Raises:
        ValidationError: If the bbox format is invalid or values are out of range.
    """
    if not isinstance(bbox, list) or len(bbox) != 4:
        raise ValidationError(
            "bbox must be a list of 4 numbers: [minX, minY, maxX, maxY]"
        )

    try:
        min_x, min_y, max_x, max_y = (float(v) for v in bbox)
    except (TypeError, ValueError):
        raise ValidationError("bbox values must be numeric")

    # Validate longitude range (-180 to 180)
    if not (-180 <= min_x <= 180 and -180 <= max_x <= 180):
        raise ValidationError("longitude values must be between -180 and 180")

    # Validate latitude range (-90 to 90)
    if not (-90 <= min_y <= 90 and -90 <= max_y <= 90):
        raise ValidationError("latitude values must be between -90 and 90")

    # Validate min < max
    if min_x > max_x:
        raise ValidationError("minX must be less than or equal to maxX")
    if min_y > max_y:
        raise ValidationError("minY must be less than or equal to maxY")

    return (min_x, min_y, max_x, max_y)


def validate_crs(crs: str) -> str:
    """Validate a Coordinate Reference System string format.

    Accepts formats like "EPSG:4326" or "EPSG:3857".

    Args:
        crs: The CRS string to validate.

    Returns:
        The validated CRS string in uppercase.

    Raises:
        ValidationError: If the CRS format is invalid.
    """
    if not crs or not crs.strip():
        raise ValidationError("CRS is required")

    crs = crs.strip().upper()

    # Match EPSG:XXXX format (4-5 digit code)
    if not re.match(r"^EPSG:\d{4,5}$", crs):
        raise ValidationError(
            "CRS must be in EPSG:XXXX format (e.g., EPSG:4326, EPSG:3857)"
        )

    return crs


def validate_file_exists(path: str) -> bool:
    """Check if a file exists at the given path.

    Args:
        path: The file path to check.

    Returns:
        True if the file exists.

    Raises:
        ValidationError: If the path is empty or the file does not exist.
    """
    if not path or not path.strip():
        raise ValidationError("file path is required")

    file_path = Path(path).expanduser().resolve()
    if not file_path.exists():
        raise ValidationError(f"file not found: {file_path}")
    if not file_path.is_file():
        raise ValidationError(f"path is not a file: {file_path}")

    return True
