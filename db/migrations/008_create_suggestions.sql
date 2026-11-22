-- FR-05 facility suggestions and ADMIN moderation (er-data-dictionary.md §2.4).
-- Pending and rejected suggestions are never public. Approval publishes exactly one toilet
-- with source = 'suggestion' and source_id = suggestion id, so it cannot collide with imports.
-- Account deletion clears submitted_by / moderated_by and keeps the facility data (FR-10).

CREATE TYPE suggestion_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE suggestions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_by        uuid REFERENCES users(id) ON DELETE SET NULL,
    moderated_by        uuid REFERENCES users(id) ON DELETE SET NULL,
    toilet_id           uuid UNIQUE REFERENCES toilets(id),
    name                varchar(150) NOT NULL CHECK (btrim(name) <> ''),
    district            text NOT NULL CHECK (btrim(district) <> ''),
    latitude            numeric(9, 6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude           numeric(9, 6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    has_disabled_access boolean,
    has_baby_changing   boolean,
    is_free             boolean,
    status              suggestion_status NOT NULL DEFAULT 'PENDING',
    created_at          timestamptz NOT NULL DEFAULT now(),
    decided_at          timestamptz,
    CONSTRAINT suggestions_decided_when_not_pending CHECK ((status = 'PENDING') = (decided_at IS NULL)),
    CONSTRAINT suggestions_approved_has_toilet CHECK ((status = 'APPROVED') = (toilet_id IS NOT NULL))
);

CREATE INDEX suggestions_pending_by_time ON suggestions (created_at) WHERE status = 'PENDING';
CREATE INDEX suggestions_by_submitter ON suggestions (submitted_by);
CREATE INDEX suggestions_by_moderator ON suggestions (moderated_by);
