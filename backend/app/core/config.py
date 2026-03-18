from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: str = Field(
        default="sqlite+aiosqlite:///./data.db",
        validation_alias="DATABASE_URL",
    )
    cors_origins: str = Field(default="http://localhost:3000", validation_alias="CORS_ORIGINS")

    llm_api_key: str = Field(default="sk-xxx", validation_alias="LLM_API_KEY")
    llm_base_url: str = Field(default="https://api.openai.com/v1", validation_alias="LLM_BASE_URL")
    llm_model: str = Field(default="gpt-4o-mini", validation_alias="LLM_MODEL")
    llm_max_concurrency: int = Field(default=5, validation_alias="LLM_MAX_CONCURRENCY")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
