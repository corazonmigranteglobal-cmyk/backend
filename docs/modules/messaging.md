# Módulo `messaging`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/messaging.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/messaging/` |
| Etiqueta en la API | `Mensajería` |
| Operaciones HTTP | 8 |
| Controladores | 1 |
| Servicios | 2 |
| DTO | 1 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 2 |
| Roles que intervienen | `ADMIN`, `SUPER_ADMIN` |
| Permisos que exige | `messaging:read`, `messaging:write` |

## Por qué existe

Garantiza que un correo prometido durante una transacción acabe enviándose, incluso si el proveedor
está caído en ese instante. Implementa el patrón *outbox*: la intención de enviar se persiste en la
misma transacción que el cambio de negocio.

## Reglas de dominio

- **Ningún handler HTTP envía correo de forma síncrona.** La respuesta al cliente nunca depende de
  que SendGrid conteste. Es la garantía central del módulo.
- **El worker es un proceso separado** (`src/workers/outbox.worker.ts`), no un temporizador dentro
  de la API. Puede escalarse o detenerse sin tocar el servicio HTTP.
- **Reintentos con retroceso exponencial** y bloqueo por lote con caducidad (`OUTBOX_STALE_LOCK_MS`),
  para que un worker que muera no deje mensajes atascados.
- **El proveedor por defecto en desarrollo es `DEV_NULL`:** no se envía correo real salvo
  configuración explícita.

Detalle en [semántica de entrega](../events/delivery-semantics.md) y
[reintentos y DLQ](../events/retries-and-dlq.md).

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/mensajeria/outbox` | Listar los mensajes pendientes y procesados del outbox | `ADMIN`, `SUPER_ADMIN` | `messaging:read` |
| `POST /api/v1/admin/mensajeria/outbox/{id}/process` | Forzar el reenvío de un mensaje concreto | `ADMIN`, `SUPER_ADMIN` | `messaging:write` |
| `POST /api/v1/admin/mensajeria/outbox/process` | Forzar el procesamiento del lote pendiente del outbox | `ADMIN`, `SUPER_ADMIN` | `messaging:write` |
| `POST /api/v1/admin/mensajeria/test-email` | Encolar un correo de prueba para validar el proveedor | `ADMIN`, `SUPER_ADMIN` | `messaging:write` |
| `GET /api/v1/admin/messaging/outbox` | Listar los mensajes pendientes y procesados del outbox | `ADMIN`, `SUPER_ADMIN` | `messaging:read` |
| `POST /api/v1/admin/messaging/outbox/{id}/process` | Forzar el reenvío de un mensaje concreto | `ADMIN`, `SUPER_ADMIN` | `messaging:write` |
| `POST /api/v1/admin/messaging/outbox/process` | Forzar el procesamiento del lote pendiente del outbox | `ADMIN`, `SUPER_ADMIN` | `messaging:write` |
| `POST /api/v1/admin/messaging/test-email` | Encolar un correo de prueba para validar el proveedor | `ADMIN`, `SUPER_ADMIN` | `messaging:write` |

## Código

**Controladores**

- [`src/modules/messaging/messaging.controller.ts`](../../src/modules/messaging/messaging.controller.ts)

**Servicios**

- [`src/modules/messaging/messaging-provider.service.ts`](../../src/modules/messaging/messaging-provider.service.ts)
- [`src/modules/messaging/messaging.service.ts`](../../src/modules/messaging/messaging.service.ts)

**DTO**

- [`src/modules/messaging/dto/test-email.dto.ts`](../../src/modules/messaging/dto/test-email.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `MessageOutbox` — ver [catálogo de entidades](../data/entity-catalog.md)
- `MessageSendLog` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/messaging/messaging.service.spec.ts`](../../src/modules/messaging/messaging.service.spec.ts)
- [`src/modules/messaging/outbox-trace-propagation.spec.ts`](../../src/modules/messaging/outbox-trace-propagation.spec.ts)

