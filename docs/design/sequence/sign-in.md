# Registration and sign-in · UC-08

Target model based on FR-08 and the approved security requirements. Account access routes are placeholders on the weekly branch.

```mermaid
sequenceDiagram
    actor Visitor
    participant UI as React client
    participant API as FastAPI auth routes
    participant Auth as Account access service
    participant Accounts as Account repository

    opt Create an account
        Visitor->>UI: Submit registration
        UI->>API: POST /api/v1/auth/register
        API->>Auth: Validate registration and normalize email
        Note over Auth: Password 8+ characters with a letter and a digit.<br/>Display name 3–30 characters. Email lower-cased.<br/>A supplied role field is ignored.
        alt Invalid fields
            Auth-->>API: Validation failure
            API-->>UI: 422 invalid registration
        else Valid fields
            Auth->>Auth: Hash password (bcrypt cost ≥10 or Argon2)
            Auth->>Accounts: Save normalized email, password hash and USER role
            alt Email already registered
                Accounts-->>Auth: Unique email conflict
                Auth-->>API: Duplicate email
                API-->>UI: 409 conflict
            else Account created
                Accounts-->>Auth: New user identity
                Auth-->>API: Public account representation without password hash
                API-->>UI: 201 created with role USER
            end
        end
    end
```

```mermaid
sequenceDiagram
    actor Visitor
    participant UI as React client
    participant API as FastAPI auth routes
    participant Auth as Account access service
    participant Limiter as Login attempt limiter (Redis)
    participant Accounts as Account repository

    Visitor->>UI: Submit sign-in
    UI->>API: POST /api/v1/auth/login
    API->>Auth: Authenticate normalized email and password
    Auth->>Limiter: Failed attempts for this email
    alt Five failed attempts within 15 minutes
        Limiter-->>Auth: Blocked until the window expires
        Auth-->>API: Throttled
        API-->>UI: 429 try again later
    else Attempt allowed
        Limiter-->>Auth: Allowed
        Auth->>Accounts: Look up account and stored password hash
        Accounts-->>Auth: Account record or no match
        alt Unknown email or wrong password
            Auth->>Limiter: Record failure (key per email, TTL 15 min)
            Note over Auth,API: Same generic response for both cases,<br/>so the API does not reveal which emails exist
            Auth-->>API: Authentication rejected
            API-->>UI: Generic 401
        else Credentials accepted
            Auth->>Auth: Sign JWT with sub, role, iat and exp
            Auth-->>API: Bearer token with 60-minute lifetime
            API-->>UI: 200 with token and expires_in=3600
        end
    end
```

```mermaid
sequenceDiagram
    actor Visitor
    participant UI as React client
    participant API as FastAPI protected route
    participant Auth as Account access service
    participant Accounts as Account repository

    opt Call a protected admin operation
        Visitor->>UI: Request an admin action
        UI->>API: Send request with available Bearer token
        API->>Auth: require_admin: validate signature, expiration and role
        Auth->>Accounts: Does the sub user still exist?
        Accounts-->>Auth: Account or none (deleted account)
        alt Token missing, expired, tampered or user deleted
            Auth-->>API: Authentication rejected
            API-->>UI: 401 unauthorized
        else Valid token without ADMIN role
            Auth-->>API: Insufficient role
            API-->>UI: 403 forbidden
        else Valid ADMIN token
            Auth-->>API: Authorized identity
            API->>API: Continue to the admin operation
        end
    end
```

The diagram above guards administrator routes. The next one shows the same 401/403 split for an ordinary signed-in user: editing or deleting a review is allowed only for its author, and an ADMIN may delete any review (REQ-SEC-05). It covers only the authorization step of UC-03; review persistence and aggregates belong to the review model.

```mermaid
sequenceDiagram
    actor User
    participant UI as React client
    participant API as FastAPI review route
    participant Auth as Account access service
    participant Reviews as Review repository

    User->>UI: Edit or delete a review
    UI->>API: PATCH or DELETE /api/v1/reviews/{id} with Bearer token
    API->>Auth: current_user: validate token and that sub still exists
    alt Token missing, expired, tampered or user deleted
        Auth-->>API: Authentication rejected
        API-->>UI: 401 unauthorized
    else Valid session
        Auth-->>API: Principal (sub, role)
        API->>Reviews: Load review by id
        alt Review not found
            Reviews-->>API: None
            API-->>UI: 404 not found
        else Review found
            Reviews-->>API: Review with user_id
            API->>Auth: require_review_owner(principal, review)
            alt review.user_id ≠ sub and not an ADMIN delete
                Auth-->>API: Not the owner
                API-->>UI: 403 forbidden, review unchanged
            else Owner, or ADMIN deleting
                Auth-->>API: Allowed
                API->>API: Continue to the review operation
            end
        end
    end
```
