# Módulo `content`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/content.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/content/` |
| Etiqueta en la API | `Contenido` |
| Operaciones HTTP | 36 |
| Controladores | 3 |
| Servicios | 6 |
| DTO | 6 |
| Políticas de dominio | 2 |
| Adaptadores externos | 0 |
| Suites de prueba | 2 |
| Roles que intervienen | `PATIENT` |
| Permisos que exige | `content:read`, `content:write` |

## Por qué existe

Es el módulo más grande del sistema (164 nodos). Sostiene la publicación editorial: noticias,
columnas de opinión, su taxonomía, las personas suscriptoras y el acceso premium.

## Reglas de dominio

- **El estado de una publicación lo gobierna una política explícita**
  (`policies/publication-status.policy.ts`): `DRAFT → IN_REVIEW → SCHEDULED → PUBLISHED → ARCHIVED`.
- **La visibilidad es una dimensión aparte del estado.** Una publicación puede estar `PUBLISHED` y
  ser `PREMIUM`: publicada, pero legible sólo por quien tenga suscripción activa.
- **La suscripción premium se aprueba a mano.** El pago se verifica fuera de banda —QR e
  instrucciones configurables— y una persona administradora la activa. No hay pasarela automática
  para este flujo.
- **Los alias públicos existen por compatibilidad.** `PublicContentAliasController` duplica rutas
  bajo `/public/content` para frontends antiguos; están documentadas como tales y no reciben
  funcionalidad nueva.

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/content/authors` | Listar autores editoriales | Autenticado | `content:read` |
| `POST /api/v1/admin/content/authors` | Registrar un autor editorial | Autenticado | `content:write` |
| `PATCH /api/v1/admin/content/authors/{id}` | Actualizar un autor editorial | Autenticado | `content:write` |
| `GET /api/v1/admin/content/categories` | Listar categorías de contenido | Autenticado | `content:read` |
| `POST /api/v1/admin/content/categories` | Crear una categoría de contenido | Autenticado | `content:write` |
| `PATCH /api/v1/admin/content/categories/{id}` | Actualizar una categoría de contenido | Autenticado | `content:write` |
| `GET /api/v1/admin/content/publications` | Listar publicaciones editoriales | Autenticado | `content:read` |
| `POST /api/v1/admin/content/publications` | Crear una publicación editorial | Autenticado | `content:write` |
| `GET /api/v1/admin/content/publications/{id}` | Consultar el detalle de una publicación | Autenticado | `content:read` |
| `PATCH /api/v1/admin/content/publications/{id}` | Actualizar una publicación editorial | Autenticado | `content:write` |
| `POST /api/v1/admin/content/publications/{id}/archive` | Archivar una publicación | Autenticado | `content:write` |
| `POST /api/v1/admin/content/publications/{id}/publish` | Publicar una publicación | Autenticado | `content:write` |
| `POST /api/v1/admin/content/publications/{id}/schedule` | Programar la publicación para una fecha futura | Autenticado | `content:write` |
| `GET /api/v1/admin/content/subscribers` | Listar personas suscriptoras | Autenticado | `content:read` |
| `POST /api/v1/admin/content/subscribers` | Registrar una persona suscriptora | Autenticado | `content:write` |
| `PATCH /api/v1/admin/content/subscribers/{id}` | Actualizar los datos de una persona suscriptora | Autenticado | `content:write` |
| `POST /api/v1/admin/content/subscribers/{userId}/approve` | Aprobar una solicitud de suscripción premium | Autenticado | `content:write` |
| `POST /api/v1/admin/content/subscribers/{userId}/reject` | Rechazar una solicitud de suscripción premium | Autenticado | `content:write` |
| `PATCH /api/v1/admin/content/subscribers/{userId}/subscription` | Actualizar la suscripción premium de una cuenta | Autenticado | `content:write` |
| `GET /api/v1/admin/content/tags` | Listar etiquetas de contenido | Autenticado | `content:read` |
| `POST /api/v1/admin/content/tags` | Crear una etiqueta de contenido | Autenticado | `content:write` |
| `GET /api/v1/me/news-subscription` | Consultar el estado de mi suscripción premium | `PATIENT` | — |
| `GET /api/v1/me/news-subscription/payment-config` | Obtener las instrucciones de pago de la suscripción premium | `PATIENT` | — |
| `POST /api/v1/me/news-subscription/request` | Solicitar el alta de la suscripción premium | `PATIENT` | — |
| `GET /api/v1/premium/publications/columns/{slug}` | Leer una columna premium por su slug | `PATIENT` | — |
| `GET /api/v1/premium/publications/news/{slug}` | Leer una noticia premium por su slug | `PATIENT` | — |
| `GET /api/v1/public/content/categories` | Listar categorías (alias de compatibilidad del frontend) | Público | — |
| `GET /api/v1/public/content/posts` | Listar publicaciones (alias de compatibilidad del frontend) | Público | — |
| `GET /api/v1/public/content/types` | Listar los tipos de publicación disponibles | Público | — |
| `GET /api/v1/publications/categories` | Listar las categorías con contenido publicado | Público | — |
| `GET /api/v1/publications/columns` | Listar columnas de opinión publicadas | Público | — |
| `GET /api/v1/publications/columns/{slug}` | Leer una columna publicada por su slug | Público | — |
| `GET /api/v1/publications/news` | Listar noticias publicadas | Público | — |
| `GET /api/v1/publications/news/{slug}` | Leer una noticia publicada por su slug | Público | — |
| `POST /api/v1/publications/subscribers` | Suscribirse al boletín editorial | Público | — |
| `GET /api/v1/publications/tags` | Listar las etiquetas con contenido publicado | Público | — |

## Código

**Controladores**

- [`src/modules/content/admin-content.controller.ts`](../../src/modules/content/admin-content.controller.ts)
- [`src/modules/content/premium-content.controller.ts`](../../src/modules/content/premium-content.controller.ts)
- [`src/modules/content/public-content.controller.ts`](../../src/modules/content/public-content.controller.ts)

**Servicios**

- [`src/modules/content/content-authors.service.ts`](../../src/modules/content/content-authors.service.ts)
- [`src/modules/content/content-publication-audit.service.ts`](../../src/modules/content/content-publication-audit.service.ts)
- [`src/modules/content/content-publication-relations.service.ts`](../../src/modules/content/content-publication-relations.service.ts)
- [`src/modules/content/content-publications.service.ts`](../../src/modules/content/content-publications.service.ts)
- [`src/modules/content/content-subscribers.service.ts`](../../src/modules/content/content-subscribers.service.ts)
- [`src/modules/content/content-taxonomy.service.ts`](../../src/modules/content/content-taxonomy.service.ts)

**Políticas de dominio**

- [`src/modules/content/policies/publication-status.policy.spec.ts`](../../src/modules/content/policies/publication-status.policy.spec.ts)
- [`src/modules/content/policies/publication-status.policy.ts`](../../src/modules/content/policies/publication-status.policy.ts)

**DTO**

- [`src/modules/content/dto/author.dto.ts`](../../src/modules/content/dto/author.dto.ts)
- [`src/modules/content/dto/content-query.dto.ts`](../../src/modules/content/dto/content-query.dto.ts)
- [`src/modules/content/dto/content-response.dto.ts`](../../src/modules/content/dto/content-response.dto.ts)
- [`src/modules/content/dto/publication.dto.ts`](../../src/modules/content/dto/publication.dto.ts)
- [`src/modules/content/dto/subscriber.dto.ts`](../../src/modules/content/dto/subscriber.dto.ts)
- [`src/modules/content/dto/taxonomy.dto.ts`](../../src/modules/content/dto/taxonomy.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `ContentAuthor` — ver [catálogo de entidades](../data/entity-catalog.md)
- `ContentCategory` — ver [catálogo de entidades](../data/entity-catalog.md)
- `ContentPublication` — ver [catálogo de entidades](../data/entity-catalog.md)
- `ContentPublicationTag` — ver [catálogo de entidades](../data/entity-catalog.md)
- `ContentSubscriber` — ver [catálogo de entidades](../data/entity-catalog.md)
- `ContentTag` — ver [catálogo de entidades](../data/entity-catalog.md)
- `PatientProfile` — ver [catálogo de entidades](../data/entity-catalog.md)
- `User` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/content/content-publications.service.spec.ts`](../../src/modules/content/content-publications.service.spec.ts)
- [`src/modules/content/policies/publication-status.policy.spec.ts`](../../src/modules/content/policies/publication-status.policy.spec.ts)

