# Matriz de trazabilidad

Conecta capacidad de negocio → código → contrato → datos → prueba, para los elementos que la
[auditoría de Graphify](../reports/graphify-audit.md) identificó como críticos por centralidad o
por impacto.

## Capacidades críticas

| Capacidad | Módulo | Operaciones | Entidades | Prueba que lo respalda |
| --- | --- | ---: | --- | --- |
| Autenticar y emitir credenciales | [`auth`](../modules/auth.md) | 8 | `User`, `RefreshToken`, `AuthPin` | `auth.service.spec.ts`, `test/auth.e2e-spec.ts` |
| Reservar y gestionar citas | [`appointments`](../modules/appointments.md) | 7 | `Appointment`, `AppointmentStatusHistory`, `AppointmentDetail` | `appointments.service.spec.ts`, `policies/status-transition.policy.spec.ts` |
| Resolver disponibilidad | [`scheduling`](../modules/scheduling.md) | 11 | `TherapistSchedule`, `TherapistBlockedTime` | `scheduling.service.spec.ts` |
| Controlar el acceso (RBAC) | [`roles-permissions`](../modules/roles-permissions.md) | 0 | `Role`, `Permission`, `RolePermission`, `UserRole` | `roles-permissions.service.spec.ts`, `guards/*.spec.ts` |
| Publicar contenido editorial | [`content`](../modules/content.md) | 36 | `ContentPublication` y su taxonomía | `content-publications.service.spec.ts`, `policies/publication-status.policy.spec.ts` |
| Conceder acceso a descargables | [`downloadables`](../modules/downloadables.md) | 28 | `DownloadableEntitlement`, `DownloadableExternalEvent` | `downloadables.service.spec.ts` |
| Custodiar archivos | [`files`](../modules/files.md) | 12 | `FileAsset`, `FileAccessLog` | `files.service.spec.ts`, `file-security.service.spec.ts` |
| Entregar correo con garantía | [`messaging`](../modules/messaging.md) | 8 | `MessageOutbox`, `MessageSendLog` | `messaging.service.spec.ts`, `outbox-trace-propagation.spec.ts` |
| Registrar la auditoría | [`audit`](../modules/audit.md) | 1 | `AuditLog` | Cubierto de forma indirecta desde los módulos que escriben |
| Contabilizar la actividad | [`accounting`](../modules/accounting.md) | 9 | `AccountingTransaction`, `AccountingEntry`, `Sale` | `accounting.service.spec.ts` |

## Componentes de mayor impacto

Los diez nodos de mayor centralidad del grafo. Un cambio en cualquiera de ellos se propaga a buena
parte del sistema.

| Componente | Grado | Qué lo sostiene |
| --- | ---: | --- |
| `src/database/models/index.ts` | 175 | `associations.spec.ts` |
| `AuthenticatedUser` | 151 | Tipo compartido; lo ejercitan los tres guards y sus pruebas |
| `CurrentUser` | 115 | `decorators.spec.ts` |
| `PaginationQueryDto` | 77 | `pagination.dto.spec.ts` |
| `@Permissions()` | 64 | `permissions.guard.spec.ts` |
| `app.module.ts` | 61 | Arranque verificado por `test/auth.e2e-spec.ts` |
| `User` | 59 | `associations.spec.ts` |
| `DownloadablesService` | 53 | `downloadables.service.spec.ts` |
| `AuditService` | 51 | Indirecta |
| `AppointmentsService` | 42 | `appointments.service.spec.ts` |

## Contrato ↔ código

| Invariante | Cómo se verifica | Dónde falla si se rompe |
| --- | --- | --- |
| Toda ruta de NestJS está en el contrato | `scripts/check-openapi-coverage.mjs` compara la tabla de rutas con el contrato | `yarn docs:openapi:coverage` |
| Toda operación tiene `operationId`, `summary`, etiqueta declarada y seguridad | Mismo script | ídem |
| La seguridad publicada coincide con los decoradores | Se **deriva** de ellos en la generación; no hay copia que mantener | Imposible por construcción |
| El contrato es sintácticamente válido y cumple el gobierno | `redocly lint` con `redocly.yaml` | `yarn docs:openapi:lint` |
| Ningún enlace de la documentación apunta al vacío | `scripts/check-doc-links.mjs` | `yarn docs:links` |
| Ningún controlador queda fuera del contrato | Invariante en `generate-openapi.ts`: aborta si una clase de controlador no aporta rutas | `yarn docs:openapi:generate` |

## Deuda de trazabilidad conocida

| Elemento | Situación | Consecuencia |
| --- | --- | --- |
| `data` de las respuestas | 188 de 189 operaciones documentan el sobre pero no el esquema de la carga útil | Quien integra conoce la envoltura y los errores, no la forma exacta del contenido. Detalle en [cobertura OpenAPI](../reports/openapi-coverage.md) |
| `audit` | Sin suite propia | Su comportamiento sólo se ejercita desde los módulos que escriben en él |
| `homepage`, `notifications` | Sin suite propia | Módulos de composición; el riesgo es menor pero real |
| Migraciones | No se ejecutan en `verify:ci` | Se validan al desplegar con `yarn db:deploy`, no antes |
