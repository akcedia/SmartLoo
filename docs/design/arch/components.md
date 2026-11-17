# SmartLoo component architecture

Solid arrows show interfaces available in the approved weekly integration snapshot or used by the map prototype. Dashed arrows show planned application connections. The route labels use the /api/v1 prefix.

```mermaid
flowchart LR
    UI["React client"] -->|"HTTPS tile requests"| Tiles["Map tile provider"]
    UI -.->|"HTTPS JSON /api/v1"| API
    subgraph FastAPI["FastAPI application"]
        API["HTTP routes"] -->|"GET /toilets/nearby"| Search["Discovery"]
        API -.->|"POST /auth/register, /auth/login"| Auth["Accounts"]
        API -.->|"Reviews and suggestions API"| Community["Community"]
        API -.->|"Summary and export API"| Admin["Analytics"]
        API -.->|"POST /admin/import"| Import["Facility import"]
        API -.->|"Summary and recommendations API"| AI["AI orchestration"]
    end
    Search -->|"SQL nearby_toilets()"| PG["PostgreSQL / PostGIS"]
    Auth -.->|"SQL users and login failures"| PG
    Community -.->|"SQL facilities and suggestions"| PG
    Community -.->|"MongoDB reviews read/write"| Mongo["MongoDB"]
    Admin -.->|"SQL facilities by district"| PG
    Admin -.->|"read_review_scores()"| Mongo
    Import -.->|"SQL transactional upsert"| PG
    IBB["İBB open data"] -.->|"HTTPS GeoJSON download"| Import
    AI -.->|"Eligible review snapshot"| Community
    AI -.->|"Redis GET / SET with TTL"| Redis["Redis"]
    AI -.->|"HTTPS structured JSON request"| Provider["AI provider"]
```

[Back to the Software Design Report](../REPORT.md)
