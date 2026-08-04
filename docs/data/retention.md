# Retención de datos

La retención se aplica hoy de forma **manual**. No hay trabajos programados de purga: es una deuda
consciente y se registra aquí para que no pase por política implantada.

## Por categoría

| Categoría | Tablas | Retención pretendida | Aplicación actual |
| --- | --- | --- | --- |
| Datos clínicos | `appointment`, `appointment_detail`, `patient_profile` | Mientras la relación terapéutica esté activa, más el plazo legal aplicable | Borrado lógico (`paranoid`); no se purga |
| Registro de auditoría | `audit_log` | Al menos 2 años | Sin purga |
| Outbox de mensajes | `message_outbox`, `message_send_log` | 90 días tras el envío | **Sin purga — la tabla crece indefinidamente** |
| Accesos a archivos | `file_access_log` | 1 año | Sin purga |
| Descargas | `downloadable_download_event` | 1 año | Sin purga |
| Analítica de interfaz | `ui_event`, `public_visit` | 1 año | Sin purga |
| Tokens de refresco | `refresh_token` | Caducan solos a los `JWT_REFRESH_EXPIRES_DAYS` (30) | Caducidad efectiva; las filas permanecen |

## Borrado lógico

Buena parte de las entidades usa `paranoid: true`, así que un borrado marca `deletedAt` y no elimina
la fila. Es deliberado —permite reconstruir un historial clínico y auditar una eliminación— pero
significa que **borrar no reduce el volumen almacenado**.

## Deuda registrada

| Deuda | Riesgo | Prioridad |
| --- | --- | --- |
| `message_outbox` sin purga | Crecimiento sin techo; degrada las consultas del panel de mensajería | Alta |
| Sin proceso de borrado real tras el plazo legal | Se conservan datos personales más allá de lo necesario | Alta |
| Sin anonimización al dar de baja una cuenta | Los datos clínicos sobreviven a la baja | Media |

Estas deudas no bloquean la operación, pero sí condicionan cualquier declaración de cumplimiento
en materia de protección de datos.
