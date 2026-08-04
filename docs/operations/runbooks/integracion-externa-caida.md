# Runbook: una integración externa no responde

El sistema tiene **una sola dependencia dura: PostgreSQL**. Todo lo demás degrada sin interrumpir
el servicio. Este runbook cubre esas degradaciones y, sobre todo, ayuda a decidir cuáles son
urgentes y cuáles no.

## Decidir la urgencia

| Integración | Qué deja de funcionar | ¿Urgente? |
| --- | --- | --- |
| **PostgreSQL** | Todo | Sí — ve al [runbook de API caída](api-caida.md) |
| SendGrid | No llega el correo. Se acumula en el outbox y se reintenta | En horario laboral |
| Google Cloud Storage / Cloudinary | No se pueden subir ni descargar archivos | En horario laboral |
| Hotmart | No se conceden accesos de compra nuevos | En horario laboral |
| Colector OTLP | Se pierden las trazas | No |
| Redis | Los listados van más lentos | No |

## SendGrid no responde

**No se pierde ningún correo.** El outbox los conserva y los reintenta con retroceso exponencial.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" "$API/api/v1/admin/messaging/test-email"
```

| Causa | Comprobación |
| --- | --- |
| Credencial caducada | ¿`SENDGRID_API_KEY` sigue siendo válida en el panel del proveedor? |
| Cuota agotada | Consumo del plan |
| Remitente no verificado | ¿`EMAIL_FROM_EMAIL` está verificado como remitente? |
| Proveedor caído | Página de estado de SendGrid |

Mientras dure, los mensajes se acumulan en `PENDIENTE`. Cuando el proveedor vuelva, el worker los
drena solo. Detalle en [reintentos y fallidos](../../events/retries-and-dlq.md).

## El almacenamiento de archivos no responde

```bash
curl -sS "$API/health" | jq .        # no cubre el almacenamiento
```

`/health` **no comprueba el almacenamiento**: sólo base de datos y Redis. Hay que verificarlo desde
el propio flujo.

| Síntoma | Causa probable |
| --- | --- |
| Fallan las subidas, las descargas funcionan | Credencial sin permiso de escritura, o cuota |
| Falla todo | Proveedor caído o credencial revocada |
| Sólo fallan las URL firmadas | Reloj desincronizado, o clave rotada sin actualizar |

**Mitigación disponible:** con `STORAGE_PROVIDER` se puede conmutar entre GCS y Cloudinary sin
tocar código. Los archivos ya subidos siguen en el proveedor anterior, así que la conmutación
resuelve las subidas nuevas, **no** el acceso a lo existente.

En desarrollo, o con `GCS_UPLOAD_FALLBACK_TO_LOCAL=true`, las subidas caen al disco local.

## Hotmart no notifica

Es una integración **entrante**: no la llamamos, nos llama. Que no lleguen notificaciones puede
significar que no hay compras, no necesariamente que algo falle.

```sql
-- ¿Cuándo llegó la última notificación?
SELECT max(created_at) FROM downloadable_external_events WHERE provider = 'HOTMART';
```

| Situación | Acción |
| --- | --- |
| Llegan y se rechazan con `HOTMART_INVALID_SIGNATURE` | `HOTMART_WEBHOOK_SECRET` no coincide con el configurado en Hotmart |
| No llega nada y sí hay ventas | Revisar la URL del webhook en el panel de Hotmart |
| Llegan pero no se concede el acceso | El evento está persistido: se puede reprocesar sin pérdida |

Como el evento se guarda **antes** de procesarse, ninguna notificación se pierde por un fallo de
procesamiento.

**Mientras tanto**, un acceso se puede conceder a mano:
`POST /api/v1/admin/downloadables/{id}/grant`.

## El colector de trazas no responde

No requiere intervención. Se pierden las trazas, no las peticiones. Los logs siguen saliendo y el
`requestId` sigue permitiendo correlacionar.

## Redis no responde

Ver el [runbook de API caída](api-caida.md), paso 5. `/health` dirá `degraded`; el servicio
funciona más lento. Si va a estar caído un tiempo, `REDIS_ENABLED=false` evita reintentos en cada
petición.

## Después

- Si la integración estuvo caída más de una hora, comprueba que el outbox se ha drenado.
- Si fue una credencial caducada, revisa si el resto están cerca de caducar:
  [rotación de credenciales](../../security/CREDENTIAL_ROTATION_RUNBOOK.md).
- Ninguna de estas integraciones tiene alerta configurada todavía: hasta que existan métricas
  ([G-24](../../reports/documentation-gap-analysis.md)), la detección depende de que alguien lo note.
