# Logs

Los logs son estructurados (JSON, una línea por evento) y los emite `pino` a través de
[`PinoLoggerService`](../../src/common/logging/pino-logger.service.ts).

## Eventos del ciclo de una petición

| Evento | Quién lo emite | Cuándo |
| --- | --- | --- |
| `HTTP_REQUEST_RECEIVED` | `ResponseInterceptor` | Al entrar la petición |
| `HTTP_RESPONSE_SENT` | `ResponseInterceptor` | Al serializar la respuesta |
| `HTTP_REQUEST_FAILED` | `ResponseInterceptor` | Cuando el handler lanza |
| `HTTP_EXCEPTION_FILTER_CAUGHT` | `HttpExceptionFilter` | Cuando cualquier error llega al filtro global |

`HTTP_EXCEPTION_FILTER_CAUGHT` cubre lo que los interceptores nunca ven: los rechazos de guards
(401, 403) y las rutas inexistentes (404). Son justo los errores que la gente acaba reportando a
soporte, así que también fijan la cabecera de traza.

## Campos

| Campo | Presente en | Para qué |
| --- | --- | --- |
| `requestId` | Todos | Correlaciona las líneas de una misma petición. Se toma de `X-Request-Id` si el cliente la envía |
| `method`, `url` | Todos | Identifican la operación |
| `controller`, `handler` | Recepción y fallo | Localizan el código sin buscar la ruta |
| `statusCode` | Respuesta y filtro | Resultado |
| `durationMs` | Respuesta y fallo | Latencia real del handler |
| `ip` | Recepción | Origen. Respeta `TRUST_PROXY_HOPS` |
| `normalized` | Filtro | Error ya traducido al modelo de la API (`code`, `message`, `details`) |
| `error` | Fallo y filtro | Error original, **redactado** |

## Nivel según gravedad

`HttpExceptionFilter` decide por código: **5xx a `error`, el resto a `warn`**. Un 404 o un 400 son
comportamiento esperado de una API pública y no deben disparar alertas.

## Redacción de datos sensibles

[`sanitizeForLog`](../../src/common/logging/log-sanitizer.ts) elimina los campos sensibles conocidos
antes de que nada llegue al log. Está cubierto por `log-sanitizer.spec.ts`.

!!! danger "`LOG_LEVEL=debug` en producción vuelca datos clínicos"
    Los cuerpos de petición y respuesta **sólo** se serializan cuando el nivel es `debug` o `trace`
    (`VERBOSE_PAYLOAD_LOGGING` en `ResponseInterceptor`). Esos cuerpos contienen perfiles de
    paciente y notas clínicas, y la redacción no puede conocer todos los campos posibles.

    Es además el mayor coste de CPU del pipeline en listados de hasta 100 elementos, y por eso está
    condicionado.

    Subir el nivel en producción es una decisión operativa acotada: hazlo sólo durante una
    investigación concreta y déjalo por escrito. Registrado como
    [A-3 en el modelo de amenazas](../security/threat-model.md).

## Correlación con trazas

Cada línea de log lleva `requestId`; cada respuesta lleva además la cabecera `x-trace-id`. Con el
primero se agrupan los logs de una petición; con el segundo se salta a la traza completa, incluido
el trabajo asíncrono que se disparó después. Ver [trazas](tracing.md).

## Salida

- **Por defecto:** salida estándar, que es lo que esperan los orquestadores.
- **`LOG_FILE_PATH`:** añade un destino en archivo. Se vacía al apagar; si el proceso termina antes
  de que el descriptor esté listo, el fallo se ignora en vez de romper el apagado.

## Lo que no hay

No hay agregación centralizada configurada en este repositorio. Los logs se recogen por donde salen
(la plataforma de despliegue). Definir retención y búsqueda es parte de la brecha
[G-24](../reports/documentation-gap-analysis.md).
