# ADR-0003: Sequelize como ORM y modelo de datos

## Estado
Aceptado

## Contexto
El backend persiste 57 entidades en PostgreSQL, con un dominio muy relacional: identidad y RBAC,
citas con historial, contenido con taxonomía, publicidad jerárquica y contabilidad por partida doble.

## Decisión
Se usa **Sequelize 6 con `sequelize-typescript`**, modelos declarados con decoradores y asociaciones
bidireccionales explícitas. El esquema **no se sincroniza** (`synchronize: false`, `autoLoadModels: false`):
la única forma de cambiar la base es una migración versionada.

## Consecuencia estructural aceptada: ciclos de importación entre modelos

Una asociación bidireccional obliga a que cada modelo importe al otro (`@BelongsTo(() => User)` y
`@HasMany(() => Appointment)`). El resultado son **nueve ciclos de importación** entre modelos,
confirmados en el grafo de conocimiento:

| Ciclo | Archivos |
| --- | ---: |
| Identidad y RBAC | 10 |
| Publicidad | 6 |
| Contenido editorial | 5 |
| Contabilidad (dos ciclos) | 2 + 2 |
| Citas, CMS, portada, catálogo | 2 cada uno |

Es un patrón **intencionado**, no deuda técnica. Queda registrado aquí para que ningún análisis
estático futuro lo reabra como hallazgo. Ver [auditoría de Graphify](../reports/graphify-audit.md).

## Consecuencias positivas

- Las asociaciones se declaran junto al modelo, no en un archivo aparte que se desincroniza.
- `associations.spec.ts` verifica que el grafo de asociaciones carga por completo.
- Los ciclos están confinados a `src/database/models/` y **no cruzan fronteras de módulo**.

## Consecuencias negativas

- No se puede mover un modelo a otro módulo sin arrastrar a sus vecinos del ciclo.
- `src/database/models/index.ts` concentra el grado más alto del grafo (175): un error ahí rompe el arranque completo.
- La extracción automática de metadatos de columna desde los decoradores no es fiable, así que el
  [catálogo de entidades](../data/entity-catalog.md) remite a las migraciones para el detalle de columnas.

## Evidencia

- [`src/database/database.module.ts`](../../src/database/database.module.ts) — `synchronize: false`
- [`src/database/models/associations.spec.ts`](../../src/database/models/associations.spec.ts)
- [Auditoría de Graphify, sección 5.1](../reports/graphify-audit.md)

## Plan de revisión
Se revisa si el número de entidades supera las 100 o si aparece un ciclo que cruce la frontera de un módulo.
