# Seeds necesarios para que el frontend no falle

Este paquete contiene un seeder idempotente para Corazón Migrante Backend.

## Archivo principal

Copiar este archivo dentro del backend:

```txt
src/database/seeders/20260704130000-front-required-public-data.js
```

Luego ejecutar:

```powershell
yarn db:seed
```

## Qué garantiza

El seeder deja listos los datos mínimos que el frontend consume:

### Landing pública

- `GET /api/v1/public-views/1`
- `GET /api/v1/public/pages/inicio`
- `GET /api/v1/public/pages/inicio/elements/hero`

### Biblioteca pública

- `GET /api/v1/public/pages/biblioteca`
- `GET /api/v1/public/pages/biblioteca/elements/hero`
- `GET /api/v1/public-views/2`

### Contenido editorial público

- `GET /api/v1/publications/news`
- `GET /api/v1/publications/columns`
- `GET /api/v1/publications/categories`
- `GET /api/v1/publications/tags`

### Publicidad pública

- `GET /api/v1/advertising/placements`
- `GET /api/v1/advertising/slots?placementCode=home_hero`

### Homepage interna del módulo Newspaper absorbido

- `GET /api/v1/homepage`

### Booking y catálogo público

- `GET /api/v1/therapy/approaches`
- `GET /api/v1/therapy/products`
- `GET /api/v1/booking/availability`

### Login demo

Crea/activa estos usuarios si no existen:

```txt
admin@corazonmigrante.test      Demo123456!
paciente@corazonmigrante.test   Demo123456!
terapeuta@corazonmigrante.test  Demo123456!
```

## Variables de producción recomendadas

```env
DATABASE_SSL=false
DATABASE_BOOTSTRAP_ON_STARTUP=true
DATABASE_BOOTSTRAP_FAIL_FAST=true
DATABASE_SEED_PUBLIC_CMS_ON_STARTUP=true
```

## Validación después de sembrar

En el backend:

```powershell
yarn db:seed
```

En el frontend:

```powershell
yarn check:public-endpoints
```

En VPS:

```bash
curl -i https://api.corazondemigrante.com/api/v1/public-views/1
curl -i https://api.corazondemigrante.com/api/v1/public/pages/biblioteca
curl -i https://api.corazondemigrante.com/api/v1/public/pages/biblioteca/elements/hero
curl -i https://api.corazondemigrante.com/api/v1/publications/news
curl -i https://api.corazondemigrante.com/api/v1/advertising/placements
curl -i https://api.corazondemigrante.com/api/v1/homepage
```

## Nota importante

Este seed no reemplaza migraciones. Si faltan tablas, primero ejecuta migraciones o deja activo el bootstrap idempotente del backend.
