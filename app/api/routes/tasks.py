import uuid

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_user, require_admin
from app.core.exceptions import PermissionDenied
from app.db import get_session
from app.models.user import User, UserRole
from app.schemas.task import TaskRead
from app.services.task import cancel_task, get_task, list_all_tasks, list_user_tasks

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskRead])
async def list_my_tasks(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List current user's tasks."""
    return await list_user_tasks(session, user.id)


@router.get("/all", response_model=list[TaskRead])
async def list_all(
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """List all tasks (admin only)."""
    return await list_all_tasks(session)


@router.get("/{task_id}", response_model=TaskRead)
async def get_task_detail(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get task details."""
    task = await get_task(session, task_id)
    if task.user_id != user.id and user.role != UserRole.admin:
        raise PermissionDenied()
    return task


@router.delete("/{task_id}", response_model=TaskRead)
async def cancel_task_endpoint(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Cancel a queued task."""
    task = await get_task(session, task_id)
    if task.user_id != user.id and user.role != UserRole.admin:
        raise PermissionDenied()
    return await cancel_task(session, task)
