"""Three-stage chain-of-analysis comment generation service.

Stage 1: Post deep analysis → structured JSON
Stage 2: Dynamic prompt assembly (style + analysis + few-shot)
Stage 3: LLM generation + post-processing
"""

from __future__ import annotations

import json
import logging
import re

from app.models.post import Post
from app.services.prompt_templates import (
    BASELINE_PROMPT,
    POST_ANALYSIS_PROMPT,
    assemble_generation_prompt,
)
from app.utils.llm_client import llm_client

logger = logging.getLogger(__name__)


async def analyze_post(post: Post) -> dict:
    """Stage 1: Analyze a post and return structured JSON insights."""
    prompt = POST_ANALYSIS_PROMPT.format(
        title=post.title,
        content=post.content,
        category=post.category.value,
    )
    messages = [{"role": "user", "content": prompt}]
    analysis = await llm_client.chat_json(messages, temperature=0.3)
    logger.info(
        "Post analysis complete for post_id=%d, topic=%s", post.id, analysis.get("core_topic")
    )
    return analysis


def post_process(raw_text: str) -> str:
    """Stage 3 post-processing: clean up LLM output artifacts."""
    text = raw_text.strip()
    # Remove common LLM wrapper patterns
    text = re.sub(r'^["「]|["」]$', "", text)
    text = re.sub(r"^(评论[：:]\s*)", "", text)
    text = re.sub(r"^(回复[：:]\s*)", "", text)
    # Collapse multiple newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


async def generate_comment(
    post: Post,
    style: str,
    *,
    skip_analysis: bool = False,
    skip_few_shot: bool = False,
    skip_role: bool = False,
) -> tuple[str, str | None, str]:
    """Generate a single comment for a post in the given style.

    Returns:
        (comment_text, analysis_json_str, prompt_used)
    """
    is_baseline = skip_analysis and skip_few_shot and skip_role

    if is_baseline:
        prompt = BASELINE_PROMPT.format(title=post.title, content=post.content)
        analysis_json_str = None
    else:
        analysis = await analyze_post(post) if not skip_analysis else None
        analysis_json_str = json.dumps(analysis, ensure_ascii=False) if analysis else None

        prompt = assemble_generation_prompt(
            title=post.title,
            content=post.content,
            style=style,
            analysis_json=analysis,
            skip_analysis=skip_analysis,
            skip_few_shot=skip_few_shot,
            skip_role=skip_role,
        )

    messages = [{"role": "user", "content": prompt}]
    raw = await llm_client.chat(messages, temperature=0.7)
    comment_text = post_process(raw)

    logger.info(
        "Comment generated for post_id=%d style=%s len=%d", post.id, style, len(comment_text)
    )
    return comment_text, analysis_json_str, prompt
