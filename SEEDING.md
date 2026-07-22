# SEEDING.md — Estrategia de Migraciones y Seeds

## Migraciones

Las migraciones usan **sequelize-cli** y son **idempotentes** (usan `IF NOT EXISTS`,
`IF EXISTS`, `to_regclass()`).

```bash
# Aplicar migraciones pendientes
npx sequelize-cli db:migrate

# Revertir la última migración
npx sequelize-cli db:migrate:undo

# Ver estado
npx sequelize-cli db:migrate:status
```

Orden de migraciones (por timestamp en nombre de archivo):
1. `20260628000000-init-schema.js` — Esquema completo inicial
2. `20260702010000-integrate-newspaper-content-advertising-homepage.js`
3. `20260704165000-fix-pivot-uuid-defaults-and-unique-indexes.js`
4. `20260705020000-schema-compatibility-and-premium-news.js`
5. `20260706193000-content-subscribers-patient-link-backfill.js`
6. `20260706212000-advertising-page-targets.js`
7. `20260710120000-appointment-payment-and-sale-link.js`
8. `20260710121000-content-subscriber-pending-status.js`
9. `20260720000001-admin-notifications.js` — Tabla de notificaciones admin

## Seeds

Seeds gestionados por el `DatabaseBootstrapService` al arrancar la app.
Son **idempotentes** (verifican existencia antes de insertar).

### Boot seeds (todos los entornos)
`src/database/seeders/boot/`
- `20260704130000-front-required-public-data.js` — RBAC (roles/permisos), usuario admin,
  catálogo terapéutico, páginas CMS requeridas, homepage.

### Mockup seeds (solo desarrollo)
`src/database/seeders/mockup/`
- `20260628010000-demo-data.js` — Usuarios y citas demo
- `20260702011000-seed-content-advertising-demo.js` — Contenido y publicidad demo

## Arranque limpio desde cero

```bash
# 1. Crear base de datos (si no existe)
psql -U postgres -c "CREATE DATABASE corazon_migrante;"

# 2. Instalar dependencias
yarn install

# 3. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 4. Levantar Redis (si no está corriendo)
docker run -d -p 6379:6379 redis:7-alpine

# 5. Aplicar migraciones
npx sequelize-cli db:migrate

# 6. Levantar la app (aplica seeds automáticamente)
yarn start:dev

# La app aplica boot seeds al iniciar en cualquier entorno.
# En desarrollo aplica mockup seeds también.
```

## Variables requeridas

Ver `.env.example`. Las mínimas para arrancar:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/corazon_migrante
REDIS_URL=redis://localhost:6379
JWT_SECRET=<al_menos_32_caracteres_aleatorios>
JWT_REFRESH_SECRET=<diferente_al_anterior>
PORT=3000
NODE_ENV=development
```
