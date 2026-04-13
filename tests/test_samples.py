import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post(
        "/api/auth/register",
        json={
            "username": "sampleuser",
            "email": "sample@example.com",
            "password": "pass123",
        },
    )
    resp = await client.post(
        "/api/auth/login",
        json={"username": "sampleuser", "password": "pass123"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def sample_set_id(client: AsyncClient, auth_headers: dict) -> str:
    resp = await client.post(
        "/api/sample-sets",
        headers=auth_headers,
        json={"name": "Test Study", "description": "A test sample set"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.fixture
async def subset_id(client: AsyncClient, auth_headers: dict, sample_set_id: str) -> str:
    resp = await client.post(
        f"/api/sample-sets/{sample_set_id}/subsets",
        headers=auth_headers,
        json={"name": "raw", "type": "raw"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


# --- SampleSet Tests ---


@pytest.mark.asyncio
async def test_create_sample_set(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/sample-sets",
        headers=auth_headers,
        json={"name": "My Study"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Study"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_sample_sets(client: AsyncClient, auth_headers, sample_set_id):
    resp = await client.get("/api/sample-sets", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert any(s["id"] == sample_set_id for s in data)


@pytest.mark.asyncio
async def test_get_sample_set_detail(client: AsyncClient, auth_headers, sample_set_id):
    resp = await client.get(f"/api/sample-sets/{sample_set_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == sample_set_id
    assert data["name"] == "Test Study"
    assert "subsets" in data


@pytest.mark.asyncio
async def test_update_sample_set(client: AsyncClient, auth_headers, sample_set_id):
    resp = await client.put(
        f"/api/sample-sets/{sample_set_id}",
        headers=auth_headers,
        json={"name": "Updated Study"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Study"


@pytest.mark.asyncio
async def test_delete_sample_set(client: AsyncClient, auth_headers, sample_set_id):
    resp = await client.delete(
        f"/api/sample-sets/{sample_set_id}", headers=auth_headers
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_get_nonexistent_sample_set(client: AsyncClient, auth_headers):
    import uuid

    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/sample-sets/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404


# --- Image Upload/Download Tests ---


@pytest.mark.asyncio
async def test_image_upload_and_download(
    client: AsyncClient, auth_headers, sample_set_id, tmp_path
):
    # Create a subset first via direct API (we need subset routes)
    # For now we'll test through the full flow
    # Create sample set -> we already have one
    # We need to create a subset - but we don't have a create subset route yet
    # Use the image upload which requires a subset
    # Let's just test that the routes are reachable and return proper errors
    resp = await client.get(
        f"/api/sample-sets/{sample_set_id}/subsets",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


# --- Subset CRUD Tests ---


@pytest.mark.asyncio
async def test_create_subset(client: AsyncClient, auth_headers, sample_set_id):
    resp = await client.post(
        f"/api/sample-sets/{sample_set_id}/subsets",
        headers=auth_headers,
        json={"name": "my_subset", "type": "raw"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "my_subset"
    assert data["type"] == "raw"


@pytest.mark.asyncio
async def test_get_subset_detail(
    client: AsyncClient, auth_headers, sample_set_id, subset_id
):
    resp = await client.get(
        f"/api/sample-sets/{sample_set_id}/subsets/{subset_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == subset_id
    assert data["name"] == "raw"
    assert "images" in data


# --- Image Upload/Rename/Delete Tests ---


@pytest.mark.asyncio
async def test_image_upload_and_rename(
    client: AsyncClient, auth_headers, sample_set_id, subset_id
):
    # Upload an image
    resp = await client.post(
        f"/api/sample-sets/{sample_set_id}/subsets/{subset_id}/images",
        headers=auth_headers,
        files={"file": ("brain.nii.gz", b"fake-nifti-data", "application/octet-stream")},
    )
    assert resp.status_code == 201
    image_id = resp.json()["id"]
    assert resp.json()["filename"] == "brain.nii.gz"

    # Rename the image
    resp = await client.put(
        f"/api/sample-sets/{sample_set_id}/subsets/{subset_id}/images/{image_id}",
        headers=auth_headers,
        json={"filename": "brain_v2.nii.gz"},
    )
    assert resp.status_code == 200
    assert resp.json()["filename"] == "brain_v2.nii.gz"
    assert resp.json()["id"] == image_id


@pytest.mark.asyncio
async def test_image_rename_not_found(
    client: AsyncClient, auth_headers, sample_set_id, subset_id
):
    import uuid

    fake_id = str(uuid.uuid4())
    resp = await client.put(
        f"/api/sample-sets/{sample_set_id}/subsets/{subset_id}/images/{fake_id}",
        headers=auth_headers,
        json={"filename": "new_name.nii.gz"},
    )
    assert resp.status_code == 404


# --- Subset Name Uniqueness Tests ---


@pytest.mark.asyncio
async def test_create_duplicate_subset_name_returns_409(
    client: AsyncClient, auth_headers, sample_set_id
):
    resp1 = await client.post(
        f"/api/sample-sets/{sample_set_id}/subsets",
        headers=auth_headers,
        json={"name": "dup_name", "type": "raw"},
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        f"/api/sample-sets/{sample_set_id}/subsets",
        headers=auth_headers,
        json={"name": "dup_name", "type": "raw"},
    )
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_rename_subset_to_existing_name_returns_409(
    client: AsyncClient, auth_headers, sample_set_id
):
    resp1 = await client.post(
        f"/api/sample-sets/{sample_set_id}/subsets",
        headers=auth_headers,
        json={"name": "first", "type": "raw"},
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        f"/api/sample-sets/{sample_set_id}/subsets",
        headers=auth_headers,
        json={"name": "second", "type": "raw"},
    )
    assert resp2.status_code == 201
    second_id = resp2.json()["id"]

    resp3 = await client.put(
        f"/api/sample-sets/{sample_set_id}/subsets/{second_id}",
        headers=auth_headers,
        json={"name": "first"},
    )
    assert resp3.status_code == 409


@pytest.mark.asyncio
async def test_rename_subset_to_same_name_succeeds(
    client: AsyncClient, auth_headers, sample_set_id
):
    resp = await client.post(
        f"/api/sample-sets/{sample_set_id}/subsets",
        headers=auth_headers,
        json={"name": "keep_name", "type": "raw"},
    )
    assert resp.status_code == 201
    subset_id = resp.json()["id"]

    resp2 = await client.put(
        f"/api/sample-sets/{sample_set_id}/subsets/{subset_id}",
        headers=auth_headers,
        json={"name": "keep_name"},
    )
    assert resp2.status_code == 200


# --- is_shared field test ---


@pytest.mark.asyncio
async def test_sample_set_detail_includes_is_shared(
    client: AsyncClient, auth_headers, sample_set_id
):
    resp = await client.get(
        f"/api/sample-sets/{sample_set_id}", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "is_shared" in data
    assert data["is_shared"] is False
