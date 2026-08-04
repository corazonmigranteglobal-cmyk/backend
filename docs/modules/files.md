# Módulo `files`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/files.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/files/` |
| Etiqueta en la API | `Archivos` |
| Operaciones HTTP | 12 |
| Controladores | 2 |
| Servicios | 6 |
| DTO | 1 |
| Políticas de dominio | 0 |
| Adaptadores externos | 0 |
| Suites de prueba | 2 |
| Roles que intervienen | `ADMIN`, `SUPER_ADMIN` |
| Permisos que exige | — |

## Por qué existe

Centraliza la subida, el almacenamiento y —sobre todo— el control de acceso de los archivos. Es el
módulo con mayor proporción de lógica frente a superficie HTTP del repositorio (72 nodos de servicio
frente a 18 de controlador), y la desproporción es real: la complejidad está en decidir quién puede
ver qué, no en recibir el fichero.

## Reglas de dominio

- **Dos proveedores intercambiables**, Google Cloud Storage y Cloudinary, seleccionados por
  `STORAGE_PROVIDER`. El resto del sistema no sabe cuál está activo.
- **Subida directa desde el navegador.** Para archivos grandes se emite una firma y el cliente sube
  al proveedor sin atravesar la API; después registra el resultado.
- **Las descargas se sirven con URL firmada temporal**, no con enlaces permanentes.
- **Todo acceso queda registrado** en `file_access_log`, porque los archivos pueden contener
  documentación clínica.

## Rutas públicas con matiz

`GET /files/{id}/signed-url` y `GET /files/{id}/download` están marcadas `@Public()` a propósito: lo
que autoriza es el enlace firmado, no la sesión. Su análisis de riesgo está en el
[modelo de amenazas](../security/threat-model.md).

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/files` | Listar los archivos del sistema | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/files` | Subir un archivo a través de la API | `ADMIN`, `SUPER_ADMIN` | — |
| `DELETE /api/v1/admin/files/{id}` | Eliminar un archivo | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/files/{id}` | Consultar los metadatos de un archivo | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/files/{id}` | Actualizar los metadatos de un archivo | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/files/cloudinary/complete` | Registrar en el sistema un archivo ya subido a Cloudinary | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/files/cloudinary/signature` | Emitir una firma para subir un archivo directamente a Cloudinary | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/files` | Subir un archivo a través de la API | Autenticado | — |
| `GET /api/v1/files/{id}/download` | Descargar un archivo | Público | — |
| `GET /api/v1/files/{id}/signed-url` | Obtener una URL firmada temporal de un archivo | Público | — |
| `POST /api/v1/files/cloudinary/complete` | Registrar en el sistema un archivo ya subido a Cloudinary | Autenticado | — |
| `POST /api/v1/files/cloudinary/signature` | Emitir una firma para subir un archivo directamente a Cloudinary | Autenticado | — |

## Código

**Controladores**

- [`src/modules/files/admin-files.controller.ts`](../../src/modules/files/admin-files.controller.ts)
- [`src/modules/files/files.controller.ts`](../../src/modules/files/files.controller.ts)

**Servicios**

- [`src/modules/files/cloudinary-direct-upload.service.ts`](../../src/modules/files/cloudinary-direct-upload.service.ts)
- [`src/modules/files/file-security.service.ts`](../../src/modules/files/file-security.service.ts)
- [`src/modules/files/file-storage.service.ts`](../../src/modules/files/file-storage.service.ts)
- [`src/modules/files/files-access.service.ts`](../../src/modules/files/files-access.service.ts)
- [`src/modules/files/files-admin.service.ts`](../../src/modules/files/files-admin.service.ts)
- [`src/modules/files/files.service.ts`](../../src/modules/files/files.service.ts)

**DTO**

- [`src/modules/files/dto/file.dto.ts`](../../src/modules/files/dto/file.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `FileAccessLog` — ver [catálogo de entidades](../data/entity-catalog.md)
- `FileAsset` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/files/file-security.service.spec.ts`](../../src/modules/files/file-security.service.spec.ts)
- [`src/modules/files/files.service.spec.ts`](../../src/modules/files/files.service.spec.ts)

