#!/usr/bin/env node
/**
 * Valida `asyncapi/asyncapi.yaml` con el parser oficial de AsyncAPI y comprueba
 * que los tipos de mensaje que declara sigan existiendo en el código.
 *
 * La segunda comprobación es la que evita que el contrato se quede atrás: un
 * `templateCode` nuevo en el código y ausente del contrato deja a los
 * consumidores sin forma de saber qué les va a llegar.
 *
 * Uso: yarn docs:asyncapi:lint
 */
import { Parser } from '@asyncapi/parser';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = join(ROOT, 'asyncapi', 'asyncapi.yaml');

const parser = new Parser();
const { document, diagnostics } = await parser.parse(readFileSync(CONTRACT, 'utf8'));

const errors = diagnostics.filter((d) => d.severity === 0);
const warnings = diagnostics.filter((d) => d.severity === 1);

for (const d of errors) console.error(`ERROR  ${d.path.join('.')}: ${d.message}`);
for (const d of warnings) console.warn(`aviso  ${d.path.join('.')}: ${d.message}`);

if (!document || errors.length) {
  console.error(`\nAsyncAPI inválido: ${errors.length} error(es).`);
  process.exit(1);
}

// ---- Paridad de tipos de mensaje entre el contrato y el código -------------
const declared = new Set(
  document
    .components()
    .schemas()
    .get('OutboxMessage')
    ?.properties()
    ?.templateCode?.json()?.examples ?? [],
);

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.ts') && !entry.name.includes('.spec.')) acc.push(full);
  }
  return acc;
}

// Los productores encolan con `templateCode: 'X'` o `templateCode: "X"`.
const used = new Set();
for (const file of walk(join(ROOT, 'src'))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/templateCode:\s*['"`]([A-Z0-9_]+)['"`]/g)) used.add(m[1]);
}

const undocumented = [...used].filter((code) => !declared.has(code));

console.log(`AsyncAPI válido. Tipos de mensaje declarados: ${declared.size}.`);
if (used.size) console.log(`Tipos encontrados en el código: ${[...used].sort().join(', ')}`);

if (undocumented.length) {
  console.error(
    `\nHay tipos de mensaje en el código que el contrato no declara: ${undocumented.join(', ')}\n` +
      'Añádelos a `templateCode.examples` en asyncapi/asyncapi.yaml.',
  );
  process.exit(1);
}

if (warnings.length) console.log(`(${warnings.length} aviso(s) del parser, no bloquean.)`);
void statSync;
