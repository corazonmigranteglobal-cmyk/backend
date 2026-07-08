#!/usr/bin/env node
/*
 * Smoke enfocado al plan Contenido Público + Premium + Publicidad.
 * Valida que las rutas críticas existan. Si se proveen credenciales demo,
 * además valida respuestas autenticadas básicas.
 */
const BASE_URL = normalizeBaseUrl(
  process.env.SMOKE_BASE_URL ||
    process.env.API_BASE_URL ||
    `http://localhost:${process.env.PORT || 3000}/${process.env.API_PREFIX || 'api/v1'}`,
);
const PASSWORD = process.env.SMOKE_PASSWORD || 'Demo123456!';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@corazonmigrante.test';
const PATIENT_EMAIL = process.env.SMOKE_PATIENT_EMAIL || 'paciente.demo@corazonmigrante.test';
const allowMutations = process.argv.includes('--mutations');

let failures = 0;
let passed = 0;

const requiredRoutes = [
  ['GET', '/admin/content/subscribers?page=1&pageSize=5', 'Admin lista pacientes suscriptores'],
  ['GET', '/me/news-subscription', 'Paciente consulta estado premium'],
  ['POST', '/me/news-subscription/request', 'Paciente solicita premium'],
  ['GET', '/me/news-subscription/payment-config', 'Paciente consulta QR/configuración de pago'],
  ['GET', '/admin/public-pages', 'Admin lista páginas públicas'],
  ['GET', '/public/pages', 'Público lista páginas públicas'],
  ['POST', '/admin/files/cloudinary/signature', 'Admin firma subida Cloudinary'],
  ['POST', '/admin/files/cloudinary/complete', 'Admin confirma subida Cloudinary'],
  ['GET', '/admin/advertising/companies', 'Admin lista empresas anunciantes'],
  ['POST', '/admin/advertising/companies', 'Admin crea empresa anunciante'],
  ['POST', '/admin/advertising/campaigns', 'Admin crea campaña'],
  ['POST', '/admin/advertising/ads', 'Admin crea anuncio'],
  ['GET', '/public/advertising?placement=article_sidebar', 'Público consulta publicidad'],
  ['POST', '/admin/public-pages/00000000-0000-4000-8000-000000000001/posts', 'Admin asocia publicación a página'],
  ['DELETE', '/admin/public-pages/00000000-0000-4000-8000-000000000001/posts/00000000-0000-4000-8000-000000000002', 'Admin desasocia publicación de página'],
  ['DELETE', '/admin/advertising/companies/00000000-0000-4000-8000-000000000003', 'Admin elimina empresa'],
  ['DELETE', '/admin/advertising/campaigns/00000000-0000-4000-8000-000000000004', 'Admin elimina campaña'],
  ['DELETE', '/admin/advertising/ads/00000000-0000-4000-8000-000000000005', 'Admin elimina anuncio'],
];

console.log(`BASE_URL=${BASE_URL}`);
console.log('Validando que las rutas críticas no devuelvan 404...');
for (const [method, path, label] of requiredRoutes) {
  await expectRouteExists(method, path, label);
}

const adminToken = await tryLogin(ADMIN_EMAIL);
const patientToken = await tryLogin(PATIENT_EMAIL);

if (adminToken) {
  await expectStatus('GET', '/admin/content/subscribers?page=1&pageSize=5', 'Admin consulta suscriptores pacientes', adminToken, [200]);
  await expectStatus('GET', '/admin/public-pages', 'Admin consulta páginas públicas', adminToken, [200]);
  await expectStatus('GET', '/admin/advertising/companies', 'Admin consulta empresas', adminToken, [200]);
  await expectStatus('GET', '/admin/advertising/campaigns?page=1&pageSize=5', 'Admin consulta campañas', adminToken, [200]);
  await expectStatus('GET', '/admin/advertising/ads', 'Admin consulta anuncios', adminToken, [200]);
}

if (patientToken) {
  await expectStatus('GET', '/me/news-subscription', 'Paciente consulta premium sin error técnico', patientToken, [200]);
  await expectStatus('GET', '/me/news-subscription/payment-config', 'Paciente consulta configuración de pago', patientToken, [200]);
  if (allowMutations) {
    await expectStatus('POST', '/me/news-subscription/request', 'Paciente registra solicitud premium', patientToken, [200, 201]);
  }
}

await expectStatus('GET', '/public/pages', 'Público lista páginas dinámicas', undefined, [200]);
await expectStatus('GET', '/public/advertising?placement=article_sidebar', 'Público consulta anuncios por ubicación', undefined, [200]);

console.log(`\nResultado: ${passed} OK, ${failures} errores.`);
if (failures > 0) process.exit(1);

async function expectRouteExists(method, path, label) {
  const result = await request(method, path, undefined, bodyFor(method, path));
  if (result.status === 404) return fail(`${label}: ${method} ${path} devolvió 404.`);
  return ok(`${label}: ruta existe (${result.status}).`);
}

async function expectStatus(method, path, label, token, expected) {
  const result = await request(method, path, token, bodyFor(method, path));
  if (!expected.includes(result.status)) {
    return fail(`${label}: esperado ${expected.join('/')} y llegó ${result.status}. Body: ${JSON.stringify(result.body).slice(0, 500)}`);
  }
  return ok(`${label}: ${result.status}.`);
}

async function tryLogin(email) {
  const result = await request('POST', '/auth/login', undefined, { email, password: PASSWORD });
  if (result.status < 200 || result.status >= 300) {
    console.log(`[SKIP] Login ${email}: ${result.status}. Se mantiene validación de existencia de rutas.`);
    return undefined;
  }
  const token = result.body?.data?.accessToken || result.body?.accessToken;
  if (!token) {
    console.log(`[SKIP] Login ${email}: no devolvió accessToken.`);
    return undefined;
  }
  return token;
}

function bodyFor(method, path) {
  if (method === 'GET' || method === 'DELETE') return undefined;
  if (path.includes('/cloudinary/signature')) {
    return { module: 'CMS', entityType: 'SmokePlanAction', entityId: '00000000-0000-4000-8000-000000000001', visibility: 'PUBLIC', mimeType: 'image/webp', originalName: 'smoke.webp', sizeBytes: 1200 };
  }
  if (path.includes('/cloudinary/complete')) {
    return { uploadToken: 'smoke-token-only-used-after-auth', publicId: 'smoke/plan-action', secureUrl: 'https://res.cloudinary.com/demo/image/upload/smoke/plan-action.webp', format: 'webp', resourceType: 'image', bytes: 1200 };
  }
  if (path.includes('/public-pages/') && path.endsWith('/posts')) {
    return { publicationId: '00000000-0000-4000-8000-000000000002' };
  }
  if (path.includes('/advertising/companies')) {
    return { businessName: 'Smoke Empresa SRL', commercialName: 'Smoke Empresa', status: 'ACTIVE' };
  }
  if (path.includes('/advertising/campaigns')) {
    return { companyId: '00000000-0000-4000-8000-000000000003', name: 'Smoke campaña', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), placementIds: [], publicationIds: [], pageSlugs: ['biblioteca'] };
  }
  if (path.includes('/advertising/ads')) {
    return { campaignId: '00000000-0000-4000-8000-000000000004', title: 'Smoke anuncio', assetUrl: 'https://example.com/banner.webp', destinationUrl: 'https://example.com', altText: 'Smoke anuncio', mediaType: 'IMAGE', pageSlug: 'biblioteca' };
  }
  return {};
}

async function request(method, path, token, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload = null;
  try { payload = await response.json(); } catch {}
  return { status: response.status, body: payload };
}

function normalizeBaseUrl(url) {
  return String(url).replace(/\/+$/, '');
}
function ok(message) { passed += 1; console.log(`[OK] ${message}`); }
function fail(message) { failures += 1; console.error(`[FAIL] ${message}`); }
