from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.comment import GeneratedComment


class PostCategory(str, enum.Enum):
    TECH = "tech"
    ENTERTAINMENT = "entertainment"
    SPORTS = "sports"
    LIFESTYLE = "lifestyle"
    NEWS = "news"


class Post(Base):
    """Social media post that serves as input for comment generation."""

    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    category: Mapped[PostCategory] = mapped_column(Enum(PostCategory))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    comments: Mapped[list[GeneratedComment]] = relationship(
        back_populates="post", cascade="all, delete-orphan"
    )
