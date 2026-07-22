# TRACKING.md — Analítica y Comportamiento

## Módulo Analytics

El módulo `analytics` provee dos tipos de tracking, ambos orientados a privacidad:

### 1. Visitas públicas (`public_visits`)

Registra visitas a páginas públicas sin identificar al usuario.

```typescript
// AnalyticsService.trackVisit()
await analyticsService.trackVisit({
  path: '/terapia',
  ip: '1.2.3.4',       // se hashea con SHA-256
  userAgent: '...',    // se hashea con SHA-256
  referrer: 'https://google.com',
});
```

**Campos almacenados:**
- `path` — ruta visitada
- `ipHash` — SHA-256 del IP (nunca el IP en claro)
- `uaHash` — SHA-256 del User-Agent
- `referrer` — dominio de referencia
- `createdAt` — timestamp

### 2. Eventos UI (`ui_events`)

Registra acciones específicas del usuario en la interfaz.

```typescript
await analyticsService.trackUiEvent({
  eventName: 'cta_booking_clicked',
  entityType: 'TherapyProduct',
  entityId: 'uuid',
  payload: { productName: 'Terapia individual' },
  userId: 'uuid',  // opcional
});
```

## Endpoints

| Método | Ruta                              | Rol requerido       |
|--------|-----------------------------------|---------------------|
| POST   | `/analytics/visit`                | Público             |
| POST   | `/analytics/event`                | Autenticado         |
| GET    | `/admin/analytics/events`         | ADMIN/SUPER_ADMIN   |
| GET    | `/admin/analytics/visits`         | ADMIN/SUPER_ADMIN   |

## Privacidad

- IPs y User-Agents nunca se almacenan en claro.
- No se usan cookies de seguimiento externas.
- Los eventos UI con `userId` permiten análisis de funnel para usuarios autenticados.

## Extensión futura

Para agregar nuevos eventos, basta con llamar `trackUiEvent()` desde el frontend
con un `eventName` descriptivo. No se requieren cambios en el backend.
