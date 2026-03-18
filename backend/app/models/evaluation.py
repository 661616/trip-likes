from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.comment import GeneratedComment


class Attitude(str, enum.Enum):
    LIKE = "like"
    NEUTRAL = "neutral"
    DISLIKE = "dislike"


class Evaluation(Base):
    """Single agent's evaluation scores for a generated comment."""

    __tablename__ = "evaluations"

    id: Mapped[int] = mapped_column(primary_key=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("generated_comments.id", ondelete="CASCADE"))
    agent_name: Mapped[str] = mapped_column(String(50))
    context_fit: Mapped[int] = mapped_column(Integer)
    style_achievement: Mapped[int] = mapped_column(Integer)
    naturalness: Mapped[int] = mapped_column(Integer)
    engagement_potential: Mapped[int] = mapped_column(Integer)
    overall_score: Mapped[float] = mapped_column(Float)
    attitude: Mapped[Attitude] = mapped_column(Enum(Attitude))
    reasoning: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    comment: Mapped[GeneratedComment] = relationship(back_populates="evaluations")
