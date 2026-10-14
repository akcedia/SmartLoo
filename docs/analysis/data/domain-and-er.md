# Domain model and preliminary E-R model

Owner: Özgür Kılıç (Issue #12). Version 0.1, 14 October 2026.

**Status: initial integration proposal, pending team review.** The domain model is Özgür's contribution. The E-R below is a provisional baseline derived from existing requirements, provided for the initial submission. It does not replace Fırat's Issue #13 contribution and must be reconciled with his model before final review. Baseline: [requirements](../../REQUIREMENTS.MD) and [data/security rules](../../requirements/db-security.md).

## 1. Domain concepts

| Concept | Meaning | Requirements |
|---|---|---|
| User | Registered account with USER or ADMIN permission role | FR-03, FR-05, FR-08, FR-10 |
| Toilet | Public facility with location and known/unknown amenities | FR-01, FR-02, FR-09, FR-10 |
| Review | One user's hygiene score and optional comment for one facility | FR-03 |
| Suggestion | Proposed facility awaiting administrator decision | FR-05 |
| AISummary | Derived, validated summary of a facility's reviews, optionally cached | FR-04 |

Guest is an external role, not a stored account. Administrator is a role of User, not a separate person/entity. A summary is derived information and not assumed to be a new permanent database table. Analytics are derived from facility/review data; no extra analytics table is introduced here.

```mermaid
classDiagram
    class User {
        account identity
        USER or ADMIN role
    }
    class Toilet {
        facility identity
        location and amenities
    }
    class Review {
        cleanliness score
        optional comment
    }
    class Suggestion {
        proposed facility details
        pending approved or rejected
    }
    class AISummary {
        grounded summary text
        source review information
    }
    User "0..1" -- "0..*" Review : authors
    Toilet "1" -- "0..*" Review : receives
    User "0..1" -- "0..*" Suggestion : submits
    User "0..1" -- "0..*" Suggestion : moderates as ADMIN
    Toilet "1" -- "0..*" AISummary : summarized by
    Review "3..50" -- "0..*" AISummary : source for
```

The review author may be absent after account deletion. Each summary uses 3–50 selected recent eligible reviews under FR-04; historical source versions and cache representation are later design decisions. A facility can have summary versions over time, but this model does not prescribe storing all versions. Suggestion author/moderator cardinalities are preliminary: existing requirements do not fully define suggestion retention when an account is deleted. Pending suggestions have no moderation decision. Moderator records, if retained, must not prevent personal-data deletion.

## 2. Preliminary logical E-R model

```mermaid
erDiagram
    USER o|--o{ REVIEW : authors
    TOILET ||--o{ REVIEW : receives
    USER o|--o{ SUGGESTION : submits
    USER o|--o{ SUGGESTION : moderates
    USER {
        uuid id PK
        string email UK
        string password_hash
        string display_name
        enum role
        boolean is_active
    }
    TOILET {
        uuid id PK
        string source
        string source_id
        string ibb_source_id
        string name
        decimal latitude
        decimal longitude
        string district
        boolean has_disabled_access
        boolean has_baby_changing
        boolean is_free
        string opening_hours
        enum status
        decimal average_cleanliness
        integer review_count
    }
    REVIEW {
        uuid id PK
        uuid toilet_id FK
        uuid user_id FK
        integer cleanliness_score
        string comment
        timestamp created_at
        timestamp updated_at
    }
    SUGGESTION {
        uuid id PK
        uuid submitted_by FK
        uuid moderated_by FK
        string name
        decimal latitude
        decimal longitude
        string district
        enum status
    }
```

The optional USER parent allows anonymous retained reviews after account deletion. Suggestion linkage fields are preliminary proposals to be reviewed by Fırat.

## 3. Constraints and storage interpretation

- Review creation requires an existing account and facility. After account deletion, `Review.user_id` is nullable and public author is Anonymous. Remove/redact personal information in retained free text too.
- At most one current review per `(user_id, toilet_id)` for non-null user IDs. Rating is an integer 1–5; optional comment is at most 1000 characters.
- USER/ADMIN is a server-controlled permission role. Public registration cannot grant ADMIN.
- Latitude is within −90..90 and longitude within −180..180. Unknown amenities, pricing and opening hours remain null/unknown and are displayed explicitly. Unknown does not match an explicit true/false filter.
- `average_cleanliness` is null when there are no reviews; `review_count` starts at zero. Recalculate both before acknowledging a successful review change.
- Reviewed facilities are closed rather than hard-deleted. Approved suggestions publish a valid facility; rejected/pending suggestions remain outside public nearby results.
- Import identity is `(source, source_id)`; retain a provider `ibb_source_id` only when actually available. How to derive identity for the verified source without stable IDs is pending Emir/Fırat analysis.
- PostgreSQL holds accounts/facility metadata, MongoDB holds reviews, and Redis may cache summaries, following the Charter and requirements. The E-R is a **logical relationship model**: FK-labelled cross-store references are not database-enforced SQL foreign keys in MongoDB. Cross-store coordination is a software design decision.
- Suggestion storage location, retained moderator identifiers and suggestion deletion policy are unresolved proposals, not implemented schema.

This is a requirements-analysis model. Physical indexes, migrations, service classes and deployment topology are not delivered here.
