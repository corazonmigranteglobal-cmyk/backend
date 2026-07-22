/**
 * Carga el .env del backend para scripts standalone (import de side-effect).
 *
 * Usa dotenv (el mismo motor que el servidor en runtime): tolera BOM, saltos
 * de linea CRLF/CR, comillas y codificaciones que un parser casero por regex
 * no maneja. Resuelve el .env relativo a la raiz del backend, por lo que
 * funciona sin importar el directorio desde el que se invoque el script.
 * No sobrescribe variables ya presentes en el entorno (override: false).
 *
 * Uso (como primer import del script):
 *   import './load-dotenv.mjs';
 */
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(backendRoot, '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}
