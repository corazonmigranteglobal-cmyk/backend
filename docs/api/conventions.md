# Convenciones de la API

## Prefijo y versión

Todas las rutas cuelgan de `api/v1`, salvo `/health`, que vive en la raíz porque quien la consulta
—orquestadores y balanceadores— no conoce el prefijo versionado y a menudo no puede configurarlo.

La exclusión es una constante compartida entre `main.ts` y la generación del contrato
([`http-routes.ts`](../../src/config/http-routes.ts)): duplicarla haría que el contrato publicase
`/api/v1/health`, una ruta que no existe.

## Sobre de respuesta

`ResponseInterceptor` envuelve **todo** lo que devuelve un handler:

```json
{ "data": { "…": "…" }, "meta": { "requestId": "…", "timestamp": "…" } }
```

Los listados paginados añaden `pagination`:

```json
{ "data": [], "pagination": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 }, "meta": {} }
```

Por eso el contrato documenta el sobre y no el DTO desnudo: describir el DTO sería describir un
cuerpo que la API nunca envía.

## Paginación

| Parámetro | Alias aceptados | Por defecto |
| --- | --- | --- |
| `page` | `p_page` | 1 |
| `limit` | `pageSize`, `p_limit` | 20 |
| `sort` | — | Según el endpoint |
| `order` | — | `DESC` |

Los alias existen por compatibilidad con frontends antiguos y están **declarados en el DTO** a
propósito: con `forbidNonWhitelisted` activo, un parámetro no declarado devuelve 400. Aceptar los
alias es una decisión explícita, no un descuido. Ver
[política de deprecación](deprecation-policy.md).

Cuando llegan un nombre y su alias, gana el nombre canónico.

## Filtrado y ordenación

- `search` (alias `q`) hace búsqueda parcial insensible a mayúsculas sobre los campos que cada
  endpoint considera buscables.
- `sort` acepta nombres en camelCase y snake_case. **Un valor no permitido no produce error: se
  sustituye por el orden seguro del endpoint.** Es deliberado — permitir ordenar por un campo
  arbitrario abre la puerta a consultas sin índice.

## Nombres de recurso

- Sustantivos en plural: `/appointments`, `/publications`, `/files`.
- Jerarquía por anidamiento: `/publications/{id}/downloadables`.
- Acciones que no son CRUD, como verbo bajo el recurso: `/publications/{id}/publish`,
  `/campaigns/{id}/status`.
- Superficie administrativa bajo `/admin/…`.

### Rutas ambiguas conocidas

Conviven un segmento literal y uno paramétrico en la misma posición:

| Par | Resolución |
| --- | --- |
| `/appointments/admin/{id}` frente a `/appointments/{id}/status` | Express resuelve por orden de registro |
| `/publications/{publicationId}/downloadables` frente a sus alias | ídem |

Funciona, pero es frágil: un reordenamiento de decoradores podría cambiar qué handler atiende.
Redocly lo señala como aviso y está aceptado a sabiendas. **No añadas rutas nuevas con esta forma.**

## Métodos

| Método | Uso | Idempotente |
| --- | --- | :---: |
| `GET` | Lectura | Sí |
| `POST` | Creación y acciones de dominio | No |
| `PATCH` | Modificación parcial | Sí |
| `DELETE` | Baja (lógica en la mayoría de entidades) | Sí |

No se usa `PUT`: no hay ningún recurso cuyo reemplazo completo tenga sentido de negocio.

### Códigos de éxito

`POST` devuelve **201**, incluidas las acciones que no crean nada (`/publish`, `/process`). Es el
comportamiento por defecto de NestJS y se ha conservado por coherencia, aunque para una acción sin
creación un 200 sería más preciso.

## Idempotencia

**No hay soporte general de claves de idempotencia.** La cabecera `Idempotency-Key` está permitida
en CORS pero ninguna operación la interpreta todavía.

Lo que sí es idempotente hoy:

| Operación | Mecanismo |
| --- | --- |
| Webhook de Hotmart | `findOrCreate` sobre `(provider, eventId)` |
| Migraciones y *seeds* de arranque | Se registran y no se repiten |
| `PATCH` de cualquier entidad | Por naturaleza del método |

Reenviar un `POST /appointments` **crea una cita nueva**. El cliente debe evitar el reenvío.

## Fechas y zonas horarias

- Todo instante viaja en ISO 8601 UTC (`2026-08-03T19:45:12.345Z`).
- Las citas persisten además la `timezone` en la que se acordaron: el centro atiende a personas en
  husos distintos y una hora sin huso es ambigua.
- Los horarios recurrentes usan hora local (`09:00:00`) más su `timezone`.

## Números decimales

Sequelize serializa `DECIMAL` como **cadena** para no perder precisión: `"150.00"`, no `150`.
Afecta a precios de citas y productos y a los importes contables. Conviértelo explícitamente en el
cliente; no lo trates como número sin hacerlo.

## Límite de peticiones

120 por minuto y por IP. Las operaciones sensibles declaran límites propios más estrictos, y cada
una lo indica en su descripción dentro del contrato.

## Errores

Ver [modelo de error](error-model.md).
