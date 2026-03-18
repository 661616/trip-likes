from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.evaluation import Evaluation
    from app.models.post import Post


class CommentStyle(str, enum.Enum):
    HUMOROUS = "humorous"
    ANALYTICAL = "analytical"
    EMPATHETIC = "empathetic"
    CONTROVERSIAL = "controversial"
    SUPPORTIVE = "supportive"


class GeneratedComment(Base):
    """LLM-generated comment with metadata for ablation experiments."""

    __tablename__ = "generated_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"))
    style: Mapped[CommentStyle] = mapped_column(Enum(CommentStyle))
    content: Mapped[str] = mapped_column(Text)
    post_analysis_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    round: Mapped[int] = mapped_column(Integer, default=1)
    parent_comment_id: Mapped[int | None] = mapped_column(
        ForeignKey("generated_comments.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    skip_analysis: Mapped[bool] = mapped_column(default=False)
    skip_few_shot: Mapped[bool] = mapped_column(default=False)
    skip_role: Mapped[bool] = mapped_column(default=False)

    post: Mapped[Post] = relationship(back_populates="comments")
    evaluations: Mapped[list[Evaluation]] = relationship(
        back_populates="comment", cascade="all, delete-orphan"
    )
