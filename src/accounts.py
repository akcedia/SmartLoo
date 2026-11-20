"""FR-10 account deletion: DELETE /api/v1/users/me.

Order (design: docs/design/sequence/account-deletion.md):
  1. read the account's email and display name, the context needed to redact review text;
  2. anonymize every review of the account under its facility guard (user_id = null,
     is_anonymized = true, personal text redacted, scores kept, review_version bumped);
  3. delete the account row and its sign-in history;
  4. anonymize again, catching a review created while steps 2-3 ran.
The account row goes last, so a failure in step 2 answers 503 and leaves a signed-in user
who can simply retry; finished reviews no longer match and are skipped. Old tokens stop
working at once because current_user finds no account for their sub.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from src.auth import Principal, current_user

router = APIRouter(prefix="/api/v1")


@router.delete("/users/me", status_code=204)
def delete_me(request: Request, principal: Principal = Depends(current_user)):
    accounts, reviews = request.app.state.accounts, request.app.state.reviews
    user = accounts.get(principal.sub)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    personal_terms = (user["email"], user["display_name"])
    reviews.anonymize_author(principal.sub, personal_terms)
    accounts.delete(principal.sub, user["email"])
    reviews.anonymize_author(principal.sub, personal_terms)
    return Response(status_code=204)
