# Puesta en marcha local

## Requisitos

| Herramienta | Versión | Comprobación |
| --- | --- | --- |
| Node.js | `>=20 <27` (probado con 22.23) | `node -v` |
| Yarn | 1.22.x (fijado en `packageManager`) | `yarn -v` |
| Docker | Para PostgreSQL y Redis | `docker --version` |

## 1. Dependencias

```bash
yarn install --frozen-lockfile
```

## 2. Servicios de datos

```bash
docker compose up -d postgres redis
```

!!! warning "Si el puerto 5432 ya está ocupado"
    Una instalación nativa de PostgreSQL se queda con el 5432 y Docker **no avisa del conflicto**:
    publica el mapeo igualmente y tus conexiones acaban en el servidor equivocado, con un error de
    credenciales que apunta en la dirección contraria. Usa otro puerto de host:

    ```bash
    POSTGRES_HOST_PORT=55432 REDIS_HOST_PORT=56379 docker compose up -d postgres redis
    ```

    Y ajusta `DATABASE_PORT=55432` en tu `.env`.

## 3. Variables de entorno

```bash
cp .env.example .env
```

Como mínimo hay que rellenar `DATABASE_*`, `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`. La
validación de entorno (`Joi`) aborta el arranque si falta algo obligatorio, e indica el motivo
exacto. Detalle completo en [variables de entorno](environment-variables.md).

## 4. Esquema y datos

Al arrancar, la API ejecuta migraciones y *seeds* de forma idempotente. Para hacerlo a mano:

```bash
yarn db:deploy              # sólo migraciones
yarn db:seed:boot           # datos imprescindibles (roles, permisos)
yarn db:seed:mockup         # datos de maqueta para desarrollo
```

## 5. Arrancar

```bash
yarn start:dev
```

- API: `http://localhost:3000/api/v1`
- Sonda de salud: `http://localhost:3000/health` (fuera del prefijo, a propósito)
- Referencia interactiva: `http://localhost:3000/docs`

## 6. Verificar

```bash
yarn verify:ci   # higiene, secretos, validación estricta, lint, tipos, pruebas y build
```

Las pruebas e2e necesitan base de datos:

```bash
DATABASE_HOST=localhost DATABASE_PORT=55432 DATABASE_NAME=corazon_migrante \
DATABASE_USER=corazon DATABASE_PASSWORD=corazon DATABASE_SSL=false REDIS_ENABLED=false \
yarn test:e2e
```

## 7. Documentación

```bash
yarn docs:openapi:generate   # regenera el contrato (no necesita base de datos)
yarn docs:validate           # lint del contrato, cobertura y enlaces
```
