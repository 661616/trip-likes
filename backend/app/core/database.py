from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

    pass


async def init_db() -> None:
    """Create all tables on first startup (suitable for SQLite dev workflow)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
