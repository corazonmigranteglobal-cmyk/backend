import { readFileSync } from 'node:fs';

/**
 * Guardián de la validación estricta de entrada.
 *
 * Sustituye a `check-validation-lax.mjs`, que exigía lo contrario: venía de un
 * hotfix que abrió `forbidNonWhitelisted` para desbloquear al frontend y que
 * más tarde se revirtió en `main.ts` sin retirar el chequeo, de modo que el
 * script fallaba siempre.
 *
 * La validación estricta no es cosmética: `POST /appointments` sólo impide que
 * un paciente reserve a nombre de otro porque `forbidNonWhitelisted` rechaza el
 * campo `patientUserId`, que sólo existe en el DTO de booking asistido.
 */
const REQUIRED_FLAGS = [
  ['forbidNonWhitelisted: true', 'rechazo de propiedades no declaradas en el DTO'],
  ['whitelist: true', 'descarte de propiedades no declaradas'],
  ['forbidUnknownValues: true', 'rechazo de payloads sin DTO conocido'],
];

const main = readFileSync('src/main.ts', 'utf8');
const failures = REQUIRED_FLAGS.filter(([flag]) => !main.includes(flag)).map(
  ([flag, reason]) => `src/main.ts: falta "${flag}" (${reason})`,
);

if (failures.length) {
  console.error('Validación estricta NO OK');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Validación estricta OK: el backend rechaza propiedades no declaradas en los DTO.');
