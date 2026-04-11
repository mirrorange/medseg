import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.exceptions import PermissionDenied
from app.models.image import Image
from app.models.subset import Subset
from app.models.user import User, UserRole
from app.pipeline.interface import AwarenessInput, SubsetImageSummary, SubsetInfo
from app.pipeline.state import registry
from app.services.sample_set import get_sample_set


async def check_awareness(
    session: AsyncSession,
    sample_set_id: uuid.UUID,
    user: User,
) -> dict:
    """Build awareness input with image-level metadata, query all enabled modules,
    and return a three-tier response (primary / suggested / available).
    """
    ss = await get_sample_set(session, sample_set_id)
    if ss.owner_id != user.id and user.role != UserRole.admin:
        raise PermissionDenied()

    # Load subsets
    result = await session.exec(
        select(Subset).where(Subset.sample_set_id == sample_set_id)
    )
    subsets = list(result.all())

    # Load images per subset
    subset_infos: list[SubsetInfo] = []
    for subset in subsets:
        img_result = await session.exec(
            select(Image).where(Image.subset_id == subset.id)
        )
        images = list(img_result.all())
        subset_infos.append(
            SubsetInfo(
                id=subset.id,
                name=subset.name,
                type=subset.type,
                metadata=subset.metadata_,
                images=[
                    SubsetImageSummary(
                        id=img.id,
                        filename=img.filename,
                        format=img.format,
                        metadata=img.metadata_,
                    )
                    for img in images
                ],
            )
        )

    awareness_input = AwarenessInput(
        sample_set_id=sample_set_id,
        sample_set_name=ss.name,
        subsets=subset_infos,
    )

    # Query all enabled modules
    module_results: list[dict] = []
    for mod in registry.list_enabled():
        info = mod.module_info()
        avail = await mod.check_availability(awareness_input)
        # Skip modules where both lists are empty (unavailable)
        if not avail.available_subset_ids and not avail.recommended_subset_ids:
            continue
        module_results.append(
            {
                "module_name": info.name,
                "suggestion_priority": info.suggestion_priority,
                "available_subset_ids": [
                    str(sid) for sid in avail.available_subset_ids
                ],
                "recommended_subset_ids": [
                    str(sid) for sid in avail.recommended_subset_ids
                ],
                "reason": avail.reason,
            }
        )

    # Sort by suggestion_priority (lower = higher priority)
    module_results.sort(key=lambda r: r["suggestion_priority"])

    # Build three-tier response
    recommended_modules = [r for r in module_results if r["recommended_subset_ids"]]
    available_only_modules = [
        r for r in module_results if not r["recommended_subset_ids"]
    ]

    def _to_item(r: dict) -> dict:
        return {
            "module_name": r["module_name"],
            "available_subset_ids": r["available_subset_ids"],
            "recommended_subset_ids": r["recommended_subset_ids"],
            "reason": r["reason"],
        }

    primary = _to_item(recommended_modules[0]) if recommended_modules else None
    suggested = [_to_item(r) for r in recommended_modules[1:]]
    available = [_to_item(r) for r in available_only_modules]

    return {
        "primary": primary,
        "suggested": suggested,
        "available": available,
    }
