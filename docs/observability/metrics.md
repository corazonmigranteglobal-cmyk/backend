# Métricas

El backend expone métricas en formato Prometheus en **`GET /metrics`**, fuera del prefijo
`api/v1`: no forman parte de la API del producto, las consume la infraestructura de
monitorización.

## Acceso

**El endpoint falla cerrado.** El control es la variable `METRICS_TOKEN`:

| Situación | Respuesta |
| --- | --- |
| `METRICS_TOKEN` sin configurar | `404` — el endpoint no admite ni que existe |
| Token ausente o incorrecto | `403 METRICS_INVALID_TOKEN` |
| Token correcto | `200` con el texto de exposición |

El token se compara en **tiempo constante**, para que no se pueda descubrir carácter a carácter
midiendo cuánto tarda en fallar.

```bash
curl -H "Authorization: Bearer $METRICS_TOKEN" https://api.corazonmigrante.com/metrics
```

!!! warning "Las métricas revelan superficie interna"
    Nombres de ruta, volumen de tráfico y estado de la infraestructura. Devolver `404` cuando no
    hay token configurado es deliberado: un `403` confirmaría que hay algo detrás y merece la pena
    insistir.

## Qué se mide

### HTTP (método RED)

| Métrica | Tipo | Etiquetas |
| --- | --- | --- |
| `http_requests_total` | contador | `method`, `route`, `status` |
| `http_request_duration_seconds` | histograma | `method`, `route`, `status` |

Las cubetas del histograma son `0,025 · 0,05 · 0,1 · 0,25 · 0,5 · 0,75 · 1 · 1,2 · 2 · 5 · 10`
segundos. Están elegidas alrededor de los objetivos declarados —500 ms en lectura y 1,2 s en
escritura—: sin un límite cerca del objetivo, el percentil 95 no se puede calcular con precisión
útil.

!!! tip "La etiqueta `route` usa el patrón, no la URL"
    `/api/v1/appointments/:id`, no `/api/v1/appointments/3f1c8a52-…`. Etiquetar con la URL real
    crearía una serie temporal por cada identificador y haría explotar la cardinalidad, que es la
    forma más común de tumbar un Prometheus.

    Cuando Express no expone el patrón —rutas no encontradas, sobre todo—, los UUID y los números
    de la ruta se sustituyen por `:uuid` y `:n`.

Se cuentan **también las peticiones que fallan**. Medir sólo el camino feliz dejaría la tasa de
error permanentemente en cero.

### Base de datos

| Métrica | Tipo | Etiquetas |
| --- | --- | --- |
| `db_pool_connections` | medidor | `state`: `used`, `available`, `pending`, `size` |

`pending` es la señal que precede a una caída: si crece, hay peticiones esperando una conexión que
no llega.

### Outbox

| Métrica | Tipo | Etiquetas |
| --- | --- | --- |
| `outbox_messages` | medidor | `status` (valores almacenados, en español) |
| `outbox_oldest_pending_seconds` | medidor | — |
| `outbox_metrics_poll_failures_total` | contador | — |

**`outbox_oldest_pending_seconds` es la métrica más valiosa para operación**, y no es técnica: si
crece, algo está roto en el worker o en el proveedor de correo, y lo notarán las personas antes que
cualquier tablero.

`outbox_metrics_poll_failures_total` subiendo es en sí una señal: significa que el muestreo no puede
consultar la base.

### Proceso

Las métricas por defecto de `prom-client` con prefijo `nodejs_`: memoria, recolección de basura,
descriptores de archivo y retraso del bucle de eventos.

## Cómo se recogen

Las métricas que exigen consultar la base **no se calculan en cada raspado**: un muestreo periódico
(`METRICS_POLL_INTERVAL_MS`, 15 s por defecto) las refresca en segundo plano.

La razón es concreta: un `/metrics` que dispara consultas a demanda convierte al sistema de
monitorización en una fuente de carga, y es justo cuando el servicio va mal cuando más se raspa.

Un fallo del muestreo no tumba nada: se cuenta en `outbox_metrics_poll_failures_total` y el proceso
sigue.

## Configuración

| Variable | Por defecto | Efecto |
| --- | --- | --- |
| `METRICS_TOKEN` | — | Sin ella el endpoint devuelve 404. Mínimo 16 caracteres |
| `METRICS_POLL_INTERVAL_MS` | `15000` | Entre 5 s y 5 min |

## Consultas útiles

```promql
# Tasa de error 5xx sobre el total
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# Latencia p95 por ruta
histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))

# Éxito del inicio de sesión
sum(rate(http_requests_total{route="/api/v1/auth/login",status!~"5.."}[5m]))
  / sum(rate(http_requests_total{route="/api/v1/auth/login"}[5m]))

# Saturación del pool
db_pool_connections{state="pending"} > 0

# Outbox atascado
outbox_oldest_pending_seconds > 1800
```

## Qué falta

Las métricas ya se emiten, pero **nadie las recoge todavía**: no hay Prometheus ni tablero
configurados, y por tanto tampoco alertas. Los objetivos de
[nivel de servicio](service-level-objectives.md) siguen siendo una propuesta razonada hasta que
haya un mes de medición real.
