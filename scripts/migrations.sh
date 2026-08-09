#!/usr/bin/env bash
set -euo pipefail

command -v psql >/dev/null || { echo "psql est requis" >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "sha256sum est requis" >&2; exit 1; }
: "${DATABASE_URL:?Définir DATABASE_URL vers PostgreSQL}"

root_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
migrations_dir="$root_dir/supabase/migrations"
action=${1:-status}

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists dowze_ops;
create table if not exists dowze_ops.schema_migrations (
  version text primary key,
  filename text not null,
  sha256 text not null,
  status text not null check (status in ('applied', 'baseline')),
  applied_at timestamptz not null default now()
);
SQL

for file in "$migrations_dir"/*.sql; do
  filename=$(basename "$file")
  version=${filename%%_*}
  checksum=$(sha256sum "$file" | cut -d' ' -f1)
  recorded=$(psql "$DATABASE_URL" -X -At -v ON_ERROR_STOP=1 -v version="$version" \
    -c "select sha256 from dowze_ops.schema_migrations where version = :'version'" 2>/dev/null || true)

  if [[ -n "$recorded" ]]; then
    [[ "$recorded" == "$checksum" ]] || {
      echo "ERREUR $filename: checksum modifié (base=$recorded local=$checksum)" >&2
      exit 1
    }
    echo "OK      $filename"
    continue
  fi

  case "$action" in
    status) echo "MANQUE  $filename" ;;
    apply)
      psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f "$file"
      psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -v version="$version" \
        -v filename="$filename" -v checksum="$checksum" \
        -c "insert into dowze_ops.schema_migrations(version,filename,sha256,status) values (:'version', :'filename', :'checksum', 'applied')"
      echo "APPLIQUÉ $filename"
      ;;
    baseline)
      [[ "${CONFIRM_BASELINE:-}" == "I_VERIFIED_THE_SCHEMA" ]] || {
        echo "Refus: définir CONFIRM_BASELINE=I_VERIFIED_THE_SCHEMA après vérification du schéma" >&2
        exit 1
      }
      psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -v version="$version" \
        -v filename="$filename" -v checksum="$checksum" \
        -c "insert into dowze_ops.schema_migrations(version,filename,sha256,status) values (:'version', :'filename', :'checksum', 'baseline')"
      echo "BASELINE $filename"
      ;;
    *) echo "Usage: $0 {status|apply|baseline}" >&2; exit 2 ;;
  esac
done
