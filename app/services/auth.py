from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.exceptions import InvalidCredentials, UserAlreadyExists
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User


async def register_user(
    session: AsyncSession,
    username: str,
    email: str,
    password: str,
) -> User:
    result = await session.exec(
        select(User).where((User.username == username) | (User.email == email))
    )
    existing = result.first()
    if existing is not None:
        raise UserAlreadyExists()

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def authenticate_user(
    session: AsyncSession,
    username: str,
    password: str,
) -> str:
    result = await session.exec(select(User).where(User.username == username))
    user = result.first()
    if user is None or not verify_password(password, user.hashed_password):
        raise InvalidCredentials()
    if not user.is_active:
        raise InvalidCredentials()

    return create_access_token({"sub": str(user.id), "role": user.role.value})
