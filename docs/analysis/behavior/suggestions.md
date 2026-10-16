# Suggestion, moderation and facility closure (DFD)

Owner: Özgür Kılıç — issue #12.

Integration draft, 16 October 2026; pending owner/TA review. Baseline: [requirements](../../REQUIREMENTS.MD).

![Suggestion, moderation and closure DFD](../assets/suggestions.svg)

<details>
<summary>Editable Mermaid source</summary>

```mermaid
flowchart TB
    U["Registered user"]
    A["Administrator"]
    P1("5.1 Authorize and validate suggestion")
    P2("5.2 Validate decision and reconcile publication")
    P3("10.1 Authorize facility status change")
    D1[("D1 Users")]
    D3[("D3 Suggestions")]
    D5[("D5 Toilets")]
    U -->|"Token / proposed metadata and coordinates"| P1
    D1 -->|"Account identity"| P1
    P1 -->|"Valid pending suggestion"| D3
    P1 -->|"202 ID and pending status / 401 / 422"| U
    A -->|"Token / suggestion ID / approve or reject"| P2
    D1 -->|"Account / ADMIN role"| P2
    D3 -->|"Suggestion and current decision"| P2
    P2 -->|"Decision / moderator / published facility ID"| D3
    P2 -->|"Valid approved facility"| D5
    P2 -->|"200 decision / 401 / 403 / 404 / 422"| A
    A -->|"Token / facility ID / status"| P3
    D1 -->|"Account / ADMIN role"| P3
    D5 -->|"Existing facility"| P3
    P3 -->|"Updated status; preserve facility identity"| D5
    P3 -->|"200 status result / authorization or target error"| A
```

</details>

FR-05 and the facility-closure part of FR-10; protected by FR-08.

Pending/rejected suggestions are never queried as public facilities. Approval publishes a valid facility and the linked decision consistently, returning success only after both obligations are met. Approval does not prove current opening: normal radius, amenity, administrative status and opening-hour checks still apply. Reviewed facilities are marked CLOSED, not hard-deleted; existing reviews remain attached.

Fırat's proposed SQL Suggestion stores nullable submitter/moderator and published toilet ID. `source='suggestion'`, `source_id=suggestion.id` is a proposed reserved namespace; imported batches must not impersonate it. Storage and namespace enforcement remain design choices. An approved suggestion publishes one facility; pending/rejected ones publish none.

Repeated decisions, duplicate physical locations and concurrent approvals remain explicit design decisions. No new conflict status code or automatic merge policy is specified here. A retry must not publish a second facility; the final idempotency/recovery mechanism needs design review. Personal-data deletion detaches account references and removes/redacts retained personal text.

Tests: TC-07, TC-18, TC-27; authorization follows REQ-SEC-03/04.
