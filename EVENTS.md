# EVENTS.md — Sistema de Notificaciones y Eventos de Dominio

## Arquitectura

Corazón Migrante usa un bus de eventos en memoria (RxJS `Subject`) combinado con
persistencia en la tabla `admin_notifications`. No se usa Kafka ni RabbitMQ — el sistema
es un monolito modular y no lo requiere.

```
Servicio de negocio
    │
    │  void this.notifications.emit({ type, entityType, entityId, payload })
    ▼
NotificationsService
    ├─ INSERT admin_notifications (persistencia)
    └─ Subject.next(event)
              │
              ▼
    [admin A] EventSource ← GET /admin/notifications/stream (SSE)
    [admin B] EventSource ← GET /admin/notifications/stream (SSE)
```

## Tipos de eventos actuales

| Tipo                      | Origen                              | Descripción                        |
|---------------------------|-------------------------------------|------------------------------------|
| `APPOINTMENT_REQUESTED`   | AppointmentsService.create()        | Nueva cita solicitada              |
| `APPOINTMENT_CONFIRMED`   | AppointmentsService.adminUpdate()   | Cita confirmada por admin          |
| `APPOINTMENT_CANCELLED`   | AppointmentsService.updateStatus()  | Cita cancelada                     |
| `APPOINTMENT_COMPLETED`   | AppointmentsService.updateStatus()  | Cita completada                    |
| `APPOINTMENT_NO_SHOW`     | AppointmentsService.updateStatus()  | Paciente no se presentó            |

## Cómo agregar un nuevo evento

1. Inyectar `NotificationsService` en el módulo correspondiente.
2. Importar `NotificationsModule` en el módulo que lo consume.
3. Llamar `void this.notifications.emit({ type: 'MI_EVENTO', ... })` **después** del commit de transacción.
4. Agregar el tipo a `TYPE_LABELS` y `TYPE_BADGE` en el frontend (`notifications.api.ts`, `notificaciones/page.tsx`).

## Tabla admin_notifications

```sql
CREATE TABLE admin_notifications (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  type           VARCHAR(100) NOT NULL,
  entity_type    VARCHAR(100),
  entity_id      UUID,
  payload        JSONB        NOT NULL DEFAULT '{}',
  is_read        BOOLEAN      NOT NULL DEFAULT false,
  read_at        TIMESTAMPTZ,
  recipient_role VARCHAR(50)  NOT NULL DEFAULT 'ADMIN',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

## SSE y autenticación

El endpoint SSE (`GET /admin/notifications/stream`) está protegido por el guard JWT global.
El frontend conecta `EventSource` pasando el token como query param `?token=<accessToken>`.

> **Nota**: En producción con balanceador de carga, los clientes SSE de distintos pods
> NO recibirán eventos del pod que no los generó. Solución: usar Redis Pub/Sub como
> transport del `Subject` cuando se escale horizontalmente.
