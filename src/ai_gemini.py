"""Bounded Gemini provider; shared evidence/schema validation, no SDK or retries."""
import asyncio
import json

from src.ai_openai import SYSTEM_INSTRUCTIONS, ProviderError, build_summary_request, summary_schema
from src.ai_output import validate_summary_schema
from src.ai_recommendations import (
    REASON_INSTRUCTIONS, parse_recommendation_reasons,
    recommendation_reason_payload, recommendation_reason_schema,
)

MODEL = "gemini-3.1-flash-lite"


class _GeminiStructuredProvider:
    def __init__(self, client, *, api_key, model, timeout_seconds=8,
                 system_instructions=SYSTEM_INSTRUCTIONS):
        if not isinstance(api_key, str) or not api_key.strip() or any(c.isspace() for c in api_key):
            raise ValueError("missing_or_invalid_gemini_key")
        if model != MODEL:
            raise ValueError("unsupported_gemini_model")
        if type(timeout_seconds) not in (int, float) or not 0 < timeout_seconds < 10:
            raise ValueError("invalid_provider_timeout")
        self.client, self._api_key, self.model = client, api_key, model
        self.timeout_seconds, self.system_instructions = timeout_seconds, system_instructions

    async def _generate(self, content, schema, max_tokens):
        payload = {
            "systemInstruction": {"parts": [{"text": self.system_instructions}]},
            "contents": [{"role": "user", "parts": [{"text": content}]}],
            "generationConfig": {"responseMimeType": "application/json",
                                 "responseJsonSchema": schema, "maxOutputTokens": max_tokens},
        }
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        try:
            response = await asyncio.wait_for(self.client.post(endpoint,
                headers={"x-goog-api-key": self._api_key}, json=payload,
                timeout=self.timeout_seconds, follow_redirects=False), timeout=self.timeout_seconds)
        except asyncio.TimeoutError:
            raise ProviderError("gemini_timeout") from None
        except Exception:
            raise ProviderError("gemini_transport_error") from None
        try:
            if response.status_code != 200:
                raise ProviderError("gemini_http_error")
            if len(response.content) > 65536:
                raise ProviderError("gemini_response_too_large")
            body = response.json()
            if body.get("promptFeedback", {}).get("blockReason"):
                raise ProviderError("gemini_blocked_response")
            candidates = body["candidates"]
            if not isinstance(candidates, list) or len(candidates) != 1:
                raise ProviderError("gemini_invalid_candidates")
            candidate = candidates[0]
            if candidate["finishReason"] != "STOP":
                raise ProviderError("gemini_incomplete_response")
            content = candidate["content"]
            parts = content["parts"]
            if content.get("role") != "model" or not isinstance(parts, list) or not parts:
                raise ProviderError("gemini_invalid_message")
            if any(not isinstance(part, dict) or not set(part) <= {"text", "thoughtSignature"}
                   or not isinstance(part["text"], str) for part in parts):
                raise ProviderError("gemini_non_text_response")
            return "".join(part["text"] for part in parts)
        except ProviderError:
            raise
        except Exception:
            raise ProviderError("gemini_invalid_output") from None


class GeminiSummaryProvider(_GeminiStructuredProvider):
    async def __call__(self, evidence):
        checked = build_summary_request(evidence, model=self.model,
                                        system_instructions=self.system_instructions)
        text = await self._generate(checked["messages"][1]["content"], summary_schema(), 1200)
        try:
            return validate_summary_schema(text)
        except ValueError:
            raise ProviderError("gemini_invalid_output") from None


class GeminiRecommendationProvider(_GeminiStructuredProvider):
    def __init__(self, client, *, api_key, model, timeout_seconds=8):
        super().__init__(client, api_key=api_key, model=model, timeout_seconds=timeout_seconds,
                         system_instructions=REASON_INSTRUCTIONS)

    async def __call__(self, evidence):
        payload = recommendation_reason_payload(evidence)
        candidates = [{"candidate_ref": ref, "allowed_claims": claims}
                      for ref, claims in payload.items()]
        text = await self._generate(json.dumps({"candidates": candidates}),
                                    recommendation_reason_schema(payload), 600)
        try:
            return parse_recommendation_reasons(text, payload)
        except ValueError:
            raise ProviderError("gemini_invalid_output") from None
