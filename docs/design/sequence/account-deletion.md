# Account deletion · UC-10 / FR-10

Owner: Fırat Karadoğan ([#38](https://github.com/akcedia/SmartLoo/issues/38)). Target model refined from the [account-deletion DFD](../../analysis/behavior/auth-account.md#4-account-deletion-fr-10-req-db-04-tc-34) (#13) and the [class model](../class/accounts-and-data.md). `DELETE /api/v1/users/me` still returns 501 on the weekly branch.

The account row and its personal fields are removed. Reviews are kept for statistics: their author link is cleared and personal data in the comment text is redacted, because clearing `user_id` alone is not enough (FR-10). Toilet averages do not change, since scores are retained (TC-34). Cached AI summaries of the affected toilets are made stale by bumping `review_version` ([#28 proposal](https://github.com/akcedia/SmartLoo/issues/28#issuecomment-6400782736)).

```mermaid
sequenceDiagram
    actor User
    participant UI as React client
    participant API as FastAPI account route
    participant Auth as Account access service
    participant Del as Account deletion service
    participant Accounts as Account repository (PostgreSQL)
    participant Reviews as Review repository (MongoDB)
    participant Toilets as Toilet repository (PostgreSQL)

    User->>UI: Confirm "Delete my account"
    UI->>API: DELETE /api/v1/users/me with Bearer token
    API->>Auth: current_user: validate token and that sub still exists
    alt Token missing, expired, tampered or user already deleted
        Auth-->>API: Authentication rejected
        API-->>UI: 401 unauthorized
    else Valid session
        Auth-->>API: Principal (sub)
        API->>Del: delete_account(sub)
        Del->>Accounts: Read email and display name for redaction
        Del->>Reviews: Find the user's review ids and toilet ids
        Del->>Del: Record the deletion job durably (user, review ids, toilet ids)
        Note over Del: Captured first: once user_id is null,<br/>a retry cannot find these reviews again
        Del->>Reviews: Redact email, display name, emails and phone numbers in comments,<br/>set user_id = null and is_anonymized = true
        Del->>Toilets: bump_review_version(affected toilet ids)
        Note over Toilets: Scores kept, so average and count are unchanged.<br/>Old summary cache keys are no longer used.
        Del->>Accounts: Delete user row (suggestions: ON DELETE SET NULL)
        alt Every step completed
            Del->>Del: Mark the deletion job complete
            Del-->>API: Done
            API-->>UI: 204 no content
            UI->>UI: Discard the stored token
        else A step failed
            Del-->>API: Deletion incomplete, job kept for retry
            API-->>UI: 500, account deletion not confirmed
        end
    end
```

Later requests with the old token reach `current_user`, find no account for `sub` and get 401, so the 60-minute token stops working immediately.

**Open design decisions.** How the recorded job is retried and how concurrent review creation or summary generation is kept from reintroducing the user's data are not decided yet. Automatic redaction covers known patterns only; remaining personal details in free text are handled by ADMIN moderation (REQ-SEC-05). Whether deletion requires re-entering the password is not in the requirements and is left for team decision.
