# Administrator facility import · UC-07 / FR-07

The admin batch import is separate from the normalization of raw İBB GeoJSON. A stable source identity is a prerequisite for production ingestion.

```mermaid
sequenceDiagram
    actor Admin
    participant API as Import API
    participant Validator as Batch validator
    participant PG as PostgreSQL / PostGIS
    Admin->>API: POST /api/v1/admin/import with CSV or JSON
    alt Missing session or wrong role
        API-->>Admin: 401 or 403
    else Authorized
        API->>Validator: Parse and validate all rows and source identities
        alt Any row invalid
            Validator-->>API: Row-level validation errors
            API-->>Admin: 422 with errors, zero writes
        else Batch valid
            Validator-->>API: Normalized facility records
            API->>PG: Transactional upsert by source and source_id
            Note over API,PG: Preserve ibb_source_id where available
            PG-->>API: Inserted and updated counts
            API-->>Admin: 200 with inserted, updated and rejected counts
        end
    end
```

[Back to the Software Design Report](../REPORT.md)
