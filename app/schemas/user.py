import uuid

from pydantic import BaseModel


class UserUpdate(BaseModel):
    username: str | None = None
    email: str | None = None


class AdminUserUpdate(BaseModel):
    username: str | None = None
    email: str | None = None
    role: str | None = None
    is_active: bool | None = None


class AdminUserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"
    is_active: bool = True


class UserRead(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    role: str
    is_active: bool
