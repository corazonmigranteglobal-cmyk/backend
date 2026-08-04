# Módulo `cms`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/cms.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/cms/` |
| Etiqueta en la API | `CMS` |
| Operaciones HTTP | 15 |
| Controladores | 1 |
| Servicios | 1 |
| DTO | 1 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 1 |
| Roles que intervienen | `ADMIN`, `SUPER_ADMIN` |
| Permisos que exige | — |

## Por qué existe

Permite editar las páginas estáticas del sitio público —quiénes somos, servicios, contacto— sin
desplegar código.

## Reglas de dominio

- **Una página es un contenedor de elementos ordenados**, no un bloque de HTML. Así el frontend
  decide cómo renderizar cada tipo de elemento.
- **Sólo se sirven públicamente las páginas publicadas.** El listado administrativo ve todas.
- **`AdminPublicPagesController` es un dominio distinto de `AdminCmsController`**: el primero
  gestiona páginas con entradas asociadas; el segundo, páginas con elementos. Comparten etiqueta en
  la API por cercanía funcional, no por compartir modelo.

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/cms/pages` | Listar todas las páginas del CMS | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/cms/pages` | Crear una página del CMS | `ADMIN`, `SUPER_ADMIN` | — |
| `DELETE /api/v1/admin/cms/pages/{pageId}` | Eliminar una página del CMS | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/cms/pages/{pageId}` | Consultar una página del CMS con sus elementos | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/cms/pages/{pageId}` | Actualizar una página del CMS | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/cms/pages/{pageId}/elements` | Añadir un elemento a una página del CMS | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/public-pages` | Listar las páginas públicas administrables | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/public-pages` | Crear una página pública | `ADMIN`, `SUPER_ADMIN` | — |
| `DELETE /api/v1/admin/public-pages/{pageId}` | Eliminar una página pública | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/public-pages/{pageId}` | Consultar una página pública y sus entradas | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/public-pages/{pageId}` | Actualizar una página pública | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/public-pages/{pageId}/posts` | Añadir una entrada a una página pública | `ADMIN`, `SUPER_ADMIN` | — |
| `DELETE /api/v1/admin/public-pages/{pageId}/posts/{postId}` | Eliminar una entrada de una página pública | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/public/pages` | Listar las páginas publicadas del sitio | Público | — |
| `GET /api/v1/public/pages/{slug}` | Obtener una página publicada por su slug | Público | — |

## Código

**Controladores**

- [`src/modules/cms/cms.controller.ts`](../../src/modules/cms/cms.controller.ts)

**Servicios**

- [`src/modules/cms/cms.service.ts`](../../src/modules/cms/cms.service.ts)

**DTO**

- [`src/modules/cms/dto/cms.dto.ts`](../../src/modules/cms/dto/cms.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `CmsElement` — ver [catálogo de entidades](../data/entity-catalog.md)
- `CmsPage` — ver [catálogo de entidades](../data/entity-catalog.md)
- `ContentPublication` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/cms/cms.service.spec.ts`](../../src/modules/cms/cms.service.spec.ts)

