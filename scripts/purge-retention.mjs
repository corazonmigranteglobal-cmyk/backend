#!/usr/bin/env node
/**
 * Aplica la política de retención documentada en `docs/data/retention.md`.
 *
 * Sin esto, las tablas de rastro crecen sin techo. La más urgente es
 * `mensajeria.mensaje_outbox`: acumula un registro por cada correo que el
 * sistema ha enviado desde el primer día, y es la que consulta el panel de
 * mensajería.
 *
 * **Por defecto no borra nada.** Muestra qué borraría y cuánto ocupa. Hay que
 * pasar `--apply` de forma explícita para que ejecute.
 *
 *   node scripts/purge-retention.mjs                 # simulación
 *   node scripts/purge-retention.mjs --apply         # ejecuta
 *   node scripts/purge-retention.mjs --only=outbox   # sólo una política
 *
 * Pensado para ejecutarse a mano o desde un cron. No forma parte del arranque
 * de la API: una purga no debe correr en cada despliegue.
 */
import 'dotenv/config';
import { Client } from 'pg';

const APPLY = process.argv.includes('--apply');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').split('=')[1];

/**
 * Cada política declara qué borra y por qué. El `where` se escribe con un
 * intervalo literal porque el número de días es una constante de esta tabla,
 * no una entrada de usuario.
 */
const POLICIES = [
  {
    key: 'outbox',
    table: 'mensajeria.mensaje_outbox',
    days: 90,
    where: "estado = 'ENVIADO' AND sent_at < now() - interval '90 days'",
    why: 'Mensajes ya entregados. Se conservan 90 días para poder investigar una entrega concreta.',
    keeps: 'Los mensajes en FALLIDO se conservan siempre: son incidencias sin resolver.',
  },
  {
    key: 'send-log',
    table: 'mensajeria.mensaje_envio_log',
    days: 90,
    where: "created_at < now() - interval '90 days'",
    why: 'Detalle de cada intento de envío. Su valor caduca con el del mensaje.',
  },
  {
    key: 'ui-events',
    table: 'ui_events',
    days: 365,
    where: "created_at < now() - interval '365 days'",
    why: 'Analítica de interfaz. Sirve para agregados recientes, no como archivo histórico.',
  },
  {
    key: 'public-visits',
    table: 'public_visits',
    days: 365,
    where: "created_at < now() - interval '365 days'",
    why: 'Visitas al sitio público.',
  },
  {
    key: 'file-access',
    table: 'file_access_logs',
    days: 365,
    where: "created_at < now() - interval '365 days'",
    why: 'Accesos a archivos. Un año cubre la investigación de un incidente razonable.',
  },
  {
    key: 'refresh-tokens',
    table: 'refresh_tokens',
    days: 60,
    where: "expires_at < now() - interval '60 days'",
    why: 'Tokens caducados hace más de 60 días. Ya no sirven ni para auditar una sesión.',
  },
];

/**
 * `audit_logs` NO se purga aquí a propósito. Es la prueba de qué ocurrió en un
 * sistema que maneja datos clínicos, y su borrado debe ser una decisión
 * explícita con criterio legal, no un efecto secundario de un cron.
 */

function connectionConfig() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined,
  };
}

async function tableExists(client, qualified) {
  const [schema, table] = qualified.includes('.') ? qualified.split('.') : ['public', qualified];
  const { rows } = await client.query(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [`${schema}.${table}`],
  );
  return rows[0].exists;
}

const client = new Client(connectionConfig());
await client.connect();

const selected = POLICIES.filter((p) => !ONLY || p.key === ONLY);
if (ONLY && selected.length === 0) {
  console.error(`No existe la política "${ONLY}". Disponibles: ${POLICIES.map((p) => p.key).join(', ')}`);
  await client.end();
  process.exit(2);
}

console.log(APPLY ? '=== PURGA REAL ===' : '=== SIMULACIÓN (usa --apply para ejecutar) ===\n');

let totalAffected = 0;
const skipped = [];

for (const policy of selected) {
  if (!(await tableExists(client, policy.table))) {
    skipped.push(policy.table);
    continue;
  }

  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM ${policy.table} WHERE ${policy.where}`,
  );
  const affected = rows[0].n;
  totalAffected += affected;

  console.log(`${policy.table}  (retención: ${policy.days} días)`);
  console.log(`  ${policy.why}`);
  if (policy.keeps) console.log(`  ${policy.keeps}`);
  console.log(`  Filas que cumplen el criterio: ${affected}`);

  if (APPLY && affected > 0) {
    const result = await client.query(`DELETE FROM ${policy.table} WHERE ${policy.where}`);
    console.log(`  BORRADAS: ${result.rowCount}`);
  }
  console.log('');
}

if (skipped.length) {
  console.log(`Tablas ausentes en este esquema, omitidas: ${skipped.join(', ')}\n`);
}

console.log(
  APPLY
    ? `Purga completada. Filas afectadas: ${totalAffected}.`
    : `Se borrarían ${totalAffected} filas. Nada se ha modificado.`,
);

await client.end();
