# Política de documentación

## Principio

La documentación que se puede derivar del código **se deriva**, no se escribe. Lo que exige criterio
humano se escribe una sola vez y en un solo sitio.

La razón es simple: la documentación escrita a mano sobre hechos verificables se desactualiza en
silencio, y una documentación que miente es peor que no tenerla.

## Qué se genera y qué se escribe

| Artefacto | Origen | Comando |
| --- | --- | --- |
| `openapi/openapi.yaml` y `.json` | Metadatos de NestJS y decoradores | `yarn docs:openapi:generate` |
| `openapi/route-table.json` | Metadatos de NestJS | ídem |
| `docs/reports/openapi-coverage.md` | Contrato + tabla de rutas | `yarn docs:openapi:coverage` |
| `docs/modules/*.md` | Rutas, permisos, árbol de archivos | `yarn docs:modules` |
| `docs/modules/index.md` | ídem | ídem |
| `docs/data/entity-catalog.md` | Modelos y migraciones | `yarn docs:entities` |
| **Todo lo demás** | Criterio humano | — |

**Nunca se editan a mano los archivos generados.** Llevan un aviso en su cabecera. El contexto de
negocio de cada módulo se edita en `docs/modules/_context/_sourcebook.md`, que el generador inserta.

## Reglas

1. **El contrato OpenAPI no se escribe a mano.** Se genera desde el código. Un contrato escrito a
   mano es una segunda fuente de verdad, y dos fuentes de verdad son cero.
2. **La seguridad publicada se deriva de los decoradores.** No hay copia que mantener sincronizada:
   `@Public`, `@Roles` y `@Permissions` son la única fuente.
3. **Toda afirmación técnica enlaza al código que la sostiene.** `yarn docs:links` verifica que esos
   enlaces existan, incluidos los que apuntan fuera de `docs/`.
4. **Una brecha se registra, no se omite.** Si algo no está hecho, se dice, con su riesgo y su
   prioridad. Ver [análisis de brechas](../reports/documentation-gap-analysis.md).
5. **El grafo de conocimiento se reconstruye tras un cambio significativo.** Un grafo obsoleto no
   avisa de que lo está: responde con seguridad sobre un sistema anterior. Ocurrió al empezar este
   trabajo, con 87 archivos ausentes.

## Qué obliga a actualizar documentación

Una pull request que toque cualquiera de estos elementos debe regenerar los artefactos afectados:

| Cambio | Regenerar |
| --- | --- |
| Rutas, controladores o DTO | `docs:openapi:generate`, `docs:modules` |
| Decoradores de autorización | `docs:openapi:generate` |
| Modelos o migraciones | `docs:entities` |
| Nuevo módulo | `docs:modules` + su bloque en `_sourcebook.md` |
| Decisión estructural | ADR nuevo en `docs/adr/` |

## Verificación

```bash
yarn docs:validate
```

Ejecuta el lint del contrato, la cobertura de operaciones y la comprobación de enlaces. Forma parte
de CI: **un contrato incompleto o un enlace roto rompen la construcción**.
