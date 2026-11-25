#!/usr/bin/env bash
# Deploys the send-reminders Edge Function with the shared push code.
# Usage: SUPABASE_ACCESS_TOKEN=sbp_... scripts/deploy-reminders.sh
# (In the Claude cloud environment the token is injected by the network proxy.)
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-bguifsyabtcvinzaajcy}"
TOKEN="${SUPABASE_ACCESS_TOKEN:-proxy-injected}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp "$ROOT/supabase/functions/send-reminders/index.ts" "$TMP/index.ts"
cp "$ROOT/lib/push/webpush.ts" "$TMP/webpush.ts"
cp "$ROOT/lib/push/reminders.ts" "$TMP/reminders.ts"
cd "$TMP"
curl -sS --fail-with-body -X POST \
  "https://api.supabase.com/v1/projects/$REF/functions/deploy?slug=send-reminders" \
  -H "Authorization: Bearer $TOKEN" \
  -F 'metadata={"entrypoint_path":"index.ts","name":"send-reminders","verify_jwt":false};type=application/json' \
  -F "file=@index.ts;type=application/typescript" \
  -F "file=@webpush.ts;type=application/typescript" \
  -F "file=@reminders.ts;type=application/typescript"
echo
