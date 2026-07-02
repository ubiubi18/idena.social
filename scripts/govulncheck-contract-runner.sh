#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

(
  cd "${ROOT_DIR}/test-contract-runner"
  go run golang.org/x/vuln/cmd/govulncheck@latest -format=json ./...
) | go run "${ROOT_DIR}/scripts/govulncheck_filter.go" -allow GO-2024-3218
