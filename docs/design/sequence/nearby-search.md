# Nearby search and filtering · UC-01 and UC-02

The API and database interactions are implemented on the weekly branch. The React-to-API connection shown here is the target integration for the current mock map.

```mermaid
sequenceDiagram
    actor Visitor
    participant Map as React discovery map
    participant API as FastAPI nearby route
    participant Store as PostGIS adapter
    participant DB as PostgreSQL and PostGIS

    Visitor->>Map: Open nearby search
    alt Geolocation granted
        Map->>Map: Use device coordinates
    else Geolocation denied
        Map->>Map: Use explicit viewport center and hide user distance
    end
    loop Initial search or filter change
        opt Visitor changes or clears filters
            Visitor->>Map: Select accessibility, baby changing or price
        end
        Map->>API: GET /api/v1/toilets/nearby with origin, radius and filters
        alt Invalid query
            API-->>Map: 422 validation error
        else Valid query
            API->>Store: find_nearby with validated parameters
            Store->>DB: Parameterized nearby_toilets call
            alt Database unavailable
                DB-->>Store: Connection failure
                Store-->>API: Operational or interface error
                API-->>Map: 503 temporarily unavailable
            else Query succeeds
                DB-->>Store: Rows ordered by distance, then facility ID
                Store-->>API: Result rows, possibly empty
                API-->>Map: 200 with count and results
                Map-->>Visitor: Refresh markers and list, or show empty state
            end
        end
    end
```

For UC-01, the client requests `open_now=true` when showing nearby open facilities. Clearing an amenity filter omits that parameter. The implementation accepts radius 1–50,000 m and returns 200 for zero matches. Refs #25, #26 and #35.
