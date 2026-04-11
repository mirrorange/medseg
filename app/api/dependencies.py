import uuid

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.exceptions import InvalidCredentials, PermissionDenied
from app.core.security import decode_access_token
from app.db import get_session
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    payload = decode_access_token(token)
    if payload is None:
        raise InvalidCredentials()
    user_id = payload.get("sub")
    if user_id is None:
        raise InvalidCredentials()
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise InvalidCredentials() from None
    result = await session.exec(select(User).where(User.id == uid))
    user = result.first()
    if user is None or not user.is_active:
        raise InvalidCredentials()
    return user


async def require_admin(
    user: User = Depends(get_current_user),
) -> User:
    if user.role != UserRole.admin:
        raise PermissionDenied()
    return user
