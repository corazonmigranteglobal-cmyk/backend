# SECURITY.md — Hardening y Privacidad

## Autenticación

- **JWT** access token: expiración 15 minutos.
- **Refresh token**: 7 días, almacenado hasheado (SHA-256) en DB.
- **Rotación**: cada refresh invalida el token anterior y emite uno nuevo.
- **Detección de reuso**: si un token ya rotado se vuelve a usar → se revocan todos los tokens de la familia (indica robo de token).

## Rate limiting

| Endpoint                      | Límite           |
|-------------------------------|------------------|
| `POST /auth/login`            | 5 req / minuto   |
| `POST /auth/register/*`       | 5 req / hora     |
| `POST /auth/password-reset/*` | 3–5 req / 15 min |
| Resto de endpoints            | 120 req / minuto (global) |

Configuración vía variables de entorno: `THROTTLER_TTL_MS`, `THROTTLER_LIMIT`.

## Prevención de DoS con bcrypt

Todos los DTOs con campos de texto usan `@MaxLength()` para limitar strings antes
de que lleguen a bcrypt, evitando ataques de CPU exhaustion.

## Privacidad de notas clínicas

`notesForTherapist` es comunicación privada paciente → terapeuta. Los endpoints
administrativos la excluyen explícitamente:

```typescript
const ADMIN_APPOINTMENT_ATTRIBUTES = { exclude: ['notesForTherapist'] };
// Aplicado en adminList() y adminUpdate() de AppointmentsService
```

Los admins pueden leer y escribir `adminNotes` (sus propias notas) pero NUNCA
`notesForTherapist`.

## Prevención de colisiones de citas

La verificación de disponibilidad usa `SELECT … FOR UPDATE` dentro de la transacción:

```typescript
// scheduling.service.ts — isSlotAvailable()
const lockOpts = transaction
  ? { transaction, lock: Transaction.LOCK.UPDATE }
  : {};
```

Esto serializa bookings concurrentes para el mismo slot a nivel de base de datos.

## Headers de seguridad

Configurados vía `helmet()` en `main.ts`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Content-Security-Policy` activo

## RBAC

- Roles: `PATIENT`, `THERAPIST`, `ADMIN`, `SUPER_ADMIN`, `CONTADOR`
- Permisos asignados a roles en DB, verificados por `PermissionsGuard`
- Decoradores: `@Roles(...)` y `@Permissions(...)` en cada endpoint sensible
- Endpoints públicos marcados con `@Public()`

## Variables de entorno sensibles

Ver `.env.example` para la lista completa. Nunca commitear `.env` real.
Las variables críticas son:
- `JWT_SECRET` — debe ser aleatoria, ≥ 32 caracteres
- `JWT_REFRESH_SECRET` — distinto al anterior
- `DATABASE_URL` — incluye credenciales
- `REDIS_URL` — incluye contraseña si aplica
