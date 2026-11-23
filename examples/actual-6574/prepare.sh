#!/bin/sh
# Installs the two Actual sync servers (each serves its own web app): 25.11.0 (reference) and 26.11.0 (target).
set -e
cd "$(dirname "$0")"
for v in 25.11.0 26.11.0; do
  [ -d "servers/$v/node_modules/@actual-app/sync-server" ] && continue
  mkdir -p "servers/$v" && (cd "servers/$v" && npm init -y >/dev/null && npm i --no-audit --no-fund "@actual-app/sync-server@$v")
done
