#!/bin/bash
# CENTAUR CLAWE Web Startup Script
# Builds required packages then starts Next.js dev server

set -e
cd "$(dirname "$0")"

echo "[clawe-web] Building required packages..."
pnpm --filter @clawe/plugins build 2>&1 || true
pnpm --filter @clawe/shared build 2>&1 || true

echo "[clawe-web] Starting Next.js dev server..."
cd apps/web
exec npm run dev
