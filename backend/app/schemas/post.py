from datetime import datetime

from pydantic import BaseModel, Field

from app.models.post import PostCategory


class PostCreate(BaseModel):
    title: str = Field(max_length=200)
    content: str
    category: PostCategory


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    content: str | None = None
    category: PostCategory | None = None


class PostResponse(BaseModel):
    id: int
    title: str
    content: str
    category: PostCategory
    created_at: datetime

    model_config = {"from_attributes": True}
