# Modelo de error

Todos los errores de la API tienen la misma forma. La produce
[`HttpExceptionFilter`](../../src/common/filters/http-exception.filter.ts), que es un `@Catch()`
global: ve también los errores de guards y de pipes, que nunca llegan a los interceptores.

## Forma

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La solicitud contiene datos con un formato invalido.",
    "details": [
      { "field": "email", "constraints": { "isEmail": "email must be an email" } }
    ]
  },
  "meta": {
    "requestId": "3f1c8a52-9d47-4a0b-8f21-6d5c0f1e2b7a",
    "timestamp": "2026-08-03T19:45:12.345Z"
  }
}
```

!!! tip "Ramifica por `error.code`, nunca por `error.message`"
    `message` es texto para la persona usuaria y puede cambiar sin previo aviso. `code` es parte del
    contrato.

Fíjate en lo que **no** hay: ni `statusCode` ni `path` en el cuerpo. El código HTTP ya viaja en la
respuesta y duplicarlo invita a que las dos fuentes discrepen.

## Códigos

### Normalizados por el filtro

| Código | HTTP | Cuándo |
| --- | ---: | --- |
| `VALIDATION_ERROR` | 400 | El `ValidationPipe` rechaza el cuerpo |
| `RESOURCE_ALREADY_EXISTS` | 409 | Restricción de unicidad. `details` lleva los campos en conflicto |
| `RESOURCE_REFERENCE_CONFLICT` | 409 | La operación viola una clave foránea |
| `SERVICE_UNAVAILABLE` | 503 | Error de Sequelize no reconocido: casi siempre la base de datos |
| `INTERNAL_SERVER_ERROR` | 500 | Excepción no controlada |
| `HTTP_<código>` | varios | Error HTTP sin código de dominio propio (`HTTP_404`, `HTTP_413`, `HTTP_429`…) |

### De dominio

Los lanzan los módulos y son los que conviene tratar de forma específica:

| Código | HTTP | Significado |
| --- | ---: | --- |
| `AUTH_LOGIN_REQUIRES_POST` | 405 | Se llamó a `GET /auth/login`. Existe sólo para orientar |
| `HOTMART_INVALID_SIGNATURE` | 403 | El webhook llegó sin token válido |
| `THERAPY_APPROACH_NOT_FOUND` | 404 | El enfoque referenciado no existe |

## Validación estricta

El `ValidationPipe` corre con `whitelist`, `forbidNonWhitelisted` y `forbidUnknownValues`. **Enviar
una propiedad que el DTO no declara produce un 400**, no se ignora en silencio.

!!! warning "No es configurable, y es a propósito"
    Existió una variable para relajarlo. Se retiró porque permitía reabrir por entorno el agujero
    por el que una persona paciente podía reservar una cita a nombre de otra colando un campo extra.

    `yarn check:validation-strict` lo verifica y forma parte de `verify:ci`.

En un error de validación, `details` trae un elemento por campo rechazado, con `field`,
`constraints` y `children` para los objetos anidados.

## Errores presentes en toda operación

El generador del contrato los añade a cada operación a partir de lo que el código puede producir:

| HTTP | Cuándo aparece |
| --- | --- |
| 429 | Siempre: `ThrottlerGuard` es global |
| 500 | Siempre |
| 503 | Siempre: cualquier operación puede tocar la base |
| 401 | Si la operación no es `@Public()` |
| 403 | Si además declara roles o permisos |
| 400 | Si acepta cuerpo o parámetros |
| 413 | Si acepta cuerpo |
| 404 | Si la ruta tiene parámetros de camino |
| 409 | En `POST`, `PUT` y `PATCH` |

No es una lista escrita a mano: se **deriva** de la firma de cada operación, así que no puede
quedarse desfasada.

## Correlacionar un error

Toda respuesta —de éxito o de error— trae dos cabeceras:

| Cabecera | Para qué |
| --- | --- |
| `X-Request-Id` | Espejo de `meta.requestId`. Agrupa las líneas de log de esa petición |
| `x-trace-id` | Traza de OpenTelemetry, incluido el trabajo asíncrono posterior |

El `requestId` se toma de la cabecera `X-Request-Id` que envíe el cliente, y sólo se genera cuando
falta: así una traza iniciada en el frontend se conserva de extremo a extremo.

**Al reportar un problema, incluye siempre el `requestId`.** Es la diferencia entre localizar el
error y buscarlo a ciegas.

## Lo que nunca sale en el cuerpo

Un 500 jamás expone la causa: ni traza de pila, ni SQL, ni nombres de tabla. La información está en
los logs del servidor, referenciada por `requestId`.
