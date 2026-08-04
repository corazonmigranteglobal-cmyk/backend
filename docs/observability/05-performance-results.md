# Fase 22 — Resultados de rendimiento

> Todas las cifras proceden de mediciones reales ejecutadas contra el backend en
> marcha, con PostgreSQL, Redis y Jaeger reales. Nada está estimado.

## 1. Entorno de medición

| Parámetro | Valor |
| --- | --- |
| Sistema | Windows 11, Node.js v22.23.1, portátil (todo en la misma máquina) |
| Backend | `dist/main.js` compilado con `yarn build` |
| Base de datos | PostgreSQL 16 en Docker, migrada y con boot seeds |
| Cache | Redis 7 en Docker |
| Backend de trazas | Jaeger all-in-one 1.62.0 en Docker, OTLP HTTP :4318 |
| Generador de carga | `autocannon` v8.0.0, 20 conexiones, 30 s por escenario |
| Endpoint | `GET /api/v1/therapy/products` — 2 consultas SQL reales por petición |
| Fecha | 2026-08-03 |

> **Aviso de validez.** Aplicación, PostgreSQL, Jaeger y el generador de carga
> compiten por la misma CPU. En producción son procesos separados, así que estos
> porcentajes son un **techo pesimista** del coste real. Sirven para comparar
> escenarios entre sí, no como cifra absoluta de capacidad.

### Corrección aplicada a la primera medición

La primera tanda arrojó ~40 000 respuestas no-2xx: el `ThrottlerGuard` (120
peticiones/minuto) devolvía 429 y se estaba midiendo la ruta de rechazo, no el
trabajo real. Se repitió todo con `THROTTLER_LIMIT` elevado. Todos los datos de
abajo tienen **100 % de respuestas 2xx y cero errores**.

## 2. Resultados bajo carga

| Escenario | req/s | 2xx | errores | p50 | p90 | p97,5 | p99 | media | RSS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `OTEL_ENABLED=false` (línea base) | **346,3** | 10 388 | 0 | 54 ms | 66 ms | 88 ms | 114 ms | 57,3 ms | 334 MB |
| ON, muestreo 1.0 | 255,8 | 7 674 | 0 | 73 ms | 95 ms | 126 ms | 160 ms | 77,7 ms | 295 MB |
| ON, muestreo 0.15 | 266,8 | 8 004 | 0 | 70 ms | 90 ms | 119 ms | 160 ms | 74,5 ms | 326 MB |
| ON, `always_off` | 289,9 | 8 698 | 0 | 64 ms | 84 ms | 107 ms | 131 ms | 68,5 ms | 352 MB |
| ON, muestreo 1.0, **Jaeger caído** | 280,5 | 8 416 | 0 | 66 ms | 81 ms | 135 ms | 175 ms | 341 MB | — |

Coste relativo a la línea base:

| Escenario | Throughput | p99 |
| --- | ---: | ---: |
| ON, muestreo 1.0 | **−26,1 %** | +46 ms |
| ON, muestreo 0.15 | −23,0 % | +46 ms |
| ON, `always_off` | −16,3 % | +17 ms |
| ON + Jaeger caído | −19,0 % | +61 ms |

## 3. Hallazgo principal: bajar el muestreo NO es una palanca de rendimiento eficaz

Es el resultado más importante de esta fase y **contradice la intuición habitual**.

- Con `always_off` (cero spans grabados, cero exportación) el coste sigue siendo
  del **−16,3 %**. Ese es el suelo: lo que cuestan los *parches* de las
  instrumentaciones y la propagación de contexto asíncrono (`AsyncLocalStorage`),
  que ocurren se muestree o no.
- Pasar de muestreo 1.0 a 0.15 sólo recupera **3 puntos** (−26,1 % → −23,0 %).

Consecuencia operativa: ante un problema de latencia atribuible a la telemetría,
bajar `OTEL_TRACES_SAMPLER_ARG` apenas ayuda. Las palancas eficaces son, en orden:

1. `OTEL_ENABLED=false` (recupera el 100 %).
2. Eliminar instrumentaciones del array de `telemetry.instrumentations.ts`
   (`instrumentation-express` es la más prolífica en spans por petición).
3. Bajar el muestreo — sólo reduce el volumen almacenado y el coste de red, no la
   sobrecarga en la aplicación.

El muestreo sigue siendo la palanca correcta para **coste de almacenamiento y de
red**, que es para lo que está pensado.

## 4. Resiliencia: comportamiento con Jaeger caído

Escenario `ON, muestreo 1.0, Jaeger caído` (contenedor parado con `yarn jaeger:down`):

| Comprobación | Resultado |
| --- | --- |
| Peticiones servidas | 8 416 |
| **Errores / respuestas no-2xx** | **0** |
| Throughput frente a la línea base | −19,0 % (mejor que con Jaeger vivo: no hay coste de red) |
| p99 | 175 ms (+61 ms) |
| Excepciones o rechazos sin manejar | ninguno |

**El backend sigue sirviendo el 100 % del tráfico con el backend de trazas caído.**
Se cumple el requisito arquitectónico de que ninguna petición de negocio dependa
de la disponibilidad de Jaeger.

Complemento en proceso aislado (exportador apuntando a un puerto muerto):
`shutdownTelemetry` retorna en **1 508 ms** con un timeout de 1 500 ms, sin lanzar,
y el proceso termina con **exit code 0**.

## 5. Coste por span de negocio (microbenchmark aislado)

20 000 spans, 2 000 de calentamiento, medidos con `process.hrtime.bigint()`
alrededor de `TracingService.runInSpan`:

| Escenario | p50 | p95 | p99 |
| --- | ---: | ---: | ---: |
| `OTEL_ENABLED=false` (span no-op) | 0,50 µs | 1,70 µs | 2,90 µs |
| ON, muestreo 1.0 | 3,30 µs | 7,90 µs | 13,30 µs |
| ON, muestreo 0.15 | 2,60 µs | 6,50 µs | 10,40 µs |
| ON, `always_off` | 1,90 µs | 4,40 µs | 6,40 µs |

Un span manual cuesta ~2,8 µs en la mediana. Con 1–3 spans de negocio por
petición, **la instrumentación manual no es la fuente de la sobrecarga**: el coste
está en las instrumentaciones automáticas (especialmente `pg`, que emite un span
por consulta, y `express`).

## 6. Arranque y memoria en reposo

Tres repeticiones alternando modo:

| Modo | Bootstrap del SDK | RSS en reposo |
| --- | ---: | ---: |
| `OTEL_ENABLED=false` | 354,5 / 369,9 / 352,2 ms | 76,1 MB |
| `OTEL_ENABLED=true` | 389,7 / 375,5 / 364,0 ms | 105,7 MB |

**+15 ms de arranque y +30 MB de RSS por proceso.** Con API y worker, ~60 MB en total.

Nota: los ~355 ms base con la telemetría desactivada son la carga de los módulos
del SDK, que se importan estáticamente. Desactivar la telemetría evita el parcheo
y la exportación, no la carga de módulos; se prefirió claridad de imports frente a
ahorrar ~350 ms una sola vez.

Bajo carga el RSS no muestra una tendencia clara entre escenarios (295–352 MB): a
esas escalas domina el momento en que actúa el recolector de basura de V8.

## 7. Recomendación de configuración

| Entorno | Configuración | Motivo |
| --- | --- | --- |
| Desarrollo | `OTEL_ENABLED=true`, muestreo `1.0` | El throughput no importa; se quiere ver todo. |
| Test | `OTEL_ENABLED=false` | Las pruebas no deben abrir sockets. |
| Staging | `OTEL_ENABLED=true`, muestreo `0.5` | Tráfico bajo. |
| Producción | `OTEL_ENABLED=true`, muestreo `0.15` | El muestreo limita coste de almacenamiento; la sobrecarga en la app es del orden del 20 % **en este banco de pruebas saturado** y previsiblemente menor con procesos separados. |

**Antes de dar por bueno el despliegue en producción**, repetir la medición de §2
en el entorno real (misma receta, misma herramienta) y comparar. Si la pérdida de
throughput resultara inaceptable, la primera acción es retirar
`instrumentation-express` de `telemetry.instrumentations.ts`, no bajar el muestreo.

## 8. Reproducir estas mediciones

```bash
# Dependencias
yarn jaeger:up
docker run -d --name pg -e POSTGRES_DB=corazon_migrante -e POSTGRES_USER=corazon \
  -e POSTGRES_PASSWORD=corazon -p 127.0.0.1:5433:5432 postgres:16-alpine
docker run -d --name rd -p 127.0.0.1:6380:6379 redis:7-alpine
node scripts/deploy-db.mjs --force --seeds-boot

# Importante: sin esto se mide el ThrottlerGuard, no la aplicación
export THROTTLER_LIMIT=100000000

# Un escenario (repetir variando OTEL_*)
OTEL_ENABLED=false node dist/main.js &
npx autocannon -c 20 -d 30 -j http://localhost:3000/api/v1/therapy/products
```

## 9. Limitación conocida de las pruebas automáticas

Las instrumentaciones automáticas se aplican con `require-in-the-middle`, que
engancha el `require` de Node. Jest resuelve los módulos con su propio registro,
así que ese enganche nunca se dispara y `http`, `express`, `pg` e `ioredis` quedan
sin parchear **dentro de Jest** (verificado: cero spans automáticos).

Reparto de responsabilidades:

- **Jest** cubre el código propio: fachada, interceptor, filtro, saneador de
  atributos, spans de negocio, propagación en el outbox y exclusión de rutas.
- **`scripts/verify-jaeger.sh` y las mediciones de este documento** cubren la
  instrumentación automática contra procesos y un Jaeger reales.

## 10. Métricas no medidas

| Métrica | Estado | Motivo |
| --- | --- | --- |
| Uso de CPU desglosado por proceso | No medida | Requiere instrumentar el host; en este banco todo comparte CPU y el dato no sería atribuible. |
| Pérdida de spans con el Collector saturado | No medida | No se desplegó Collector: en desarrollo se exporta directamente a Jaeger. |
| Comportamiento con Collector saturado | No medido | Ídem. |

Todo lo demás exigido por la Fase 22 (latencia p50/p95/p99, throughput, errores,
memoria, tiempo de arranque, tiempo de cierre, escenario con Jaeger caído,
comparativa de muestreo) está medido arriba.
