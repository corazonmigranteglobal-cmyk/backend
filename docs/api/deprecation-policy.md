# Política de deprecación

## Principio

Una ruta publicada es un compromiso. Se retira cuando ya nadie la usa, no cuando deja de gustarnos.

## Qué existe hoy por compatibilidad

| Superficie | Motivo | Sustituto |
| --- | --- | --- |
| `PublicContentAliasController` (`/public/content/*`) | Frontends antiguos | `/publications/*` |
| `PublicAdvertisingAliasController` (`/public/advertising`) | ídem | `/advertising/slots` |
| Módulo `legacy-compatibility` (`/legacy/status`) | Comprobación de disponibilidad de clientes antiguos | `/health` |
| Prefijo `/admin/mensajeria` | El panel administrativo lo usa | `/admin/messaging` |
| Alias de paginación (`p_page`, `p_limit`, `pageSize`) | Frontends antiguos | `page`, `limit` |

Ninguna de estas superficies recibe funcionalidad nueva.

## Procedimiento para retirar algo

1. **Marcar en el contrato.** `@ApiOperation({ deprecated: true })` y explicar en la descripción
   cuál es el sustituto. Aparece tachado en la referencia interactiva.
2. **Anunciar** con la fecha de retirada.
3. **Observar el uso real** en los logs (`HTTP_REQUEST_RECEIVED` lleva la URL) antes de retirar.
4. **Retirar** sólo cuando el uso sea cero durante un periodo completo de facturación.

## Cambio incompatible

Se considera incompatible: eliminar una operación o un campo de respuesta, hacer obligatorio un
parámetro que no lo era, estrechar un enum, o cambiar el significado de un `error.code`.

Un cambio así exige una versión nueva del prefijo (`api/v2`), no una modificación de `api/v1`.

## Detección automática

El contrato está versionado en `openapi/openapi.yaml`, así que **cualquier cambio incompatible
aparece en el diff de la pull request**. Es la primera línea de defensa: revisar ese diff es
obligatorio cuando cambian rutas, DTO o permisos.
