import uuid
from datetime import UTC, datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.exceptions import UserAlreadyExists, UserNotFound
from app.core.security import hash_password
from app.models.user import User, UserRole


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User:
    result = await session.exec(select(User).where(User.id == user_id))
    user = result.first()
    if user is None:
        raise UserNotFound()
    return user


async def update_user(
    session: AsyncSession,
    user: User,
    username: str | None = None,
    email: str | None = None,
) -> User:
    if username is not None and username != user.username:
        result = await session.exec(select(User).where(User.username == username))
        if result.first() is not None:
            raise UserAlreadyExists({"field": "username"})
        user.username = username

    if email is not None and email != user.email:
        result = await session.exec(select(User).where(User.email == email))
        if result.first() is not None:
            raise UserAlreadyExists({"field": "email"})
        user.email = email

    user.updated_at = datetime.now(UTC)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def admin_update_user(
    session: AsyncSession,
    user_id: uuid.UUID,
    username: str | None = None,
    email: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
) -> User:
    user = await get_user_by_id(session, user_id)

    if username is not None or email is not None:
        user = await update_user(session, user, username, email)

    if role is not None:
        user.role = UserRole(role)
    if is_active is not None:
        user.is_active = is_active

    user.updated_at = datetime.now(UTC)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def list_users(session: AsyncSession) -> list[User]:
    result = await session.exec(select(User))
    return list(result.all())


async def delete_user(session: AsyncSession, user_id: uuid.UUID) -> None:
    user = await get_user_by_id(session, user_id)
    await session.delete(user)
    await session.commit()


async def admin_create_user(
    session: AsyncSession,
    username: str,
    email: str,
    password: str,
    role: str = "user",
    is_active: bool = True,
) -> User:
    result = await session.exec(
        select(User).where((User.username == username) | (User.email == email))
    )
    if result.first() is not None:
        raise UserAlreadyExists()

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        role=UserRole(role),
        is_active=is_active,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
