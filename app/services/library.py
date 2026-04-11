import uuid
from datetime import UTC, datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.exceptions import AppError
from app.models.folder import Folder
from app.models.sample_set import SampleSet
from app.models.share import Share
from app.models.user import User
from app.schemas.library import (
    FolderTreeNode,
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


# --------------- Folder CRUD ---------------


async def create_folder(
    session: AsyncSession,
    owner_id: uuid.UUID,
    name: str,
    parent_id: uuid.UUID | None = None,
) -> Folder:
    if parent_id is not None:
        await _get_owned_folder(session, parent_id, owner_id)

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
) -> list[SharedSampleSetRead]:
    result = await session.exec(
        select(Share, SampleSet, User)
        .join(SampleSet, Share.sample_set_id == SampleSet.id)
        .join(User, Share.shared_by == User.id)
    )
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
