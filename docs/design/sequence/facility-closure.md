# Facility closure and retained reviews · UC-10 / FR-10

The second UC-10 element protects historical reviews and keeps the facility identity stable.

```mermaid
sequenceDiagram
    actor Admin
    participant API as Facility administration
    participant PG as PostgreSQL / PostGIS
    participant Mongo as MongoDB reviews
    Admin->>API: PATCH /api/v1/admin/toilets/{id} with CLOSED
    alt Missing session, wrong role or unknown facility
        API-->>Admin: 401, 403 or 404
    else Authorized
        API->>PG: Update facility status to CLOSED
        Note over PG,Mongo: Keep facility identity, reviews and historical scores
        PG-->>API: Updated facility
        API-->>Admin: 200 with updated status
    end
```

[Back to the Software Design Report](../REPORT.md)
