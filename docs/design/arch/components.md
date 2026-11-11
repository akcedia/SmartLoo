# SmartLoo component architecture

Solid edges identify the search implementation on the weekly branch and the map UI's public interface with its tile provider. Dotted edges show intended integration or planned services. The React/Leaflet discovery screen currently uses mock facility data in #37.

```mermaid
flowchart LR
    Browser[React + Leaflet] --> Tiles[Map tiles]
    Browser -.->|HTTPS API| API[FastAPI routes]

    subgraph Backend[FastAPI application]
        API --> Search[Discovery]
        API -.-> Auth[Accounts and access]
        API -.-> Community[Reviews and moderation]
        API -.-> Admin[Admin analytics]
        API -.-> Import[Facility import]
        API -.-> AI[AI orchestration]
    end

    Search -->|nearby_toilets| PG[(PostgreSQL + PostGIS)]
    Auth -.-> PG
    Community -.-> PG
    Community -.-> Mongo[(MongoDB)]
    Admin -.-> PG
    Admin -.-> Mongo
    Import -.-> PG
    IBB[İBB GeoJSON] -.-> Import
    AI -.->|Eligible reviews| Community
    AI -.-> Redis[(Redis)]
    AI -.->|Redacted input| Provider[AI provider]
```
