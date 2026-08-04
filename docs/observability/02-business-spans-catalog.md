# Fase 8 — Catálogo de spans de negocio

Sólo se instrumentan manualmente las operaciones que **no se entienden** mirando
los spans técnicos. Una consulta `SELECT` sobre `citas` no dice si se reservó una
cita, se rechazó por solapamiento o se denegó por permisos; el span de negocio sí.

No se instrumentan getters, listados triviales ni métodos privados de una sola
consulta: añadirían ruido sin responder ninguna pregunta.

## Convenciones

- Nombre: `<dominio>.<acción>`, minúsculas, **sin identificadores**.
- Atributos propios bajo el prefijo `app.*`.
- Los identificadores de entidad van en `app.entity.id`, nunca en el nombre.
- Ningún atributo contiene email, contraseña, token, nota clínica ni importe con pagador.

## Catálogo

### `auth.register-patient`

| Campo | Valor |
| --- | --- |
| Archivo | [auth.service.ts](../../src/modules/auth/auth.service.ts) |
| Módulo | `auth` |
| Operación | `register` |
| Atributos | `app.module=auth`, `app.operation=register`, `app.entity.type=patient`, `app.entity.id=<userId>` |
| Eventos | — |
| Motivo | El alta de paciente encadena verificación de email, hash bcrypt (coste 12, ~250 ms) y dos inserciones transaccionales. Sin el span no se distingue un alta lenta por bcrypt de una lenta por la base de datos. |
| Privacidad | **No** se registra el email ni ningún dato del perfil. El `app.entity.id` es el UUID interno. |

### `auth.register-therapist`

Igual que el anterior con `app.entity.type=therapist`. El alta queda en
`PENDING_APPROVAL`, por lo que el span también sirve para auditar el embudo de
altas profesionales.

### `auth.login`

| Campo | Valor |
| --- | --- |
| Archivo | [auth.service.ts](../../src/modules/auth/auth.service.ts) |
| Módulo | `auth` |
| Operación | `login` |
| Atributos | `app.module`, `app.operation`, `app.result` ∈ {`granted`, `invalid-credentials`, `user-disabled`}, y si hay éxito `app.entity.type=user` + `app.entity.id` |
| Eventos | — |
| Motivo | Es la operación con más incidencias de soporte. `app.result` permite separar «la plataforma falla» de «el usuario se equivoca de contraseña» sin leer un solo log. |
| Privacidad | El email **no** se registra ni siquiera en el caso fallido; hacerlo convertiría Jaeger en un listado de correos de pacientes. Tampoco se registra la IP (ya va al log de auditoría). |

### `auth.refresh` / `auth.logout`

| Campo | Valor |
| --- | --- |
| Atributos | `app.module=auth`, `app.operation` ∈ {`refresh`, `logout`} |
| Motivo | La rotación de refresh tokens detecta reuso (posible robo de token) y hace un `SELECT … FOR UPDATE`. El span acota la latencia de esa sección crítica. |
| Privacidad | **Jamás** se registra el token ni su hash. |

### `appointment.create`

| Campo | Valor |
| --- | --- |
| Archivo | [appointments.service.ts](../../src/modules/appointments/appointments.service.ts) |
| Módulo | `appointments` |
| Operación | `create` |
| Atributos | `app.module`, `app.operation`, `app.entity.type=appointment`, `app.entity.id`, `app.appointment.assisted` (booleano), `app.result=created` |
| Eventos | `appointment.persisted` (la transacción confirmó; lo que siga es best-effort) |
| Motivo | Operación crítica del producto. Cruza disponibilidad con bloqueo pesimista, creación de la cita, historial de estado, auditoría y encolado del correo, todo en una transacción. Es también el origen del salto API → worker. |
| Privacidad | **No** se registran `notesForTherapist` (comunicación privada paciente→terapeuta), ni el email del destinatario, ni el precio. `assisted` sólo indica si un admin/terapeuta reservó en nombre del paciente. |

### `appointment.update-status`

| Campo | Valor |
| --- | --- |
| Módulo | `appointments` / operación `update-status` |
| Atributos | `app.entity.type=appointment`, `app.entity.id`, `app.appointment.target_status` |
| Motivo | Las transiciones de estado están gobernadas por una política (`canTransitionAppointment`). El span muestra qué transición se intentó cuando se rechaza. |
| Privacidad | `target_status` es un enum cerrado (cardinalidad ~6). No se registra el motivo de la transición, que es texto libre del usuario. |

### `downloadable.evaluate-access`

| Campo | Valor |
| --- | --- |
| Archivo | [downloadables.service.ts](../../src/modules/downloadables/downloadables.service.ts) |
| Módulo | `downloadables` / operación `evaluate-access` |
| Atributos | `app.entity.type=downloadable-resource`, `app.entity.id`, `app.downloadable.visibility`, `app.result` ∈ {`granted`, `denied`}, `app.downloadable.action` (`DIRECT_DOWNLOAD`, `PREMIUM_DOWNLOAD`, `HOTMART_CHECKOUT`, `LOGIN_REQUIRED`, `UPGRADE_REQUIRED`, `NOT_AVAILABLE`…) |
| Motivo | «¿Por qué no puedo descargar este PDF?» es la incidencia de soporte más frecuente del módulo. La decisión combina estado de publicación, expiración, rol, entitlement, suscripción premium y compra en Hotmart. |
| Privacidad | No se registra el identificador del usuario evaluado: interesa la decisión, no quién la recibió. Ambos enums son de cardinalidad baja. |

### `downloadable.hotmart-notification`

| Campo | Valor |
| --- | --- |
| Módulo | `downloadables` / operación `hotmart-notification` |
| Atributos | `app.entity.type=external-event`, `app.event.type` = estado de Hotmart (`APPROVED`, `REFUNDED`, `CHARGEBACK`, `CANCELLED`) |
| Motivo | Webhook entrante de un tercero, idempotente y con concesión/revocación de accesos. Cuando un comprador reclama que pagó y no tiene acceso, esta traza responde si el webhook llegó, si la firma era válida y si se aplicó. |
| Privacidad | **No** se registran `buyerEmail`, `rawSignature`, `externalReference` ni el payload. |

### `outbox.enqueue` — `SpanKind.PRODUCER`

| Campo | Valor |
| --- | --- |
| Archivo | [messaging.service.ts](../../src/modules/messaging/messaging.service.ts) |
| Atributos | `app.module=messaging`, `app.operation=enqueue`, `app.entity.type=outbox-message`, `app.entity.id`, `app.event.type` = `templateCode`, `messaging.system=postgresql-outbox`, `messaging.destination.name=mensajeria.mensaje_outbox`, `messaging.operation.type=send`, `messaging.message.id` |
| Motivo | Punto en el que la traza se serializa hacia otro proceso. |
| Privacidad | `templateCode` es un enum de plantillas (`APPOINTMENT_REQUESTED`, `SMOKE_TEST_EMAIL`…). **No** se registran destinatario ni cuerpo del correo. |

### `outbox.process` — `SpanKind.CONSUMER`

| Campo | Valor |
| --- | --- |
| Atributos | los de mensajería más `app.job.attempt` y `app.result` ∈ {`sent`, `retry`, `dead`} |
| Enlace | `links[0]` apunta al span `outbox.enqueue` original (mismo `trace_id`) |
| Motivo | Responde «¿se envió el correo de esta cita y cuánto tardó desde que se reservó?». |
| Privacidad | El destinatario no se registra. El error del proveedor se guarda como estado del span, ya normalizado por `normalizeError`. |

### `scheduler.outbox-poll` — traza raíz

| Campo | Valor |
| --- | --- |
| Archivo | [outbox.worker.ts](../../src/workers/outbox.worker.ts) |
| Atributos | `app.module=messaging`, `app.operation=poll`, `app.job.name=outbox-poll`, `app.batch.size`, `app.batch.processed`, `app.batch.sent`, `app.batch.failed` |
| Motivo | El worker no se origina en ninguna petición HTTP. Cada ciclo abre su **propia traza raíz**; un único span permanente durante toda la vida del proceso sería inservible. Los ciclos vacíos generan un span barato de un solo nivel. |
| Privacidad | Sólo contadores agregados. Nunca un span por mensaje individual más allá de los del lote reclamado (acotado por `OUTBOX_BATCH_SIZE`, máximo 500). |

## Spans que se decidió NO crear

| Candidato | Motivo del descarte |
| --- | --- |
| `cache.lookup` / `cache.invalidate` | `instrumentation-ioredis` ya emite el comando con su latencia. Un span extra por `GET` duplicaría información. |
| `db.<tabla>.find` | Duplicaría los spans de `instrumentation-pg`. |
| Listados (`adminList`, `publicList`, `listMine`) | El span HTTP + los spans `pg` bastan; no hay lógica de negocio que explicar. |
| Getters y validadores | Coste de instrumentación superior al valor informativo. |
| Un span por registro en procesos por lotes | Prohibido explícitamente: reventaría la cardinalidad y el tamaño de la traza. |
