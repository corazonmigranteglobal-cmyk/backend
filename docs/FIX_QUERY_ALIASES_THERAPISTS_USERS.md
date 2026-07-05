# Fix: aliases de filtros, terapeutas y ordenamiento seguro

## Problema observado

El backend respondía `400` en consultas como:

```txt
property status should not exist
property p_estado should not exist
property role should not exist
property rol should not exist
```

Esto no era un problema de datos: era un problema de contrato DTO. El `ValidationPipe` global usa `whitelist: true` y `forbidNonWhitelisted: true`, por lo que cualquier query param no declarado en el DTO hace fallar la solicitud antes de llegar al service.

## Corrección aplicada

### 1. `PaginationQueryDto`

Se añadieron aliases controlados y documentados:

- `page`, `p_page`
- `limit`, `pageSize`, `p_limit`
- `sort`, `sortBy`
- `order`, `sortDir`
- `search`, `q`
- `status`, `estado`, `p_estado`
- `role`, `rol`, `p_rol`, `tipo_usuario`

Parámetros basura como `debug`, `foo`, `unknown` siguen fallando con `400`.

### 2. `/api/v1/admin/users`

Ahora puede consultar usuarios/terapeutas con cualquiera de estas formas:

```txt
GET /api/v1/admin/users?role=THERAPIST&status=ACTIVE&page=1&limit=20
GET /api/v1/admin/users?rol=TERAPEUTA&estado=activo&page=1&limit=20
GET /api/v1/admin/users?role=TERAPEUTA&p_estado=activo&p_page=1&p_limit=20
```

El backend normaliza:

```txt
TERAPEUTA -> THERAPIST
PACIENTE  -> PATIENT
CONTADOR  -> ACCOUNTANT
activo    -> ACTIVE
inactivo  -> INACTIVE
bloqueado -> BLOCKED
pendiente -> PENDING
```

### 3. Ordenamiento seguro

Se reemplazaron usos peligrosos como:

```ts
order: [[query.sort, query.order]]
```

por `buildSafeOrder(...)` con whitelist de columnas reales/atributos Sequelize.

Esto evita errores por columnas inexistentes como `created_at`, `scheduled_start_at`, `access_type`, etc., cuando el frontend manda snake_case o aliases.

### 4. Disponibilidad pública

Se mantiene público:

```txt
GET /api/v1/booking/availability
```

Además `RolesGuard` y `PermissionsGuard` respetan `@Public()`, para evitar que un endpoint público quede bloqueado por rol o permiso si hereda metadata de una clase/controlador.

### 5. Vista de disponibilidad

El cálculo de disponibilidad descuenta intervalos de:

- `therapist_blocked_times` activos.
- `appointments` en estado `REQUESTED` o `CONFIRMED`.

A través de:

```txt
v_therapist_unavailable_intervals
```

Si tu base no tiene la vista, ejecuta la migración incluida:

```txt
src/database/migrations/20260705020000-schema-compatibility-and-premium-news.js
```

## Archivos del patch

```txt
src/common/pagination/pagination.dto.ts
src/common/guards/roles.guard.ts
src/common/guards/permissions.guard.ts
src/modules/users/users.service.ts
src/modules/scheduling/scheduling.service.ts
src/modules/advertising/advertising-campaigns.service.ts
src/modules/advertising/dto/advertising-query.dto.ts
src/modules/audit/audit.service.ts
src/modules/content/content-publications.service.ts
src/modules/content/content-query.factory.ts
src/modules/content/dto/content-query.dto.ts
src/database/migrations/20260705020000-schema-compatibility-and-premium-news.js
openapi.yml
```

Frontend opcional incluido para que la tabla de usuarios muestre correctamente `THERAPIST` como `TERAPEUTA`:

```txt
corazonmigranteFrontend/src/features/users/users.api.ts
```
