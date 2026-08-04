# Módulo `analytics`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/analytics.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/analytics/` |
| Etiqueta en la API | `Analítica` |
| Operaciones HTTP | 2 |
| Controladores | 1 |
| Servicios | 1 |
| DTO | 1 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 1 |
| Roles que intervienen | `ADMIN`, `SUPER_ADMIN` |
| Permisos que exige | `analytics:read` |

## Por qué existe

Recoge señales de uso del sitio público —eventos de interfaz y visitas— para decidir con datos qué
contenido funciona.

## Reglas de dominio

- **El registro de eventos es público y con límite estricto** (60 por minuto): lo llama el navegador
  de cualquier visitante.
- **No identifica personas.** Los eventos no llevan identidad de usuario; sirven para agregados, no
  para seguimiento individual.

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/analytics/ui-events` | Consultar los eventos de interfaz registrados | `ADMIN`, `SUPER_ADMIN` | `analytics:read` |
| `POST /api/v1/analytics/ui-events` | Registrar un evento de interfaz del sitio público | Público | — |

## Código

**Controladores**

- [`src/modules/analytics/analytics.controller.ts`](../../src/modules/analytics/analytics.controller.ts)

**Servicios**

- [`src/modules/analytics/analytics.service.ts`](../../src/modules/analytics/analytics.service.ts)

**DTO**

- [`src/modules/analytics/dto/ui-event.dto.ts`](../../src/modules/analytics/dto/ui-event.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `PublicVisit` — ver [catálogo de entidades](../data/entity-catalog.md)
- `UiEvent` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/analytics/analytics.service.spec.ts`](../../src/modules/analytics/analytics.service.spec.ts)

