#!/bin/sh
# Full check inside the container: migrate, seed twice (must not duplicate), verify.
set -eu

sh /db/scripts/migrate.sh
psql -v ON_ERROR_STOP=1 -q -f /db/seeds/fixtures.sql
psql -v ON_ERROR_STOP=1 -q -f /db/seeds/fixtures.sql
psql -v ON_ERROR_STOP=1 -q -f /db/tests/verify.sql
