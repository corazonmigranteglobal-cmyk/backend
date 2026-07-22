#!/usr/bin/env bash
# Token-efficient reader for graphify-out/.
# Answers questions about this codebase from the pre-built knowledge graph
# instead of reading source files. Wraps `python -m graphify` and reuses the
# cached interpreter in graphify-out/.graphify_python.
#
# Usage:
#   scripts/graphify-query.sh "How does auth token refresh work?"
#   scripts/graphify-query.sh --mode explain "AuthModule"
#   scripts/graphify-query.sh --mode path "auth" "user"
#   scripts/graphify-query.sh --budget 1500 "Trace the appointment status flow"
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/graphify-out"
GRAPH="$OUT_DIR/graph.json"

if [[ ! -f "$GRAPH" ]]; then
  echo "graphify-out/graph.json not found. Build it first with /graphify." >&2
  exit 1
fi

# Resolve the interpreter that actually has graphify (cached, then fallback).
PY=""
if [[ -f "$OUT_DIR/.graphify_python" ]]; then
  PY="$(tr -d '\r\n' < "$OUT_DIR/.graphify_python")"
fi
if [[ -z "$PY" || ! -x "$PY" ]]; then
  PY="$(command -v python || command -v python3 || true)"
fi
if [[ -z "$PY" ]]; then
  echo "No Python interpreter with graphify found." >&2
  exit 1
fi

MODE="query"
BUDGET="1200"
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)   MODE="$2"; shift 2 ;;
    --budget) BUDGET="$2"; shift 2 ;;
    *)        ARGS+=("$1"); shift ;;
  esac
done

if [[ ${#ARGS[@]} -eq 0 ]]; then
  echo "Nothing to ask. Usage: graphify-query.sh [--mode query|explain|path] [--budget N] <text...>" >&2
  exit 1
fi

case "$MODE" in
  explain) exec "$PY" -m graphify explain "${ARGS[0]}" --graph "$GRAPH" ;;
  path)    exec "$PY" -m graphify path "${ARGS[0]}" "${ARGS[1]}" --graph "$GRAPH" ;;
  *)       exec "$PY" -m graphify query "${ARGS[*]}" --budget "$BUDGET" --graph "$GRAPH" ;;
esac
