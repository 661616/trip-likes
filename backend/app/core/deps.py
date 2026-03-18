from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session; auto-closes on exit."""
    async with async_session() as session:
        yield session
