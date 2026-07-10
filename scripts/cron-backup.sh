#!/usr/bin/env bash
# Wrapper para crontab: ejecuta el backup PostgreSQL -> Neon una vez por día.
# Instalación en el VPS (crontab -e):
#   0 3 * * * /ruta/al/repo/scripts/cron-backup.sh >> /ruta/al/repo/backups/cron.log 2>&1
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_FILE="$APP_DIR/backups/.cron-backup.lock"

mkdir -p "$APP_DIR/backups"

cd "$APP_DIR"

exec flock -n "$LOCK_FILE" -c '
  echo "===== $(date -Iseconds) inicio backup ====="
  npm run db:backup:neon
  status=$?
  echo "===== $(date -Iseconds) fin backup (exit $status) ====="
  exit $status
'
