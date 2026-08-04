# Variables de entorno

La configuración se valida con Joi en [`src/config/env.validation.ts`](../../src/config/env.validation.ts)
y se resuelve en [`src/config/configuration.ts`](../../src/config/configuration.ts).

**El arranque aborta si falta una variable obligatoria o si un valor no cumple su formato**, y el
error indica el motivo concreto. Es deliberado: es preferible no arrancar a arrancar mal configurado
y descubrirlo en producción.

## Aplicación

| Variable | Por defecto | Notas |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3000` | |
| `API_PREFIX` | `api/v1` | `/health` queda fuera de este prefijo |
| `CORS_ORIGINS` | `http://localhost:5173` | Lista separada por comas |
| `HTTP_BODY_LIMIT` | `1mb` | Formato `\d+(kb\|mb)` |
| `TRUST_PROXY_HOPS` | `1` | Saltos de proxy de confianza; afecta a la IP que ve el limitador |
| `SWAGGER_ENABLED` | *(según entorno)* | En producción es `false` salvo que se ponga `true` |
| `LOG_LEVEL` | `info` | `debug` y `trace` activan el volcado de cuerpos en los logs |

## Base de datos (obligatorias)

`DATABASE_HOST`, `DATABASE_NAME`, `DATABASE_USER` y `DATABASE_PASSWORD` no tienen valor por defecto.

| Variable | Por defecto | Notas |
| --- | --- | --- |
| `DATABASE_PORT` | `5432` | |
| `DATABASE_SSL` | `false` | `DATABASE_SSL_CA_BASE64` admite una CA propia |
| `DATABASE_STATEMENT_TIMEOUT_MS` | `30000` | Corta consultas que se van de las manos |
| `DATABASE_IDLE_TRANSACTION_TIMEOUT_MS` | `30000` | Evita transacciones abiertas indefinidamente |
| `DATABASE_POOL_MAX` / `_MIN` | `10` / `0` | |
| `DATABASE_MIGRATE_ON_STARTUP` | `true` | |
| `DATABASE_SEED_BOOT_ON_STARTUP` | `true` | Roles y permisos imprescindibles |
| `DATABASE_SEED_MOCKUP_ON_STARTUP` | *(no en producción)* | Datos de maqueta |
| `DATABASE_BOOTSTRAP_FAIL_FAST` | `true` | Si el bootstrap falla, no se acepta tráfico |

## Redis

| Variable | Por defecto | Notas |
| --- | --- | --- |
| `REDIS_ENABLED` | `true` | `false` desactiva el módulo por completo |
| `REDIS_URL` | — | Alternativa a los parámetros sueltos; admite `rediss://` |
| `REDIS_PATTERN_DELETE_MAX_KEYS` | `10000` | Tope de una invalidación por patrón |

## Autenticación

| Variable | Por defecto | Notas |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | **obligatoria** | |
| `JWT_REFRESH_SECRET` | **obligatoria** | Debe ser distinta de la anterior |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_EXPIRES_DAYS` | `30` | |
| `BCRYPT_ROUNDS` | `12` | |
| `PASSWORD_RESET_EXPIRY_MINUTES` | `15` | |

## Límite de peticiones

| Variable | Por defecto |
| --- | --- |
| `THROTTLER_TTL_MS` | `60000` |
| `THROTTLER_LIMIT` | `120` |

Las rutas sensibles declaran límites propios más estrictos con `@Throttle`.

## Archivos

`STORAGE_PROVIDER` (`GCS` \| `CLOUDINARY`, por defecto `CLOUDINARY`) decide qué bloque aplica.

| Variable | Notas |
| --- | --- |
| `MAX_UPLOAD_MB` | `8` por defecto |
| `FILE_SIGNED_URL_EXPIRES_SECONDS` | `900` por defecto |
| `GCS_BUCKET_NAME_USER_MEDIA` / `_PUBLIC_ASSETS` | Buckets separados a propósito |
| `GOOGLE_CREDENTIALS_BASE64` | Credenciales en base64; nunca se registran en logs |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | |
| `GCS_UPLOAD_FALLBACK_TO_LOCAL` | En producción hay que activarlo explícitamente |

## Correo

| Variable | Por defecto | Notas |
| --- | --- | --- |
| `EMAIL_PROVIDER` | `DEV_NULL` | **No se envía correo real** salvo que se cambie |
| `SENDGRID_API_KEY` | — | Obligatoria si el proveedor es SendGrid |
| `EMAIL_FROM_EMAIL` | — | Obligatoria si el proveedor es SendGrid |

## Outbox

| Variable | Por defecto | Notas |
| --- | --- | --- |
| `OUTBOX_WORKER_ENABLED` | `true` | |
| `OUTBOX_BATCH_SIZE` | `50` | |
| `OUTBOX_RETRY_BASE_DELAY_MS` | `30000` | Retroceso exponencial hasta `OUTBOX_RETRY_MAX_DELAY_MS` |
| `OUTBOX_STALE_LOCK_MS` | `300000` | Libera lotes de un worker que murió |

## Observabilidad

Las variables `OTEL_*` se resuelven en
[`src/observability/telemetry.config.ts`](../../src/observability/telemetry.config.ts). Ver
[trazas](../observability/tracing.md).

## Gestión de secretos

Ningún secreto se versiona. `yarn check:secrets` recorre los archivos versionables buscando
patrones de credencial y forma parte de `verify:ci`. Ver
[gestión de secretos](../security/secrets-management.md).
