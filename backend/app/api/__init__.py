from fastapi import APIRouter

from app.api.v1 import comments, evaluations, posts, settings

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(posts.router)
api_router.include_router(comments.router)
api_router.include_router(evaluations.router)
api_router.include_router(settings.router)
