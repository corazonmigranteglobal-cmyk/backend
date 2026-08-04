# Autenticación

El backend emite sus propios JWT: no hay proveedor de identidad externo.

## Obtener acceso

```bash
curl -X POST "$API/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"persona@example.com","password":"..."}'
```

Devuelve, dentro del sobre habitual:

| Campo | Para qué |
| --- | --- |
| `accessToken` | Va en `Authorization: Bearer …`. Vive 15 minutos |
| `refreshToken` | Sirve para obtener un par nuevo. Vive 30 días |
| `refreshTokenId` | Identifica ese token de refresco, para revocarlo de forma selectiva |
| `expiresIn` | Segundos de vida del token de acceso |
| `user` | Identidad con sus roles y permisos **ya resueltos** |

Que `user` traiga roles y permisos evita que el cliente tenga que pedirlos aparte para decidir qué
mostrar. No sustituye a la comprobación del servidor: la autorización se evalúa en cada petición.

## Usar el token

```bash
curl "$API/api/v1/appointments/mine" -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Renovar

```bash
curl -X POST "$API/api/v1/auth/refresh" \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"..."}'
```

**Rotación:** cada renovación invalida el token de refresco usado y emite uno nuevo. Si un token ya
gastado vuelve a aparecer, es señal de robo.

## Cerrar sesión

`POST /api/v1/auth/logout` revoca el token de refresco.

!!! warning "El token de acceso sigue siendo válido hasta que caduca"
    No hay lista de revocación de tokens de acceso. Cerrar sesión impide **renovar**, pero el token
    en curso funciona hasta 15 minutos más.

    Es una decisión de diseño: comprobar una lista de revocación en cada petición añadiría una
    consulta al camino crítico de las 189 operaciones. La ventana corta es la mitigación. Registrado
    en el [modelo de amenazas](../security/threat-model.md).

## Registro

| Ruta | Resultado |
| --- | --- |
| `POST /auth/register/patient` | Cuenta `ACTIVE` |
| `POST /auth/register/therapist` | Cuenta `PENDING_APPROVAL` |

**Ninguno emite tokens.** Registrarse crea la cuenta; iniciar sesión es un acto aparte. Evita que un
registro automatizado obtenga acceso inmediato.

Un terapeuta no puede operar hasta que una persona administradora lo apruebe.

## Restablecer contraseña

1. `POST /auth/password-reset/request` — envía un PIN por correo si la cuenta existe.
2. `POST /auth/password-reset/confirm` — valida el PIN y aplica la contraseña nueva.

!!! info "La respuesta del paso 1 es idéntica exista o no la cuenta"
    Confirmar la existencia convertiría el endpoint en un verificador de direcciones de correo.

El PIN vive `PASSWORD_RESET_EXPIRY_MINUTES` (15 por defecto) y admite
`PASSWORD_RESET_MAX_ATTEMPTS` intentos (5).

## Límites específicos

Más estrictos que el global de 120/min, porque son el objetivo natural de un ataque por fuerza
bruta:

| Operación | Límite |
| --- | --- |
| `POST /auth/login` | 5 por minuto |
| `POST /auth/register/*` | 5 por hora |
| `POST /auth/password-reset/*` | 5 por hora |

## Contenido del token

El token de acceso incluye `sub`, `email`, `roles`, `permissions`, `status`, `tokenType`, más
emisor y audiencia.

!!! danger "No confíes en el contenido del token sin verificar la firma"
    Un JWT es legible por cualquiera. Los roles que lleva sirven para que la interfaz decida qué
    mostrar; **nunca** para que un servicio decida qué permitir.

## Errores

| HTTP | `error.code` | Significado |
| --- | --- | --- |
| 401 | familia `UNAUTHORIZED` | Falta el token, está expirado o no es válido |
| 403 | `FORBIDDEN` | El token vale pero falta el rol o el permiso |
| 405 | `AUTH_LOGIN_REQUIRES_POST` | Se llamó a `GET /auth/login` |
| 429 | `HTTP_429` | Se superó el límite |

La distinción entre 401 y 403 importa: el primero significa «vuelve a autenticarte»; el segundo, «no
insistas con esta identidad».

Ver [autorización](authorization.md) para los roles y permisos de cada operación.
