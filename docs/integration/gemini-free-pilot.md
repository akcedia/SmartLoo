# Gemini free-tier pilot (22 November 2026)

Özgür selected Gemini's free quota for the optional live-provider pilot. This
does not authorize paid billing, an OpenAI fallback or external publication.

## Behavior

`GeminiSummaryProvider` uses Google's fixed native `generateContent` endpoint,
the shared evidence validator/summary JSON schema and existing restricted Turkish
prompt. Credentials are server-side `x-goog-api-key` headers, never URL query
parameters. One request, no retries/redirects/tools, eight-second provider budget,
1,200 output tokens and a 64 KiB accepted response limit. Blocked, incomplete,
tool-bearing, malformed or invalid summaries are rejected. The surrounding
revision/publication/privacy guards remain unchanged.

Only `gemini-3.1-flash-lite` is currently accepted by this adapter. Provider,
model and prompt identity separate its cache from OpenAI and synthetic-provider
entries. An absent Gemini key or a quota/provider failure never switches to
OpenAI. Existing default-disabled behavior and explicit injected test providers
are preserved.

This adds the summary provider; facility recommendations still use the documented
real-PostGIS, distance-first fallback with no fabricated AI reasons. Live Turkish
language/grounding acceptance is still required. A valid JSON schema alone is
not evidence of an accurate summary.

## Private configuration

1. In [Google AI Studio](https://aistudio.google.com/apikey), create/select a project
   shown on the **Free** tier. Do not enable paid billing for this pilot. A model
   name in application settings cannot establish a project's billing status.
2. Run `python scripts/configure_gemini.py` interactively from this checkout.
   It masks key entry and creates ignored `.venv/gemini.env`; no existing file is
   overwritten, no live request is sent. Do not paste keys into chat, GitHub or
   command arguments.
3. The generated file contains `SMARTLOO_AI_PROVIDER=gemini`,
   `SMARTLOO_AI_PROFILE=restricted-tr-evidence-v1`,
   `SMARTLOO_AI_MODEL=gemini-3.1-flash-lite` and the private `GEMINI_API_KEY`.
   The application must explicitly load these values into its server environment;
   creating the file alone does not enable the running Docker application.
4. First live validation must use labelled synthetic comments, confirm an actual
   valid response, quota behavior and reviewed Turkish grounding, then record
   redacted results. User-directory data and real comments are not pilot fixtures.
   `python scripts/check_gemini_pilot.py --confirm-free-tier` performs at most
   one native-provider request using three fixed synthetic comments. It validates
   the schema and existing restricted policy and saves ignored
   `.venv/gemini-pilot.json`. It refuses to overwrite an earlier result. Only use
   the confirmation flag after checking that the project is actually on Free.
   This provider-only pilot does not claim end-to-end HTTP or academic acceptance.

Google lists free input/output for this model, with rate/project limits and
content use for product improvement. Free quota is not unlimited or a general
privacy guarantee. Verify the account's actual model entitlement and quota;
never add paid billing automatically after 403/404/429.

Sources checked on 22 November 2026:
[pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output),
[native generateContent API](https://ai.google.dev/api/generate-content).

## Evidence boundary

The new adapter was first absent when its synthetic transport tests were added
(collection failed with `ModuleNotFoundError`). Adapter/runtime tests use fake
HTTP only; they cannot establish live model compatibility or free quota access.
No Gemini key, live request, paid resource or real user comment was used during
implementation. Codex prepared the adapter and tests at Özgür's request; human
review and GitHub updates remain pending.
