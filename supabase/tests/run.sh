#!/bin/sh
# Applies the migrations to a throwaway local Postgres 16 (with Supabase's auth stubbed) and runs the RLS checks.
# Usage: sh supabase/tests/run.sh   (needs postgresql-16; run as a user that can start postgres)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
"$BIN/initdb" -D "$TMP/data" -A trust >/dev/null
"$BIN/pg_ctl" -D "$TMP/data" -o "-p 54329 -k $TMP" -l "$TMP/log" start >/dev/null
trap '"$BIN/pg_ctl" -D "$TMP/data" stop -m fast >/dev/null; rm -rf "$TMP"' EXIT
psql -h "$TMP" -p 54329 -q -d postgres -c 'create database t'
cat "$HERE/supabase_stub.sql" "$HERE"/../migrations/*.sql | psql -h "$TMP" -p 54329 -d t -q -v ON_ERROR_STOP=1
psql -h "$TMP" -p 54329 -d t -q -v ON_ERROR_STOP=1 -f "$HERE/rls_test.sql"
