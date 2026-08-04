# Corazón Migrante — Backend

API REST para la plataforma de psicología online Corazón Migrante.
Construida con NestJS 10, Sequelize, PostgreSQL y Redis.

## Arranque rápido

```bash
# Dependencias
yarn install

# Variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Migraciones (aplicar esquema)
npx sequelize-cli db:migrate

# Desarrollo (aplica seeds automáticamente al iniciar)
yarn start:dev

# Producción
yarn build && yarn start:prod
```

Swagger disponible en `http://localhost:<PORT>/api/docs`

## Documentación

| Archivo            | Contenido                                              |
|--------------------|--------------------------------------------------------|
| ARCHITECTURE.md    | Módulos, flujos principales, patrones usados           |
| EVENTS.md          | Sistema de notificaciones y domain events (SSE)        |
| SECURITY.md        | Auth, RBAC, rate limiting, privacidad clínica          |
| SEEDING.md         | Estrategia de migraciones y seeds, arranque desde cero |
| TRACKING.md        | Analítica de comportamiento (visits + UI events)       |
| DESIGN.md          | Decisiones de arquitectura y trade-offs                |
| docs/observability/ | Trazabilidad distribuida (OpenTelemetry → OTLP → Jaeger) |

## Variables de entorno clave

Ver `.env.example` para la lista completa. Las mínimas:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/corazon_migrante
REDIS_URL=redis://localhost:6379
JWT_SECRET=<aleatorio_32+_chars>
JWT_REFRESH_SECRET=<distinto_al_anterior>
PORT=3000
NODE_ENV=development
```

## Comandos útiles

```bash
# Tests
yarn test                  # todos los specs
yarn test:cov              # con cobertura

# Lint
yarn lint                  # revisar
yarn lint --fix            # autofix

# TypeScript
npx tsc --noEmit           # verificar tipos

# Migraciones
npx sequelize-cli db:migrate          # aplicar pendientes
npx sequelize-cli db:migrate:undo     # revertir última
npx sequelize-cli db:migrate:status   # ver estado

# Observabilidad (trazas)
yarn jaeger:up             # Jaeger local, UI en http://localhost:16686
yarn verify:jaeger         # verificación end-to-end de una traza real
yarn jaeger:down           # apagar
```

## Stack

- **NestJS v10** — framework modular
- **Sequelize 6** — ORM con soporte de migraciones y transacciones
- **PostgreSQL 15** — base de datos principal
- **Redis 7** — caché y sesiones
- **JWT** — autenticación con refresh token rotativo
- **Pino** — logging estructurado JSON
- **Swagger/OpenAPI** — documentación automática de la API
- **OpenTelemetry** — trazabilidad distribuida vía OTLP (Jaeger en desarrollo,
  OpenTelemetry Collector en producción). Desactivada por defecto:
  `OTEL_ENABLED=true` para habilitarla. Ver [docs/observability/](docs/observability/README.md)
- **Jest + ts-jest** — pruebas unitarias

## Seguridad implementada

- Lock pesimista en creación de citas (SELECT … FOR UPDATE)
- Notas clínicas excluidas de endpoints admin
- Rate limiting por endpoint (throttler configurable)
- @MaxLength en todos los DTOs (prevención DoS bcrypt)
- RBAC granular (roles + permisos)
- Refresh token rotation con detección de reuso

## Notificaciones en tiempo real

Los administradores reciben notificaciones push vía SSE al conectarse a
`GET /api/v1/admin/notifications/stream`. Nuevas citas, cambios de estado
y otros eventos del dominio aparecen instantáneamente en el panel.
