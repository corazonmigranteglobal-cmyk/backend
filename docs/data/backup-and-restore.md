# Copia y restauración

## Copia de la base de datos

| Elemento | Dónde |
| --- | --- |
| Script | [`scripts/backup-to-neon.js`](../../scripts/backup-to-neon.js) |
| Programación | [`.github/workflows/neon-backup.yml`](../../.github/workflows/neon-backup.yml) |
| Ejecución manual | `yarn db:backup:neon` |
| Cron alternativo | `scripts/cron-backup.sh` |
| Destino | Neon (PostgreSQL gestionado) |

## Ensayo de restauración

Una copia que nunca se ha restaurado no es una copia verificada. Por eso el ensayo está
automatizado, no descrito en prosa:

```bash
# 1. Obtener un volcado
pg_dump "$DATABASE_URL" > backup.sql

# 2. Ensayar la restauración sobre una base desechable
yarn db:verify-restore --dump=backup.sql

# Si psql no está instalado en la máquina, se puede usar el contenedor:
yarn db:verify-restore --dump=backup.sql --docker=corazon_migrante_postgres
```

[`scripts/verify-restore.mjs`](../../scripts/verify-restore.mjs) crea una base desechable, restaura
el volcado y comprueba:

1. Que las **13 tablas imprescindibles** existen.
2. Que las migraciones quedan registradas en `SequelizeMeta`.
3. Que hay **roles y permisos**: sin ellos los guards rechazan todo y el sistema restaurado es
   inútil aunque el esquema esté completo.
4. Que **ninguna clave foránea queda sin validar**.
5. Cuántos archivos referencia la base, para advertir de lo que la copia no cubre.

Termina con código distinto de cero si algo falla, así que puede programarse.

### Último ensayo

| Dato | Valor |
| --- | --- |
| Fecha | 4 de agosto de 2026 |
| Entorno | PostgreSQL 16 local, esquema completo con datos de arranque |
| Volcado | 149 KB |
| Tiempo de restauración | 1 s |
| Tablas verificadas | 13/13 |
| Roles / permisos | 7 / 24 |
| Claves foráneas sin validar | 0 |
| Resultado | **CORRECTO** |

!!! note "El primer ensayo falló, y por eso sirve"
    La primera ejecución reportó «falta la tabla `file_assets`». No faltaba: el modelo `FileAsset`
    mapea a la tabla **`files`**, y la comprobación asumía otro nombre. Un procedimiento escrito a
    mano habría arrastrado ese error sin que nadie lo notara hasta el día de la recuperación real.

!!! warning "Este ensayo no sustituye al de producción"
    Se ejecutó sobre una base local con datos de arranque, no sobre un volcado de producción con su
    volumen real. Falta ensayarlo contra una copia de Neon para medir el tiempo real de
    restauración y poder declarar un RTO honesto.

## Lo que la copia NO cubre

**Los archivos subidos no están en el volcado de la base de datos.** Viven en Google Cloud Storage o
en Cloudinary; la tabla `files` guarda los metadatos, no el contenido.

Consecuencia: restaurar la base **no** recupera los archivos. Si se perdiera el bucket, las filas de
`files` apuntarían a objetos inexistentes y el sistema serviría enlaces rotos a documentación
clínica.

El script lo advierte de forma explícita cuando encuentra filas en `files`, para que nadie confunda
un ensayo correcto con una recuperación completa.

### Qué hace falta

No es trabajo de este repositorio: es configuración del proveedor.

| Proveedor | Mecanismo | Estado |
| --- | --- | --- |
| Google Cloud Storage | Versionado de objetos más regla de ciclo de vida, o replicación a un bucket secundario | **Sin configurar**. Hay herramienta: `yarn files:replicate` |
| Cloudinary | Copia gestionada del plan, o exportación programada | **Sin configurar**. Hay herramienta: `yarn files:backup:cloudinary` |

Procedimiento completo en el [runbook de copia de archivos](../operations/runbooks/copia-de-archivos.md).

Hasta que exista, la recuperación ante desastre está incompleta y el backend no puede declararse
apto para producción. Ver [preparación para producción](../reports/production-readiness.md).

## Restauración real

```bash
# 1. Detener la escritura: parar la API y el worker de outbox.
# 2. Restaurar el volcado sobre la base destino.
psql "$DATABASE_URL" < backup.sql

# 3. Verificar que el esquema queda al día.
yarn db:deploy

# 4. Comprobar salud antes de admitir tráfico.
curl -f "$PUBLIC_BASE_URL/health"
```

Si `/health` devuelve `degraded` por `redis`, el servicio es utilizable: la caché es prescindible.
Si es por `database`, la restauración no ha terminado.

## Objetivos de recuperación

**No hay RPO ni RTO declarados.** Sin ellos no existe criterio para saber si una recuperación fue
aceptable. Lo que se puede afirmar hoy:

| Medida | Valor observado |
| --- | --- |
| Tiempo de restauración (base local, 149 KB) | 1 s |
| Frecuencia de copia | La que fije el workflow de Neon |
| Pérdida máxima de datos | Igual al intervalo entre copias |
| Recuperación de archivos | **No disponible** |

Declararlos exige ensayar sobre un volcado de producción. Registrado como
[G-22](../reports/documentation-gap-analysis.md).

## Deuda registrada

| Deuda | Riesgo | Brecha |
| --- | --- | --- |
| El ensayo no se ha hecho contra un volcado de producción | El RTO real es desconocido | G-22 |
| Sin copia gestionada de los archivos | Pérdida irrecuperable de documentación clínica | G-23 |
| Sin RPO/RTO declarados | No hay criterio de aceptación de una recuperación | G-22 |
| El ensayo no está programado | Puede dejar de funcionar sin que nadie se entere | G-22 |
