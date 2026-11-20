-- Accounts and login throttling (FR-08, REQ-SEC-01..07). Source: er-data-dictionary.md §2.1.
-- Passwords are stored only as bcrypt hashes; the API never returns password_hash.

CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         varchar(254) NOT NULL CHECK (email = lower(email) AND email LIKE '%_@_%'),
    password_hash text NOT NULL,
    display_name  varchar(30) NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 3 AND 30),
    role          user_role NOT NULL DEFAULT 'USER',
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_email_unique UNIQUE (email)
);

-- One row per failed sign-in. Five rows for an email within 15 minutes block further attempts (TC-47).
-- Kept in PostgreSQL until a Redis service exists in the shared environment.
CREATE TABLE login_failures (
    email     varchar(254) NOT NULL,
    failed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_failures_email_time ON login_failures (email, failed_at);
