import uuid

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_user, require_admin
from app.core.exceptions import AppError
from app.db import get_session
from app.models.user import User
from app.pipeline.state import registry, resource_manager
from app.schemas.pipeline import (
    AwarenessResponse,
    ModuleInfoRead,
    ResourceStatusRead,
)
from app.schemas.task import (
    BatchTaskCreate,
    BatchTaskError,
    BatchTaskResult,
    TaskCreate,
    TaskRead,
)
from app.services.pipeline import check_awareness
from app.services.sample_set import get_sample_set
from app.services.task import submit_batch_tasks, submit_task

router = APIRouter(prefix="/pipelines", tags=["pipelines"])


class ModuleNotFound(AppError):
    def __init__(self):
        super().__init__(
            error_code=405001,
            message_key="pipeline.moduleNotFound",
            status_code=404,
        )


# --------------- Module list ---------------


@router.get("/modules", response_model=list[ModuleInfoRead])
async def list_modules(
    user: User = Depends(get_current_user),
):
    result = []
    for info, enabled in registry.list_all():
        result.append(
            ModuleInfoRead(
                name=info.name,
                version=info.version,
                description=info.description,
                suggestion_priority=info.suggestion_priority,
                max_ram_mb=info.max_ram_mb,
                max_vram_mb=info.max_vram_mb,
                params_schema=info.params_schema,
                enabled=enabled,
                loaded=resource_manager.is_loaded(info.name),
            )
        )
    return result


@router.get("/modules/{name}", response_model=ModuleInfoRead)
async def get_module(
    name: str,
    user: User = Depends(get_current_user),
):
    mod = registry.get(name)
    if mod is None:
        raise ModuleNotFound()
    info = mod.module_info()
    return ModuleInfoRead(
        name=info.name,
        version=info.version,
        description=info.description,
        suggestion_priority=info.suggestion_priority,
        max_ram_mb=info.max_ram_mb,
        max_vram_mb=info.max_vram_mb,
        params_schema=info.params_schema,
        enabled=registry.is_enabled(name),
        loaded=resource_manager.is_loaded(name),
    )


# --------------- Enable / Disable (admin) ---------------


@router.put("/modules/{name}/enable", status_code=200)
async def enable_module(
    name: str,
    _admin: User = Depends(require_admin),
):
    if not registry.enable(name):
        raise ModuleNotFound()
    return {"name": name, "enabled": True}


@router.put("/modules/{name}/disable", status_code=200)
async def disable_module(
    name: str,
    _admin: User = Depends(require_admin),
):
    if not registry.disable(name):
        raise ModuleNotFound()
    return {"name": name, "enabled": False}


# --------------- Load / Unload (admin) ---------------


@router.post("/modules/{name}/load", status_code=200)
async def load_module(
    name: str,
    _admin: User = Depends(require_admin),
):
    mod = registry.get(name)
    if mod is None:
        raise ModuleNotFound()
    await resource_manager.load_module(mod)
    return {"name": name, "loaded": True}


@router.post("/modules/{name}/unload", status_code=200)
async def unload_module(
    name: str,
    _admin: User = Depends(require_admin),
):
    mod = registry.get(name)
    if mod is None:
        raise ModuleNotFound()
    await resource_manager.unload_module(name)
    return {"name": name, "loaded": False}


# --------------- Resources (admin) ---------------


@router.get("/resources", response_model=ResourceStatusRead)
async def get_resources(
    _admin: User = Depends(require_admin),
):
    return resource_manager.status()


# --------------- Pipeline awareness ---------------


@router.get(
    "/awareness/{sample_set_id}",
    response_model=AwarenessResponse,
)
async def get_awareness(
    sample_set_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await check_awareness(session, sample_set_id, user)
    return result


# --------------- Run (submit task) ---------------


@router.post("/run", response_model=TaskRead, status_code=201)
async def run_pipeline(
    body: TaskCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Submit a processing task to the scheduler."""
    # Verify user owns the sample set
    from app.core.exceptions import PermissionDenied
    from app.models.user import UserRole

    ss = await get_sample_set(session, body.sample_set_id)
    if ss.owner_id != user.id and user.role != UserRole.admin:
        raise PermissionDenied()

    task = await submit_task(
        session,
        user_id=user.id,
        module_name=body.module_name,
        sample_set_id=body.sample_set_id,
        input_subset_id=body.input_subset_id,
        output_subset_name=body.output_subset_name,
        params=body.params,
        overwrite=body.overwrite,
    )
    return task


# --------------- Batch Run (submit multiple tasks) ---------------


@router.post("/batch-run", response_model=BatchTaskResult, status_code=201)
async def batch_run_pipeline(
    body: BatchTaskCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Submit one processing task per input subset."""
    from app.core.exceptions import PermissionDenied
    from app.models.user import UserRole

    ss = await get_sample_set(session, body.sample_set_id)
    if ss.owner_id != user.id and user.role != UserRole.admin:
        raise PermissionDenied()

    tasks, errors = await submit_batch_tasks(
        session,
        user_id=user.id,
        module_name=body.module_name,
        sample_set_id=body.sample_set_id,
        input_subset_ids=body.input_subset_ids,
        output_subset_name_template=body.output_subset_name_template,
        params=body.params,
        overwrite=body.overwrite,
    )
    return BatchTaskResult(
        tasks=[TaskRead(**t) for t in tasks],
        errors=[BatchTaskError(**e) for e in errors],
    )
