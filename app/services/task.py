"""Task service — business logic for task lifecycle management."""

import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.exceptions import ModuleNotAvailable, TaskNotCancellable, TaskNotFound
from app.models.task import Task, TaskStatus


async def submit_task(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    module_name: str,
    sample_set_id: uuid.UUID,
    input_subset_id: uuid.UUID,
    output_subset_name: str,
    params: dict | None = None,
) -> Task:
    """Create a task record and enqueue it in the scheduler."""
    from app.pipeline.state import registry, scheduler

    # Validate module exists and is enabled
    mod = registry.get(module_name)
    if mod is None or not registry.is_enabled(module_name):
        raise ModuleNotAvailable()

    task = Task(
        user_id=user_id,
        module_name=module_name,
        sample_set_id=sample_set_id,
        input_subset_id=input_subset_id,
        output_subset_name=output_subset_name,
        params=params,
        status=TaskStatus.queued,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)

    scheduler.enqueue(
        task_id=task.id,
        module_name=module_name,
        sample_set_id=sample_set_id,
        input_subset_id=input_subset_id,
        output_subset_name=output_subset_name,
        user_id=user_id,
        params=params,
    )

    return task


async def get_task(session: AsyncSession, task_id: uuid.UUID) -> Task:
    result = await session.exec(select(Task).where(Task.id == task_id))
    task = result.first()
    if task is None:
        raise TaskNotFound()
    return task


async def list_user_tasks(session: AsyncSession, user_id: uuid.UUID) -> list[Task]:
    result = await session.exec(
        select(Task).where(Task.user_id == user_id).order_by(Task.created_at.desc())
    )
    return list(result.all())


async def list_all_tasks(session: AsyncSession) -> list[Task]:
    result = await session.exec(select(Task).order_by(Task.created_at.desc()))
    return list(result.all())


async def cancel_task(session: AsyncSession, task: Task) -> Task:
    """Cancel a queued task. Only queued tasks can be cancelled."""
    if task.status != TaskStatus.queued:
        raise TaskNotCancellable()

    from app.pipeline.state import scheduler

    scheduler.cancel(task.id)

    task.status = TaskStatus.cancelled
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


async def submit_batch_tasks(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    module_name: str,
    sample_set_id: uuid.UUID,
    input_subset_ids: list[uuid.UUID],
    output_subset_name_template: str,
    params: dict | None = None,
) -> tuple[list[dict], list[dict]]:
    """Submit one task per input subset. Returns (task_dicts, errors).

    task_dicts are plain dicts (serialized from Task) to avoid lazy-loading
    issues outside the session scope.
    """
    from app.services.subset import get_subset

    tasks: list[dict] = []
    errors: list[dict] = []

    for subset_id in input_subset_ids:
        try:
            subset = await get_subset(session, subset_id)
            output_name = output_subset_name_template.format(
                input_name=subset.name,
                module=module_name,
            )
            task = await submit_task(
                session,
                user_id=user_id,
                module_name=module_name,
                sample_set_id=sample_set_id,
                input_subset_id=subset_id,
                output_subset_name=output_name,
                params=params,
            )
            # Convert to dict while session is still active
            tasks.append({
                "id": task.id,
                "user_id": task.user_id,
                "module_name": task.module_name,
                "sample_set_id": task.sample_set_id,
                "input_subset_id": task.input_subset_id,
                "output_subset_name": task.output_subset_name,
                "params": task.params,
                "status": task.status,
                "error_message": task.error_message,
                "retry_count": task.retry_count,
                "created_at": task.created_at,
                "started_at": task.started_at,
                "completed_at": task.completed_at,
            })
        except Exception as e:
            error_code = getattr(e, "error_code", 500000)
            message = getattr(e, "message_key", str(e))
            errors.append(
                {
                    "input_subset_id": subset_id,
                    "error_code": error_code,
                    "message": message,
                }
            )

    return tasks, errors
