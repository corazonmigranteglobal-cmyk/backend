# Catálogo de entidades

!!! info "Página generada"
    La genera `scripts/generate-entity-catalog.mjs` leyendo los modelos de `src/database/models/` y las migraciones. Se regenera con `yarn docs:entities`. No la edites a mano.

El esquema tiene **57 entidades persistentes**. El esquema no se sincroniza automáticamente (`synchronize: false`): la única forma de cambiarlo es una migración.

## Resumen

| Entidad | Tabla | Asociaciones | Borrado lógico | Creada en |
| --- | --- | ---: | :---: | --- |
| [`AccountGroup`](#accountgroup) | `account_groups` | 1 | sí | — |
| [`Account`](#account) | `accounts` | 1 | sí | — |
| [`AccountingEntry`](#accountingentry) | `accounting_entries` | 1 | no | — |
| [`AccountingTransaction`](#accountingtransaction) | `accounting_transactions` | 1 | sí | — |
| [`AdminNotification`](#adminnotification) | `admin_notifications` | 0 | no | — |
| [`AdminProfile`](#adminprofile) | `admin_profiles` | 1 | sí | — |
| [`AdsCampaignContentTarget`](#adscampaigncontenttarget) | `ads_campaign_content_targets` | 0 | no | — |
| [`AdsCampaignCreative`](#adscampaigncreative) | `ads_campaign_creatives` | 1 | sí | — |
| [`AdsCampaignPlacement`](#adscampaignplacement) | `ads_campaign_placements` | 0 | no | — |
| [`AdsCampaign`](#adscampaign) | `ads_campaigns` | 4 | sí | — |
| [`AdsCompany`](#adscompany) | `ads_companies` | 1 | sí | — |
| [`AdsImpression`](#adsimpression) | `ads_impressions` | 0 | no | — |
| [`AdsPlacement`](#adsplacement) | `ads_placements` | 1 | sí | — |
| [`AppointmentDetail`](#appointmentdetail) | `appointment_details` | 0 | sí | — |
| [`AppointmentStatusHistory`](#appointmentstatushistory) | `appointment_status_history` | 1 | no | — |
| [`Appointment`](#appointment) | `appointments` | 4 | sí | — |
| [`AuditLog`](#auditlog) | `audit_logs` | 0 | no | — |
| [`AuthPin`](#authpin) | `auth_pins` | 0 | no | — |
| [`CmsElement`](#cmselement) | `cms_elements` | 1 | sí | — |
| [`CmsPage`](#cmspage) | `cms_pages` | 1 | sí | — |
| [`ContentAuthor`](#contentauthor) | `content_authors` | 1 | sí | — |
| [`ContentCategory`](#contentcategory) | `content_categories` | 1 | sí | — |
| [`ContentPublicationTag`](#contentpublicationtag) | `content_publication_tags` | 0 | no | — |
| [`ContentPublication`](#contentpublication) | `content_publications` | 4 | sí | — |
| [`ContentSubscriber`](#contentsubscriber) | `content_subscribers` | 1 | sí | — |
| [`ContentTag`](#contenttag) | `content_tags` | 1 | sí | — |
| [`CostCenter`](#costcenter) | `cost_centers` | 0 | sí | — |
| [`DownloadableDownloadEvent`](#downloadabledownloadevent) | `downloadable_download_events` | 0 | no | — |
| [`DownloadableEntitlement`](#downloadableentitlement) | `downloadable_entitlements` | 0 | no | — |
| [`DownloadableExternalEvent`](#downloadableexternalevent) | `downloadable_external_events` | 0 | no | — |
| [`DownloadablePublicationLink`](#downloadablepublicationlink) | `downloadable_publication_links` | 0 | no | — |
| [`DownloadableResourceVersion`](#downloadableresourceversion) | `downloadable_resource_versions` | 0 | no | — |
| [`DownloadableResource`](#downloadableresource) | `downloadable_resources` | 0 | sí | — |
| [`FileAccessLog`](#fileaccesslog) | `file_access_logs` | 0 | no | — |
| [`FileAsset`](#fileasset) | `files` | 0 | sí | — |
| [`HomepageFeaturedItem`](#homepagefeatureditem) | `homepage_featured_items` | 1 | sí | — |
| [`HomepageSection`](#homepagesection) | `homepage_sections` | 1 | sí | — |
| [`MessageOutbox`](#messageoutbox) | `mensaje_outbox` | 0 | no | — |
| [`MessageSendLog`](#messagesendlog) | `mensaje_envio_log` | 0 | no | — |
| [`PatientProfile`](#patientprofile) | `patient_profiles` | 1 | sí | — |
| [`Payment`](#payment) | `payments` | 0 | sí | — |
| [`Permission`](#permission) | `permissions` | 1 | sí | — |
| [`PublicVisit`](#publicvisit) | `public_visits` | 0 | no | — |
| [`RefreshToken`](#refreshtoken) | `refresh_tokens` | 1 | no | — |
| [`RolePermission`](#rolepermission) | `role_permissions` | 0 | no | — |
| [`Role`](#role) | `roles` | 2 | sí | — |
| [`Sale`](#sale) | `sales` | 0 | sí | — |
| [`TherapistApproach`](#therapistapproach) | `therapist_approaches` | 0 | no | — |
| [`TherapistBlockedTime`](#therapistblockedtime) | `therapist_blocked_times` | 0 | sí | — |
| [`TherapistProduct`](#therapistproduct) | `therapist_products` | 0 | sí | — |
| [`TherapistProfile`](#therapistprofile) | `therapist_profiles` | 1 | sí | — |
| [`TherapistSchedule`](#therapistschedule) | `therapist_schedules` | 0 | sí | — |
| [`TherapyApproach`](#therapyapproach) | `therapy_approaches` | 1 | sí | — |
| [`TherapyProduct`](#therapyproduct) | `therapy_products` | 1 | sí | — |
| [`UiEvent`](#uievent) | `ui_events` | 0 | no | — |
| [`UserRole`](#userrole) | `user_roles` | 0 | no | — |
| [`User`](#user) | `users` | 6 | sí | — |

## Detalle por entidad

### AccountGroup

**Tabla:** `account_groups` · **Modelo:** [`src/database/models/account-group.model.ts`](../../src/database/models/account-group.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Asociaciones**

- `HasMany` → `Account`

### Account

**Tabla:** `accounts` · **Modelo:** [`src/database/models/account.model.ts`](../../src/database/models/account.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `groupId` → `AccountGroup`

**Asociaciones**

- `BelongsTo` → `AccountGroup`

### AccountingEntry

**Tabla:** `accounting_entries` · **Modelo:** [`src/database/models/accounting-entry.model.ts`](../../src/database/models/accounting-entry.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `transactionId` → `AccountingTransaction`
- `accountId` → `Account`
- `costCenterId` → `CostCenter`

**Asociaciones**

- `BelongsTo` → `AccountingTransaction`

### AccountingTransaction

**Tabla:** `accounting_transactions` · **Modelo:** [`src/database/models/accounting-transaction.model.ts`](../../src/database/models/accounting-transaction.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `createdByUserId` → `User`

**Asociaciones**

- `HasMany` → `AccountingEntry`

### AdminNotification

**Tabla:** `admin_notifications` · **Modelo:** [`src/database/models/admin-notification.model.ts`](../../src/database/models/admin-notification.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

### AdminProfile

**Tabla:** `admin_profiles` · **Modelo:** [`src/database/models/admin-profile.model.ts`](../../src/database/models/admin-profile.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `userId` → `User`

**Asociaciones**

- `BelongsTo` → `User`

### AdsCampaignContentTarget

**Tabla:** `ads_campaign_content_targets` · **Modelo:** [`src/database/models/ads-campaign-content-target.model.ts`](../../src/database/models/ads-campaign-content-target.model.ts)

Marcas de tiempo: sí · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `campaignId` → `AdsCampaign`
- `publicationId` → `ContentPublication`
- `categoryId` → `ContentCategory`

### AdsCampaignCreative

**Tabla:** `ads_campaign_creatives` · **Modelo:** [`src/database/models/ads-campaign-creative.model.ts`](../../src/database/models/ads-campaign-creative.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `campaignId` → `AdsCampaign`
- `fileId` → `FileAsset`

**Asociaciones**

- `BelongsTo` → `AdsCampaign`

### AdsCampaignPlacement

**Tabla:** `ads_campaign_placements` · **Modelo:** [`src/database/models/ads-campaign-placement.model.ts`](../../src/database/models/ads-campaign-placement.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `campaignId` → `AdsCampaign`
- `placementId` → `AdsPlacement`

### AdsCampaign

**Tabla:** `ads_campaigns` · **Modelo:** [`src/database/models/ads-campaign.model.ts`](../../src/database/models/ads-campaign.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `companyId` → `AdsCompany`
- `createdByUserId` → `User`

**Asociaciones**

- `BelongsTo` → `AdsCompany`
- `HasMany` → `AdsCampaignCreative`
- `HasMany` → `AdsCampaignContentTarget`
- `BelongsToMany` → `AdsPlacement`

### AdsCompany

**Tabla:** `ads_companies` · **Modelo:** [`src/database/models/ads-company.model.ts`](../../src/database/models/ads-company.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Asociaciones**

- `HasMany` → `AdsCampaign`

### AdsImpression

**Tabla:** `ads_impressions` · **Modelo:** [`src/database/models/ads-impression.model.ts`](../../src/database/models/ads-impression.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `creativeId` → `AdsCampaignCreative`
- `publicationId` → `ContentPublication`
- `userId` → `User`

### AdsPlacement

**Tabla:** `ads_placements` · **Modelo:** [`src/database/models/ads-placement.model.ts`](../../src/database/models/ads-placement.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Asociaciones**

- `BelongsToMany` → `AdsCampaign`

### AppointmentDetail

**Tabla:** `appointment_details` · **Modelo:** [`src/database/models/appointment-detail.model.ts`](../../src/database/models/appointment-detail.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `appointmentId` → `Appointment`

### AppointmentStatusHistory

**Tabla:** `appointment_status_history` · **Modelo:** [`src/database/models/appointment-status-history.model.ts`](../../src/database/models/appointment-status-history.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `appointmentId` → `Appointment`
- `changedByUserId` → `User`

**Asociaciones**

- `BelongsTo` → `Appointment`

### Appointment

**Tabla:** `appointments` · **Modelo:** [`src/database/models/appointment.model.ts`](../../src/database/models/appointment.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `patientUserId` → `User`
- `therapistUserId` → `User`
- `productId` → `TherapyProduct`

**Asociaciones**

- `BelongsTo` → `User`
- `BelongsTo` → `User`
- `BelongsTo` → `TherapyProduct`
- `HasMany` → `AppointmentStatusHistory`

### AuditLog

**Tabla:** `audit_logs` · **Modelo:** [`src/database/models/audit-log.model.ts`](../../src/database/models/audit-log.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `actorUserId` → `User`

### AuthPin

**Tabla:** `auth_pins` · **Modelo:** [`src/database/models/auth-pin.model.ts`](../../src/database/models/auth-pin.model.ts)

Marcas de tiempo: sí · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

### CmsElement

**Tabla:** `cms_elements` · **Modelo:** [`src/database/models/cms-element.model.ts`](../../src/database/models/cms-element.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `pageId` → `CmsPage`
- `fileId` → `FileAsset`

**Asociaciones**

- `BelongsTo` → `CmsPage`

### CmsPage

**Tabla:** `cms_pages` · **Modelo:** [`src/database/models/cms-page.model.ts`](../../src/database/models/cms-page.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Asociaciones**

- `HasMany` → `CmsElement`

### ContentAuthor

**Tabla:** `content_authors` · **Modelo:** [`src/database/models/content-author.model.ts`](../../src/database/models/content-author.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `userId` → `User`
- `avatarFileId` → `FileAsset`

**Asociaciones**

- `HasMany` → `ContentPublication`

### ContentCategory

**Tabla:** `content_categories` · **Modelo:** [`src/database/models/content-category.model.ts`](../../src/database/models/content-category.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Asociaciones**

- `HasMany` → `ContentPublication`

### ContentPublicationTag

**Tabla:** `content_publication_tags` · **Modelo:** [`src/database/models/content-publication-tag.model.ts`](../../src/database/models/content-publication-tag.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `publicationId` → `ContentPublication`
- `tagId` → `ContentTag`

### ContentPublication

**Tabla:** `content_publications` · **Modelo:** [`src/database/models/content-publication.model.ts`](../../src/database/models/content-publication.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `authorId` → `ContentAuthor`
- `categoryId` → `ContentCategory`
- `coverFileId` → `FileAsset`

**Asociaciones**

- `BelongsTo` → `ContentAuthor`
- `BelongsTo` → `ContentCategory`
- `BelongsTo` → `FileAsset`
- `BelongsToMany` → `ContentTag`

### ContentSubscriber

**Tabla:** `content_subscribers` · **Modelo:** [`src/database/models/content-subscriber.model.ts`](../../src/database/models/content-subscriber.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `userId` → `User`

**Asociaciones**

- `BelongsTo` → `User`

### ContentTag

**Tabla:** `content_tags` · **Modelo:** [`src/database/models/content-tag.model.ts`](../../src/database/models/content-tag.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Asociaciones**

- `BelongsToMany` → `ContentPublication`

### CostCenter

**Tabla:** `cost_centers` · **Modelo:** [`src/database/models/cost-center.model.ts`](../../src/database/models/cost-center.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

### DownloadableDownloadEvent

**Tabla:** `downloadable_download_events` · **Modelo:** [`src/database/models/downloadable-download-event.model.ts`](../../src/database/models/downloadable-download-event.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

### DownloadableEntitlement

**Tabla:** `downloadable_entitlements` · **Modelo:** [`src/database/models/downloadable-entitlement.model.ts`](../../src/database/models/downloadable-entitlement.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

### DownloadableExternalEvent

**Tabla:** `downloadable_external_events` · **Modelo:** [`src/database/models/downloadable-external-event.model.ts`](../../src/database/models/downloadable-external-event.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

### DownloadablePublicationLink

**Tabla:** `downloadable_publication_links` · **Modelo:** [`src/database/models/downloadable-publication-link.model.ts`](../../src/database/models/downloadable-publication-link.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

### DownloadableResourceVersion

**Tabla:** `downloadable_resource_versions` · **Modelo:** [`src/database/models/downloadable-resource-version.model.ts`](../../src/database/models/downloadable-resource-version.model.ts)

Marcas de tiempo: sí · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

### DownloadableResource

**Tabla:** `downloadable_resources` · **Modelo:** [`src/database/models/downloadable-resource.model.ts`](../../src/database/models/downloadable-resource.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

### FileAccessLog

**Tabla:** `file_access_logs` · **Modelo:** [`src/database/models/file-access-log.model.ts`](../../src/database/models/file-access-log.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `fileId` → `FileAsset`
- `actorUserId` → `User`

### FileAsset

**Tabla:** `files` · **Modelo:** [`src/database/models/file-asset.model.ts`](../../src/database/models/file-asset.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `ownerUserId` → `User`

### HomepageFeaturedItem

**Tabla:** `homepage_featured_items` · **Modelo:** [`src/database/models/homepage-featured-item.model.ts`](../../src/database/models/homepage-featured-item.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `sectionId` → `HomepageSection`

**Asociaciones**

- `BelongsTo` → `HomepageSection`

### HomepageSection

**Tabla:** `homepage_sections` · **Modelo:** [`src/database/models/homepage-section.model.ts`](../../src/database/models/homepage-section.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Asociaciones**

- `HasMany` → `HomepageFeaturedItem`

### MessageOutbox

**Tabla:** `mensaje_outbox` · **Modelo:** [`src/database/models/message-outbox.model.ts`](../../src/database/models/message-outbox.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

### MessageSendLog

**Tabla:** `mensaje_envio_log` · **Modelo:** [`src/database/models/message-send-log.model.ts`](../../src/database/models/message-send-log.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `outboxId` → `MessageOutbox`

### PatientProfile

**Tabla:** `patient_profiles` · **Modelo:** [`src/database/models/patient-profile.model.ts`](../../src/database/models/patient-profile.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `userId` → `User`

**Asociaciones**

- `BelongsTo` → `User`

### Payment

**Tabla:** `payments` · **Modelo:** [`src/database/models/payment.model.ts`](../../src/database/models/payment.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `saleId` → `Sale`

### Permission

**Tabla:** `permissions` · **Modelo:** [`src/database/models/permission.model.ts`](../../src/database/models/permission.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Asociaciones**

- `BelongsToMany` → `Role`

### PublicVisit

**Tabla:** `public_visits` · **Modelo:** [`src/database/models/public-visit.model.ts`](../../src/database/models/public-visit.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

### RefreshToken

**Tabla:** `refresh_tokens` · **Modelo:** [`src/database/models/refresh-token.model.ts`](../../src/database/models/refresh-token.model.ts)

Marcas de tiempo: sí · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `userId` → `User`

**Asociaciones**

- `BelongsTo` → `User`

### RolePermission

**Tabla:** `role_permissions` · **Modelo:** [`src/database/models/role-permission.model.ts`](../../src/database/models/role-permission.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `roleId` → `Role`
- `permissionId` → `Permission`

### Role

**Tabla:** `roles` · **Modelo:** [`src/database/models/role.model.ts`](../../src/database/models/role.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Asociaciones**

- `BelongsToMany` → `Permission`
- `BelongsToMany` → `User`

### Sale

**Tabla:** `sales` · **Modelo:** [`src/database/models/sale.model.ts`](../../src/database/models/sale.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `appointmentId` → `Appointment`
- `productId` → `TherapyProduct`
- `patientUserId` → `User`

### TherapistApproach

**Tabla:** `therapist_approaches` · **Modelo:** [`src/database/models/therapist-approach.model.ts`](../../src/database/models/therapist-approach.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `therapistUserId` → `User`
- `approachId` → `TherapyApproach`

### TherapistBlockedTime

**Tabla:** `therapist_blocked_times` · **Modelo:** [`src/database/models/therapist-blocked-time.model.ts`](../../src/database/models/therapist-blocked-time.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `therapistUserId` → `User`

### TherapistProduct

**Tabla:** `therapist_products` · **Modelo:** [`src/database/models/therapist-product.model.ts`](../../src/database/models/therapist-product.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `therapistUserId` → `User`
- `productId` → `TherapyProduct`

### TherapistProfile

**Tabla:** `therapist_profiles` · **Modelo:** [`src/database/models/therapist-profile.model.ts`](../../src/database/models/therapist-profile.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `userId` → `User`

**Asociaciones**

- `BelongsTo` → `User`

### TherapistSchedule

**Tabla:** `therapist_schedules` · **Modelo:** [`src/database/models/therapist-schedule.model.ts`](../../src/database/models/therapist-schedule.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `therapistUserId` → `User`

### TherapyApproach

**Tabla:** `therapy_approaches` · **Modelo:** [`src/database/models/therapy-approach.model.ts`](../../src/database/models/therapy-approach.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Asociaciones**

- `HasMany` → `TherapyProduct`

### TherapyProduct

**Tabla:** `therapy_products` · **Modelo:** [`src/database/models/therapy-product.model.ts`](../../src/database/models/therapy-product.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `approachId` → `TherapyApproach`

**Asociaciones**

- `BelongsTo` → `TherapyApproach`

### UiEvent

**Tabla:** `ui_events` · **Modelo:** [`src/database/models/ui-event.model.ts`](../../src/database/models/ui-event.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

### UserRole

**Tabla:** `user_roles` · **Modelo:** [`src/database/models/user-role.model.ts`](../../src/database/models/user-role.model.ts)

Marcas de tiempo: no · Borrado lógico: no · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Claves foráneas declaradas en el modelo**

- `userId` → `User`
- `roleId` → `Role`

### User

**Tabla:** `users` · **Modelo:** [`src/database/models/user.model.ts`](../../src/database/models/user.model.ts)

Marcas de tiempo: sí · Borrado lógico: sí (`paranoid`) · Índices declarados en el modelo: 0

Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por migración.

**Asociaciones**

- `BelongsToMany` → `Role`
- `HasOne` → `PatientProfile`
- `HasOne` → `TherapistProfile`
- `HasOne` → `AdminProfile`
- `HasMany` → `RefreshToken`
- `HasOne` → `ContentSubscriber`

