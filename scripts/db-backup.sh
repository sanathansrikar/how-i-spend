#!/usr/bin/env bash
# Dump the dev database to backups/<timestamp>.sql (plain SQL: readable, restorable anywhere).
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p backups
file="backups/howispend-$(date +%Y%m%d-%H%M%S).sql"

# pg_dump runs inside the container, so no local Postgres client is needed.
docker compose exec -T db pg_dump -U howispend --clean --if-exists howispend > "$file"
echo "Backup written to $file"
