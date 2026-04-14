"""Tests for Stage 8: Admin API."""

import pytest
from sqlmodel import select

from app.models.user import User, UserRole


@pytest.fixture
async def admin_header(client, session):
    """Register a user, promote to admin, return auth header."""
    await client.post(
        "/api/auth/register",
        json={
            "username": "adminuser",
            "email": "admin@test.com",
            "password": "password123",
        },
    )
    # Promote to admin
    result = await session.exec(select(User).where(User.username == "adminuser"))
    user = result.one()
    user.role = UserRole.admin
    session.add(user)
    await session.commit()

    resp = await client.post(
        "/api/auth/login",
        json={"username": "adminuser", "password": "password123"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def regular_header(client):
    """Register a regular user and return auth header."""
    await client.post(
        "/api/auth/register",
        json={
            "username": "regularuser",
            "email": "regular@test.com",
            "password": "password123",
        },
    )
    resp = await client.post(
        "/api/auth/login",
        json={"username": "regularuser", "password": "password123"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# --------------- Admin Sample Sets ---------------


@pytest.mark.asyncio
async def test_admin_list_all_sample_sets(client, admin_header, regular_header):
    """Admin can see all users' sample sets."""
    # Regular user creates a sample set
    await client.post(
        "/api/sample-sets",
        json={"name": "Regular User Set"},
        headers=regular_header,
    )

    # Admin lists all
    resp = await client.get("/api/admin/sample-sets", headers=admin_header)
    assert resp.status_code == 200
    sets = resp.json()
    assert any(s["name"] == "Regular User Set" for s in sets)


@pytest.mark.asyncio
async def test_non_admin_cannot_list_all_sample_sets(client, regular_header):
    resp = await client.get("/api/admin/sample-sets", headers=regular_header)
    assert resp.status_code == 403


# --------------- Admin Shared Management ---------------


@pytest.mark.asyncio
async def test_admin_remove_shared(client, admin_header, regular_header):
    """Admin can remove any shared sample set."""
    # Regular user creates and shares a sample set
    resp = await client.post(
        "/api/sample-sets",
        json={"name": "Shared Set"},
        headers=regular_header,
    )
    ss_id = resp.json()["id"]

    await client.post(
        f"/api/library/shared/{ss_id}",
        headers=regular_header,
    )

    # Admin removes from shared
    resp = await client.delete(
        f"/api/admin/shared/{ss_id}",
        headers=admin_header,
    )
    assert resp.status_code == 200
    assert resp.json()["shared"] is False

    # Verify it's no longer shared
    resp = await client.get("/api/library/shared", headers=regular_header)
    shared = resp.json()
    assert not any(s["id"] == ss_id for s in shared)


# --------------- Admin Stats ---------------


@pytest.mark.asyncio
async def test_admin_stats(client, admin_header):
    resp = await client.get("/api/admin/stats", headers=admin_header)
    assert resp.status_code == 200
    data = resp.json()
    assert "user_count" in data
    assert "sample_set_count" in data
    assert "shared_count" in data
    assert data["user_count"] >= 1


@pytest.mark.asyncio
async def test_non_admin_cannot_access_stats(client, regular_header):
    resp = await client.get("/api/admin/stats", headers=regular_header)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_shared_count_decreases_when_sample_set_deleted(
    client, admin_header, regular_header
):
    """Deleting a shared sample set should also remove the Share record,
    so the admin stats shared_count stays accurate."""
    # Regular user creates and shares a sample set
    resp = await client.post(
        "/api/sample-sets",
        json={"name": "WillBeDeleted"},
        headers=regular_header,
    )
    ss_id = resp.json()["id"]

    await client.post(
        f"/api/library/shared/{ss_id}",
        headers=regular_header,
    )

    # Verify shared_count increased
    resp = await client.get("/api/admin/stats", headers=admin_header)
    shared_before = resp.json()["shared_count"]
    assert shared_before >= 1

    # Delete the sample set (as admin)
    resp = await client.delete(
        f"/api/sample-sets/{ss_id}",
        headers=admin_header,
    )
    assert resp.status_code == 204

    # shared_count should have decreased
    resp = await client.get("/api/admin/stats", headers=admin_header)
    shared_after = resp.json()["shared_count"]
    assert shared_after == shared_before - 1


# --------------- Admin Create User ---------------


@pytest.mark.asyncio
async def test_admin_create_user(client, admin_header):
    """Admin can create a new user."""
    resp = await client.post(
        "/api/users",
        json={
            "username": "newuser",
            "email": "newuser@test.com",
            "password": "securePass1",
            "role": "user",
            "is_active": True,
        },
        headers=admin_header,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "newuser"
    assert data["email"] == "newuser@test.com"
    assert data["role"] == "user"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_admin_create_user_duplicate_username(client, admin_header):
    """Cannot create a user with duplicate username."""
    await client.post(
        "/api/users",
        json={
            "username": "dupuser",
            "email": "dup1@test.com",
            "password": "pass123",
        },
        headers=admin_header,
    )
    resp = await client.post(
        "/api/users",
        json={
            "username": "dupuser",
            "email": "dup2@test.com",
            "password": "pass123",
        },
        headers=admin_header,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_non_admin_cannot_create_user(client, regular_header):
    """Regular user cannot create users."""
    resp = await client.post(
        "/api/users",
        json={
            "username": "hackeduser",
            "email": "hack@test.com",
            "password": "pass123",
        },
        headers=regular_header,
    )
    assert resp.status_code == 403


# --------------- Admin Sample Set Search & Owner Username ---------------


@pytest.mark.asyncio
async def test_admin_sample_sets_include_owner_username(
    client, admin_header, regular_header
):
    """Response should include owner_username instead of just owner_id."""
    await client.post(
        "/api/sample-sets",
        json={"name": "Owner Test Set"},
        headers=regular_header,
    )
    resp = await client.get("/api/admin/sample-sets", headers=admin_header)
    assert resp.status_code == 200
    sets = resp.json()
    match = [s for s in sets if s["name"] == "Owner Test Set"]
    assert len(match) == 1
    assert match[0]["owner_username"] == "regularuser"


@pytest.mark.asyncio
async def test_admin_sample_sets_search(client, admin_header, regular_header):
    """Search param filters by name and description."""
    await client.post(
        "/api/sample-sets",
        json={"name": "Alpha Set", "description": "first"},
        headers=regular_header,
    )
    await client.post(
        "/api/sample-sets",
        json={"name": "Beta Set", "description": "second"},
        headers=regular_header,
    )

    # Search by name
    resp = await client.get(
        "/api/admin/sample-sets", params={"search": "Alpha"}, headers=admin_header
    )
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert "Alpha Set" in names
    assert "Beta Set" not in names

    # Search by description
    resp = await client.get(
        "/api/admin/sample-sets", params={"search": "second"}, headers=admin_header
    )
    names = [s["name"] for s in resp.json()]
    assert "Beta Set" in names


@pytest.mark.asyncio
async def test_admin_sample_sets_filter_by_owner(
    client, admin_header, regular_header, session
):
    """owner_id param filters to a specific user's sets."""
    await client.post(
        "/api/sample-sets",
        json={"name": "Filtered Set"},
        headers=regular_header,
    )
    # Get the regular user's id
    result = await session.exec(select(User).where(User.username == "regularuser"))
    regular_user = result.one()

    resp = await client.get(
        "/api/admin/sample-sets",
        params={"owner_id": str(regular_user.id)},
        headers=admin_header,
    )
    assert resp.status_code == 200
    sets = resp.json()
    assert all(s["owner_id"] == str(regular_user.id) for s in sets)
