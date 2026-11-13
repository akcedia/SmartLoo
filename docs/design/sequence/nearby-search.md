# Nearby search and filtering · UC-01 and UC-02

The API and database interactions are implemented on the weekly branch (`#35`). The React-to-API connection shown here is the target integration for the current React/Leaflet map implementation (`#37`), which currently uses a local mock adapter (`toiletApi.js`) until connected to the live endpoint.

```mermaid
sequenceDiagram
    actor Visitor
    participant Map as React discovery map
    participant Geo as Browser Geolocation
    participant API as FastAPI nearby route
    participant Store as PostGIS adapter
    participant DB as PostgreSQL and PostGIS

    Visitor->>Map: Open nearby search
    Map->>Geo: Request current position
    alt Geolocation granted
        Geo-->>Map: Device coordinates (lat, lon)
        Map->>Map: Center on user location & show user pin
    else Geolocation denied or unavailable
        Geo-->>Map: Permission denied / error
        Map->>Map: Fallback to default center (Taksim), hide user distance & show warning banner
    end

    loop Initial search, radius update, or filter change
        opt Visitor toggles or clears filters
            Visitor->>Map: Select/clear accessibility, baby changing, free, or open_now
        end
        Map->>API: GET /api/v1/toilets/nearby (lat, lon, radius, filters)
        alt Network or server failure
            API-->>Map: Connection error / 5xx
            Map-->>Visitor: Show error banner and preserve previous view
        else Invalid query
            API-->>Map: 422 validation error
            Map-->>Visitor: Show parameter validation notice
        else Valid query
            API->>Store: find_nearby with validated parameters
            Store->>DB: Parameterized nearby_toilets spatial query
            alt Database unavailable
                DB-->>Store: Connection failure
                Store-->>API: Operational or interface error
                API-->>Map: 503 temporarily unavailable
                Map-->>Visitor: Show service unavailable message
            else Query succeeds
                DB-->>Store: Rows ordered by distance, then facility ID
                Store-->>API: Result rows, possibly empty
                API-->>Map: 200 OK { count, results }
                alt count > 0
                    Map-->>Visitor: Render facility markers with distance (if location granted)
                else count == 0
                    Map-->>Visitor: Show empty state ("No open toilets found nearby")
                end
            end
        end
    end