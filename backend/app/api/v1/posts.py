from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.exceptions import NotFoundError
from app.models.post import Post
from app.schemas.post import PostCreate, PostResponse, PostUpdate

router = APIRouter(prefix="/posts", tags=["posts"])


@router.post("", response_model=PostResponse, status_code=201)
async def create_post(body: PostCreate, db: AsyncSession = Depends(get_db)) -> Post:
    """Create a new post."""
    post = Post(**body.model_dump())
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


@router.get("", response_model=list[PostResponse])
async def list_posts(db: AsyncSession = Depends(get_db)) -> list[Post]:
    """List all posts, newest first."""
    result = await db.execute(select(Post).order_by(Post.created_at.desc()))
    return list(result.scalars().all())


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(post_id: int, db: AsyncSession = Depends(get_db)) -> Post:
    """Get a single post by ID."""
    post = await db.get(Post, post_id)
    if not post:
        raise NotFoundError("Post", post_id)
    return post


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(post_id: int, body: PostUpdate, db: AsyncSession = Depends(get_db)) -> Post:
    """Update an existing post (partial update)."""
    post = await db.get(Post, post_id)
    if not post:
        raise NotFoundError("Post", post_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    await db.commit()
    await db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=204)
async def delete_post(post_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a post and all associated comments/evaluations."""
    post = await db.get(Post, post_id)
    if not post:
        raise NotFoundError("Post", post_id)
    await db.delete(post)
    await db.commit()
