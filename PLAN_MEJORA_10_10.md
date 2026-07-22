# Plan de Mejora 10/10 — Corazón Migrante
> Generado: 2026-07-19 | Aplica a: backend (NestJS) + frontend (Next.js)

---

## Criterio de entregable 10/10

Un entregable de alta calidad para cliente cumple simultáneamente:

- **Funcional al 100%** — sin `PENDIENTE_CM` sin resolver
- **Seguro** — sin vectores de ataque conocidos ni credenciales expuestas
- **Probado** — cobertura automática en todos los flujos críticos
- **Observable** — logs estructurados, health checks, métricas de error
- **Mantenible** — sin god files, sin ciclos, sin deuda técnica activa documentada
- **Desplegable con un comando** — CI/CD funcional, sin pasos manuales
- **Documentado para el cliente** — README de operaciones, Swagger completo, guía de incidentes

---

## Índice de fases

| Fase | Nombre | Prioridad | Esfuerzo estimado |
|------|--------|-----------|-------------------|
| 0 | Bloqueadores inmediatos (must-do antes de cualquier demo) | CRÍTICA | 1–2 días |
| 1 | Funcionalidad pendiente | ALTA | 3–5 días |
| 2 | Testing automatizado | ALTA | 5–8 días |
| 3 | Hardening de seguridad | ALTA | 2–3 días |
| 4 | Deuda técnica y refactoring | MEDIA | 3–4 días |
| 5 | Observabilidad y operaciones | MEDIA | 2–3 días |
| 6 | CI/CD y despliegue | ALTA | 2–3 días |
| 7 | UX, accesibilidad y SEO | MEDIA | 2–3 días |
| 8 | Documentación para el cliente | MEDIA | 1–2 días |

**Total estimado:** 21–33 días-desarrollador (con un equipo de 2 puede ejecutarse en ~3 semanas)

---

## FASE 0 — Bloqueadores inmediatos

Estos ítems deben resolverse antes de cualquier demo o revisión con el cliente porque representan fallos visibles o riesgos de seguridad activos.

### 0.1 · Backend — Activar `forbidNonWhitelisted` en todos los entornos

**Archivo:** `src/main.ts`

**Problema actual:**
```ts
forbidNonWhitelisted:
  process.env.NODE_ENV === 'production' ||
  process.env.VALIDATION_FORBID_NON_WHITELISTED === 'true',
```
En desarrollo el backend acepta propiedades extras silenciosamente. Esto oculta bugs del frontend que solo aparecen en producción.

**Corrección:**
```ts
forbidNonWhitelisted: true,   // siempre, en todos los entornos
```

**Criterio de aceptación:** Enviar una petición con un campo extra a cualquier endpoint protegido retorna `400 VALIDATION_ERROR` en local y en producción por igual.

---

### 0.2 · Frontend — Resolver `PENDIENTE_CM_BACKEND_CMS_PUBLIC_ASSET_URL`

**Archivos afectados:**
- `src/config/file-server.ts`
- `src/features/public-view/public-view.normalizer.ts`
- `src/features/editorial/editorial.api.ts`

**Problema actual:** Las URLs de assets del CMS público (imágenes de artículos, documentos de la biblioteca) no se construyen correctamente porque el `FILE_SERVER` no está resuelto para contenido público.

**Corrección:**
1. Confirmar con el backend si los assets públicos del CMS se sirven desde GCS directamente, desde el endpoint `/api/v1/files/:id/download`, o desde una CDN.
2. Implementar `buildPublicAssetUrl(fileId: string): string` en `file-server.ts` que devuelva la URL correcta según el entorno.
3. Usar esa función en todos los normalizadores de contenido público.

**Criterio de aceptación:** Las imágenes de artículos de la biblioteca y novedades cargan correctamente en producción sin depender de variables de entorno no documentadas.

---

### 0.3 · Frontend — Texto legal real

**Archivos:**
- `src/app/(public)/terminos/page.tsx`
- `src/app/(public)/privacidad/page.tsx`

**Problema actual:** Páginas de Términos y Condiciones y Política de Privacidad sin contenido real. Esto es un bloqueador legal para operar con usuarios reales.

**Corrección:**
1. Solicitar al cliente los textos legales finales.
2. Si el CMS ya está configurado, hacer que estas páginas consuman una `CmsPage` con slug `terminos` y `privacidad` respectivamente, para que el cliente pueda editarlas sin deploy.
3. Si no, incrustar el texto como contenido estático temporal hasta que el cliente los provea.

**Criterio de aceptación:** Ambas páginas muestran contenido real y no un placeholder.

---

### 0.4 · Backend — Auditar y limpiar credenciales en el repo

**Script disponible:** `scripts/check-no-secrets.js`

**Acción:**
```bash
node scripts/check-no-secrets.js
```
Revisar todos los hallazgos. Si alguna credencial real llegó a estar en el historial de git, ejecutar el runbook de `docs/CREDENTIAL_EXPOSURE_RUNBOOK.md` (rotar credenciales, usar `git filter-repo` para limpiar el historial, forzar push).

**Criterio de aceptación:** `check-no-secrets.js` retorna cero hallazgos. El `.env.example` tiene todas las variables con valores ficticios documentados.

---

## FASE 1 — Funcionalidad pendiente

### 1.1 · Frontend — Selector real de terapeuta en el booking

**Archivo:** `src/features/booking/booking-form.tsx`

**Problema:** `PENDIENTE_CM: Selector real de terapeuta` — el formulario de booking no tiene un selector funcional de terapeuta antes de elegir disponibilidad.

**Corrección detallada:**

El backend expone `GET /api/v1/booking/therapists` que retorna la lista de terapeutas activos con sus productos disponibles. El flujo correcto del formulario debe ser:

```
1. Usuario selecciona producto (tipo de terapia)
   → filtrar terapeutas disponibles para ese producto
2. Usuario selecciona terapeuta
   → cargar disponibilidad para terapeuta + producto + fecha
3. Usuario selecciona slot horario
4. Usuario confirma
```

Implementar en `booking.api.ts`:
```ts
export async function listBookingTherapists(productId?: string): Promise<BookingTherapist[]>
// ya existe — verificar que filtra por producto

export async function fetchAvailability(
  therapistId: string,
  productId: string,
  dateFrom: string,
  dateTo: string,
  timezone: string
): Promise<AvailabilitySlot[]>
// ya existe — verificar parámetros alineados con backend
```

Agregar en `booking-form.tsx` un paso previo de selección de terapeuta con avatar, nombre, especialidades y tarifa.

**Criterio de aceptación:** Un paciente puede completar el flujo de booking de inicio a fin: elegir producto → elegir terapeuta → elegir slot → confirmar → ver la cita en su dashboard.

---

### 1.2 · Frontend — Confirmar shapes finales del backend

**Archivo:** `src/features/booking/booking.api.ts`, `src/features/therapy/therapy.api.ts`

**Problema:** `PENDIENTE_CM: Shapes finales de backend` — algunos contratos de API están marcados como no confirmados.

**Acción:**
1. Ejecutar el smoke profundo completo con el backend actual:
   ```bash
   # Backend
   yarn smoke:deep
   yarn smoke:deep:mutations
   ```
2. Comparar los payloads reales con los tipos TypeScript definidos en el frontend.
3. Corregir discrepancias en los normalizadores (`src/shared/api/normalizers.ts`) sin cambiar los tipos exportados (los consumidores no deben romper).
4. Marcar cada `PENDIENTE_CM: Shapes finales` como `RESUELTO_CM` con la fecha.

**Criterio de aceptación:** Cero `PENDIENTE_CM: Shapes` en el código. Los tipos del frontend reflejan exactamente lo que el backend retorna.

---

### 1.3 · Backend — Confirmar y documentar el contrato de disponibilidad

**Archivos:** `src/modules/scheduling/scheduling.service.ts`, `src/modules/appointments/appointments.service.ts`

**Problema:** El sistema de disponibilidad (horarios de terapeuta, bloqueos, citas existentes) tiene lógica compleja que no está cubierta por tests. El frontend depende de que retorne slots en el formato correcto.

**Acción:**
1. Documentar en Swagger todos los query params de `GET /api/v1/scheduling/availability`.
2. Agregar ejemplos de response en el Swagger con `@ApiResponse({ example: ... })`.
3. Escribir al menos 3 unit tests del servicio de disponibilidad:
   - Terapeuta sin horario configurado → retorna lista vacía
   - Terapeuta con horario + cita existente → ese slot no aparece
   - Terapeuta con bloqueo manual → esos slots no aparecen

---

### 1.4 · Backend — Retirar `LegacyCompatibilityModule`

**Archivo:** `src/modules/legacy-compatibility/`

**Acción:**
1. Auditar qué endpoints expone el módulo y si el frontend los consume todavía.
2. Si el frontend usa endpoints legacy: migrarlos a los nuevos endpoints y actualizar el frontend.
3. Si nadie los consume: eliminar el módulo y sus tests.
4. Si hay clientes externos que los usan: documentar un período de deprecación (mínimo 30 días) y agregar un header `Deprecation: true` y `Sunset: <fecha>` a esos endpoints.

**Criterio de aceptación:** El módulo está eliminado o tiene fecha de retiro documentada y anunciada.

---

## FASE 2 — Testing automatizado

Esta es la brecha más crítica. El proyecto tiene 306 archivos de backend y 187 de frontend con una cobertura combinada de ~19 tests automatizados. Un entregable de cliente sin tests es técnicamente insostenible.

### 2.1 · Backend — Setup de testing con base de datos real

**Stack:** Jest + Supertest + Sequelize con PostgreSQL en contenedor (o SQLite para unit tests).

**Agregar al `package.json`:**
```json
"test:integration": "jest --config jest.integration.config.js --runInBand",
"test:coverage": "jest --coverage --coverageThreshold='{\"global\":{\"lines\":70}}'",
```

**Crear `jest.integration.config.js`:**
```js
module.exports = {
  ...require('./jest.config.js'),
  testMatch: ['**/*.integration-spec.ts'],
  setupFilesAfterFramework: ['./test/setup-integration.ts'],
};
```

**Crear `test/setup-integration.ts`:**
```ts
// Levanta una BD de test, corre migraciones, seed mínimo
// Expone helpers: createTestApp(), closeTestApp(), getAuthToken(role)
```

---

### 2.2 · Backend — Tests unitarios de servicios críticos

Meta: **70% de cobertura en líneas** en los siguientes servicios.

**`AuthService` — 6 tests mínimos:**
- `registerPatient` crea usuario + perfil + rol en transacción
- `registerPatient` con email duplicado lanza `BadRequestException`
- `login` con credenciales válidas retorna access + refresh token
- `login` con password incorrecto lanza `UnauthorizedException`
- `refreshToken` con token válido retorna nuevo access token
- `refreshToken` con token expirado/inválido lanza `UnauthorizedException`

**`AppointmentsService` — 5 tests mínimos:**
- Crear cita con slot disponible → estado `PENDING`
- Crear cita en slot ocupado → lanza error de conflicto
- Transición de estado válida (PENDING → CONFIRMED) → persiste
- Transición inválida (COMPLETED → PENDING) → lanza `BadRequestException`
- Cancelar cita pasada → lanza `ForbiddenException`

**`SchedulingService` — 4 tests mínimos:**
- Sin horario configurado → `getAvailability` retorna `[]`
- Con horario + cita existente → slot ocupado no aparece
- Con bloqueo manual → slots bloqueados no aparecen
- Slots fuera del horario configurado → no aparecen

**`ContentPublicationsService` — 4 tests mínimos:**
- Publicar con fecha futura → estado `SCHEDULED`
- Publicar sin fecha → estado `PUBLISHED` inmediato
- Intentar publicar sin autor → lanza error
- `assertPublishable` con publicación en estado no publicable → lanza error

**`AccountingService` — 3 tests mínimos:**
- Crear transacción balanceada → persiste correctamente
- Crear transacción desbalanceada → lanza error
- Generar venta desde cita → crea `Sale` + `AccountingEntry` en transacción

---

### 2.3 · Backend — Tests E2E de flujos completos

**Archivo de referencia:** `test/app.e2e-spec.ts` (ampliar el existente)

**Flujos obligatorios:**

```
Flujo 1: Registro y login de paciente
  POST /auth/register (paciente) → 201
  POST /auth/login → 200 con token
  GET /users/me → 200 con datos del usuario

Flujo 2: Booking completo
  GET /booking/products → lista de productos
  GET /booking/therapists → lista de terapeutas
  GET /scheduling/availability → slots disponibles
  POST /appointments → 201 con ID de cita
  GET /appointments/:id → 200 con estado PENDING

Flujo 3: RBAC — acceso denegado
  GET /admin/users (con token de paciente) → 403
  DELETE /files/:id (con token de terapeuta) → 403

Flujo 4: Publicación de contenido
  POST /admin/content/publications → 201 (como admin)
  GET /public/publications/:slug → 200 (sin auth)
  GET /public/publications/:slug (publicación premium, sin token) → 403
```

---

### 2.4 · Frontend — Setup de testing

**Stack:** Vitest + Testing Library + MSW (Mock Service Worker)

**Agregar dependencias:**
```bash
yarn add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event msw
```

**Crear `src/test/server.ts`** con MSW handlers que simulen las respuestas del backend:
```ts
// handlers para auth, booking, users, content...
export const handlers = [
  http.post('/api/v1/auth/login', () => HttpResponse.json({ token: 'mock-token', ... })),
  // ...
];
```

---

### 2.5 · Frontend — Tests unitarios de normalizers y mappers

Estos son los más críticos porque un bug aquí rompe toda la visualización de datos.

**`src/shared/auth/session.ts` — 5 tests:**
- `normalizeSession` con respuesta del backend nuevo → rol correcto
- `normalizeSession` con `is_admin: true` legacy → rol `ADMIN`
- `normalizeSession` con `is_terapeuta: true` legacy → rol `TERAPEUTA`
- `normalizeSession` con roles anidados en `data.user` → desenvuelve correctamente
- `normalizeSession` con input completamente inválido → lanza ZodError

**`src/features/public-view/public-view.normalizer.ts` — 4 tests:**
- `cardFrom` con objeto válido → retorna `PublicViewCard` completo
- `cardFrom` con campos faltantes → usa fallbacks correctos
- `asStringArray` con array de strings → retorna limpio
- `encodeAssetUrl` con fileId → genera URL correcta

**`src/shared/api/client.ts` — 4 tests:**
- Request exitoso → retorna payload tipado
- Request con 400 + propiedades rechazadas → reintenta sin esas propiedades
- Request con 401 → limpia sesión y redirige
- Request con error de red → lanza `ApiError` con status 0

**`src/features/public-view/landing-v2.mapper.ts` — 3 tests:**
- `extractLandingV2` con payload válido → mapea todas las secciones
- `looksLikeLandingV2` con payload sin campos obligatorios → retorna `false`
- `extractLandingV2` con campos de imagen faltantes → usa placeholders sin romper

---

### 2.6 · Frontend — Tests de integración de componentes críticos

**`booking-form.tsx`:**
- Renderiza sin crash con datos del backend (mockeados con MSW)
- Seleccionar producto filtra terapeutas disponibles
- Seleccionar terapeuta carga disponibilidad
- Submit del formulario llama a `createPatientBooking` con datos correctos
- Error del backend → muestra `humanizeApiError` al usuario

**`login-form.tsx`:**
- Submit con credenciales → llama a `login` y redirige al dashboard correcto por rol
- Error de login → muestra mensaje de error sin borrar el campo de email

**`newsroom-admin.tsx`:**
- Carga lista de publicaciones
- Filtros de tipo y estado actualizan la tabla
- Acción de publicar inmediato → confirmación visible

---

### 2.7 · Frontend — Tests E2E con Playwright

**Instalar:**
```bash
yarn add -D @playwright/test
npx playwright install --with-deps
```

**Flujos críticos (3 mínimos):**

```
1. Login de paciente → dashboard → ver citas
2. Login de admin → gestión de usuarios → listar y filtrar
3. Visitante público → landing → navegar a biblioteca → leer artículo
```

---

## FASE 3 — Hardening de seguridad

### 3.1 · Backend — Rate limiting por endpoint, no solo global

**Problema actual:** Un solo `ThrottlerGuard` global con `{ ttl: 60_000, limit: 120 }`. Un atacante puede hacer 120 intentos de login por minuto.

**Corrección:** Aplicar throttling diferenciado por endpoint sensible.

```ts
// En AuthController
@Throttle({ default: { ttl: 60_000, limit: 5 } })  // 5 intentos/min en login
@Post('login')
async login(...) {}

@Throttle({ default: { ttl: 3_600_000, limit: 3 } })  // 3 resets/hora
@Post('password-reset/request')
async requestPasswordReset(...) {}
```

**Criterio de aceptación:** 6 intentos de login incorrectos seguidos retornan 429, no 401.

---

### 3.2 · Backend — Content Security Policy

**Problema:** Helmet está configurado pero sin política CSP personalizada. Por defecto, Helmet en modo permisivo no protege contra XSS si el frontend embebe contenido del CMS.

**Corrección en `main.ts`:**
```ts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://storage.googleapis.com', 'https://res.cloudinary.com'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
```

Ajustar dominios según los buckets GCS reales usados.

---

### 3.3 · Backend — Validar MIME type real de archivos subidos

**Archivo:** `src/modules/files/`

**Problema:** La validación de archivos se basa en la extensión y el `Content-Type` declarado por el cliente, no en el contenido real del archivo. Un atacante puede subir un `.html` malicioso renombrado como `.jpg`.

**Corrección:** Usar `file-type` para validar el magic number del archivo:
```bash
yarn add file-type
```

```ts
// En el servicio de upload
import { fileTypeFromBuffer } from 'file-type';

const detected = await fileTypeFromBuffer(buffer);
if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
  throw new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'Tipo de archivo no permitido.' });
}
```

---

### 3.4 · Backend — Audit log en todas las mutaciones de datos sensibles

**Problema:** `AuditService` existe y está inyectado en `AuthService`, pero no todos los servicios lo usan consistentemente.

**Verificar que estos eventos se auditan:**
- Cambio de contraseña
- Reset de contraseña
- Cambio de email
- Cambio de estado de usuario (ACTIVE/SUSPENDED)
- Cambio de rol
- Eliminación de archivo
- Modificación de publicación de contenido
- Creación/cancelación de cita
- Toda operación de contabilidad (crear cuenta, transacción, venta)

**Agregar audit.log a los servicios que lo omitan.**

---

### 3.5 · Frontend — Firmar la cookie de rol o validar el JWT en el middleware

**Problema actual:** El middleware de Next.js lee el rol desde `cm_session_role` (una cookie no firmada). Un usuario con DevTools puede cambiar el valor y ver la UI de otro rol, aunque el API bloquee las operaciones.

**Opción A (rápida):** Mover el JWT al campo `HttpOnly` + firmarlo con un secreto en el servidor de Next.js (si se despliega como servidor, no como static export).

**Opción B (para static export en Cloudflare Pages):** Aceptar que la validación del rol se hace solo en el API, pero agregar una nota en el `README` explicando este trade-off del modelo de despliegue estático.

**Opción C (recomendada para Cloudflare Pages):** Usar Cloudflare Workers para validar el JWT en el edge antes de servir las páginas protegidas.

**Criterio de aceptación:** Documentar explícitamente qué opción se eligió y por qué.

---

### 3.6 · Backend — Expiración y rotación de refresh tokens

**Verificar en `AuthTokenService`:**
- Los refresh tokens tienen fecha de expiración configurada
- Al usar un refresh token se invalida el anterior (rotación)
- Los refresh tokens se almacenan hasheados en la BD, no en texto plano
- Existe un endpoint `POST /auth/logout` que invalida el refresh token actual

---

## FASE 4 — Deuda técnica y refactoring

### 4.1 · Backend — Consolidar el sistema de archivos: GCS vs Cloudinary

**Problema:** Existen dos proveedores de almacenamiento: Google Cloud Storage y Cloudinary (`CloudinaryDirectUploadService`, `CompleteCloudinaryUploadDto`, `CloudinaryUploadSignatureDto`).

**Acción:**
1. Determinar cuál es el proveedor oficial para producción.
2. Si es GCS: eliminar todo el código de Cloudinary.
3. Si se mantienen ambos (p. ej., Cloudinary para imágenes optimizadas y GCS para documentos): documentar explícitamente la separación de responsabilidades en el README del módulo Files.
4. Actualizar el `ALLOWED_FILE_TYPES` para reflejar qué tipos van a cada proveedor.

**Criterio de aceptación:** El módulo Files tiene un único flujo de upload por tipo de archivo, sin código muerto.

---

### 4.2 · Frontend — Dividir `users.api.ts`

**Problema:** Community 0 del grafo (72 nodos, cohesión 0.06) — el archivo mezcla users, accounting resources, tipos de publicaciones y más.

**Refactoring:**

Antes:
```
src/features/users/users.api.ts  ← 72 nodos mezclados
```

Después:
```
src/features/users/users.api.ts        ← solo CRUD de usuarios
src/features/accounting/accounting.api.ts  ← ya existe, mover lo que falte aquí
src/shared/api/common.ts               ← tipos comunes (SelectOption, etc.)
```

**Pasos:**
1. Identificar qué exports de `users.api.ts` son importados desde fuera del módulo users.
2. Moverlos al módulo correspondiente.
3. Actualizar todos los imports.
4. Verificar que el grafo del frontend ya no tiene una comunidad con 72 nodos.

---

### 4.3 · Frontend — Dividir `newsroom-admin.tsx`

**Problema:** Un componente de 25+ nodos (cohesión 0.10) que mezcla listado de publicaciones, formulario de edición, acciones de publicidad y lógica de estado.

**Refactoring:**

```
src/features/newsroom/newsroom-admin.tsx  ← orquestador thin
src/features/newsroom/publication-list.tsx
src/features/newsroom/publication-editor.tsx
src/features/newsroom/publication-actions.tsx  ← botones de publicar/archivar/etc.
src/features/newsroom/ads-panel.tsx           ← panel de publicidad integrada
```

Cada sub-componente recibe props tipadas y no tiene acceso directo a la API — eso sigue en el orquestador.

---

### 4.4 · Backend — Reducir la comunidad `RedisModule` (cohesión 0.07)

**Problema:** `RedisService` aparece como hub de 33 nodos con cohesión muy baja. Esto indica que el módulo de Redis está siendo usado para responsabilidades heterogéneas.

**Audit:**
```bash
grep -rn "RedisService" src/ --include="*.ts" | grep -v "spec"
```

Si `RedisService` se usa para: caché de sesiones, rate limiting, outbox worker y caché de CMS, separar en servicios especializados:
```
RedisService          ← conexión base (ya existe)
CacheService          ← caché genérico con TTL
SessionStoreService   ← storage de refresh tokens activos
```

---

### 4.5 · Backend — Eliminar `any` sin justificación

**Buscar:**
```bash
grep -rn ": any\|as any\|<any>" src/ --include="*.ts" | grep -v spec | grep -v ".d.ts"
```

Cada `any` debe tener un comentario `// eslint-disable-next-line @typescript-eslint/no-explicit-any — <razón>`. Si no tiene razón justificada, reemplazar con el tipo correcto o `unknown`.

---

## FASE 5 — Observabilidad y operaciones

### 5.1 · Backend — Request ID propagado en todos los logs

**Problema:** `X-Request-Id` está en los headers CORS `exposedHeaders`, pero no está garantizado que se propague a todos los logs de errores.

**Corrección:**
1. En `ResponseInterceptor`, leer el header `X-Request-Id` del request (o generarlo si no viene).
2. Propagarlo al logger con un contexto que lo incluya en cada línea de log.
3. En `HttpExceptionFilter`, asegurarse de que el `requestId` siempre aparece en el log del error.

**Resultado:** Dado un `requestId` de un error reportado por el cliente, se puede encontrar exactamente qué pasó en los logs de producción.

---

### 5.2 · Backend — Health check con verificaciones reales

**Archivo:** `src/modules/health/`

**Problema actual:** Un health check básico que puede reportar `UP` aunque la BD o Redis estén caídos.

**Corrección:** Agregar verificaciones reales:
```ts
// health.controller.ts
@Get()
async check() {
  return {
    status: 'ok',
    checks: {
      database: await this.checkDatabase(),   // SELECT 1
      redis: await this.checkRedis(),          // PING
      storage: await this.checkStorage(),      // HEAD request al bucket
    },
    version: process.env.npm_package_version,
    uptime: process.uptime(),
  };
}
```

El ingress/load balancer que use el cliente puede así distinguir entre "app caída" y "BD caída".

---

### 5.3 · Backend — Endpoint de versión para verificar deploys

Agregar `GET /api/v1/version` (público):
```ts
@Public()
@Get('version')
version() {
  return {
    version: process.env.npm_package_version,
    commit: process.env.GIT_COMMIT ?? 'unknown',
    env: process.env.NODE_ENV,
    buildAt: process.env.BUILD_AT ?? 'unknown',
  };
}
```

Útil para verificar que el deploy más reciente está activo sin abrir los logs del servidor.

---

### 5.4 · Frontend — Error boundary global

**Problema:** Un error de rendering no capturado en cualquier componente deja al usuario con una pantalla en blanco sin mensaje.

**Crear `src/shared/ui/error-boundary.tsx`:**
```tsx
'use client';
import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="p-8 text-center">
          <h2>Algo salió mal</h2>
          <p>{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })}>Reintentar</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Envolver el layout root y cada feature crítico (booking, dashboard) con `ErrorBoundary`.

---

### 5.5 · Frontend — Loading states consistentes

**Problema:** Algunas páginas no muestran loading state mientras TanStack Query carga datos, lo que genera flashes de contenido vacío.

**Solución:** Estandarizar el patrón:
```tsx
const { data, isLoading, isError } = useQuery(...);

if (isLoading) return <LoadingState />;
if (isError) return <ErrorState message={humanizeApiError(error)} />;
```

Crear `<Skeleton />` components para las tablas admin y las cards de contenido público.

---

## FASE 6 — CI/CD y despliegue

### 6.1 · GitHub Actions — Pipeline completo

**Crear `.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: cm_test
          POSTGRES_USER: cm
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'yarn' }
      - run: cd backend && yarn install --frozen-lockfile
      - run: cd backend && yarn typecheck
      - run: cd backend && yarn lint
      - run: cd backend && yarn test --coverage
      - run: cd backend && yarn test:e2e
      - run: cd backend && node scripts/check-no-secrets.js
      - run: cd backend && yarn audit:dependencies

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'yarn' }
      - run: cd corazonmigranteFrontend && yarn install --frozen-lockfile
      - run: cd corazonmigranteFrontend && yarn typecheck
      - run: cd corazonmigranteFrontend && yarn lint
      - run: cd corazonmigranteFrontend && yarn test
      - run: cd corazonmigranteFrontend && yarn build
```

**Criterio de aceptación:** Cada PR tiene el pipeline verde antes de poder hacer merge a `main`.

---

### 6.2 · Backend — Docker image lista para producción

**Revisar `Dockerfile`** (si existe) o crear:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false
COPY . .
RUN yarn build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/database/migrations ./src/database/migrations
COPY --from=builder /app/src/database/seeders ./src/database/seeders
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
```

Agregar `.dockerignore` para excluir `node_modules`, `.env`, `storage/`, `dist/`.

---

### 6.3 · Backend — Variables de entorno documentadas para el cliente

**Crear/actualizar `.env.example`** con TODOS los valores, agrupados y comentados:

```bash
# === APP ===
NODE_ENV=production
PORT=3000
APP_CORS_ORIGINS=https://corazonmigrante.com,https://www.corazonmigrante.com

# === DATABASE ===
DATABASE_URL=postgres://user:password@host:5432/dbname
# Neon: postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# === AUTH ===
JWT_SECRET=<string-de-al-menos-32-chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# === REDIS ===
REDIS_URL=redis://localhost:6379

# === GCS ===
GCS_BUCKET_NAME=corazonmigrante-files
GCS_PROJECT_ID=mi-proyecto-gcp
GCS_CLIENT_EMAIL=service-account@proyecto.iam.gserviceaccount.com
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# === SENDGRID ===
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=no-reply@corazonmigrante.com

# === SWAGGER ===
SWAGGER_ENABLED=false   # true solo en staging
```

---

### 6.4 · Frontend — Variables de entorno documentadas

**Crear/actualizar `.env.example`:**
```bash
# URL base del backend (sin /api/v1 al final)
NEXT_PUBLIC_API_BASE_URL=https://api.corazonmigrante.com

# Servidor de archivos (puede ser igual al API o una CDN)
NEXT_PUBLIC_FILE_SERVER=https://api.corazonmigrante.com

# Solo para desarrollo
NEXT_PUBLIC_DEBUG_LOG=false
```

---

## FASE 7 — UX, Accesibilidad y SEO

### 7.1 · Frontend — Metadata completa en todas las páginas públicas

**Problema:** Las páginas públicas (landing, biblioteca, noticias, novedades) necesitan metadata completa para SEO y para verse bien al compartir en redes sociales.

**Implementar en cada `page.tsx` público:**
```ts
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Corazón Migrante — Psicoterapia para la comunidad migrante',
    description: 'Conectamos migrantes con terapeutas especializados en experiencias migratorias.',
    openGraph: {
      title: 'Corazón Migrante',
      description: '...',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
      locale: 'es_BO',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Corazón Migrante',
    },
    robots: { index: true, follow: true },
    alternates: { canonical: 'https://corazonmigrante.com' },
  };
}
```

Para páginas de artículos, usar el título y descripción real del artículo.

---

### 7.2 · Frontend — Sitemap y robots.txt

**Crear `src/app/sitemap.ts`:**
```ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Incluir landing, biblioteca, noticias, novedades
  // Excluir páginas admin, dashboard, 403
  const publications = await fetchPublicPublicationSlugs();
  return [
    { url: 'https://corazonmigrante.com', changeFrequency: 'monthly', priority: 1 },
    { url: 'https://corazonmigrante.com/biblioteca', changeFrequency: 'weekly', priority: 0.8 },
    ...publications.map(slug => ({
      url: `https://corazonmigrante.com/biblioteca/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
```

**Crear `public/robots.txt`:**
```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /paciente/
Disallow: /terapeuta/
Sitemap: https://corazonmigrante.com/sitemap.xml
```

---

### 7.3 · Frontend — Accesibilidad básica (WCAG 2.1 AA)

**Audit con herramienta automática:**
```bash
npx axe-cli https://localhost:4173 --load-delay 2000
```

**Correcciones típicas a verificar:**
- Todos los `<img>` tienen `alt` descriptivo (no vacío, no "imagen")
- Todos los botones de icono tienen `aria-label`
- Los campos de formulario tienen `<label>` asociado (no solo placeholder)
- Los modales tienen `role="dialog"` y `aria-modal="true"`
- El contraste de texto cumple ratio mínimo 4.5:1 (usar [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/))
- La navegación puede hacerse completamente con teclado (Tab, Enter, Escape)
- Las alertas de error usan `role="alert"` para lectores de pantalla

---

### 7.4 · Frontend — Optimización de imágenes

**Reemplazar todos los `<img>` en páginas públicas con `next/image`:**
```tsx
import Image from 'next/image';

// Antes:
<img src={article.coverUrl} alt={article.title} className="w-full h-48 object-cover" />

// Después:
<Image
  src={article.coverUrl}
  alt={article.title}
  width={800}
  height={400}
  className="w-full h-48 object-cover"
  priority={isAboveFold}
/>
```

Configurar `next.config.ts` para permitir los dominios de imágenes:
```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'storage.googleapis.com' },
    { protocol: 'https', hostname: 'res.cloudinary.com' },
  ],
},
```

---

### 7.5 · Frontend — Feedback visual en formularios

**Problema:** Algunos formularios no muestran claramente el estado de envío (loading) ni el éxito.

**Estándar a aplicar en todos los formularios:**
```tsx
<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? (
    <><Spinner className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
  ) : (
    'Guardar'
  )}
</Button>

{isSuccess && (
  <p role="status" className="text-green-600 mt-2">
    ✓ Los cambios se guardaron correctamente.
  </p>
)}
```

---

## FASE 8 — Documentación para el cliente

### 8.1 · `README.md` operacional (backend)

El README debe responder estas preguntas sin necesidad de llamar al desarrollador:

1. **Requisitos** — versiones exactas de Node, PostgreSQL, Redis
2. **Arranque en 5 minutos** — clonar, configurar `.env`, `yarn db:deploy`, `yarn start:dev`
3. **Flujo de deploy** — `yarn build` → `yarn start:prod` → verificar `/health`
4. **Gestión de la BD** — cómo correr migraciones, cómo revertirlas, cómo re-sembrar
5. **Credenciales demo** — tabla con email, contraseña y rol para cada tipo de usuario de prueba
6. **Backup** — cómo funciona el backup a Neon, cómo restaurarlo
7. **Monitoreo** — qué endpoints revisar si hay problemas (`/health`, `/api/v1/version`)
8. **Cómo agregar un módulo nuevo** — checklist de 10 pasos

---

### 8.2 · `README.md` operacional (frontend)

1. **Requisitos** — versiones de Node, variables de entorno obligatorias
2. **Arranque** — `.env.local`, `yarn dev`
3. **Deploy a Cloudflare Pages** — `yarn build:cloudflare`, configurar Pages project
4. **Variables de entorno en Cloudflare** — cuáles configurar y dónde en el dashboard
5. **Rutas del sistema** — tabla con todas las rutas, qué rol puede acceder y qué hace
6. **Cómo el cliente edita el contenido** — flujo: entrar a `/admin/contenido` → publicar

---

### 8.3 · Swagger completo con ejemplos

**Backend:** Cada endpoint debe tener:
- `@ApiOperation({ summary: '...', description: '...' })`
- `@ApiResponse({ status: 200, description: '...', type: ResponseDto })`
- `@ApiResponse({ status: 400, description: 'Datos inválidos' })`
- `@ApiResponse({ status: 401, description: 'No autenticado' })`
- `@ApiResponse({ status: 403, description: 'Sin permisos' })`

Los endpoints públicos más usados por el frontend (landing, biblioteca, booking) deben tener ejemplos de respuesta reales.

---

### 8.4 · Guía de incidentes

**Crear `docs/INCIDENT_PLAYBOOK.md`** con respuesta a los 5 escenarios más probables en producción:

1. **El login no funciona** — ¿Cómo verificar? ¿Dónde mirar en los logs? ¿Qué hacer?
2. **Los emails no llegan** — Verificar outbox, verificar SendGrid, qué comandos SQL usar
3. **El upload de archivos falla** — Verificar GCS, verificar permisos de service account
4. **La base de datos está lenta** — Qué queries revisar, cómo identificar slow queries
5. **El backup a Neon falló** — Cómo detectarlo, cómo relanzarlo manualmente

---

## Checklist de entregable 10/10

Antes de entregar al cliente, verificar cada ítem:

### Funcionalidad
- [ ] Flujo de registro de paciente completo (sin errores)
- [ ] Flujo de booking completo (selección terapeuta → slot → confirmación → email)
- [ ] Dashboard de admin funcional (usuarios, contenido, publicidad, contabilidad)
- [ ] Dashboard de terapeuta funcional (agenda, horarios, solicitudes)
- [ ] Dashboard de paciente funcional (citas, perfil, premium)
- [ ] CMS público funcional (landing, noticias, biblioteca, novedades)
- [ ] Páginas legales con contenido real (términos, privacidad)
- [ ] Login y logout funcionan en todos los roles
- [ ] Upload de archivos funciona en producción
- [ ] Emails transaccionales llegan (bienvenida, reset de contraseña)

### Seguridad
- [ ] `check-no-secrets.js` retorna cero hallazgos
- [ ] `forbidNonWhitelisted: true` activo en todos los entornos
- [ ] Rate limiting estricto en login y password-reset
- [ ] MIME type real validado en uploads
- [ ] Headers de seguridad activos (Helmet + CSP)
- [ ] Refresh tokens con rotación activa

### Testing
- [ ] Cobertura de backend ≥ 70% en servicios críticos
- [ ] Tests E2E de los 4 flujos obligatorios pasan en CI
- [ ] Tests del frontend pasan en CI
- [ ] Pipeline CI verde en la rama `main`

### Operaciones
- [ ] `/health` retorna estado real de BD, Redis y storage
- [ ] `GET /api/v1/version` retorna commit de producción actual
- [ ] Logs con `requestId` en todos los errores
- [ ] `.env.example` completo y documentado para ambos proyectos
- [ ] Backup de BD verificado y funcional
- [ ] Guía de incidentes entregada al cliente

### UX y accesibilidad
- [ ] Metadata SEO en todas las páginas públicas
- [ ] `sitemap.xml` accesible en producción
- [ ] `robots.txt` configurado
- [ ] Sin `<img>` sin `alt` en páginas públicas
- [ ] Contraste de texto cumple WCAG AA
- [ ] Feedback de loading en todos los formularios

### Documentación
- [ ] README de backend responde las 8 preguntas operacionales
- [ ] README de frontend responde las 6 preguntas operacionales
- [ ] Swagger completo con ejemplos en endpoints públicos críticos
- [ ] Credenciales demo documentadas y funcionando

---

## Orden de ejecución recomendado para 2 desarrolladores

### Semana 1
| Dev A (Backend) | Dev B (Frontend) |
|-----------------|------------------|
| Fase 0.1 — forbidNonWhitelisted | Fase 0.2 — CMS asset URL |
| Fase 0.4 — Audit credenciales | Fase 0.3 — Texto legal |
| Fase 1.3 — Contrato disponibilidad | Fase 1.1 — Selector de terapeuta |
| Fase 1.4 — LegacyCompatibility audit | Fase 1.2 — Shapes finales |
| Fase 3.1 — Rate limiting | Fase 3.5 — Cookie de rol |

### Semana 2
| Dev A (Backend) | Dev B (Frontend) |
|-----------------|------------------|
| Fase 2.1 — Setup testing BE | Fase 2.4 — Setup testing FE |
| Fase 2.2 — Unit tests servicios | Fase 2.5 — Unit tests normalizers |
| Fase 2.3 — Tests E2E | Fase 2.6 — Tests integración componentes |
| Fase 3.2 — CSP | Fase 5.4 — Error boundary |
| Fase 3.3 — MIME validation | Fase 5.5 — Loading states |

### Semana 3
| Dev A (Backend) | Dev B (Frontend) |
|-----------------|------------------|
| Fase 4.1 — GCS vs Cloudinary | Fase 4.2 — Dividir users.api.ts |
| Fase 5.1 — Request ID | Fase 4.3 — Dividir newsroom-admin.tsx |
| Fase 5.2 — Health check real | Fase 7.1 — Metadata SEO |
| Fase 6.1 — GitHub Actions | Fase 7.2 — Sitemap |
| Fase 6.2 — Docker | Fase 7.3 — Accesibilidad |
| Fase 8.1/8.2 — READMEs | Fase 8.3/8.4 — Swagger + Playbook |

---

*Plan generado el 2026-07-19 basado en análisis de graphify (backend: 306 archivos, 2771 nodos; frontend: 187 archivos, 1170 nodos) y revisión de código fuente.*
