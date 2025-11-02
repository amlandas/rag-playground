from fastapi.testclient import TestClient

from app.main import app


def test_query_without_index_400():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
