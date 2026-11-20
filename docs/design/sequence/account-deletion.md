# Account deletion · UC-10 / FR-10

Owner: Fırat Karadoğan ([#38](https://github.com/akcedia/SmartLoo/issues/38), [#56](https://github.com/akcedia/SmartLoo/issues/56)). Model refined from the [account-deletion DFD](../../analysis/behavior/auth-account.md#4-account-deletion-fr-10-req-db-04-tc-34) (#13) and the [class model](../class/accounts-and-data.md). Implemented in #75; the sequence below reflects its guarded review journal rather than a separate deletion-job table.

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
        Del->>Accounts: Acquire account guard, recheck user, read redaction terms
        Del->>Toilets: Reject pending review operations for this author
        Del->>Reviews: Find the user's review ids and toilet ids
        Del->>Toilets: Under each facility guard, commit review operation with author and before-document
        Note over Del: Account and facility guards share one SQL session.<br/>The durable author marker survives loss of that session.
        Del->>Reviews: Redact email, display name, emails and phone numbers in comments,<br/>set user_id = null and is_anonymized = true
        Del->>Toilets: Commit aggregates, revision bump and operation removal per review
        Note over Toilets: Scores kept, so average and count are unchanged.<br/>Old summary cache keys are no longer used.
        Del->>Del: Verify no author documents or recovery markers remain
        Del->>Accounts: Delete user and sign-in history in one SQL transaction, last
        alt Every step completed
            Del-->>API: Done
            API-->>UI: 204 no content
            UI->>UI: Discard the stored token
        else A step failed
            Del-->>API: Account retained; completed reviews stay anonymous
            API-->>UI: 503, retry after facility recovery if required
        end
    end
```

Later requests with the old token reach `current_user`, find no account for `sub` and get 401, so the 60-minute token stops working immediately.

**Recovery and concurrency.** Review create/edit/delete acquires the actor and author account guards in a stable order before the facility guard, then rechecks the actor and role. A prevalidated request cannot recreate author data after deletion. Migration 007 records the author of pending creations even before a Mongo document exists. Failed compensation keeps its durable marker and blocks account removal across restarts; an operator runs `ReviewService.reconcile(toilet_id)` before retrying deletion. Completed anonymizations are skipped on retry. There is no Mongo work after account removal. This is coordinated recovery across stores, not a distributed transaction.

Summary reads/publication use the existing facility guard and revision check; public AI route integration remains separate work. Automatic redaction covers known patterns only; remaining personal details in free text require ADMIN moderation (REQ-SEC-05). The endpoint requires a valid session and confirmation in the UI, without re-entering the password. Suggestion cleanup must be integrated when a suggestion store is implemented.

[Back to the Software Design Report](../REPORT.md)
