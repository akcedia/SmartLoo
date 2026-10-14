# Suggestion and moderation business process

Owner: Özgür Kılıç. Initial model, 14 October 2026. FR-05, FR-08 and FR-10.

```mermaid
flowchart TD
    Start(["New facility suggestion"]) --> Auth{"Valid user token?"}
    Auth -->|"No"| R401["401, no write"]
    Auth -->|"Yes"| Fields{"Valid required metadata and coordinates?"}
    Fields -->|"No"| R422["422, no write"]
    Fields -->|"Yes"| Pending["Store pending suggestion, return 202"]
    Pending --> Private["Exclude from public facility search"]
    Private --> Decision(["Administrator decision request"])
    Decision --> AdminToken{"Valid authentication?"}
    AdminToken -->|"No"| R401
    AdminToken -->|"Yes"| Role{"ADMIN role?"}
    Role -->|"No"| R403["403, no write"]
    Role -->|"Yes"| Exists{"Suggestion exists?"}
    Exists -->|"No"| R404["404, no write"]
    Exists -->|"Yes"| Choice{"Valid approved or rejected decision?"}
    Choice -->|"No"| R422
    Choice -->|"Rejected"| Reject["Mark rejected; keep outside public results"]
    Choice -->|"Approved"| Publish["Publish valid facility and mark approved consistently"]
    Reject --> Done["Return 200 decision result"]
    Publish --> Done
```

Only an approved suggestion creates an eligible public facility; normal open/radius/filter rules still apply. Approval does not prove that the toilet is currently open. Suggested coordinates and metadata must remain valid. Successful moderation must not expose an approved status without its corresponding facility being published consistently.

Repeated decisions, duplicate suggested locations and the exact rejection/conflict policy are not fully specified in the baseline. They must be agreed during team review; do not invent response codes or claim those scenarios are tested. Related tests: TC-07 and TC-18, with FR-08 role rules.
