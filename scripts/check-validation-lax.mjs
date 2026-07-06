import { readFileSync } from 'node:fs';

const files = ['src/main.ts', 'dist/main.js', 'test/auth.e2e-spec.ts'];
const failures = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (content.includes('forbidNonWhitelisted: true')) {
    failures.push(`${file}: contiene forbidNonWhitelisted: true`);
  }
}

const main = readFileSync('src/main.ts', 'utf8');
if (!main.includes("forbidNonWhitelisted: process.env.VALIDATION_FORBID_NON_WHITELISTED === 'true'")) {
  failures.push('src/main.ts: no usa el modo laxo configurable por VALIDATION_FORBID_NON_WHITELISTED');
}
if (!main.includes('forbidUnknownValues: false')) {
  failures.push('src/main.ts: falta forbidUnknownValues: false');
}

if (failures.length) {
  console.error('Validación laxa NO OK');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Validación laxa OK: el backend ya no rechaza propiedades extras por defecto.');
