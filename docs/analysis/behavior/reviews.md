# Review lifecycle business process

Owner: Özgür Kılıç. Initial model, 14 October 2026. FR-03, with FR-08 authentication, FR-10 integrity and FR-04 cache implications.

```mermaid
flowchart TD
    Start(["Review create, edit or delete request"]) --> Auth{"Valid authentication?"}
    Auth -->|"No"| R401["401, no write"]
    Auth -->|"Yes"| Target{"Facility or target review exists?"}
    Target -->|"No"| R404["404, no write"]
    Target -->|"Yes"| Operation{"Requested operation?"}
    Operation -->|"Create"| Validate{"Valid score and comment?"}
    Validate -->|"No"| R422["422, no write"]
    Validate -->|"Yes"| Unique{"Already reviewed by this user?"}
    Unique -->|"Yes"| R409["409, use edit"]
    Unique -->|"No"| Create["Create one review"]
    Operation -->|"Edit"| Owner{"Requester owns review?"}
    Owner -->|"No"| R403["403, no write"]
    Owner -->|"Yes"| EditValid{"Valid submitted changes?"}
    EditValid -->|"No"| R422
    EditValid -->|"Yes"| Edit["Update review"]
    Operation -->|"Delete"| DeleteAuth{"Owner or ADMIN?"}
    DeleteAuth -->|"No"| R403
    DeleteAuth -->|"Yes"| Delete["Delete review"]
    Create --> Sync["Recalculate count and average; invalidate summary cache"]
    Edit --> Sync
    Delete --> Sync
    Sync --> Consistent{"Required state changes completed?"}
    Consistent -->|"No"| Failure["No success acknowledgement; apply recovery policy"]
    Consistent -->|"Yes"| Result["Create 201, edit 200, delete 204"]
```

Inputs: JWT, target ID, operation, score/comment where applicable. Stores: users/facilities, reviews and summary cache. Outputs: documented status/result and updated observable aggregates. Authentication failure is 401; authenticated but forbidden access is 403. Missing targets are 404. Validation and uniqueness errors do not mutate state. When all reviews are removed, the average becomes null and count zero.

The model states a consistency obligation, not an implemented transaction across SQL/MongoDB/Redis. Failure compensation, recovery and error response details remain design decisions. User ownership permits editing; ADMIN deletion is permitted by the canonical API contract. An ADMIN role alone does not grant editing someone else's review.

Related tests: TC-05, TC-06, TC-26, TC-31–TC-35, TC-41–TC-43, TC-46. AI cache invalidation: TC-16. All are specified acceptance tests, not evidence that feature implementation passes.
