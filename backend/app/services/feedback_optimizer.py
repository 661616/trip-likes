"""Feedback-driven comment optimization (Innovation Point 3).

Closes the loop: evaluate → identify weakness → enhance prompt → regenerate → re-evaluate.
"""

from __future__ import annotations

import json
import logging

from app.models.comment import GeneratedComment
from app.models.post import Post
from app.services.agent_evaluator import (
    EvaluationSummaryData,
    compute_summary,
    evaluate_all,
)
from app.services.comment_generator import analyze_post, post_process
from app.services.prompt_templates import assemble_generation_prompt
from app.utils.llm_client import llm_client

logger = logging.getLogger(__name__)

ENHANCEMENT_INSTRUCTIONS: dict[str, str] = {
    "context_fit": "请确保评论紧密围绕帖子的核心主题，直接回应帖子中的具体观点或事实。",
    "style_achievement": "请强化{style}的表达特征，让读者一眼就能识别出这是{style}的评论。",
    "naturalness": "请用社交媒体上真实用户的口吻表达，避免任何模板化、格式化的AI腔调。",
    "engagement_potential": "请在评论中加入能引发回复的元素，如提出问题、分享个人经历、或提出可讨论的观点。",
}

STYLE_LABELS: dict[str, str] = {
    "humorous": "幽默风格",
    "analytical": "理性分析风格",
    "empathetic": "情感共鸣风格",
    "controversial": "争议讨论风格",
    "supportive": "支持鼓励风格",
}


def identify_weakness(summary: EvaluationSummaryData) -> str:
    """Return the dimension key with the lowest mean score."""
    return min(summary.dimension_means, key=lambda k: summary.dimension_means[k])


def build_enhancement(weakness: str, style: str) -> str:
    """Build the enhancement instruction for the weakest dimension."""
    template = ENHANCEMENT_INSTRUCTIONS[weakness]
    style_label = STYLE_LABELS.get(style, style)
    return template.format(style=style_label)


async def optimize_comment(
    post: Post,
    original_comment: GeneratedComment,
    summary: EvaluationSummaryData,
) -> tuple[str, str | None, str, str]:
    """Generate an optimized comment based on evaluation feedback.

    Returns:
        (optimized_text, analysis_json_str, prompt_used, weakness_dimension)
    """
    weakness = identify_weakness(summary)
    enhancement = build_enhancement(weakness, original_comment.style.value)
    logger.info(
        "Optimizing comment_id=%d, weakness=%s, mean=%.2f",
        original_comment.id,
        weakness,
        summary.dimension_means[weakness],
    )

    analysis = await analyze_post(post)
    analysis_json_str = json.dumps(analysis, ensure_ascii=False)

    base_prompt = assemble_generation_prompt(
        title=post.title,
        content=post.content,
        style=original_comment.style.value,
        analysis_json=analysis,
    )
    enhanced_prompt = f"{base_prompt}\n\n## 特别优化指令\n{enhancement}"

    messages = [{"role": "user", "content": enhanced_prompt}]
    raw = await llm_client.chat(messages, temperature=0.7)
    optimized_text = post_process(raw)

    return optimized_text, analysis_json_str, enhanced_prompt, weakness


async def run_optimization_loop(
    post: Post,
    comment: GeneratedComment,
) -> tuple[str, str | None, str, str, EvaluationSummaryData]:
    """Full optimization loop: evaluate → identify → enhance → regenerate → re-evaluate.

    Returns:
        (optimized_text, analysis_json_str, prompt_used, weakness, new_summary)
    """
    # Step 1: Evaluate the original comment (if no evaluations exist yet)
    evals = await evaluate_all(
        post_title=post.title,
        post_content=post.content,
        comment_content=comment.content,
        target_style=comment.style.value,
    )
    original_summary = compute_summary(evals)

    # Step 2: Optimize
    optimized_text, analysis_json_str, prompt_used, weakness = await optimize_comment(
        post, comment, original_summary
    )

    # Step 3: Re-evaluate the optimized comment
    new_evals = await evaluate_all(
        post_title=post.title,
        post_content=post.content,
        comment_content=optimized_text,
        target_style=comment.style.value,
    )
    new_summary = compute_summary(new_evals)

    improvement = new_summary.overall_mean - original_summary.overall_mean
    logger.info(
        "Optimization result: weakness=%s, before=%.2f, after=%.2f, improvement=%+.2f",
        weakness,
        original_summary.overall_mean,
        new_summary.overall_mean,
        improvement,
    )

    return optimized_text, analysis_json_str, prompt_used, weakness, new_summary
