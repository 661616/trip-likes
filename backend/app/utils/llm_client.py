from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.utils.token_counter import count_tokens

logger = logging.getLogger(__name__)

RUNTIME_SETTINGS_FILE = Path("runtime_settings.json")


@dataclass
class TokenUsage:
    """Accumulated token usage across calls."""

    prompt_tokens: int = 0
    completion_tokens: int = 0

    @property
    def total(self) -> int:
        return self.prompt_tokens + self.completion_tokens


class LLMClient:
    """Unified async LLM client supporting any OpenAI-compatible API.

    Features:
    - Runtime-updatable config (api_key, base_url, model) with JSON persistence
    - Concurrency limiting via asyncio.Semaphore
    - Exponential-backoff retry (up to 3 attempts)
    - Token counting per call
    - Robust JSON extraction from LLM responses
    """

    def __init__(self) -> None:
        saved = self._load_persisted()
        self.api_key = saved.get("api_key", settings.llm_api_key)
        self.base_url = saved.get("base_url", settings.llm_base_url)
        self.model = saved.get("model", settings.llm_model)
        self.max_concurrency = saved.get("max_concurrency", settings.llm_max_concurrency)
        self.usage = TokenUsage()
        self._rebuild_client()

    # ------------------------------------------------------------------
    # Config management
    # ------------------------------------------------------------------

    def get_config(self) -> dict:
        """Return current config (API key masked for display)."""
        masked = self.api_key[:6] + "..." + self.api_key[-4:] if len(self.api_key) > 12 else "***"
        return {
            "api_key_masked": masked,
            "base_url": self.base_url,
            "model": self.model,
            "max_concurrency": self.max_concurrency,
        }

    def update_config(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        max_concurrency: int | None = None,
    ) -> None:
        """Update runtime config and persist to disk."""
        if api_key is not None:
            self.api_key = api_key
        if base_url is not None:
            self.base_url = base_url
        if model is not None:
            self.model = model
        if max_concurrency is not None:
            self.max_concurrency = max_concurrency
        self._rebuild_client()
        self._persist()
        logger.info("LLM config updated: model=%s base_url=%s", self.model, self.base_url)

    def _rebuild_client(self) -> None:
        self._openai = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        self._semaphore = asyncio.Semaphore(self.max_concurrency)

    @staticmethod
    def _load_persisted() -> dict:
        if RUNTIME_SETTINGS_FILE.exists():
            try:
                return json.loads(RUNTIME_SETTINGS_FILE.read_text())
            except Exception:
                pass
        return {}

    def _persist(self) -> None:
        data = {
            "api_key": self.api_key,
            "base_url": self.base_url,
            "model": self.model,
            "max_concurrency": self.max_concurrency,
        }
        RUNTIME_SETTINGS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    # ------------------------------------------------------------------
    # Public chat API
    # ------------------------------------------------------------------

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        json_mode: bool = False,
    ) -> str:
        """Send a chat completion request and return the text response."""
        return await self._call(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
        )

    async def chat_json(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> dict:
        """Send a chat request expecting a JSON response."""
        raw = await self._call(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=True,
        )
        return self._parse_json(raw)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10), reraise=True)
    async def _call(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float,
        max_tokens: int,
        json_mode: bool,
    ) -> str:
        prompt_text = " ".join(m["content"] for m in messages)
        self.usage.prompt_tokens += count_tokens(prompt_text, self.model)

        kwargs: dict = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        async with self._semaphore:
            logger.debug("LLM call: model=%s", self.model)
            response = await self._openai.chat.completions.create(**kwargs)

        content = response.choices[0].message.content or ""
        self.usage.completion_tokens += count_tokens(content, self.model)
        return content

    @staticmethod
    def _parse_json(raw: str) -> dict:
        """Extract a JSON object from raw LLM output with regex fallback."""
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        logger.error("Failed to parse JSON from LLM output: %s", raw[:200])
        return {}


# Module-level singleton shared across all services
llm_client = LLMClient()
