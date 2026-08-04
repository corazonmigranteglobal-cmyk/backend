# Auditabilidad

## Qué se registra

El módulo [`audit`](../modules/audit.md) recibe escrituras de diez de los diecinueve módulos de
dominio. Se registra toda acción que cambie estado relevante: alta y baja de cuentas, cambios de
rol, transiciones de cita, publicación y despublicación de contenido, movimientos contables,
subidas y borrados de archivo, y cambios en campañas publicitarias.

## Qué NO se registra

**Nunca se almacena el cuerpo completo de una petición.** Los cuerpos contienen datos clínicos y
personales; guardarlos en el registro de auditoría convertiría ese registro en un segundo almacén
de datos sensibles, con la misma exposición y sin sus controles.

La redacción la aplica [`sanitizeForLog`](../../src/common/logging/log-sanitizer.ts), cubierta por
`log-sanitizer.spec.ts`.

## Correlación

Tres identificadores permiten reconstruir qué pasó:

| Identificador | Dónde aparece | Para qué |
| --- | --- | --- |
| `meta.requestId` | En toda respuesta y en la cabecera `X-Request-Id` | Enlaza la queja de una persona con las líneas de log de esa petición |
| `x-trace-id` | Cabecera de respuesta | Enlaza con la traza de OpenTelemetry, incluida la parte asíncrona |
| `audit_log.id` | Registro de auditoría | Enlaza con la acción de negocio |

El `requestId` se toma de la cabecera `X-Request-Id` que envía el cliente si viene, y sólo se genera
cuando falta. Así una traza iniciada en el frontend se conserva de extremo a extremo.

## Propiedad estructural

`audit` **no importa de ningún módulo de dominio**. Todos escriben en él y él no depende de nadie.
Si alguna vez necesitara conocer la forma de una cita, aparecería el primer ciclo entre módulos del
sistema. Es la regla que mantiene el registro desacoplado de lo que registra.

## Consulta

`GET /api/v1/admin/audit/logs` — requiere el permiso `audit:read`. Es la **única** superficie de
lectura: desde el dominio, el registro es de sólo escritura.

## Retención

Ver [retención de datos](../data/retention.md).
