# Fase 24 — Runbook operativo de observabilidad

Guía de diagnóstico para incidencias del sistema de trazas. Cada sección va del
síntoma a la causa, en orden de probabilidad.

**Principio previo a cualquier diagnóstico:** un fallo de observabilidad **nunca**
justifica degradar el servicio. Si hay dudas, `OTEL_ENABLED=false` y redesplegar:
el backend vuelve al comportamiento anterior a la telemetría.

---

## A. Jaeger no recibe trazas

### A.1 Confirmar que la telemetría está activa

```bash
# En el contenedor de la API
env | grep OTEL_
```

Comprobaciones, en orden:

| Variable | Valor esperado | Si falla |
| --- | --- | --- |
| `OTEL_ENABLED` | `true` | El SDK ni siquiera arranca. Es la causa nº 1. |
| `OTEL_TRACES_SAMPLER_ARG` | > 0 | Con `0` no se muestrea ninguna traza raíz. |
| `OTEL_TRACES_SAMPLER` | ≠ `always_off` | Ídem. |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | URL completa **con `/v1/traces`** | Un endpoint sin la ruta devuelve 404 silencioso. |

### A.2 Comprobar que la respuesta lleva `x-trace-id`

```bash
curl -sS -D - -o /dev/null https://api.corazonmigrante.com/api/v1/therapy-catalog/products | grep -i x-trace-id
```

- **Sin cabecera** ⇒ no hay span activo. La telemetría está desactivada, el
  muestreo la descartó, o la ruta está en `OTEL_EXCLUDED_URLS`.
- **Con cabecera pero sin traza en Jaeger** ⇒ el problema es de exportación (A.3).

### A.3 Verificar la red hacia el Collector

```bash
# Desde el contenedor de la API
getent hosts otel-collector          # ¿resuelve el DNS?
curl -v http://otel-collector:4318/v1/traces -X POST \
     -H 'Content-Type: application/json' -d '{}'
```

- `Could not resolve host` ⇒ los servicios no comparten red Docker.
- `Connection refused` ⇒ el Collector está caído o escucha en otro puerto.
- `400 Bad Request` ⇒ **la conectividad es correcta** (el cuerpo vacío es inválido a propósito).

Dentro de Docker hay que usar el **nombre de servicio**, no `localhost`:
`localhost` dentro de un contenedor es el propio contenedor.

### A.4 Revisar el Collector

```bash
docker compose logs otel-collector --tail=100
curl -s http://otel-collector:13133          # health
curl -s http://otel-collector:8888/metrics | grep -E 'refused|failed|queue'
```

| Métrica alta | Significado | Acción |
| --- | --- | --- |
| `otelcol_processor_refused_spans` | El `memory_limiter` está rechazando | Subir memoria del Collector o bajar el muestreo |
| `otelcol_exporter_send_failed_spans` | Jaeger no acepta | Revisar `jaeger-collector` |
| `otelcol_exporter_queue_size` ≈ capacidad | Cola llena | Jaeger está caído o lento |

### A.4.bis `404 Not Found` en los logs del exportador

Síntoma:

```json
{"name":"OTLPExporterError","code":"404","data":"404 page not found\n"}
```

Si las trazas **sí** llegan a Jaeger, el 404 no es de trazas: es de los pipelines
de **métricas y logs**, que `NodeSDK` levanta por defecto contra `/v1/metrics` y
`/v1/logs`, rutas que Jaeger no expone. `enforceTracesOnlyPipelines()` en
`telemetry.bootstrap.ts` fija `OTEL_METRICS_EXPORTER=none` y
`OTEL_LOGS_EXPORTER=none` para evitarlo. Si el error reaparece, comprobar que
nadie ha definido esas variables con otro valor en el entorno.

### A.5 Activar el diagnóstico interno del SDK

```env
OTEL_DIAG_LOG_LEVEL=DEBUG
```

Imprime por consola los errores del exportador (timeouts, 4xx/5xx del endpoint).
**Volver a `ERROR` en cuanto se resuelva**: en `DEBUG` es muy verboso.

### A.6 Verificar el servicio en Jaeger

```bash
curl -s http://jaeger-query:16686/api/services
```

Si `corazon-migrante-api` no aparece, no ha llegado ni una sola traza. Si aparece
pero `corazon-migrante-worker-outbox` no, el problema está sólo en el worker:
comprobar que ese proceso tiene las variables `OTEL_*` en su entorno (es un
contenedor distinto y no siempre hereda el `env_file`).

---

## B. El backend se ha vuelto lento tras activar la telemetría

> ⚠️ **Bajar el muestreo NO es una palanca de rendimiento eficaz.** Medido:
> con `always_off` (cero spans grabados) la sobrecarga sigue siendo del −16,3 %
> de throughput, y pasar de muestreo 1.0 a 0.15 sólo recupera 3 puntos. El coste
> está en los parches de las instrumentaciones y en la propagación de contexto
> asíncrono, que ocurren se muestree o no. El muestreo sirve para limitar
> **almacenamiento y red**, no CPU. Datos en
> [05-performance-results.md](05-performance-results.md) §3.

Orden de intervención, por eficacia real:

1. **Desactivar la telemetría.** `OTEL_ENABLED=false` + redespliegue. Recupera el
   100 % del rendimiento. Es la única palanca que lo hace.
2. **Retirar instrumentaciones.** En `telemetry.instrumentations.ts`, la
   candidata es `ExpressInstrumentation` (la más prolífica en spans por
   petición). Requiere redespliegue, pero conserva las trazas HTTP, de base de
   datos y de negocio.
3. **Comprobar que nadie añadió instrumentaciones ruidosas.** Con `fs` o `dns`
   activos una sola petición genera cientos de spans.
4. **Endpoint que no responde.** Un `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` que
   resuelve pero se queda colgado retiene conexiones hasta
   `OTEL_EXPORT_TIMEOUT_MS`. Bajarlo a `3000` si la red es dudosa. Nota: con el
   destino **caído** (conexión rechazada) no hay penalización — medido: 0 errores
   y mejor throughput que con Jaeger vivo.
5. **Exportación.** Confirmar que se usa `BatchSpanProcessor` (así está
   configurado). Un `SimpleSpanProcessor` exportaría de forma síncrona en cada
   span y sería catastrófico.
6. **Collector saturado.** Ver A.4. Si `queue_size` está al máximo, escalar el
   Collector o bajar el muestreo (aquí el muestreo **sí** ayuda: el problema es
   de volumen, no de CPU en la aplicación).
7. **Cardinalidad.** Buscar spans cuyo **nombre** contenga un identificador
   (`auth.login.a3f1…`). Rompe la agregación de Jaeger y multiplica el índice.
   Los identificadores van en `app.entity.id`, nunca en el nombre.

Referencia de sobrecarga esperada: [05-performance-results.md](05-performance-results.md).
Si se observa mucho más que ~3 µs por span manual, algo está mal configurado.

---

## C. Los logs no llevan `trace_id`

`@opentelemetry/instrumentation-pino` inyecta `trace_id`, `span_id` y
`trace_flags` sólo cuando hay un **span activo** en el contexto.

| Causa | Comprobación | Solución |
| --- | --- | --- |
| Telemetría desactivada | `OTEL_ENABLED` | Activarla |
| Pino cargado antes que el SDK | `src/main.ts` línea 1 debe ser `import './observability/telemetry.bootstrap.api';` | Restaurar el orden de imports. **Cualquier import por encima rompe el parcheo.** |
| Log emitido fuera de contexto | Logs de arranque, `onModuleInit`, callbacks de `setTimeout` sin contexto | Es correcto: no pertenecen a ninguna petición |
| Worker sin variables `OTEL_*` | `env` del contenedor del worker | Añadirlas al despliegue del worker |
| Traza no muestreada | `trace_flags: 0` | Comportamiento esperado con muestreo < 1.0 |

Correlación manual mientras se diagnostica: el `requestId` (`X-Request-Id`) sigue
presente en todos los logs y en el cuerpo de la respuesta, independientemente de
la telemetría.

---

## D. La traza se pierde entre la API y el worker de outbox

El contexto viaja en `payload._trace` de la tabla `mensajeria.mensaje_outbox`.

### D.1 Comprobar la inyección (lado API)

```sql
SELECT id_mensaje, payload -> '_trace' AS carrier
FROM mensajeria.mensaje_outbox
ORDER BY created_at DESC
LIMIT 5;
```

- `null` ⇒ no se inyectó. Causas: telemetría desactivada en la API, o el `enqueue`
  se ejecutó fuera de cualquier span (por ejemplo desde un script).
- Con `traceparent` ⇒ la inyección funciona; el problema está en el consumo.

### D.2 Comprobar la extracción (lado worker)

En Jaeger, buscar el servicio `corazon-migrante-worker-outbox` y abrir un span
`outbox.process`:

- **Con `links`** ⇒ la propagación funciona. El span consumidor se enlaza al
  productor, no se anida bajo él: es intencionado, para que el tiempo en cola no
  infle la duración de la petición HTTP original.
- **Sin `links`** ⇒ o el mensaje es anterior al despliegue de la observabilidad
  (comportamiento previsto y correcto), o el carrier está corrupto.

### D.3 Compatibilidad con mensajes antiguos

Los mensajes sin `_trace` se procesan con normalidad y generan una traza raíz.
Está cubierto por la prueba
`procesa mensajes antiguos sin carrier sin romperse` en
[outbox-trace-propagation.spec.ts](../../src/modules/messaging/outbox-trace-propagation.spec.ts).
Si el worker fallase con mensajes antiguos, es un **bug**, no un problema de configuración.

### D.4 Reintentos

Cada intento genera su propio span `outbox.process` con `app.job.attempt`
incrementado, todos enlazados al mismo productor. El atributo `app.result`
distingue `sent` / `retry` / `dead` (`dead` = agotados los `maxAttempts`).

---

## E. Hay datos sensibles en las trazas

**Es una incidencia de seguridad, no de observabilidad.** Procedimiento completo
en [04-data-privacy-policy.md](04-data-privacy-policy.md) §8. Resumen:

1. **Contener ya**: `OTEL_ENABLED=false` y redesplegar (o
   `OTEL_TRACES_SAMPLER=always_off` para no reiniciar).
2. **Cortar el acceso** a la UI de Jaeger en el reverse proxy.
3. **Identificar** el atributo y la instrumentación que lo genera.
4. **Redactar** en el Collector (`processors.attributes/redaction`) y corregir en
   `telemetry.instrumentations.ts`.
5. **Purgar** el almacenamiento afectado. No esperar a que expire el TTL.
6. **Revocar** cualquier credencial expuesta aunque no haya evidencia de uso.
7. **Añadir una prueba** que impida la regresión (ver el test de cabeceras en
   `observability.e2e-spec.ts`).
8. **Documentar** el incidente.

---

## F. Comandos de referencia rápida

```bash
# Desarrollo
yarn jaeger:up                  # levantar Jaeger local
yarn jaeger:logs                # seguir sus logs
yarn jaeger:down                # apagarlo
yarn verify:jaeger              # verificación end-to-end

# Diagnóstico
curl -sS -D - -o /dev/null http://localhost:3000/api/v1/therapy-catalog/products | grep -i x-trace-id
curl -s http://localhost:16686/api/services
curl -s http://localhost:16686/api/traces/<TRACE_ID> | jq '[.data[].spans[].operationName]'

# Desactivación de emergencia
OTEL_ENABLED=false   # + redespliegue
```

## G. Interruptores por severidad

| Situación | Acción | Impacto en el servicio |
| --- | --- | --- |
| Sospecha de datos sensibles | `OTEL_ENABLED=false` | Ninguno. Se pierde visibilidad. |
| Sobrecarga de latencia | `OTEL_TRACES_SAMPLER_ARG=0.05` | Ninguno. Menos trazas. |
| Jaeger caído | *ninguna* | Ninguno. El Collector encola; la API es indiferente. |
| Collector caído | *ninguna* | Ninguno. Se pierden trazas del intervalo. |
| Almacenamiento lleno | Bajar `BADGER_SPAN_STORE_TTL` | Ninguno. Menos histórico. |
