#!/usr/bin/env bash
# Restore the dev database from a dump made by db-backup.sh. Replaces ALL current data.
set -euo pipefail

if [ $# -ne 1 ] || [ ! -f "$1" ]; then
  echo "Usage: scripts/db-restore.sh backups/<file>.sql" >&2
  exit 1
fi

read -r -p "This overwrites the current database with $1. Continue? [y/N] " answer
[ "$answer" = "y" ] || { echo "Aborted."; exit 1; }

cd "$(dirname "$0")/.."
# ON_ERROR_STOP: halt at the first error instead of leaving a half-restored database.
docker compose exec -T db psql -U howispend -d howispend -v ON_ERROR_STOP=1 < "$1"
echo "Restored from $1"
