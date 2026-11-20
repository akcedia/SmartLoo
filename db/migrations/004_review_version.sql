-- Review revision for summary cache invalidation (#28 proposal, docs/contracts/reviews-service.md).
-- Incremented in the same transaction that recalculates average_cleanliness and review_count,
-- so the AI summary cache key summary:{toilet_id}:v{review_version}:... changes with every review change.

ALTER TABLE toilets ADD COLUMN review_version bigint NOT NULL DEFAULT 0 CHECK (review_version >= 0);
