# Cobertura del contrato OpenAPI

Informe generado por `scripts/check-openapi-coverage.mjs`. No se edita a mano: se regenera con `yarn docs:openapi:coverage`.

## Resumen

| Métrica | Valor |
| --- | ---: |
| Rutas registradas por NestJS | 189 |
| Operaciones en el contrato | 189 |
| Rutas sin operación en el contrato | 0 |
| Operaciones sin ruta en NestJS | 0 |
| Operaciones sin ninguna incidencia bloqueante | 189 (100.0 %) |
| Operaciones con incidencias bloqueantes | 0 (0.0 %) |
| Operaciones con `data` tipado | 154 (81.5 %) |
| Operaciones con sobre genérico | 35 (18.5 %) |

## Incidencias por tipo

Ninguna. Todas las operaciones cumplen las reglas de calidad.

## Deuda: operaciones con sobre genérico

Estas operaciones documentan el sobre real (`data` + `meta`), pero `data` todavía no declara un esquema propio. No bloquean la validación: quien consume la API conoce la envoltura y los códigos de error, pero no la forma exacta de la carga útil. Se resuelven añadiendo `@ApiEnvelope(Dto, { … })` al handler.

| Controlador | Operaciones |
| --- | ---: |
| `AdminContentController` | 6 |
| `UsersController` | 5 |
| `PremiumContentController` | 3 |
| `AdminDownloadablesController` | 3 |
| `BookingController` | 2 |
| `FilesController` | 2 |
| `AdminPublicPagesController` | 2 |
| `PublicAdvertisingController` | 2 |
| `DownloadablesController` | 2 |
| `PublicationDownloadablesController` | 2 |
| `NotificationsController` | 1 |
| `AdminFilesController` | 1 |
| `PublicContentController` | 1 |
| `PublicAdvertisingAliasController` | 1 |
| `LegacyCompatibilityController` | 1 |
| `DownloadablesWebhookController` | 1 |
