from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
import os
from threading import Lock
import time
from unittest.mock import Mock

import psycopg
import pytest
from fastapi.testclient import TestClient

from src import app as application
from src import nearby_store


def test_search_uses_supplied_transaction_and_keeps_filter_parameters():
    connection = Mock()
    connection.execute.return_value.fetchall.return_value = [{'id': 'sample'}]
    factory = Mock()

    @contextmanager
    def transaction():
        factory()
        yield connection

    rows = nearby_store.find_nearby(41, 29, 1500, True, False, True, False,
                                   connection_factory=transaction)
    assert rows == [{'id': 'sample'}]
    factory.assert_called_once_with()
    assert connection.execute.call_args.args[1] == (41, 29, 1500, True, False, True, False)


def test_app_owns_and_closes_search_pool(monkeypatch):
    pool = Mock()
    pool.connection.return_value.__enter__ = Mock()
    pool.connection.return_value.__exit__ = Mock()
    make_pool = Mock(return_value=pool)
    monkeypatch.setattr(application, 'create_nearby_pool', make_pool, raising=False)
    search = Mock(return_value=[])
    monkeypatch.setattr(application, 'find_nearby', search)
    with TestClient(application.create_app()) as client:
        assert client.get('/api/v1/toilets/nearby?lat=41&lon=29').json() == {'count': 0, 'results': []}
        make_pool.assert_called_once_with()
        assert search.call_args.kwargs['connection_factory'] == pool.connection
        pool.close.assert_not_called()
    pool.close.assert_called_once_with()


def test_injected_search_does_not_start_database_pool(monkeypatch):
    make_pool = Mock()
    monkeypatch.setattr(application, 'create_nearby_pool', make_pool, raising=False)
    with TestClient(application.create_app(nearby_search=lambda **kwargs: [])) as client:
        assert client.get('/api/v1/toilets/nearby?lat=41&lon=29').status_code == 200
    make_pool.assert_not_called()


def test_pool_exhaustion_returns_sanitized_503(monkeypatch):
    pool = Mock()
    pool.connection.side_effect = psycopg.OperationalError('private connection detail')
    monkeypatch.setattr(application, 'create_nearby_pool', Mock(return_value=pool), raising=False)
    with TestClient(application.create_app()) as client:
        response = client.get('/api/v1/toilets/nearby?lat=41&lon=29')
    assert response.status_code == 503
    assert response.json() == {'detail': 'Database temporarily unavailable'}
    pool.close.assert_called_once_with()


def test_repository_app_does_not_start_database_pool(monkeypatch):
    make_pool = Mock()
    monkeypatch.setattr(application, 'create_nearby_pool', make_pool, raising=False)
    with TestClient(application.create_app(state={})):
        pass
    make_pool.assert_not_called()


def test_parallel_nearby_reads_do_not_occupy_workers_waiting_for_pool_slots(monkeypatch):
    pool = Mock()
    monkeypatch.setattr(application, 'create_nearby_pool', Mock(return_value=pool), raising=False)
    active = 0
    maximum = 0
    lock = Lock()

    def search(**kwargs):
        nonlocal active, maximum
        with lock:
            active += 1
            maximum = max(maximum, active)
        try:
            time.sleep(.05)
            return []
        finally:
            with lock:
                active -= 1

    monkeypatch.setattr(application, 'find_nearby', search)
    with TestClient(application.create_app()) as client:
        with ThreadPoolExecutor(max_workers=12) as requests:
            responses=list(requests.map(lambda _: client.get('/api/v1/toilets/nearby?lat=41&lon=29'), range(24)))
    assert all(response.status_code == 200 for response in responses)
    assert maximum <= 4
    assert active == 0
    pool.close.assert_called_once_with()


@pytest.mark.skipif(os.getenv('SMARTLOO_TEST_POSTGIS') != '1', reason='Requires private local PostGIS')
def test_real_pool_reuses_connection_and_rolls_back_failed_transaction():
    pool = nearby_store.create_nearby_pool()
    try:
        with pool.connection() as conn:
            assert conn.autocommit is True
            first_pid = conn.execute('SELECT pg_backend_pid() AS pid').fetchone()['pid']
        with pytest.raises(psycopg.errors.DivisionByZero):
            with pool.connection() as conn:
                with conn.transaction():
                    conn.execute('SELECT 1 / 0')
        with pool.connection() as conn:
            assert conn.execute('SELECT pg_backend_pid() AS pid').fetchone()['pid'] == first_pid
            assert conn.execute('SELECT 42 AS answer').fetchone()['answer'] == 42
        assert pool.get_stats()['connections_num'] == 1
    finally:
        pool.close()
