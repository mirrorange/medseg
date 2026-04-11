from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable and JSON config support."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    # Server settings
    host: str = "0.0.0.0"
    port: int = 5201

    # SPA static files
    static_folder: Path = Field(
        default=Path(__file__).parent.parent / "static",
        description="Folder path for storing static files",
    )

    # Internationalization settings
    locales_folder: Path = Field(
        default=Path(__file__).parent.parent / "locales",
        description="Folder path for storing translation files",
    )
    default_language: str = "en"

    # Logging
    log_level: str = "INFO"
    log_to_file: bool = False
    log_file_path: str = "logs/app.log"
    log_file_rotation: str = "10 MB"
    log_file_retention: str = "7 days"
    log_file_compression: str = "zip"

    # Database
    database_url: str = "sqlite+aiosqlite:///./medseg.db"

    # JWT
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    # Storage
    storage_backend: str = "local"
    storage_root: Path = Field(default=Path("./storage"))

    # Pipeline
    modules_dir: Path = Field(
        default=Path(__file__).parent.parent / "pipeline" / "modules",
    )
    affinity_bonus_ms: int = 60000
    resource_threshold_ratio: float = 0.8
    max_retry_count: int = 1


settings = Settings()
