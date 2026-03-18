from datetime import datetime

from pydantic import BaseModel, Field

from app.models.comment import CommentStyle


class GenerateRequest(BaseModel):
    post_id: int
    style: CommentStyle
    skip_analysis: bool = False
    skip_few_shot: bool = False
    skip_role: bool = False


class BatchGenerateRequest(BaseModel):
    post_id: int
    styles: list[CommentStyle] = Field(
        default_factory=lambda: list(CommentStyle),
        description="Styles to generate; defaults to all five.",
    )
    skip_analysis: bool = False
    skip_few_shot: bool = False
    skip_role: bool = False


class CommentResponse(BaseModel):
    id: int
    post_id: int
    style: CommentStyle
    content: str
    post_analysis_json: str | None = None
    prompt_used: str | None = None
    round: int
    parent_comment_id: int | None = None
    skip_analysis: bool
    skip_few_shot: bool
    skip_role: bool
    created_at: datetime

    model_config = {"from_attributes": True}
