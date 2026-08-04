#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
// `site` es la salida de `yarn docs:build` (MkDocs) y está en .gitignore, igual
// que `dist` y `coverage`. Su índice de búsqueda concatena toda la
// documentación, así que dispara los patrones aunque los originales sólo
// contengan marcadores de ejemplo.
const ignoredDirs = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  '.yarn',
  'storage',
  'site',
]);
const ignoredFiles = new Set([
  '.env.example',
  '.env.production.example',
  'package-lock.json',
  'scripts/check-no-secrets.js',
  'scripts/backup-to-neon.js',
]);

const suspiciousPatterns = [
  // Sólo alerta si tras la cabecera hay material de clave real. Las plantillas
  // de documentación escriben el cuerpo elidido ("-----BEGIN…-----\n...\n").
  {
    name: 'clave privada PEM',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:\\n|\s)*[A-Za-z0-9+/]{40,}/gi,
  },
  { name: 'API key de SendGrid', pattern: /SG\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'client secret de Google', pattern: /GOCSPX-[A-Za-z0-9_-]+/g },
  { name: 'credencial de Neon', pattern: /npg_[A-Za-z0-9]+/g },
  { name: 'URL de Postgres con credenciales', pattern: /postgres(?:ql)?:\/\/[^\s/]+:[^\s/@]+@/gi },
];

/**
 * Credenciales de ejemplo que aparecen en la documentación.
 *
 * La comprobación se hace sobre CADA coincidencia, no sobre el fichero
 * completo: antes bastaba con que la palabra "REEMPLAZAR" apareciera en
 * cualquier línea para que un secreto real en otra parte del mismo fichero
 * pasara sin avisar.
 */
const PLACEHOLDER_TOKENS = [
  'user:pass',
  'user:password',
  'usuario:password',
  'usuario:contrasena',
  'username:password',
  'reemplazar',
  'changeme',
  'your_password',
  'xxx',
  '<user>',
  '***',
];

function isPlaceholderMatch(match) {
  const normalized = match.toLowerCase();
  return PLACEHOLDER_TOKENS.some((token) => normalized.includes(token));
}

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else results.push(full);
  }
  return results;
}

const findings = [];
for (const file of walk(ROOT)) {
  const relative = path.relative(ROOT, file).replace(/\\/g, '/');
  if (ignoredFiles.has(relative)) continue;
  if (relative.startsWith('.env')) continue;
  const stat = fs.statSync(file);
  if (stat.size > 1024 * 1024) continue;

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const { name, pattern } of suspiciousPatterns) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        if (isPlaceholderMatch(match[0])) continue;
        findings.push(`${relative}:${index + 1} — ${name}`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Se detectaron posibles secretos en archivos versionables:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('OK: no se detectaron patrones evidentes de secretos en archivos versionables.');
