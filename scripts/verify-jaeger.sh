#!/usr/bin/env bash
# Verificación end-to-end: una petición real al backend debe aparecer en Jaeger.
#
# Dependencias: bash, curl. `jq` es opcional (si falta se usa grep).
#
# Uso:
#   bash scripts/verify-jaeger.sh
#   API_BASE_URL=http://localhost:3000 JAEGER_UI_URL=http://localhost:16686 \
#     OTEL_SERVICE_NAME=corazon-migrante-api bash scripts/verify-jaeger.sh
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
JAEGER_UI_URL="${JAEGER_UI_URL:-http://localhost:16686}"
SERVICE_NAME="${OTEL_SERVICE_NAME:-corazon-migrante-api}"
API_PREFIX="${API_PREFIX:-api/v1}"
# Endpoint público que sí debe trazarse (`/health` está excluido a propósito).
PROBE_PATH="${PROBE_PATH:-therapy/products}"
# El exportador es por lotes: hay que darle tiempo a vaciar antes de consultar.
FLUSH_WAIT_SECONDS="${FLUSH_WAIT_SECONDS:-8}"

fail() { printf '\033[31mFALLO:\033[0m %s\n' "$1" >&2; exit 1; }
ok()   { printf '\033[32mOK:\033[0m %s\n' "$1"; }
info() { printf '  %s\n' "$1"; }

command -v curl >/dev/null 2>&1 || fail "curl no está instalado."
HAS_JQ=0
command -v jq >/dev/null 2>&1 && HAS_JQ=1

echo "== 1/5 Jaeger disponible =="
curl -fsS --max-time 5 "${JAEGER_UI_URL}/api/services" >/dev/null 2>&1 \
  || fail "Jaeger no responde en ${JAEGER_UI_URL}. Ejecute: yarn jaeger:up"
ok "Jaeger responde en ${JAEGER_UI_URL}"

echo "== 2/5 Backend disponible =="
curl -fsS --max-time 5 "${API_BASE_URL}/health" >/dev/null 2>&1 \
  || fail "El backend no responde en ${API_BASE_URL}/health"
ok "Backend responde en ${API_BASE_URL}"

echo "== 3/5 Petición de prueba y lectura de x-trace-id =="
# Se usa un endpoint que SÍ debe trazarse (health está excluido a propósito).
# Un 401/404 es una respuesta válida: lo que se verifica es la traza, no el dato.
HEADERS_FILE="$(mktemp)"
trap 'rm -f "${HEADERS_FILE}"' EXIT
curl -sS -o /dev/null -D "${HEADERS_FILE}" --max-time 10 \
  "${API_BASE_URL}/${API_PREFIX}/${PROBE_PATH}" || true

TRACE_ID="$(grep -i '^x-trace-id:' "${HEADERS_FILE}" | tr -d '\r' | awk '{print $2}' | tail -n1)"
[ -n "${TRACE_ID}" ] \
  || fail "La respuesta no incluye x-trace-id. Revise OTEL_ENABLED=true y el muestreo (OTEL_TRACES_SAMPLER_ARG)."
ok "x-trace-id recibido: ${TRACE_ID}"

echo "== 4/5 Esperando al exportador por lotes (${FLUSH_WAIT_SECONDS}s) =="
sleep "${FLUSH_WAIT_SECONDS}"

echo "== 5/5 La traza está en Jaeger =="
SERVICES="$(curl -fsS --max-time 10 "${JAEGER_UI_URL}/api/services")"
echo "${SERVICES}" | grep -q "${SERVICE_NAME}" \
  || fail "El servicio '${SERVICE_NAME}' no aparece en Jaeger. Revise OTEL_EXPORTER_OTLP_TRACES_ENDPOINT."
ok "Servicio '${SERVICE_NAME}' registrado en Jaeger"

TRACE_JSON="$(curl -fsS --max-time 10 "${JAEGER_UI_URL}/api/traces/${TRACE_ID}" || true)"
if [ "${HAS_JQ}" -eq 1 ]; then
  SPAN_COUNT="$(printf '%s' "${TRACE_JSON}" | jq '[.data[]?.spans[]?] | length')"
  [ "${SPAN_COUNT:-0}" -gt 0 ] || fail "La traza ${TRACE_ID} no se encontró en Jaeger."
  ok "Traza encontrada con ${SPAN_COUNT} spans"
  info "Spans: $(printf '%s' "${TRACE_JSON}" | jq -r '[.data[]?.spans[]?.operationName] | join(", ")')"

  # Ninguna traza debe contener cabeceras de autorización ni cookies.
  if printf '%s' "${TRACE_JSON}" | jq -e '
      [.data[]?.spans[]?.tags[]?.key]
      | map(ascii_downcase)
      | map(select(test("authorization|cookie|password|token|secret")))
      | length > 0' >/dev/null; then
    fail "La traza contiene atributos potencialmente sensibles. Revise docs/observability/04-data-privacy-policy.md"
  fi
  ok "Sin atributos sensibles en la traza"
else
  printf '%s' "${TRACE_JSON}" | grep -q '"spans"' \
    || fail "La traza ${TRACE_ID} no se encontró en Jaeger."
  ok "Traza encontrada (instale jq para la verificación detallada)"
fi

printf '\n\033[32mVerificación completada.\033[0m Traza: %s/trace/%s\n' "${JAEGER_UI_URL}" "${TRACE_ID}"
