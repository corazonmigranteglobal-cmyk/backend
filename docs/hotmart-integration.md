# Integración con Hotmart

Integración desacoplada mediante `HotmartAdapter`. No se hardcodean enlaces ni
secretos en componentes ni en tablas de contenido.

## Configuración por recurso (no sensible)
`hotmartProductId`, `hotmartOfferId`, `hotmartCheckoutUrl`, `externalReference`,
`integrationStatus`. Se setean con `PUT /admin/downloadables/:id/hotmart`.

## Secretos (solo backend, variables de entorno)
| Variable                | Uso                                  |
| ----------------------- | ------------------------------------ |
| HOTMART_CLIENT_ID       | credencial de API                    |
| HOTMART_CLIENT_SECRET   | credencial de API                    |
| HOTMART_WEBHOOK_SECRET  | verificación de firma (hottok/HMAC)  |
| HOTMART_ENV             | `sandbox` \| `production`            |

Sin credenciales, el adaptador queda `unconfigured`: expone contratos y
validadores pero **no confirma compras reales** (`verifyNotification` devuelve
`valid:false`). Esto permite construir y probar el resto del módulo.

## Flujo de confirmación (contrato listo)
1. Webhook entrante → `verifyNotification` (idempotencia por `eventId`, firma).
2. `grantsAccess`/`revokesAccess` según `status` (APPROVED / REFUNDED / …).
3. Alta o revocación del entitlement del usuario (tabla dedicada: PENDIENTE).

No se simula una compra como confirmada.
