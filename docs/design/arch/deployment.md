# SmartLoo deployment view

The current local setup runs Vite and Uvicorn on the developer host and PostGIS in Docker Compose. Ports 5173 and 8000 are dev defaults. PostGIS uses host port 5432 by default and a named volume. #54 proposes a Vite proxy for the map. The target layout shows boundaries and interfaces without assuming a cloud vendor.


## Current local setup

```mermaid
flowchart LR
    Browser["Developer browser"]
    subgraph Host["Developer workstation"]
        Vite["Vite / React :5173"]
        API["Uvicorn / FastAPI :8000"]
        subgraph Docker["Docker Compose"]
            PG["PostGIS :5432"]
            Vol["Named database volume"]
            PG -->|"Persist database files"| Vol
        end
        API -->|"PostgreSQL TCP via configured host port"| PG
    end
    Browser -->|"HTTP UI and assets"| Vite
    Browser -->|"Local API requests"| API
```

## Planned deployment

```mermaid
flowchart TB
    Browser["User browser"] -->|"HTTPS"| Edge["Public HTTPS entry point"]
    Edge -->|"Static asset requests"| Web["React site"]
    Edge -->|"HTTPS /api/v1"| API["FastAPI service"]
    subgraph Private["Private datastore network"]
        PG["PostgreSQL / PostGIS"]
        Mongo["MongoDB"]
        Redis["Redis"]
    end
    API -->|"PostgreSQL protocol"| PG
    API -->|"MongoDB protocol"| Mongo
    API -->|"Redis protocol"| Redis
    API -->|"HTTPS redacted AI request"| AI["AI provider"]
    Browser -->|"HTTPS tile requests"| Tiles["Map tile provider"]
```

Only the web and API entry point is public in the target. Store credentials and provider keys at the service boundary. Actual hosting and deployment verification remain open.

[Back to the Software Design Report](../REPORT.md)
