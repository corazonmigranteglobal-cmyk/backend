# Preparación para producción

**Commit evaluado:** rama `docs/plan-maestro-documentacion` sobre `4b50289`.
**Fecha:** 3 de agosto de 2026.

---

## Declaración

# NO APTO PARA PRODUCCIÓN

El plan exige una de dos declaraciones, sin estados intermedios. Esta es la que corresponde, y el
motivo es acotado y concreto:

> **Requisito que bloquea el cierre:** *«Backup, restauración y rollback comprobados»* (sección 21,
> bloque Operación).
>
> La copia a Neon está automatizada y programada, pero **su restauración nunca se ha ensayado**, y
> **los archivos subidos no entran en ninguna copia gestionada por este repositorio**. Restaurar la
> base de datos no recupera los archivos: los metadatos quedarían apuntando a objetos inexistentes.
>
> Una copia que nunca se ha restaurado no es una copia verificada. Y en un sistema que custodia
> documentación clínica, la pérdida irrecuperable de esos archivos es un daño que no se puede
> compensar después.

No es un problema de documentación: es una capacidad operativa que no existe. Documentarla mejor no
la crea.

### Qué haría falta para revertir esta declaración

| # | Acción | Brecha |
| --- | --- | --- |
| 1 | Definir y aplicar una política de copia de los buckets de archivos | [G-23](documentation-gap-analysis.md) |
| 2 | Ensayar una restauración completa —base y archivos— sobre un entorno limpio y dejar constancia | [G-22](documentation-gap-analysis.md) |
| 3 | Declarar RPO y RTO, y comprobar que el ensayo los cumple | [G-22](documentation-gap-analysis.md) |

Ninguna de las tres exige escribir código de aplicación. Son trabajo de operación.

---

## Lo que sí está comprobado

Todo lo de esta sección se ha ejecutado y su salida es reproducible.

| Comprobación | Comando | Resultado |
| --- | --- | --- |
| Instalación desde lockfile | `yarn install --frozen-lockfile` | ✅ |
| Tipos | `yarn typecheck` | ✅ |
| Lint | `yarn lint` | ✅ |
| Pruebas unitarias | `yarn test --runInBand` | ✅ 290/290 |
| Pruebas e2e | `yarn test:e2e` | ✅ 8/8 |
| Construcción | `yarn build` | ✅ `dist/main.js` |
| Higiene del repositorio | `yarn check:repository` | ✅ |
| Secretos versionados | `yarn check:secrets` | ✅ |
| Validación estricta | `yarn check:validation-strict` | ✅ |
| Dependencias de producción | `yarn audit:dependencies` | ✅ 0 críticas, 0 altas |
| Puerta completa | `yarn verify:ci` | ✅ |
| Gobierno del contrato | `yarn docs:openapi:lint` | ✅ 0 errores |
| Cobertura del contrato | `yarn docs:openapi:coverage` | ✅ 189/189 |
| Contrato asíncrono | `yarn docs:asyncapi:lint` | ✅ |
| Enlaces de documentación | `yarn docs:links` | ✅ 478/478 |
| Portal | `mkdocs build --strict` | ✅ |

---

## Checklist del plan

### Graphify

| Criterio | Estado |
| --- | :---: |
| Artefactos consultados | ✅ |
| Módulos y relaciones documentados | ✅ |
| Ciclos y huérfanos revisados | ✅ 10 ciclos analizados, 1 descartado por falso positivo |
| Diagramas coherentes con el grafo | ✅ |

### API

| Criterio | Estado |
| --- | :---: |
| Todos los endpoints documentados | ✅ 189/189, paridad verificada con las rutas de NestJS |
| `operationId` en todas | ✅ |
| Seguridad declarada en todas | ✅ derivada de los decoradores |
| Solicitudes con esquema | ✅ desde los DTO |
| Respuestas con esquema | ✅ el sobre en todas; ⚠️ `data` tipado en 53 de 189 |
| Errores relevantes documentados | ✅ derivados de la firma de cada operación |
| Ejemplos válidos | ✅ `no-invalid-schema-examples` en `error` |
| Redocly sin errores | ✅ |
| Scalar funciona | ✅ verificado sirviendo en `/docs` |

### Arquitectura

| Criterio | Estado |
| --- | :---: |
| C4 completo | ✅ `structurizr/workspace.dsl` con contexto, contenedores y componentes |
| Dependencias críticas explicadas | ✅ |
| Flujos principales documentados | ✅ 5 flujos críticos |
| Integraciones documentadas | ✅ 8, con su modo de fallo |
| ADR | ⚠️ 2 formales más 7 decisiones registradas en su documento operativo |

### Datos

| Criterio | Estado |
| --- | :---: |
| Entidades catalogadas | ✅ 57 |
| Relaciones comprobadas | ✅ asociaciones y claves foráneas |
| Índices documentados | ❌ el catálogo remite a las migraciones |
| Migraciones y *seeds* explicados | ✅ |
| Retención y sensibilidad definidas | ⚠️ definidas, **no aplicadas** |

### Seguridad

| Criterio | Estado |
| --- | :---: |
| Modelo de amenazas | ✅ STRIDE completo |
| Secretos y permisos documentados | ✅ |
| Riesgos críticos resueltos | ✅ ninguno abierto; 3 medios aceptados con evidencia |
| Datos sensibles protegidos en ejemplos y logs | ✅ con la salvedad de `LOG_LEVEL=debug` (A-3) |

### Operación

| Criterio | Estado |
| --- | :---: |
| Health checks documentados | ✅ |
| Logs, métricas y trazas definidos | ⚠️ logs y trazas sí; **métricas no existen** |
| Alertas y SLO definidos | ⚠️ propuestos, no medidos ni implantados |
| Runbooks disponibles | ⚠️ 3 de los 10 que pide el plan |
| Backup, restauración y rollback comprobados | ❌ **bloqueante** |

### Calidad

| Criterio | Estado |
| --- | :---: |
| MkDocs compila en modo estricto | ✅ |
| Sin enlaces rotos | ✅ 478 verificados, incluidos los que apuntan al código |
| Sin marcadores TODO/FIXME | ✅ verificado en CI |
| Sin páginas vacías | ✅ |
| Sin contradicciones conocidas | ✅ |
| CI/CD documental activo | ✅ workflow `docs` |

---

## Métricas frente a los objetivos del plan

| Métrica | Objetivo | Real | |
| --- | ---: | ---: | :---: |
| Endpoints documentados | 100 % | 100 % (189/189) | ✅ |
| Operaciones con `operationId` | 100 % | 100 % | ✅ |
| Operaciones con seguridad definida | 100 % | 100 % | ✅ |
| Ejemplos válidos | 100 % | 100 % | ✅ |
| Módulos críticos documentados | 100 % | 100 % (19/19) | ✅ |
| Entidades relevantes catalogadas | 100 % | 100 % (57/57) | ✅ |
| Eventos relevantes documentados | 100 % | 100 % (5/5) | ✅ |
| Enlaces internos válidos | 100 % | 100 % (478) | ✅ |
| Reglas Redocly con error | 0 | 0 | ✅ |
| Errores de compilación MkDocs | 0 | 0 | ✅ |
| Marcadores TODO/TBD | 0 | 0 | ✅ |
| Riesgos críticos abiertos | 0 | 0 | ✅ |
| Esquemas con descripción | 100 % de los públicos | 28 % con `data` tipado | ❌ |
| Runbooks críticos disponibles | 100 % | 30 % (3/10) | ❌ |

---

## Riesgos residuales aceptados

| ID | Riesgo | Por qué se acepta |
| --- | --- | --- |
| A-1 | El `hottok` de Hotmart autentica el origen pero no liga la firma al contenido | El control existe, falla cerrado, usa comparación en tiempo constante y la operación es idempotente |
| A-2 | La URL firmada de archivo es transferible durante 900 s | Comportamiento estándar de las URL firmadas; todo acceso queda registrado |
| A-3 | `LOG_LEVEL=debug` vuelca datos clínicos | Control operativo: no debe usarse en producción salvo investigación acotada |
| R-01 | `uuid@9.0.1` con aviso moderado | Rama vulnerable no alcanzable: `gaxios` sólo usa `v4()` sin `buf` |

---

## Resumen

El backend está **técnicamente sano y bien documentado**: la puerta de calidad pasa entera, el
contrato describe con exactitud las 189 operaciones y no puede desviarse del código, y no queda
ninguna amenaza crítica sin mitigar.

Lo que falta no es documentación, es **capacidad de recuperación comprobada**. Hasta que exista una
restauración ensayada que incluya los archivos, cualquier declaración de aptitud sería una
afirmación sin evidencia.
