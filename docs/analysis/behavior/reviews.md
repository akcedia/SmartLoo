# Review management (DFD)

Owner: Özgür Kılıç — issue #12.

Integration draft, 16 October 2026; pending owner/TA review. Baseline: [requirements](../../REQUIREMENTS.MD).

![Review management DFD](../assets/reviews.svg)

<details>
<summary>Editable Mermaid source</summary>

```mermaid
flowchart TB
    U["User / administrator"]
    P1("3.1 Authorize and validate review change")
    P2("3.2 Apply review change and reconcile derived data")
    D1[("D1 Users")]
    D2[("D2 Reviews")]
    D5[("D5 Toilets and aggregates")]
    D6[("D6 Summary cache")]
    U -->|"Token / operation / target / score / comment"| P1
    D1 -->|"Account and role"| P1
    D2 -->|"Owner / existing user-facility review"| P1
    D5 -->|"Facility identity"| P1
    P1 -->|"401 / 403 / 404 / 409 / 422 error"| U
    P1 -->|"Authorized valid change"| P2
    D2 -->|"Current facility scores"| P2
    P2 -->|"Created / edited / deleted review"| D2
    P2 -->|"Recomputed mean and count"| D5
    P2 -->|"Affected facility invalidation / revision"| D6
    P2 -->|"201 / 200 / 204 result after consistency obligations"| U
```

</details>

FR-03, with FR-08 authorization, FR-10 integrity and FR-04 cache effects.

- Create takes the user ID from the verified token. One current review per non-null `(user_id, toilet_id)`; duplicate creation returns 409. Anonymous retained reviews do not collide under that rule.
- Owner may edit/delete; ADMIN may delete any review, but role alone does not permit editing another user's review.
- Score is an integer 1–5; optional comment is at most 1000 characters. Invalid input returns 422, missing target 404, invalid authentication 401 and forbidden operation 403. These failures make no review changes.
- Public reading is provided by the map/detail model; this diagram refines mutation requests only.
- Recompute the actual mean and count and invalidate the affected summary before acknowledging success or serving stale summaries. With no reviews, mean is null and count is zero.
- Cross-store atomicity is not assumed. Recovery must retain affected facility IDs and operation identity; retries must not create duplicate reviews or lose invalidation work. The durable coordination mechanism remains a design decision. Failed coordination must not be reported as completed success.

Tests: TC-05, TC-06, TC-26, TC-31, TC-32, TC-35, TC-46; related TC-16, TC-33 and TC-41–43. These specify behavior; no implementation pass is claimed.
