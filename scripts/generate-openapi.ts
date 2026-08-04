/**
 * Genera el contrato OpenAPI a partir de la aplicación NestJS real.
 *
 * El documento no se escribe a mano: se construye arrancando `AppModule` y
 * leyendo los metadatos que ya existen en el código (rutas, guards, DTO,
 * decoradores `@Public`, `@Roles`, `@Permissions` y `@Throttle`). Todo lo que
 * este script añade —seguridad, respuestas de error, notas de autorización— se
 * deriva de esos metadatos, de modo que el contrato no puede desviarse del
 * comportamiento sin que la generación lo refleje.
 *
 * Uso:
 *   yarn docs:openapi:generate
 *
 * Requiere PostgreSQL accesible (`docker compose up -d postgres redis`), porque
 * `DatabaseModule` autentica la conexión durante el arranque. Las migraciones,
 * los seeds y el worker de outbox quedan desactivados por variables de entorno.
 */
import 'reflect-metadata';
import 'dotenv/config';
import { INestApplication, Module, RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { NestFactory, DiscoveryService, DiscoveryModule, MetadataScanner } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stringify } from 'yaml';
import { API_PREFIX_EXCLUDED_ROUTES, isPrefixExcluded } from '../src/config/http-routes';

const ROOT = resolve(__dirname, '..');

// Arranque hermético: sin migraciones, sin seeds, sin worker y sin Redis. Se
// fijan antes de importar AppModule porque `configuration.ts` lee process.env
// en tiempo de carga del módulo.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.DATABASE_MIGRATE_ON_STARTUP = 'false';
process.env.DATABASE_SEED_BOOT_ON_STARTUP = 'false';
process.env.DATABASE_SEED_MOCKUP_ON_STARTUP = 'false';
process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.REDIS_ENABLED = 'false';
process.env.OTEL_ENABLED = 'false';
process.env.SWAGGER_ENABLED = 'true';

// La generación es offline: el contrato sale de los metadatos de los
// decoradores, no de los datos. Las rutas quedan registradas antes de que
// Sequelize intente conectarse, así que se apunta la configuración a un host
// inexistente para no abrir jamás una conexión contra una base real —ni
// siquiera de desarrollo— por el mero hecho de documentar.
//
// `--use-env-database` conserva la configuración de `.env` para depurar
// diferencias entre el contrato y una instancia concreta.
if (!process.argv.includes('--use-env-database')) {
  process.env.DATABASE_HOST = 'openapi.generation.invalid';
  process.env.DATABASE_PORT = '5432';
  process.env.DATABASE_NAME = 'openapi_generation';
  process.env.DATABASE_USER = 'openapi_generation';
  process.env.DATABASE_PASSWORD = 'openapi_generation';
  process.env.DATABASE_SSL = 'false';
  process.env.DATABASE_CONNECTION_TIMEOUT_MS = '1000';
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  version: string;
};

const IS_PUBLIC_KEY = 'isPublic';
const ROLES_KEY = 'roles';
const PERMISSIONS_KEY = 'permissions';

interface RouteAuthz {
  controller: string;
  handler: string;
  sourceFile: string;
  isPublic: boolean;
  roles: string[];
  permissions: string[];
}

/** Clave estable de una operación: `METHOD /ruta/openapi`. */
function routeKey(method: string, path: string) {
  return `${method.toUpperCase()} ${path}`;
}

/**
 * Mapa `NombreDeClase -> ruta del archivo`, para que la tabla de rutas y los
 * catálogos por módulo puedan enlazar cada operación con su código.
 */
const controllerFiles = new Map<string, string>();
function indexControllerFiles(dir = join(ROOT, 'src')) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      indexControllerFiles(full);
      continue;
    }
    if (!entry.name.endsWith('.controller.ts') || entry.name.endsWith('.spec.ts')) continue;
    const relative = full.slice(ROOT.length + 1).replace(/\\/g, '/');
    for (const match of readFileSync(full, 'utf8').matchAll(/export class (\w+)/g)) {
      controllerFiles.set(match[1], relative);
    }
  }
}

function sourceFileOf(controllerName: string) {
  return controllerFiles.get(controllerName) ?? '';
}

const HTTP_METHODS: Record<number, string> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.DELETE]: 'delete',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.ALL]: 'all',
  [RequestMethod.OPTIONS]: 'options',
  [RequestMethod.HEAD]: 'head',
};

/** `users/:id/roles` -> `/users/{id}/roles` */
function toOpenApiPath(prefix: string, controllerPath: string, handlerPath: string) {
  const segments = [prefix, controllerPath, handlerPath]
    .map((part) => String(part ?? '').replace(/^\/+|\/+$/g, ''))
    .filter((part) => part.length > 0);
  const joined = '/' + segments.join('/');
  return joined.replace(/:([A-Za-z0-9_]+)/g, '{$1}').replace(/\/+/g, '/');
}

/**
 * Rutas OpenAPI de un handler.
 *
 * Un `@Controller()` puede declarar varios prefijos (`@Controller(['admin/messaging',
 * 'admin/mensajeria'])`) y un handler varias rutas: Nest registra el producto
 * cartesiano de ambos, y el contrato debe listarlas todas.
 */
function expandPaths(
  apiPrefix: string,
  controllerPath: unknown,
  handlerPath: unknown,
  method: RequestMethod,
) {
  const controllerPaths = Array.isArray(controllerPath) ? controllerPath : [controllerPath ?? ''];
  const handlerPaths = Array.isArray(handlerPath) ? handlerPath : [handlerPath ?? ''];
  const paths: string[] = [];

  for (const base of controllerPaths) {
    for (const suffix of handlerPaths) {
      const withoutPrefix = toOpenApiPath('', String(base), String(suffix));
      // Las rutas excluidas del prefijo global (p. ej. `/health`) se publican
      // en la raíz, igual que en tiempo de ejecución.
      const prefix = isPrefixExcluded(withoutPrefix, method) ? '' : apiPrefix;
      paths.push(toOpenApiPath(prefix, String(base), String(suffix)));
    }
  }
  return [...new Set(paths)];
}

/**
 * Recorre los controladores registrados y devuelve, por operación, los metadatos
 * de autorización que aplican los guards globales.
 */
function collectRouteAuthz(app: INestApplication, apiPrefix: string): Map<string, RouteAuthz> {
  const discovery = app.get(DiscoveryService);
  const scanner = new MetadataScanner();
  const table = new Map<string, RouteAuthz>();
  indexControllerFiles();

  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    if (!instance || !metatype) continue;

    const controllerPath = Reflect.getMetadata(PATH_METADATA, metatype) ?? '';
    const controllerPublic = Reflect.getMetadata(IS_PUBLIC_KEY, metatype) === true;
    const controllerRoles: string[] = Reflect.getMetadata(ROLES_KEY, metatype) ?? [];
    const controllerPermissions: string[] = Reflect.getMetadata(PERMISSIONS_KEY, metatype) ?? [];

    const prototype = Object.getPrototypeOf(instance);
    for (const methodName of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[methodName];
      const methodCode = Reflect.getMetadata(METHOD_METADATA, handler);
      if (methodCode === undefined) continue;

      const handlerPath = Reflect.getMetadata(PATH_METADATA, handler) ?? '';
      const verb = HTTP_METHODS[methodCode as number];
      if (!verb || verb === 'all') continue;

      // El controlador no puede "desmarcar" @Public en el handler ni al revés:
      // JwtAuthGuard consulta ambos niveles y basta con que uno lo declare.
      const isPublic = controllerPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
      const roles = [
        ...new Set([...controllerRoles, ...(Reflect.getMetadata(ROLES_KEY, handler) ?? [])]),
      ];
      const permissions = [
        ...new Set([
          ...controllerPermissions,
          ...(Reflect.getMetadata(PERMISSIONS_KEY, handler) ?? []),
        ]),
      ];
      for (const path of expandPaths(
        apiPrefix,
        controllerPath,
        handlerPath,
        methodCode as RequestMethod,
      )) {
        table.set(routeKey(verb, path), {
          controller: metatype.name,
          handler: methodName,
          sourceFile: sourceFileOf(metatype.name),
          isPublic,
          roles,
          permissions,
        });
      }
    }
  }

  return table;
}

/** Componentes compartidos que el generador inyecta en todo el contrato. */
function errorResponse(description: string, code: string, message: string, status: number) {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ApiErrorResponseDto' },
        example: {
          error: { code, message, details: [] },
          meta: {
            requestId: '3f1c8a52-9d47-4a0b-8f21-6d5c0f1e2b7a',
            timestamp: '2026-08-03T19:45:12.345Z',
          },
        },
      },
    },
    headers: {
      'X-Request-Id': {
        description: 'Identificador de la petición, para correlacionar con los logs del servidor.',
        schema: { type: 'string', format: 'uuid' },
      },
      'x-trace-id': {
        description: 'Identificador de la traza OpenTelemetry asociada a la petición.',
        schema: { type: 'string' },
      },
    },
    'x-status': status,
  } as Record<string, unknown>;
}

const SHARED_RESPONSES: Record<string, Record<string, unknown>> = {
  BadRequest: errorResponse(
    'La solicitud no supera la validación. `details` enumera los campos rechazados. `ValidationPipe` corre con `whitelist` y `forbidNonWhitelisted`, así que enviar una propiedad no declarada también produce este error.',
    'VALIDATION_ERROR',
    'La solicitud contiene datos con un formato invalido.',
    400,
  ),
  Unauthorized: errorResponse(
    'Falta el token de acceso, está expirado o no es válido.',
    'UNAUTHORIZED',
    'Token de acceso inválido o expirado.',
    401,
  ),
  Forbidden: errorResponse(
    'El token es válido pero la identidad no tiene el rol o permiso que exige la operación.',
    'FORBIDDEN',
    'No tienes permisos para realizar esta acción.',
    403,
  ),
  NotFound: errorResponse(
    'El recurso indicado no existe o no es visible para la identidad autenticada.',
    'RESOURCE_NOT_FOUND',
    'El recurso solicitado no existe.',
    404,
  ),
  Conflict: errorResponse(
    'La operación choca con el estado actual: un valor único ya existe (`RESOURCE_ALREADY_EXISTS`) o hay una referencia que lo impide (`RESOURCE_REFERENCE_CONFLICT`).',
    'RESOURCE_ALREADY_EXISTS',
    'Ya existe un registro con esos datos.',
    409,
  ),
  PayloadTooLarge: errorResponse(
    'El cuerpo supera `HTTP_BODY_LIMIT` (1 MB por defecto) o el archivo supera `MAX_UPLOAD_MB`.',
    'HTTP_413',
    'El cuerpo de la solicitud excede el tamaño máximo permitido.',
    413,
  ),
  TooManyRequests: errorResponse(
    'Se superó el límite de peticiones. `ThrottlerGuard` es global: 120 peticiones por minuto salvo que la operación declare su propio `@Throttle`.',
    'HTTP_429',
    'ThrottlerException: Too Many Requests',
    429,
  ),
  InternalServerError: errorResponse(
    'Fallo no controlado. El cuerpo nunca expone la causa; usa `meta.requestId` o la cabecera `x-trace-id` para localizarlo en los logs y trazas.',
    'INTERNAL_SERVER_ERROR',
    'Ocurrió un error inesperado.',
    500,
  ),
  ServiceUnavailable: errorResponse(
    'Una dependencia de infraestructura (base de datos) no está disponible.',
    'SERVICE_UNAVAILABLE',
    'Servicio temporalmente no disponible.',
    503,
  ),
};

/**
 * Taxonomía canónica de etiquetas: **una por dominio**, sin separar público de
 * administración. Quien consume la API razona por dominio («todo lo de citas»),
 * no por nivel de privilegio, y el privilegio ya se ve en la ruta y en el
 * candado de cada operación.
 *
 * Los `@ApiTags` de los controladores deben usar exactamente estos nombres:
 * `scripts/check-openapi-coverage.mjs` falla si aparece una etiqueta que no
 * esté declarada aquí.
 */
const TAG_DESCRIPTIONS: Record<string, string> = {
  Auth: 'Registro, inicio de sesión, rotación de tokens y restablecimiento de contraseña.',
  Usuarios: 'Cuentas, perfiles de paciente y terapeuta, y asignación de roles.',
  Citas: 'Ciclo de vida de las citas: reserva, confirmación, atención, pago y cancelación.',
  Agenda: 'Disponibilidad de terapeutas: horarios, bloqueos y búsqueda de huecos reservables.',
  'Catálogo terapéutico': 'Productos terapéuticos y enfoques ofrecidos por el centro.',
  Contenido:
    'Publicaciones editoriales, taxonomía, personas suscriptoras y acceso a contenido premium.',
  Publicidad: 'Empresas anunciantes, campañas, creatividades, emplazamientos e impresiones.',
  CMS: 'Páginas y elementos editables del sitio público.',
  Portada: 'Composición de la portada pública: secciones y elementos destacados.',
  Archivos: 'Subida, descarga, firma temporal y control de acceso de archivos.',
  Descargables:
    'Recursos descargables, derechos de acceso e integración con la pasarela de pago Hotmart.',
  Contabilidad: 'Plan de cuentas, asientos, transacciones, ventas y centros de coste.',
  Analítica: 'Eventos de interfaz del sitio público y visitas agregadas.',
  Mensajería: 'Outbox transaccional de correo: consulta, reproceso y pruebas de proveedor.',
  Notificaciones: 'Notificaciones dirigidas al panel administrativo.',
  Auditoría: 'Consulta del registro de auditoría del sistema.',
  Salud: 'Sondas de vida y disponibilidad para orquestadores y balanceadores.',
  'Compatibilidad legacy': 'Rutas conservadas para clientes antiguos que aún no han migrado.',
};

async function main() {
  // La importación es diferida a propósito: las variables de entorno de arriba
  // deben estar fijadas antes de que `configuration.ts` se evalúe.
  const { AppModule } = await import('../src/app.module');

  // `AppModule` no importa `DiscoveryModule` porque la aplicación no lo
  // necesita en producción. Este envoltorio lo añade sólo para la generación
  // del contrato, sin tocar el grafo de módulos real.
  @Module({ imports: [AppModule, DiscoveryModule] })
  class OpenApiModule {}

  const app = await NestFactory.create(OpenApiModule, { logger: false, abortOnError: false });
  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix, { exclude: API_PREFIX_EXCLUDED_ROUTES });
  await app.init();

  const authz = collectRouteAuthz(app, apiPrefix);
  assertEveryControllerContributed(authz);

  const builder = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle('Corazón Migrante API')
    .setDescription(
      [
        'API HTTP del backend de Corazón Migrante: agenda terapéutica, catálogo, contenidos',
        'editoriales, publicidad, descargables, contabilidad y administración del sitio público.',
        '',
        '## Sobre de respuesta',
        '',
        'Todas las respuestas de éxito viajan envueltas por `ResponseInterceptor`:',
        '`{ "data": ..., "meta": { "requestId", "timestamp" } }`. Los listados paginados añaden',
        '`pagination`. Los errores los normaliza `HttpExceptionFilter` a',
        '`{ "error": { "code", "message", "details" }, "meta": { ... } }`.',
        '',
        'Ramifica siempre por `error.code`, nunca por `error.message`: los mensajes son texto',
        'para la persona usuaria y pueden cambiar sin previo aviso.',
        '',
        '## Autenticación',
        '',
        'Las operaciones marcadas con candado requieren `Authorization: Bearer <accessToken>`.',
        'El token se obtiene en `POST /api/v1/auth/login` y se renueva en',
        '`POST /api/v1/auth/refresh`. Cada operación protegida documenta en su descripción los',
        'roles y permisos concretos que exige.',
        '',
        '## Límite de peticiones',
        '',
        '`ThrottlerGuard` es global: 120 peticiones por minuto y dirección IP. Las operaciones',
        'sensibles (login, registro, restablecimiento de contraseña) declaran límites más',
        'estrictos, indicados en su descripción.',
      ].join('\n'),
    )
    .setVersion(packageJson.version)
    .setContact('Equipo Corazón Migrante', '', 'cpacentropreparacionacademica@gmail.com')
    .setLicense('LicenseRef-Propietaria', 'https://corazonmigrante.com')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Token de acceso emitido por `POST /api/v1/auth/login`. Vida útil por defecto: 15 minutos.',
      },
      'bearerAuth',
    )
    // URLs tomadas de `.env.production.example` y `render.yaml`; no se inventan.
    .addServer('https://api.corazonmigrante.com', 'Producción')
    .addServer('http://localhost:3000', 'Desarrollo local');

  for (const [name, description] of Object.entries(TAG_DESCRIPTIONS)) {
    builder.addTag(name, description);
  }

  const { ApiErrorResponseDto, ApiSuccessResponseDto, PaginationMetaDto, ResponseMetaDto } =
    await import('../src/common/openapi/envelope.dto');

  const document = SwaggerModule.createDocument(app, builder.build(), {
    // operationId estable y único: `Controlador_metodo`. No depende del orden
    // de registro de los módulos, así que el diff del contrato es limpio.
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
    // Los sobres se referencian desde el post-proceso, no desde un decorador,
    // así que hay que registrarlos explícitamente o no llegarían a `components`.
    extraModels: [ApiErrorResponseDto, ApiSuccessResponseDto, PaginationMetaDto, ResponseMetaDto],
  });

  enrich(document, authz);

  const outDir = join(ROOT, 'openapi');
  mkdirSync(outDir, { recursive: true });
  const yamlPath = join(outDir, 'openapi.yaml');
  const jsonPath = join(outDir, 'openapi.json');
  writeFileSync(yamlPath, stringify(document, { lineWidth: 0 }), 'utf8');
  writeFileSync(jsonPath, JSON.stringify(document, null, 2) + '\n', 'utf8');

  // Tabla de rutas: la lee `check-openapi-coverage.mjs` para comprobar paridad
  // entre lo que Nest registra y lo que el contrato publica, y
  // `generate-module-docs.mjs` para construir los catálogos de endpoints.
  const routeTablePath = join(outDir, 'route-table.json');
  const routeTable = [...authz.entries()]
    .map(([key, value]) => {
      const [method, path] = key.split(' ');
      return { method, path, ...value };
    })
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  writeFileSync(
    routeTablePath,
    JSON.stringify(
      {
        generatedFrom: 'scripts/generate-openapi.ts',
        apiPrefix: process.env.API_PREFIX ?? 'api/v1',
        total: routeTable.length,
        routes: routeTable,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  const operations = countOperations(document);
  process.stdout.write(
    `OpenAPI ${document.openapi} generado: ${Object.keys(document.paths).length} rutas, ${operations} operaciones.\n` +
      `  ${yamlPath}\n  ${jsonPath}\n  ${routeTablePath} (${routeTable.length} rutas registradas por Nest)\n`,
  );

  await app.close();
}

/**
 * Red de seguridad contra contratos parciales.
 *
 * La app se crea con `abortOnError: false` para poder generar sin base de
 * datos. El efecto secundario es que un módulo que falle al inicializarse no
 * detiene el proceso: se produciría un contrato al que le faltan rutas y nada
 * lo delataría, porque la tabla de rutas se construye desde la misma app.
 *
 * Por eso se contrasta contra el sistema de archivos: toda clase declarada en
 * un `*.controller.ts` tiene que haber aportado al menos una ruta.
 */
function assertEveryControllerContributed(authz: Map<string, RouteAuthz>) {
  const discovered = new Set([...authz.values()].map((route) => route.controller));
  const missing = [...controllerFiles.entries()]
    .filter(([name]) => !discovered.has(name))
    .map(([name, file]) => `${name} (${file})`);

  if (missing.length > 0) {
    throw new Error(
      `Los siguientes controladores no aportaron ninguna ruta, así que el contrato estaría incompleto:\n  - ${missing.join('\n  - ')}\n` +
        'Suele indicar que un módulo falló al inicializarse o que el controlador no está declarado en su módulo.',
    );
  }
}

/**
 * Traduce `nullable: true` (OpenAPI 3.0) a la forma de 3.1.
 *
 * `@nestjs/swagger` emite `nullable: true` porque su modelo interno es 3.0. En
 * 3.1 esa palabra clave ya no existe: la nulabilidad se expresa añadiendo
 * `'null'` al tipo. Sin esta conversión, Redocly rechaza el documento con la
 * regla `struct`.
 */
function normalizeNullableForOpenApi31(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) normalizeNullableForOpenApi31(item);
    return;
  }
  if (!node || typeof node !== 'object') return;

  const schema = node as Record<string, unknown>;
  if (schema.nullable === true) {
    delete schema.nullable;
    if (typeof schema.type === 'string') {
      schema.type = [schema.type, 'null'];
    } else if (Array.isArray(schema.type)) {
      if (!schema.type.includes('null')) schema.type.push('null');
    } else if (schema.$ref) {
      // Un `$ref` no admite hermanos con significado en 3.1: se envuelve.
      const ref = schema.$ref;
      delete schema.$ref;
      schema.oneOf = [{ $ref: ref }, { type: 'null' }];
    }
    // Si no hay `type` ni `$ref` no se añade ninguno: en 3.1, un esquema sin
    // `type` admite cualquier valor, `null` incluido. Forzar `type: 'null'`
    // aquí invalidaría el `example` de la propiedad, que es justo lo que
    // ocurre con `@ApiPropertyOptional({ nullable: true, example: 'pdf' })`
    // sobre un `string | null`: TypeScript no emite metadato de tipo para las
    // uniones, así que el esquema llega sin `type`.
  } else if (schema.nullable === false) {
    delete schema.nullable;
  }

  for (const value of Object.values(schema)) normalizeNullableForOpenApi31(value);
}

function countOperations(document: OpenAPIObject) {
  let total = 0;
  for (const item of Object.values(document.paths)) {
    for (const verb of Object.keys(item)) {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(verb)) total += 1;
    }
  }
  return total;
}

/**
 * Completa el documento con todo lo que el explorador de Swagger no puede
 * deducir por sí solo pero sí está en el código: seguridad efectiva, respuestas
 * de error del filtro global y la nota de autorización de cada operación.
 */
function enrich(document: OpenAPIObject, authz: Map<string, RouteAuthz>) {
  const components = (document.components = document.components ?? {});
  components.responses = {
    ...(components.responses ?? {}),
    ...Object.fromEntries(
      Object.entries(SHARED_RESPONSES).map(([name, value]) => {
        const { 'x-status': _status, ...rest } = value;
        return [name, rest];
      }),
    ),
  } as NonNullable<typeof components.responses>;

  normalizeNullableForOpenApi31(components.schemas);

  const statusByName = Object.fromEntries(
    Object.entries(SHARED_RESPONSES).map(([name, value]) => [name, value['x-status'] as number]),
  );

  for (const [path, item] of Object.entries(document.paths)) {
    for (const [verb, operation] of Object.entries(item)) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(verb)) continue;
      const op = operation as Record<string, any>;
      const meta = authz.get(routeKey(verb, path));

      // 1. Seguridad efectiva, tomada de @Public / guards globales.
      if (meta?.isPublic) {
        op.security = [];
      } else {
        op.security = [{ bearerAuth: [] }];
      }

      // 2. Nota de autorización, derivada de @Roles y @Permissions.
      const notes: string[] = [];
      if (meta?.isPublic) {
        notes.push('**Acceso:** público, no requiere autenticación.');
      } else {
        notes.push('**Acceso:** requiere token de acceso válido.');
        if (meta?.roles.length) notes.push(`**Roles aceptados:** \`${meta.roles.join('`, `')}\`.`);
        if (meta?.permissions.length)
          notes.push(`**Permisos requeridos:** \`${meta.permissions.join('`, `')}\`.`);
      }
      const existing = typeof op.description === 'string' ? op.description.trim() : '';
      op.description = [existing, notes.join(' ')].filter(Boolean).join('\n\n');

      // 3. Respuestas de error del filtro global. Sólo se añaden las que la
      //    operación no documenta ya de forma específica.
      // `ServiceUnavailable` aplica a todas: `HttpExceptionFilter` traduce
      // cualquier `SequelizeBaseError` no reconocido a 503, y toda operación
      // puede tocar la base de datos, aunque sea al resolver la identidad.
      const applicable = new Set<string>([
        'TooManyRequests',
        'InternalServerError',
        'ServiceUnavailable',
      ]);
      if (!meta?.isPublic) {
        applicable.add('Unauthorized');
        if (meta?.roles.length || meta?.permissions.length) applicable.add('Forbidden');
      }
      if (op.requestBody) {
        applicable.add('BadRequest');
        applicable.add('PayloadTooLarge');
      }
      if ((op.parameters ?? []).length > 0) applicable.add('BadRequest');
      if (path.includes('{')) applicable.add('NotFound');
      if (['post', 'put', 'patch'].includes(verb)) applicable.add('Conflict');

      op.responses = op.responses ?? {};
      for (const name of applicable) {
        const status = String(statusByName[name]);
        if (op.responses[status]) continue;
        op.responses[status] = { $ref: `#/components/responses/${name}` };
      }

      // 4. Sobre de respuesta en los éxitos que no declaran esquema propio.
      //    El interceptor global envuelve *todo*, así que una respuesta 2xx sin
      //    esquema estaría mintiendo por omisión: el cliente recibe `{ data, meta }`,
      //    no el objeto desnudo. Las operaciones que usan `@ApiEnvelope` ya traen
      //    el `data` tipado y no se tocan.
      for (const [status, response] of Object.entries(op.responses)) {
        const code = Number(status);
        if (code < 200 || code >= 300 || code === 204) continue;
        const res = response as Record<string, any>;
        if (res.$ref || res.content) continue;
        res.content = {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiSuccessResponseDto' },
          },
        };
      }

      // 5. Cabeceras de correlación en las respuestas de éxito propias.
      for (const [status, response] of Object.entries(op.responses)) {
        if (Number(status) >= 400) continue;
        const res = response as Record<string, any>;
        if (res.$ref) continue;
        res.headers = {
          ...(res.headers ?? {}),
          'X-Request-Id': {
            description: 'Identificador de la petición, espejo de `meta.requestId`.',
            schema: { type: 'string', format: 'uuid' },
          },
          'x-trace-id': {
            description: 'Identificador de la traza OpenTelemetry asociada a la petición.',
            schema: { type: 'string' },
          },
        };
      }
    }
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`No se pudo generar el contrato OpenAPI: ${String(error)}\n`);
  if (error instanceof Error && error.stack) process.stderr.write(error.stack + '\n');
  process.exitCode = 1;
});
