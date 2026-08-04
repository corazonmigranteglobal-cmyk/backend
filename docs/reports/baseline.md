# Línea base del backend

> **Fase 0 del plan de documentación.** Establece un punto de partida reproducible: qué es
> este sistema, qué comandos lo verifican y cuál fue el resultado real de ejecutarlos.

- **Commit evaluado:** `3580196` (`perf(deploy): acelerar build Docker`), 29 de julio de 2026.
- **Fecha de ejecución:** 3 de agosto de 2026.
- **Máquina de referencia:** Windows 11 Home 10.0.26200, PowerShell y Git Bash.

---

## 1. Identificación del sistema

| Dimensión | Valor comprobado | Evidencia |
| --- | --- | --- |
| Framework | NestJS 11.1.28 | [package.json](../../package.json) |
| Lenguaje | TypeScript 5.9.3, objetivo ES2021, `strict: true` | [tsconfig.json](../../tsconfig.json) |
| Runtime | Node.js v22.23.1 (rango declarado `>=20 <27`) | `node -v`, `engines` en package.json |
| Gestor de paquetes | Yarn 1.22.22 (`packageManager` fijado) | `yarn -v` |
| ORM | Sequelize 6.37 + `sequelize-typescript` 2.1.6 | [src/database/database.module.ts](../../src/database/database.module.ts) |
| Motor de datos | PostgreSQL (dialecto `postgres`, `synchronize: false`) | `database.module.ts` |
| Caché / estado compartido | Redis vía `ioredis` 5.4 | [src/infrastructure/redis](../../src/infrastructure/redis) |
| Mensajería asíncrona | Patrón *outbox* en base de datos, sin broker externo | [src/workers/outbox.worker.ts](../../src/workers/outbox.worker.ts) |
| Autenticación | JWT propio (`@nestjs/jwt`), sin proveedor externo de identidad | [src/modules/auth](../../src/modules/auth) |
| Autorización | RBAC con roles y permisos en base de datos, tres guards globales | [src/common/guards](../../src/common/guards) |
| Observabilidad | OpenTelemetry SDK 0.221 (trazas) + `pino` 10.3 (logs estructurados) | [src/observability](../../src/observability) |
| Almacenamiento de archivos | Google Cloud Storage o Cloudinary, seleccionable por `STORAGE_PROVIDER` | [src/config/configuration.ts](../../src/config/configuration.ts) |
| Correo | SendGrid, con proveedor `DEV_NULL` para desarrollo | [src/modules/messaging](../../src/modules/messaging) |
| Pasarela de contenido de pago | Hotmart (webhook entrante) | [src/modules/downloadables/hotmart.adapter.ts](../../src/modules/downloadables/hotmart.adapter.ts) |
| Documentación de API previa | Swagger UI en `/docs`, activable por `SWAGGER_ENABLED` | [src/main.ts](../../src/main.ts) |

### Magnitudes del repositorio

| Elemento | Cantidad |
| --- | ---: |
| Módulos de dominio (`src/modules/*`) | 19 |
| Clases de controlador | 34 (en 22 archivos `*.controller.ts`) |
| Rutas HTTP registradas por NestJS | 189 |
| Modelos Sequelize | 58 (más `index.ts`) |
| Migraciones | 11 |
| Conjuntos de *seeds* | 2 (`boot`, `mockup`) |
| Workers | 1 (`outbox`) |
| Suites de prueba unitaria | 41 (290 pruebas) |
| Suites de prueba e2e | 2 (8 pruebas) |

### Ambientes e infraestructura

- **Local:** `docker-compose.yml` levanta PostgreSQL 16 y Redis 7; la API se ejecuta con `yarn start:dev`.
- **Contenedor:** `Dockerfile` multi-etapa; `nixpacks.toml` se conserva pero el despliegue actual usa el Dockerfile (commit `22b5a19`).
- **Plataformas de despliegue referenciadas:** `render.yaml` (Render) y una VPS con Docker.
- **Base gestionada:** Neon (PostgreSQL); existe un job de respaldo (`scripts/backup-to-neon.js`, workflow `neon-backup.yml`).
- **Trazas:** `docker-compose.jaeger.yml` levanta Jaeger; `infra/otel-collector` contiene la configuración del colector.

---

## 2. Resultado de la línea base

Todos los comandos se ejecutaron sobre el commit `3580196` con `node_modules` instalado desde `yarn.lock`.

| # | Comando | Resultado inicial | Resultado final | Duración |
| --- | --- | --- | --- | ---: |
| 1 | `yarn install` | ✅ Correcto | ✅ Correcto | 11,7 s |
| 2 | `yarn typecheck` | ✅ Correcto | ✅ Correcto | 4,5 s |
| 3 | `yarn lint` | ✅ Correcto | ✅ Correcto | 13,7 s |
| 4 | `yarn test --runInBand` | ✅ 41 suites, 290 pruebas | ✅ 41 suites, 290 pruebas | 13,5 s |
| 5 | `yarn test:e2e` | ❌ **2 de 8 pruebas fallan** | ✅ 2 suites, 8 pruebas | 13,7 s |
| 6 | `yarn build` | ✅ Correcto | ✅ Correcto | 8,9 s |
| 7 | `yarn check:secrets` | ✅ Sin secretos evidentes | ✅ Sin secretos evidentes | < 1 s |
| 8 | `yarn check:repository` | ✅ Correcto | ✅ Correcto | < 1 s |
| 9 | `yarn check:validation-strict` | ✅ Rechaza propiedades no declaradas | ✅ Correcto | 2 s |
| 10 | `yarn audit:dependencies` | ❌ **No arranca** (`EINVAL`) | ✅ 0 críticas/altas | 3 s |
| 11 | `yarn verify:ci` | ✅ Correcto | ✅ Correcto | 62 s |
| 12 | Generación de OpenAPI | ⚠️ No existía | ✅ 189 operaciones | 16 s |

### Comandos que no forman parte de la puerta de calidad

Se documentan porque existen y porque su ausencia en `verify:ci` es una decisión, no un olvido:

- `yarn smoke:deep*` — pruebas de humo contra una instancia en ejecución. Requieren API arrancada y credenciales; no se ejecutan en CI.
- `yarn verify:jaeger` — verifica la instrumentación automática de OpenTelemetry contra un Jaeger real. Requiere Docker y un proceso en marcha.
- `yarn db:*` — migraciones y *seeds*. Se validan ejecutándolos contra una base real, no desde Jest.

---

## 3. Fallos encontrados y su resolución

La regla 4 del plan exige corregir cada fallo o registrarlo como deuda bloqueante. Se encontraron
**cuatro defectos reales**; los cuatro están corregidos y verificados.

### B-01 · `yarn audit:dependencies` no podía ejecutarse en Windows — **CORREGIDO**

- **Síntoma:** `Dependency audit could not start: spawnSync yarn.cmd EINVAL`, salida 2.
- **Causa:** desde Node 20.12, `spawnSync` rechaza ejecutar archivos `.cmd` sin `shell: true`
  (endurecimiento por CVE-2024-27980). El script invocaba `yarn.cmd` directamente.
- **Impacto:** la auditoría de dependencias de producción **nunca se ejecutó en una máquina Windows**.
  Enmascaró los hallazgos B-02.
- **Corrección:** [scripts/audit-production-dependencies.js](../../scripts/audit-production-dependencies.js)
  pasa `shell: true` en `win32`.
- **Verificación:** `node scripts/audit-production-dependencies.js` ejecuta y reporta.

### B-02 · Cuatro vulnerabilidades altas en dependencias de producción — **CORREGIDO**

Reveladas en cuanto B-01 quedó resuelto.

| Paquete | Versión | Ruta de producción | Aviso | Corrección |
| --- | --- | --- | --- | --- |
| `brace-expansion` | 1.1.15 | `sequelize-typescript > glob > minimatch > brace-expansion` | CVE-2026-13149, CVE-2026-14257 y bypass posterior: denegación de servicio por expansión exponencial y consumo de memoria no acotado | Resolución a `^1.1.18` |
| `fast-xml-parser` | 5.9.3 | `@google-cloud/storage > fast-xml-parser` | Declaraciones `DOCTYPE` repetidas reinician los límites de expansión de entidades | Resolución a `^5.10.1` |

- **Corrección:** entradas dirigidas en `resolutions` de [package.json](../../package.json). Se usan
  rutas específicas (`@google-cloud/storage/fast-xml-parser`, `sequelize-typescript/**/brace-expansion`)
  en lugar de una resolución global, porque el árbol contiene además `brace-expansion` 2.x y 5.x en
  dependencias de desarrollo y forzarlas a la línea 1.x las rompería.
- **Verificación:** `yarn audit:dependencies` → `0 high/critical, 4 moderate findings`.

### B-03 · La suite e2e nunca había podido ejecutarse — **CORREGIDO**

- **Síntoma:** `TypeError: (0, supertest_1.default) is not a function` en las dos pruebas de
  `test/auth.e2e-spec.ts`.
- **Causa:** `tsconfig.json` activa `allowSyntheticDefaultImports` pero **no** `esModuleInterop`.
  La primera opción sólo afecta a la comprobación de tipos; sin la segunda, TypeScript emite
  `supertest_1.default`, que en el módulo CommonJS de `supertest` es `undefined`. El error es de
  ejecución, así que ni `yarn typecheck` ni `yarn lint` lo detectaban.
- **Impacto:** **BLOQUEANTE.** La única prueba e2e de autenticación llevaba sin ejercitarse un tiempo
  indeterminado, y `verify:ci` no la invoca, así que CI tampoco lo delataba.
- **Corrección:** [test/auth.e2e-spec.ts](../../test/auth.e2e-spec.ts) usa `import * as request from 'supertest'`.
  Se optó por el arreglo local en vez de activar `esModuleInterop` globalmente: ese cambio altera la
  semántica de todos los imports del proyecto y merece su propia decisión (ver
  [ADR-0015](../adr/ADR-0015-interoperabilidad-de-modulos.md)).
- **Verificación:** `yarn test:e2e` → 2 suites, 8 pruebas, todas correctas.

### B-04 · `docker-compose` publicaba PostgreSQL en un puerto ya ocupado — **CORREGIDO**

- **Síntoma:** `SequelizeConnectionError: la autentificación password falló para el usuario "corazon"`,
  pese a que `docker exec … psql -U corazon` funcionaba dentro del contenedor.
- **Causa:** en la máquina de referencia hay una instalación nativa de PostgreSQL escuchando en el
  5432. Docker publica el mapeo igualmente, sin advertir del conflicto, y las conexiones desde el
  host terminan en el servidor equivocado.
- **Impacto:** cualquier prueba que necesite base de datos falla con un error de credenciales que
  apunta en la dirección contraria y consume tiempo de diagnóstico.
- **Corrección:** [docker-compose.yml](../../docker-compose.yml) admite `POSTGRES_HOST_PORT` y
  `REDIS_HOST_PORT`. Documentado en [Configuración del entorno local](../getting-started/local-setup.md).
- **Verificación:** `POSTGRES_HOST_PORT=55432 docker compose up -d postgres` y conexión correcta.

---

## 4. Riesgo residual aceptado

### R-01 · `uuid` 9.0.1 con aviso de severidad moderada

- **Ruta:** `@google-cloud/storage > gaxios > uuid`.
- **Aviso:** falta de comprobación de límites del buffer en `v3`/`v5`/`v6` **cuando se pasa el
  argumento `buf`**. Corregido en `uuid >= 11.1.1`.
- **Por qué se acepta:** `gaxios` usa exclusivamente `v4()` y sin argumento `buf`
  (`node_modules/gaxios/build/src/gaxios.js:417`, único punto de uso). La rama vulnerable no es
  alcanzable desde este backend.
- **Por qué no se fuerza la actualización:** subir `uuid` de la línea 9 a la 11 dentro de `gaxios`
  mediante una resolución cambia una dependencia transitiva de la ruta de subida de archivos, que no
  está cubierta por pruebas automáticas. El riesgo de regresión en producción supera al de un aviso
  no alcanzable.
- **Revisión:** se reevalúa cuando `@google-cloud/storage` actualice `gaxios`. Seguimiento en
  [dependency-security.md](../security/dependency-security.md).

---

## 5. Reproducir esta línea base

```bash
# 1. Dependencias exactas
yarn install --frozen-lockfile

# 2. Puerta de calidad completa (la misma que ejecuta CI)
yarn verify:ci

# 3. Auditoría de dependencias de producción
yarn audit:dependencies

# 4. Pruebas e2e (necesitan PostgreSQL)
#    Si el 5432 está ocupado, elige otro puerto de host:
POSTGRES_HOST_PORT=55432 docker compose up -d postgres redis
DATABASE_HOST=localhost DATABASE_PORT=55432 DATABASE_NAME=corazon_migrante \
DATABASE_USER=corazon DATABASE_PASSWORD=corazon DATABASE_SSL=false REDIS_ENABLED=false \
yarn test:e2e

# 5. Contrato OpenAPI (no necesita base de datos)
yarn docs:openapi:generate
yarn docs:validate
```

---

## 6. Criterio de salida de la Fase 0

| Criterio | Estado |
| --- | --- |
| Repositorio instalable desde el lockfile | ✅ |
| Compilación, lint y tipos correctos | ✅ |
| Pruebas unitarias correctas | ✅ 290/290 |
| Pruebas e2e correctas | ✅ 8/8 tras corregir B-03 |
| Auditoría de dependencias operativa y sin hallazgos altos | ✅ tras corregir B-01 y B-02 |
| Comandos reales documentados | ✅ sección 5 |
| Fallos corregidos o registrados con causa e impacto | ✅ B-01 a B-04 corregidos; R-01 aceptado con evidencia |

**Fase 0 cerrada.** Ningún fallo quedó silenciado.
