"""Evaluation prompt template with 4-dimension rubric and strict JSON output."""

from __future__ import annotations

EVALUATION_PROMPT = """\
你需要以{agent_name}的身份评估一条社交媒体评论的质量。

## 原始帖子
标题：{post_title}
内容：{post_content}

## 待评估的评论
{comment_content}

## 评论的目标风格
{target_style}

## 评分维度与标准

### 维度1：场景适配度（context_fit）
"这条评论放在这个帖子底下，搭不搭？"
- 5分：紧扣帖子核心话题，直接回应帖子中的具体内容
- 4分：与帖子话题相关，但没有直接回应具体细节
- 3分：与帖子话题沾边，但略显泛泛
- 2分：与帖子关系不大，放在其他帖子下也成立
- 1分：完全跑题或答非所问

### 维度2：风格达成度（style_achievement）
"我要的是{target_style}风格，它做到了吗？"
- 5分：风格鲜明，一读就能识别出目标风格
- 4分：基本体现目标风格，但不够突出
- 3分：有一点目标风格的影子，但不明显
- 2分：风格模糊，难以判断
- 1分：完全不符合目标风格

### 维度3：自然度（naturalness）
"这读起来像人写的吗？"
- 5分：完全像真人在社交媒体上的自然发言
- 4分：基本自然，偶尔有一点不够口语化
- 3分：能接受，但有明显的"AI腔"或模板感
- 2分：读起来生硬，像是机器生成的
- 1分：一看就是AI写的，充满套话和格式化表达

### 维度4：互动潜力（engagement_potential）
"发出去会有人理吗？"
- 5分：很想点赞/回复，评论本身就能带动讨论
- 4分：值得点赞，但不一定会回复
- 3分：看到了会看一眼，但不太会互动
- 2分：无感，会直接滑过
- 1分：看到会反感或觉得是垃圾评论

## 输出要求
请严格按以下 JSON 格式输出，不要包含任何其他文字：
{{
  "context_fit": <1-5的整数>,
  "style_achievement": <1-5的整数>,
  "naturalness": <1-5的整数>,
  "engagement_potential": <1-5的整数>,
  "attitude": "<like 或 neutral 或 dislike>",
  "reasoning": "<50字以内的简要评价理由>"
}}
"""

STYLE_LABELS: dict[str, str] = {
    "humorous": "幽默风格",
    "analytical": "理性分析风格",
    "empathetic": "情感共鸣风格",
    "controversial": "争议讨论风格",
    "supportive": "支持鼓励风格",
}


def build_evaluation_messages(
    *,
    agent_name: str,
    agent_system_prompt: str,
    post_title: str,
    post_content: str,
    comment_content: str,
    target_style: str,
) -> list[dict[str, str]]:
    """Build the system + user messages for a single agent's evaluation call."""
    style_label = STYLE_LABELS.get(target_style, target_style)

    user_content = EVALUATION_PROMPT.format(
        agent_name=agent_name,
        post_title=post_title,
        post_content=post_content,
        comment_content=comment_content,
        target_style=style_label,
    )

    return [
        {"role": "system", "content": agent_system_prompt},
        {"role": "user", "content": user_content},
    ]
