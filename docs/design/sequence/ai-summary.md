
# AI Review Summarization Sequence — UC-04 / FR-04

## Purpose

This sequence diagram describes the proposed AI-powered review summarization workflow in SmartLoo.

The design includes Redis caching, MongoDB review retrieval, personal data sanitization, structured AI output validation, and graceful fallback behavior.

This is a target design, not evidence of a completed production integration.

## Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant UI as React Frontend
    participant API as FastAPI AI Service
    participant Cache as Redis
    participant Reviews as MongoDB
    participant DB as PostgreSQL
    participant AI as OpenAI Provider

    User->>UI: Open toilet details
    UI->>API: GET /api/v1/toilets/{id}/summary
    API->>Cache: Check valid cached summary

    alt Cache hit
        Cache-->>API: Return cached summary
        API-->>UI: 200 AI summary
    else Cache miss or stale entry
        API->>Reviews: Fetch up to 50 eligible recent reviews
        Reviews-->>API: Return review data

        alt Fewer than 3 eligible reviews
            API-->>UI: 200 summary=null and insufficient reviews message
        else 3 to 50 eligible reviews
            API->>API: Remove personal identifiers
            API->>API: Treat review text as untrusted input
            API->>AI: Request Turkish structured summary

            alt Valid response within time limit
                AI-->>API: Structured JSON response
                API->>API: Validate schema and evidence
                API->>Cache: Cache valid summary for 6 hours
                API-->>UI: 200 summary, pros, cons, recommendation
            else Provider error, timeout or invalid output
                API->>DB: Read cleanliness average and review count
                DB-->>API: Existing facility statistics
                API-->>UI: 200 summary=null with statistics
            end
        end
    end

    UI-->>User: Display summary or fallback message

    Note over API,AI: AI request timeout limit is 10 seconds
    Note over API,DB: Nearby search must remain independent of AI availability
```

## Design Constraints

- AI summaries require at least 3 eligible reviews.
- At most 50 recent eligible reviews are used as input.
- Personally identifiable information must be removed before external AI calls.
- AI-generated summaries must be written in Turkish and limited to 400 characters.
- Output must follow the approved structured JSON contract.
- Valid summaries may be cached in Redis for 6 hours.
- Review changes must prevent stale summaries from being served.
- AI provider failures, invalid responses, or 10-second timeouts must trigger a fallback.
- The fallback returns `summary=null` with existing cleanliness statistics.
- Nearby toilet search must not depend on AI service availability.

## Integration Status

This diagram specifies the intended workflow. Live OpenAI integration, review-store coordination, cache invalidation implementation, and end-to-end verification are separate implementation tasks.

Refs #14, #28, #39 and #46.

