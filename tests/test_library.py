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
async def test_shared_search(client: AsyncClient, auth_headers):
    """Search shared library by name and description."""
    # Create and share two sample sets
    resp = await client.post(
        "/api/sample-sets",
        headers=auth_headers,
        json={"name": "Brain MRI Study", "description": "Neurology department"},
    )
    ss1_id = resp.json()["id"]
    await client.post(f"/api/library/shared/{ss1_id}", headers=auth_headers)

    resp = await client.post(
        "/api/sample-sets",
        headers=auth_headers,
        json={"name": "Lung CT Study", "description": "Radiology scan data"},
    )
    ss2_id = resp.json()["id"]
    await client.post(f"/api/library/shared/{ss2_id}", headers=auth_headers)

    # Search by name
    resp = await client.get("/api/library/shared?search=brain", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["sample_set_name"] == "Brain MRI Study"

    # Search by description
    resp = await client.get("/api/library/shared?search=radiology", headers=auth_headers)
    data = resp.json()
    assert len(data) == 1
    assert data[0]["sample_set_name"] == "Lung CT Study"

    # Empty search returns all
    resp = await client.get("/api/library/shared", headers=auth_headers)
    data = resp.json()
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_nonexistent_folder_404(client: AsyncClient, auth_headers):
    fake_id = str(uuid.uuid4())
    resp = await client.put(
        f"/api/library/folders/{fake_id}",
        headers=auth_headers,
        json={"name": "Nope"},
    )
    assert resp.status_code == 404


# --------------- Contents (flat view) ---------------


@pytest.mark.asyncio
async def test_contents_root(client: AsyncClient, auth_headers):
    """GET /contents at root returns folders and sample sets."""
    await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "Folder X"},
    )
    await client.post(
        "/api/sample-sets", headers=auth_headers, json={"name": "Study X"},
    )

    resp = await client.get("/api/library/contents", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["folder_id"] is None
    assert "breadcrumb" in data
    assert len(data["breadcrumb"]) == 0
    names = [i["name"] for i in data["items"]]
    assert "Folder X" in names
    assert "Study X" in names
    # Folders come first (sorted by type, then name)
    folder_items = [i for i in data["items"] if i["type"] == "folder"]
    ss_items = [i for i in data["items"] if i["type"] == "sample_set"]
    assert all(
        data["items"].index(f) < data["items"].index(s)
        for f in folder_items
        for s in ss_items
    ) or len(folder_items) == 0 or len(ss_items) == 0


@pytest.mark.asyncio
async def test_contents_subfolder(client: AsyncClient, auth_headers):
    """GET /contents?folder_id=... returns children of that folder."""
    resp = await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "Parent C"},
    )
    parent_id = resp.json()["id"]

    await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "Child C", "parent_id": parent_id},
    )
    await client.post(
        "/api/sample-sets",
        headers=auth_headers,
        json={"name": "Sub Study", "folder_id": parent_id},
    )

    resp = await client.get(
        "/api/library/contents",
        headers=auth_headers,
        params={"folder_id": parent_id},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["folder_id"] == parent_id
    names = [i["name"] for i in data["items"]]
    assert "Child C" in names
    assert "Sub Study" in names


@pytest.mark.asyncio
async def test_contents_sort_by_name_desc(client: AsyncClient, auth_headers):
    """Contents can be sorted by name descending."""
    await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "AAA"},
    )
    await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "ZZZ"},
    )

    resp = await client.get(
        "/api/library/contents",
        headers=auth_headers,
        params={"sort_by": "name", "sort_order": "desc"},
    )
    assert resp.status_code == 200
    folder_names = [
        i["name"] for i in resp.json()["items"] if i["type"] == "folder"
    ]
    assert folder_names == sorted(folder_names, reverse=True)


# --------------- Breadcrumb ---------------


@pytest.mark.asyncio
async def test_breadcrumb(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "L1"},
    )
    l1_id = resp.json()["id"]

    resp = await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "L2", "parent_id": l1_id},
    )
    l2_id = resp.json()["id"]

    resp = await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "L3", "parent_id": l2_id},
    )
    l3_id = resp.json()["id"]

    resp = await client.get(
        f"/api/library/path/{l3_id}", headers=auth_headers,
    )
    assert resp.status_code == 200
    crumbs = resp.json()
    assert len(crumbs) == 3
    assert crumbs[0]["name"] == "L1"
    assert crumbs[0]["id"] == l1_id
    assert crumbs[1]["name"] == "L2"
    assert crumbs[2]["name"] == "L3"
    assert crumbs[2]["id"] == l3_id


@pytest.mark.asyncio
async def test_breadcrumb_nonexistent_folder(client: AsyncClient, auth_headers):
    fake_id = str(uuid.uuid4())
    resp = await client.get(
        f"/api/library/path/{fake_id}", headers=auth_headers,
    )
    assert resp.status_code == 404


# --------------- Batch move ---------------


@pytest.mark.asyncio
async def test_batch_move_folder(client: AsyncClient, auth_headers):
    """Move a folder into another folder."""
    resp = await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "Target"},
    )
    target_id = resp.json()["id"]

    resp = await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "Mover"},
    )
    mover_id = resp.json()["id"]

    resp = await client.post(
        "/api/library/batch-move",
        headers=auth_headers,
        json={
            "target_folder_id": target_id,
            "items": [{"id": mover_id, "type": "folder"}],
        },
    )
    assert resp.status_code == 204

    # Verify by checking contents of target
    resp = await client.get(
        "/api/library/contents",
        headers=auth_headers,
        params={"folder_id": target_id},
    )
    names = [i["name"] for i in resp.json()["items"]]
    assert "Mover" in names


@pytest.mark.asyncio
async def test_batch_move_sample_set(client: AsyncClient, auth_headers):
    """Move a sample set into a folder."""
    resp = await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "Dest"},
    )
    dest_id = resp.json()["id"]

    resp = await client.post(
        "/api/sample-sets", headers=auth_headers, json={"name": "MoveSS"},
    )
    ss_id = resp.json()["id"]

    resp = await client.post(
        "/api/library/batch-move",
        headers=auth_headers,
        json={
            "target_folder_id": dest_id,
            "items": [{"id": ss_id, "type": "sample_set"}],
        },
    )
    assert resp.status_code == 204

    # Verify
    resp = await client.get(
        "/api/library/contents",
        headers=auth_headers,
        params={"folder_id": dest_id},
    )
    names = [i["name"] for i in resp.json()["items"]]
    assert "MoveSS" in names


@pytest.mark.asyncio
async def test_batch_move_to_root(client: AsyncClient, auth_headers):
    """Move items to root (target_folder_id=null)."""
    resp = await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "Box"},
    )
    box_id = resp.json()["id"]

    resp = await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "Inside", "parent_id": box_id},
    )
    inside_id = resp.json()["id"]

    resp = await client.post(
        "/api/library/batch-move",
        headers=auth_headers,
        json={
            "target_folder_id": None,
            "items": [{"id": inside_id, "type": "folder"}],
        },
    )
    assert resp.status_code == 204

    # Verify Inside is now at root
    resp = await client.get("/api/library/contents", headers=auth_headers)
    names = [i["name"] for i in resp.json()["items"]]
    assert "Inside" in names


# --------------- Name uniqueness ---------------


@pytest.mark.asyncio
async def test_create_folder_duplicate_name(client: AsyncClient, auth_headers):
    """Creating two folders with the same name in the same parent should fail."""
    await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "Dup"},
    )
    resp = await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "Dup"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == 403006


@pytest.mark.asyncio
async def test_create_sample_set_duplicate_name(client: AsyncClient, auth_headers):
    """Creating two sample sets with the same name in the same folder should fail."""
    await client.post(
        "/api/sample-sets", headers=auth_headers, json={"name": "DupSS"},
    )
    resp = await client.post(
        "/api/sample-sets", headers=auth_headers, json={"name": "DupSS"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == 403006


@pytest.mark.asyncio
async def test_rename_folder_duplicate_name(client: AsyncClient, auth_headers):
    """Renaming a folder to a name that already exists should fail."""
    await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "Existing"},
    )
    resp = await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "WillRename"},
    )
    folder_id = resp.json()["id"]

    resp = await client.put(
        f"/api/library/folders/{folder_id}",
        headers=auth_headers,
        json={"name": "Existing"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == 403006


@pytest.mark.asyncio
async def test_same_name_different_folders_ok(client: AsyncClient, auth_headers):
    """Same name in different folders should be allowed."""
    resp = await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "Container"},
    )
    container_id = resp.json()["id"]

    # Create "SameName" at root
    resp = await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "SameName"},
    )
    assert resp.status_code == 201

    # Create "SameName" inside container — different parent, should succeed
    resp = await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "SameName", "parent_id": container_id},
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_batch_move_duplicate_name_fails(client: AsyncClient, auth_headers):
    """Moving an item to a folder that already has an item with the same name should fail."""
    resp = await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "Dest2"},
    )
    dest_id = resp.json()["id"]

    # Create "Clash" inside Dest2
    await client.post(
        "/api/library/folders",
        headers=auth_headers,
        json={"name": "Clash", "parent_id": dest_id},
    )

    # Create "Clash" at root
    resp = await client.post(
        "/api/library/folders", headers=auth_headers, json={"name": "Clash"},
    )
    clash_root_id = resp.json()["id"]

    # Try to move root "Clash" into Dest2 — should fail
    resp = await client.post(
        "/api/library/batch-move",
        headers=auth_headers,
        json={
            "target_folder_id": dest_id,
            "items": [{"id": clash_root_id, "type": "folder"}],
        },
    )
    assert resp.status_code == 409
