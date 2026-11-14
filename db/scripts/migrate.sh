#!/bin/sh
# Applies db/migrations/*.sql in name order, each once and in its own transaction.
set -eu

psql -v ON_ERROR_STOP=1 -q -c "CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now())"

for file in /db/migrations/*.sql; do
    version=$(basename "$file" .sql)
    if [ -n "$(psql -tA -c "SELECT 1 FROM schema_migrations WHERE version = '$version'")" ]; then
        echo "skip  $version"
        continue
    fi
    echo "apply $version"
    psql -v ON_ERROR_STOP=1 -q -1 -f "$file" \
        -c "INSERT INTO schema_migrations (version) VALUES ('$version')"
done
