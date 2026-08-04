#!/usr/bin/env node
/**
 * Genera `docs/data/entity-catalog.md` leyendo los modelos de
 * `src/database/models/` y las migraciones de `src/database/migrations/`.
 *
 * Extrae de cada modelo: tabla, columnas con tipo y nulabilidad, valores
 * permitidos de los enum, claves foráneas, asociaciones e índices declarados,
 * y en qué migración aparece la tabla por primera vez.
 *
 * Uso: yarn docs:entities
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS_DIR = join(ROOT, 'src', 'database', 'models');
const MIGRATIONS_DIR = join(ROOT, 'src', 'database', 'migrations');
const OUT = join(ROOT, 'docs', 'data', 'entity-catalog.md');

/** Índice tabla -> primera migración que la crea. */
const createdIn = new Map();
for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
  const src = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  for (const m of src.matchAll(/createTable\(\s*['"`]([\w_]+)['"`]/g)) {
    if (!createdIn.has(m[1])) createdIn.set(m[1], file);
  }
}

/**
 * Extrae las columnas de un modelo `sequelize-typescript`.
 *
 * Los decoradores ocupan varias líneas (`@Column({ type: …, allowNull: … })`),
 * así que no basta con recoger las líneas que empiezan por `@`: se acumula
 * **todo** el texto desde la declaración anterior y se analiza en bloque.
 */
function parseColumns(src) {
  const columns = [];
  const lines = src.split(/\r?\n/);
  let buffer = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const decl = /^(?:declare\s+|readonly\s+)?(\w+)(!|\?)?\s*:\s*(.+?);$/.exec(trimmed);

    // Sólo cuenta como declaración de propiedad si veníamos de decoradores.
    if (!decl || !buffer.some((l) => l.trim().startsWith('@'))) {
      buffer.push(line);
      // Un cierre de método o de clase corta la acumulación.
      if (trimmed === '}' || trimmed === '') {
        if (!buffer.some((l) => /@\w+\($/.test(l.trim()) || l.trim().startsWith('@'))) buffer = [];
      }
      continue;
    }

    const decorators = buffer.join('\n');
    buffer = [];
    if (!/@(Column|ForeignKey|CreatedAt|UpdatedAt|DeletedAt|PrimaryKey)/.test(decorators)) continue;
    // El bloque debe pertenecer a esta propiedad: si contiene otra declaración
    // de propiedad, es que arrastramos ruido y se descarta.
    const optional = decl[2] === '?';

    const typeMatch = /DataType\.(\w+)(?:\(([^)]*)\))?/.exec(decorators);
    const enumValues = [...decorators.matchAll(/'([A-Z][A-Z0-9_]*)'/g)].map((m) => m[1]);
    const fk = /@ForeignKey\(\(\)\s*=>\s*(\w+)\)/.exec(decorators);

    columns.push({
      name: decl[1],
      tsType: decl[3].trim(),
      sqlType: typeMatch ? typeMatch[1] + (typeMatch[2] ? `(${typeMatch[2]})` : '') : '—',
      nullable: /allowNull:\s*true/.test(decorators) || optional,
      primary: /@PrimaryKey|primaryKey:\s*true/.test(decorators),
      unique: /@Unique|unique:\s*true/.test(decorators),
      defaultValue: (/defaultValue:\s*([^,}]+)/.exec(decorators) ?? [])[1]?.trim(),
      foreignKey: fk ? fk[1] : null,
      enumValues: /DataType\.ENUM/.test(decorators) ? enumValues : [],
      timestamps: /@(CreatedAt|UpdatedAt|DeletedAt)/.test(decorators),
    });
  }
  return columns;
}

const files = readdirSync(MODELS_DIR)
  .filter((f) => f.endsWith('.model.ts') && !f.includes('.spec.'))
  .sort();

const entities = [];
for (const file of files) {
  const src = readFileSync(join(MODELS_DIR, file), 'utf8');
  const className = (/export class (\w+)/.exec(src) ?? [])[1];
  if (!className) continue;
  const tableName = (/tableName:\s*'([\w_]+)'/.exec(src) ?? [])[1] ?? '—';
  const paranoid = /paranoid:\s*true/.test(src);
  const timestamps = !/timestamps:\s*false/.test(src);
  const indexes = [...src.matchAll(/@Index\(([^)]*)\)/g)].length;
  const associations = [
    ...src.matchAll(/@(BelongsTo|HasMany|HasOne|BelongsToMany)\(\(\)\s*=>\s*(\w+)/g),
  ].map((m) => ({ kind: m[1], target: m[2] }));
  // Comentario de bloque inicial del archivo, si lo hay: explica el propósito.
  const purpose = (/^\/\*\*\s*\n([\s\S]*?)\*\//.exec(src) ?? [])[1]
    ?.split(/\r?\n/)
    .map((l) => l.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  entities.push({
    file,
    className,
    tableName,
    paranoid,
    timestamps,
    indexes,
    associations,
    purpose,
    columns: parseColumns(src),
    migration: createdIn.get(tableName) ?? null,
  });
}

const out = [];
out.push('# Catálogo de entidades');
out.push('');
out.push(
  '!!! info "Página generada"',
  '    La genera `scripts/generate-entity-catalog.mjs` leyendo los modelos de' +
    ' `src/database/models/` y las migraciones. Se regenera con `yarn docs:entities`.' +
    ' No la edites a mano.',
);
out.push('');
out.push(
  `El esquema tiene **${entities.length} entidades persistentes**. El esquema no se sincroniza` +
    ' automáticamente (`synchronize: false`): la única forma de cambiarlo es una migración.',
);
out.push('');

out.push('## Resumen');
out.push('');
out.push('| Entidad | Tabla | Asociaciones | Borrado lógico | Creada en |');
out.push('| --- | --- | ---: | :---: | --- |');
for (const e of entities) {
  out.push(
    `| [\`${e.className}\`](#${e.className.toLowerCase()}) | \`${e.tableName}\` | ` +
      `${e.associations.length} | ${e.paranoid ? 'sí' : 'no'} | ${e.migration ? `\`${e.migration}\`` : '—'} |`,
  );
}
out.push('');

out.push('## Detalle por entidad');
out.push('');
for (const e of entities) {
  out.push(`### ${e.className}`);
  out.push('');
  if (e.purpose) {
    out.push(e.purpose);
    out.push('');
  }
  out.push(
    `**Tabla:** \`${e.tableName}\` · **Modelo:** [\`src/database/models/${e.file}\`](../../src/database/models/${e.file})` +
      `${e.migration ? ` · **Migración:** \`${e.migration}\`` : ''}`,
  );
  out.push('');
  out.push(
    `Marcas de tiempo: ${e.timestamps ? 'sí' : 'no'} · Borrado lógico: ${e.paranoid ? 'sí (`paranoid`)' : 'no'}` +
      ` · Índices declarados en el modelo: ${e.indexes}`,
  );
  out.push('');
  out.push(
    'Columnas, tipos, restricciones e índices: consulta la migración indicada arriba. Es la fuente' +
      ' de verdad del esquema, porque `synchronize` está desactivado y la base sólo cambia por' +
      ' migración.',
  );
  out.push('');

  const fks = e.columns.filter((c) => c.foreignKey);
  if (fks.length) {
    out.push('**Claves foráneas declaradas en el modelo**');
    out.push('');
    for (const c of fks) out.push(`- \`${c.name}\` → \`${c.foreignKey}\``);
    out.push('');
  }

  if (e.associations.length) {
    out.push('**Asociaciones**');
    out.push('');
    for (const a of e.associations) out.push(`- \`${a.kind}\` → \`${a.target}\``);
    out.push('');
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out.join('\n') + '\n', 'utf8');

console.log(`Entidades catalogadas: ${entities.length} -> ${OUT}`);
