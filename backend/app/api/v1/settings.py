"""Settings API — expose and update runtime LLM configuration."""

from __future__ import annotations

import time

import openai
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.utils.llm_client import llm_client

router = APIRouter(prefix="/settings", tags=["settings"])

PROVIDER_PRESETS = [
    {"label": "OpenAI", "base_url": "https://api.openai.com/v1", "model": "gpt-4o-mini"},
    {
        "label": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
    },
    {
        "label": "通义千问 (Qwen)",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
    },
    {
        "label": "本地 (Ollama)",
        "base_url": "http://localhost:11434/v1",
        "model": "llama3",
    },
]


class LLMConfigResponse(BaseModel):
    api_key_masked: str
    base_url: str
    model: str
    max_concurrency: int
    presets: list[dict]


class LLMConfigUpdate(BaseModel):
    api_key: str | None = Field(default=None, description="留空则不修改")
    base_url: str | None = None
    model: str | None = None
    max_concurrency: int | None = Field(default=None, ge=1, le=20)


@router.get("/llm", response_model=LLMConfigResponse)
async def get_llm_config() -> LLMConfigResponse:
    """Return current LLM config with masked API key + provider presets."""
    cfg = llm_client.get_config()
    return LLMConfigResponse(**cfg, presets=PROVIDER_PRESETS)


class TestConnectionResponse(BaseModel):
    ok: bool
    latency_ms: int
    model: str
    message: str


@router.put("/llm", response_model=LLMConfigResponse)
async def update_llm_config(body: LLMConfigUpdate) -> LLMConfigResponse:
    """Update runtime LLM config. Persisted to runtime_settings.json."""
    llm_client.update_config(
        api_key=body.api_key or None,
        base_url=body.base_url or None,
        model=body.model or None,
        max_concurrency=body.max_concurrency,
    )
    cfg = llm_client.get_config()
    return LLMConfigResponse(**cfg, presets=PROVIDER_PRESETS)


@router.post("/llm/test", response_model=TestConnectionResponse)
async def test_llm_connection() -> TestConnectionResponse:
    """Send a minimal test request to verify the current LLM config works."""
    start = time.monotonic()
    try:
        reply = await llm_client.chat(
            [{"role": "user", "content": "Reply with exactly one word: OK"}],
            max_tokens=8,
            temperature=0,
        )
        latency = int((time.monotonic() - start) * 1000)
        return TestConnectionResponse(
            ok=True,
            latency_ms=latency,
            model=llm_client.model,
            message=f"连接成功，响应：{reply.strip()[:40]}",
        )
    except openai.AuthenticationError:
        return TestConnectionResponse(
            ok=False,
            latency_ms=0,
            model=llm_client.model,
            message="API Key 无效或已过期",
        )
    except openai.PermissionDeniedError:
        return TestConnectionResponse(
            ok=False,
            latency_ms=0,
            model=llm_client.model,
            message="请求被拒绝：API Key 无权限访问该模型，或账户余额不足",
        )
    except openai.NotFoundError:
        return TestConnectionResponse(
            ok=False,
            latency_ms=0,
            model=llm_client.model,
            message=f"模型 '{llm_client.model}' 不存在，请检查模型名称",
        )
    except openai.APIConnectionError:
        return TestConnectionResponse(
            ok=False,
            latency_ms=0,
            model=llm_client.model,
            message=f"无法连接到 {llm_client.base_url}，请检查 Base URL",
        )
    except Exception as exc:
        return TestConnectionResponse(
            ok=False,
            latency_ms=0,
            model=llm_client.model,
            message=f"{type(exc).__name__}: {str(exc)[:100]}",
        )
