# Contexto de negocio por módulo

Este archivo es la **fuente editable** del contexto de negocio de cada módulo. `scripts/generate-module-docs.mjs`
lo divide por los marcadores `<!-- module: nombre -->` e inserta cada bloque en la página del módulo
correspondiente, encima del inventario autogenerado.

Se mantiene en un único archivo a propósito: el contexto de un módulo casi nunca se entiende sin el
de sus vecinos, y tenerlos juntos evita que diverjan.

<!-- module: auth -->
## Por qué existe

Corazón Migrante atiende a personas migrantes con datos clínicos y personales. Sin una identidad
verificable no se puede decidir quién ve la historia de quién, así que este módulo es la puerta de
entrada de todo lo demás: emite las credenciales que los tres guards globales interpretan después.

## Reglas de dominio

- **El registro no emite tokens.** Ni para pacientes ni para terapeutas. Registrarse crea la cuenta;
  iniciar sesión es un acto aparte. Evita que un registro automatizado obtenga acceso inmediato.
- **Un terapeuta nace en `PENDING_APPROVAL`.** Nadie ejerce en la plataforma sin que una persona
  administradora lo apruebe. Es una decisión de negocio, no un trámite.
- **`GET /auth/login` responde 405 a propósito.** Existe para que un cliente mal configurado reciba
  un mensaje accionable (`AUTH_LOGIN_REQUIRES_POST`) en lugar de un 404 desconcertante.
- **El restablecimiento de contraseña no confirma si el correo existe.** La respuesta es idéntica
  haya cuenta o no, para no convertir el endpoint en un verificador de direcciones.

## Límites de peticiones

Más estrictos que el global de 120/min porque son el objetivo natural de un ataque por fuerza bruta:
registro 5/hora, inicio de sesión 5/minuto, restablecimiento 5/hora.

## Efectos hacia otros módulos

Consulta `roles-permissions` para resolver los roles efectivos al emitir el token, encola en
`messaging` el correo de restablecimiento y registra cada intento en `audit`.

<!-- module: appointments -->
## Por qué existe

Es la capacidad central del producto: poner en contacto a una persona paciente con una terapeuta en
un horario concreto. Todo lo demás —catálogo, contabilidad, notificaciones— existe para sostener
este flujo o para explotarlo.

## Reglas de dominio

- **Una cita sólo se reserva sobre disponibilidad real.** El módulo consulta `scheduling` antes de
  confirmar; no hay reserva optimista.
- **Las transiciones de estado las gobierna una política explícita**
  (`policies/status-transition.policy.ts`), no condicionales dispersos. Una transición inválida
  produce un error de dominio, no un 500.
- **Toda transición queda en el historial.** `appointment_status_history` conserva quién cambió qué
  y cuándo; es información clínica y de responsabilidad, no un registro técnico.
- **Reservar en nombre de otra persona exige rol.** La validación estricta del `ValidationPipe`
  (`forbidNonWhitelisted`) se conserva precisamente porque relajarla reabría el agujero por el que
  una persona paciente podía reservar a nombre de otra.

## Efectos hacia otros módulos

Notifica al panel administrativo (`notifications`), encola correos de confirmación (`messaging`),
consulta disponibilidad (`scheduling`) y deja rastro en `audit`. Es el módulo con más dependencias
de dominio del sistema.

<!-- module: scheduling -->
## Por qué existe

Traduce la disponibilidad que declara cada terapeuta —horarios recurrentes y bloqueos puntuales— en
huecos concretos que una persona puede reservar. Sin esa traducción, `appointments` no tendría sobre
qué decidir.

## Reglas de dominio

- **Dos fuentes combinadas:** el horario semanal recurrente (`therapist_schedule`) define lo que se
  ofrece; los bloqueos (`therapist_blocked_time`) restan de él.
- **Los huecos se calculan, no se almacenan.** Evita que una agenda quede desincronizada respecto a
  los cambios de horario.
- **Las horas se persisten en UTC y se manipulan con Luxon.** El centro atiende a personas en husos
  distintos: una hora sin huso es una hora ambigua.

## Superficie pública

`BookingController` es público a propósito: alguien debe poder ver huecos libres antes de tener
cuenta. No expone identidad de pacientes ni detalles de citas existentes.

<!-- module: users -->
## Por qué existe

Gestiona el ciclo de vida de las cuentas y de los tres perfiles que puede tener una persona:
paciente, terapeuta y administradora. Separar la cuenta del perfil permite que una misma identidad
cambie de rol sin duplicar credenciales.

## Reglas de dominio

- **La cuenta y el perfil son entidades distintas.** `User` guarda credenciales y estado; el perfil
  guarda lo específico del rol (datos de paciente, enfoques de terapeuta).
- **La asignación de roles pasa siempre por `roles-permissions`.** Este módulo no inventa permisos.
- **Aprobar a un terapeuta es una operación de negocio**, no un cambio de campo: habilita su
  presencia en el catálogo público y su capacidad de recibir citas.

<!-- module: roles-permissions -->
## Por qué existe

Es la fuente única del control de acceso. Los tres guards globales (`JwtAuthGuard`, `RolesGuard`,
`PermissionsGuard`) resuelven contra este módulo, de modo que la autorización no queda repartida por
los controladores.

## Reglas de dominio

- **Roles y permisos viven en base de datos**, no en constantes del código: el catálogo puede crecer
  sin desplegar.
- **Un rol agrupa permisos; un permiso autoriza una acción concreta** (`content:write`,
  `accounting:read`). Las rutas declaran permisos siempre que es posible: es el grano fino el que
  sobrevive a una reorganización de roles.
- **No expone superficie HTTP propia.** Se administra desde `users` y se consume desde los guards.

## Consecuencia para quien integra

Cada operación protegida documenta en su descripción los roles y permisos exactos que exige, y esa
descripción se genera leyendo los decoradores del código. Ver [autorización](../api/authorization.md).

<!-- module: audit -->
## Por qué existe

Un sistema que maneja datos clínicos necesita poder responder «quién hizo qué y cuándo». Este módulo
es el registro transversal donde escriben diez de los diecinueve módulos de dominio.

## Propiedad estructural

**`audit` no importa de ningún módulo de dominio.** Recibe aristas de diez módulos y no emite
ninguna. La asimetría es deliberada: si `audit` necesitara conocer la forma de una cita, aparecería
el primer ciclo entre módulos del sistema. Ver
[dependencias entre módulos](../architecture/module-dependencies.md).

## Reglas de dominio

- **Es de sólo escritura desde el dominio.** La única superficie de lectura es la consulta
  administrativa, protegida por `audit:read`.
- **Nunca almacena el cuerpo completo de una petición.** Los datos sensibles se redactan antes de
  persistir; ver [auditabilidad](../security/auditability.md).

<!-- module: messaging -->
## Por qué existe

Garantiza que un correo prometido durante una transacción acabe enviándose, incluso si el proveedor
está caído en ese instante. Implementa el patrón *outbox*: la intención de enviar se persiste en la
misma transacción que el cambio de negocio.

## Reglas de dominio

- **Ningún handler HTTP envía correo de forma síncrona.** La respuesta al cliente nunca depende de
  que SendGrid conteste. Es la garantía central del módulo.
- **El worker es un proceso separado** (`src/workers/outbox.worker.ts`), no un temporizador dentro
  de la API. Puede escalarse o detenerse sin tocar el servicio HTTP.
- **Reintentos con retroceso exponencial** y bloqueo por lote con caducidad (`OUTBOX_STALE_LOCK_MS`),
  para que un worker que muera no deje mensajes atascados.
- **El proveedor por defecto en desarrollo es `DEV_NULL`:** no se envía correo real salvo
  configuración explícita.

Detalle en [semántica de entrega](../events/delivery-semantics.md) y
[reintentos y DLQ](../events/retries-and-dlq.md).

<!-- module: notifications -->
## Por qué existe

Avisa al panel administrativo de hechos que requieren atención humana: una cita nueva, una
cancelación, la concesión de un acceso descargable. Es distinto de `messaging`: aquí el destinatario
es el equipo interno y el canal es la propia aplicación, no el correo.

## Reglas de dominio

- **Son de lectura administrativa**, nunca visibles para pacientes.
- **No sustituyen al registro de auditoría.** Una notificación puede marcarse como leída y
  desaparecer del flujo; el rastro de auditoría es inmutable.

<!-- module: files -->
## Por qué existe

Centraliza la subida, el almacenamiento y —sobre todo— el control de acceso de los archivos. Es el
módulo con mayor proporción de lógica frente a superficie HTTP del repositorio (72 nodos de servicio
frente a 18 de controlador), y la desproporción es real: la complejidad está en decidir quién puede
ver qué, no en recibir el fichero.

## Reglas de dominio

- **Dos proveedores intercambiables**, Google Cloud Storage y Cloudinary, seleccionados por
  `STORAGE_PROVIDER`. El resto del sistema no sabe cuál está activo.
- **Subida directa desde el navegador.** Para archivos grandes se emite una firma y el cliente sube
  al proveedor sin atravesar la API; después registra el resultado.
- **Las descargas se sirven con URL firmada temporal**, no con enlaces permanentes.
- **Todo acceso queda registrado** en `file_access_log`, porque los archivos pueden contener
  documentación clínica.

## Rutas públicas con matiz

`GET /files/{id}/signed-url` y `GET /files/{id}/download` están marcadas `@Public()` a propósito: lo
que autoriza es el enlace firmado, no la sesión. Su análisis de riesgo está en el
[modelo de amenazas](../security/threat-model.md).

<!-- module: downloadables -->
## Por qué existe

Gestiona los recursos descargables de pago y los derechos de acceso que los acompañan. Es la única
integración del sistema en la que un tercero —Hotmart— llama al backend.

## Reglas de dominio

- **La compra la confirma Hotmart, no el backend.** El webhook traduce una notificación de compra o
  reembolso en la concesión o revocación de un `downloadable_entitlement`.
- **El evento externo se persiste antes de procesarse** (`downloadable_external_event`), de modo que
  una notificación puede reprocesarse sin pérdida si el procesamiento falla.
- **Los recursos tienen versiones.** Una descarga apunta a una versión concreta, para que actualizar
  un material no invalide lo que alguien ya compró.
- **Cada descarga se registra** (`downloadable_download_event`), tanto para soporte como para
  detectar el abuso de un derecho compartido.

## Superficie de riesgo

`POST /webhooks/hotmart` es pública y de escritura. Concentra riesgo y su tratamiento está en el
[modelo de amenazas](../security/threat-model.md).

<!-- module: content -->
## Por qué existe

Es el módulo más grande del sistema (164 nodos). Sostiene la publicación editorial: noticias,
columnas de opinión, su taxonomía, las personas suscriptoras y el acceso premium.

## Reglas de dominio

- **El estado de una publicación lo gobierna una política explícita**
  (`policies/publication-status.policy.ts`): `DRAFT → IN_REVIEW → SCHEDULED → PUBLISHED → ARCHIVED`.
- **La visibilidad es una dimensión aparte del estado.** Una publicación puede estar `PUBLISHED` y
  ser `PREMIUM`: publicada, pero legible sólo por quien tenga suscripción activa.
- **La suscripción premium se aprueba a mano.** El pago se verifica fuera de banda —QR e
  instrucciones configurables— y una persona administradora la activa. No hay pasarela automática
  para este flujo.
- **Los alias públicos existen por compatibilidad.** `PublicContentAliasController` duplica rutas
  bajo `/public/content` para frontends antiguos; están documentadas como tales y no reciben
  funcionalidad nueva.

<!-- module: advertising -->
## Por qué existe

Sostiene la financiación del proyecto editorial: empresas anunciantes contratan campañas que se
muestran en emplazamientos concretos del sitio público.

## Reglas de dominio

- **La jerarquía es empresa → campaña → creatividad → emplazamiento.** Una campaña sin creatividad
  asociada no se muestra.
- **Las fechas de campaña las valida una política explícita**
  (`policies/campaign-date.policy.ts`): una campaña no puede terminar antes de empezar ni activarse
  fuera de su ventana.
- **Las impresiones se registran** (`ads_impression`) para poder justificar lo facturado.
- **La resolución pública no expone datos del anunciante**, sólo la creatividad que toca mostrar.

<!-- module: cms -->
## Por qué existe

Permite editar las páginas estáticas del sitio público —quiénes somos, servicios, contacto— sin
desplegar código.

## Reglas de dominio

- **Una página es un contenedor de elementos ordenados**, no un bloque de HTML. Así el frontend
  decide cómo renderizar cada tipo de elemento.
- **Sólo se sirven públicamente las páginas publicadas.** El listado administrativo ve todas.
- **`AdminPublicPagesController` es un dominio distinto de `AdminCmsController`**: el primero
  gestiona páginas con entradas asociadas; el segundo, páginas con elementos. Comparten etiqueta en
  la API por cercanía funcional, no por compartir modelo.

<!-- module: homepage -->
## Por qué existe

Compone la portada del sitio público a partir de contenido que pertenece a otros módulos. No tiene
dominio propio de peso: su valor es decidir qué se destaca y en qué orden.

## Reglas de dominio

- **Es un módulo de composición.** Lee de `content` y de `advertising`; no crea publicaciones ni
  campañas.
- **La previsualización muestra cambios sin publicar**, para poder revisar la portada antes de que
  la vea el público.

<!-- module: therapy-catalog -->
## Por qué existe

Define qué se ofrece: los productos terapéuticos (sesiones, programas) y los enfoques que practican
las terapeutas. Es lo que una persona paciente consulta antes de reservar.

## Reglas de dominio

- **El catálogo público sólo muestra lo activo.** El listado administrativo ve todo.
- **Un producto terapéutico tiene precio y duración**, y esos dos datos son los que `appointments`
  y `accounting` usan después: cambiarlos afecta a reservas futuras, nunca a las ya registradas.

<!-- module: accounting -->
## Por qué existe

Registra el movimiento económico del centro con partida doble: plan de cuentas, asientos,
transacciones, ventas y centros de coste.

## Reglas de dominio

- **Partida doble real.** Una transacción agrupa asientos que deben cuadrar; no se persiste una
  transacción descuadrada.
- **La venta se genera desde la cita atendida**, no al reservarla:
  `POST /admin/accounting/transactions/from-appointment/{appointmentId}`. Facturar una cita que no
  se prestó sería un error contable.
- **El plan de cuentas es jerárquico** (`account_group` → `account`).

<!-- module: analytics -->
## Por qué existe

Recoge señales de uso del sitio público —eventos de interfaz y visitas— para decidir con datos qué
contenido funciona.

## Reglas de dominio

- **El registro de eventos es público y con límite estricto** (60 por minuto): lo llama el navegador
  de cualquier visitante.
- **No identifica personas.** Los eventos no llevan identidad de usuario; sirven para agregados, no
  para seguimiento individual.

<!-- module: health -->
## Por qué existe

Da a orquestadores y balanceadores una respuesta fiable sobre si el proceso puede atender tráfico.

## Reglas de dominio

- **Vive fuera del prefijo `api/v1`.** `/health` está en la raíz porque quien la consulta no conoce
  el prefijo versionado y a menudo no puede configurarlo. La exclusión es una constante compartida
  entre `main.ts` y la generación del contrato (`src/config/http-routes.ts`).
- **Distingue `ok` de `degraded`.** Si Redis está caído pero PostgreSQL responde, el servicio sigue
  siendo útil: devuelve `degraded`, no un fallo.

<!-- module: legacy-compatibility -->
## Por qué existe

Conserva rutas que clientes antiguos siguen llamando, para no romperlos mientras migran.

## Reglas de dominio

- **No recibe funcionalidad nueva.** Cualquier cambio aquí es para mantener viva una ruta existente.
- **Su existencia es temporal por definición.** La política de retirada está en
  [política de deprecación](../api/deprecation-policy.md).
