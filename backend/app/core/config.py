from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables / `.env`."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "how-i-spend API"
    environment: str = "local"
    cors_origins: list[str] = ["http://localhost:5173"]
    # 12-factor config: connection details come from the environment, never hardcoded.
    database_url: str = "postgresql+asyncpg://howispend:howispend@localhost:5432/howispend"


@lru_cache
def get_settings() -> Settings:
    return Settings()
