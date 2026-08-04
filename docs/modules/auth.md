# Módulo `auth`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/auth.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/auth/` |
| Etiqueta en la API | `Auth` |
| Operaciones HTTP | 8 |
| Controladores | 1 |
| Servicios | 3 |
| DTO | 5 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 1 |
| Roles que intervienen | — |
| Permisos que exige | — |

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

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/auth/login` | Indicador: login requiere POST | Público | — |
| `POST /api/v1/auth/login` | Iniciar sesión con email y contraseña | Público | — |
| `POST /api/v1/auth/logout` | Cerrar sesión e invalidar el refresh token | Público | — |
| `POST /api/v1/auth/password-reset/confirm` | Confirmar restablecimiento de contraseña con token recibido por email | Público | — |
| `POST /api/v1/auth/password-reset/request` | Solicitar enlace de restablecimiento de contraseña por email | Público | — |
| `POST /api/v1/auth/refresh` | Renovar access token usando un refresh token válido | Público | — |
| `POST /api/v1/auth/register/patient` | Registrar un nuevo paciente | Público | — |
| `POST /api/v1/auth/register/therapist` | Registrar un nuevo terapeuta (requiere aprobación admin) | Público | — |

## Código

**Controladores**

- [`src/modules/auth/auth.controller.ts`](../../src/modules/auth/auth.controller.ts)

**Servicios**

- [`src/modules/auth/auth-token.service.ts`](../../src/modules/auth/auth-token.service.ts)
- [`src/modules/auth/auth.service.ts`](../../src/modules/auth/auth.service.ts)
- [`src/modules/auth/password-reset.service.ts`](../../src/modules/auth/password-reset.service.ts)

**DTO**

- [`src/modules/auth/dto/login.dto.ts`](../../src/modules/auth/dto/login.dto.ts)
- [`src/modules/auth/dto/password-reset.dto.ts`](../../src/modules/auth/dto/password-reset.dto.ts)
- [`src/modules/auth/dto/refresh-token.dto.ts`](../../src/modules/auth/dto/refresh-token.dto.ts)
- [`src/modules/auth/dto/register-patient.dto.ts`](../../src/modules/auth/dto/register-patient.dto.ts)
- [`src/modules/auth/dto/register-therapist.dto.ts`](../../src/modules/auth/dto/register-therapist.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `AuthPin` — ver [catálogo de entidades](../data/entity-catalog.md)
- `PatientProfile` — ver [catálogo de entidades](../data/entity-catalog.md)
- `RefreshToken` — ver [catálogo de entidades](../data/entity-catalog.md)
- `TherapistProfile` — ver [catálogo de entidades](../data/entity-catalog.md)
- `User` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/auth/auth.service.spec.ts`](../../src/modules/auth/auth.service.spec.ts)

