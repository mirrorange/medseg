import pytest
from httpx import AsyncClient


@pytest.fixture
async def registered_user(client: AsyncClient) -> dict:
    resp = await client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpass123",
        },
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
async def auth_token(client: AsyncClient, registered_user: dict) -> str:
    resp = await client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "testpass123"},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture
async def auth_headers(auth_token: str) -> dict:
    return {"Authorization": f"Bearer {auth_token}"}


# --- Registration ---


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    resp = await client.post(
        "/api/auth/register",
        json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "pass123",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "newuser"
    assert data["email"] == "new@example.com"
    assert data["role"] == "user"
    assert data["is_active"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient, registered_user):
    resp = await client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "other@example.com",
            "password": "pass123",
        },
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == 401001


# --- Login ---


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, registered_user):
    resp = await client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "testpass123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, registered_user):
    resp = await client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "wrongpass"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"]["code"] == 400001


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    resp = await client.post(
        "/api/auth/login",
        json={"username": "noone", "password": "pass"},
    )
    assert resp.status_code == 401


# --- Protected endpoints ---


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, auth_headers):
    resp = await client.get("/api/users/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "testuser"


@pytest.mark.asyncio
async def test_get_me_no_token(client: AsyncClient):
    resp = await client.get("/api/users/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_me(client: AsyncClient, auth_headers):
    resp = await client.put(
        "/api/users/me",
        headers=auth_headers,
        json={"username": "updateduser"},
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == "updateduser"


# --- Admin endpoints ---


@pytest.mark.asyncio
async def test_list_users_non_admin(client: AsyncClient, auth_headers):
    resp = await client.get("/api/users", headers=auth_headers)
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == 400003
