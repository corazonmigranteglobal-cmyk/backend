# Módulo `appointments`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/appointments.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/appointments/` |
| Etiqueta en la API | `Citas` |
| Operaciones HTTP | 7 |
| Controladores | 1 |
| Servicios | 1 |
| DTO | 1 |
| Políticas de dominio | 2 |
| Adaptadores externos | 0 |
| Suites de prueba | 2 |
| Roles que intervienen | `ADMIN`, `PATIENT`, `SUPER_ADMIN`, `THERAPIST` |
| Permisos que exige | `appointments:read`, `appointments:write` |

## Por qué existe

Es la capacidad central del producto: poner en contacto a una persona paciente con una terapeuta en
un horario concreto. Todo lo demás —catálogo, contabilidad, notificaciones— existe para sostener
este flujo o para explotarlo.

## Reglas de dominio

- **Una cita sólo se reserva sobre disponibilidad real.** El módulo consulta `scheduling` antes de
  confirmar; no hay reserva optimista.
- **Las transiciones de estado las gobierna una política explícita**
  (`policies/status-transition.policy.ts`), no condicionales dispersos. Una transición inválida
  produce un error de dominio, no un 500.
- **Toda transición queda en el historial.** `appointment_status_history` conserva quién cambió qué
  y cuándo; es información clínica y de responsabilidad, no un registro técnico.
- **Reservar en nombre de otra persona exige rol.** La validación estricta del `ValidationPipe`
  (`forbidNonWhitelisted`) se conserva precisamente porque relajarla reabría el agujero por el que
  una persona paciente podía reservar a nombre de otra.

## Efectos hacia otros módulos

Notifica al panel administrativo (`notifications`), encola correos de confirmación (`messaging`),
consulta disponibilidad (`scheduling`) y deja rastro en `audit`. Es el módulo con más dependencias
de dominio del sistema.

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `POST /api/v1/appointments` | Crear cita (paciente autenticado) | `PATIENT` | — |
| `PATCH /api/v1/appointments/{id}/status` | Actualizar estado de una cita | Autenticado | — |
| `POST /api/v1/appointments/admin` | [Admin/Terapeuta] Crear cita para un paciente | `ADMIN`, `SUPER_ADMIN`, `THERAPIST` | `appointments:write` |
| `PATCH /api/v1/appointments/admin/{id}` | [Admin] Actualizar datos de una cita | `ADMIN`, `SUPER_ADMIN` | `appointments:write` |
| `PATCH /api/v1/appointments/admin/{id}/payment` | [Admin] Registrar o actualizar pago de una cita | `ADMIN`, `SUPER_ADMIN` | `appointments:write` |
| `GET /api/v1/appointments/admin/list` | [Admin] Listar todas las citas con paginación | `ADMIN`, `SUPER_ADMIN` | `appointments:read` |
| `GET /api/v1/appointments/mine` | Listar citas del usuario autenticado | Autenticado | — |

## Código

**Controladores**

- [`src/modules/appointments/appointments.controller.ts`](../../src/modules/appointments/appointments.controller.ts)

**Servicios**

- [`src/modules/appointments/appointments.service.ts`](../../src/modules/appointments/appointments.service.ts)

**Políticas de dominio**

- [`src/modules/appointments/policies/status-transition.policy.spec.ts`](../../src/modules/appointments/policies/status-transition.policy.spec.ts)
- [`src/modules/appointments/policies/status-transition.policy.ts`](../../src/modules/appointments/policies/status-transition.policy.ts)

**DTO**

- [`src/modules/appointments/dto/appointment.dto.ts`](../../src/modules/appointments/dto/appointment.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `Appointment` — ver [catálogo de entidades](../data/entity-catalog.md)
- `AppointmentStatusHistory` — ver [catálogo de entidades](../data/entity-catalog.md)
- `PatientProfile` — ver [catálogo de entidades](../data/entity-catalog.md)
- `TherapistProfile` — ver [catálogo de entidades](../data/entity-catalog.md)
- `TherapyApproach` — ver [catálogo de entidades](../data/entity-catalog.md)
- `TherapyProduct` — ver [catálogo de entidades](../data/entity-catalog.md)
- `User` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/appointments/appointments.service.spec.ts`](../../src/modules/appointments/appointments.service.spec.ts)
- [`src/modules/appointments/policies/status-transition.policy.spec.ts`](../../src/modules/appointments/policies/status-transition.policy.spec.ts)

