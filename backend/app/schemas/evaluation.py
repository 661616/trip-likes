from datetime import datetime

from pydantic import BaseModel

from app.models.evaluation import Attitude


class RunEvaluationRequest(BaseModel):
    comment_id: int


class EvaluationResponse(BaseModel):
    id: int
    comment_id: int
    agent_name: str
    context_fit: int
    style_achievement: int
    naturalness: int
    engagement_potential: int
    overall_score: float
    attitude: Attitude
    reasoning: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DimensionSummary(BaseModel):
    mean: float
    std: float
    min: int
    max: int


class AttitudeDistribution(BaseModel):
    like: int = 0
    neutral: int = 0
    dislike: int = 0


class EvaluationSummary(BaseModel):
    comment_id: int
    agent_count: int
    context_fit: DimensionSummary
    style_achievement: DimensionSummary
    naturalness: DimensionSummary
    engagement_potential: DimensionSummary
    overall_mean: float
    attitude_distribution: AttitudeDistribution
    evaluations: list[EvaluationResponse]
