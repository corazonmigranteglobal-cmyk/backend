# Phase 2 — Configuration and lifecycle

## Implemented controls

- Environment values have explicit ranges and cross-field validation.
- Production CORS requires an HTTPS allow-list and rejects wildcards.
- Request-body size is bounded before Nest parses JSON or form payloads.
- Swagger is disabled by default in production.
- PostgreSQL pool, acquisition, statement and idle-transaction timeouts are configurable.
- PostgreSQL TLS verifies the server certificate by default; an optional CA is supplied as Base64.
- Runtime defaults no longer execute schema bootstrap or CMS seeds automatically.
- Redis uses bounded command/connect timeouts and SCAN plus UNLINK instead of KEYS.
- Redis, Nest and database lifecycle hooks are enabled for controlled shutdown.
- Pino writes to stdout by default and closes an explicitly configured file destination.
- Explicit GCS production credentials use `GOOGLE_CREDENTIALS_BASE64`; Application Default Credentials remain supported through `GCS_USE_ADC=true`.

## Deployment-impact notes

Production must explicitly provide:

- an HTTPS `CORS_ORIGINS` allow-list;
- an HTTPS `PUBLIC_BASE_URL`;
- a dedicated `DATABASE_NAME` other than `postgres`;
- different JWT access and refresh secrets;
- Cloudinary credentials or the approved GCS credential strategy.

`DATABASE_SSL_REJECT_UNAUTHORIZED=false` is retained only as an explicit compatibility escape hatch. Its use must be recorded as a residual security risk and removed after the correct CA chain is available.
