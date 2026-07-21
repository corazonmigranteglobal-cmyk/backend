# Arquitectura del módulo de descargables

## Alcance implementado en esta fase
Fundación funcional y verificada del módulo de contenido descargable, conectada
de extremo a extremo para los casos núcleo (público, premium, privado, compra),
con control de acceso evaluado en backend, auditoría de descargas y adaptador
Hotmart desacoplado.

## Componentes
- **Modelos** (`src/database/models/`):
  - `DownloadableResource` — recurso administrable con visibilidad, estado
    editorial, versión, integración Hotmart y metadatos de archivo.
  - `DownloadableDownloadEvent` — auditoría de cada intento/descarga (sin tokens
    ni URLs firmadas completas).
- **Migración** `20260721000001-downloadable-resources.js` — idempotente
  (`CREATE TABLE IF NOT EXISTS`), con FKs, UNIQUE, CHECK e índices.
- **Servicio** `DownloadablesService` — CRUD admin, `evaluateAccess`,
  `resolveDownload`, historial y métricas.
- **Adaptador** `HotmartAdapter` — contrato de verificación/idempotencia de
  notificaciones; en modo "unconfigured" no confirma compras reales.
- **Controllers** — `AdminDownloadablesController` (`/admin/downloadables`) y
  `DownloadablesController` (`/downloadables`, `/downloadables/:id/download`, …).

## Tablas conceptuales del spec y su estado
| Entidad del spec               | Estado en esta fase |
| ------------------------------ | ------------------- |
| downloadable_resources         | IMPLEMENTADA        |
| downloadable_download_events   | IMPLEMENTADA        |
| downloadable_resource_versions | Campo `version` incremental en el recurso; tabla dedicada de revisiones: PENDIENTE |
| downloadable_files / _resource_files | `file_url`/`cover_url` + object keys en el recurso; multi-archivo dedicado: PENDIENTE |
| downloadable_access_rules      | Reglas por `visibility` en servicio; tabla de reglas privadas por rol/equipo: PENDIENTE |
| downloadable_entitlements      | Premium vía `ContentSubscriber`; tabla de entitlements por compra: PENDIENTE |
| downloadable_external_products | Campos Hotmart en el recurso; catálogo dedicado: PENDIENTE |
| downloadable_publication_links | PENDIENTE (relación publicación↔descargable) |
| downloadable_audit_events      | Cubierto por `downloadable_download_events` + auditoría existente |

## Migración de datos heredados
Si existen URLs de descarga embebidas en publicaciones, deben migrarse a
`downloadable_resources` (una fila por archivo) y vincularse mediante la tabla
de enlace publicación↔descargable (pendiente). No se elimina información previa.
