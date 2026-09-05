#!/bin/sh
# setup-env.sh — copy .env.example to .env in every folder that needs one

set -e

for dir in . backend/ frontend/; do
  if [ -f "$dir/.env.example" ]; then
    if [ -f "$dir/.env" ]; then
      echo "skip   $dir/.env  (already exists)"
    else
      cp "$dir/.env.example" "$dir/.env"
      echo "copied $dir/.env.example → $dir/.env"
    fi
  fi
done

echo "done — review each .env and update values before running docker compose up"