# Preference recommendations · UC-04 / FR-04

This is the second interaction in UC-04. The recommendation path ranks suitable facilities from request preferences.

```mermaid
sequenceDiagram
    actor User
    participant UI as React map
    participant API as Recommendation API
    participant Search as Discovery and statistics
    participant AI as AI orchestration
    User->>UI: Choose amenities and request suggestions
    UI->>API: GET /api/v1/recommendations with JWT, origin and preferences
    alt Invalid session or input
        API-->>UI: 401 or 422
    else Valid request
        API->>Search: Filter hard constraints and load eligible facilities
        Search-->>API: Candidates, distance, cleanliness and available sentiment
        API->>API: Rank suitable candidates and select at most three
        opt Candidates exist and AI is available
            API->>AI: Request grounded reasons for selected facilities
            AI-->>API: Validated reasons or fallback
        end
        API-->>UI: 200 suitable results, including empty results where applicable
        UI-->>User: Show facilities even if AI reasons are unavailable
    end
```

[Back to the Software Design Report](../REPORT.md)
