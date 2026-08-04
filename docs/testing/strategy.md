# Estrategia de pruebas

## Estado real

| Capa | Suites | Pruebas | En `verify:ci` |
| --- | ---: | ---: | :---: |
| Unitarias | 41 | 290 | Sí |
| e2e | 2 | 8 | **No** — sí en el workflow `docs` |
| Contrato (cobertura OpenAPI) | 1 script | 189 operaciones | Sí, en `docs` |
| Contrato asíncrono (AsyncAPI) | 1 script | 5 tipos de mensaje | Sí, en `docs` |
| Humo contra instancia viva | 8 scripts | — | No |
| Migraciones | — | — | **No** |
| Rendimiento y resiliencia | — | — | No |

## Qué cubre cada capa

### Unitarias

Es donde vive la mayor parte del valor. Cubren en particular las **políticas de dominio**, que es
donde se concentran las reglas difíciles:

| Política | Qué garantiza |
| --- | --- |
| `appointments/policies/status-transition.policy.spec.ts` | Sólo se permiten las transiciones válidas de una cita |
| `content/policies/publication-status.policy.spec.ts` | El ciclo editorial no admite saltos inválidos |
| `advertising/policies/campaign-date.policy.spec.ts` | Una campaña no puede terminar antes de empezar |

También cubren el pipeline transversal: guards, filtro de excepciones, interceptor de respuesta,
redacción de logs y utilidades de paginación.

### e2e

`test/auth.e2e-spec.ts` y `test/observability/observability.e2e-spec.ts`. Levantan la aplicación
completa contra una base real.

!!! danger "Esta suite estuvo rota sin que nadie se enterara"
    `verify:ci` **no invoca `test:e2e`**. Durante un tiempo indeterminado la suite falló al arrancar
    (`supertest_1.default is not a function`) y ningún comando de la puerta de calidad lo detectaba,
    porque el error es de ejecución y ni `typecheck` ni `lint` lo ven.

    Corregido, y ahora el workflow `docs` sí la ejecuta con un PostgreSQL de servicio. Ver
    [ADR-0015](../adr/ADR-0015-interoperabilidad-de-modulos.md) y
    [línea base B-03](../reports/baseline.md).

Además, `test/auth.e2e-spec.ts` configura el `ValidationPipe` con `forbidNonWhitelisted: false`,
mientras que producción usa `true`. **La prueba no ejercita el pipeline real**, así que no puede
detectar una regresión en la validación estricta. Ese hueco lo cubre
`scripts/check-validation-strict.mjs`, que sí corre en `verify:ci`.

### Contrato

Dos comprobaciones que ninguna prueba unitaria puede hacer:

1. **Paridad de rutas** — toda ruta que registra NestJS está en el contrato, y al revés. Una ruta sin
   documentar es una brecha de contrato; una operación documentada que ya no existe es documentación
   muerta.
2. **Calidad por operación** — `operationId` único, `summary`, `description`, etiqueta declarada,
   seguridad y respuesta con esquema.

`scripts/validate-asyncapi.mjs` hace lo equivalente para la mensajería: falla si aparece un
`templateCode` en el código que el contrato no declara. Ya cazó cinco tipos que estaban sin
documentar.

### Humo

`yarn smoke:deep*` ejercita una instancia en marcha con credenciales reales. **No está en CI** y no
debe estarlo: necesita una instancia desplegada y datos. Es una herramienta de verificación de
despliegue, no de integración continua.

## Limitación conocida de las trazas en Jest

Dentro de Jest **no se activan las instrumentaciones automáticas de OpenTelemetry**. Se aplican con
`require-in-the-middle`, que engancha el `require` de Node, y Jest resuelve los módulos con su propio
registro, así que el enganche nunca se dispara. Se verificó empíricamente: cero spans automáticos.

Reparto resultante:

| Herramienta | Qué cubre |
| --- | --- |
| Jest | Código propio: interceptor, filtro, spans de negocio, propagación en el outbox |
| `scripts/verify-jaeger.sh` | Instrumentación automática de extremo a extremo, contra proceso y Jaeger reales |

## Umbrales de cobertura

`jest.config.js` exige 30 % de líneas, funciones y sentencias, y 20 % de ramas. Es un suelo
deliberadamente bajo: existe para impedir un desplome, no para dar por buena la cobertura actual.

Migraciones y *seeders* están excluidos del cálculo: son scripts de `sequelize-cli` que no se
ejecutan desde las pruebas y su peso distorsionaba la métrica sin aportar señal.

## Huecos registrados

| Hueco | Riesgo | Brecha |
| --- | --- | --- |
| `audit`, `homepage` y `notifications` sin suite propia | Comportamiento sólo ejercitado de forma indirecta | [G-27](../reports/documentation-gap-analysis.md) |
| Las migraciones no se ejecutan en CI | Una migración rota se descubre al desplegar | [G-28](../reports/documentation-gap-analysis.md) |
| Sin pruebas de rendimiento ni de resiliencia | No hay línea base de latencia para fijar objetivos | [G-24](../reports/documentation-gap-analysis.md) |
| La e2e no usa la configuración de validación real | No detecta regresiones del pipeline estricto | Cubierto parcialmente por `check:validation-strict` |

## Cómo ejecutarlas

```bash
yarn test                 # unitarias
yarn test:cov             # con cobertura
yarn verify:ci            # la puerta completa (sin e2e)

# e2e: necesitan PostgreSQL
POSTGRES_HOST_PORT=55432 docker compose up -d postgres
DATABASE_HOST=localhost DATABASE_PORT=55432 DATABASE_NAME=corazon_migrante \
DATABASE_USER=corazon DATABASE_PASSWORD=corazon DATABASE_SSL=false REDIS_ENABLED=false \
yarn test:e2e

yarn docs:validate        # contrato, cobertura y enlaces
```
