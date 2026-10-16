# SmartLoo system context (DFD)

Owner: Özgür Kılıç — issue #12.

Integration draft, 16 October 2026; pending owner/TA review. Baseline: [requirements](../../REQUIREMENTS.MD).

![System context DFD](../assets/context.svg)

<details>
<summary>Editable Mermaid source</summary>

```mermaid
flowchart TB
    G["Guest"]
    U["Registered user"]
    A["Administrator"]
    S("0 SmartLoo")
    I["IBB dataset source"]
    P["AI provider"]
    B["Browser location service"]
    M["Map tile provider"]
    G -->|"Search / filters / facility ID / credentials"| S
    S -->|"Map / details / reviews / summary / auth result"| G
    U -->|"Token / review / suggestion / preferences / deletion request"| S
    S -->|"Operation result / suitable facilities"| U
    A -->|"Token / decision / status / filters / batch / export format"| S
    S -->|"Decision / metrics / counts / report"| A
    S -->|"Dataset retrieval request"| I
    I -->|"Facility metadata / optional historical usage"| S
    S -->|"Redacted evidence / separate task instructions"| P
    P -->|"Candidate JSON / error"| S
    S -->|"Location permission request"| B
    B -->|"Coordinates or permission failure"| S
    S -->|"Tile coordinates and zoom"| M
    M -->|"Base map tiles"| S
```

</details>

The boundary includes browser UI and backend. Guest, user and administrator are roles, not separate databases. Internal stores are hidden at context level. Rectangles are external entities, rounded rectangles are processes and cylinders in detailed DFDs are stores. Arrows carry named data; they do not prescribe call order.

IBB supplies downloadable metadata, not live occupancy or hygiene. Historical usage is optional and is not joined to facilities without a verified crosswalk. Map tiles do not supply SmartLoo facility records. Browser coordinates are distinct from a manually selected map center. Read-only search uses local data independently of AI availability. No secrets or account identifiers enter AI review payloads.

Detailed DFDs refine these boundary flows; their process numbers identify functions, not execution sequence.
