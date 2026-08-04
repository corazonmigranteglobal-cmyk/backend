# Fase 18 — Política de privacidad de los datos de traza

## 1. Por qué este documento es obligatorio aquí

Corazón Migrante es una plataforma de **atención psicológica a población
migrante**. Por el backend circulan datos de salud, datos de personas en
situación administrativa vulnerable y datos de pago. Un sistema de trazas mal
configurado se convierte en una copia paralela de la base de datos, fuera del
control de acceso de la aplicación y sin cifrado en reposo.

**Regla de partida: una traza debe permitir reproducir el *camino* de una
operación, nunca su *contenido*.**

## 2. Datos permitidos en spans y atributos

| Categoría | Ejemplos | Justificación |
| --- | --- | --- |
| Identificadores internos | `app.entity.id` (UUID de cita, usuario, recurso) | Opacos; sin acceso a la base de datos no revelan nada. Imprescindibles para correlacionar con soporte. |
| Enums de dominio | `app.result`, `app.downloadable.action`, `app.appointment.target_status`, `app.event.type` | Cardinalidad baja y sin información personal. |
| Nombres de módulo y operación | `app.module`, `app.operation` | Estructurales. |
| Métricas agregadas | `app.batch.size`, `app.batch.processed`, `app.job.attempt` | Contadores. |
| Atributos técnicos estándar | `http.request.method`, `http.response.status_code`, `db.system`, `db.operation.name`, `server.address`, `server.port` | Necesarios para diagnosticar latencia. |
| Rutas **con plantilla** | `/api/v1/appointments/:id` | El patrón de ruta no contiene el valor. |
| Booleanos de contexto | `app.appointment.assisted` | Cardinalidad 2. |

## 3. Datos prohibidos — sin excepciones

- Contraseñas y hashes de contraseña.
- Access tokens, refresh tokens y sus hashes.
- Claves de API (SendGrid, Cloudinary, GCS, Hotmart).
- Cabeceras `Authorization`, `Cookie`, `Set-Cookie`.
- Firmas de webhook (`rawSignature` de Hotmart).
- Direcciones de correo y números de teléfono.
- Nombres y apellidos de pacientes o terapeutas.
- Notas para el terapeuta, motivos de consulta, diagnósticos, historia clínica.
- Documentos de identidad y país de origen a nivel individual.
- Datos bancarios, importes asociados a un pagador identificable, comprobantes.
- Cuerpos completos de petición o respuesta.
- Ficheros, imágenes y nombres de fichero subidos por usuarios.
- SQL con valores de parámetros.
- Variables de entorno y cadenas de conexión.
- Stack traces enviados al cliente.

## 4. Cómo se hace cumplir — controles implementados

| Control | Dónde | Efecto |
| --- | --- | --- |
| No se declara `headersToSpanAttributes` en `HttpInstrumentation` | [telemetry.instrumentations.ts](../../src/observability/telemetry.instrumentations.ts) | Ninguna cabecera HTTP se convierte en atributo; `Authorization` y `Cookie` no pueden filtrarse. |
| `enhancedDatabaseReporting: false` en `PgInstrumentation` | ídem | Los **valores** de los parámetros SQL no se capturan. Se ve `SELECT … WHERE email = $1`, nunca el email. |
| `dbStatementSerializer: (cmd) => cmd` en `IORedisInstrumentation` | ídem | El serializador por defecto incluye claves **y valores** cacheados; se reduce al nombre del comando (`GET`, `SETEX`). |
| Instrumentación de `fs` desactivada | ídem | No se registran rutas de ficheros subidos. |
| **`SpanRedactionProcessor`** | [span-redaction.processor.ts](../../src/observability/span-redaction.processor.ts) | Sanea los atributos antes de exportar: elimina el query string de `url.full`, sustituye los literales del SQL en `db.query.text` por `'?'` y borra `url.query` y `db.query.parameters`. Ver §4.1. |
| Exclusión de rutas de sonda | ídem + `OTEL_EXCLUDED_URLS` | `/health`, `/metrics` y `/docs` no generan trazas. |
| Sin captura de cuerpos | por diseño | Ninguna instrumentación activa captura payloads. |
| Spans de negocio revisados uno a uno | [02-business-spans-catalog.md](02-business-spans-catalog.md) | Cada atributo tiene su justificación de privacidad documentada. |
| El carrier de traza no sale por la API | `MessagingService.withoutTraceCarrier` | `payload._trace` se elimina de las respuestas del panel de mensajería. |
| Redacción en el Collector | [otel-collector.config.yml](../../infra/otel-collector/otel-collector.config.yml) | Segunda barrera: borra `http.request.header.authorization`, `cookie`, `url.query`, `user.email`, `db.statement.parameters` aunque una instrumentación futura los reintrodujera. |
| Prueba automática | [observability.e2e-spec.ts](../../test/observability/observability.e2e-spec.ts) | Falla el build si una cabecera `Authorization` o `Cookie` aparece en los atributos. |
| Prueba end-to-end | [verify-jaeger.sh](../../scripts/verify-jaeger.sh) | Inspecciona la traza real en Jaeger buscando claves sensibles. |

### 4.1 Dos fugas reales detectadas y cerradas

Ambas se encontraron **ejecutando el backend contra un Jaeger real**, no
revisando código. Configurar bien las instrumentaciones no bastaba.

**Fuga 1 — el query string completo en `url.full`.**
`instrumentation-nestjs-core` publicaba la URL íntegra. Una búsqueda en el panel
de administración quedaba almacenada tal cual:

```text
url.full = /api/v1/therapy/products?search=juan.perez%40gmail.com&page=1
```

**Fuga 2 — los valores del SQL dentro de `db.query.text`.**
`enhancedDatabaseReporting: false` sólo suprime el *array* de parámetros, pero
**Sequelize no usa parámetros ligados en las cláusulas `where`**: interpola los
valores ya escapados dentro de la propia sentencia. El correo del paciente
viajaba en la consulta:

```sql
WHERE "TherapyProduct"."name" ILIKE '%juan.perez@gmail.com%' AND "status" = 'ACTIVE'
```

**Corrección.** `SpanRedactionProcessor` se encadena antes del
`BatchSpanProcessor` y sanea los atributos antes de que el exportador los lea.
Se conserva la *forma* —que es lo que sirve para diagnosticar latencia— y se
descarta el *contenido*:

```text
url.full      = /api/v1/therapy/products
db.query.text = ... WHERE "TherapyProduct"."name" ILIKE '?' AND "status" = '?'
url.query, db.query.parameters → eliminados
```

**Verificación tras el arreglo**, sobre la traza real en Jaeger de la misma
petición: la cadena `juan.perez@gmail.com` no aparece en ningún span.
Regresión cubierta por
[span-redaction.processor.spec.ts](../../src/observability/span-redaction.processor.spec.ts).

Los logs de Pino mantienen además su propia lista de redacción
(`password`, `authorization`, `cookie`, `token`, `accessToken`, `refreshToken`,
`apiKey`, `privateKey`) y sólo serializan cuerpos con `LOG_LEVEL=debug|trace`.

## 5. Retención

| Entorno | Retención | Justificación |
| --- | --- | --- |
| Desarrollo | En memoria, se pierde al parar el contenedor | Nunca contiene datos reales de producción. |
| Staging | 3 días | Suficiente para depurar una release. |
| Producción | **7 días** | Cubre el ciclo habitual de una incidencia de soporte sin acumular un histórico de comportamiento de pacientes. Ampliar exige una decisión documentada. |

La retención se aplica en el almacenamiento de Jaeger (ver
[03-production-topology.md](03-production-topology.md)), no en la aplicación.

## 6. Acceso

- La UI de Jaeger **nunca** se publica en Internet sin autenticación.
- Acceso limitado al equipo de backend y de operaciones.
- Autenticación delegada en el reverse proxy (basic auth como mínimo, SSO si existe).
- TLS obligatorio en cualquier acceso desde fuera de la red privada.
- El endpoint OTLP del Collector sólo escucha en la red interna del despliegue.

## 7. Auditoría

Revisión trimestral, y obligatoria antes de activar cualquier instrumentación nueva:

1. Abrir 10 trazas al azar de producción en la UI de Jaeger.
2. Revisar todos los atributos de todos los spans contra la sección 3.
3. Ejecutar `bash scripts/verify-jaeger.sh` contra el entorno.
4. Revisar el diff de `telemetry.instrumentations.ts` desde la auditoría anterior.
5. Registrar el resultado (fecha, responsable, hallazgos) en este documento.

| Fecha | Responsable | Resultado |
| --- | --- | --- |
| _(pendiente de la primera revisión tras el despliegue en producción)_ | | |

## 8. Procedimiento ante una filtración

Si se detecta que las trazas contienen datos prohibidos:

1. **Contener.** Poner `OTEL_ENABLED=false` y redesplegar, o `OTEL_TRACES_SAMPLER=always_off`
   si se prefiere no reiniciar. Detiene la generación inmediatamente.
2. **Aislar.** Cortar el acceso a la UI de Jaeger en el reverse proxy.
3. **Determinar el alcance.** Qué atributo, desde qué despliegue, qué volumen de trazas.
4. **Purgar.** Eliminar el índice o las particiones de almacenamiento afectadas.
   Con retención de 7 días, esperar no es una opción aceptable para datos de salud.
5. **Corregir la causa.** Desactivar la instrumentación responsable o añadir la
   regla de redacción en el Collector; añadir una prueba que lo impida en el futuro.
6. **Revocar.** Si se filtraron credenciales, rotarlas (JWT secrets, SendGrid,
   Cloudinary, Hotmart) aunque no haya evidencia de uso.
7. **Documentar** el incidente: qué, cuándo, cuánto tiempo estuvo expuesto, quién
   tuvo acceso, qué se corrigió.
8. **Notificar** al responsable del tratamiento de datos si hubo datos de salud
   accesibles a terceros.

## 9. Responsables operativos

| Rol | Responsabilidad |
| --- | --- |
| Equipo de backend | Revisar que cada span nuevo cumpla esta política antes de fusionar. |
| Responsable de despliegue | Mantener Jaeger y el Collector fuera de Internet, con TLS y autenticación. |
| Responsable de datos | Aprobar cualquier cambio de retención o de acceso. |
