import type { Instrumentation } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation, ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { TelemetryConfig } from './telemetry.types';

/** Quita el prefijo global (`/api/v1`) para poder comparar rutas como `/health`. */
const API_PREFIX_PATTERN = /^\/api\/v\d+/;

export function isExcludedPath(pathname: string, excludedUrls: readonly string[]): boolean {
  const normalized = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  const withoutPrefix = normalized.replace(API_PREFIX_PATTERN, '') || '/';

  return excludedUrls.some((excluded) =>
    [normalized, withoutPrefix].some(
      (candidate) => candidate === excluded || candidate.startsWith(`${excluded}/`),
    ),
  );
}

/**
 * Instrumentaciones activas. Se eligen paquete a paquete en lugar de usar
 * `auto-instrumentations-node`, que instalaría ~30 integraciones (kafka, mongo,
 * aws…) que este backend no usa. Ver decisión D2 en 01-architecture-design.md.
 *
 * `fs`, `dns` y `net` quedan deliberadamente fuera: generan cientos de spans por
 * petición sin aportar información accionable.
 */
export function buildInstrumentations(config: TelemetryConfig): Instrumentation[] {
  return [
    new HttpInstrumentation({
      // No se declara `headersToSpanAttributes`: capturar cabeceras arrastraría
      // `Authorization` y cookies hacia el backend de trazas.
      ignoreIncomingRequestHook: (request) =>
        isExcludedPath(request.url ?? '', config.excludedUrls),
      ignoreOutgoingRequestHook: (options) =>
        isExcludedPath(typeof options.path === 'string' ? options.path : '', config.excludedUrls),
      requireParentforOutgoingSpans: false,
    }),
    new UndiciInstrumentation({
      // `fetch` global de Node 22, usado por la subida a Cloudinary.
      ignoreRequestHook: (request) => isExcludedPath(request.path ?? '', config.excludedUrls),
    }),
    new ExpressInstrumentation({
      // Un span por middleware (helmet, cors, body-parser, los 4 guards) satura
      // la traza sin aportar nada: sólo interesan router y request handler.
      ignoreLayersType: [ExpressLayerType.MIDDLEWARE],
    }),
    new NestInstrumentation(),
    new PgInstrumentation({
      // `enhancedDatabaseReporting` capturaría los valores de los parámetros SQL
      // (emails, notas clínicas). Debe permanecer desactivado.
      enhancedDatabaseReporting: false,
      // Evita trazas huérfanas de las consultas de arranque/pool.
      requireParentSpan: true,
      addSqlCommenterCommentToQueries: false,
    }),
    new IORedisInstrumentation({
      // El serializador por defecto incluye los argumentos del comando, es decir
      // claves y VALORES cacheados. Se reduce al nombre del comando.
      dbStatementSerializer: (commandName) => commandName,
      requireParentSpan: true,
    }),
    // Inyecta trace_id/span_id en cada log de Pino cuando hay span activo.
    new PinoInstrumentation(),
  ];
}
