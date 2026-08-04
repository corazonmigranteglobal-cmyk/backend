# Módulo `users`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/users.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/users/` |
| Etiqueta en la API | `Usuarios` |
| Operaciones HTTP | 9 |
| Controladores | 1 |
| Servicios | 1 |
| DTO | 1 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 1 |
| Roles que intervienen | `ADMIN`, `PATIENT`, `SUPER_ADMIN`, `THERAPIST` |
| Permisos que exige | `users:read` |

## Por qué existe

Gestiona el ciclo de vida de las cuentas y de los tres perfiles que puede tener una persona:
paciente, terapeuta y administradora. Separar la cuenta del perfil permite que una misma identidad
cambie de rol sin duplicar credenciales.

## Reglas de dominio

- **La cuenta y el perfil son entidades distintas.** `User` guarda credenciales y estado; el perfil
  guarda lo específico del rol (datos de paciente, enfoques de terapeuta).
- **La asignación de roles pasa siempre por `roles-permissions`.** Este módulo no inventa permisos.
- **Aprobar a un terapeuta es una operación de negocio**, no un cambio de campo: habilita su
  presencia en el catálogo público y su capacidad de recibir citas.

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/users` | [Admin] Listar todos los usuarios con paginación | `ADMIN`, `SUPER_ADMIN` | `users:read` |
| `PATCH /api/v1/admin/users/{userId}/avatar` | [Admin] Actualizar avatar de usuario por ID | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/users/{userId}/status` | [Admin] Cambiar estado de usuario (ACTIVE/INACTIVE/BLOCKED/PENDING) | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/users/{userId}/therapist-profile` | [Admin] Actualizar perfil de terapeuta por ID | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/users/patients` | [Admin] Listar pacientes con paginación | `ADMIN`, `SUPER_ADMIN` | `users:read` |
| `GET /api/v1/me` | Obtener perfil del usuario autenticado | Autenticado | — |
| `PATCH /api/v1/me/avatar` | Actualizar avatar del usuario autenticado | Autenticado | — |
| `PATCH /api/v1/me/patient-profile` | Actualizar perfil de paciente propio | `PATIENT` | — |
| `PATCH /api/v1/me/therapist-profile` | Actualizar perfil de terapeuta propio | `THERAPIST` | — |

## Código

**Controladores**

- [`src/modules/users/users.controller.ts`](../../src/modules/users/users.controller.ts)

**Servicios**

- [`src/modules/users/users.service.ts`](../../src/modules/users/users.service.ts)

**DTO**

- [`src/modules/users/dto/update-profile.dto.ts`](../../src/modules/users/dto/update-profile.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `AdminProfile` — ver [catálogo de entidades](../data/entity-catalog.md)
- `FileAsset` — ver [catálogo de entidades](../data/entity-catalog.md)
- `PatientProfile` — ver [catálogo de entidades](../data/entity-catalog.md)
- `TherapistProfile` — ver [catálogo de entidades](../data/entity-catalog.md)
- `User` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/users/users.service.spec.ts`](../../src/modules/users/users.service.spec.ts)

