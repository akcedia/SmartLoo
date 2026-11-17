"""Sequential publication fixture for existing isolated tests, not a DB guard.

Real ordering/interleaving assertions use the shared-lock coordinator model in
test_ai_consistency_contract and test_ai_guarded_publication instead.
"""

from src.ai_summary_service import PublicationDecision


def sequential_publication(read_snapshot):
    async def publish_current(toilet_id, revision, publish):
        before = await read_snapshot(toilet_id)
        if not before.consistent or before.revision != revision:
            return PublicationDecision(False, before)
        value = await publish()
        after = await read_snapshot(toilet_id)
        if not after.consistent or after.revision != revision:
            return PublicationDecision(False, after)
        return PublicationDecision(True, after, value)
    return publish_current
