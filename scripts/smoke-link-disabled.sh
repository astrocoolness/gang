#!/usr/bin/env bash
# Test the actual Next.js basePath and disabled-by-default contract.
# Run only against a locally built app, without any Supabase credentials.
set -euo pipefail
export PORT=3407
export CLIQUE_ACCOUNT_LINKING_ENABLED=false
unset CLIQUE_LINK_SERVICE_ROLE_KEY CLIQUE_LINK_SECRET NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run start -- -p "$PORT" > /tmp/clique-link-local-smoke.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
base="http://127.0.0.1:$PORT"
ready=false
for i in $(seq 1 40); do
  if curl --silent --fail "$base/clique/apps" > /tmp/clique-apps-smoke.html; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "App failed to start at /clique/apps"
  tail -80 /tmp/clique-link-local-smoke.log
  exit 1
fi
grep -q 'Secure app linking is not enabled' /tmp/clique-apps-smoke.html

check_status() {
  local expected="$1" path="$2" method="$3"
  local actual
  actual=$(curl -sS -o /tmp/clique-link-response.json -w '%{http_code}' -X "$method" \
    -H 'Content-Type: application/json' --data '{}' "$base$path")
  if [[ "$actual" != "$expected" ]]; then
    echo "$method $path: wanted $expected, got $actual"
    exit 1
  fi
}
check_status 503 /clique/api/apps/homies/link/complete POST
check_status 503 /clique/api/apps/homies/link/status GET
check_status 403 /clique/api/apps/homies/link/start POST
check_status 403 /clique/api/apps/homies/link/revoke POST
echo "CLIQUE disabled-mode Next.js routing smoke passed"
