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
        alt Invalid fields
            Auth-->>API: Validation failure
            API-->>UI: 422 invalid registration
        else Valid fields
            Auth->>Accounts: Save normalized email, password hash and USER role
            alt Email already registered
                Accounts-->>Auth: Unique email conflict
                Auth-->>API: Duplicate email
                API-->>UI: 409 conflict
            else Account created
                Accounts-->>Auth: New user identity
                Auth-->>API: Public account representation
                API-->>UI: 201 created
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
    participant Accounts as Account repository

    Visitor->>UI: Submit sign-in
    UI->>API: POST /api/v1/auth/login
    API->>Auth: Check rate limit for normalized email
    alt Five failed attempts within 15 minutes
        Auth-->>API: Throttled
        API-->>UI: 429 try again later
    else Attempt allowed
        Auth->>Accounts: Look up account and stored password hash
        Accounts-->>Auth: Account record or no match
        alt Credentials rejected
            Auth->>Auth: Record failure
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

    opt Call a protected admin operation
        Visitor->>UI: Request an admin action
        UI->>API: Send request with available Bearer token
        API->>Auth: Validate signature, expiration and role
        alt Token missing, expired or invalid
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

[Back to the Software Design Report](../REPORT.md)
