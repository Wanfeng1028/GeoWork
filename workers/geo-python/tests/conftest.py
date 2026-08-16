"""Shared worker API test fixtures."""

from __future__ import annotations

import os

# doc/22 BP4: the worker now enforces fail-closed runtime token auth.
# Legacy business-logic tests call endpoints without a token; run the
# whole session in the explicit dev-insecure mode instead of sprinkling
# headers into 58 tests. tests/test_auth.py manages its own env per
# request via mock.patch.dict and overrides this default as needed.
os.environ.setdefault("GEOWORK_INSECURE_NO_AUTH", "1")

import asyncio
import inspect

import pytest


@pytest.fixture
def app():
    from app.api.knowledge import _indexer
    from app.main import app as fastapi_app

    _indexer._entries.clear()
    return fastapi_app


def pytest_configure(config):
    config.addinivalue_line("markers", "asyncio: run async test functions")
    config.addinivalue_line(
        "markers",
        "integration: requires system GIS stack (rasterio/geopandas) or network; excluded from the default CI run",
    )


def pytest_pyfunc_call(pyfuncitem):
    if "asyncio" not in pyfuncitem.keywords:
        return None
    test_func = pyfuncitem.obj
    if not inspect.iscoroutinefunction(test_func):
        return None
    kwargs = {name: pyfuncitem.funcargs[name] for name in pyfuncitem._fixtureinfo.argnames}
    asyncio.run(test_func(**kwargs))
    return True
