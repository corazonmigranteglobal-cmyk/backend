# Hotfix Public CMS Endpoints

Este hotfix abre endpoints de lectura pública para CMS/vistas públicas sin tocar auth, roles ni permisos de administración.

## Rutas públicas recomendadas para frontend

### Vista por slug
`GET /api/v1/public/pages/:slug`

### Vista por ID
`GET /api/v1/public/pages/by-id/:id`

### Elemento por slug de página y código
`GET /api/v1/public/pages/:slug/elements/:code`

### Elemento por ID directo
`GET /api/v1/public/page-elements/:id`

### Alias compatible con nombre de dominio "vistas públicas"
`GET /api/v1/public-views/:id`
`GET /api/v1/public-views/:id/elements/:code`

## Seguridad

Las rutas son públicas solo para lectura y filtran datos publicados/activos:

- `cms_pages.status = 'PUBLISHED'`
- `cms_elements.status = 'ACTIVE'`

Las rutas admin siguen protegidas:

- `POST /api/v1/admin/cms/pages`
- `POST /api/v1/admin/cms/pages/:pageId/elements`
