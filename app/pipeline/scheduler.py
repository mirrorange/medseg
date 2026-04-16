"""Task Scheduler — per-module FIFO queues with dynamic priority scoring.

The scheduler is event-driven:
- Triggered when a new task is enqueued or a running task completes/fails.
- Selects the highest-priority queue-head task.
- Coordinates module loading via ResourceManager and executes the task.
"""

import asyncio
import contextlib
import logging
import shutil
import tempfile
import uuid
from collections import defaultdict
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.pipeline.interface import InputImageInfo, RunInput

logger = logging.getLogger(__name__)


class Scheduler:
    """Event-driven task scheduler with per-module FIFO queues."""

    def __init__(
        self,
        *,
        affinity_bonus_ms: float = 60000,
        max_retry_count: int = 1,
    ) -> None:
        self.affinity_bonus_ms = affinity_bonus_ms
        self.max_retry_count = max_retry_count

        # {module_name: deque of task_id}
        self._queues: dict[str, list[uuid.UUID]] = defaultdict(list)

        # {task_id: TaskEntry} — metadata for queued tasks
        self._entries: dict[uuid.UUID, dict[str, Any]] = {}

        # Currently running task id (single-threaded execution)
        self._running_task_id: uuid.UUID | None = None

        # Executor callback: set by the application layer to perform actual work.
        # Signature: async def executor(task_id: UUID, entry: dict) -> None
        self._executor: Callable | None = None

        # Background scheduling task
        self._schedule_event = asyncio.Event()
        self._loop_task: asyncio.Task | None = None
        self._stopped = False

    # --------------- Lifecycle ---------------

    def start(self) -> None:
        """Start the background scheduling loop."""
        self._stopped = False
        self._loop_task = asyncio.create_task(self._scheduling_loop())
        logger.info("Scheduler started")

    async def stop(self) -> None:
        """Stop the scheduling loop gracefully."""
        self._stopped = True
        self._schedule_event.set()
        if self._loop_task is not None:
            self._loop_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._loop_task
        logger.info("Scheduler stopped")

    def set_executor(self, executor: Callable) -> None:
        """Set the async callback that executes a task.

        The executor receives (task_id, entry_dict) and should:
        1. Update task status in DB
        2. Stage input files, run module, collect output
        3. Handle errors and retries
        """
        self._executor = executor

    # --------------- Queue operations ---------------

    def enqueue(
        self,
        task_id: uuid.UUID,
        module_name: str,
        *,
        sample_set_id: uuid.UUID,
        input_subset_id: uuid.UUID,
        output_subset_name: str,
        user_id: uuid.UUID,
        params: dict[str, Any] | None = None,
        overwrite: bool = False,
    ) -> int:
        """Add a task to the appropriate module queue.

        Returns the queue position (0-based index within the module queue).
        """
        entry = {
            "task_id": task_id,
            "module_name": module_name,
            "sample_set_id": sample_set_id,
            "input_subset_id": input_subset_id,
            "output_subset_name": output_subset_name,
            "user_id": user_id,
            "params": params or {},
            "overwrite": overwrite,
            "enqueued_at": datetime.now(UTC),
        }
        self._entries[task_id] = entry
        self._queues[module_name].append(task_id)
        position = len(self._queues[module_name]) - 1

        logger.info(
            "Task %s enqueued for module %s (position=%d)",
            task_id,
            module_name,
            position,
        )
        self._schedule_event.set()
        return position

    def cancel(self, task_id: uuid.UUID) -> bool:
        """Remove a queued task. Returns True if it was found and removed."""
        entry = self._entries.pop(task_id, None)
        if entry is None:
            return False

        module_name = entry["module_name"]
        queue = self._queues.get(module_name, [])
        try:
            queue.remove(task_id)
        except ValueError:
            return False

        logger.info("Task %s cancelled", task_id)
        return True

    @property
    def is_running(self) -> bool:
        return self._running_task_id is not None

    def queue_lengths(self) -> dict[str, int]:
        """Return {module_name: queue_length} for all non-empty queues."""
        return {name: len(q) for name, q in self._queues.items() if q}

    def queue_wait_times_ms(self) -> dict[str, float]:
        """Return {module_name: head_wait_time_ms} for priority calculation."""
        now = datetime.now(UTC)
        result = {}
        for name, queue in self._queues.items():
            if queue:
                entry = self._entries.get(queue[0])
                if entry:
                    delta = (now - entry["enqueued_at"]).total_seconds() * 1000
                    result[name] = delta
        return result

    # --------------- Priority calculation ---------------

    def calculate_priority(
        self,
        module_name: str,
        wait_ms: float,
        loaded_modules: set[str],
    ) -> float:
        """P_i(t) = W_i(t) + B·I(M_i ∈ L)

        W_i(t): wait time in ms for the queue head
        B: affinity bonus
        I(M_i ∈ L): 1 if module is currently loaded, 0 otherwise
        """
        affinity = self.affinity_bonus_ms if module_name in loaded_modules else 0
        return wait_ms + affinity

    def select_next(self, loaded_modules: set[str]) -> uuid.UUID | None:
        """Select the highest-priority queue-head task."""
        wait_times = self.queue_wait_times_ms()
        if not wait_times:
            return None

        best_module = max(
            wait_times,
            key=lambda name: self.calculate_priority(
                name, wait_times[name], loaded_modules
            ),
        )

        queue = self._queues.get(best_module, [])
        if not queue:
            return None
        return queue[0]

    # --------------- Scheduling loop ---------------

    async def _scheduling_loop(self) -> None:
        """Background loop that processes tasks one at a time."""
        while not self._stopped:
            self._schedule_event.clear()

            # Try to pick and execute a task
            if not self.is_running:
                await self._try_execute_next()

            # Wait for next trigger
            await self._schedule_event.wait()

    async def _try_execute_next(self) -> None:
        """Pick the next task and execute it if an executor is set."""
        if self._executor is None:
            return

        # We need loaded_modules from ResourceManager — it's injected via the executor
        # For selection, we import state lazily to avoid circular imports
        from app.pipeline.state import resource_manager

        task_id = self.select_next(resource_manager.loaded_module_names)
        if task_id is None:
            return

        entry = self._entries.get(task_id)
        if entry is None:
            return

        # Remove from queue head
        module_name = entry["module_name"]
        queue = self._queues.get(module_name, [])
        if queue and queue[0] == task_id:
            queue.pop(0)

        self._running_task_id = task_id

        try:
            await self._executor(task_id, entry)
        except Exception:
            logger.exception("Task %s executor failed with unhandled error", task_id)
        finally:
            self._entries.pop(task_id, None)
            self._running_task_id = None
            # Trigger next scheduling after task completes
            self._schedule_event.set()


async def _notify_task_status(
    user_id: uuid.UUID,
    task_id: uuid.UUID,
    status: str,
    *,
    module_name: str = "",
    sample_set_id: uuid.UUID | None = None,
) -> None:
    """Push task status update via WebSocket (best-effort)."""
    try:
        from app.api.routes.ws import manager

        await manager.send_to_user(
            user_id,
            {
                "type": "task_status_update",
                "data": {
                    "task_id": str(task_id),
                    "status": status,
                    "module_name": module_name,
                    "sample_set_id": str(sample_set_id) if sample_set_id else "",
                },
            },
        )
    except Exception:
        logger.debug("WS notification failed for task %s", task_id)


async def execute_task(
    task_id: uuid.UUID,
    entry: dict[str, Any],
) -> None:
    """Default task executor — stages files, runs module, collects output.

    This function is called by the scheduler for each task. It:
    1. Updates task status to 'loading'
    2. Loads the module via ResourceManager
    3. Stages input files from storage to a temp directory
    4. Calls module.run(RunInput)
    5. Collects output files, saves to storage, creates DB records
    6. Updates task status to 'completed' or 'failed'
    """
    from app.core.config import settings
    from app.models.image import Image
    from app.models.subset import Subset
    from app.models.task import Task, TaskStatus
    from app.pipeline.state import registry, resource_manager, scheduler
    from app.storage import get_storage

    # Helper to get a fresh session
    async def _get_session():
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlmodel.ext.asyncio.session import AsyncSession

        engine = create_async_engine(settings.database_url, echo=False)
        async with AsyncSession(engine) as session:
            yield session
        await engine.dispose()

    from sqlmodel.ext.asyncio.session import AsyncSession

    from app.db import engine as app_engine

    module_name = entry["module_name"]
    sample_set_id = entry["sample_set_id"]
    input_subset_id = entry["input_subset_id"]
    output_subset_name = entry["output_subset_name"]
    user_id = entry["user_id"]
    params = entry["params"]
    overwrite = entry.get("overwrite", False)

    storage = get_storage()
    work_dir = None

    try:
        # --- Update status to loading ---
        async with AsyncSession(app_engine) as session:
            from sqlmodel import select

            result = await session.exec(select(Task).where(Task.id == task_id))
            task = result.one()
            task.status = TaskStatus.loading
            task.started_at = datetime.now(UTC)
            session.add(task)
            await session.commit()

        await _notify_task_status(
            user_id,
            task_id,
            "loading",
            module_name=module_name,
            sample_set_id=sample_set_id,
        )

        # --- Load module ---
        mod = registry.get(module_name)
        if mod is None:
            raise RuntimeError(f"Module '{module_name}' not found in registry")

        wait_times = scheduler.queue_wait_times_ms()
        await resource_manager.load_module(mod, queue_wait_times=wait_times)

        # --- Update status to running ---
        async with AsyncSession(app_engine) as session:
            from sqlmodel import select

            result = await session.exec(select(Task).where(Task.id == task_id))
            task = result.one()
            task.status = TaskStatus.running
            session.add(task)
            await session.commit()

        await _notify_task_status(
            user_id,
            task_id,
            "running",
            module_name=module_name,
            sample_set_id=sample_set_id,
        )

        # --- Stage input files ---
        work_dir = Path(tempfile.mkdtemp(prefix="medseg_task_"))
        input_dir = work_dir / "input"
        output_dir = work_dir / "output"
        input_dir.mkdir()
        output_dir.mkdir()

        # Fetch input images from DB
        async with AsyncSession(app_engine) as session:
            from sqlmodel import select

            subset_result = await session.exec(
                select(Subset).where(Subset.id == input_subset_id)
            )
            input_subset = subset_result.one()
            result = await session.exec(
                select(Image).where(Image.subset_id == input_subset_id)
            )
            images = list(result.all())

        # Download images from storage to input_dir
        input_image_infos = []
        for img in images:
            data = await storage.load(img.storage_path)
            local_path = input_dir / img.filename
            local_path.write_bytes(data)
            input_image_infos.append(
                InputImageInfo(
                    id=img.id,
                    filename=img.filename,
                    format=img.format,
                    metadata=img.metadata_ or {},
                )
            )

        # Build sample set metadata
        async with AsyncSession(app_engine) as session:
            from app.services.sample_set import get_sample_set
            from app.services.subset import list_subsets

            ss = await get_sample_set(session, sample_set_id)
            subsets = await list_subsets(session, sample_set_id)
            sample_set_meta = {
                "sample_set_id": str(sample_set_id),
                "sample_set_name": ss.name,
                "subset_ids": [str(s.id) for s in subsets],
            }

        # --- Run module ---
        run_input = RunInput(
            work_dir=work_dir,
            input_dir=input_dir,
            output_dir=output_dir,
            images=input_image_infos,
            params=params,
            sample_set_meta=sample_set_meta,
            input_subset_id=input_subset.id,
            input_subset_name=input_subset.name,
            input_subset_type=input_subset.type,
            input_subset_metadata=input_subset.metadata_ or {},
        )
        run_output = await mod.run(run_input)

        # --- Collect output ---
        async with AsyncSession(app_engine) as session:
            # If overwrite is enabled, delete existing subset with same name
            if overwrite:
                from sqlmodel import select as sel

                result = await session.exec(
                    sel(Subset).where(
                        Subset.sample_set_id == sample_set_id,
                        Subset.name == output_subset_name,
                    )
                )
                existing = result.first()
                if existing is not None:
                    await session.delete(existing)
                    await session.flush()

            # Create output subset
            output_subset = Subset(
                sample_set_id=sample_set_id,
                name=output_subset_name,
                type=run_output.type,
                metadata_=run_output.metadata,
                source_module=module_name,
                source_subset_id=input_subset_id,
                source_params=params,
            )
            session.add(output_subset)
            try:
                await session.flush()
            except Exception as flush_exc:
                # Check for unique constraint violation (subset name conflict)
                if (
                    "UNIQUE constraint failed" in str(flush_exc)
                    or "IntegrityError" in type(flush_exc).__name__
                ):
                    raise RuntimeError(
                        f"Output subset name '{output_subset_name}' already exists. "
                        "Use overwrite=true or choose a different name."
                    ) from flush_exc
                raise

            # Save output images
            for out_img in run_output.images:
                out_file = output_dir / out_img.filename
                if not out_file.exists():
                    continue
                data = out_file.read_bytes()
                ext = ""
                if "." in out_img.filename:
                    ext = out_img.filename[out_img.filename.rfind(".") :]
                image = Image(
                    subset_id=output_subset.id,
                    filename=out_img.filename,
                    format=out_img.format,
                    metadata_=out_img.metadata,
                    storage_path="",
                    source_image_id=out_img.source_image_id,
                )
                storage_path = (
                    f"{user_id}/{sample_set_id}/{output_subset.id}/{image.id}{ext}"
                )
                await storage.save(storage_path, data)
                image.storage_path = storage_path
                session.add(image)

            await session.commit()

        # --- Mark completed ---
        async with AsyncSession(app_engine) as session:
            from sqlmodel import select

            result = await session.exec(select(Task).where(Task.id == task_id))
            task = result.one()
            task.status = TaskStatus.completed
            task.completed_at = datetime.now(UTC)
            session.add(task)
            await session.commit()

        logger.info("Task %s completed successfully", task_id)
        await _notify_task_status(
            user_id,
            task_id,
            "completed",
            module_name=module_name,
            sample_set_id=sample_set_id,
        )

    except Exception as exc:
        logger.exception("Task %s failed: %s", task_id, exc)

        # Check retry
        async with AsyncSession(app_engine) as session:
            from sqlmodel import select

            result = await session.exec(select(Task).where(Task.id == task_id))
            task = result.one()

            if task.retry_count < settings.max_retry_count:
                # Re-enqueue for retry
                task.retry_count += 1
                task.status = TaskStatus.queued
                task.error_message = str(exc)
                session.add(task)
                await session.commit()

                scheduler.enqueue(
                    task_id=task_id,
                    module_name=module_name,
                    sample_set_id=sample_set_id,
                    input_subset_id=input_subset_id,
                    output_subset_name=output_subset_name,
                    user_id=user_id,
                    params=params,
                    overwrite=entry.get("overwrite", False),
                )
                logger.info(
                    "Task %s re-enqueued (retry %d)",
                    task_id,
                    task.retry_count,
                )
                await _notify_task_status(
                    user_id,
                    task_id,
                    "queued",
                    module_name=module_name,
                    sample_set_id=sample_set_id,
                )
            else:
                task.status = TaskStatus.failed
                task.error_message = str(exc)
                task.completed_at = datetime.now(UTC)
                session.add(task)
                await session.commit()
                await _notify_task_status(
                    user_id,
                    task_id,
                    "failed",
                    module_name=module_name,
                    sample_set_id=sample_set_id,
                )

    finally:
        # Cleanup temp directory
        if work_dir and work_dir.exists():
            shutil.rmtree(work_dir, ignore_errors=True)
