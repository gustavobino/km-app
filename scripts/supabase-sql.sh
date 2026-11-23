#!/usr/bin/env bash
# Runs a SQL file against the Supabase project through the Management API.
# Usage: SUPABASE_ACCESS_TOKEN=sbp_... scripts/supabase-sql.sh db/migrations/0002_x.sql
# (In the Claude cloud environment the token is injected by the network proxy.)
set -euo pipefail
FILE="${1:?usage: scripts/supabase-sql.sh <file.sql>}"
REF="${SUPABASE_PROJECT_REF:-bguifsyabtcvinzaajcy}"
TOKEN="${SUPABASE_ACCESS_TOKEN:-proxy-injected}"
python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$FILE" \
  | curl -sS --fail-with-body -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @-
echo
