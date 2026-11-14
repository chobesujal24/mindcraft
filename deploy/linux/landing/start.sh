#!/usr/bin/env bash
# Keep the landing page and its tunnel alive. Safe to run every minute.
set -u

DIR="$HOME/mindcraft-landing"
CFG="$HOME/.cloudflared/mindcraft-web.yml"

if ! pgrep -f "$DIR/server.mjs" >/dev/null 2>&1; then
  cd "$DIR" || exit 1
  nohup /usr/bin/node "$DIR/server.mjs" >> "$DIR/server.log" 2>&1 &
fi

if ! pgrep -x cloudflared -a | grep -qF "$CFG"; then
  nohup /usr/local/bin/cloudflared tunnel --config "$CFG" run mindcraft-web >> "$HOME/.cloudflared/mindcraft-web.log" 2>&1 &
fi
