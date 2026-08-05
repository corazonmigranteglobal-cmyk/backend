# Runbook: copia y verificación de los archivos

Los archivos subidos **no están en el volcado de PostgreSQL**. La tabla `files` guarda metadatos; el
contenido vive en Cloudinary o en Google Cloud Storage. Restaurar la base no los recupera.

Este runbook cubre lo que sí se puede hacer desde el repositorio.

## Comprobación periódica

```bash
yarn files:check:cloudinary    # Cloudinary
yarn files:check               # Google Cloud Storage
```

Contrastan la tabla `files` con lo que hay realmente en el proveedor, en ambos sentidos:

| Hallazgo | Qué significa | Gravedad |
| --- | --- | --- |
| **Metadatos sin objeto** | La API servirá un enlace roto. Nadie se entera hasta que alguien lo pulsa | Alta |
| **Objetos sin metadato** | Almacenamiento que se paga y nadie referencia | Baja, pero conviene revisarlo |

`files:check:cloudinary` termina con código distinto de cero si hay metadatos sin objeto, así que se
puede programar.

### Última comprobación

| Dato | Valor |
| --- | --- |
| Fecha | 4 de agosto de 2026 |
| Recursos en Cloudinary | 111 (95 imágenes, 4 vídeos, 12 sin procesar) |
| Volumen | 180,9 MB |
| Referenciados por la base | 5 |
| Metadatos sin objeto | **0** |
| Objetos sin metadato | 106 |

Los 106 sin referencia son, con toda probabilidad, recursos de la portada subidos con
`scripts/upload-landing-assets.mjs` y restos de pruebas. No son un fallo, pero **también se
perderían** si se perdiera la cuenta, y ocupan la mayor parte de esos 180 MB.

## Copia

```bash
# Cloudinary: descarga todo a un directorio local, con manifiesto
yarn files:backup:cloudinary --out=./backup-archivos

# GCS: replica a un bucket secundario
yarn files:replicate --target=<bucket-de-copia>
```

La descarga de Cloudinary es **reanudable**: no vuelve a bajar lo que ya está en el destino con el
mismo tamaño, así que se puede relanzar sin penalización.

El `manifiesto.json` que escribe es lo que permite reconstruir la correspondencia entre el
`object_key` que guarda la base y el archivo en disco. **Sin él la copia es un montón de archivos
sin relación con nada.**

## Restaurar archivos

No hay automatismo. El procedimiento es:

1. Localizar en `manifiesto.json` los `public_id` que hay que reponer.
2. Volver a subirlos al proveedor **conservando el mismo `public_id`**: la base los referencia por
   esa clave y cambiarla dejaría el enlace roto igualmente.
3. Ejecutar `yarn files:check:cloudinary` para confirmar que no queda ningún metadato sin objeto.

## Lo que falta y por qué importa

| Deuda | Estado |
| --- | --- |
| Versionado o replicación gestionada en el proveedor | **Sin configurar** |
| Copia programada de los archivos | Sin programar: hoy es manual |
| Ensayo de restauración de archivos | Nunca hecho |

Mientras el proveedor no tenga versionado, un borrado accidental —o una credencial comprometida— es
irreversible. La copia manual reduce el daño, pero depende de que alguien se acuerde de ejecutarla.

Es la razón por la que el backend sigue declarado **no apto para producción**: ver
[preparación para producción](../../reports/production-readiness.md).

## Cómo cerrarlo del todo

Ninguna de estas acciones es código:

1. **Cloudinary:** activar la copia gestionada del plan, o programar
   `yarn files:backup:cloudinary` en un cron con destino externo.
2. **Google Cloud Storage:** activar versionado de objetos y una regla de ciclo de vida, o
   programar `yarn files:replicate` contra un bucket en otra región.
3. **Ensayar** una restauración real de al menos un archivo y dejar constancia aquí.
