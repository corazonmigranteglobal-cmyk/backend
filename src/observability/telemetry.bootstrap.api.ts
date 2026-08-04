// El SDK lee su configuración de `process.env`, así que el `.env` debe estar
// cargado antes. `main.ts` también lo importa; `dotenv` es idempotente.
import 'dotenv/config';
import { startTelemetry } from './telemetry.bootstrap';
import { SERVICE_NAME_API } from './telemetry.constants';

/**
 * Módulo de efecto lateral: debe ser la PRIMERA importación de `src/main.ts`.
 *
 * TypeScript compila a CommonJS y eleva todos los `import` a `require` en orden,
 * así que el único modo fiable de parchear las librerías antes de que NestJS,
 * Express, Sequelize, pg, ioredis o Pino se carguen es que el arranque ocurra
 * dentro del propio módulo importado en primera posición.
 */
startTelemetry({ serviceName: process.env.OTEL_SERVICE_NAME?.trim() || SERVICE_NAME_API });
