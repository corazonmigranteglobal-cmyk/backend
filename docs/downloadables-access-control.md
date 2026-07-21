# Control de acceso de descargables

El backend es la única fuente de verdad. El frontend solo renderiza la `action`
devuelta por `evaluateAccess`.

## Visibilidades y acción resultante
| Visibilidad        | Usuario                    | allowed | action              |
| ------------------ | -------------------------- | ------- | ------------------- |
| PUBLIC / UNLISTED  | cualquiera                 | sí      | DIRECT_DOWNLOAD     |
| PREMIUM            | sin sesión                 | no      | LOGIN_REQUIRED      |
| PREMIUM            | sesión sin premium         | no      | UPGRADE_REQUIRED    |
| PREMIUM            | premium activo             | sí      | PREMIUM_DOWNLOAD    |
| PRIVATE            | sin asignación             | no      | NOT_AVAILABLE       |
| PURCHASE_REQUIRED  | sin compra + Hotmart cfg   | no      | HOTMART_CHECKOUT    |
| cualquiera         | ADMIN / SUPER_ADMIN        | sí      | DIRECT_DOWNLOAD     |

Reglas adicionales: recurso no `PUBLISHED` o expirado → `NOT_AVAILABLE` (salvo admin).

Premium se determina con `ContentSubscriber` (`status=ACTIVE`,
`subscriptionTier=PREMIUM`, `premiumUntil` nulo o futuro).

## Descarga segura (`resolveDownload`)
1. Registra evento `REQUESTED`.
2. `evaluateAccess`. Si no hay derecho → registra `DENIED` y lanza
   `403 DOWNLOAD_NOT_AUTHORIZED` (incluye `action` y `checkoutUrl` si aplica).
3. Con derecho → incrementa contador, registra `AUTHORIZED` y devuelve la URL
   (que en no-públicos debe ser firmada de corta duración por la infraestructura).

Nunca se devuelve la URL privada antes de comprobar el derecho.

## Evidencia
`src/modules/downloadables/downloadables.service.spec.ts` — 9 casos PASS
(público, premium con/sin membresía, sin sesión, privado, compra, admin,
denegación auditada, autorización).
