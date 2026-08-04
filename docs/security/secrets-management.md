# Gestión de secretos

## Principios

1. **Ningún secreto se versiona.** `yarn check:secrets` recorre los archivos versionables buscando
   patrones de credencial y forma parte de `verify:ci`.
2. **La configuración se valida al arrancar.** Si falta un secreto obligatorio, el proceso no
   arranca y dice cuál falta. Es preferible a arrancar mal configurado.
3. **Fallo cerrado.** Sin `HOTMART_WEBHOOK_SECRET` el webhook rechaza todo; sin `SENDGRID_API_KEY`
   la validación de entorno impide arrancar con SendGrid activo.

## Dónde viven

| Entorno | Mecanismo |
| --- | --- |
| Local | `.env`, ignorado por git. Plantilla en `.env.example` |
| Producción | Variables de entorno de la plataforma (Render / VPS). Plantilla en `.env.production.example` |

Las plantillas contienen **nombres y formatos, nunca valores**.

## Credenciales de Google Cloud

[`google-credentials.config.ts`](../../src/config/google-credentials.config.ts) acepta el JSON de la
cuenta de servicio en base64 (`GOOGLE_CREDENTIALS_BASE64`) o una ruta a archivo. El contenido
**nunca se registra en logs**, ni siquiera con `LOG_LEVEL=debug`.

## Rotación

Procedimiento en [runbook de rotación de credenciales](CREDENTIAL_ROTATION_RUNBOOK.md).

Rotar es obligatorio cuando: una persona con acceso deja el proyecto, un secreto aparece en un log
o en un canal de chat, o una dependencia del proveedor sufre un incidente.

## Secretos que existen hoy

| Variable | Qué protege | Impacto si se filtra |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | Emisión de tokens de acceso | Suplantación total. Rotar invalida todos los tokens vivos |
| `JWT_REFRESH_SECRET` | Renovación de sesión | Suplantación persistente. Debe ser distinta de la anterior |
| `DATABASE_PASSWORD` | Acceso a todos los datos | Máximo |
| `SENDGRID_API_KEY` | Envío de correo | Suplantación del remitente del centro |
| `GOOGLE_CREDENTIALS_BASE64` | Buckets de archivos | Acceso a documentación clínica |
| `CLOUDINARY_API_SECRET` | Almacenamiento alternativo | ídem |
| `HOTMART_WEBHOOK_SECRET` | Autenticidad del webhook de compras | Concesión fraudulenta de accesos de pago — ver [A-1](threat-model.md) |
