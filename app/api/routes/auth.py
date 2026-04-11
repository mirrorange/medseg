from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db import get_session
from app.schemas.auth import TokenResponse, UserLogin, UserRead, UserRegister
from app.services.auth import authenticate_user, register_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=201)
async def register(
    body: UserRegister,
    session: AsyncSession = Depends(get_session),
):
    user = await register_user(session, body.username, body.email, body.password)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    body: UserLogin,
    session: AsyncSession = Depends(get_session),
):
    token = await authenticate_user(session, body.username, body.password)
    return TokenResponse(access_token=token)
