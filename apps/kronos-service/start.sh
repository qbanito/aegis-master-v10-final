#!/usr/bin/env bash
set -euo pipefail
SERVICE_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-$SERVICE_DIR/.venv/bin/python}"
if [ ! -x "$PYTHON_BIN" ]; then PYTHON_BIN="python3.11"; fi
export KRONOS_ENABLED="${KRONOS_ENABLED:-true}"
export KRONOS_PORT="${KRONOS_PORT:-8815}"
exec "$PYTHON_BIN" "$SERVICE_DIR/app.py"
