# Arquitectura del módulo de descargables

Módulo de contenido descargable conectado de extremo a extremo: control de
acceso en backend, versionado con flujo de revisión, derechos de acceso
(entitlements), vínculo con publicaciones, integración Hotmart desacoplada,
eventos de dominio y auditoría de descargas.

## Componentes
- **Modelos** (`src/database/models/`):
  - `DownloadableResource` — recurso administrable (visibilidad, estado, versión, Hotmart, metadatos de archivo).
  - `DownloadableResourceVersion` — revisiones; la publicada es inmutable.
  - `DownloadableEntitlement` — derechos por usuario (admin/premium/compra/rol/…).
  - `DownloadablePublicationLink` — relación publicación ↔ descargable.
  - `DownloadableDownloadEvent` — auditoría de descargas (sin tokens/URLs firmadas).
  - `DownloadableExternalEvent` — eventos externos (Hotmart) para idempotencia.
- **Migraciones idempotentes**: `20260721000001-downloadable-resources.js`,
  `20260721000002-downloadable-relations.js` (FKs, UNIQUE, CHECK, índices).
- **Servicio** `DownloadablesService` — CRUD, `evaluateAccess`, `resolveDownload`,
  versionado (`createVersion`, `submitReview`, `approve`, `reject`,
  `requestChanges`, `publishVersion`, `restoreVersion`), entitlements
  (`grant/revoke`), publicaciones (`attach/detach/reorder/listForPublication`),
  webhook Hotmart idempotente, historial y métricas.
- **Adaptador** `HotmartAdapter` — verificación/idempotencia; sin credenciales queda `unconfigured`.
- **Controllers** — admin (`/admin/downloadables`), usuario (`/downloadables`),
  publicaciones (`/admin/publications/:id/downloadables`, `/publications/:id/downloadables`),
  webhook (`/webhooks/hotmart`).
- **Eventos** vía `NotificationsService` (Created, Published, DownloadAuthorized/Denied,
  PremiumAccessGranted/Revoked, HotmartPurchaseConfirmed/Revoked, etc.).

## Estado de las tablas del spec
| Entidad del spec               | Estado       |
| ------------------------------ | ------------ |
| downloadable_resources         | IMPLEMENTADA |
| downloadable_resource_versions | IMPLEMENTADA |
| downloadable_entitlements      | IMPLEMENTADA |
| downloadable_publication_links | IMPLEMENTADA |
| downloadable_download_events   | IMPLEMENTADA |
| downloadable_external_events   | IMPLEMENTADA |
| downloadable_files / _resource_files | Cubierto por file_url/object_key en recurso y versión; multi-archivo dedicado: extensible |
| downloadable_access_rules      | Reglas por visibility + entitlements; tabla de reglas por rol/equipo: extensible |
| downloadable_external_products | Campos Hotmart en el recurso + external_events; catálogo dedicado: extensible |
| downloadable_audit_events      | Cubierto por download_events + auditoría existente |

## Frontend
- Admin: `/admin/descargables` (`DownloadablesAdmin`): métricas, listado, crear,
  flujo de versiones (crear→revisión→aprobar→publicar), configurar Hotmart, archivar.
- Usuario premium: `/paciente/descargables` (`MyDownloadablesLibrary`) y embebido
  en `/paciente/premium`: tarjetas con estado de acceso (Disponible, Solo premium,
  Compra requerida, etc.) y acción autorizada por el backend.
