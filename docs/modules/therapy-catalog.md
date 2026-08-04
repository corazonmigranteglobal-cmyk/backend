# Módulo `therapy-catalog`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/therapy-catalog.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/therapy-catalog/` |
| Etiqueta en la API | `Catálogo terapéutico` |
| Operaciones HTTP | 9 |
| Controladores | 1 |
| Servicios | 1 |
| DTO | 2 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 1 |
| Roles que intervienen | `ADMIN`, `SUPER_ADMIN` |
| Permisos que exige | `therapy:read`, `therapy:write` |

## Por qué existe

Define qué se ofrece: los productos terapéuticos (sesiones, programas) y los enfoques que practican
las terapeutas. Es lo que una persona paciente consulta antes de reservar.

## Reglas de dominio

- **El catálogo público sólo muestra lo activo.** El listado administrativo ve todo.
- **Un producto terapéutico tiene precio y duración**, y esos dos datos son los que `appointments`
  y `accounting` usan después: cambiarlos afecta a reservas futuras, nunca a las ya registradas.

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/therapy/approaches` | Listar todos los enfoques terapéuticos | `ADMIN`, `SUPER_ADMIN` | `therapy:read` |
| `POST /api/v1/admin/therapy/approaches` | Crear un enfoque terapéutico | `ADMIN`, `SUPER_ADMIN` | `therapy:write` |
| `PATCH /api/v1/admin/therapy/approaches/{id}` | Actualizar un enfoque terapéutico | `ADMIN`, `SUPER_ADMIN` | `therapy:write` |
| `GET /api/v1/admin/therapy/products` | Listar todos los productos terapéuticos | `ADMIN`, `SUPER_ADMIN` | `therapy:read` |
| `POST /api/v1/admin/therapy/products` | Crear un producto terapéutico | `ADMIN`, `SUPER_ADMIN` | `therapy:write` |
| `DELETE /api/v1/admin/therapy/products/{id}` | Eliminar un producto terapéutico | `ADMIN`, `SUPER_ADMIN` | `therapy:write` |
| `PATCH /api/v1/admin/therapy/products/{id}` | Actualizar un producto terapéutico | `ADMIN`, `SUPER_ADMIN` | `therapy:write` |
| `GET /api/v1/therapy/approaches` | Listar los enfoques terapéuticos publicados | Público | — |
| `GET /api/v1/therapy/products` | Listar los productos terapéuticos publicados | Público | — |

## Código

**Controladores**

- [`src/modules/therapy-catalog/therapy-catalog.controller.ts`](../../src/modules/therapy-catalog/therapy-catalog.controller.ts)

**Servicios**

- [`src/modules/therapy-catalog/therapy-catalog.service.ts`](../../src/modules/therapy-catalog/therapy-catalog.service.ts)

**DTO**

- [`src/modules/therapy-catalog/dto/therapy-response.dto.ts`](../../src/modules/therapy-catalog/dto/therapy-response.dto.ts)
- [`src/modules/therapy-catalog/dto/therapy.dto.ts`](../../src/modules/therapy-catalog/dto/therapy.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `TherapyApproach` — ver [catálogo de entidades](../data/entity-catalog.md)
- `TherapyProduct` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/therapy-catalog/therapy-catalog.service.spec.ts`](../../src/modules/therapy-catalog/therapy-catalog.service.spec.ts)

