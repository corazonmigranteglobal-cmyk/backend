# Copia y restauración

## Copia

Un job replica la base de datos a **Neon** (PostgreSQL gestionado).

| Elemento | Dónde |
| --- | --- |
| Script | [`scripts/backup-to-neon.js`](../../scripts/backup-to-neon.js) |
| Programación | [`.github/workflows/neon-backup.yml`](../../.github/workflows/neon-backup.yml) |
| Ejecución manual | `yarn db:backup:neon` |
| Cron alternativo | `scripts/cron-backup.sh` |

## Restauración

```bash
# 1. Detener la escritura: parar la API y el worker de outbox.
# 2. Restaurar el volcado sobre la base destino.
psql "$DATABASE_URL" < backup.sql

# 3. Verificar que el esquema queda al día.
yarn db:deploy

# 4. Comprobar salud y arrancar.
curl -f "$PUBLIC_BASE_URL/health"
```

## Qué NO cubre la copia

**Los archivos subidos no están en la copia de la base de datos.** Viven en Google Cloud Storage o
en Cloudinary. La base guarda los metadatos (`file_asset`), no el contenido.

Consecuencia: restaurar la base **no** recupera los archivos. Si se pierde el bucket, los metadatos
apuntarán a objetos inexistentes. La copia del almacenamiento depende de la política de retención
del proveedor y **no está gestionada por este repositorio**.

## Deuda registrada

| Deuda | Riesgo |
| --- | --- |
| La restauración no se ensaya de forma periódica | Una copia que nunca se ha restaurado no es una copia verificada |
| Sin copia gestionada de los archivos | Pérdida irrecuperable de documentación clínica adjunta |
| Sin objetivo declarado de RPO/RTO | No hay criterio para saber si una recuperación fue aceptable |
