from fastapi import APIRouter

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.images import router as images_router
from app.api.routes.library import router as library_router
from app.api.routes.pipelines import router as pipelines_router
from app.api.routes.sample_sets import router as sample_sets_router
from app.api.routes.subsets import router as subsets_router
from app.api.routes.tasks import router as tasks_router
from app.api.routes.users import router as users_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(sample_sets_router)
api_router.include_router(subsets_router)
api_router.include_router(images_router)
api_router.include_router(library_router)
api_router.include_router(pipelines_router)
api_router.include_router(tasks_router)
api_router.include_router(admin_router)
