# Módulo `legacy-compatibility`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/legacy-compatibility.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/legacy-compatibility/` |
| Etiqueta en la API | `Compatibilidad legacy` |
| Operaciones HTTP | 1 |
| Controladores | 1 |
| Servicios | 0 |
| DTO | 0 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 0 |
| Roles que intervienen | — |
| Permisos que exige | — |

## Por qué existe

Conserva rutas que clientes antiguos siguen llamando, para no romperlos mientras migran.

## Reglas de dominio

- **No recibe funcionalidad nueva.** Cualquier cambio aquí es para mantener viva una ruta existente.
- **Su existencia es temporal por definición.** La política de retirada está en
  [política de deprecación](../api/deprecation-policy.md).

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/legacy/status` | Comprobar la disponibilidad del backend desde clientes antiguos | Público | — |

## Código

**Controladores**

- [`src/modules/legacy-compatibility/legacy-compatibility.controller.ts`](../../src/modules/legacy-compatibility/legacy-compatibility.controller.ts)

## Modelo de datos

Este módulo no accede directamente a ninguna entidad persistente.

## Pruebas

⚠️ **Sin pruebas automatizadas propias.** Su comportamiento sólo se ejercita de forma indirecta.

