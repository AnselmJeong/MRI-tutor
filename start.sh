#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' 'MRI Tutor 실행에는 Python 3가 필요합니다. 설치 후 다시 실행하세요.' >&2
  exit 1
fi

SERVER_ARGS=("$@")
SERVER_PORT=8091
# Validate options before stopping a running server. Help must never stop it.
while (( $# )); do
  case "$1" in
    -h|--help) exec python3 "$SCRIPT_DIR/trainer/serve.py" --help ;;
    --no-browser) shift ;;
    --port)
      if (( $# < 2 )); then
        printf '%s\n' '--port 뒤에 포트 번호를 지정하세요.' >&2
        exit 2
      fi
      SERVER_PORT="$2"
      shift 2
      ;;
    --port=*) SERVER_PORT="${1#*=}"; shift ;;
    *) printf '알 수 없는 옵션: %s\n' "$1" >&2; exit 2 ;;
  esac
done
if [[ ! "$SERVER_PORT" =~ ^[0-9]{1,5}$ ]] || (( 10#$SERVER_PORT < 1 || 10#$SERVER_PORT > 65535 )); then
  printf '%s\n' '--port는 1~65535 사이의 고정 포트여야 합니다.' >&2
  exit 2
fi
SERVER_PORT=$((10#$SERVER_PORT))
if ! command -v lsof >/dev/null 2>&1; then
  printf '%s\n' '사용 중인 포트 확인에 필요한 lsof를 찾을 수 없습니다.' >&2
  exit 1
fi

LISTENER_PIDS=()
while IFS= read -r pid; do
  [[ -n "$pid" ]] && LISTENER_PIDS+=("$pid")
done < <(lsof -nP -t -iTCP:"$SERVER_PORT" -sTCP:LISTEN || true)

if (( ${#LISTENER_PIDS[@]} )); then
  printf '포트 %s의 기존 프로세스를 종료합니다: %s\n' "$SERVER_PORT" "${LISTENER_PIDS[*]}"
  for pid in "${LISTENER_PIDS[@]}"; do
    if ! kill -TERM "$pid" 2>/dev/null && kill -0 "$pid" 2>/dev/null; then
      printf '프로세스 %s를 종료할 권한이 없습니다.\n' "$pid" >&2
      exit 1
    fi
  done
  for (( attempt=0; attempt<30; attempt++ )); do
    REMAINING_PIDS=$(lsof -nP -t -iTCP:"$SERVER_PORT" -sTCP:LISTEN || true)
    [[ -z "$REMAINING_PIDS" ]] && break
    sleep 0.1
  done
  # Escalate only for the original listeners that still occupy this port.
  for pid in "${LISTENER_PIDS[@]}"; do
    if [[ $'\n'"$REMAINING_PIDS"$'\n' == *$'\n'"$pid"$'\n'* ]]; then
      printf '응답하지 않는 프로세스 %s를 강제 종료합니다.\n' "$pid"
      kill -KILL "$pid"
    fi
  done
fi

if (( ${#SERVER_ARGS[@]} )); then
  exec python3 "$SCRIPT_DIR/trainer/serve.py" "${SERVER_ARGS[@]}"
fi
exec python3 "$SCRIPT_DIR/trainer/serve.py"
