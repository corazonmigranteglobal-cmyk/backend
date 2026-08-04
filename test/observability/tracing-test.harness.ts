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
  ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

/**
 * Proveedor de trazas en memoria para las pruebas unitarias.
 *
 * Evita depender de una instancia real de Jaeger: los spans se inspeccionan
 * directamente con `InMemorySpanExporter`. Está en `test/` (excluido de
 * `tsconfig.build.json`) para que no acabe en `dist/`.
 */
export interface TracingTestHarness {
  exporter: InMemorySpanExporter;
  finishedSpans(): ReadableSpan[];
  reset(): void;
  shutdown(): Promise<void>;
}

export function setupInMemoryTracing(): TracingTestHarness {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  // En producción lo registra `NodeSDK`. Sin gestor de contexto, `context.active()`
  // devuelve siempre el contexto raíz y `startActiveSpan` no anidaría nada.
  const contextManager = new AsyncLocalStorageContextManager();
  contextManager.enable();
  context.disable();
  context.setGlobalContextManager(contextManager);

  // `setGlobalTracerProvider` es idempotente sólo tras `disable()`; sin esto la
  // segunda suite del proceso reutilizaría el proveedor de la primera.
  trace.disable();
  trace.setGlobalTracerProvider(provider);

  propagation.disable();
  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    }),
  );

  return {
    exporter,
    finishedSpans: () => exporter.getFinishedSpans(),
    reset: () => exporter.reset(),
    shutdown: async () => {
      await provider.shutdown();
      trace.disable();
      propagation.disable();
      context.disable();
    },
  };
}
