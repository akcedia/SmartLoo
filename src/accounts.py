"""FR-10 account deletion: DELETE /api/v1/users/me.

Order (design: docs/design/sequence/account-deletion.md):
  1. guard the account, recheck it and reject any pending author recovery;
  2. read email/display name and anonymize reviews under their facility guards (user_id = null,
     is_anonymized = true, personal text redacted, scores kept, review_version bumped);
  3. verify no author documents or recovery records remain;
  4. delete the account row and sign-in history in one SQL transaction, last.
Review mutations take the same account guard and recheck the actor under it.
Failed cleanup returns 503 with the account retained. Finished reviews are skipped
on retry; a failed compensation requires facility recovery before retry. Old tokens stop
working at once because current_user finds no account for their sub.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
import psycopg

from src.auth import Principal, current_user

router = APIRouter(prefix="/api/v1")


def delete_account(accounts, reviews, principal):
    with accounts.guard([principal.sub]) as users:
        user = users[principal.sub]
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
        if reviews.coordination.pending_for_author(principal.sub):
            raise HTTPException(status_code=503, detail="Review recovery required before account deletion")
        personal_terms = (user["email"], user["display_name"])
        reviews.anonymize_author(principal.sub, personal_terms)
        if reviews.coordination.pending_for_author(principal.sub) or reviews.reviews.by_user(principal.sub):
            raise HTTPException(status_code=503, detail="Review cleanup incomplete")
        accounts.delete(principal.sub, user["email"])


@router.delete("/users/me", status_code=204)
def delete_me(request: Request, principal: Principal = Depends(current_user)):
    try:
        delete_account(request.app.state.accounts, request.app.state.reviews, principal)
    except psycopg.Error as exc:
        raise HTTPException(status_code=503, detail="Account deletion temporarily unavailable") from exc
    return Response(status_code=204)
