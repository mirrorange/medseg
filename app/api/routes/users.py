import uuid

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_user, require_admin
from app.db import get_session
from app.models.user import User
from app.schemas.user import AdminUserUpdate, UserRead, UserUpdate
from app.services.user import (
    admin_update_user,
    delete_user,
    list_users,
    update_user,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserRead)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await update_user(session, user, body.username, body.email)


@router.get("", response_model=list[UserRead])
async def get_users(
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    return await list_users(session)


@router.put("/{user_id}", response_model=UserRead)
async def admin_update(
    user_id: uuid.UUID,
    body: AdminUserUpdate,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    return await admin_update_user(
        session,
        user_id,
        body.username,
        body.email,
        body.role,
        body.is_active,
    )


@router.delete("/{user_id}", status_code=204)
async def admin_delete(
    user_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    await delete_user(session, user_id)
