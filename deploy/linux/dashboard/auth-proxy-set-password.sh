#!/usr/bin/env bash
# Rotate the Basic Auth password for auth-proxy.mjs without storing plaintext.
# Run this on the dashboard host from an interactive terminal.
set -euo pipefail

DIR="${DASHBOARD_AUTH_DIR:-$HOME/dashboard-auth}"
AUTH_FILE="$DIR/auth.json"
PROXY="$DIR/proxy.mjs"
NODE_BIN="$(command -v node)"

if [ ! -f "$AUTH_FILE" ] || [ ! -f "$PROXY" ]; then
  echo "Missing $AUTH_FILE or $PROXY. Run the auth proxy setup first." >&2
  exit 1
fi

read -r -s -p "New dashboard password (16+ characters): " PASSWORD
echo
read -r -s -p "Repeat password: " AGAIN
echo

if [ "$PASSWORD" != "$AGAIN" ]; then
  echo "Passwords do not match." >&2
  exit 1
fi
if [ "${#PASSWORD}" -lt 16 ]; then
  echo "Use at least 16 characters. A 4-digit PIN is not sufficient." >&2
  exit 1
fi

DASH_PASSWORD="$PASSWORD" "$NODE_BIN" - "$AUTH_FILE" <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const authFile = process.argv[2];
const password = process.env.DASH_PASSWORD;
const current = JSON.parse(fs.readFileSync(authFile, 'utf8'));
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 32).toString('hex');
fs.writeFileSync(authFile, JSON.stringify({
  username: current.username || 'yozakura',
  salt,
  hash,
}, null, 2) + '\n', { mode: 0o600 });
NODE

# Never leave the old plaintext password around.
rm -f "$DIR/password.txt"

if pgrep -f "$PROXY" >/dev/null 2>&1; then
  pkill -f "$PROXY" || true
  sleep 1
fi
nohup "$NODE_BIN" "$PROXY" >> "$DIR/proxy.log" 2>&1 &
sleep 1

CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8093/ || true)
echo "Password updated. Proxy restarted; unauthenticated probe returned HTTP $CODE."
