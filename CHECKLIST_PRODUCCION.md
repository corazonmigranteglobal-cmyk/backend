# Checklist de Producción — Corazón Migrante

Verificar cada punto antes del deploy a producción.

## 1. Variables de entorno

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` apunta a la base de datos de producción
- [ ] `REDIS_URL` apunta al Redis de producción
- [ ] `JWT_SECRET` — string aleatorio ≥ 32 caracteres, diferente al de dev
- [ ] `JWT_REFRESH_SECRET` — string aleatorio ≥ 32 caracteres, diferente al JWT_SECRET
- [ ] `JWT_EXPIRES_IN=15m`
- [ ] `JWT_REFRESH_EXPIRES_IN=7d`
- [ ] `THROTTLER_TTL_MS=60000`
- [ ] `THROTTLER_LIMIT=120`
- [ ] Variables de Cloudinary configuradas (si se usa almacenamiento de archivos)
- [ ] Variables de SendGrid configuradas (si se envían emails)
- [ ] `CORS_ORIGINS` apunta solo al dominio del frontend en producción

## 2. Base de datos

- [ ] Migraciones aplicadas: `npx sequelize-cli db:migrate`
- [ ] Boot seeds aplicados (se aplican automáticamente al iniciar la app)
- [ ] Índices críticos verificados (están incluidos en las migraciones)
- [ ] Backups automáticos configurados en el proveedor de DB
- [ ] `admin_notifications` tabla existe (migración `20260720000001`)

## 3. Seguridad

- [ ] HTTPS activo en producción (certificado SSL válido)
- [ ] Helmet habilitado (está activo por defecto en `main.ts`)
- [ ] CSP configurado para el dominio correcto
- [ ] Rate limiting activo en todos los endpoints públicos
- [ ] `.env` no está commiteado al repositorio
- [ ] `JWT_SECRET` y `JWT_REFRESH_SECRET` son diferentes entre sí y entre entornos

## 4. Funcionalidades críticas

- [ ] Login y registro funcionan
- [ ] Refresh token rota correctamente
- [ ] Reset de contraseña envía email
- [ ] Creación de citas valida disponibilidad (lock pesimista activo)
- [ ] Notificaciones SSE llegan al panel admin
- [ ] Notas clínicas NO aparecen en endpoints admin

## 5. Build

- [ ] `yarn build` completa sin errores
- [ ] `npx tsc --noEmit` sin errores de tipo
- [ ] `yarn lint` sin errores (warnings aceptables)
- [ ] `yarn test` pasa todos los specs

## 6. Frontend (corazonmigranteFrontend)

- [ ] `npx tsc --noEmit` sin errores
- [ ] `NEXT_PUBLIC_API_BASE_URL` apunta al backend de producción
- [ ] Panel admin muestra campana de notificaciones
- [ ] Página `/admin/notificaciones` funciona
- [ ] Login admin funciona con usuario producción

## 7. Infraestructura

- [ ] Redis accesible desde la app en producción
- [ ] Outbox worker procesa mensajes (verificar logs al iniciar)
- [ ] Health check responde: `GET /api/v1/health`
- [ ] Logs visibles y en formato JSON (Pino)
- [ ] Monitoreo de errores configurado (Sentry u otro)

## 8. Primer usuario admin

El seed de boot crea un usuario admin por defecto. **Cambiar la contraseña
inmediatamente después del primer deploy**:

1. Ingresar con las credenciales del seed.
2. Ir a Perfil → Cambiar contraseña.
3. Establecer una contraseña segura (≥ 12 caracteres, mayúsculas, números, símbolos).

## 9. Comandos de verificación post-deploy

```bash
# Verificar que la API responde
curl https://tu-api.com/api/v1/health

# Verificar migraciones aplicadas
npx sequelize-cli db:migrate:status

# Ver logs recientes
# (según el proveedor: Railway, Render, Heroku, etc.)
```

## 10. Rollback

En caso de problema crítico:
```bash
# Revertir la última migración
npx sequelize-cli db:migrate:undo

# Volver al commit anterior
git revert HEAD
git push
```
