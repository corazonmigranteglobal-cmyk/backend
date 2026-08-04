# Módulo `notifications`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/notifications.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/notifications/` |
| Etiqueta en la API | `Notificaciones` |
| Operaciones HTTP | 5 |
| Controladores | 1 |
| Servicios | 1 |
| DTO | 0 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 0 |
| Roles que intervienen | `ADMIN`, `SUPER_ADMIN` |
| Permisos que exige | — |

## Por qué existe

Avisa al panel administrativo de hechos que requieren atención humana: una cita nueva, una
cancelación, la concesión de un acceso descargable. Es distinto de `messaging`: aquí el destinatario
es el equipo interno y el canal es la propia aplicación, no el correo.

## Reglas de dominio

- **Son de lectura administrativa**, nunca visibles para pacientes.
- **No sustituyen al registro de auditoría.** Una notificación puede marcarse como leída y
  desaparecer del flujo; el rastro de auditoría es inmutable.

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/notifications` | [Admin] Listar notificaciones con paginación | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/notifications/{id}/read` | [Admin] Marcar notificación como leída | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/notifications/read-all` | [Admin] Marcar todas las notificaciones como leídas | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/notifications/stream` | [Admin] Stream SSE de notificaciones en tiempo real | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/notifications/unread-count` | [Admin] Cantidad de notificaciones no leídas | `ADMIN`, `SUPER_ADMIN` | — |

## Código

**Controladores**

- [`src/modules/notifications/notifications.controller.ts`](../../src/modules/notifications/notifications.controller.ts)

**Servicios**

- [`src/modules/notifications/notifications.service.ts`](../../src/modules/notifications/notifications.service.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `AdminNotification` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

⚠️ **Sin pruebas automatizadas propias.** Su comportamiento sólo se ejercita de forma indirecta.

