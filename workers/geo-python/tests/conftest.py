"""Shared worker API test fixtures."""

from __future__ import annotations

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


def pytest_pyfunc_call(pyfuncitem):
    if "asyncio" not in pyfuncitem.keywords:
        return None
    test_func = pyfuncitem.obj
    if not inspect.iscoroutinefunction(test_func):
        return None
    kwargs = {name: pyfuncitem.funcargs[name] for name in pyfuncitem._fixtureinfo.argnames}
    asyncio.run(test_func(**kwargs))
    return True
