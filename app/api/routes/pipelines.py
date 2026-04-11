import uuid

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_user, require_admin
from app.core.exceptions import AppError, PermissionDenied
from app.db import get_session
from app.models.user import User, UserRole
from app.pipeline.state import registry, resource_manager
from app.schemas.pipeline import (
    ModuleAvailabilityRead,
    ModuleInfoRead,
    ResourceStatusRead,
)
from app.schemas.task import TaskCreate, TaskRead
from app.services.sample_set import get_sample_set
from app.services.subset import list_subsets
from app.services.task import submit_task

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
    response_model=list[ModuleAvailabilityRead],
)
async def check_awareness(
    sample_set_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    ss = await get_sample_set(session, sample_set_id)
    if ss.owner_id != user.id and user.role != UserRole.admin:
        raise PermissionDenied()

    # Build sample set metadata for modules
    subsets = await list_subsets(session, sample_set_id)
    meta = {
        "sample_set_id": str(sample_set_id),
        "sample_set_name": ss.name,
        "subset_ids": [str(s.id) for s in subsets],
        "subsets": [
            {
                "id": str(s.id),
                "name": s.name,
                "type": s.type,
                "metadata": s.metadata_,
            }
            for s in subsets
        ],
    }

    results = []
    for mod in registry.list_enabled():
        info = mod.module_info()
        avail = await mod.check_availability(meta)
        results.append(
            ModuleAvailabilityRead(
                module_name=info.name,
                status=avail.status,
                target_subset_ids=[str(i) for i in avail.target_subset_ids],
                reason=avail.reason,
            )
        )
    # Sort by suggestion_priority
    results.sort(
        key=lambda r: next(
            (
                m.module_info().suggestion_priority
                for m in registry.list_enabled()
                if m.module_info().name == r.module_name
            ),
            999,
        )
    )
    return results


# --------------- Run (submit task) ---------------


@router.post("/run", response_model=TaskRead, status_code=201)
async def run_pipeline(
    body: TaskCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Submit a processing task to the scheduler."""
    # Verify user owns the sample set
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
    )
    return task
