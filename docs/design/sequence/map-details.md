# Map and facility details · UC-09

`#37` implements a local detail panel backed by the selected facility object from the mock search dataset. The sequence below describes the target integration with the dedicated facility detail endpoint (`GET /api/v1/toilets/{toilet_id}`), which is currently a `501` placeholder route on the weekly branch (`#36`).

```mermaid
sequenceDiagram
    actor Visitor
    participant Map as React discovery map
    participant API as FastAPI facility details
    participant Store as Facility data access

    Map-->>Visitor: Show markers and an accessible results list
    Visitor->>Map: Select a marker or its list item
    Map-->>Visitor: Show loading state for selected facility
    Map->>API: GET /api/v1/toilets/{toilet_id}
    API->>Store: Read facility by ID
    alt Facility available
        Store-->>API: Facility details and available statistics
        API-->>Map: 200 OK facility details
        Map-->>Visitor: Open detail panel and label null/unknown values explicitly
        Map->>Map: Show user distance only when device location permission is granted
    else Facility unavailable
        Store-->>API: No visible facility for that ID
        API-->>Map: 404 facility unavailable
        Map-->>Visitor: Show unavailable state and keep browsing
    else Endpoint not implemented or network error
        API-->>Map: 501 Not Implemented / connection error
        Map-->>Visitor: Fallback to cached search item details or show error notice
    end
    opt Visitor closes the panel or selects a different facility
        Visitor->>Map: Close panel or select another marker
        Map->>Map: Clear previous facility details and update selection
    end
```

[Back to the Software Design Report](../REPORT.md)
