# Facility suggestion and moderation · UC-05 / FR-05

The two approved UC-05 elements share this target model. Pending and rejected suggestions are hidden from the public map.

```mermaid
sequenceDiagram
    actor User
    actor Admin
    participant API as Suggestion API
    participant PG as PostgreSQL / PostGIS
    User->>API: POST /api/v1/toilets/suggest
    alt Invalid session or invalid data
        API-->>User: 401 or 422
    else Valid USER request
        API->>PG: Save pending suggestion
        API-->>User: 202 with suggestion ID and pending status
    end
    Admin->>API: PATCH /api/v1/admin/suggestions/{id}
    alt Missing session, wrong role or unknown suggestion
        API-->>Admin: 401, 403 or 404
    else Authorized decision on pending suggestion
        alt Approve
            API->>PG: Atomically publish facility and record approval
        else Reject
            API->>PG: Record rejection without creating a facility
        end
        API-->>Admin: 200 with decision
    end
```

[Back to the Software Design Report](../REPORT.md)
