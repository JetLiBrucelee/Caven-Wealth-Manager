#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Restore the exact locked dependencies, including the development build tools.
npm ci --include=dev --no-audit --no-fund
# Apply the approved additive authentication schema to development only.
# Production schema changes are handled by Publish, not by this script or server startup.
if [[ "${NODE_ENV:-development}" == "production" ]]; then
  echo "Post-merge setup is development-only" >&2
  exit 1
fi
npm run db:push
npm run check
npm run build
