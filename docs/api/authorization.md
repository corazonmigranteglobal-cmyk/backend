# Autorización

## Cómo se decide

Cuatro guards globales, registrados en [`src/app.module.ts`](../../src/app.module.ts) en este orden:

1. **`ThrottlerGuard`** — límite de peticiones. Va primero a propósito: quien no está autenticado no
   debe poder consumir el coste de validar tokens.
2. **`JwtAuthGuard`** — valida el token salvo que la ruta o el controlador declaren `@Public()`.
3. **`RolesGuard`** — comprueba `@Roles(...)`.
4. **`PermissionsGuard`** — comprueba `@Permissions(...)`.

Se aplican a **todas** las rutas. Una ruta nueva nace protegida: hay que declarar `@Public()`
explícitamente para abrirla, no al revés.

## Roles y permisos

- Un **rol** agrupa permisos y describe una función: `PATIENT`, `THERAPIST`, `ADMIN`,
  `SUPER_ADMIN`, `ACCOUNTANT`.
- Un **permiso** autoriza una acción concreta: `content:write`, `accounting:read`,
  `appointments:write`.

Ambos viven en base de datos (módulo [`roles-permissions`](../modules/roles-permissions.md)), no en
constantes del código, de modo que el catálogo puede crecer sin desplegar.

**Las rutas declaran permisos siempre que es posible**, no roles. El grano fino sobrevive a una
reorganización de roles; el grueso, no.

## Dónde consultarlo

No hay que leer el código: **cada operación protegida publica en su descripción los roles y permisos
exactos que exige**, y esa descripción la genera `scripts/generate-openapi.ts` leyendo los
decoradores `@Public`, `@Roles` y `@Permissions` del propio handler.

Consecuencia práctica: el contrato no puede desviarse del comportamiento. Si alguien quita un
`@Permissions`, la operación deja de anunciarlo en la siguiente generación y el diff lo delata.

La tabla completa de operación → roles → permisos está en cada
[página de módulo](../modules/index.md) y en la referencia interactiva de `/docs`.

## Cifras actuales

| Dato | Valor |
| --- | ---: |
| Operaciones totales | 189 |
| Públicas (`@Public()`) | 38 |
| Requieren token | 151 |

## Qué recibe el cliente

| Situación | Respuesta |
| --- | --- |
| Sin token, o token expirado o inválido | `401` con `error.code` de la familia `UNAUTHORIZED` |
| Token válido, rol o permiso insuficiente | `403 FORBIDDEN` |

La distinción importa: `401` significa «vuelve a autenticarte»; `403`, «no insistas con esta
identidad».
