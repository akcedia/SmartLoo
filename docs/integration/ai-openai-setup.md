# #59 OpenAI adapter — configuration and verification

## Module and ownership

`src/ai_openai.py` implements a server-side Chat Completions provider with an
injected `httpx.AsyncClient`-compatible client. `httpx` already appears in the
shared dependency file; this slice does not edit dependencies or environment
files owned by Yusuf. The app's composition root (Özgür) owns the client's
lifetime and wiring into `SummaryService`. Import/construction makes no call.

```python
from src.ai_openai import OpenAISummaryProvider

# client: an async HTTP client, configured without automatic retries.
# model: team-selected, Structured Outputs-compatible model identifier.
provider = OpenAISummaryProvider.from_environment(client, model=model)
# Pass provider as SummaryService(..., provider=provider, ...).
```

The key is read only from the server's `OPENAI_API_KEY` environment variable.
Do not put it in the frontend, an issue, tests, repo files or chat. Missing key
or model fails configuration explicitly. The model has no assumed default;
configuration/cache policy must change when model/prompt/schema policy changes.
No new shared model environment-variable name is declared by this module.

The destination is fixed to `https://api.openai.com/v1/chat/completions`.
Redirects are disabled. There is one request with no adapter retry, with an
eight-second transport and total async limit; the encompassing service retains
its ten-second budget. Cancellation from the outer service propagates. Client
timeouts, source reads and fallback serialization still need full HTTP timing
verification. No latency SLA is inferred from the fake-transport tests.

## Input, prompt and output contract

Only 3–50 prepared records with temporary review refs and nonempty text are
accepted. Extra fields and duplicate refs are rejected. System instructions are
constant; review data is JSON in a separate user message and grants no tool or
URL authority. This is prompt separation, not proof of model injection immunity.

The request uses `response_format.type=json_schema` with `strict=true`, all
required fields and `additionalProperties=false` at each object. The remote
schema describes types/enums; local validation additionally enforces 400 Unicode
code points and pros/cons limits. It sends `store=false` (not a claim of zero
retention or an organization privacy policy), no tools, no streaming, and a
bounded completion-token allowance. A compatible model must be selected.

Refusal, tool-call output, incomplete completion, HTTP errors, oversized body,
malformed envelopes or invalid schema fail closed with a safe error code. The
summary service converts provider errors to null-summary/statistics fallback.
Raw error bodies, exception text, model output and authorization headers are not
logged by this adapter. Application/HTTP-client debug logging must be configured
appropriately in deployment. No automatic retry extends the deadline.

`SummaryOutputValidator` still requires production residual-privacy,
Turkish-language and grounding policies. Structured Outputs does not establish
those properties. The adapter does not yet supply recommendation reasons;
the recommendation selector's no-AI fallback remains available.

## Verified offline; live smoke pending

Run `python3 -m unittest discover -s tests -p 'test_ai_*.py' -v`.
The adapter suite has 16 tests: prompt separation, strict request shape, input
rejection, safe credentials, successful parsing, HTTP failures/no retry,
refusal/truncation/tool calls, bad schema, bounded response, transport timeout,
outer cancellation and service success/fallback wiring. It uses a fake transport
and a clearly synthetic key; no paid request or live model test was made.

For live smoke: obtain server access privately; select a compatible model; inject
the real client and reviewed validation policies; use synthetic review text;
check request count/latency, Turkish/schema/grounding and fallback; report the
model, commit, environment and actual results without recording secrets or raw
sensitive payloads. No code here claims that smoke has passed.

Sources checked 17 November 2026:
- [OpenAI Chat API reference](https://developers.openai.com/api/reference/resources/chat)
- [OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)
