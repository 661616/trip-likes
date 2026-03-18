from __future__ import annotations

import logging

import tiktoken

logger = logging.getLogger(__name__)

_ENCODING_CACHE: dict[str, tiktoken.Encoding] = {}


def _get_encoding(model: str) -> tiktoken.Encoding:
    """Return a tiktoken encoding for the given model, with caching."""
    if model not in _ENCODING_CACHE:
        try:
            _ENCODING_CACHE[model] = tiktoken.encoding_for_model(model)
        except KeyError:
            _ENCODING_CACHE[model] = tiktoken.get_encoding("cl100k_base")
            logger.warning("No encoding for model=%s, falling back to cl100k_base", model)
    return _ENCODING_CACHE[model]


def count_tokens(text: str, model: str = "gpt-4o-mini") -> int:
    """Count the number of tokens in *text* for the given *model*."""
    enc = _get_encoding(model)
    return len(enc.encode(text))
