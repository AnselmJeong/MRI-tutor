#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' 'MRI Tutor 실행에는 Python 3가 필요합니다. 설치 후 다시 실행하세요.' >&2
  exit 1
fi

exec python3 "$SCRIPT_DIR/trainer/serve.py" "$@"
