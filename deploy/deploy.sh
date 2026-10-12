#!/usr/bin/env bash
# Usage on the server: ./deploy.sh <tag>   (tag = git sha or release, default latest)
# Requires docker-compose.prod.yml next to this script (added in B5).
set -euo pipefail
cd "$(dirname "$0")"
export TAG="${1:-latest}"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans # migrate runs first via depends_on
docker compose -f docker-compose.prod.yml ps
docker image prune -f
