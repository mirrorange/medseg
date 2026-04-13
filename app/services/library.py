import uuid
from datetime import UTC, datetime

from sqlmodel import col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.exceptions import AppError
from app.models.folder import Folder
from app.models.sample_set import SampleSet
from app.models.share import Share
from app.models.user import User
from app.schemas.library import (
    BatchMoveItem,
    BreadcrumbItem,
    FolderTreeNode,
    LibraryContents,
    LibraryItem,
    LibraryTree,
    SharedSampleSetRead,
    TreeSampleSet,
)


class FolderNotFound(AppError):
    def __init__(self):
        super().__init__(
            error_code=403001,
            message_key="library.folderNotFound",
            status_code=404,
        )


class FolderNotEmpty(AppError):
    def __init__(self):
        super().__init__(
            error_code=403002,
            message_key="library.folderNotEmpty",
            status_code=409,
        )


class CircularFolder(AppError):
    def __init__(self):
        super().__init__(
            error_code=403003,
            message_key="library.circularFolder",
            status_code=400,
        )


class AlreadyShared(AppError):
    def __init__(self):
        super().__init__(
            error_code=403004,
            message_key="library.alreadyShared",
            status_code=409,
        )


class NotShared(AppError):
    def __init__(self):
        super().__init__(
            error_code=403005,
            message_key="library.notShared",
            status_code=404,
        )


class DuplicateName(AppError):
    def __init__(self):
        super().__init__(
            error_code=403006,
            message_key="library.duplicateName",
            status_code=409,
        )


# --------------- Folder CRUD ---------------


async def create_folder(
    session: AsyncSession,
    owner_id: uuid.UUID,
    name: str,
    parent_id: uuid.UUID | None = None,
) -> Folder:
    if parent_id is not None:
        await _get_owned_folder(session, parent_id, owner_id)

    await _check_name_unique(session, parent_id, owner_id, name)

    folder = Folder(name=name, owner_id=owner_id, parent_id=parent_id)
    session.add(folder)
    await session.commit()
    await session.refresh(folder)
    return folder


async def get_folder(
    session: AsyncSession,
    folder_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> Folder:
    return await _get_owned_folder(session, folder_id, owner_id)


async def update_folder(
    session: AsyncSession,
    folder: Folder,
    name: str | None = None,
    parent_id: uuid.UUID | None = None,
) -> Folder:
    new_name = name if name is not None else folder.name
    new_parent = parent_id if parent_id is not None else folder.parent_id

    if name is not None or parent_id is not None:
        await _check_name_unique(
            session, new_parent, folder.owner_id, new_name,
            exclude_folder_id=folder.id,
        )

    if name is not None:
        folder.name = name

    if parent_id is not None:
        if parent_id == folder.id:
            raise CircularFolder()
        # Check new parent exists and belongs to same owner
        await _get_owned_folder(session, parent_id, folder.owner_id)
        # Walk up from new parent to ensure we don't create a cycle
        await _check_no_cycle(session, parent_id, folder.id)
        folder.parent_id = parent_id

    folder.updated_at = datetime.now(UTC)
    session.add(folder)
    await session.commit()
    await session.refresh(folder)
    return folder


async def delete_folder(
    session: AsyncSession,
    folder: Folder,
    *,
    recursive: bool = False,
) -> None:
    # Check for children and sample sets
    children = await session.exec(select(Folder).where(Folder.parent_id == folder.id))
    child_list = list(children.all())

    sample_sets = await session.exec(
        select(SampleSet).where(SampleSet.folder_id == folder.id)
    )
    ss_list = list(sample_sets.all())

    if not recursive and (child_list or ss_list):
        raise FolderNotEmpty()

    if recursive:
        # Delete children recursively
        for child in child_list:
            await delete_folder(session, child, recursive=True)
        # Move sample sets to parent or delete them
        for ss in ss_list:
            ss.folder_id = folder.parent_id
            session.add(ss)

    await session.delete(folder)
    await session.commit()


# --------------- Library tree ---------------


async def get_library_tree(
    session: AsyncSession,
    owner_id: uuid.UUID,
) -> LibraryTree:
    # Fetch all folders for user
    result = await session.exec(select(Folder).where(Folder.owner_id == owner_id))
    all_folders = list(result.all())

    # Fetch all sample sets for user
    result = await session.exec(select(SampleSet).where(SampleSet.owner_id == owner_id))
    all_sample_sets = list(result.all())

    # Build folder lookup
    folder_map: dict[uuid.UUID, FolderTreeNode] = {}
    for f in all_folders:
        folder_map[f.id] = FolderTreeNode(
            id=f.id,
            name=f.name,
            parent_id=f.parent_id,
        )

    # Build sample set lookup by folder_id
    ss_by_folder: dict[uuid.UUID | None, list[TreeSampleSet]] = {}
    for ss in all_sample_sets:
        tree_ss = TreeSampleSet(
            id=ss.id,
            name=ss.name,
            description=ss.description,
            created_at=ss.created_at,
            updated_at=ss.updated_at,
        )
        ss_by_folder.setdefault(ss.folder_id, []).append(tree_ss)

    # Assign sample sets to folders
    for folder_id, node in folder_map.items():
        node.sample_sets = ss_by_folder.get(folder_id, [])

    # Build tree structure
    root_folders: list[FolderTreeNode] = []
    for node in folder_map.values():
        if node.parent_id and node.parent_id in folder_map:
            folder_map[node.parent_id].children.append(node)
        else:
            root_folders.append(node)

    return LibraryTree(
        folders=root_folders,
        root_sample_sets=ss_by_folder.get(None, []),
    )


# --------------- Library contents (flat view) ---------------


async def get_library_contents(
    session: AsyncSession,
    owner_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    sort_by: str = "name",
    sort_order: str = "asc",
) -> LibraryContents:
    if folder_id is not None:
        await _get_owned_folder(session, folder_id, owner_id)

    breadcrumb = await get_folder_breadcrumb(session, folder_id, owner_id)

    # Fetch folders in this directory
    folder_query = select(Folder).where(
        Folder.owner_id == owner_id,
    )
    if folder_id is None:
        folder_query = folder_query.where(col(Folder.parent_id).is_(None))
    else:
        folder_query = folder_query.where(Folder.parent_id == folder_id)

    folders = list((await session.exec(folder_query)).all())

    # Count children for each folder
    folder_child_counts: dict[uuid.UUID, int] = {}
    for f in folders:
        sub_folders = await session.exec(
            select(func.count()).select_from(Folder).where(Folder.parent_id == f.id)
        )
        sub_ss = await session.exec(
            select(func.count()).select_from(SampleSet).where(SampleSet.folder_id == f.id)
        )
        folder_child_counts[f.id] = (sub_folders.one() or 0) + (sub_ss.one() or 0)

    # Fetch sample sets in this directory
    ss_query = select(SampleSet).where(
        SampleSet.owner_id == owner_id,
    )
    if folder_id is None:
        ss_query = ss_query.where(col(SampleSet.folder_id).is_(None))
    else:
        ss_query = ss_query.where(SampleSet.folder_id == folder_id)

    sample_sets = list((await session.exec(ss_query)).all())

    # Build unified items
    items: list[LibraryItem] = []
    for f in folders:
        items.append(LibraryItem(
            id=f.id,
            name=f.name,
            type="folder",
            child_count=folder_child_counts.get(f.id, 0),
            created_at=f.created_at,
            updated_at=f.updated_at,
        ))
    for ss in sample_sets:
        items.append(LibraryItem(
            id=ss.id,
            name=ss.name,
            type="sample_set",
            description=ss.description,
            created_at=ss.created_at,
            updated_at=ss.updated_at,
        ))

    # Sort: folders first, then sample_sets; within each group sort by field
    sort_key = sort_by if sort_by in ("name", "created_at", "updated_at") else "name"
    reverse = sort_order == "desc"

    def item_sort_key(item: LibraryItem):
        type_order = 0 if item.type == "folder" else 1
        val = getattr(item, sort_key)
        if isinstance(val, str):
            val = val.lower()
        return (type_order, val)

    items.sort(key=item_sort_key, reverse=reverse)
    # When reversed, we still want folders before sample_sets
    if reverse:
        folders_items = [i for i in items if i.type == "folder"]
        ss_items = [i for i in items if i.type == "sample_set"]
        items = folders_items + ss_items

    return LibraryContents(
        folder_id=folder_id,
        breadcrumb=breadcrumb,
        items=items,
    )


async def get_folder_breadcrumb(
    session: AsyncSession,
    folder_id: uuid.UUID | None,
    owner_id: uuid.UUID,
) -> list[BreadcrumbItem]:
    if folder_id is None:
        return []

    # Walk up from folder_id to root
    ancestors: list[BreadcrumbItem] = []
    current_id: uuid.UUID | None = folder_id
    visited: set[uuid.UUID] = set()
    for _ in range(50):  # max depth guard
        if current_id is None:
            break
        if current_id in visited:
            break
        visited.add(current_id)
        result = await session.exec(
            select(Folder).where(Folder.id == current_id, Folder.owner_id == owner_id)
        )
        folder = result.first()
        if folder is None:
            raise FolderNotFound()
        ancestors.append(BreadcrumbItem(id=folder.id, name=folder.name))
        current_id = folder.parent_id

    ancestors.reverse()
    return ancestors


# --------------- Batch move ---------------


async def batch_move_items(
    session: AsyncSession,
    owner_id: uuid.UUID,
    target_folder_id: uuid.UUID | None,
    items: list[BatchMoveItem],
) -> None:
    # Validate target folder
    if target_folder_id is not None:
        await _get_owned_folder(session, target_folder_id, owner_id)

    for item in items:
        item_type, item_id = item.type, item.id
        if item_type == "folder":
            folder = await _get_owned_folder(session, item_id, owner_id)
            # Skip if already in target
            if folder.parent_id == target_folder_id:
                continue
            # Cycle detection
            if target_folder_id is not None:
                if target_folder_id == item_id:
                    raise CircularFolder()
                await _check_no_cycle(session, target_folder_id, item_id)
            # Uniqueness check
            await _check_name_unique(
                session, target_folder_id, owner_id, folder.name,
                exclude_folder_id=folder.id,
            )
            folder.parent_id = target_folder_id
            folder.updated_at = datetime.now(UTC)
            session.add(folder)

        elif item_type == "sample_set":
            result = await session.exec(
                select(SampleSet).where(
                    SampleSet.id == item_id, SampleSet.owner_id == owner_id,
                )
            )
            ss = result.first()
            if ss is None:
                from app.services.sample_set import SampleSetNotFound
                raise SampleSetNotFound()
            # Skip if already in target
            if ss.folder_id == target_folder_id:
                continue
            # Uniqueness check
            await _check_name_unique(
                session, target_folder_id, owner_id, ss.name,
                exclude_sample_set_id=ss.id,
            )
            ss.folder_id = target_folder_id
            ss.updated_at = datetime.now(UTC)
            session.add(ss)

    await session.commit()


# --------------- Share ---------------


async def share_sample_set(
    session: AsyncSession,
    sample_set_id: uuid.UUID,
    shared_by: uuid.UUID,
) -> Share:
    # Check not already shared
    existing = await session.exec(
        select(Share).where(Share.sample_set_id == sample_set_id)
    )
    if existing.first() is not None:
        raise AlreadyShared()

    share = Share(sample_set_id=sample_set_id, shared_by=shared_by)
    session.add(share)
    await session.commit()
    await session.refresh(share)
    return share


async def unshare_sample_set(
    session: AsyncSession,
    sample_set_id: uuid.UUID,
) -> None:
    result = await session.exec(
        select(Share).where(Share.sample_set_id == sample_set_id)
    )
    share = result.first()
    if share is None:
        raise NotShared()
    await session.delete(share)
    await session.commit()


async def list_shared_sample_sets(
    session: AsyncSession,
    search: str | None = None,
) -> list[SharedSampleSetRead]:
    stmt = (
        select(Share, SampleSet, User)
        .join(SampleSet, Share.sample_set_id == SampleSet.id)
        .join(User, Share.shared_by == User.id)
    )
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            SampleSet.name.ilike(pattern) | SampleSet.description.ilike(pattern)  # type: ignore[union-attr]
        )
    result = await session.exec(stmt)
    items = []
    for share, sample_set, user in result.all():
        items.append(
            SharedSampleSetRead(
                id=share.id,
                sample_set_id=sample_set.id,
                sample_set_name=sample_set.name,
                sample_set_description=sample_set.description,
                shared_by=user.id,
                shared_by_username=user.username,
                created_at=share.created_at,
            )
        )
    return items


async def copy_shared_sample_set(
    session: AsyncSession,
    sample_set_id: uuid.UUID,
    new_owner_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
) -> SampleSet:
    """Deep-copy a shared sample set into the user's library."""
    from app.models.image import Image
    from app.models.subset import Subset

    # Verify it's shared
    share_result = await session.exec(
        select(Share).where(Share.sample_set_id == sample_set_id)
    )
    if share_result.first() is None:
        raise NotShared()

    # Get original sample set
    orig_result = await session.exec(
        select(SampleSet).where(SampleSet.id == sample_set_id)
    )
    orig_ss = orig_result.first()
    if orig_ss is None:
        from app.services.sample_set import SampleSetNotFound

        raise SampleSetNotFound()

    # Create new sample set
    new_ss = SampleSet(
        name=f"{orig_ss.name} (copy)",
        description=orig_ss.description,
        owner_id=new_owner_id,
        folder_id=folder_id,
    )
    session.add(new_ss)
    await session.flush()

    # Copy subsets and images
    subset_result = await session.exec(
        select(Subset).where(Subset.sample_set_id == sample_set_id)
    )
    for orig_subset in subset_result.all():
        new_subset = Subset(
            sample_set_id=new_ss.id,
            name=orig_subset.name,
            type=orig_subset.type,
            metadata_=orig_subset.metadata_,
            source_module=orig_subset.source_module,
            source_params=orig_subset.source_params,
        )
        session.add(new_subset)
        await session.flush()

        image_result = await session.exec(
            select(Image).where(Image.subset_id == orig_subset.id)
        )
        for orig_image in image_result.all():
            new_image = Image(
                subset_id=new_subset.id,
                filename=orig_image.filename,
                format=orig_image.format,
                metadata_=orig_image.metadata_,
                storage_path=orig_image.storage_path,  # Share storage path
            )
            session.add(new_image)

    await session.commit()
    await session.refresh(new_ss)
    return new_ss


# --------------- Helpers ---------------


async def _get_owned_folder(
    session: AsyncSession,
    folder_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> Folder:
    result = await session.exec(
        select(Folder).where(Folder.id == folder_id, Folder.owner_id == owner_id)
    )
    folder = result.first()
    if folder is None:
        raise FolderNotFound()
    return folder


async def _check_no_cycle(
    session: AsyncSession,
    start_id: uuid.UUID,
    target_id: uuid.UUID,
    max_depth: int = 50,
) -> None:
    """Walk up from start_id; raise if we reach target_id."""
    current_id: uuid.UUID | None = start_id
    for _ in range(max_depth):
        if current_id is None:
            return
        if current_id == target_id:
            raise CircularFolder()
        result = await session.exec(
            select(Folder.parent_id).where(Folder.id == current_id)
        )
        current_id = result.first()


async def _check_name_unique(
    session: AsyncSession,
    parent_id: uuid.UUID | None,
    owner_id: uuid.UUID,
    name: str,
    exclude_folder_id: uuid.UUID | None = None,
    exclude_sample_set_id: uuid.UUID | None = None,
) -> None:
    """Check that no folder or sample set with the given name exists in the target directory."""
    # Check folders
    folder_query = select(Folder).where(
        Folder.owner_id == owner_id,
        Folder.name == name,
    )
    if parent_id is None:
        folder_query = folder_query.where(col(Folder.parent_id).is_(None))
    else:
        folder_query = folder_query.where(Folder.parent_id == parent_id)
    if exclude_folder_id is not None:
        folder_query = folder_query.where(Folder.id != exclude_folder_id)

    if (await session.exec(folder_query)).first() is not None:
        raise DuplicateName()

    # Check sample sets
    ss_query = select(SampleSet).where(
        SampleSet.owner_id == owner_id,
        SampleSet.name == name,
    )
    if parent_id is None:
        ss_query = ss_query.where(col(SampleSet.folder_id).is_(None))
    else:
        ss_query = ss_query.where(SampleSet.folder_id == parent_id)
    if exclude_sample_set_id is not None:
        ss_query = ss_query.where(SampleSet.id != exclude_sample_set_id)

    if (await session.exec(ss_query)).first() is not None:
        raise DuplicateName()
