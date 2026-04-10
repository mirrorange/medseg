
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
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=5201, env="PORT")

    # SPA static files
    static_folder: Path = Field(
        default=Path(__file__).parent.parent / "static",
        env="STATIC_FOLDER",
        description="Folder path for storing static files",
    )

    # Internationalization settings
    locales_folder: Path = Field(
        default=Path(__file__).parent.parent / "locales",
        env="LOCALES_FOLDER",
        description="Folder path for storing translation files",
    )
    default_language: str = Field(
        default="en",
        env="DEFAULT_LANGUAGE",
        description="Default language code for translations",
    )

    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_to_file: bool = Field(
        default=False, env="LOG_TO_FILE", description="Enable logging to file"
    )
    log_file_path: str = Field(
        default="logs/app.log", env="LOG_FILE_PATH", description="Log file path"
    )
    log_file_rotation: str = Field(
        default="10 MB",
        env="LOG_FILE_ROTATION",
        description="Log file rotation (e.g., '10 MB', '1 day', '1 week')",
    )
    log_file_retention: str = Field(
        default="7 days",
        env="LOG_FILE_RETENTION",
        description="Log file retention (e.g., '7 days', '1 month')",
    )
    log_file_compression: str = Field(
        default="zip",
        env="LOG_FILE_COMPRESSION",
        description="Log file compression format",
    )

settings = Settings()
