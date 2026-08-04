import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Request, Response } from 'express';

const logger = new Logger('ApiReference');

/**
 * Rutas donde se publica la referencia interactiva.
 *
 * `/docs` sirve la interfaz de Scalar y `/docs/openapi.json` el contrato en
 * crudo, para que un cliente pueda generar tipos sin abrir el navegador.
 */
const REFERENCE_PATH = '/docs';
const CONTRACT_PATH = '/docs/openapi.json';

/**
 * Carga el contrato **versionado** (`openapi/openapi.json`), que es el que
 * valida Redocly en CI. Si no está —por ejemplo en una imagen que no lo
 * copió—, se construye en caliente desde los decoradores.
 *
 * Se prefiere el archivo porque es el artefacto gobernado: lo que ve quien
 * consume la API es exactamente lo que pasó el linter y las comprobaciones de
 * cobertura, no una variante generada al vuelo.
 */
function loadContract(app: NestExpressApplication): Record<string, unknown> {
  const contractFile = join(process.cwd(), 'openapi', 'openapi.json');

  if (existsSync(contractFile)) {
    try {
      return JSON.parse(readFileSync(contractFile, 'utf8')) as Record<string, unknown>;
    } catch (error) {
      logger.warn(
        `No se pudo leer ${contractFile}, se generará el contrato en caliente: ${String(error)}`,
      );
    }
  } else {
    logger.warn(
      'openapi/openapi.json no está presente. Se generará el contrato en caliente; ' +
        'no incluirá las respuestas de error compartidas ni las notas de autorización. ' +
        'Ejecuta `yarn docs:openapi:generate` y asegúrate de que la imagen copia openapi/.',
    );
  }

  const fallback = new DocumentBuilder()
    .setTitle('Corazón Migrante API')
    .setDescription('Contrato generado en caliente. Referencia completa en openapi/openapi.yaml.')
    .setVersion(process.env.npm_package_version ?? '1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearerAuth')
    .build();
  return SwaggerModule.createDocument(app, fallback, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  }) as unknown as Record<string, unknown>;
}

/**
 * Publica la referencia interactiva de la API con Scalar.
 *
 * Sólo se monta cuando `app.swaggerEnabled` es cierto. En producción esa
 * bandera es `false` salvo que se active de forma explícita con
 * `SWAGGER_ENABLED=true`: la referencia enumera toda la superficie
 * administrativa y no debe quedar expuesta sin decidirlo.
 */
export function mountApiReference(app: NestExpressApplication, config: ConfigService) {
  const contract = loadContract(app);
  const isProduction = process.env.NODE_ENV === 'production';
  const serverUrl = config.get<string>('files.publicBaseUrl');

  // El servidor que se prueba desde el navegador es aquel en el que está
  // publicada la referencia, no el primero del contrato versionado.
  if (serverUrl) {
    contract.servers = [
      { url: serverUrl, description: isProduction ? 'Este servidor' : 'Instancia local' },
      ...((contract.servers as unknown[] | undefined) ?? []),
    ];
  }

  if (!isProduction) {
    const info = (contract.info ?? {}) as Record<string, unknown>;
    info.description =
      '> **Entorno no productivo.** Los datos que veas o modifiques desde aquí no son reales.\n\n' +
      String(info.description ?? '');
    contract.info = info;
  }

  app.use(CONTRACT_PATH, (_request: Request, response: Response) => {
    response.type('application/json').send(contract);
  });

  app.use(
    REFERENCE_PATH,
    apiReference({
      content: contract,
      theme: 'default',
      darkMode: true,
      hideDownloadButton: false,
      metaData: {
        title: 'Corazón Migrante API — referencia',
        description: 'Referencia interactiva de la API del backend de Corazón Migrante.',
      },
    }),
  );

  logger.log(`Referencia de la API publicada en ${REFERENCE_PATH} (contrato en ${CONTRACT_PATH})`);
}
