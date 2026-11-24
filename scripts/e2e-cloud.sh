#!/usr/bin/env bash
# Runs the Playwright suite in the Claude cloud environment: Node through the
# network proxy, the preinstalled Chromium, and the Supabase secret key fetched
# for this run only (kept in memory, never written to disk).
set -euo pipefail
export NODE_USE_ENV_PROXY=1 NEXT_TELEMETRY_DISABLED=1
export PW_CHROMIUM_PATH="${PW_CHROMIUM_PATH:-/opt/pw-browsers/chromium}"
REF="${SUPABASE_PROJECT_REF:-bguifsyabtcvinzaajcy}"
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  SUPABASE_SERVICE_ROLE_KEY="$(curl -sS "https://api.supabase.com/v1/projects/$REF/api-keys?reveal=true" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:-proxy-injected}" \
    | python3 -c 'import json,sys; print(next(k["api_key"] for k in json.load(sys.stdin) if k.get("type")=="secret"))')"
  export SUPABASE_SERVICE_ROLE_KEY
fi
# Mercado Pago test token is injected by the network proxy (when saved for this environment).
if [ "${E2E_MERCADOPAGO:-0}" = "1" ]; then export MERCADOPAGO_ACCESS_TOKEN="${MERCADOPAGO_ACCESS_TOKEN:-proxy-injected}"; fi
exec pnpm e2e "$@"
