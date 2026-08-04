#!/usr/bin/env node
/**
 * Comprueba que todos los enlaces internos de `docs/` apunten a algo que existe.
 *
 * Cubre lo que MkDocs no ve: enlaces a archivos de código fuera de `docs/`
 * (`../../src/...`), que son la mitad del valor de esta documentación —conectan
 * cada afirmación con el código que la sostiene— y que se rompen en silencio
 * cada vez que alguien mueve un archivo.
 *
 * Uso: yarn docs:links
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');

/**
 * `docs/modules/_context/` no contiene páginas: son fragmentos que
 * `generate-module-docs.mjs` inserta en `docs/modules/<módulo>.md`. Sus enlaces
 * son relativos al destino, no a su propia ubicación, así que comprobarlos aquí
 * daría falsos positivos. Se validan en la página generada.
 */
const EXCLUDED = ['_context'];

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED.includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.md')) acc.push(full);
  }
  return acc;
}

const files = walk(DOCS);
const broken = [];
let checked = 0;

// Enlaces markdown `[texto](destino)`, ignorando imágenes y referencias.
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const fileDir = dirname(file);

  for (const match of content.matchAll(LINK)) {
    const target = match[1];

    // Externos y anclas de la propia página no se comprueban aquí.
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    checked += 1;

    const [pathPart] = target.split('#');
    if (!pathPart) continue;

    const resolved = resolve(fileDir, pathPart);
    if (existsSync(resolved)) continue;

    // Un enlace a un directorio vale si contiene index.md.
    if (existsSync(join(resolved, 'index.md'))) continue;

    broken.push({
      file: relative(ROOT, file).split('\\').join('/'),
      target,
      line: content.slice(0, match.index).split(/\r?\n/).length,
    });
  }
}

// Páginas huérfanas: ningún otro documento las enlaza.
const linked = new Set();
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(LINK)) {
    const [pathPart] = match[1].split('#');
    if (!pathPart || /^(https?:|mailto:)/.test(pathPart)) continue;
    const resolved = resolve(dirname(file), pathPart);
    if (existsSync(resolved) && statSync(resolved).isFile()) linked.add(resolved);
  }
}

console.log(`Enlaces internos comprobados: ${checked} en ${files.length} documentos.`);

if (broken.length) {
  console.error(`\n${broken.length} enlace(s) roto(s):`);
  for (const b of broken.sort((a, b) => a.file.localeCompare(b.file))) {
    console.error(`  ${b.file}:${b.line} -> ${b.target}`);
  }
  process.exit(1);
}

console.log('Ningún enlace roto.');
