#!/usr/bin/env bash
# Starts the local backend and the Expo dev server on macOS or Linux.
#
#   scripts/dev.sh                 start everything, then the Expo dev server
#   scripts/dev.sh --tunnel        extra arguments go to `expo start`
#   scripts/dev.sh stop            stop the local Supabase stack (data is kept)
#
# Set DEV_HOST to override the address the phone uses to reach your machine.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$ROOT/mobile"
FUNCTIONS_ENV="$ROOT/supabase/functions/.env"
FUNCTIONS_LOG="$ROOT/supabase/.temp/functions.log"
OS="$(uname -s)"

say() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is not installed. $2"
}

# Replaces KEY=... in an env file, or appends it if missing.
set_env() {
  local file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp)"
  grep -v "^${key}=" "$file" >"$tmp" || true
  printf '%s=%s\n' "$key" "$value" >>"$tmp"
  mv "$tmp" "$file"
}

# The phone needs the machine's LAN address; 127.0.0.1 would point at the phone itself.
lan_ip() {
  local ip=""
  if [[ "$OS" == "Darwin" ]]; then
    ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  else
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}' || true)"
    [[ -n "$ip" ]] || ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi
  echo "${ip:-127.0.0.1}"
}

ensure_docker() {
  docker info >/dev/null 2>&1 && return
  if [[ "$OS" == "Darwin" ]]; then
    say "Starting Docker Desktop"
    open -a Docker || die "Couldn't open Docker Desktop. Install it from https://www.docker.com/products/docker-desktop/"
    for _ in $(seq 60); do
      docker info >/dev/null 2>&1 && return
      sleep 2
    done
    die "Docker didn't start within two minutes."
  fi
  die "Docker isn't running. Start it with: sudo systemctl start docker"
}

if [[ "${1:-}" == "stop" ]]; then
  require supabase "See https://supabase.com/docs/guides/cli"
  cd "$ROOT" && supabase stop
  exit
fi

require node "Install Node 20+ from https://nodejs.org"
require npm "It comes with Node: https://nodejs.org"
require docker "See https://docs.docker.com/get-docker/"
require supabase "See https://supabase.com/docs/guides/cli"

ensure_docker

say "Starting Supabase"
cd "$ROOT"
out="$(supabase start 2>&1)" || { echo "$out" >&2; die "supabase start failed."; }

status="$(supabase status -o env 2>/dev/null)"
key="$(sed -n 's/^PUBLISHABLE_KEY="\(.*\)"$/\1/p' <<<"$status")"
[[ -n "$key" ]] || key="$(sed -n 's/^ANON_KEY="\(.*\)"$/\1/p' <<<"$status")"
[[ -n "$key" ]] || die "Couldn't read the API key from 'supabase status'."
port="$(sed -n 's/^API_URL=".*:\([0-9]*\)"$/\1/p' <<<"$status")"
host="${DEV_HOST:-$(lan_ip)}"

[[ -f "$MOBILE/.env" ]] || cp "$MOBILE/.env.example" "$MOBILE/.env"
set_env "$MOBILE/.env" EXPO_PUBLIC_SUPABASE_URL "http://$host:${port:-54321}"
set_env "$MOBILE/.env" EXPO_PUBLIC_SUPABASE_ANON_KEY "$key"
say "mobile/.env points at http://$host:${port:-54321}"

# Reinstall only when the lockfile has changed since the last install.
if [[ ! -f "$MOBILE/node_modules/.package-lock.json" || "$MOBILE/package-lock.json" -nt "$MOBILE/node_modules/.package-lock.json" ]]; then
  say "Installing mobile dependencies"
  (cd "$MOBILE" && npm ci)
fi

functions_pid=""
if [[ -f "$FUNCTIONS_ENV" ]] && ! grep -q '^ANTHROPIC_API_KEY=sk-ant-\.\.\.$' "$FUNCTIONS_ENV"; then
  say "Starting edge functions (log: supabase/.temp/functions.log)"
  mkdir -p "$(dirname "$FUNCTIONS_LOG")"
  supabase functions serve --env-file "$FUNCTIONS_ENV" >"$FUNCTIONS_LOG" 2>&1 &
  functions_pid=$!
  trap '[[ -n "$functions_pid" ]] && kill "$functions_pid" 2>/dev/null || true' EXIT
else
  warn "Edge functions not started: copy supabase/functions/.env.example to supabase/functions/.env and add your API keys. Meal logging, verdicts and fad checks need them."
fi

say "Starting Expo (scan the QR code with Expo Go)"
cd "$MOBILE"
npx expo start "$@"
