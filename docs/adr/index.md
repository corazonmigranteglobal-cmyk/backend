# Índice de decisiones arquitectónicas

Cada ADR conserva **por qué** se decidió algo, no sólo qué se decidió. Se escriben cuando la
decisión sería difícil de reconstruir leyendo el código, o cuando su consecuencia parece un defecto
y conviene que nadie la reabra sin contexto.

| ADR | Título | Estado |
| --- | --- | --- |
| [ADR-0003](ADR-0003-orm-y-modelo-de-datos.md) | Sequelize como ORM y modelo de datos | Aceptado |
| [ADR-0015](ADR-0015-interoperabilidad-de-modulos.md) | Interoperabilidad de módulos CommonJS | Aceptado |

## Decisiones documentadas fuera de un ADR

Estas decisiones están registradas y justificadas, pero en el documento donde son operativas:

| Decisión | Dónde |
| --- | --- |
| Outbox transaccional en vez de broker externo | [Semántica de entrega](../events/delivery-semantics.md) |
| Entrega «al menos una vez», sin garantía de orden | ídem |
| Sin cola de fallidos separada | [Reintentos y DLQ](../events/retries-and-dlq.md) |
| Una etiqueta de API por dominio, sin separar público de administración | [`scripts/generate-openapi.ts`](../../scripts/generate-openapi.ts) |
| El contrato OpenAPI se genera, nunca se escribe a mano | [Política de documentación](../governance/documentation-policy.md) |
| Validación estricta no configurable (`forbidNonWhitelisted`) | [Modelo de amenazas](../security/threat-model.md) |
| Dos proveedores de almacenamiento intercambiables | [Mapa de integraciones](../architecture/integration-map.md) |

## Plantilla

Estado · Contexto · Opciones consideradas · Decisión · Consecuencias positivas · Consecuencias
negativas · Riesgos · Evidencia · Plan de revisión.
