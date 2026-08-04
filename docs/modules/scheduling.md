# Módulo `scheduling`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/scheduling.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/scheduling/` |
| Etiqueta en la API | `Agenda` |
| Operaciones HTTP | 11 |
| Controladores | 1 |
| Servicios | 1 |
| DTO | 1 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 1 |
| Roles que intervienen | `ADMIN`, `SUPER_ADMIN`, `THERAPIST` |
| Permisos que exige | — |

## Por qué existe

Traduce la disponibilidad que declara cada terapeuta —horarios recurrentes y bloqueos puntuales— en
huecos concretos que una persona puede reservar. Sin esa traducción, `appointments` no tendría sobre
qué decidir.

## Reglas de dominio

- **Dos fuentes combinadas:** el horario semanal recurrente (`therapist_schedule`) define lo que se
  ofrece; los bloqueos (`therapist_blocked_time`) restan de él.
- **Los huecos se calculan, no se almacenan.** Evita que una agenda quede desincronizada respecto a
  los cambios de horario.
- **Las horas se persisten en UTC y se manipulan con Luxon.** El centro atiende a personas en husos
  distintos: una hora sin huso es una hora ambigua.

## Superficie pública

`BookingController` es público a propósito: alguien debe poder ver huecos libres antes de tener
cuenta. No expone identidad de pacientes ni detalles de citas existentes.

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/therapists/{therapistUserId}/schedules` | [Admin] Listar horarios de un terapeuta | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/therapists/{therapistUserId}/schedules` | [Admin] Crear bloque horario para un terapeuta | `ADMIN`, `SUPER_ADMIN` | — |
| `DELETE /api/v1/admin/therapists/{therapistUserId}/schedules/{scheduleId}` | [Admin] Desactivar bloque horario de un terapeuta | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/therapists/{therapistUserId}/schedules/{scheduleId}` | [Admin] Actualizar bloque horario de un terapeuta | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/booking/availability` | Consultar disponibilidad horaria de un terapeuta (endpoint público) | Público | — |
| `GET /api/v1/booking/therapists` | Listar terapeutas disponibles (endpoint público) | Público | — |
| `POST /api/v1/therapists/me/blocked-times` | Bloquear un rango de tiempo en la agenda propia | `THERAPIST` | — |
| `GET /api/v1/therapists/me/schedules` | Listar horarios del terapeuta autenticado | `THERAPIST` | — |
| `POST /api/v1/therapists/me/schedules` | Crear bloque horario para el terapeuta autenticado | `THERAPIST` | — |
| `DELETE /api/v1/therapists/me/schedules/{scheduleId}` | Desactivar bloque horario propio | `THERAPIST` | — |
| `PATCH /api/v1/therapists/me/schedules/{scheduleId}` | Actualizar bloque horario propio | `THERAPIST` | — |

## Código

**Controladores**

- [`src/modules/scheduling/scheduling.controller.ts`](../../src/modules/scheduling/scheduling.controller.ts)

**Servicios**

- [`src/modules/scheduling/scheduling.service.ts`](../../src/modules/scheduling/scheduling.service.ts)

**DTO**

- [`src/modules/scheduling/dto/scheduling.dto.ts`](../../src/modules/scheduling/dto/scheduling.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `Appointment` — ver [catálogo de entidades](../data/entity-catalog.md)
- `FileAsset` — ver [catálogo de entidades](../data/entity-catalog.md)
- `TherapistBlockedTime` — ver [catálogo de entidades](../data/entity-catalog.md)
- `TherapistProduct` — ver [catálogo de entidades](../data/entity-catalog.md)
- `TherapistProfile` — ver [catálogo de entidades](../data/entity-catalog.md)
- `TherapistSchedule` — ver [catálogo de entidades](../data/entity-catalog.md)
- `TherapyProduct` — ver [catálogo de entidades](../data/entity-catalog.md)
- `User` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/scheduling/scheduling.service.spec.ts`](../../src/modules/scheduling/scheduling.service.spec.ts)

