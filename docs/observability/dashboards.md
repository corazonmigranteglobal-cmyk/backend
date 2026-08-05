# Recolección y tableros

El backend emite métricas; para verlas hace falta algo que las recoja. Este repositorio trae ese
algo listo para levantar: Prometheus (recolección y alertas) y Grafana (tableros).

## Levantarlo

```bash
# 1. Guardar el token en un archivo. Debe ser EL MISMO que tiene el backend
#    en METRICS_TOKEN. Sin comillas ni salto de línea final.
echo -n "$METRICS_TOKEN" > infra/prometheus/metrics-token

# 2. Arrancar
yarn obs:up
```

| Servicio | URL | Credenciales |
| --- | --- | --- |
| Prometheus | <http://localhost:9090> | — |
| Grafana | <http://localhost:3001> | `admin` / `admin` |

Grafana se conecta sola a Prometheus: la fuente de datos se aprovisiona al arrancar y no hay que
configurar nada a mano.

```bash
yarn obs:logs    # ver qué está pasando
yarn obs:down    # parar
```

## Comprobar que funciona

En Prometheus, **Status → Targets**. El objetivo `backend` debe aparecer como `UP`.

| Estado | Causa habitual |
| --- | --- |
| `UP` | Todo correcto |
| `DOWN`, HTTP 404 | El token no coincide, o el backend no tiene `METRICS_TOKEN` configurado |
| `DOWN`, HTTP 403 | El archivo del token tiene un valor distinto al del backend |
| `DOWN`, conexión rechazada | El backend no está corriendo, o está en otro puerto |

!!! warning "El 404 es deliberado"
    Cuando el backend no tiene `METRICS_TOKEN`, `/metrics` responde 404 y no 403: un 403
    confirmaría que hay métricas detrás. Si Prometheus dice 404, revisa **el backend**, no
    Prometheus.

Consulta rápida en la pestaña **Graph**:

```promql
http_requests_total
```

Si no aparece nada, haz alguna petición a la API y espera un ciclo de raspado (15 s).

## Dónde está cada cosa

| Archivo | Qué contiene |
| --- | --- |
| [`infra/prometheus/prometheus.yml`](../../infra/prometheus/prometheus.yml) | Qué raspar y cada cuánto |
| [`infra/prometheus/alertas.yml`](../../infra/prometheus/alertas.yml) | Las 9 reglas de alerta |
| [`infra/grafana/provisioning/`](../../infra/grafana/provisioning/) | Fuente de datos de Grafana |
| [`docker-compose.observability.yml`](../../docker-compose.observability.yml) | Los dos servicios |

El token vive en `infra/prometheus/metrics-token`, que **está en `.gitignore`**: la configuración se
versiona, el secreto no.

## Alertas definidas

Regla de oro: **sólo se alerta de lo que alguien va a atender**. Una alerta que nadie mira enseña al
equipo a ignorar las alertas, y entonces tampoco mirará la que importa.

### Inmediatas

| Alerta | Condición | Runbook |
| --- | --- | --- |
| `BackendCaido` | Sin responder 2 min | [API caída](../operations/runbooks/api-caida.md) |
| `TasaDeErrores5xx` | > 1 % durante 10 min | [API caída](../operations/runbooks/api-caida.md) |
| `FallosDeInicioDeSesion` | > 1 % de 5xx en login | — |
| `FallosAlReservarCita` | > 1 % de 5xx al reservar | — |
| `PoolSaturado` | Peticiones esperando conexión 5 min | [API caída](../operations/runbooks/api-caida.md) |

Las dos de recorridos críticos se vigilan aparte de la tasa global a propósito: un fallo en el
inicio de sesión o en la reserva importa más que la media, y la media puede taparlo.

### En horario laboral

| Alerta | Condición | Runbook |
| --- | --- | --- |
| `OutboxAtascado` | Mensaje pendiente > 30 min | [Cola detenida](../operations/runbooks/outbox-detenido.md) |
| `CorreosFallidos` | > 10 en `FALLIDO` en 1 h | [Cola detenida](../operations/runbooks/outbox-detenido.md) |
| `LatenciaDegradada` | p95 > 2 s durante 15 min | — |
| `MetricasSinMuestrear` | > 3 fallos de muestreo en 15 min | — |

`OutboxAtascado` es la alerta más útil de todas y no es técnica: si un correo prometido lleva media
hora sin salir, hay una persona esperando algo que no llega.

## Retención

Prometheus conserva 90 días. Suficiente para revisar una tendencia trimestral sin que el disco
crezca sin control. Se cambia en `docker-compose.observability.yml`
(`--storage.tsdb.retention.time`).

## Llevarlo a producción

Lo de aquí está pensado para desarrollo. Para producción hay tres cosas que cambiar:

1. **El objetivo del raspado.** `host.docker.internal:3000` sólo vale si el backend corre en la
   máquina anfitriona. En producción, apunta al nombre del servicio o a su dirección real.
2. **Las credenciales de Grafana.** `admin`/`admin` es aceptable en local y no lo es fuera.
3. **El envío de alertas.** Prometheus las evalúa pero **no las manda a ningún sitio**: hace falta
   un Alertmanager con un destino (correo, Slack, lo que use el equipo). Sin él, una alerta que se
   dispara sólo se ve entrando a mirar.

## Estado

| Elemento | Estado |
| --- | --- |
| Métricas emitidas por el backend | ✅ |
| Recolección | ✅ verificada: objetivo `UP`, series llegando |
| Reglas de alerta | ✅ 9 reglas cargadas en 4 grupos |
| Tableros de Grafana | ⚠️ la fuente de datos está lista; los paneles se construyen a demanda |
| Envío de alertas | ❌ sin Alertmanager |
| Objetivos de servicio medidos | ❌ hace falta un mes de serie real |

Los dos últimos siguen abiertos en
[el análisis de brechas](../reports/documentation-gap-analysis.md).
