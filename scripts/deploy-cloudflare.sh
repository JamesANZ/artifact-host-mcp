#!/usr/bin/env bash
# Deploy Worker, upload OWNER_API_KEY from .dev.vars, patch Cursor / Claude MCP URL.
# Requires CLOUDFLARE_API_TOKEN (export or .env.deploy). See .env.deploy.example.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.deploy ]]; then
  set -a
  # shellcheck disable=1091
  source .env.deploy
  set +a
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Missing CLOUDFLARE_API_TOKEN." >&2
  echo "Create a token (Workers Edit + R2 read/write for the account), then either:" >&2
  echo "  export CLOUDFLARE_API_TOKEN=..." >&2
  echo "  Or copy .env.deploy.example to .env.deploy and set the variable there." >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  CLOUDFLARE_ACCOUNT_ID="$(
    npx wrangler whoami 2>/dev/null | awk -F'│' '/Account ID/ {getline; gsub(/^[[:space:]]*│[[:space:]]*|[[:space:]]*│[[:space:]]*$/, "", $2); print $2; exit}'
  )"
  if [[ -n "$CLOUDFLARE_ACCOUNT_ID" ]]; then
    export CLOUDFLARE_ACCOUNT_ID
    echo "Using Cloudflare account ${CLOUDFLARE_ACCOUNT_ID}"
  fi
fi

if [[ ! -f .dev.vars ]]; then
  echo "Missing .dev.vars with OWNER_API_KEY=... (used for Wrangler secret + MCP Bearer)." >&2
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "${line// }" ]] && continue
  [[ "$line" =~ ^# ]] && continue
  export "$line"
done < .dev.vars

if [[ -z "${OWNER_API_KEY:-}" ]]; then
  echo "OWNER_API_KEY not found in .dev.vars" >&2
  exit 1
fi

echo "Ensuring R2 bucket exists..."
npx wrangler r2 bucket create artifact-host 2>/dev/null || true

DEPLOY_LOG="$(mktemp)"
trap 'rm -f "$DEPLOY_LOG"' EXIT

set +e
npx wrangler deploy 2>&1 | tee "$DEPLOY_LOG"
DEPLOY_EXIT="${PIPESTATUS[0]}"
set -e
if [[ "$DEPLOY_EXIT" -ne 0 ]]; then
  exit "$DEPLOY_EXIT"
fi

echo "$OWNER_API_KEY" | npx wrangler secret put OWNER_API_KEY
echo "Uploaded OWNER_API_KEY to the Worker."

ORIGIN="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | head -1 || true)"
if [[ -z "$ORIGIN" ]]; then
  echo "" >&2
  echo "Could not parse workers.dev URL from deploy log. Find it in the Cloudflare dashboard, then run:" >&2
  echo "  node scripts/patch-artifact-host-mcp-url.mjs \"https://<your-worker>.<subdomain>.workers.dev\"" >&2
  exit 0
fi

echo "Patching MCP configs -> ${ORIGIN}/mcp"
node scripts/patch-artifact-host-mcp-url.mjs "$ORIGIN"
echo "Reload MCP in Cursor; restart Claude Desktop."
