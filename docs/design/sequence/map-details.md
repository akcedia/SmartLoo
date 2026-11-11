# Map and facility details · UC-09

#37 shows a local detail card backed by mock data. The sequence describes the target connection to the selected facility detail endpoint, currently a 501 route on the weekly branch.

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
        API-->>Map: 200 facility details
        Map-->>Visitor: Show details and label unknown values
        Map->>Map: Show user distance only for known device location
    else Facility unavailable
        Store-->>API: No visible facility for that ID
        API-->>Map: 404 facility unavailable
        Map-->>Visitor: Show unavailable state and keep browsing
    end
    opt Visitor closes the panel or selects a different facility
        Visitor->>Map: Close or change selection
        Map->>Map: Clear the previous facility details
    end
```
