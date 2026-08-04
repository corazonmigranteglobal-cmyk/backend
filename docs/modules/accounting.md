# Módulo `accounting`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/accounting.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/accounting/` |
| Etiqueta en la API | `Contabilidad` |
| Operaciones HTTP | 9 |
| Controladores | 1 |
| Servicios | 1 |
| DTO | 1 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 1 |
| Roles que intervienen | `ACCOUNTANT`, `ADMIN`, `SUPER_ADMIN` |
| Permisos que exige | `accounting:read`, `accounting:write` |

## Por qué existe

Registra el movimiento económico del centro con partida doble: plan de cuentas, asientos,
transacciones, ventas y centros de coste.

## Reglas de dominio

- **Partida doble real.** Una transacción agrupa asientos que deben cuadrar; no se persiste una
  transacción descuadrada.
- **La venta se genera desde la cita atendida**, no al reservarla:
  `POST /admin/accounting/transactions/from-appointment/{appointmentId}`. Facturar una cita que no
  se prestó sería un error contable.
- **El plan de cuentas es jerárquico** (`account_group` → `account`).

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/accounting/account-groups` | Listar grupos de cuentas contables | `ACCOUNTANT`, `ADMIN`, `SUPER_ADMIN` | `accounting:read` |
| `POST /api/v1/admin/accounting/account-groups` | Crear un grupo de cuentas contables | `ACCOUNTANT`, `ADMIN`, `SUPER_ADMIN` | `accounting:write` |
| `GET /api/v1/admin/accounting/accounts` | Listar cuentas del plan contable | `ACCOUNTANT`, `ADMIN`, `SUPER_ADMIN` | `accounting:read` |
| `POST /api/v1/admin/accounting/accounts` | Crear una cuenta en el plan contable | `ACCOUNTANT`, `ADMIN`, `SUPER_ADMIN` | `accounting:write` |
| `GET /api/v1/admin/accounting/cost-centers` | Listar centros de coste | `ACCOUNTANT`, `ADMIN`, `SUPER_ADMIN` | `accounting:read` |
| `POST /api/v1/admin/accounting/cost-centers` | Crear un centro de coste | `ACCOUNTANT`, `ADMIN`, `SUPER_ADMIN` | `accounting:write` |
| `GET /api/v1/admin/accounting/transactions` | Listar transacciones contables | `ACCOUNTANT`, `ADMIN`, `SUPER_ADMIN` | `accounting:read` |
| `POST /api/v1/admin/accounting/transactions` | Registrar una transacción contable con sus asientos | `ACCOUNTANT`, `ADMIN`, `SUPER_ADMIN` | `accounting:write` |
| `POST /api/v1/admin/accounting/transactions/from-appointment/{appointmentId}` | Generar el asiento contable de una cita atendida | `ACCOUNTANT`, `ADMIN`, `SUPER_ADMIN` | `accounting:write` |

## Código

**Controladores**

- [`src/modules/accounting/accounting.controller.ts`](../../src/modules/accounting/accounting.controller.ts)

**Servicios**

- [`src/modules/accounting/accounting.service.ts`](../../src/modules/accounting/accounting.service.ts)

**DTO**

- [`src/modules/accounting/dto/accounting.dto.ts`](../../src/modules/accounting/dto/accounting.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `Account` — ver [catálogo de entidades](../data/entity-catalog.md)
- `AccountGroup` — ver [catálogo de entidades](../data/entity-catalog.md)
- `AccountingEntry` — ver [catálogo de entidades](../data/entity-catalog.md)
- `AccountingTransaction` — ver [catálogo de entidades](../data/entity-catalog.md)
- `Appointment` — ver [catálogo de entidades](../data/entity-catalog.md)
- `CostCenter` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/accounting/accounting.service.spec.ts`](../../src/modules/accounting/accounting.service.spec.ts)

