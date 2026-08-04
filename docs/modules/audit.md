# Módulo `audit`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/audit.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/audit/` |
| Etiqueta en la API | `Auditoría` |
| Operaciones HTTP | 1 |
| Controladores | 1 |
| Servicios | 1 |
| DTO | 0 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 0 |
| Roles que intervienen | `ADMIN`, `SUPER_ADMIN` |
| Permisos que exige | `audit:read` |

## Por qué existe

Un sistema que maneja datos clínicos necesita poder responder «quién hizo qué y cuándo». Este módulo
es el registro transversal donde escriben diez de los diecinueve módulos de dominio.

## Propiedad estructural

**`audit` no importa de ningún módulo de dominio.** Recibe aristas de diez módulos y no emite
ninguna. La asimetría es deliberada: si `audit` necesitara conocer la forma de una cita, aparecería
el primer ciclo entre módulos del sistema. Ver
[dependencias entre módulos](../architecture/module-dependencies.md).

## Reglas de dominio

- **Es de sólo escritura desde el dominio.** La única superficie de lectura es la consulta
  administrativa, protegida por `audit:read`.
- **Nunca almacena el cuerpo completo de una petición.** Los datos sensibles se redactan antes de
  persistir; ver [auditabilidad](../security/auditability.md).

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/audit/logs` | Consultar el registro de auditoría | `ADMIN`, `SUPER_ADMIN` | `audit:read` |

## Código

**Controladores**

- [`src/modules/audit/audit.controller.ts`](../../src/modules/audit/audit.controller.ts)

**Servicios**

- [`src/modules/audit/audit.service.ts`](../../src/modules/audit/audit.service.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `AuditLog` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

⚠️ **Sin pruebas automatizadas propias.** Su comportamiento sólo se ejercita de forma indirecta.

