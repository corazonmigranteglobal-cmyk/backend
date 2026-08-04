# Runbook: una migración falló

**Síntoma:** el despliegue no completa. En el log aparece un fallo del bootstrap de base de datos y
la API no acepta tráfico.

## Por qué la API no arranca

`DATABASE_BOOTSTRAP_FAIL_FAST` es `true` por defecto. Es deliberado: **una API corriendo contra un
esquema a medio migrar corrompe datos**, y eso es mucho peor que una indisponibilidad visible.

## 1. Determinar hasta dónde llegó

```sql
SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 5;
```

Compara con `ls src/database/migrations/`. La primera que no aparece es la que falló.

## 2. Leer el error real

```bash
docker logs corazon_migrante_api 2>&1 | grep -A20 -i "migrat"
```

| Error | Causa | Acción |
| --- | --- | --- |
| `relation ... already exists` | La migración se aplicó parcialmente y no quedó registrada | Paso 3 |
| `column ... contains null values` | Se añadió `NOT NULL` sin valor por defecto sobre datos existentes | Paso 4 |
| `violates foreign key constraint` | Hay datos que no cumplen la referencia nueva | Paso 4 |
| `permission denied` | El rol de base no puede hacer DDL | Corregir permisos, no la migración |
| `deadlock detected` / timeout | La migración compitió con tráfico en vivo | Reintentar sin tráfico |

## 3. Migración aplicada a medias

Es el caso más delicado: parte del DDL se ejecutó pero `SequelizeMeta` no lo registró, porque la
transacción no cerró.

```sql
-- Comprobar el estado real del esquema antes de tocar nada
\d+ nombre_de_la_tabla
```

- **Si el DDL sí se aplicó por completo:** registrar la migración como hecha.

  ```sql
  INSERT INTO "SequelizeMeta"(name) VALUES ('20260704130000-nombre.js');
  ```

- **Si se aplicó a medias:** deshacer a mano lo aplicado y volver a ejecutar. No dejes el esquema en
  un estado intermedio sin registrar; la siguiente migración partirá de una suposición falsa.

## 4. Los datos no cumplen la restricción nueva

La migración no está mal: los datos existentes no cumplen lo que exige.

```sql
-- Cuántas filas incumplen
SELECT count(*) FROM tabla WHERE columna IS NULL;
```

Decide y **deja constancia** de la decisión:

1. Rellenar los valores que faltan con un dato correcto de negocio.
2. Modificar la migración para añadir la columna como nullable, rellenar y luego endurecerla en tres
   pasos.
3. Aplazar la restricción.

La opción 2 es la correcta para una tabla con datos en producción y debería ser la norma al escribir
migraciones que endurecen columnas.

## 5. Volver a intentarlo

```bash
yarn db:deploy
```

Si prefieres arrancar la API sin ejecutar el bootstrap mientras investigas:

```bash
DATABASE_MIGRATE_ON_STARTUP=false DATABASE_SEED_BOOT_ON_STARTUP=false yarn start:prod
```

!!! danger "Sólo para investigar"
    Arrancar contra un esquema desactualizado hará que Sequelize consulte columnas que no existen.
    Úsalo para diagnosticar, nunca para dejar el servicio en pie.

## 6. Si hay que revertir

```bash
yarn db:migrate:undo    # deshace la última aplicada
```

**Comprueba antes que la migración tiene un `down` real.** Una que sólo añade columnas suele poder
revertirse; una que transforma datos, normalmente no sin pérdida. Si el `down` no existe o no es
fiable, la vía es restaurar desde copia: ver
[copia y restauración](../../data/backup-and-restore.md).

## 7. Después

- Las migraciones **no se ejecutan en `verify:ci`** (brecha
  [G-28](../../reports/documentation-gap-analysis.md)): una migración rota se descubre al desplegar.
  Si este incidente se repite, cerrar esa brecha pasa a ser prioritario.
- Comprueba que el `down` de la migración implicada funciona, antes del próximo despliegue.
