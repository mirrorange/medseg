"""Tests for Stage 6: Task Scheduling."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.pipeline.scheduler import Scheduler

# --------------- Scheduler Unit Tests ---------------


def test_scheduler_enqueue_and_queue_lengths():
    sched = Scheduler(affinity_bonus_ms=60000, max_retry_count=1)
    task_id = uuid.uuid4()
    pos = sched.enqueue(
        task_id=task_id,
        module_name="echo",
        sample_set_id=uuid.uuid4(),
        input_subset_id=uuid.uuid4(),
        output_subset_name="output",
        user_id=uuid.uuid4(),
    )
    assert pos == 0
    assert sched.queue_lengths() == {"echo": 1}


def test_scheduler_enqueue_multiple():
    sched = Scheduler(affinity_bonus_ms=60000, max_retry_count=1)
    ids = [uuid.uuid4() for _ in range(3)]
    for i, tid in enumerate(ids):
        pos = sched.enqueue(
            task_id=tid,
            module_name="echo",
            sample_set_id=uuid.uuid4(),
            input_subset_id=uuid.uuid4(),
            output_subset_name=f"output_{i}",
            user_id=uuid.uuid4(),
        )
        assert pos == i
    assert sched.queue_lengths() == {"echo": 3}


def test_scheduler_cancel():
    sched = Scheduler(affinity_bonus_ms=60000, max_retry_count=1)
    task_id = uuid.uuid4()
    sched.enqueue(
        task_id=task_id,
        module_name="echo",
        sample_set_id=uuid.uuid4(),
        input_subset_id=uuid.uuid4(),
        output_subset_name="output",
        user_id=uuid.uuid4(),
    )
    assert sched.cancel(task_id) is True
    assert sched.queue_lengths() == {}
    assert sched.cancel(task_id) is False  # Already removed


def test_scheduler_cancel_nonexistent():
    sched = Scheduler(affinity_bonus_ms=60000, max_retry_count=1)
    assert sched.cancel(uuid.uuid4()) is False


def test_priority_calculation_without_affinity():
    sched = Scheduler(affinity_bonus_ms=60000, max_retry_count=1)
    # Module not loaded: priority = wait_time only
    priority = sched.calculate_priority("echo", 5000, loaded_modules=set())
    assert priority == 5000


def test_priority_calculation_with_affinity():
    sched = Scheduler(affinity_bonus_ms=60000, max_retry_count=1)
    # Module loaded: priority = wait_time + bonus
    priority = sched.calculate_priority("echo", 5000, loaded_modules={"echo"})
    assert priority == 65000


def test_select_next_prefers_loaded_module():
    sched = Scheduler(affinity_bonus_ms=60000, max_retry_count=1)
    t1 = uuid.uuid4()
    t2 = uuid.uuid4()

    # Enqueue to two different module queues
    sched.enqueue(
        task_id=t1,
        module_name="model_a",
        sample_set_id=uuid.uuid4(),
        input_subset_id=uuid.uuid4(),
        output_subset_name="out",
        user_id=uuid.uuid4(),
    )
    sched.enqueue(
        task_id=t2,
        module_name="model_b",
        sample_set_id=uuid.uuid4(),
        input_subset_id=uuid.uuid4(),
        output_subset_name="out",
        user_id=uuid.uuid4(),
    )

    # model_b is loaded, so should be preferred even with similar wait times
    selected = sched.select_next(loaded_modules={"model_b"})
    assert selected == t2


def test_select_next_empty_queues():
    sched = Scheduler(affinity_bonus_ms=60000, max_retry_count=1)
    assert sched.select_next(loaded_modules=set()) is None


def test_select_next_prefers_longer_wait():
    sched = Scheduler(affinity_bonus_ms=60000, max_retry_count=1)
    older = uuid.uuid4()
    newer = uuid.uuid4()

    # Manually set enqueue times to control wait
    sched.enqueue(
        task_id=older,
        module_name="model_a",
        sample_set_id=uuid.uuid4(),
        input_subset_id=uuid.uuid4(),
        output_subset_name="out",
        user_id=uuid.uuid4(),
    )
    # Make older task appear to have been waiting longer
    sched._entries[older]["enqueued_at"] = datetime.now(UTC) - timedelta(minutes=5)

    sched.enqueue(
        task_id=newer,
        module_name="model_b",
        sample_set_id=uuid.uuid4(),
        input_subset_id=uuid.uuid4(),
        output_subset_name="out",
        user_id=uuid.uuid4(),
    )

    # Neither loaded — should prefer model_a (longer wait)
    selected = sched.select_next(loaded_modules=set())
    assert selected == older


# --------------- Task API Integration Tests ---------------


@pytest.fixture(autouse=True)
def _register_echo_module():
    """Register echo module in the global registry for API tests."""
    from app.pipeline.modules.echo import EchoModule
    from app.pipeline.state import registry, scheduler

    mod = EchoModule()
    registry.register(mod)
    yield
    registry.unregister("echo")
    # Clean up scheduler queues
    scheduler._queues.clear()
    scheduler._entries.clear()
    scheduler._running_task_id = None


@pytest.fixture
async def auth_header(client):
    """Register a user and return auth header."""
    await client.post(
        "/api/auth/register",
        json={
            "username": "taskuser",
            "email": "taskuser@test.com",
            "password": "password123",
        },
    )
    resp = await client.post(
        "/api/auth/login",
        json={"username": "taskuser", "password": "password123"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def sample_set_with_subset(client, auth_header, session):
    """Create a sample set with a subset for task testing."""
    # Create sample set
    resp = await client.post(
        "/api/sample-sets",
        json={"name": "Task Test Set"},
        headers=auth_header,
    )
    ss = resp.json()
    ss_id = ss["id"]

    # Create a subset by uploading an image (the upload creates a raw subset)
    # First create a subset directly via DB
    from app.models.subset import Subset

    subset = Subset(
        sample_set_id=uuid.UUID(ss_id),
        name="raw_input",
        type="raw",
        metadata_={},
    )
    session.add(subset)
    await session.commit()
    await session.refresh(subset)

    return {"sample_set_id": ss_id, "subset_id": str(subset.id)}


@pytest.mark.asyncio
async def test_submit_task(client, auth_header, sample_set_with_subset):
    """Test submitting a task via POST /api/pipelines/run."""
    data = sample_set_with_subset
    resp = await client.post(
        "/api/pipelines/run",
        json={
            "module_name": "echo",
            "sample_set_id": data["sample_set_id"],
            "input_subset_id": data["subset_id"],
            "output_subset_name": "echo_output",
        },
        headers=auth_header,
    )
    assert resp.status_code == 201
    task = resp.json()
    assert task["status"] == "queued"
    assert task["module_name"] == "echo"


@pytest.mark.asyncio
async def test_list_my_tasks(client, auth_header, sample_set_with_subset):
    """Test listing user's tasks."""
    data = sample_set_with_subset
    # Submit a task first
    await client.post(
        "/api/pipelines/run",
        json={
            "module_name": "echo",
            "sample_set_id": data["sample_set_id"],
            "input_subset_id": data["subset_id"],
            "output_subset_name": "echo_output",
        },
        headers=auth_header,
    )

    resp = await client.get("/api/tasks", headers=auth_header)
    assert resp.status_code == 200
    tasks = resp.json()
    assert len(tasks) >= 1


@pytest.mark.asyncio
async def test_get_task_detail(client, auth_header, sample_set_with_subset):
    """Test getting task details."""
    data = sample_set_with_subset
    resp = await client.post(
        "/api/pipelines/run",
        json={
            "module_name": "echo",
            "sample_set_id": data["sample_set_id"],
            "input_subset_id": data["subset_id"],
            "output_subset_name": "echo_output",
        },
        headers=auth_header,
    )
    task_id = resp.json()["id"]

    resp = await client.get(f"/api/tasks/{task_id}", headers=auth_header)
    assert resp.status_code == 200
    assert resp.json()["id"] == task_id


@pytest.mark.asyncio
async def test_cancel_task(client, auth_header, sample_set_with_subset):
    """Test cancelling a queued task."""
    data = sample_set_with_subset
    resp = await client.post(
        "/api/pipelines/run",
        json={
            "module_name": "echo",
            "sample_set_id": data["sample_set_id"],
            "input_subset_id": data["subset_id"],
            "output_subset_name": "echo_cancel",
        },
        headers=auth_header,
    )
    task_id = resp.json()["id"]

    resp = await client.delete(f"/api/tasks/{task_id}", headers=auth_header)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_submit_task_invalid_module(client, auth_header, sample_set_with_subset):
    """Test submitting a task with a non-existent module returns 400."""
    data = sample_set_with_subset
    resp = await client.post(
        "/api/pipelines/run",
        json={
            "module_name": "nonexistent_module",
            "sample_set_id": data["sample_set_id"],
            "input_subset_id": data["subset_id"],
            "output_subset_name": "output",
        },
        headers=auth_header,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_task_not_found(client, auth_header):
    """Test getting a non-existent task returns 404."""
    resp = await client.get(f"/api/tasks/{uuid.uuid4()}", headers=auth_header)
    assert resp.status_code == 404


# --------------- Batch Run Tests ---------------


@pytest.fixture
async def sample_set_with_two_subsets(client, auth_header, session):
    """Create a sample set with two subsets for batch testing."""
    from app.models.subset import Subset

    resp = await client.post(
        "/api/sample-sets",
        json={"name": "Batch Test Set"},
        headers=auth_header,
    )
    ss_id = resp.json()["id"]

    subset_a = Subset(
        sample_set_id=uuid.UUID(ss_id),
        name="raw_a",
        type="raw",
        metadata_={},
    )
    subset_b = Subset(
        sample_set_id=uuid.UUID(ss_id),
        name="raw_b",
        type="raw",
        metadata_={},
    )
    session.add(subset_a)
    session.add(subset_b)
    await session.commit()
    await session.refresh(subset_a)
    await session.refresh(subset_b)

    return {
        "sample_set_id": ss_id,
        "subset_ids": [str(subset_a.id), str(subset_b.id)],
    }


@pytest.mark.asyncio
async def test_batch_run_pipeline(client, auth_header, sample_set_with_two_subsets):
    """Test batch submitting tasks for multiple subsets."""
    data = sample_set_with_two_subsets
    resp = await client.post(
        "/api/pipelines/batch-run",
        json={
            "module_name": "echo",
            "sample_set_id": data["sample_set_id"],
            "input_subset_ids": data["subset_ids"],
            "output_subset_name_template": "{input_name}_echo",
        },
        headers=auth_header,
    )
    assert resp.status_code == 201
    result = resp.json()
    assert len(result["tasks"]) == 2
    assert len(result["errors"]) == 0
    # Verify each task has correct output name based on template
    output_names = {t["output_subset_name"] for t in result["tasks"]}
    assert "raw_a_echo" in output_names
    assert "raw_b_echo" in output_names


@pytest.mark.asyncio
async def test_batch_run_empty_list(client, auth_header, sample_set_with_two_subsets):
    """Test batch-run with empty input_subset_ids returns empty result."""
    data = sample_set_with_two_subsets
    resp = await client.post(
        "/api/pipelines/batch-run",
        json={
            "module_name": "echo",
            "sample_set_id": data["sample_set_id"],
            "input_subset_ids": [],
        },
        headers=auth_header,
    )
    assert resp.status_code == 201
    result = resp.json()
    assert len(result["tasks"]) == 0
    assert len(result["errors"]) == 0


@pytest.mark.asyncio
async def test_batch_run_with_invalid_subset(
    client, auth_header, sample_set_with_two_subsets
):
    """Test batch-run with a non-existent subset ID records error without failing."""
    data = sample_set_with_two_subsets
    fake_id = str(uuid.uuid4())
    resp = await client.post(
        "/api/pipelines/batch-run",
        json={
            "module_name": "echo",
            "sample_set_id": data["sample_set_id"],
            "input_subset_ids": [data["subset_ids"][0], fake_id],
            "output_subset_name_template": "{input_name}_echo",
        },
        headers=auth_header,
    )
    assert resp.status_code == 201
    result = resp.json()
    assert len(result["tasks"]) == 1
    assert len(result["errors"]) == 1
    assert result["errors"][0]["input_subset_id"] == fake_id


@pytest.mark.asyncio
async def test_submit_task_with_overwrite(client, auth_header, sample_set_with_subset):
    """Test that TaskCreate accepts overwrite field."""
    data = sample_set_with_subset
    resp = await client.post(
        "/api/pipelines/run",
        json={
            "module_name": "echo",
            "sample_set_id": data["sample_set_id"],
            "input_subset_id": data["subset_id"],
            "output_subset_name": "echo_output",
            "overwrite": True,
        },
        headers=auth_header,
    )
    assert resp.status_code == 201
    task = resp.json()
    assert task["overwrite"] is True


@pytest.mark.asyncio
async def test_submit_task_overwrite_defaults_false(
    client, auth_header, sample_set_with_subset
):
    """Test that overwrite defaults to False."""
    data = sample_set_with_subset
    resp = await client.post(
        "/api/pipelines/run",
        json={
            "module_name": "echo",
            "sample_set_id": data["sample_set_id"],
            "input_subset_id": data["subset_id"],
            "output_subset_name": "echo_output",
        },
        headers=auth_header,
    )
    assert resp.status_code == 201
    task = resp.json()
    assert task["overwrite"] is False
