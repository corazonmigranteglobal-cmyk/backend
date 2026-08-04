# Auditoría integral del backend — plan de corrección

Revisión estricta de `src/` (25 módulos, ~225 ficheros TS) más el tooling de CI.
Todo lo listado como **implementado** está en el código y cubierto por
`yarn verify:ci`, que pasa de extremo a extremo.

## Estado antes / después

| | Antes | Después |
|---|---|---|
| `yarn lint` | 196 errores | 0 |
| `yarn typecheck` | 0 errores | 0 |
| `yarn test` | 134 pasan / 1 falla | 156 pasan / 0 fallan |
| `yarn check:secrets` | falla (3 falsos positivos) | pasa |
| `yarn verify:ci` | **rojo** | **verde** |

---

## Fase 1 — Seguridad crítica

### 1.1 Reserva de citas a nombre de otro paciente (BOLA)
`POST /appointments` era `@Roles('PATIENT')`, pero `CreateAppointmentDto`
declaraba `patientUserId` como opcional y el servicio hacía
`dto.patientUserId ?? user.sub`. Cualquier paciente autenticado podía crear
citas a nombre de otro usuario.

`patientUserId` pasa a existir sólo en `CreateAppointmentForPatientDto`
(booking asistido), de modo que `forbidNonWhitelisted` lo rechaza en la
auto-reserva, y el servicio revalida el rol como defensa en profundidad.
→ `dto/appointment.dto.ts`, `appointments.service.ts`

### 1.2 Autenticación opcional rota en rutas `@Public()`
`JwtAuthGuard` devolvía `true` **antes** de poblar `request.user`, así que
`@CurrentUser()` era siempre `undefined` en las rutas públicas. Consecuencias
reales: los archivos con visibilidad distinta de `PUBLIC` eran inaccesibles
incluso para su propio dueño o para un admin, y los suscriptores premium veían
`LOGIN_REQUIRED` en los descargables de una publicación.

Ahora en rutas públicas se resuelve el Bearer si viene, sin exigirlo ni fallar
si es inválido. → `common/guards/jwt-auth.guard.ts`

### 1.3 Fuga de PII en el directorio público de terapeutas
`GET /booking/therapists` (anónimo) devolvía el email de cada terapeuta, sin
paginar y filtrando en memoria. Se elimina el email, y búsqueda, filtro por
producto y paginación pasan a SQL. → `scheduling.service.ts`

### 1.4 Descargables no publicados expuestos
`GET /downloadables/:slug` (anónimo) resolvía por slug sin filtrar, revelando
borradores, archivados, privados y expirados. → `getPublicBySlugOrFail()`

### 1.5 Webhook de Hotmart
Firma comparada con `===` (filtra por temporización cuántos caracteres del
hottok se acertaron) y sin límite de tasa en un endpoint anónimo que concede
acceso pagado. → `timingSafeEqual` + `@Throttle`

### 1.6 Enumeración de usuarios por temporización en login
Si el email no existía no se ejecutaba `bcrypt.compare`, y la diferencia de
tiempo revelaba qué correos están registrados. Se compara siempre contra un
hash señuelo del mismo coste. → `auth.service.ts`

### 1.7 Sin detección de reutilización de refresh tokens
Presentar un refresh ya rotado sólo daba 401. Ahora revoca toda la familia de
sesiones del usuario y lo registra en auditoría. → `auth.service.ts`

### 1.8 `X-Request-Id` del cliente reflejado sin validar
Se devolvía en cabecera y se escribía en los logs tal cual, permitiendo forjar
entradas de log e inyectar cabeceras. → `common/http/request-id.ts`

---

## Fase 2 — Correctitud e integridad

### 2.1 Doble reserva del mismo hueco
`isSlotAvailable` usaba `SELECT … FOR UPDATE` para "evitar race conditions",
pero `FOR UPDATE` bloquea filas existentes y el caso a evitar es el contrario:
dos transacciones que no encuentran nada, ambas concluyen "libre" y ambas
insertan. Se sustituye por `pg_advisory_xact_lock` sobre el terapeuta, que sí
serializa a los reservantes concurrentes. → `scheduling.service.ts`

### 2.2 Rechazos sin manejar tumbaban el proceso
7 llamadas `void this.notifications.emit(...)` sin `.catch()`. Un fallo del bus
producía un unhandled rejection y Node aborta el proceso por defecto.
→ `appointments.service.ts`, `downloadables.service.ts`

### 2.3 Eventos emitidos antes de validar la transición
`submitReview` / `approveVersion` / `rejectVersion` emitían el evento antes de
comprobar si la transición era legal. → `downloadables.service.ts`

### 2.4 Correos de cita enviados al actor, no al paciente
En booking asistido el aviso iba al admin que registró la cita.
→ `appointments.service.ts`

### 2.5 Doble venta contable
`createSaleFromAppointment` comprobaba `saleTransactionId` fuera de la
transacción. Ahora recarga con `FOR UPDATE` dentro. → `accounting.service.ts`

### 2.6 Bucle infinito en disponibilidad
Un `durationMinutes` no positivo dejaba el cursor sin avanzar, colgando el
proceso desde un endpoint público. → `scheduling.service.ts`

---

## Fase 3 — Rendimiento

### 3.1 N+1 severo en `GET /admin/users`
`getUserRolesAndPermissions` por fila, y cada llamada eran 4 consultas: ~400
consultas por página de 100. Nuevo `getRolesAndPermissionsForUsers()` resuelve
la página entera en 4 consultas fijas. → `roles-permissions.service.ts`

### 3.2 Cuerpos completos de petición y respuesta en cada log
Se serializaban dos veces (sanitizado + `JSON.stringify`) en cada request, con
datos clínicos y personales acabando en disco. Pasan a nivel `debug`.
→ `response.interceptor.ts`

### 3.3 Padrón de suscriptores cargado entero en memoria
Con filtro de estado se traían **todos** los usuarios sin `LIMIT` y se filtraba
y paginaba en JS. Ahora se filtra en SQL vía join. → `content-subscribers.service.ts`
(requirió añadir la asociación inversa `User → ContentSubscriber`, que faltaba)

### 3.5 N+1 en evaluación de acceso a descargables
`evaluateAccess` por recurso, hasta 2 consultas cada uno. Se precalcula el
contexto del usuario una vez por lote. → `downloadables.service.ts`

### 3.7 Comodines LIKE sin escapar
Un `%` enviado por el cliente convertía cualquier búsqueda en un escaneo
completo. → `common/utils/like.util.ts`, aplicado en usuarios, contenido,
suscriptores y terapeutas.

---

## Fase 4 — Calidad, contratos y CI

- **`yarn lint` llevaba tiempo en rojo** (196 errores de formato), lo que dejaba
  `verify:ci` inservible. Corregido; el pipeline entero pasa.
- **`check-validation-lax.mjs` exigía lo contrario de lo que hace `main.ts`**:
  resto de un hotfix revertido, fallaba siempre. Reemplazado por
  `check-validation-strict.mjs`, que ahora **protege el fix 1.1** (el BOLA sólo
  se cierra porque `forbidNonWhitelisted` está activo) y se añade a `verify:ci`.
- **`VALIDATION_FORBID_NON_WHITELISTED` retirado**: hacer configurable la
  validación estricta permitía reabrir el 1.1 con una variable de entorno.
- **`check-no-secrets.js` reescrito**: evaluaba "¿es un placeholder?" sobre el
  fichero completo, así que la palabra "REEMPLAZAR" en cualquier línea blanqueaba
  un secreto real en otra. Ahora evalúa cada coincidencia y reporta fichero:línea.
  Verificado con un canario que contiene los 5 tipos de secreto: los detecta todos.
- **Contratos Swagger corregidos**: el registro documentaba 409 y "devuelve
  tokens" cuando responde 400 y no emite tokens; `updateUserStatus` documentaba
  `SUSPENDED`, que el código no acepta.
- **22 tests nuevos**, incluidos los de regresión de 1.1, 1.2, 1.8, 2.2, 2.4,
  3.1 y 3.7, más un test que detecta asociaciones Sequelize ausentes (fallo que
  hasta ahora sólo aparecía en ejecución).

---

## Pendiente — requiere decisión de producto o infraestructura

No implementado por quedar fuera de una corrección de código aislada:

1. **Rate limiting en memoria.** `ThrottlerModule` usa almacenamiento por
   proceso: con varias réplicas los límites de login se multiplican por el
   número de instancias y se reinician en cada despliegue. Requiere
   `@nest-lab/throttler-storage-redis` (dependencia nueva); Redis ya está
   disponible en el proyecto.
2. **SSE de notificaciones sólo en proceso.** `NotificationsService` emite por un
   `Subject` local: con más de una réplica cada admin recibe únicamente los
   eventos de la instancia a la que está conectado. Necesita Redis pub/sub.
3. **RBAC congelado en el JWT.** Roles y permisos viajan en el access token; una
   revocación no surte efecto hasta que expira (15 min). Aceptable, pero conviene
   documentarlo o añadir una versión de credenciales.
4. **`POST /publications/subscribers` es un endpoint muerto.** Es público, pero
   `buildWritePayload` exige un `userId` de paciente que el formulario anónimo no
   puede aportar: siempre responde 400. Hay que decidir si se retira o si se
   admite alta sin cuenta.
5. **`GET /booking/availability` recibe la query cruda** vía `@Req()`, saltándose
   el `ValidationPipe` por compatibilidad con el frontend legacy. La paginación
   ya se acota en el servicio, pero convendría migrarlo a un DTO.
