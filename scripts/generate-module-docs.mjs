#!/usr/bin/env node
/**
 * Genera una página por módulo de dominio en `docs/modules/` a partir de datos
 * reales del repositorio, no de descripciones escritas a mano:
 *
 *  - la tabla de rutas (`openapi/route-table.json`), que sale de los metadatos
 *    de NestJS: endpoints, roles y permisos exactos de cada operación;
 *  - el contrato OpenAPI, para los `summary` de cada operación;
 *  - el árbol de archivos del módulo: servicios, DTO, políticas y pruebas;
 *  - los modelos Sequelize que el módulo importa.
 *
 * La parte que exige criterio —contexto de negocio, reglas de dominio y notas
 * de operación— vive en `docs/modules/_context/<módulo>.md` y se inserta tal
 * cual. Así lo autogenerado nunca pisa lo escrito por una persona, y lo escrito
 * por una persona nunca se queda obsoleto respecto a los endpoints.
 *
 * Uso: yarn docs:modules
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES_DIR = join(ROOT, 'src', 'modules');
const OUT_DIR = join(ROOT, 'docs', 'modules');
const CONTEXT_DIR = join(OUT_DIR, '_context');

const contract = JSON.parse(readFileSync(join(ROOT, 'openapi', 'openapi.json'), 'utf8'));
const routeTable = JSON.parse(readFileSync(join(ROOT, 'openapi', 'route-table.json'), 'utf8'));

/** `METHOD /ruta` -> summary declarado en el contrato. */
const summaries = new Map();
for (const [path, item] of Object.entries(contract.paths ?? {})) {
  for (const [verb, op] of Object.entries(item)) {
    if (typeof op !== 'object' || !op.operationId) continue;
    summaries.set(`${verb.toUpperCase()} ${path}`, {
      summary: op.summary ?? '',
      operationId: op.operationId,
      tag: (op.tags ?? [])[0] ?? '',
    });
  }
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const rel = (p) => p.slice(ROOT.length + 1).split('\\').join('/');

/** Modelos Sequelize que importa el módulo, en orden de aparición. */
function modelsUsed(files) {
  const models = new Set();
  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/from '@\/database\/models(?:\/[\w.-]+)?'/g)) void m;
    for (const m of src.matchAll(/\b(?:InjectModel\(|typeof )([A-Z]\w+)\)/g)) models.add(m[1]);
    for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'@\/database\/models[^']*'/g)) {
      for (const name of m[1].split(',')) {
        const clean = name.trim();
        if (/^[A-Z]\w+$/.test(clean)) models.add(clean);
      }
    }
  }
  return [...models].sort();
}

/**
 * Contexto de negocio, dividido del archivo fuente por los marcadores
 * `<!-- module: nombre -->`.
 */
const contextByModule = new Map();
const sourcebook = join(CONTEXT_DIR, '_sourcebook.md');
if (existsSync(sourcebook)) {
  const blocks = readFileSync(sourcebook, 'utf8').split(/<!--\s*module:\s*([\w-]+)\s*-->/);
  for (let i = 1; i < blocks.length; i += 2) contextByModule.set(blocks[i], blocks[i + 1] ?? '');
}

const modules = readdirSync(MODULES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(CONTEXT_DIR, { recursive: true });

const index = [];
let generated = 0;
let missingContext = [];

for (const name of modules) {
  const dir = join(MODULES_DIR, name);
  const files = walk(dir);
  const controllers = files.filter((f) => f.endsWith('.controller.ts') && !f.includes('.spec.'));
  const services = files.filter((f) => f.endsWith('.service.ts') && !f.includes('.spec.'));
  const dtos = files.filter((f) => f.includes('/dto/') || f.includes('\\dto\\'));
  const policies = files.filter((f) => f.includes('polic'));
  const specs = files.filter((f) => f.includes('.spec.'));
  const adapters = files.filter((f) => f.endsWith('.adapter.ts'));

  const routes = routeTable.routes
    .filter((r) => r.sourceFile.startsWith(`src/modules/${name}/`))
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  const permissions = [...new Set(routes.flatMap((r) => r.permissions))].sort();
  const roles = [...new Set(routes.flatMap((r) => r.roles))].sort();
  const models = modelsUsed(files);
  const tag = routes.length ? (summaries.get(`${routes[0].method} ${routes[0].path}`)?.tag ?? '') : '';

  const context = (contextByModule.get(name) ?? '').trim();
  if (!context) missingContext.push(name);

  const out = [];
  out.push(`# Módulo \`${name}\``);
  out.push('');
  out.push(
    '!!! info "Página generada"',
    `    Los inventarios de esta página los genera \`scripts/generate-module-docs.mjs\` a partir de` +
      ` los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en` +
      ` \`docs/modules/_context/${name}.md\`. No edites este archivo directamente.`,
  );
  out.push('');

  out.push('## Ficha');
  out.push('');
  out.push('| Dato | Valor |');
  out.push('| --- | --- |');
  out.push(`| Ruta en el código | \`src/modules/${name}/\` |`);
  out.push(`| Etiqueta en la API | ${tag ? `\`${tag}\`` : '— (sin superficie HTTP)'} |`);
  out.push(`| Operaciones HTTP | ${routes.length} |`);
  out.push(`| Controladores | ${controllers.length} |`);
  out.push(`| Servicios | ${services.length} |`);
  out.push(`| DTO | ${dtos.length} |`);
  out.push(`| Políticas de dominio | ${policies.length} |`);
  out.push(`| Adaptadores externos | ${adapters.length} |`);
  out.push(`| Suites de prueba | ${specs.length} |`);
  out.push(`| Roles que intervienen | ${roles.length ? roles.map((r) => `\`${r}\``).join(', ') : '—'} |`);
  out.push(
    `| Permisos que exige | ${permissions.length ? permissions.map((p) => `\`${p}\``).join(', ') : '—'} |`,
  );
  out.push('');

  if (context) {
    out.push(context);
    out.push('');
  }

  out.push('## Endpoints');
  out.push('');
  if (routes.length === 0) {
    out.push('Este módulo no expone superficie HTTP: lo consumen otros módulos del backend.');
  } else {
    out.push('| Operación | Qué hace | Acceso | Permisos |');
    out.push('| --- | --- | --- | --- |');
    for (const route of routes) {
      const meta = summaries.get(`${route.method} ${route.path}`);
      const access = route.isPublic
        ? 'Público'
        : route.roles.length
          ? route.roles.map((r) => `\`${r}\``).join(', ')
          : 'Autenticado';
      out.push(
        `| \`${route.method} ${route.path}\` | ${meta?.summary || '—'} | ${access} | ${
          route.permissions.length ? route.permissions.map((p) => `\`${p}\``).join(', ') : '—'
        } |`,
      );
    }
  }
  out.push('');

  out.push('## Código');
  out.push('');
  const section = (title, list) => {
    if (!list.length) return;
    out.push(`**${title}**`);
    out.push('');
    for (const f of list.sort()) out.push(`- [\`${rel(f)}\`](../../${rel(f)})`);
    out.push('');
  };
  section('Controladores', controllers);
  section('Servicios', services);
  section('Políticas de dominio', policies);
  section('Adaptadores externos', adapters);
  section('DTO', dtos.filter((f) => f.endsWith('.ts') && !f.includes('.spec.')));

  out.push('## Modelo de datos');
  out.push('');
  if (models.length === 0) {
    out.push('Este módulo no accede directamente a ninguna entidad persistente.');
  } else {
    out.push('Entidades que este módulo lee o escribe:');
    out.push('');
    for (const model of models) out.push(`- \`${model}\` — ver [catálogo de entidades](../data/entity-catalog.md)`);
  }
  out.push('');

  out.push('## Pruebas');
  out.push('');
  if (specs.length === 0) {
    out.push(
      '⚠️ **Sin pruebas automatizadas propias.** Su comportamiento sólo se ejercita de forma indirecta.',
    );
  } else {
    for (const f of specs.sort()) out.push(`- [\`${rel(f)}\`](../../${rel(f)})`);
  }
  out.push('');

  writeFileSync(join(OUT_DIR, `${name}.md`), out.join('\n') + '\n', 'utf8');
  generated += 1;
  index.push({ name, routes: routes.length, services: services.length, specs: specs.length, tag });
}

// Índice de módulos
const idx = [];
idx.push('# Módulos de dominio');
idx.push('');
idx.push(
  'El backend agrupa su lógica en 19 módulos bajo `src/modules/`. Esta tabla se genera con ' +
    '`yarn docs:modules`; las cifras salen de los metadatos reales de NestJS.',
);
idx.push('');
idx.push('| Módulo | Etiqueta en la API | Operaciones | Servicios | Suites de prueba |');
idx.push('| --- | --- | ---: | ---: | ---: |');
for (const m of index) {
  idx.push(
    `| [\`${m.name}\`](${m.name}.md) | ${m.tag ? `\`${m.tag}\`` : '—'} | ${m.routes} | ${m.services} | ${m.specs} |`,
  );
}
idx.push('');
idx.push(
  `**Totales:** ${index.reduce((a, m) => a + m.routes, 0)} operaciones, ` +
    `${index.reduce((a, m) => a + m.services, 0)} servicios, ` +
    `${index.reduce((a, m) => a + m.specs, 0)} suites de prueba.`,
);
idx.push('');
idx.push('Las relaciones entre módulos están en [Dependencias entre módulos](../architecture/module-dependencies.md).');
writeFileSync(join(OUT_DIR, 'index.md'), idx.join('\n') + '\n', 'utf8');

console.log(`Páginas de módulo generadas: ${generated}`);
if (missingContext.length) {
  console.log(`\nSin contexto de negocio en docs/modules/_context/ (${missingContext.length}):`);
  missingContext.forEach((m) => console.log(`  ${m}.md`));
}
