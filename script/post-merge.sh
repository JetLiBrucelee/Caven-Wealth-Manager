#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Restore the exact locked dependencies, including the development build tools.
npm ci --include=dev --no-audit --no-fund
npm run check
npm run build

# Database changes need separate review; never force schema changes or seed ledger data here.
