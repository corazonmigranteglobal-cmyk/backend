# Módulo `roles-permissions`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/roles-permissions.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/roles-permissions/` |
| Etiqueta en la API | — (sin superficie HTTP) |
| Operaciones HTTP | 0 |
| Controladores | 0 |
| Servicios | 1 |
| DTO | 0 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 1 |
| Roles que intervienen | — |
| Permisos que exige | — |

## Por qué existe

Es la fuente única del control de acceso. Los tres guards globales (`JwtAuthGuard`, `RolesGuard`,
`PermissionsGuard`) resuelven contra este módulo, de modo que la autorización no queda repartida por
los controladores.

## Reglas de dominio

- **Roles y permisos viven en base de datos**, no en constantes del código: el catálogo puede crecer
  sin desplegar.
- **Un rol agrupa permisos; un permiso autoriza una acción concreta** (`content:write`,
  `accounting:read`). Las rutas declaran permisos siempre que es posible: es el grano fino el que
  sobrevive a una reorganización de roles.
- **No expone superficie HTTP propia.** Se administra desde `users` y se consume desde los guards.

## Consecuencia para quien integra

Cada operación protegida documenta en su descripción los roles y permisos exactos que exige, y esa
descripción se genera leyendo los decoradores del código. Ver [autorización](../api/authorization.md).

## Endpoints

Este módulo no expone superficie HTTP: lo consumen otros módulos del backend.

## Código

**Servicios**

- [`src/modules/roles-permissions/roles-permissions.service.ts`](../../src/modules/roles-permissions/roles-permissions.service.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `Permission` — ver [catálogo de entidades](../data/entity-catalog.md)
- `Role` — ver [catálogo de entidades](../data/entity-catalog.md)
- `RolePermission` — ver [catálogo de entidades](../data/entity-catalog.md)
- `UserRole` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/roles-permissions/roles-permissions.service.spec.ts`](../../src/modules/roles-permissions/roles-permissions.service.spec.ts)

