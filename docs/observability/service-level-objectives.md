# Objetivos de nivel de servicio

!!! warning "Objetivos propuestos, no medidos"
    **Las métricas ya se emiten** en `GET /metrics` (ver [métricas](metrics.md)), pero **nadie las
    recoge todavía**: no hay Prometheus ni tablero configurados, y por tanto tampoco alertas.

    Los objetivos de esta página son la propuesta inicial, derivada de qué significa realmente
    "funcionar" para este producto. Se documentan ahora para que la instrumentación se construya
    contra un objetivo, y no al revés. Su implantación es la brecha
    [G-24](../reports/documentation-gap-analysis.md).

## Qué significa que el servicio funciona

No todo pesa lo mismo. Que la portada tarde un segundo de más es una molestia; que una persona no
pueda reservar una cita es un fallo del producto.

| Recorrido crítico | Por qué importa |
| --- | --- |
| Iniciar sesión | Sin esto no hay acceso a nada |
| Consultar disponibilidad y reservar cita | Es la capacidad central del producto |
| Consultar la propia agenda | Una persona necesita saber cuándo la atienden |
| Recibir el correo de confirmación | Cierra el ciclo de la reserva |

## Objetivos propuestos

Ventana de medición: 30 días naturales.

| SLI | Objetivo | Cómo se mediría |
| --- | ---: | --- |
| Disponibilidad de la API | 99,5 % | Proporción de peticiones sin 5xx |
| Latencia de lectura (p95) | < 500 ms | `durationMs` de `HTTP_RESPONSE_SENT` en operaciones `GET` |
| Latencia de escritura (p95) | < 1 200 ms | ídem en `POST`/`PATCH`/`DELETE` |
| Éxito del inicio de sesión | 99,9 % | `POST /auth/login` sin 5xx |
| Éxito de la reserva | 99,5 % | `POST /appointments` sin 5xx |
| Entrega de correo en 15 min | 99 % | `sentAt - createdAt` en `mensaje_outbox` |
| Antigüedad del outbox | < 5 min (p95) | Edad del mensaje `PENDIENTE` más antiguo |

Un 99,5 % mensual admite unas 3 h 39 min de indisponibilidad. Es un objetivo deliberadamente
alcanzable para un equipo pequeño sin guardia 24/7: prometer 99,9 % sin nadie de guardia sería
prometer algo que no se puede sostener.

## Presupuesto de error

Con 99,5 %, el presupuesto mensual es del 0,5 %. La regla de uso propuesta:

| Consumo | Qué implica |
| --- | --- |
| < 50 % | Ritmo normal de cambios |
| 50–100 % | Prioridad a estabilidad sobre funcionalidad nueva |
| Agotado | Sólo correcciones y trabajo de fiabilidad hasta que se reponga |

## Métricas expuestas

Agrupadas por el método RED, que es el que encaja con un servicio de peticiones:

| Grupo | Métricas |
| --- | --- |
| **Rate** | Peticiones por segundo, por ruta y método |
| **Errors** | Proporción de 4xx y 5xx, por ruta |
| **Duration** | Histograma de latencia, por ruta |
| Base de datos | Conexiones en uso frente al tamaño del pool, duración de consulta, tiempo de espera de adquisición |
| Redis | Aciertos y fallos de caché, latencia de comando |
| Outbox | Pendientes, fallidos, antigüedad del más antiguo, intentos por mensaje |
| Integraciones | Latencia y tasa de error de SendGrid, del almacenamiento y del webhook de Hotmart |
| Negocio | Citas reservadas, canceladas y no asistidas; altas de suscripción |

La métrica más valiosa para operación no es técnica: **la antigüedad del mensaje pendiente más
antiguo del outbox**. Si crece, algo está roto en el worker o en el proveedor, y lo notarán las
personas antes que cualquier tablero.

## Alertas propuestas

| Alerta | Condición | Urgencia |
| --- | --- | --- |
| API caída | Sonda `/health` fallando 2 min | Inmediata |
| Base degradada | `/health` devuelve `degraded` por `database` 5 min | Inmediata |
| Aumento de 5xx | > 1 % durante 10 min | Inmediata |
| Outbox atascado | Mensaje pendiente de más de 30 min | En horario laboral |
| Fallos de correo | > 10 mensajes en `FALLIDO` en 1 h | En horario laboral |
| Latencia degradada | p95 > 2 s durante 15 min | En horario laboral |
| Presupuesto de error | 75 % consumido | Informativa |

`/health` distingue `ok` de `degraded` precisamente para esto: si Redis cae pero PostgreSQL
responde, el servicio sigue siendo útil y no debe despertar a nadie de madrugada.

## Cómo cerrar esta brecha

1. ~~Exponer métricas en un endpoint dedicado~~ — **hecho**: `GET /metrics`, fuera de `/api/v1`,
   protegido por `METRICS_TOKEN` y con fallo cerrado.
2. ~~Instrumentar los recorridos críticos~~ — **hecho**: las cuatro rutas se miden por patrón, con
   latencia y tasa de error.
3. Desplegar un Prometheus que raspe el endpoint y conservar la serie.
4. Medir un mes antes de fijar los objetivos definitivos: los de esta página son una hipótesis
   razonada, no una medición.
5. Definir alertas sólo sobre lo que alguien vaya a atender. Una alerta que nadie mira enseña al
   equipo a ignorar las alertas.
