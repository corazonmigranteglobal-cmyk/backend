# Reintentos y mensajes fallidos

## Reintento con retroceso exponencial

Cuando el proveedor rechaza un envío o no responde, el mensaje vuelve a `PENDING` con una espera
que crece en cada intento:

```
espera = min(OUTBOX_RETRY_BASE_DELAY_MS × 2^(intentos-1), OUTBOX_RETRY_MAX_DELAY_MS)
```

Con los valores por defecto (`30 s` de base, `1 h` de tope):

| Intento | Espera antes del siguiente |
| ---: | --- |
| 1 | 30 s |
| 2 | 1 min |
| 3 | 2 min |
| 4 | 4 min |
| … | … |
| 8 y siguientes | 1 h (tope) |

El retroceso protege al proveedor de una tormenta de reintentos y protege al sistema de gastar
cuota en un fallo que no se va a resolver solo.

## No hay cola de fallidos separada

**No existe una tabla DLQ.** Un mensaje agotado se queda en `message_outbox` con estado `FAILED`.
Es una decisión consciente:

- Una tabla aparte obligaría a mantener dos esquemas y dos rutas de consulta para el mismo objeto.
- El volumen de correo del sistema no justifica esa separación.
- Conservar el mensaje en su sitio hace que el reproceso sea un cambio de estado, no una migración
  entre tablas.

La consecuencia a vigilar es que **`message_outbox` crece indefinidamente**. La política de
retención está en [retención de datos](../data/retention.md).

## Bloqueo caducado

Si un worker muere mientras procesa un lote, esos mensajes quedarían en `PROCESSING` para siempre.
Para evitarlo, cada lote se bloquea con marca de tiempo y, pasados `OUTBOX_STALE_LOCK_MS`
(5 minutos por defecto), otro worker puede reclamarlo.

El efecto secundario es la entrega duplicada descrita en
[semántica de entrega](delivery-semantics.md): si el worker murió *después* de que el proveedor
aceptara el mensaje, el reintento lo enviará otra vez.

## Reproceso manual

```bash
# Ver qué hay atascado
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.corazonmigrante.com/api/v1/admin/messaging/outbox?status=FAILED"

# Reintentar uno concreto
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.corazonmigrante.com/api/v1/admin/messaging/outbox/$ID/process"
```

Requiere el permiso `messaging:write`.

## Qué mirar cuando algo va mal

| Síntoma | Causa probable | Comprobación |
| --- | --- | --- |
| Todo en `PENDING` y sin avanzar | El worker no está corriendo | ¿Hay proceso `worker:outbox`? ¿`OUTBOX_WORKER_ENABLED`? |
| Muchos en `FAILED` de golpe | Credencial del proveedor caducada o cuota agotada | `POST /admin/messaging/test-email` |
| Mensajes atascados en `PROCESSING` | Worker muerto; se liberarán al caducar el bloqueo | Esperar `OUTBOX_STALE_LOCK_MS` |
| Correos duplicados | Reintento tras aceptación del proveedor | Comportamiento esperado de «al menos una vez» |

El procedimiento completo está en el [runbook de cola detenida](../operations/runbooks/outbox-detenido.md).
