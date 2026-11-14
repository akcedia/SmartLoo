# Review lifecycle · UC-03 / FR-03

Target design. The review store enforces one active author/facility pair. Change events coordinate aggregates and summary cache across stores.

```mermaid
sequenceDiagram
    actor User
    participant API as Review API
    participant Auth as Account access
    participant DB as Facility store
    participant Mongo as Review store
    User->>API: POST facility review or PATCH / DELETE review
    API->>Auth: Validate JWT and load account
    alt Missing or invalid token
        API-->>User: 401
    else Authenticated
        alt Create
            API->>DB: Check facility exists and accepts reviews
            alt Unknown facility or invalid score
                API-->>User: 404 or 422
            else Valid request
                API->>Mongo: Insert review with unique user and facility
                alt Existing review
                    API-->>User: 409
                else Created
                    Mongo-->>API: New review
                    API-->>User: 201
                end
            end
        else Edit or delete
            API->>Mongo: Load review and owner
            alt Missing review
                API-->>User: 404
            else Not owner and no ADMIN delete permission
                API-->>User: 403
            else Authorized
                API->>Mongo: Validate and update, or delete review
                API-->>User: 200 update or 204 delete, 422 on invalid edit
            end
        end
        opt A review changed
            API->>DB: Reconcile aggregate and advance summary version
            Note over API,DB: Cross-store retry and reconciliation are target design
        end
    end
```

[Back to the Software Design Report](../REPORT.md)
