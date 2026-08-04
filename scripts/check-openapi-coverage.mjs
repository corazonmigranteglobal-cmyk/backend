#!/usr/bin/env node
/**
 * Comprueba que el contrato OpenAPI describa de verdad la API que expone Nest.
 *
 * Verifica dos cosas que Redocly no puede ver:
 *
 *  1. **Paridad de rutas.** Toda ruta registrada por Nest (`openapi/route-table.json`)
 *     tiene una operación en el contrato, y viceversa. Una ruta que existe pero no
 *     está documentada es una brecha de contrato; una operación documentada que ya
 *     no existe es documentación muerta.
 *  2. **Calidad por operación.** `operationId` único, `summary`, `description`,
 *     etiqueta, seguridad declarada y una respuesta de éxito con esquema tipado.
 *
 * Escribe `docs/reports/openapi-coverage.md` con el detalle y termina con código
 * distinto de cero si alguna comprobación bloqueante falla.
 *
 * Uso: yarn docs:openapi:coverage [--report-only]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = join(ROOT, 'openapi', 'openapi.json');
const ROUTE_TABLE = join(ROOT, 'openapi', 'route-table.json');
const REPORT = join(ROOT, 'docs', 'reports', 'openapi-coverage.md');
const REPORT_ONLY = process.argv.includes('--report-only');

const VERBS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

function readJson(path, what) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(
      `No se pudo leer ${what} (${path}). Ejecuta primero \`yarn docs:openapi:generate\`.\n${error.message}`,
    );
    process.exit(2);
  }
}

const contract = readJson(CONTRACT, 'el contrato OpenAPI');
const routeTable = readJson(ROUTE_TABLE, 'la tabla de rutas de Nest');

/** Operaciones declaradas en el contrato, indexadas por `METHOD /ruta`. */
const contractOps = new Map();
for (const [path, item] of Object.entries(contract.paths ?? {})) {
  for (const verb of VERBS) {
    if (!item[verb]) continue;
    contractOps.set(`${verb.toUpperCase()} ${path}`, { path, verb, operation: item[verb] });
  }
}

const nestRoutes = new Map(
  routeTable.routes.map((route) => [`${route.method} ${route.path}`, route]),
);

// ---------------------------------------------------------------- 1. Paridad
const missingInContract = [...nestRoutes.keys()].filter((key) => !contractOps.has(key));
const missingInNest = [...contractOps.keys()].filter((key) => !nestRoutes.has(key));

// ------------------------------------------------- 2. Calidad por operación
/** Resuelve `$ref` contra `components` una sola vez (no hay refs anidados). */
function deref(node) {
  if (!node?.$ref) return node;
  const parts = node.$ref.replace(/^#\//, '').split('/');
  let target = contract;
  for (const part of parts) target = target?.[part];
  return target ?? node;
}

/**
 * Clasifica la respuesta de éxito de una operación:
 *
 * - `ok`            → `data` tiene esquema propio (referencia a un DTO o forma explícita).
 * - `envelope`      → el sobre está documentado pero `data` es genérico.
 * - `sin-esquema`   → la respuesta no describe cuerpo alguno.
 */
function successSchemaState(operation) {
  const successes = Object.entries(operation.responses ?? {}).filter(
    ([status]) => Number(status) >= 200 && Number(status) < 300,
  );
  if (successes.length === 0) {
    // Una operación puede no tener ningún 2xx de forma legítima: hay handlers
    // cuyo único cometido es rechazar (por ejemplo `GET /auth/login`, que
    // responde 405 para orientar a quien usa el verbo equivocado). Se acepta
    // siempre que documente ese resultado de forma explícita y no sólo por
    // herencia de las respuestas de error compartidas.
    const explicitFailure = Object.entries(operation.responses ?? {}).some(
      ([status, response]) => Number(status) >= 400 && !response.$ref,
    );
    return explicitFailure ? 'ok' : 'sin-respuesta-exito';
  }

  let best = 'sin-esquema';
  for (const [status, rawResponse] of successes) {
    if (status === '204') return 'ok';
    const response = deref(rawResponse);
    const schema = response?.content?.['application/json']?.schema ?? response?.schema;
    if (!schema) continue;

    const resolved = deref(schema);
    const data = resolved?.properties?.data;
    if (!data) {
      best = 'envelope';
      continue;
    }
    const target = deref(data.type === 'array' ? data.items : data);
    if (target?.$ref) return 'ok';
    if (target?.properties && Object.keys(target.properties).length > 0) return 'ok';
    if (target?.type && target.type !== 'object') return 'ok';
    best = 'envelope';
  }
  return best;
}

const declaredTags = new Set((contract.tags ?? []).map((tag) => tag.name));
const operationIds = new Map();
const findings = [];
/**
 * Operaciones cuyo sobre está documentado pero cuyo `data` sigue sin tipar.
 * No bloquean —el cliente ya sabe qué forma tiene la respuesta— pero se
 * publican una a una para que la deuda sea visible y medible.
 */
const untyped = [];

for (const [key, { path, verb, operation }] of contractOps) {
  const route = nestRoutes.get(key);
  const problems = [];

  if (!operation.operationId) problems.push('sin operationId');
  else {
    const seen = operationIds.get(operation.operationId);
    if (seen) problems.push(`operationId duplicado con \`${seen}\``);
    operationIds.set(operation.operationId, key);
  }

  if (!operation.summary?.trim()) problems.push('sin summary');
  if (!operation.description?.trim()) problems.push('sin description');

  const tags = operation.tags ?? [];
  if (tags.length === 0) problems.push('sin tag');
  else {
    const unknown = tags.filter((tag) => !declaredTags.has(tag));
    if (unknown.length) problems.push(`tag no declarado en \`info.tags\`: ${unknown.join(', ')}`);
  }

  if (operation.security === undefined) problems.push('sin seguridad declarada');

  const schemaState = successSchemaState(operation);
  if (schemaState === 'sin-respuesta-exito') problems.push('sin respuesta 2xx');
  else if (schemaState === 'sin-esquema') problems.push('respuesta 2xx sin esquema');
  else if (schemaState === 'envelope') untyped.push({ key, controller: route?.controller ?? '—' });

  // Parámetros de ruta: cada `{x}` del path debe estar declarado.
  const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
  const declared = new Set(
    (operation.parameters ?? []).filter((p) => p.in === 'path').map((p) => p.name),
  );
  for (const param of pathParams) {
    if (!declared.has(param)) problems.push(`parámetro de ruta \`${param}\` sin declarar`);
  }

  if (problems.length) {
    findings.push({
      key,
      verb: verb.toUpperCase(),
      path,
      operationId: operation.operationId ?? '—',
      controller: route?.controller ?? '—',
      sourceFile: route?.sourceFile ?? '',
      problems,
    });
  }
}

// ------------------------------------------------------------------ Informe
const total = contractOps.size;
const clean = total - findings.length;
const pct = (value) => (total === 0 ? '0.0' : ((value / total) * 100).toFixed(1));

const byProblem = new Map();
for (const finding of findings) {
  for (const problem of finding.problems) {
    const normalized = problem.replace(/`[^`]*`/g, '`…`');
    byProblem.set(normalized, (byProblem.get(normalized) ?? 0) + 1);
  }
}

const byController = new Map();
for (const finding of findings) {
  const entry = byController.get(finding.controller) ?? { count: 0, file: finding.sourceFile };
  entry.count += 1;
  byController.set(finding.controller, entry);
}

const lines = [];
lines.push('# Cobertura del contrato OpenAPI');
lines.push('');
lines.push(
  'Informe generado por `scripts/check-openapi-coverage.mjs`. No se edita a mano: se regenera con `yarn docs:openapi:coverage`.',
);
lines.push('');
lines.push('## Resumen');
lines.push('');
lines.push('| Métrica | Valor |');
lines.push('| --- | ---: |');
lines.push(`| Rutas registradas por NestJS | ${nestRoutes.size} |`);
lines.push(`| Operaciones en el contrato | ${total} |`);
lines.push(`| Rutas sin operación en el contrato | ${missingInContract.length} |`);
lines.push(`| Operaciones sin ruta en NestJS | ${missingInNest.length} |`);
lines.push(`| Operaciones sin ninguna incidencia bloqueante | ${clean} (${pct(clean)} %) |`);
lines.push(`| Operaciones con incidencias bloqueantes | ${findings.length} (${pct(findings.length)} %) |`);
lines.push(
  `| Operaciones con \`data\` tipado | ${total - untyped.length} (${pct(total - untyped.length)} %) |`,
);
lines.push(`| Operaciones con sobre genérico | ${untyped.length} (${pct(untyped.length)} %) |`);
lines.push('');

if (missingInContract.length) {
  lines.push('## Rutas expuestas que el contrato no documenta');
  lines.push('');
  lines.push('Cada línea es una brecha de contrato bloqueante.');
  lines.push('');
  for (const key of missingInContract.sort()) {
    const route = nestRoutes.get(key);
    lines.push(`- \`${key}\` — \`${route.controller}.${route.handler}\` (${route.sourceFile})`);
  }
  lines.push('');
}

if (missingInNest.length) {
  lines.push('## Operaciones documentadas que ya no existen');
  lines.push('');
  lines.push(
    'Documentación muerta: el contrato promete rutas que NestJS no registra. Normalmente son rutas declaradas con `@All()` o handlers eliminados.',
  );
  lines.push('');
  for (const key of missingInNest.sort()) lines.push(`- \`${key}\``);
  lines.push('');
}

lines.push('## Incidencias por tipo');
lines.push('');
if (byProblem.size === 0) {
  lines.push('Ninguna. Todas las operaciones cumplen las reglas de calidad.');
} else {
  lines.push('| Incidencia | Operaciones |');
  lines.push('| --- | ---: |');
  for (const [problem, count] of [...byProblem].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${problem} | ${count} |`);
  }
}
lines.push('');

if (byController.size) {
  lines.push('## Incidencias por controlador');
  lines.push('');
  lines.push('| Controlador | Operaciones con incidencias | Archivo |');
  lines.push('| --- | ---: | --- |');
  for (const [controller, entry] of [...byController].sort((a, b) => b[1].count - a[1].count)) {
    lines.push(`| \`${controller}\` | ${entry.count} | \`${entry.file}\` |`);
  }
  lines.push('');
}

if (findings.length) {
  lines.push('## Detalle por operación');
  lines.push('');
  lines.push('| Operación | operationId | Incidencias |');
  lines.push('| --- | --- | --- |');
  for (const finding of findings.sort((a, b) => a.key.localeCompare(b.key))) {
    lines.push(
      `| \`${finding.verb} ${finding.path}\` | \`${finding.operationId}\` | ${finding.problems.join('; ')} |`,
    );
  }
  lines.push('');
}

if (untyped.length) {
  lines.push('## Deuda: operaciones con sobre genérico');
  lines.push('');
  lines.push(
    'Estas operaciones documentan el sobre real (`data` + `meta`), pero `data` todavía no declara ' +
      'un esquema propio. No bloquean la validación: quien consume la API conoce la envoltura y los ' +
      'códigos de error, pero no la forma exacta de la carga útil. Se resuelven añadiendo ' +
      '`@ApiEnvelope(Dto, { … })` al handler.',
  );
  lines.push('');
  const byCtrl = new Map();
  for (const item of untyped) byCtrl.set(item.controller, (byCtrl.get(item.controller) ?? 0) + 1);
  lines.push('| Controlador | Operaciones |');
  lines.push('| --- | ---: |');
  for (const [controller, count] of [...byCtrl].sort((a, b) => b[1] - a[1])) {
    lines.push(`| \`${controller}\` | ${count} |`);
  }
  lines.push('');
}

mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, lines.join('\n'), 'utf8');

// ------------------------------------------------------------------ Salida
const blocking = missingInContract.length + missingInNest.length + findings.length;
console.log(
  `Cobertura OpenAPI: ${clean}/${total} operaciones sin incidencias bloqueantes (${pct(clean)} %), ` +
    `${total - untyped.length}/${total} con data tipado. ` +
    `Paridad de rutas: ${missingInContract.length} sin documentar, ${missingInNest.length} sobrantes.`,
);
console.log(`Informe: ${REPORT}`);

if (blocking > 0 && !REPORT_ONLY) {
  console.error(`\nFallo: ${blocking} incidencia(s) bloqueante(s). Detalle en el informe.`);
  process.exit(1);
}
