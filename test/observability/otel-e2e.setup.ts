import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

/**
 * `setupFiles` de Jest para las pruebas e2e: registra un proveedor de trazas en
 * memoria, el gestor de contexto y los propagadores W3C antes de cargar el
 * módulo bajo prueba. No depende de que haya un Jaeger levantado.
 *
 * LIMITACIÓN CONOCIDA — no se registran aquí las instrumentaciones automáticas.
 * Éstas se aplican mediante `require-in-the-middle`, que engancha el `require`
 * de Node; Jest resuelve los módulos con su propio registro y ese enganche
 * nunca se dispara, así que `http`, `express`, `pg` e `ioredis` quedan sin
 * parchear dentro de Jest (se verificó empíricamente: cero spans automáticos).
 *
 * Reparto de responsabilidades resultante:
 *  - Jest cubre lo que es código propio: interceptor, filtro, spans de negocio,
 *    propagación en el outbox y la lógica de exclusión de rutas.
 *  - `scripts/verify-jaeger.sh` cubre la instrumentación automática end-to-end
 *    contra un proceso real y un Jaeger real.
 */
const exporter = new InMemorySpanExporter();

const contextManager = new AsyncLocalStorageContextManager();
contextManager.enable();
context.setGlobalContextManager(contextManager);

propagation.setGlobalPropagator(
  new CompositePropagator({
    propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
  }),
);

trace.setGlobalTracerProvider(
  new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }),
);

// Puente hacia las specs: `setupFiles` y los tests comparten el mismo realm.
(globalThis as Record<string, unknown>).__OTEL_TEST_EXPORTER__ = exporter;
