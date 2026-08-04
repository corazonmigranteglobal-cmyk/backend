# Módulo `downloadables`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/downloadables.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/downloadables/` |
| Etiqueta en la API | `Descargables` |
| Operaciones HTTP | 28 |
| Controladores | 1 |
| Servicios | 1 |
| DTO | 2 |
| Políticas de dominio | 0 |
| Adaptadores externos | 1 |
| Suites de prueba | 1 |
| Roles que intervienen | `ADMIN`, `SUPER_ADMIN` |
| Permisos que exige | — |

## Por qué existe

Gestiona los recursos descargables de pago y los derechos de acceso que los acompañan. Es la única
integración del sistema en la que un tercero —Hotmart— llama al backend.

## Reglas de dominio

- **La compra la confirma Hotmart, no el backend.** El webhook traduce una notificación de compra o
  reembolso en la concesión o revocación de un `downloadable_entitlement`.
- **El evento externo se persiste antes de procesarse** (`downloadable_external_event`), de modo que
  una notificación puede reprocesarse sin pérdida si el procesamiento falla.
- **Los recursos tienen versiones.** Una descarga apunta a una versión concreta, para que actualizar
  un material no invalide lo que alguien ya compró.
- **Cada descarga se registra** (`downloadable_download_event`), tanto para soporte como para
  detectar el abuso de un derecho compartido.

## Superficie de riesgo

`POST /webhooks/hotmart` es pública y de escritura. Concentra riesgo y su tratamiento está en el
[modelo de amenazas](../security/threat-model.md).

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/downloadables` | [Admin] Listar descargables | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/downloadables` | [Admin] Crear descargable (borrador) | `ADMIN`, `SUPER_ADMIN` | — |
| `DELETE /api/v1/admin/downloadables/{id}` | [Admin] Eliminar (soft delete) | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/downloadables/{id}` | [Admin] Detalle | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/downloadables/{id}` | [Admin] Actualizar (solo borrador) | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/downloadables/{id}/archive` | [Admin] Archivar | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/downloadables/{id}/entitlements` | [Admin] Conceder acceso a un usuario | `ADMIN`, `SUPER_ADMIN` | — |
| `DELETE /api/v1/admin/downloadables/{id}/entitlements/{userId}` | [Admin] Revocar acceso | `ADMIN`, `SUPER_ADMIN` | — |
| `PUT /api/v1/admin/downloadables/{id}/hotmart` | [Admin] Configurar integracion Hotmart | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/downloadables/{id}/versions` | [Admin] Listar versiones | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/downloadables/{id}/versions` | [Admin] Crear nueva version editable | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/downloadables/{id}/versions/{versionId}/approve` | [Admin] Aprobar version | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/downloadables/{id}/versions/{versionId}/publish` | [Admin] Publicar version (inmutable) | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/downloadables/{id}/versions/{versionId}/reject` | [Admin] Rechazar version | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/downloadables/{id}/versions/{versionId}/request-changes` | [Admin] Solicitar cambios | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/downloadables/{id}/versions/{versionId}/restore` | [Admin] Restaurar version (crea nueva) | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/downloadables/{id}/versions/{versionId}/submit-review` | [Admin] Enviar version a revision | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/downloadables/metrics` | [Admin] Metricas de descargables | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/publications/{publicationId}/downloadables` | [Admin] Adjuntar descargable a publicacion | `ADMIN`, `SUPER_ADMIN` | — |
| `DELETE /api/v1/admin/publications/{publicationId}/downloadables/{resourceId}` | [Admin] Quitar descargable de publicacion | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/downloadables` | Listar descargables publicados | Público | — |
| `GET /api/v1/downloadables/{id}/access` | Estado de acceso del usuario a un recurso | Autenticado | — |
| `POST /api/v1/downloadables/{id}/download` | Descargar (autoriza en backend) | Autenticado | — |
| `GET /api/v1/downloadables/{slug}` | Detalle publico (sin URL privada) | Público | — |
| `GET /api/v1/downloadables/me/history` | Historial de descargas del usuario | Autenticado | — |
| `GET /api/v1/downloadables/me/library` | Mi contenido premium (con estado de acceso) | Autenticado | — |
| `GET /api/v1/publications/{publicationId}/downloadables` | Descargables de una publicacion (con estado de acceso) | Público | — |
| `POST /api/v1/webhooks/hotmart` | Webhook de confirmacion de compra Hotmart (idempotente) | Público | — |

## Código

**Controladores**

- [`src/modules/downloadables/downloadables.controller.ts`](../../src/modules/downloadables/downloadables.controller.ts)

**Servicios**

- [`src/modules/downloadables/downloadables.service.ts`](../../src/modules/downloadables/downloadables.service.ts)

**Adaptadores externos**

- [`src/modules/downloadables/hotmart.adapter.ts`](../../src/modules/downloadables/hotmart.adapter.ts)

**DTO**

- [`src/modules/downloadables/dto/downloadable-response.dto.ts`](../../src/modules/downloadables/dto/downloadable-response.dto.ts)
- [`src/modules/downloadables/dto/downloadable.dto.ts`](../../src/modules/downloadables/dto/downloadable.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `ContentSubscriber` — ver [catálogo de entidades](../data/entity-catalog.md)
- `DownloadableDownloadEvent` — ver [catálogo de entidades](../data/entity-catalog.md)
- `DownloadableEntitlement` — ver [catálogo de entidades](../data/entity-catalog.md)
- `DownloadableExternalEvent` — ver [catálogo de entidades](../data/entity-catalog.md)
- `DownloadablePublicationLink` — ver [catálogo de entidades](../data/entity-catalog.md)
- `DownloadableResource` — ver [catálogo de entidades](../data/entity-catalog.md)
- `DownloadableResourceVersion` — ver [catálogo de entidades](../data/entity-catalog.md)
- `DownloadableVisibility` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/downloadables/downloadables.service.spec.ts`](../../src/modules/downloadables/downloadables.service.spec.ts)

