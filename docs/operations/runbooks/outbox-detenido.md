# Runbook: la cola de mensajes no avanza

**Síntoma:** los correos no llegan. `GET /api/v1/admin/messaging/outbox` muestra mensajes
acumulados en `PENDING` o `PROCESSING`.

## 1. ¿Está vivo el worker?

El worker es un **proceso separado** de la API. Que la API responda no dice nada sobre él.

```bash
ps aux | grep outbox.worker      # o el panel de la plataforma
```

Comprobar también que `OUTBOX_WORKER_ENABLED` no esté en `false`.

**Si está caído:** arrancarlo con `yarn worker:outbox`. Los mensajes bloqueados se liberan solos al
caducar el bloqueo (`OUTBOX_STALE_LOCK_MS`, 5 minutos por defecto).

## 2. ¿Responde el proveedor?

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/admin/messaging/test-email"
```

Si falla, revisar `SENDGRID_API_KEY` (¿caducada?), la cuota de la cuenta y `EMAIL_FROM_EMAIL`.

## 3. ¿Qué estado predomina?

| Estado | Significado | Acción |
| --- | --- | --- |
| `PENDING` sin avanzar | El worker no toma trabajo | Volver al paso 1 |
| `PROCESSING` estancado | Un worker murió a mitad | Esperar a que caduque el bloqueo |
| `FAILED` en masa | Fallo del proveedor | Paso 2, luego reprocesar |

## 4. Reprocesar

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/admin/messaging/outbox/$ID/process"    # uno concreto

curl -X POST -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/admin/messaging/outbox/process"        # el lote pendiente
```

Requiere el permiso `messaging:write`.

## 5. Después del incidente

- **Espera duplicados.** La garantía es «al menos una vez»: si el worker murió tras la aceptación
  del proveedor, esos correos se enviarán otra vez. Es el comportamiento esperado, no un fallo.
- Anotar cuántos mensajes quedaron en `FAILED`. No hay purga automática de `message_outbox`, así
  que se acumulan (ver [retención](../../data/retention.md)).

## Qué no hacer

**No borrar filas de `message_outbox` para «desatascar».** Se pierde el rastro de qué se prometió
y a quién, que es justo lo que el outbox existe para conservar.
