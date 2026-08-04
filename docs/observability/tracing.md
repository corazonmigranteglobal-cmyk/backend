# Trazas distribuidas

El backend está instrumentado con **OpenTelemetry** y exporta por OTLP sobre HTTP.

## Un detalle que no se puede tocar

[`telemetry.bootstrap.api.ts`](../../src/observability/telemetry.bootstrap.api.ts) es la **primera
importación del proceso**, por encima incluso de `dotenv`. Las instrumentaciones automáticas
parchean `http`, `express`, `pg`, `ioredis` y `pino` en el momento de cargarlos: **cualquier import
por encima de esa línea rompe la instrumentación en silencio**, sin error y sin spans.

## Qué se instrumenta

`http` · `express` · `nestjs-core` · `pg` · `ioredis` · `undici` · `pino`

Configuración en [`telemetry.instrumentations.ts`](../../src/observability/telemetry.instrumentations.ts).

## Propagación al trabajo asíncrono

El caso interesante no es la petición HTTP, sino el correo que se envía minutos después. El outbox
guarda el contexto de traza junto al mensaje y el worker lo restaura al procesarlo
([`messaging-trace.service.ts`](../../src/observability/messaging-trace.service.ts)), de modo que un
envío sigue siendo atribuible a la acción que lo originó. Cubierto por
`src/modules/messaging/outbox-trace-propagation.spec.ts`.

## Redacción

[`span-redaction.processor.ts`](../../src/observability/span-redaction.processor.ts) elimina
atributos sensibles **antes** de exportar. Las trazas salen de la red del sistema; los datos
clínicos, no.

## Correlación con la respuesta

`TraceResponseInterceptor` fija la cabecera `x-trace-id` en toda respuesta, **incluidas las de
error**. El filtro global la fija también para 401, 403 y 404, que nunca pasan por los
interceptores y son justo los errores que la gente acaba reportando a soporte.

## Limitación conocida de las pruebas

Dentro de Jest **no se activan las instrumentaciones automáticas**. Se aplican mediante
`require-in-the-middle`, que engancha el `require` de Node, y Jest resuelve los módulos con su
propio registro, así que el enganche nunca se dispara. Se verificó empíricamente: cero spans
automáticos.

El reparto que resulta:

| Capa | Qué cubre |
| --- | --- |
| Jest | Código propio: interceptor, filtro, spans de negocio, propagación en el outbox, exclusión de rutas |
| `scripts/verify-jaeger.sh` | Instrumentación automática de extremo a extremo, contra un proceso y un Jaeger reales |

## Infraestructura local

```bash
yarn jaeger:up      # Jaeger en docker
yarn verify:jaeger  # comprobación end-to-end
yarn jaeger:down
```

La configuración del colector está en `infra/otel-collector/`.
