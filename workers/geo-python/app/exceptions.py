"""Unified exception hierarchy for GeoWork Python worker.

All custom exceptions inherit from GeoWorkError so that a single
FastAPI exception handler can translate them into consistent JSON
error responses.
"""


class GeoWorkError(Exception):
    """Base exception for GeoWork worker errors."""

    def __init__(
        self,
        message: str,
        code: str = "UNKNOWN_ERROR",
        status_code: int = 500,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class ValidationError(GeoWorkError):
    """Input validation error."""

    def __init__(self, message: str):
        super().__init__(message, code="VALIDATION_ERROR", status_code=400)


class FileNotFoundError_(GeoWorkError):
    """File not found error."""

    def __init__(self, path: str):
        super().__init__(
            f"File not found: {path}",
            code="FILE_NOT_FOUND",
            status_code=404,
        )


class DependencyError(GeoWorkError):
    """Missing dependency error."""

    def __init__(self, package: str):
        super().__init__(
            f"Missing dependency: {package}",
            code="DEPENDENCY_ERROR",
            status_code=500,
        )


class SandboxError(GeoWorkError):
    """Sandbox policy violation."""

    def __init__(self, message: str):
        super().__init__(
            message,
            code="SANDBOX_ERROR",
            status_code=403,
        )
