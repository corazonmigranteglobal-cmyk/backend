# Módulos de dominio

El backend agrupa su lógica en 19 módulos bajo `src/modules/`. Esta tabla se genera con `yarn docs:modules`; las cifras salen de los metadatos reales de NestJS.

| Módulo | Etiqueta en la API | Operaciones | Servicios | Suites de prueba |
| --- | --- | ---: | ---: | ---: |
| [`accounting`](accounting.md) | `Contabilidad` | 9 | 1 | 1 |
| [`advertising`](advertising.md) | `Publicidad` | 23 | 5 | 1 |
| [`analytics`](analytics.md) | `Analítica` | 2 | 1 | 1 |
| [`appointments`](appointments.md) | `Citas` | 7 | 1 | 2 |
| [`audit`](audit.md) | `Auditoría` | 1 | 1 | 0 |
| [`auth`](auth.md) | `Auth` | 8 | 3 | 1 |
| [`cms`](cms.md) | `CMS` | 15 | 1 | 1 |
| [`content`](content.md) | `Contenido` | 36 | 6 | 2 |
| [`downloadables`](downloadables.md) | `Descargables` | 28 | 1 | 1 |
| [`files`](files.md) | `Archivos` | 12 | 6 | 2 |
| [`health`](health.md) | `Salud` | 2 | 1 | 1 |
| [`homepage`](homepage.md) | `Portada` | 3 | 1 | 0 |
| [`legacy-compatibility`](legacy-compatibility.md) | `Compatibilidad legacy` | 1 | 0 | 0 |
| [`messaging`](messaging.md) | `Mensajería` | 8 | 2 | 2 |
| [`notifications`](notifications.md) | `Notificaciones` | 5 | 1 | 0 |
| [`roles-permissions`](roles-permissions.md) | — | 0 | 1 | 1 |
| [`scheduling`](scheduling.md) | `Agenda` | 11 | 1 | 1 |
| [`therapy-catalog`](therapy-catalog.md) | `Catálogo terapéutico` | 9 | 1 | 1 |
| [`users`](users.md) | `Usuarios` | 9 | 1 | 1 |

**Totales:** 189 operaciones, 35 servicios, 19 suites de prueba.

Las relaciones entre módulos están en [Dependencias entre módulos](../architecture/module-dependencies.md).
