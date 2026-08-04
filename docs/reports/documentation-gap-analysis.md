# Análisis de brechas documentales

Compara el estado real del backend con el estándar objetivo del plan y convierte cada diferencia en
una tarea verificable. Se clasifica según el plan: `BLOCKER`, `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.

## Resumen

| Clasificación | Cerradas | Abiertas |
| --- | ---: | ---: |
| `BLOCKER` | 3 | 0 |
| `CRITICAL` | 2 | 1 |
| `HIGH` | 5 | 4 |
| `MEDIUM` | 4 | 6 |
| `LOW` | 0 | 3 |

## Brechas cerradas

| ID | Área | Brecha | Acción ejecutada | Validación |
| --- | --- | --- | --- | --- |
| G-01 | Pruebas | `BLOCKER` — la suite e2e no podía ejecutarse (`supertest_1.default is not a function`) | Import corregido; [ADR-0015](../adr/ADR-0015-interoperabilidad-de-modulos.md) | `yarn test:e2e` → 8/8 |
| G-02 | Despliegue | `BLOCKER` — la auditoría de dependencias nunca se ejecutó en Windows (`EINVAL`) | `shell: true` en `win32` | `yarn audit:dependencies` |
| G-03 | Seguridad | `BLOCKER` — 4 vulnerabilidades altas en rutas de producción | Resoluciones dirigidas | 0 altas/críticas |
| G-04 | API | `CRITICAL` — no existía contrato generado desde el código; el `openapi.yml` del repositorio se escribía a mano | `scripts/generate-openapi.ts` | 189 operaciones, paridad 189/189 |
| G-05 | API | `CRITICAL` — la autorización de cada operación no estaba publicada | Se deriva de `@Public`/`@Roles`/`@Permissions` en la generación | `yarn docs:openapi:coverage` |
| G-06 | API | `HIGH` — 119 operaciones sin `summary`, 34 etiquetas ad-hoc | Resúmenes añadidos; taxonomía de 18 etiquetas | 189/189 sin incidencias |
| G-07 | API | `HIGH` — sin gobierno del contrato | `redocly.yaml` con reglas en `error` | `redocly lint` → 0 errores |
| G-08 | Arquitectura | `HIGH` — el grafo de conocimiento estaba obsoleto (87 archivos ausentes) | Reconstruido | 0 divergencias |
| G-09 | Arquitectura | `HIGH` — dependencias entre módulos sin documentar | [Dependencias](../architecture/module-dependencies.md), [integraciones](../architecture/integration-map.md) | Contrastado con el grafo |
| G-10 | Operación | `HIGH` — colisión de puerto de PostgreSQL sin documentar, con error engañoso | `POSTGRES_HOST_PORT` configurable | [Puesta en marcha](../getting-started/local-setup.md) |
| G-11 | Datos | `MEDIUM` — sin catálogo de entidades | `scripts/generate-entity-catalog.mjs` | 57 entidades |
| G-12 | Negocio | `MEDIUM` — sin contexto de negocio por módulo | `_sourcebook.md` → 19 páginas | `yarn docs:modules` |
| G-13 | Seguridad | `MEDIUM` — sin modelo de amenazas | [STRIDE](../security/threat-model.md) | 3 hallazgos medios aceptados |
| G-14 | Gobierno | `MEDIUM` — sin política ni trazabilidad | [Política](../governance/documentation-policy.md), [matriz](../governance/traceability-matrix.md) | — |
| G-15 | Despliegue | `CRITICAL` — el build emitía `dist/src/main.js` en lugar de `dist/main.js` tras añadir un `.ts` fuera de `src/` | `rootDir` fijado en `tsconfig.build.json` | `ls dist/main.js` |

## Brechas abiertas

| ID | Clasificación | Área | Brecha | Acción concreta | Riesgo mientras tanto |
| --- | --- | --- | --- | --- | --- |
| G-20 | `CRITICAL` | API | 188 de 189 operaciones documentan el sobre de respuesta pero no el esquema de `data` | Añadir `@ApiEnvelope(Dto, …)` por handler, empezando por `Citas`, `Agenda` y `Auth` | Quien integra conoce la envoltura y los errores, no la forma de la carga útil; debe inspeccionar respuestas reales |
| G-21 | `HIGH` | Datos | Sin política de retención aplicada; `message_outbox` crece sin techo | Job de purga por categoría | Crecimiento sin control y conservación de datos personales más allá de lo necesario |
| G-22 | `HIGH` | Recuperación | La restauración de copia no se ensaya | Ensayo trimestral documentado | Una copia nunca restaurada no es una copia verificada |
| G-23 | `HIGH` | Recuperación | Los archivos subidos no entran en la copia de la base | Definir política de copia del bucket | Pérdida irrecuperable de documentación clínica adjunta |
| G-24 | `HIGH` | Observabilidad | Sin métricas ni SLO declarados; sólo hay trazas y logs | Exponer métricas y definir objetivos de servicio | No hay criterio objetivo para saber si el servicio está sano |
| G-25 | `MEDIUM` | Arquitectura | Sin modelo C4 formal (Structurizr) | `structurizr/workspace.dsl` | Los diagramas actuales son Mermaid por documento, sin modelo único |
| G-26 | `MEDIUM` | Eventos | Sin contrato AsyncAPI del outbox | `asyncapi/asyncapi.yaml` | Los tipos de mensaje se deducen del código |
| G-27 | `MEDIUM` | Pruebas | `audit`, `homepage` y `notifications` sin suite propia | Añadir pruebas unitarias | Comportamiento sólo ejercitado de forma indirecta |
| G-28 | `MEDIUM` | Pruebas | Las migraciones no se ejecutan en `verify:ci` | Job con PostgreSQL que aplique migraciones | Una migración rota se descubre al desplegar |
| G-29 | `MEDIUM` | Seguridad | El `hottok` de Hotmart no liga la firma al contenido | Migrar a HMAC sobre el cuerpo | [A-1](../security/threat-model.md): un token filtrado permite notificaciones fabricadas |
| G-30 | `MEDIUM` | Operación | Sin runbooks para base degradada, migración fallida y rollback | Escribirlos siguiendo el formato del [runbook de outbox](../operations/runbooks/outbox-detenido.md) | Sólo existe el de la cola de mensajes |
| G-31 | `LOW` | Documentación | 60 documentos históricos sueltos en `docs/` (hotfixes, notas de versión) conviven con la documentación viva | Mover a `docs/archive/` | Ruido de navegación |
| G-32 | `LOW` | API | Ejemplos de petición y respuesta sólo en los componentes compartidos | Añadir ejemplos por operación | La referencia interactiva muestra ejemplos genéricos |
| G-33 | `LOW` | Documentación | Portal MkDocs sin publicar en una URL | Job de publicación | La documentación se lee desde el repositorio |

## Criterio de cierre de la fase

- Cero brechas sin clasificación: **cumplido**.
- Cero acciones vagas: cada fila indica archivo o comando concreto.
- Cero `BLOCKER` abiertos: **cumplido**.
- Un `CRITICAL` abierto (G-20), con impacto acotado y medido en
  [cobertura OpenAPI](openapi-coverage.md).
