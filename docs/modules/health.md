# Módulo `health`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/health.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/health/` |
| Etiqueta en la API | `Salud` |
| Operaciones HTTP | 2 |
| Controladores | 1 |
| Servicios | 1 |
| DTO | 0 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 1 |
| Roles que intervienen | — |
| Permisos que exige | — |

## Por qué existe

Da a orquestadores y balanceadores una respuesta fiable sobre si el proceso puede atender tráfico.

## Reglas de dominio

- **Vive fuera del prefijo `api/v1`.** `/health` está en la raíz porque quien la consulta no conoce
  el prefijo versionado y a menudo no puede configurarlo. La exclusión es una constante compartida
  entre `main.ts` y la generación del contrato (`src/config/http-routes.ts`).
- **Distingue `ok` de `degraded`.** Si Redis está caído pero PostgreSQL responde, el servicio sigue
  siendo útil: devuelve `degraded`, no un fallo.

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/health/version` | Version del servidor actualmente desplegado | Público | — |
| `GET /health` | Liveness / readiness check con estado real de dependencias | Público | — |

## Código

**Controladores**

- [`src/modules/health/health.controller.ts`](../../src/modules/health/health.controller.ts)

**Servicios**

- [`src/modules/health/health.service.ts`](../../src/modules/health/health.service.ts)

## Modelo de datos

Este módulo no accede directamente a ninguna entidad persistente.

## Pruebas

- [`src/modules/health/health.service.spec.ts`](../../src/modules/health/health.service.spec.ts)

