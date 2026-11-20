-- One durable recovery record per facility, committed before Mongo is changed.
-- Recovery restores the saved document under the same advisory lock as writers.
CREATE TABLE review_operations (
    toilet_id uuid PRIMARY KEY REFERENCES toilets(id),
    operation_id uuid NOT NULL UNIQUE,
    review_id text NOT NULL,
    before_document jsonb,
    state text NOT NULL DEFAULT 'writing' CHECK (state IN ('writing', 'repair_required')),
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN review_operations.before_document IS
    'Private rollback data. Contains review text and author ID. Never expose through HTTP or logs.';
