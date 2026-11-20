#!/bin/bash
# Pull the newest linuxserver/firefox (tracks the latest stable Firefox) and recreate the container if it changed.
set -euo pipefail
cd /opt/sabi-fx
before=$(docker image inspect -f '{{.Id}}' linuxserver/firefox:latest 2>/dev/null || true)
docker compose build --pull
after=$(docker image inspect -f '{{.Id}}' linuxserver/firefox:latest)
if [ "$before" != "$after" ]; then
  docker compose up -d
  docker image prune -f >/dev/null
  echo "updated: $(docker exec sabi-firefox firefox --version)"
else
  echo "already latest: $(docker exec sabi-firefox firefox --version)"
fi
