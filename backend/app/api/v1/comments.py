from __future__ import annotations

import asyncio
import logging

import openai
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.exceptions import LLMServiceError, NotFoundError
from app.models.comment import GeneratedComment
from app.models.post import Post
from app.schemas.comment import BatchGenerateRequest, CommentResponse, GenerateRequest
from app.services.comment_generator import generate_comment
from app.services.feedback_optimizer import optimize_comment


def _wrap_llm_error(exc: Exception) -> LLMServiceError:
    """Convert openai SDK errors into human-readable 502 responses."""
    if isinstance(exc, openai.AuthenticationError):
        return LLMServiceError("API Key 无效或已过期，请在「系统设置 → 模型配置」中更新")
    if isinstance(exc, openai.PermissionDeniedError):
        return LLMServiceError("请求被拒绝：API Key 无权限访问该模型，或账户余额不足")
    if isinstance(exc, openai.NotFoundError):
        return LLMServiceError("模型不存在，请在「系统设置 → 模型配置」中确认模型名称")
    if isinstance(exc, openai.RateLimitError):
        return LLMServiceError("API 请求限流，请稍后重试或降低最大并发数")
    if isinstance(exc, openai.APIConnectionError):
        return LLMServiceError("无法连接到 LLM 服务，请检查 Base URL 配置")
    return LLMServiceError(f"LLM 调用失败：{type(exc).__name__}: {exc}")


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/comments", tags=["comments"])


@router.post("/generate", response_model=CommentResponse, status_code=201)
async def create_comment(
    body: GenerateRequest, db: AsyncSession = Depends(get_db)
) -> GeneratedComment:
    """Generate a single comment for a post in the specified style."""
    post = await db.get(Post, body.post_id)
    if not post:
        raise NotFoundError("Post", body.post_id)

    try:
        text, analysis_json, prompt_used = await generate_comment(
            post,
            body.style.value,
            skip_analysis=body.skip_analysis,
            skip_few_shot=body.skip_few_shot,
            skip_role=body.skip_role,
        )
    except openai.OpenAIError as exc:
        raise _wrap_llm_error(exc) from exc

    comment = GeneratedComment(
        post_id=post.id,
        style=body.style,
        content=text,
        post_analysis_json=analysis_json,
        prompt_used=prompt_used,
        skip_analysis=body.skip_analysis,
        skip_few_shot=body.skip_few_shot,
        skip_role=body.skip_role,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


@router.post("/batch-generate", response_model=list[CommentResponse], status_code=201)
async def batch_generate(
    body: BatchGenerateRequest, db: AsyncSession = Depends(get_db)
) -> list[GeneratedComment]:
    """Generate comments for a post across multiple styles concurrently."""
    post = await db.get(Post, body.post_id)
    if not post:
        raise NotFoundError("Post", body.post_id)

    async def _gen_one(style):
        text, analysis_json, prompt_used = await generate_comment(
            post,
            style.value,
            skip_analysis=body.skip_analysis,
            skip_few_shot=body.skip_few_shot,
            skip_role=body.skip_role,
        )
        return GeneratedComment(
            post_id=post.id,
            style=style,
            content=text,
            post_analysis_json=analysis_json,
            prompt_used=prompt_used,
            skip_analysis=body.skip_analysis,
            skip_few_shot=body.skip_few_shot,
            skip_role=body.skip_role,
        )

    try:
        comments = await asyncio.gather(*[_gen_one(s) for s in body.styles])
    except openai.OpenAIError as exc:
        raise _wrap_llm_error(exc) from exc
    for comment in comments:
        db.add(comment)
    await db.commit()

    for comment in comments:
        await db.refresh(comment)
    return list(comments)


@router.post("/{comment_id}/optimize", response_model=CommentResponse, status_code=201)
async def optimize_existing_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
) -> GeneratedComment:
    """Apply feedback optimization to an existing comment.

    Evaluates the original comment, identifies the weakest dimension,
    generates an enhanced version, and persists it as a new round.
    """
    from sqlalchemy.orm import selectinload

    from app.models.evaluation import Evaluation
    from app.services.agent_evaluator import compute_summary, evaluate_all

    stmt = (
        select(GeneratedComment)
        .options(selectinload(GeneratedComment.post))
        .where(GeneratedComment.id == comment_id)
    )
    result = await db.execute(stmt)
    original = result.scalar_one_or_none()
    if not original:
        raise NotFoundError("Comment", comment_id)

    # Check for existing evaluations, run if none
    eval_stmt = select(Evaluation).where(Evaluation.comment_id == comment_id)
    eval_result = await db.execute(eval_stmt)
    existing_evals = list(eval_result.scalars().all())

    if existing_evals:
        from app.services.agent_evaluator import SingleEvaluation

        service_evals = [
            SingleEvaluation(
                agent_name_en=e.agent_name,
                agent_name=e.agent_name,
                context_fit=e.context_fit,
                style_achievement=e.style_achievement,
                naturalness=e.naturalness,
                engagement_potential=e.engagement_potential,
                overall_score=e.overall_score,
                attitude=e.attitude.value if hasattr(e.attitude, "value") else e.attitude,
                reasoning=e.reasoning,
            )
            for e in existing_evals
        ]
        summary = compute_summary(service_evals)
    else:
        raw_evals = await evaluate_all(
            post_title=original.post.title,
            post_content=original.post.content,
            comment_content=original.content,
            target_style=original.style.value,
        )
        summary = compute_summary(raw_evals)

    try:
        text, analysis_json, prompt_used, _weakness = await optimize_comment(
            original.post, original, summary
        )
    except openai.OpenAIError as exc:
        raise _wrap_llm_error(exc) from exc

    optimized = GeneratedComment(
        post_id=original.post_id,
        style=original.style,
        content=text,
        post_analysis_json=analysis_json,
        prompt_used=prompt_used,
        round=original.round + 1,
        parent_comment_id=original.id,
    )
    db.add(optimized)
    await db.commit()
    await db.refresh(optimized)
    return optimized


@router.get("", response_model=list[CommentResponse])
async def list_comments(
    post_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[GeneratedComment]:
    """List generated comments, optionally filtered by post_id."""
    stmt = select(GeneratedComment).order_by(GeneratedComment.created_at.desc())
    if post_id is not None:
        stmt = stmt.where(GeneratedComment.post_id == post_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())
