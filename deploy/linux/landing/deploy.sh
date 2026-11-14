#!/usr/bin/env bash
# One-shot deployment for the Mindcraft landing page on sujal-ThinkCentre-M72e.
# Run from a checkout copy of deploy/linux/landing:
#   bash deploy.sh
# Installs to ~/mindcraft-landing, publishes via the mindcraft-web tunnel,
# retires the old lms route, and leaves dashboard auth untouched.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/mindcraft-landing"
CFG="$HOME/.cloudflared/mindcraft-web.yml"
HOSTNAME="qyvera.qzz.io"
CF="/usr/local/bin/cloudflared"
OLD_CFG="$HOME/.cloudflared/config.yml"

[ -f "$SRC/public/index.html" ] || { echo "Missing $SRC/public/index.html" >&2; exit 1; }
[ -x "$CF" ] || { echo "cloudflared not found at $CF" >&2; exit 1; }

stop_tunnel() {
  local cfg="$1"
  local pid
  for pid in $(pgrep -x cloudflared || true); do
    if tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -qF "$cfg"; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

echo "--- install ---"
mkdir -p "$DEST/public/assets"
cp "$SRC/public/index.html" "$DEST/public/index.html"
cp "$SRC/public/assets/"* "$DEST/public/assets/"
install -m 755 "$SRC/server.mjs" "$DEST/server.mjs"
install -m 700 "$SRC/start.sh" "$DEST/start.sh"
echo "installed to $DEST"

echo "--- tunnel ---"
if ! "$CF" tunnel list 2>/dev/null | awk '{print $2}' | grep -qx mindcraft-web; then
  "$CF" tunnel create mindcraft-web
else
  echo "mindcraft-web already exists"
fi
TUNNEL_ID=$("$CF" tunnel list 2>/dev/null | awk '$2=="mindcraft-web"{print $1; exit}')
CRED="$HOME/.cloudflared/$TUNNEL_ID.json"
if [ -z "$TUNNEL_ID" ] || [ ! -f "$CRED" ]; then
  echo "Could not find tunnel id or credentials ($TUNNEL_ID / $CRED)" >&2
  exit 1
fi
echo "tunnel id: $TUNNEL_ID"

cat > "$CFG" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $CRED
ingress:
  - hostname: $HOSTNAME
    service: http://127.0.0.1:8094
  - service: http_status:404
EOF
"$CF" tunnel --config "$CFG" ingress validate

echo "--- dns ---"
# Use the tunnel UUID, not the name: cloudflared 2026.9.1 resolves the name
# to the wrong tunnel in this account and silently skips the overwrite.
"$CF" tunnel route dns --overwrite-dns "$TUNNEL_ID" "$HOSTNAME"

echo "--- retire lms route ---"
stop_tunnel "$OLD_CFG"
sleep 1

echo "--- restart landing ---"
for pid in $(pgrep -f "$DEST/server.mjs" || true); do kill "$pid" 2>/dev/null || true; done
stop_tunnel "$CFG"
sleep 1
bash "$DEST/start.sh"
sleep 4

echo "--- local check ---"
curl -s -o /dev/null -w 'local %{http_code}\n' http://127.0.0.1:8094/
curl -s http://127.0.0.1:8094/ | grep -o '<title>[^<]*</title>' | head -1

echo "--- public check ---"
CODE=""
for i in 1 2 3 4 5 6 7 8 9 10; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://$HOSTNAME/" || true)
  echo "attempt $i: $CODE"
  [ "$CODE" = "200" ] && break
  sleep 3
done
curl -s "https://$HOSTNAME/" | grep -o '<title>[^<]*</title>' | head -1 || true

echo "--- dashboard unchanged ---"
curl -s -o /dev/null -w 'dash-noauth %{http_code}\n' https://dash.qyvera.qzz.io/ || true
if [ -n "${DASH_USER:-}" ] && [ -n "${DASH_PASS:-}" ]; then
  curl -s -o /dev/null -w 'dash-auth %{http_code}\n' -u "$DASH_USER:$DASH_PASS" https://dash.qyvera.qzz.io/ || true
else
  echo 'dash-auth skipped (set DASH_USER and DASH_PASS to test it)'
fi

echo "--- cron ---"
TMP=$(mktemp)
crontab -l 2>/dev/null > "$TMP" || true
if ! grep -qF "$DEST/start.sh" "$TMP"; then
  printf '%s\n' \
    "@reboot sleep 30; $DEST/start.sh" \
    "* * * * * $DEST/start.sh >/dev/null 2>&1" >> "$TMP"
  crontab "$TMP"
  echo "installed cron entries"
else
  echo "cron entries already present"
fi
rm -f "$TMP"
crontab -l

echo "--- processes ---"
pgrep -x cloudflared -a || true
pgrep -f "$DEST/server.mjs" -a || true
