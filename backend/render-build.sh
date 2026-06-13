#!/usr/bin/env bash
set -euo pipefail

echo "=== TaskPulse backend build ==="
python --version

minor="$(python -c 'import sys; print(sys.version_info.minor)')"
if [[ "${minor}" -ge 14 ]]; then
  echo ""
  echo "ERROR: Render is using Python 3.${minor}."
  echo "Fix: Render Dashboard → your service → Environment → add:"
  echo "  PYTHON_VERSION = 3.12.11"
  echo "Then redeploy."
  echo ""
  echo "Or switch the service Runtime to Docker (uses backend/Dockerfile)."
  exit 1
fi

pip install --upgrade pip
pip install -r requirements.txt
