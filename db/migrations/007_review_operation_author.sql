-- Even a new/partially anonymized Mongo document must block deletion until repair.
ALTER TABLE review_operations ADD COLUMN author_id uuid;
UPDATE review_operations SET author_id = (before_document->>'user_id')::uuid
WHERE before_document->>'user_id' IS NOT NULL;
CREATE INDEX review_operations_author_idx ON review_operations(author_id);
