# Módulo `homepage`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/homepage.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/homepage/` |
| Etiqueta en la API | `Portada` |
| Operaciones HTTP | 3 |
| Controladores | 1 |
| Servicios | 1 |
| DTO | 1 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 0 |
| Roles que intervienen | — |
| Permisos que exige | `homepage:read`, `homepage:write` |

## Por qué existe

Compone la portada del sitio público a partir de contenido que pertenece a otros módulos. No tiene
dominio propio de peso: su valor es decidir qué se destaca y en qué orden.

## Reglas de dominio

- **Es un módulo de composición.** Lee de `content` y de `advertising`; no crea publicaciones ni
  campañas.
- **La previsualización muestra cambios sin publicar**, para poder revisar la portada antes de que
  la vea el público.

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `PATCH /api/v1/admin/homepage/layout` | Actualizar la composición de la portada | Autenticado | `homepage:write` |
| `GET /api/v1/admin/homepage/preview` | Previsualizar la portada con los cambios sin publicar | Autenticado | `homepage:read` |
| `GET /api/v1/homepage` | Obtener la composición de la portada pública | Público | — |

## Código

**Controladores**

- [`src/modules/homepage/homepage.controller.ts`](../../src/modules/homepage/homepage.controller.ts)

**Servicios**

- [`src/modules/homepage/homepage.service.ts`](../../src/modules/homepage/homepage.service.ts)

**DTO**

- [`src/modules/homepage/dto/homepage.dto.ts`](../../src/modules/homepage/dto/homepage.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `ContentAuthor` — ver [catálogo de entidades](../data/entity-catalog.md)
- `ContentCategory` — ver [catálogo de entidades](../data/entity-catalog.md)
- `ContentPublication` — ver [catálogo de entidades](../data/entity-catalog.md)
- `ContentTag` — ver [catálogo de entidades](../data/entity-catalog.md)
- `HomepageFeaturedItem` — ver [catálogo de entidades](../data/entity-catalog.md)
- `HomepageSection` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

⚠️ **Sin pruebas automatizadas propias.** Su comportamiento sólo se ejercita de forma indirecta.

