# DESIGN.md — Decisiones de Diseño

## 1. Monolito modular (no microservicios)

**Decisión**: NestJS monolito con módulos bien delimitados.

**Justificación**: El equipo es pequeño, el volumen de tráfico es moderado y la complejidad
operacional de microservicios no se justifica. La arquitectura modular permite extraer
servicios en el futuro sin reescribir la lógica de negocio.

**Restricción respetada**: No usar Kafka, RabbitMQ ni colas externas.

## 2. Outbox pattern para emails

El módulo `messaging` implementa un outbox transaccional:
- Los emails se encolan en la misma transacción que el evento que los origina.
- El `outbox.worker.ts` los procesa de forma asíncrona.
- Garantiza que nunca se pierda un email aunque el servidor de correo esté caído.

## 3. Notificaciones admin vía SSE (no WebSocket)

**Decisión**: Server-Sent Events en lugar de WebSocket.

**Justificación**: Las notificaciones son unidireccionales (servidor → admin). SSE es
más simple, funciona sobre HTTP/1.1, y no requiere librerías adicionales.

**Limitación conocida**: En deployments multi-pod, los admins conectados a distintos
pods no recibirán eventos del pod remoto. Solución futura: Redis Pub/Sub como bus.

## 4. Lock pesimista para reserva de citas

**Decisión**: `SELECT … FOR UPDATE` dentro de la transacción de creación de citas.

**Alternativa descartada**: Verificación optimista (comparar versión/timestamp).

**Justificación**: La probabilidad de colisión en reservas simultáneas es real cuando
hay pocos slots disponibles. El lock pesimista es más sencillo y seguro en este caso.

## 5. Privacidad de notas clínicas

**Decisión**: `notesForTherapist` excluido de queries admin a nivel de servicio.

**Implementación**:
```typescript
const ADMIN_APPOINTMENT_ATTRIBUTES = { exclude: ['notesForTherapist'] };
```

**Justificación**: El terapeuta tiene secreto profesional con su paciente. El admin
(que puede ser la misma psicóloga con rol admin) no debe confundir las dos capas.

## 6. Seeds en bootstrap automático

**Decisión**: Seeds se aplican al iniciar la app, no manualmente.

**Justificación**: Elimina el paso manual "recordar correr los seeds". Los seeds son
idempotentes — es seguro correrlos N veces.

## 7. Paginación unificada

Todos los listados usan `PaginationQueryDto` con:
- Aliases legacy (`p_page`, `p_limit`) para compatibilidad con frontends existentes
- Respuesta estándar: `{ items, pagination: { page, pageSize, total, totalPages } }`
- Ordenamiento con whitelist (`resolveSafeSort`) para prevenir inyección SQL

## 8. RBAC granular (roles + permisos)

Roles: `PATIENT`, `THERAPIST`, `ADMIN`, `SUPER_ADMIN`, `CONTADOR`

Los permisos son más granulares que los roles (ej: `appointments:read`, `users:manage`).
Esto permite asignar permisos adicionales a un usuario sin cambiar su rol.
