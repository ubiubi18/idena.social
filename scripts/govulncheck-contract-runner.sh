#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export GOCACHE="${GOCACHE:-${ROOT_DIR}/.cache/go-build}"
mkdir -p "${GOCACHE}"

(
  cd "${ROOT_DIR}/test-contract-runner"
  go tool govulncheck -tags=idena_memory_ipfs ./...
)
