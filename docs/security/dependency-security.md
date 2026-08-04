# Seguridad de dependencias

## Cómo se auditan

```bash
yarn audit:dependencies
```

[`scripts/audit-production-dependencies.js`](../../scripts/audit-production-dependencies.js) filtra
por `--groups dependencies`, de modo que **sólo bloquean los avisos que afectan a producción**. Un
aviso de severidad alta o crítica devuelve código distinto de cero; los moderados se informan.

## Estado actual

| Severidad | Hallazgos |
| --- | ---: |
| Crítica | 0 |
| Alta | 0 |
| Moderada | 1 (aceptada) |

## Historia

### El auditor no se ejecutaba en Windows

Desde Node 20.12, `spawnSync` rechaza ejecutar archivos `.cmd` sin `shell: true` (endurecimiento por
CVE-2024-27980). El script invocaba `yarn.cmd` directamente y devolvía `EINVAL`, así que **la
auditoría nunca se había ejecutado en una máquina Windows** y ocultaba los hallazgos siguientes.

### Cuatro vulnerabilidades altas en rutas de producción

| Paquete | Ruta | Corrección |
| --- | --- | --- |
| `brace-expansion@1.1.15` | `sequelize-typescript > glob > minimatch` | Resolución a `^1.1.18` |
| `fast-xml-parser@5.9.3` | `@google-cloud/storage` | Resolución a `^5.10.1` |

Se usan resoluciones **dirigidas** (`@google-cloud/storage/fast-xml-parser`,
`sequelize-typescript/**/brace-expansion`) y no globales: el árbol contiene además `brace-expansion`
2.x y 5.x en dependencias de desarrollo, y forzarlas a la línea 1.x las rompería.

## Riesgo residual aceptado

### `uuid@9.0.1` vía `@google-cloud/storage > gaxios`

- **Aviso:** falta de comprobación de límites del buffer en `v3`/`v5`/`v6` **cuando se pasa el
  argumento `buf`**. Corregido en `uuid >= 11.1.1`.
- **Por qué no es alcanzable:** `gaxios` usa exclusivamente `v4()` y sin argumento `buf`
  (`node_modules/gaxios/build/src/gaxios.js:417`, su único punto de uso).
- **Por qué no se fuerza la actualización:** subir `uuid` de la línea 9 a la 11 dentro de `gaxios`
  cambia una dependencia transitiva de la ruta de subida de archivos, que no está cubierta por
  pruebas automáticas. El riesgo de regresión supera al de un aviso no alcanzable.
- **Revisión:** cuando `@google-cloud/storage` actualice `gaxios`.

## Reglas

1. `yarn audit:dependencies` forma parte de la validación; un aviso alto o crítico rompe la construcción.
2. Antes de aceptar un riesgo residual hay que **demostrar que la rama vulnerable no es alcanzable**,
   citando el punto de uso concreto. No basta con «no creemos que nos afecte».
3. Toda aceptación lleva fecha y condición de revisión.
