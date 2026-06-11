import mongomock
import pytest
from fastapi.testclient import TestClient

from app import database
from app.main import app
from app.seed import seed_demo_data


@pytest.fixture(scope="module")
def client():
    mock_client = mongomock.MongoClient()
    original_connect = database.connect
    original_get_database = database.get_database
    original_client = database._client

    def _mock_connect():
        return mock_client

    def _mock_get_database(client=None, db_name=None):
        return mock_client["taskpulse_test"]

    database.connect = _mock_connect
    database.get_database = _mock_get_database
    database._client = mock_client
    database.create_indexes(_mock_get_database())
    seed_demo_data(_mock_get_database())

    with TestClient(app) as test_client:
        yield test_client

    database.connect = original_connect
    database.get_database = original_get_database
    database._client = original_client
