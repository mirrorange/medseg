from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api.main import api_router
from app.core.config import settings
from app.core.error_handler import app_exception_handler
from app.core.exceptions import AppError
from app.core.static import register_static_routes
from app.utils.logger import configure_logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    configure_logger()
    logger.info("Starting MedSeg...")

    yield

    logger.info("Shutting down MedSeg...")


app = FastAPI(
    title="MedSeg",
    description="Cloud Platform for Medical Image Segmentation",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router)

# Static files
register_static_routes(app)

# Exception handlers
app.add_exception_handler(AppError, app_exception_handler)


# Health check
@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


def main():
    """Main entry point for the application."""
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
