#!/usr/bin/env bash
set -euo pipefail
SERVICE_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3.11}"
VENV_DIR="${KRONOS_VENV_DIR:-$SERVICE_DIR/.venv}"

"$PYTHON_BIN" -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -r "$SERVICE_DIR/requirements.txt"
if [ ! -f "$SERVICE_DIR/vendor/Kronos/model/kronos.py" ]; then
  mkdir -p "$SERVICE_DIR/vendor"
  git clone --depth 1 https://github.com/shiyu-coder/Kronos.git "$SERVICE_DIR/vendor/Kronos"
fi
echo "Kronos preparado en $SERVICE_DIR/vendor/Kronos"
