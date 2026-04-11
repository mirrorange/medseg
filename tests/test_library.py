import uuid

import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post(
        "/api/auth/register",
        json={
            "username": "libuser",
            "email": "lib@example.com",
            "password": "pass123",
        },
    )
    resp = await client.post(
        "/api/auth/login",
        json={"username": "libuser", "password": "pass123"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def second_auth_headers(client: AsyncClient) -> dict:
    await client.post(
        "/api/auth/register",
        json={
            "username": "libuser2",
            "email": "lib2@example.com",
            "password": "pass123",
        },
    )
    resp = await client.post(
        "/api/auth/login",
        json={"username": "libuser2", "password": "pass123"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# --------------- Folder CRUD ---------------


@pytest.mark.asyncio
async def test_create_folder(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "My Folder"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Folder"
    assert data["parent_id"] is None


@pytest.mark.asyncio
async def test_create_nested_folder(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "Parent"},
    )
    parent_id = resp.json()["id"]

    resp = await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "Child", "parent_id": parent_id},
    )
    assert resp.status_code == 201
    assert resp.json()["parent_id"] == parent_id


@pytest.mark.asyncio
async def test_rename_folder(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "Old Name"},
    )
    folder_id = resp.json()["id"]

    resp = await client.put(
        f"/api/library/folders/{folder_id}",
        headers=auth_headers,
        json={"name": "New Name"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_delete_empty_folder(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "ToDelete"},
    )
    folder_id = resp.json()["id"]

    resp = await client.delete(
        f"/api/library/folders/{folder_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_non_empty_folder_fails(client: AsyncClient, auth_headers):
    # Create parent with child
    resp = await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "Parent"},
    )
    parent_id = resp.json()["id"]

    await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "Child", "parent_id": parent_id},
    )

    resp = await client.delete(
        f"/api/library/folders/{parent_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_folder_recursive(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "Parent"},
    )
    parent_id = resp.json()["id"]

    await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "Child", "parent_id": parent_id},
    )

    resp = await client.delete(
        f"/api/library/folders/{parent_id}",
        headers=auth_headers,
        params={"recursive": "true"},
    )
    assert resp.status_code == 204


# --------------- Library tree ---------------


@pytest.mark.asyncio
async def test_library_tree(client: AsyncClient, auth_headers):
    # Create a folder and a root-level sample set
    await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "Folder A"},
    )
    await client.post(
        "/api/sample-sets",
        headers=auth_headers,
        json={"name": "Root Study"},
    )

    resp = await client.get("/api/library/tree", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "folders" in data
    assert "root_sample_sets" in data
    assert len(data["folders"]) >= 1
    assert len(data["root_sample_sets"]) >= 1


# --------------- Sharing ---------------


@pytest.mark.asyncio
async def test_share_and_list(client: AsyncClient, auth_headers):
    # Create a sample set
    resp = await client.post(
        "/api/sample-sets",
        headers=auth_headers,
        json={"name": "Shared Study"},
    )
    ss_id = resp.json()["id"]

    # Share it
    resp = await client.post(
        f"/api/library/shared/{ss_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 201

    # List shared
    resp = await client.get("/api/library/shared", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert any(s["sample_set_id"] == ss_id for s in data)


@pytest.mark.asyncio
async def test_share_duplicate_fails(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/sample-sets",
        headers=auth_headers,
        json={"name": "Dup Share"},
    )
    ss_id = resp.json()["id"]

    await client.post(f"/api/library/shared/{ss_id}", headers=auth_headers)
    resp = await client.post(f"/api/library/shared/{ss_id}", headers=auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_unshare(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/sample-sets",
        headers=auth_headers,
        json={"name": "Unshare Me"},
    )
    ss_id = resp.json()["id"]

    await client.post(f"/api/library/shared/{ss_id}", headers=auth_headers)
    resp = await client.delete(f"/api/library/shared/{ss_id}", headers=auth_headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_copy_shared(client: AsyncClient, auth_headers, second_auth_headers):
    # User 1 creates and shares
    resp = await client.post(
        "/api/sample-sets",
        headers=auth_headers,
        json={"name": "Original"},
    )
    ss_id = resp.json()["id"]

    await client.post(f"/api/library/shared/{ss_id}", headers=auth_headers)

    # User 2 copies
    resp = await client.post(
        f"/api/library/shared/{ss_id}/copy",
        headers=second_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Original (copy)"
    assert data["id"] != ss_id


@pytest.mark.asyncio
async def test_nonexistent_folder_404(client: AsyncClient, auth_headers):
    fake_id = str(uuid.uuid4())
    resp = await client.put(
        f"/api/library/folders/{fake_id}",
        headers=auth_headers,
        json={"name": "Nope"},
    )
    assert resp.status_code == 404
