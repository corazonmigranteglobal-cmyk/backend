# Observabilidad — guía para desarrolladores

Trazabilidad distribuida del backend de Corazón Migrante con **OpenTelemetry**,
exportando por **OTLP** a **Jaeger**.

```text
Aplicación NestJS → OpenTelemetry SDK → OTLP (http/protobuf) → Jaeger
```

## Índice

| Documento | Contenido |
| --- | --- |
| [00-current-state-audit.md](00-current-state-audit.md) | Arquitectura real detectada antes de instrumentar |
| [01-architecture-design.md](01-architecture-design.md) | Decisiones de diseño con alternativas evaluadas |
| [02-business-spans-catalog.md](02-business-spans-catalog.md) | Catálogo de spans manuales |
| [03-production-topology.md](03-production-topology.md) | Topología, almacenamiento y retención |
| [04-data-privacy-policy.md](04-data-privacy-policy.md) | Qué se puede y qué no se puede registrar |
| [05-performance-results.md](05-performance-results.md) | Mediciones reales de sobrecarga |
| [06-operational-runbook.md](06-operational-runbook.md) | Diagnóstico de incidencias |

---

## 1. Conceptos en cinco minutos

- **Traza (trace):** todo lo que ocurre a raíz de una acción — una petición HTTP,
  un ciclo del worker. Se identifica con un **`trace_id`** de 32 caracteres hexadecimales.
- **Span:** una operación dentro de la traza, con nombre, inicio, duración,
  atributos y eventos. Se identifica con un **`span_id`** de 16 caracteres.
- **Contexto:** el `trace_id` + `span_id` activos «aquí y ahora». Se propaga solo
  entre funciones asíncronas del mismo proceso; **entre procesos hay que
  serializarlo** (es lo que hace el outbox).
- **Padre/hijo:** un span hijo cuelga de su padre y su duración está contenida en
  la de éste. Todos comparten `trace_id`.
- **Link:** relación entre spans que **no** son padre-hijo. Se usa cuando la
  operación es diferida: el productor ya terminó cuando el consumidor arranca.

Ejemplo de una traza de este backend:

```text
GET /api/v1/appointments                (span HTTP, instrumentación automática)
 └─ AppointmentsController.create       (instrumentación de NestJS)
     └─ appointment.create              (span de negocio, TracingService)
         ├─ pg.query INSERT citas       (instrumentación de pg)
         ├─ pg.query INSERT auditoria
         └─ outbox.enqueue [PRODUCER]   (span de negocio)
             └─ pg.query INSERT mensaje_outbox

… minutos después, en otro proceso …

scheduler.outbox-poll                    (traza raíz del worker)
 └─ outbox.process [CONSUMER] ──link──► outbox.enqueue   (mismo trace_id)
     └─ HTTPS POST api.sendgrid.com      (instrumentación http)
```

---

## 2. Levantar Jaeger y el backend

```bash
# 1. Jaeger local (UI en http://localhost:16686)
yarn jaeger:up

# 2. Activar la telemetría en .env
#    OTEL_ENABLED=true
#    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
#    OTEL_TRACES_SAMPLER_ARG=1.0

# 3. Backend
yarn start:dev

# 4. Worker (proceso aparte, otro service.name)
yarn build && yarn worker:outbox

# 5. Verificación end-to-end
yarn verify:jaeger
```

Con el backend **dentro** de Docker, el endpoint es `http://jaeger:4318/v1/traces`
y se levanta todo junto:

```bash
docker compose -f docker-compose.yml -f docker-compose.jaeger.yml up -d
```

Apagar: `yarn jaeger:down`.

---

## 3. Buscar una traza

1. Abrir <http://localhost:16686>.
2. **Por `trace_id`** (lo habitual en soporte): pegar el valor de la cabecera
   `x-trace-id` en el buscador superior, o ir directamente a
   `http://localhost:16686/trace/<trace_id>`.
3. **Por servicio:** elegir `corazon-migrante-api` o `corazon-migrante-worker-outbox`.
4. **Por operación:** `appointment.create`, `auth.login`, `outbox.process`…
5. **Sólo errores:** añadir la etiqueta `error=true`.
6. **Por entidad:** etiqueta `app.entity.id=<uuid>`.

Obtener el `trace_id` de una petición:

```bash
curl -sS -D - -o /dev/null http://localhost:3000/api/v1/therapy-catalog/products | grep -i x-trace-id
```

---

## 4. Crear un span manual

Inyectar `TracingService` (el módulo es `@Global`, no hay que importar nada):

```ts
import { Injectable } from '@nestjs/common';
import { APP_ATTR } from '@/observability/telemetry.constants';
import { TracingService } from '@/observability/tracing.service';

@Injectable()
export class MiServicio {
  constructor(private readonly tracing: TracingService) {}

  async hacerAlgoImportante(entidadId: string) {
    return this.tracing.runInSpan(
      'midominio.accion',                       // <dominio>.<acción>, SIN ids
      {
        [APP_ATTR.module]: 'midominio',
        [APP_ATTR.operation]: 'accion',
        [APP_ATTR.entityType]: 'mi-entidad',
        [APP_ATTR.entityId]: entidadId,         // el id va aquí, no en el nombre
      },
      async (span) => {
        span.addEvent('validacion.completada');
        const resultado = await this.trabajoReal(entidadId);
        span.setAttribute(APP_ATTR.result, resultado.estado);
        return resultado;
      },
    );
  }
}
```

Ejemplo real en el repositorio:
[appointments.service.ts](../../src/modules/appointments/appointments.service.ts)
(`appointment.create`).

**Garantías de `runInSpan`:** cierra el span siempre, registra la excepción una
sola vez, marca el estado como error y **relanza el error original sin tocarlo**.
Nunca hay que llamar a `span.end()` a mano.

### Eventos y atributos

```ts
span.addEvent('rules.started');                       // hito temporal
span.addEvent('lote.procesado', { 'app.batch.size': 50 });
span.setAttribute('app.result', 'granted');           // dato del span
span.setAttributes({ 'app.module': 'credit' });
```

Fuera de un callback de span, `this.tracing.addEvent(...)` y
`this.tracing.setAttributes(...)` actúan sobre el span activo y **no fallan** si
no hay ninguno.

### Cuándo NO crear un span

- Getters, mapeadores, validadores triviales.
- Listados que sólo hacen un `SELECT` (los cubre `instrumentation-pg`).
- Un span por registro dentro de un bucle sobre miles de elementos.
- Cualquier cosa que ya emita la instrumentación automática.

---

## 5. Qué NO registrar

Resumen; la política completa está en
[04-data-privacy-policy.md](04-data-privacy-policy.md).

❌ Emails, teléfonos, nombres · contraseñas y hashes · tokens y claves de API ·
cabeceras `Authorization`/`Cookie` · notas para el terapeuta, motivos de consulta,
diagnósticos · documentos de identidad · datos bancarios · cuerpos de petición o
respuesta · nombres de fichero subidos · SQL con valores · variables de entorno.

✅ UUIDs internos · enums de dominio · nombres de módulo y operación · contadores ·
atributos técnicos estándar.

Regla mental: **si aparece en la base de datos como dato del paciente, no va en la traza.**

---

## 6. Instrumentar un worker

Un worker es un proceso independiente y necesita su propio SDK y su propio
`service.name`. Patrón (ver [outbox.worker.ts](../../src/workers/outbox.worker.ts)):

```ts
// PRIMERA línea del archivo. Cualquier import por encima rompe la instrumentación.
import '@/observability/telemetry.bootstrap.worker';

import { NestFactory } from '@nestjs/core';
// … el resto
```

Para un worker nuevo, crear su propio módulo de arranque junto a los existentes:

```ts
// src/observability/telemetry.bootstrap.<nombre>.ts
import 'dotenv/config';
import { startTelemetry } from './telemetry.bootstrap';

startTelemetry({ serviceName: process.env.OTEL_SERVICE_NAME?.trim() || 'corazon-migrante-worker-<nombre>' });
```

> ¿Por qué un archivo por proceso y no una variable de entorno? Porque TypeScript
> compila a CommonJS y eleva todos los `import` a `require` **antes** de ejecutar
> cualquier sentencia. El único modo fiable de arrancar el SDK antes que NestJS es
> que el arranque ocurra dentro del módulo importado en primera posición.

### Propagar el contexto a través de una cola

Al publicar:

```ts
const carrier = this.messagingTrace.inject();   // undefined si no hay traza activa
await modelo.create({ payload: carrier ? { ...datos, _trace: carrier } : datos });
```

Al consumir:

```ts
await this.messagingTrace.runAsConsumer(
  'micola.process',
  mensaje.payload?._trace,        // tolera undefined: mensajes antiguos siguen funcionando
  { [MESSAGING_ATTR.system]: 'postgresql-outbox' },
  async (span) => this.entregar(mensaje, span),
);
```

---

## 7. Instrumentar un proceso programado

Un cron o un bucle de sondeo **no** proviene de ninguna petición: cada ejecución
abre su propia traza raíz.

```ts
await tracing.runInSpan(
  'scheduler.<nombre-del-job>',
  {
    [APP_ATTR.jobName]: '<nombre-del-job>',
    [APP_ATTR.batchSize]: tamañoLote,
  },
  async (span) => {
    const resultado = await procesarLote();
    span.setAttribute(APP_ATTR.batchProcessed, resultado.procesados);
    return resultado;
  },
);
```

Reglas: nunca un span que dure toda la vida del proceso; nunca un span por
registro si se procesan miles; siempre contadores agregados.

---

## 8. Validar los logs

Con `OTEL_ENABLED=true` y un span activo, cada log de Pino incluye:

```json
{
  "level": 30,
  "time": "2026-08-03T15:04:05.000Z",
  "trace_id": "ee31c862deceedc3e6b439acb6ef3b1d",
  "span_id": "9d0f21ab3c4e5f60",
  "trace_flags": "01",
  "msg": "HTTP_RESPONSE_SENT"
}
```

Comprobación rápida:

```bash
curl -sS -D - -o /dev/null http://localhost:3000/api/v1/therapy-catalog/products | grep -i x-trace-id
# el mismo trace_id debe aparecer en los logs de esa petición
```

Si falta `trace_id`, ver [06-operational-runbook.md](06-operational-runbook.md) §C.

---

## 9. Problemas frecuentes

| Síntoma | Causa habitual |
| --- | --- |
| No aparece ninguna traza | `OTEL_ENABLED=false` |
| No hay cabecera `x-trace-id` | Telemetría desactivada, muestreo bajo, o ruta excluida |
| Los logs no llevan `trace_id` | Pino se cargó antes que el SDK: revisar la primera línea de `main.ts` |
| Faltan spans de `pg` o Redis | El bootstrap no es la primera importación |
| El worker no aparece en Jaeger | Su contenedor no tiene las variables `OTEL_*` |
| La traza del worker no se enlaza | El mensaje es anterior al despliegue (sin `_trace`): es correcto |
| `Connection refused` al exportar | Dentro de Docker hay que usar `jaeger`/`otel-collector`, no `localhost` |
| Jaeger caído | No pasa nada: la exportación es asíncrona y la API es indiferente |

Diagnóstico detallado: [06-operational-runbook.md](06-operational-runbook.md).

---

## 10. Desactivar la telemetría

```env
OTEL_ENABLED=false
```

El backend arranca sin instrumentar nada ni abrir ningún socket. `TracingService`
sigue funcionando: la API de OpenTelemetry sin SDK registrado devuelve spans
no-op, así que **el código de dominio no necesita condicionales**. Es el modo por
defecto y el que usan las pruebas.

---

## 11. Ejecutar las pruebas

```bash
yarn test src/observability          # pruebas unitarias de la capa
yarn test src/modules/messaging      # propagación en el outbox
yarn test:cov                        # cobertura, con umbrales
yarn test:e2e                        # incluye test/observability/*.e2e-spec.ts
yarn verify:jaeger                   # end-to-end contra Jaeger real
```

---

## 12. Saneado automático de atributos

`SpanRedactionProcessor` se ejecuta antes de exportar y **no hay que invocarlo**:

| Atributo | Qué hace |
| --- | --- |
| `url.full`, `http.url`, `http.target` | Elimina el query string y el fragmento |
| `db.query.text`, `db.statement` | Sustituye los literales del SQL por `'?'` |
| `url.query`, `db.query.parameters` | Los elimina |

Existe porque dos fugas reales sobrevivían a la configuración de las
instrumentaciones: el query string íntegro en `url.full` y los valores del SQL en
`db.query.text` —Sequelize los interpola en la sentencia en vez de usar
parámetros ligados. Detalle en
[04-data-privacy-policy.md](04-data-privacy-policy.md) §4.1.

Si añades una instrumentación nueva que publique un atributo con datos de
usuario, regístralo en `REDACTORS` o `DROPPED_ATTRIBUTES` de
[span-redaction.processor.ts](../../src/observability/span-redaction.processor.ts).
