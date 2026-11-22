"""Explicit AI composition; no model call or experimental policy enabled by default."""
import os
from contextlib import AsyncExitStack, asynccontextmanager

import httpx
from redis.asyncio import Redis
from redis.asyncio.retry import Retry
from redis.backoff import NoBackoff

from src.ai_openai import SYSTEM_INSTRUCTIONS, OpenAISummaryProvider
from src.ai_gemini import GeminiSummaryProvider
from src.ai_restricted_policy import (
    POLICY_VERSION, PROFILE_NAME, RESTRICTED_PROMPT_VERSION, restricted_preparer,
    restricted_summary_instructions, restricted_validator,
)
from src.ai_review_adapter import CoordinatedReviewRepository
from src.ai_summary_service import RedisSummaryCache, SummaryService


@asynccontextmanager
async def ai_lifespan(app, *, provider=None, cache=None, profile=None):
    app.state.summary_service = None
    selected = os.getenv("SMARTLOO_AI_PROFILE", "") if profile is None else profile
    async with AsyncExitStack() as resources:
        if selected:
            if selected not in (PROFILE_NAME, POLICY_VERSION):
                raise ValueError("Unsupported AI profile")
            # This finite grammar is opt-in, never a general Turkish privacy claim.
            if provider is None:
                provider_name = os.getenv("SMARTLOO_AI_PROVIDER", "openai")
                if provider_name not in ("openai", "gemini"):
                    raise ValueError("Unsupported AI provider")
                model = os.getenv("SMARTLOO_AI_MODEL", "")
                key = os.getenv("GEMINI_API_KEY" if provider_name == "gemini" else "OPENAI_API_KEY", "")
                if model and key:
                    http = await resources.enter_async_context(httpx.AsyncClient())
                    provider_class = GeminiSummaryProvider if provider_name == "gemini" else OpenAISummaryProvider
                    provider = provider_class(
                        http, api_key=key, model=model,
                        system_instructions=f"{SYSTEM_INSTRUCTIONS}\n\n{restricted_summary_instructions()}",
                    )
                    identity = f"{provider_name}:{provider.model}:{RESTRICTED_PROMPT_VERSION}"
            else:
                # Injected providers are for explicitly composed tests/integrations.
                identity = "injected-test-provider-v1"
            if provider is not None:
                if cache is None:
                    client = Redis.from_url(os.getenv("SMARTLOO_REDIS_URL", "redis://127.0.0.1:6379/0"),
                        decode_responses=True, socket_connect_timeout=1, socket_timeout=1,
                        retry=Retry(NoBackoff(), 0))
                    resources.push_async_callback(client.aclose)
                    cache = RedisSummaryCache(client)
                repository = CoordinatedReviewRepository(app.state.review_ai_coordinator)
                app.state.summary_service = SummaryService(repository, cache, provider,
                    prepare_evidence=restricted_preparer(), validate_output=restricted_validator(),
                    policy_version=f"{POLICY_VERSION}:author-redaction-v1:{identity}",
                    publish_current=repository.publish_current)
        try:
            yield
        finally:
            app.state.summary_service = None
