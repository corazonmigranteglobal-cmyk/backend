# Render Sync/Cron Job: backup PostgreSQL hacia Neon

Este reemplaza el enfoque anterior de `.github/workflows/neon-backup.yml`.

## Archivo correcto

Para Render, el archivo de infraestructura como código es:

```txt
render.yaml
```

Debe quedar en la raíz del repositorio del backend. No debe ir en `.github/workflows` si el job se ejecutará en Render.

> Nota: Render no usa una carpeta `.render` como estándar para Blueprints. El estándar es `render.yaml`.

## Servicio incluido

```txt
corazon-migrante-neon-backup-sync
```

Tipo:

```txt
cron
```

Runtime:

```txt
docker
```

Comando:

```bash
yarn db:backup:neon
```

Horario configurado:

```txt
20 5 * * *
```

Equivale a 05:20 UTC, aproximadamente 01:20 Bolivia.

## Variables que debes configurar en Render

En el Cron Job de Render configura estas variables como secret/env vars:

```txt
SOURCE_DATABASE_URL
BACKUP_TARGET_DATABASE_URL
```

`SOURCE_DATABASE_URL` debe apuntar a la base origen.

`BACKUP_TARGET_DATABASE_URL` debe apuntar a la base remota destino en Neon.

El script también acepta `NEON_BACKUP_DATABASE_URL` como alias del destino, pero en este patch se usa `BACKUP_TARGET_DATABASE_URL` para respetar la configuración remota que ya venías manejando.

## Variables ya declaradas en render.yaml

```txt
NODE_ENV=production
BACKUP_CONFIRM_REMOTE_NEON=true
BACKUP_RESTORE_TO_NEON=true
BACKUP_DRY_RUN=false
BACKUP_LOCAL_RETENTION_DAYS=1
BACKUP_DIR=/tmp/backups
ALLOW_NON_NEON_BACKUP_TARGET=false
```

## Por qué se cambió Dockerfile

El script de backup usa:

```txt
pg_dump
pg_restore
```

Por eso el Dockerfile ahora instala `postgresql-client` en la imagen final y copia la carpeta `scripts` al contenedor. Sin eso, el Cron Job de Render podría construir bien, pero fallar al ejecutar el backup.

## Si lo configuras manualmente en el Dashboard

Crea un Cron Job en Render con:

```txt
Runtime: Docker
Schedule: 20 5 * * *
Command / Docker Command: yarn db:backup:neon
```

Luego agrega las variables:

```txt
SOURCE_DATABASE_URL=<origen>
BACKUP_TARGET_DATABASE_URL=<destino Neon>
BACKUP_CONFIRM_REMOTE_NEON=true
BACKUP_RESTORE_TO_NEON=true
BACKUP_DRY_RUN=false
BACKUP_LOCAL_RETENTION_DAYS=1
BACKUP_DIR=/tmp/backups
ALLOW_NON_NEON_BACKUP_TARGET=false
```

## Seguridad

El script no imprime credenciales completas. En logs solo muestra URLs enmascaradas.

Además, antes de restaurar valida que:

- origen y destino no sean la misma base;
- el destino parezca Neon;
- `BACKUP_CONFIRM_REMOTE_NEON=true` esté activo.

## Archivo de GitHub anterior

Si ya copiaste el patch previo, elimina este archivo del repo:

```txt
.github/workflows/neon-backup.yml
```

No hace falta para Render.
