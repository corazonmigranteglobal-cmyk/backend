# ARCHITECTURE.md — Corazón Migrante Backend

## Stack

| Capa              | Tecnología                                     |
|-------------------|------------------------------------------------|
| Runtime           | Node.js 20 + TypeScript 5                      |
| Framework         | NestJS v10 (monolito modular)                  |
| ORM               | Sequelize v6 + sequelize-typescript            |
| Base de datos     | PostgreSQL 15                                  |
| Caché / sesiones  | Redis 7                                        |
| Auth              | JWT (access 15 min) + Refresh token rotativo   |
| Logging           | Pino (JSON estructurado)                       |
| Documentación API | Swagger / OpenAPI (disponible en /api/docs)    |
| Tests             | Jest + ts-jest                                 |
| Rate limiting     | @nestjs/throttler con configuración por endpoint|

## Módulos principales

```
src/
├── common/           # Guards, decorators, tipos compartidos, paginación
├── config/           # configuration.ts, env.validation.ts
├── database/         # DatabaseModule (Sequelize), bootstrap idempotente, seeders
├── infrastructure/   # RedisModule
├── modules/
│   ├── auth/         # JWT, refresh tokens, registro, reset de contraseña
│   ├── users/        # Perfiles (paciente/terapeuta/admin), avatar
│   ├── roles-permissions/ # RBAC: roles, permisos, asignación
│   ├── appointments/ # Citas: creación (lock pesimista), estados, pagos
│   ├── scheduling/   # Disponibilidad, horarios, bloqueos
│   ├── therapy-catalog/ # Enfoques y productos terapéuticos
│   ├── notifications/ # Admin notifications + SSE stream
│   ├── messaging/    # Outbox pattern para emails
│   ├── analytics/    # Visitas públicas, eventos UI
│   ├── cms/          # Páginas CMS con elementos
│   ├── content/      # Publicaciones, autores, categorías, suscriptores
│   ├── advertising/  # Empresas, campañas, creativos, impresiones
│   ├── files/        # Assets (Cloudinary), acceso controlado
│   ├── accounting/   # Contabilidad: cuentas, transacciones, asientos
│   ├── homepage/     # Secciones y featured items de la portada
│   ├── audit/        # Log inmutable de acciones del sistema
│   └── health/       # Health check endpoint
└── workers/
    └── outbox.worker.ts  # Procesa mensajes pendientes del outbox
```

## Flujo de autenticación

```
POST /auth/login
  → AuthService.login()
  → Valida email/password (bcrypt)
  → Genera accessToken (15 min) + refreshToken (7 días)
  → Guarda RefreshToken en DB (hasheado)

POST /auth/refresh
  → Verifica refreshToken en DB
  → Rota: invalida el anterior, genera nuevo par
  → Detecta reuso sospechoso (token ya usado → revoca familia)
```

## Creación de citas (prevención de colisiones)

```
POST /appointments
  → AppointmentsService.create()
  → BEGIN TRANSACTION
    → isSlotAvailable() con SELECT … FOR UPDATE (lock pesimista)
    → Si disponible: INSERT appointment + historial + audit + email
  → COMMIT
  → emit() dominio → NotificationsService (SSE push a admins)
```

## Sistema de notificaciones admin

```
NotificationsService.emit(event)
  → INSERT admin_notifications
  → Subject.next(event)  ← RxJS bus en memoria

GET /admin/notifications/stream  (SSE)
  → Observable del Subject
  → Clientes admin reciben push en tiempo real
```

## Patrones de seguridad

- `@MaxLength()` en todos los DTOs para prevenir DoS con bcrypt
- `@Throttle()` en endpoints públicos (login: 5/min, registro: 5/h)
- `ADMIN_APPOINTMENT_ATTRIBUTES` excluye `notesForTherapist` de queries admin
- Helmet CSP activo
- Tokens de refresh hasheados en DB
- RBAC: `@Roles()` + `@Permissions()` verificados por guards globales
