# Runbook: recuperar desde copia

**Cuándo:** la base de datos se ha perdido, corrompido o se ha aplicado un cambio destructivo que
no se puede revertir con una migración.

!!! danger "Los archivos no están en la copia"
    Este procedimiento recupera **la base de datos**. Los archivos subidos viven en GCS o
    Cloudinary y **no** están en el volcado. Si lo que se ha perdido es el bucket, este runbook no
    sirve: ver [copia y restauración](../../data/backup-and-restore.md).

## 1. Detener la escritura

Antes de tocar nada. Si la API sigue admitiendo tráfico, la recuperación parte de un blanco móvil.

```bash
# Parar API y worker de outbox en la plataforma de despliegue.
# El worker es un proceso aparte: pararlo requiere una acción propia.
```

Los mensajes del outbox que queden a medias volverán a `PENDIENTE` cuando caduque su bloqueo, así
que no hay que hacer nada especial con ellos.

## 2. Elegir el volcado

```bash
# Volcados en Neon, del más reciente al más antiguo
```

Escoge el más reciente **anterior al incidente**. Si el problema fue un cambio destructivo, el más
reciente ya lo contiene.

## 3. Ensayar antes de aplicar

**No restaures directamente sobre la base destino.** Ensáyalo primero:

```bash
yarn db:verify-restore --dump=backup.sql
```

Comprueba tablas, migraciones, datos de arranque e integridad referencial, y termina con código
distinto de cero si algo falla. Tarda segundos y evita descubrir que la copia estaba incompleta
cuando ya has borrado la original.

## 4. Restaurar

```bash
# Conservar lo que hay, por si el volcado resulta peor que el estado actual
pg_dump "$DATABASE_URL" > pre-restauracion-$(date +%Y%m%d-%H%M).sql

psql "$DATABASE_URL" < backup.sql
```

## 5. Poner el esquema al día

El volcado puede ser anterior a la última migración desplegada:

```bash
yarn db:deploy
```

Si falla, ve al [runbook de migración fallida](migracion-fallida.md).

## 6. Verificar antes de admitir tráfico

```bash
curl -f "$PUBLIC_BASE_URL/health"
```

| Respuesta | Acción |
| --- | --- |
| `ok` | Continuar |
| `degraded` por `redis` | Continuar: la caché es prescindible |
| `degraded` por `database` | **No admitir tráfico.** La restauración no ha terminado |

Comprobaciones mínimas antes de abrir:

```sql
SELECT count(*) FROM roles;        -- sin roles, los guards rechazan todo
SELECT count(*) FROM permissions;
SELECT count(*) FROM users;
SELECT count(*) FROM appointments WHERE scheduled_start_at > now();  -- citas futuras
```

## 7. Reanudar

1. Arrancar la API.
2. Arrancar el worker de outbox.
3. Vigilar la antigüedad del mensaje pendiente más antiguo: si crece, ve al
   [runbook de la cola](outbox-detenido.md).

## 8. Después

- **Comprueba los archivos.** Si hay filas en `files` que apuntan a objetos inexistentes, el
  sistema servirá enlaces rotos. La base no lo detecta sola.
- Anota el tiempo real que tomó la recuperación: es el único dato con el que se puede declarar un
  RTO honesto, que hoy no existe.
- Revisa qué se perdió entre la copia y el incidente. Ese intervalo es el RPO real.

## Lo que este runbook no puede resolver

| Situación | Por qué |
| --- | --- |
| Pérdida del bucket de archivos | No hay copia gestionada del almacenamiento |
| Recuperación a un punto intermedio | Sólo hay volcados completos, no recuperación punto en el tiempo |
| RTO garantizado | No se ha ensayado con volumen de producción |

Las tres están registradas como [G-22 y G-23](../../reports/documentation-gap-analysis.md).
