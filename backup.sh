#!/usr/bin/env bash
set -euo pipefail

# Simple backup for pb_data (database + uploaded files)
# Usage: ./backup.sh [backup_dir]
# Suggested cron (daily): 0 2 * * * /path/to/inv-malahotspot/backup.sh /path/to/backups

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$ROOT_DIR/pb_data"
DEST="${1:-$ROOT_DIR/backups}"
TS="$(date +%Y%m%d-%H%M%S)"
DAY_TAG="$(date +%Y%m%d)"
WEEK_TAG="$(date +%G-W%V)"

mkdir -p "$DEST/daily" "$DEST/weekly"

if [ ! -d "$SRC" ]; then
  echo "pb_data not found: $SRC" >&2
  exit 1
fi

ARCHIVE="$DEST/daily/pb_data-${TS}.tar.gz"
tar -czf "$ARCHIVE" -C "$ROOT_DIR" pb_data
echo "Backup created: $ARCHIVE"

# Weekly snapshot copy (first backup of the week tag)
WEEKLY="$DEST/weekly/pb_data-${WEEK_TAG}.tar.gz"
if [ ! -f "$WEEKLY" ]; then
  cp "$ARCHIVE" "$WEEKLY"
  echo "Weekly snapshot: $WEEKLY"
fi

# Retention: keep 7 daily, 4 weekly
ls -1t "$DEST"/daily/pb_data-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
ls -1t "$DEST"/weekly/pb_data-*.tar.gz 2>/dev/null | tail -n +5 | xargs -r rm -f

echo "Backup completed."
