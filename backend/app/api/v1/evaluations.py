from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db
from app.core.exceptions import NotFoundError
from app.models.comment import GeneratedComment
from app.models.evaluation import Evaluation
from app.schemas.evaluation import (
    AttitudeDistribution,
    DimensionSummary,
    EvaluationResponse,
    EvaluationSummary,
    RunEvaluationRequest,
)
from app.services.agent_evaluator import compute_summary, evaluate_all

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/evaluations", tags=["evaluations"])


@router.post("/run", response_model=list[EvaluationResponse], status_code=201)
async def run_evaluation(
    body: RunEvaluationRequest,
    db: AsyncSession = Depends(get_db),
) -> list[Evaluation]:
    """Run all 8 agents against a generated comment and persist results."""
    stmt = (
        select(GeneratedComment)
        .options(selectinload(GeneratedComment.post))
        .where(GeneratedComment.id == body.comment_id)
    )
    result = await db.execute(stmt)
    comment = result.scalar_one_or_none()
    if not comment:
        raise NotFoundError("Comment", body.comment_id)

    evals = await evaluate_all(
        post_title=comment.post.title,
        post_content=comment.post.content,
        comment_content=comment.content,
        target_style=comment.style.value,
    )

    db_evals: list[Evaluation] = []
    for ev in evals:
        db_eval = Evaluation(
            comment_id=comment.id,
            agent_name=ev.agent_name_en,
            context_fit=ev.context_fit,
            style_achievement=ev.style_achievement,
            naturalness=ev.naturalness,
            engagement_potential=ev.engagement_potential,
            overall_score=ev.overall_score,
            attitude=ev.attitude,
            reasoning=ev.reasoning,
        )
        db.add(db_eval)
        db_evals.append(db_eval)

    await db.commit()
    for db_eval in db_evals:
        await db.refresh(db_eval)
    return db_evals


@router.get("", response_model=list[EvaluationResponse])
async def list_evaluations(
    comment_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
) -> list[Evaluation]:
    """List all evaluation records for a given comment."""
    stmt = (
        select(Evaluation)
        .where(Evaluation.comment_id == comment_id)
        .order_by(Evaluation.agent_name)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/summary", response_model=EvaluationSummary)
async def get_evaluation_summary(
    comment_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
) -> EvaluationSummary:
    """Get aggregated evaluation summary (means, stds, attitude distribution)."""
    stmt = select(Evaluation).where(Evaluation.comment_id == comment_id)
    result = await db.execute(stmt)
    evals = list(result.scalars().all())

    if not evals:
        raise NotFoundError("Evaluations for comment", comment_id)

    # Reuse compute_summary by converting ORM objects to service dataclass
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
        for e in evals
    ]
    summary = compute_summary(service_evals)

    dim_keys = ["context_fit", "style_achievement", "naturalness", "engagement_potential"]
    dim_summaries = {}
    for key in dim_keys:
        dim_summaries[key] = DimensionSummary(
            mean=summary.dimension_means[key],
            std=summary.dimension_stds[key],
            min=summary.dimension_mins[key],
            max=summary.dimension_maxs[key],
        )

    return EvaluationSummary(
        comment_id=comment_id,
        agent_count=len(evals),
        context_fit=dim_summaries["context_fit"],
        style_achievement=dim_summaries["style_achievement"],
        naturalness=dim_summaries["naturalness"],
        engagement_potential=dim_summaries["engagement_potential"],
        overall_mean=summary.overall_mean,
        attitude_distribution=AttitudeDistribution(**summary.attitude_distribution),
        evaluations=[EvaluationResponse.model_validate(e) for e in evals],
    )
