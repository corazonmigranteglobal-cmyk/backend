# Análisis de brechas documentales

Compara el estado real del backend con el estándar objetivo del plan y convierte cada diferencia en
una tarea verificable. Se clasifica según el plan: `BLOCKER`, `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.

## Resumen

| Clasificación | Cerradas | Abiertas |
| --- | ---: | ---: |
| `BLOCKER` | 3 | 0 |
| `CRITICAL` | 2 | 0 |
| `HIGH` | 7 | 2 |
| `MEDIUM` | 10 | 3 |
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
| G-16 | Eventos | `MEDIUM` — sin contrato AsyncAPI del outbox | `asyncapi/asyncapi.yaml` con validador de paridad de tipos | `yarn docs:asyncapi:lint`. Cazó 5 tipos sin declarar |
| G-17 | Arquitectura | `MEDIUM` — sin modelo C4 formal | `structurizr/workspace.dsl` con contexto, contenedores y componentes | Modelo versionado junto al código |
| G-18 | API | `MEDIUM` — sin convenciones, autenticación ni modelo de error escritos | 4 páginas en `docs/api/` | Enlaces verificados |
| G-20b | API | `HIGH` — solo 1 de 189 operaciones tipaba `data` | 33 DTO de respuesta con columnas verificadas y `@ApiEnvelope` en 154 operaciones | `yarn docs:openapi:coverage` |
| G-21 | Datos | `HIGH` — sin purga: `mensaje_outbox` crecia sin techo | `scripts/purge-retention.mjs` con 6 politicas y simulacion por defecto | `yarn db:retention:dry-run` contra el esquema real |
| G-30 | Operación | `MEDIUM` — faltaban 7 runbooks | 6 runbooks: API caida, outbox, migracion fallida, integracion externa, rollback y recuperacion desde copia | Enlaces verificados |
| G-24a | Observabilidad | `HIGH` — no se exponia ninguna metrica | Modulo de metricas Prometheus: RED de HTTP por patron de ruta, pool de base y outbox; token con fallo cerrado y comparacion en tiempo constante | 4 pruebas nuevas; verificado sirviendo en `/metrics` |
| G-23a | Datos | `HIGH` — sin forma de detectar metadatos huerfanos de archivos | `scripts/backup-file-storage.mjs` con `--check` y `--replicate` | `yarn files:check` |
| G-19 | Pruebas | `MEDIUM` — sin estrategia de pruebas documentada | [Estrategia de pruebas](../testing/strategy.md) | — |

## Brechas abiertas

| ID | Clasificación | Área | Brecha | Acción concreta | Riesgo mientras tanto |
| --- | --- | --- | --- | --- | --- |
| G-20 | `MEDIUM` | API | 35 de 189 operaciones documentan el sobre pero no el esquema de `data` (81,5 % tipado). Lo que queda son sobre todo acciones sin carga útil propia y alias de compatibilidad | Completar con `@ApiEnvelope(Dto, …)` los handlers restantes de contenido admin, usuarios y descargables | Quien integra esas operaciones concretas conoce la envoltura y los errores, no la forma exacta de la carga |
| G-22 | `HIGH` | Recuperación | El ensayo de restauración ya existe y pasa (`yarn db:verify-restore`), pero **no se ha ejecutado contra un volcado de producción** ni está programado | Ejecutarlo sobre una copia de Neon, medir el tiempo real y declarar RPO/RTO a partir de esa medición | El RTO real sigue siendo desconocido |
| G-23 | `HIGH` | Recuperación | Los archivos subidos no entran en la copia de la base | Definir política de copia del bucket | Pérdida irrecuperable de documentación clínica adjunta |
| G-24 | `MEDIUM` | Observabilidad | Las métricas **ya se emiten** (`GET /metrics`, protegido y con fallo cerrado), pero nadie las recoge: falta desplegar un Prometheus y definir alertas | Raspar el endpoint, conservar la serie y medir un mes antes de fijar los objetivos definitivos | Sin recolección no hay alertas: la detección sigue dependiendo de que alguien lo note |
| G-27 | `MEDIUM` | Pruebas | `audit`, `homepage` y `notifications` sin suite propia | Añadir pruebas unitarias | Comportamiento sólo ejercitado de forma indirecta |
| G-28 | `MEDIUM` | Pruebas | Las migraciones no se ejecutan en `verify:ci` | Job con PostgreSQL que aplique migraciones | Una migración rota se descubre al desplegar |
| G-29 | `MEDIUM` | Seguridad | El `hottok` de Hotmart no liga la firma al contenido | Migrar a HMAC sobre el cuerpo | [A-1](../security/threat-model.md): un token filtrado permite notificaciones fabricadas |
| G-31 | `LOW` | Documentación | 60 documentos históricos sueltos en `docs/` (hotfixes, notas de versión) conviven con la documentación viva | Mover a `docs/archive/` | Ruido de navegación |
| G-32 | `LOW` | API | Ejemplos de petición y respuesta sólo en los componentes compartidos | Añadir ejemplos por operación | La referencia interactiva muestra ejemplos genéricos |
| G-33 | `LOW` | Documentación | Portal MkDocs sin publicar en una URL | Job de publicación | La documentación se lee desde el repositorio |

## Criterio de cierre de la fase

- Cero brechas sin clasificación: **cumplido**.
- Cero acciones vagas: cada fila indica archivo o comando concreto.
- Cero `BLOCKER` y cero `CRITICAL` abiertos: **cumplido**. G-20 baja a `MEDIUM` al quedar tipado el
  81,5 % de las cargas útiles (154 de 189), incluidos todos los dominios de mayor tráfico. Medido en
  [cobertura OpenAPI](openapi-coverage.md).

**Lo que impide declarar la aptitud para producción no está en esta tabla como brecha documental,
sino como capacidad ausente:** los archivos subidos no entran en ninguna copia gestionada (G-23).
El ensayo de restauración de la base ya existe y pasa, pero recuperar la base no recupera los
archivos. Documentarlo mejor no lo resuelve: es configuración del proveedor de almacenamiento. Ver [preparación para producción](production-readiness.md).
