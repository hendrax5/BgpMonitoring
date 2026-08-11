#!/bin/bash
# Self-healing bootstrap: ensures Redis + PostgreSQL are running, the database
# exists, the Prisma schema is applied, and seed data is present. Safe to run
# repeatedly (idempotent). Invoked by the `bootstrap` supervisor program so the
# app recovers automatically after a container restart.
set +e
cd /app
export $(grep -v '^#' .env | xargs) 2>/dev/null

echo "[bootstrap] starting Redis..."
redis-cli ping >/dev/null 2>&1 || redis-server --daemonize yes
sleep 1

echo "[bootstrap] starting PostgreSQL..."
service postgresql start >/dev/null 2>&1
# wait for postgres socket
for i in $(seq 1 30); do
  su - postgres -c "psql -tAc 'SELECT 1'" >/dev/null 2>&1 && break
  sleep 1
done

echo "[bootstrap] ensuring role + database..."
su - postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\"" >/dev/null 2>&1
su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='bgpmonitor'\"" 2>/dev/null | grep -q 1 \
  || su - postgres -c "psql -c 'CREATE DATABASE bgpmonitor;'" >/dev/null 2>&1

echo "[bootstrap] applying prisma schema..."
/app/node_modules/.bin/prisma db push --skip-generate --accept-data-loss >/dev/null 2>&1

echo "[bootstrap] seeding..."
node /app/scripts/seed-superadmin.js
node /app/scripts/seed-lab.js

echo "[bootstrap] done."
