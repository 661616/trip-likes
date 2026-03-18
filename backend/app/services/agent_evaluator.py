"""Multi-agent concurrent evaluation service.

Dispatches 8 agent evaluation calls via asyncio.gather, parses results,
and computes dimension-level summaries.
"""

from __future__ import annotations

import asyncio
import logging
import statistics
from dataclasses import dataclass

from app.services.agent_personas import AGENT_PERSONAS, AgentPersona
from app.services.evaluation_prompts import build_evaluation_messages
from app.utils.llm_client import llm_client

logger = logging.getLogger(__name__)

DIMENSION_KEYS = ["context_fit", "style_achievement", "naturalness", "engagement_potential"]


@dataclass
class SingleEvaluation:
    """Parsed result from one agent's evaluation."""

    agent_name_en: str
    agent_name: str
    context_fit: int
    style_achievement: int
    naturalness: int
    engagement_potential: int
    overall_score: float
    attitude: str
    reasoning: str


@dataclass
class EvaluationSummaryData:
    """Aggregated evaluation statistics across all agents."""

    evaluations: list[SingleEvaluation]
    dimension_means: dict[str, float]
    dimension_stds: dict[str, float]
    dimension_mins: dict[str, int]
    dimension_maxs: dict[str, int]
    overall_mean: float
    attitude_distribution: dict[str, int]


def _clamp(value: int, lo: int = 1, hi: int = 5) -> int:
    return max(lo, min(hi, value))


def _parse_evaluation(raw: dict, persona: AgentPersona) -> SingleEvaluation:
    """Parse raw LLM JSON into a validated SingleEvaluation."""
    scores = {k: _clamp(int(raw.get(k, 3))) for k in DIMENSION_KEYS}
    overall = sum(scores.values()) / len(scores)

    attitude = raw.get("attitude", "neutral")
    if attitude not in ("like", "neutral", "dislike"):
        attitude = "neutral"

    reasoning = str(raw.get("reasoning", ""))[:200]

    return SingleEvaluation(
        agent_name_en=persona.name_en,
        agent_name=persona.name,
        context_fit=scores["context_fit"],
        style_achievement=scores["style_achievement"],
        naturalness=scores["naturalness"],
        engagement_potential=scores["engagement_potential"],
        overall_score=round(overall, 2),
        attitude=attitude,
        reasoning=reasoning,
    )


async def evaluate_single(
    persona: AgentPersona,
    post_title: str,
    post_content: str,
    comment_content: str,
    target_style: str,
) -> SingleEvaluation:
    """Run evaluation for a single agent persona."""
    messages = build_evaluation_messages(
        agent_name=persona.name,
        agent_system_prompt=persona.system_prompt,
        post_title=post_title,
        post_content=post_content,
        comment_content=comment_content,
        target_style=target_style,
    )
    raw = await llm_client.chat_json(messages, temperature=0.3)
    return _parse_evaluation(raw, persona)


async def evaluate_all(
    post_title: str,
    post_content: str,
    comment_content: str,
    target_style: str,
) -> list[SingleEvaluation]:
    """Run all 8 agents concurrently and return parsed evaluations."""
    tasks = [
        evaluate_single(persona, post_title, post_content, comment_content, target_style)
        for persona in AGENT_PERSONAS
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    evaluations: list[SingleEvaluation] = []
    for persona, result in zip(AGENT_PERSONAS, results, strict=True):
        if isinstance(result, Exception):
            logger.error("Agent %s evaluation failed: %s", persona.name_en, result)
            evaluations.append(
                SingleEvaluation(
                    agent_name_en=persona.name_en,
                    agent_name=persona.name,
                    context_fit=3,
                    style_achievement=3,
                    naturalness=3,
                    engagement_potential=3,
                    overall_score=3.0,
                    attitude="neutral",
                    reasoning=f"评估失败: {type(result).__name__}",
                )
            )
        else:
            evaluations.append(result)
    return evaluations


def compute_summary(evaluations: list[SingleEvaluation]) -> EvaluationSummaryData:
    """Compute aggregate statistics from a list of evaluations."""
    dim_values: dict[str, list[int]] = {k: [] for k in DIMENSION_KEYS}
    attitude_counts = {"like": 0, "neutral": 0, "dislike": 0}

    for ev in evaluations:
        for key in DIMENSION_KEYS:
            dim_values[key].append(getattr(ev, key))
        attitude_counts[ev.attitude] = attitude_counts.get(ev.attitude, 0) + 1

    dim_means = {k: round(statistics.mean(v), 2) for k, v in dim_values.items()}
    dim_stds = {
        k: round(statistics.stdev(v), 2) if len(v) > 1 else 0.0 for k, v in dim_values.items()
    }
    dim_mins = {k: min(v) for k, v in dim_values.items()}
    dim_maxs = {k: max(v) for k, v in dim_values.items()}
    overall_mean = round(statistics.mean([ev.overall_score for ev in evaluations]), 2)

    return EvaluationSummaryData(
        evaluations=evaluations,
        dimension_means=dim_means,
        dimension_stds=dim_stds,
        dimension_mins=dim_mins,
        dimension_maxs=dim_maxs,
        overall_mean=overall_mean,
        attitude_distribution=attitude_counts,
    )
