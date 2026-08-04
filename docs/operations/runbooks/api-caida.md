# Runbook: la API no responde o devuelve 5xx

**Síntoma:** `/health` no contesta, contesta `degraded`, o la proporción de 5xx sube.

## 1. Preguntar a la sonda antes que a nada

```bash
curl -sS -m 5 "$API/health" | jq .
```

Vive **fuera** del prefijo `api/v1` a propósito, así que no depende del enrutado versionado.

| Respuesta | Qué significa | Sigue en |
| --- | --- | --- |
| Sin respuesta / rechazo de conexión | El proceso no está vivo o no escucha | Paso 2 |
| `"status": "degraded"`, `database: "down"` | El proceso vive; PostgreSQL no responde | Paso 3 |
| `"status": "degraded"`, `redis: "down"` | **No es una caída.** El servicio sigue atendiendo | Paso 5 |
| `"status": "ok"` pero hay 5xx | Fallo en un módulo concreto | Paso 4 |

## 2. El proceso no está vivo

```bash
# ¿Arrancó y murió?
docker logs --tail 100 corazon_migrante_api    # o el panel de la plataforma
```

Causas frecuentes, en orden de probabilidad:

| Indicio en el log | Causa | Acción |
| --- | --- | --- |
| `config validation error` | Falta una variable obligatoria o tiene mal formato | El mensaje dice cuál. Corregir y desplegar |
| `SequelizeConnectionError` al arrancar | No alcanza la base de datos | Paso 3 |
| Fallo del bootstrap de base | Una migración o *seed* falló y `DATABASE_BOOTSTRAP_FAIL_FAST` está activo | [Runbook de migración fallida](migracion-fallida.md) |
| `Cannot find module '/app/dist/main.js'` | La imagen se construyó con la salida en otra ruta | Comprobar `rootDir` en `tsconfig.build.json` |

**El arranque aborta a propósito cuando la configuración es inválida.** Es preferible no arrancar a
arrancar mal configurado y descubrirlo con tráfico real.

## 3. PostgreSQL no responde

```bash
psql "$DATABASE_URL" -c "select 1"
```

| Comprobación | Qué mirar |
| --- | --- |
| ¿Acepta conexiones? | ¿Está la instancia arriba? ¿Cambió el host? |
| ¿Pool agotado? | Conexiones activas frente a `DATABASE_POOL_MAX` (10 por defecto) |
| ¿Consultas atascadas? | `pg_stat_activity` con `state = 'active'` y duración alta |
| ¿Transacciones abiertas? | `idle in transaction`; deberían morir a los 30 s |

```sql
SELECT pid, state, now() - query_start AS duracion, left(query, 80)
FROM pg_stat_activity
WHERE state <> 'idle' ORDER BY duracion DESC LIMIT 10;
```

PostgreSQL es la **única dependencia dura** del sistema: si no está, la API no puede atender. Todo
lo demás degrada sin interrumpir el servicio.

## 4. La API vive pero devuelve 5xx

Busca por el identificador de petición que reportó quien lo sufrió:

```bash
docker logs corazon_migrante_api 2>&1 | grep '"requestId":"<ID>"'
```

Se emiten cuatro eventos por petición (`HTTP_REQUEST_RECEIVED`, `HTTP_RESPONSE_SENT`,
`HTTP_REQUEST_FAILED`, `HTTP_EXCEPTION_FILTER_CAUGHT`). El campo `normalized` del último trae el
error ya traducido al modelo de la API.

Si hay trazas, la cabecera `x-trace-id` de la respuesta lleva directamente al recorrido completo.

| `error.code` | Causa habitual |
| --- | --- |
| `SERVICE_UNAVAILABLE` | Error de Sequelize no reconocido: casi siempre la base |
| `INTERNAL_SERVER_ERROR` | Excepción no controlada. El cuerpo nunca dice más; el log sí |
| `HTTP_429` | Límite de peticiones, no un fallo |

## 5. Sólo Redis está caído

**No es una incidencia urgente.** El servicio funciona sin caché: responderá más lento en los
listados y `/health` dirá `degraded`.

```bash
redis-cli -u "$REDIS_URL" ping
```

Si va a estar caído un tiempo, `REDIS_ENABLED=false` desactiva el módulo por completo y deja de
intentarlo en cada petición.

## 6. Después

- Anota el `requestId` o el `x-trace-id` en el registro del incidente: es lo que permite
  reconstruirlo después.
- Si la causa fue configuración, revisa si la validación de entorno podría haberlo detectado antes.
- Si fue la base, revisa si el `statement_timeout` de 30 s está haciendo su trabajo o hay que
  ajustarlo.
