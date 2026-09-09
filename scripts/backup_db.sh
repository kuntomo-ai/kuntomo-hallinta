#!/bin/bash
# Kuntomo Hallinta — Supabase-tietokantabackup Dropboxiin
# Ajastettu: ~/Library/LaunchAgents/com.kuntomo.backup.plist
# Tallentaa: ~/Dropbox/ai/kuntomo-db-backups/
# Säilyttää: 30 viimeistä backupia

set -euo pipefail

# ── Konfiguraatio ─────────────────────────────────────────────────────────────
CONFIG_FILE="$HOME/.kuntomo_backup_config"
BACKUP_DIR="$HOME/Dropbox/ai/kuntomo-db-backups"
LOG_FILE="$BACKUP_DIR/backup.log"
KEEP_BACKUPS=30

# pg_dump löytyy Homebrew libpq:n kautta
export PATH="/opt/homebrew/opt/libpq/bin:/usr/local/opt/libpq/bin:$PATH"

# ── Apufunktiot ───────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ── Tarkistukset ──────────────────────────────────────────────────────────────
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "VIRHE: $CONFIG_FILE puuttuu. Luo se komennolla:"
  echo "  echo 'SUPABASE_DB_URL=postgresql://postgres:[salasana]@db.[projekti].supabase.co:5432/postgres' > ~/.kuntomo_backup_config"
  echo "  chmod 600 ~/.kuntomo_backup_config"
  exit 1
fi

# shellcheck source=/dev/null
source "$CONFIG_FILE"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  log "VIRHE: SUPABASE_DB_URL ei ole asetettu tiedostossa $CONFIG_FILE"
  exit 1
fi

if ! command -v pg_dump &>/dev/null; then
  log "VIRHE: pg_dump ei löydy. Asenna: brew install libpq && brew link --force libpq"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# ── Backup ────────────────────────────────────────────────────────────────────
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M')
BACKUP_FILE="$BACKUP_DIR/kuntomo_${TIMESTAMP}.sql.gz"

log "Aloitetaan backup → $BACKUP_FILE"

if pg_dump "$SUPABASE_DB_URL" \
    --no-owner \
    --no-acl \
    --exclude-table-data='auth.*' \
    --exclude-schema='realtime' \
    --exclude-schema='supabase_functions' \
    --exclude-schema='pgbouncer' \
    | gzip > "$BACKUP_FILE"; then
  SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
  log "Backup OK: $BACKUP_FILE ($SIZE)"
else
  log "VIRHE: pg_dump epäonnistui"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# ── Vanhojen poisto (säilytä KEEP_BACKUPS kpl) ────────────────────────────────
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/kuntomo_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
if [[ "$BACKUP_COUNT" -gt "$KEEP_BACKUPS" ]]; then
  DELETE_COUNT=$(( BACKUP_COUNT - KEEP_BACKUPS ))
  log "Poistetaan $DELETE_COUNT vanhaa backupia..."
  ls -1t "$BACKUP_DIR"/kuntomo_*.sql.gz | tail -n "$DELETE_COUNT" | xargs rm -f
fi

log "Valmis. Backupeja yhteensä: $(ls -1 "$BACKUP_DIR"/kuntomo_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"
