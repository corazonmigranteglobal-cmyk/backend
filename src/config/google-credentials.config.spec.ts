import { resolveGoogleCredentials } from './google-credentials.config';

const SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'corazon-migrante',
  client_email: 'gcs@corazon-migrante.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\\nlinea1\\nlinea2\\n-----END PRIVATE KEY-----\\n',
  private_key_id: 'abc123',
};

const toBase64 = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64');

const GOOGLE_VARS = [
  'GOOGLE_CREDENTIALS_BASE64',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS_BASE64',
  'GOOGLE_CREDENTIALS_JSON',
  'GOOGLE_CREDENTIALS',
  'GOOGLE_SERVICE_ACCOUNT_BASE64',
  'GCP_SERVICE_ACCOUNT_BASE64',
  'GCS_USE_ADC',
];

describe('resolveGoogleCredentials', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of GOOGLE_VARS) delete process.env[key];
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('acepta la variable canónica en Base64', () => {
    process.env.GOOGLE_CREDENTIALS_BASE64 = toBase64(SERVICE_ACCOUNT);

    const resolved = resolveGoogleCredentials();

    expect(resolved.credentials?.project_id).toBe('corazon-migrante');
    expect(resolved.credentials?.client_email).toBe(SERVICE_ACCOUNT.client_email);
    // Los `\n` escapados del .env se convierten en saltos reales; si no, la
    // firma de las URLs de GCS falla con un error críptico.
    expect(resolved.credentials?.private_key).toContain('\n');
    expect(resolved.credentials?.private_key).not.toContain('\\n');
  });

  it('tolera el prefijo data: que añaden algunos paneles', () => {
    process.env.GOOGLE_CREDENTIALS_BASE64 = `data:application/json;base64,${toBase64(SERVICE_ACCOUNT)}`;

    expect(resolveGoogleCredentials().credentials?.project_id).toBe('corazon-migrante');
  });

  it('rechaza credenciales incompletas indicando el campo que falta', () => {
    process.env.GOOGLE_CREDENTIALS_BASE64 = toBase64({
      ...SERVICE_ACCOUNT,
      client_email: undefined,
    });
    expect(() => resolveGoogleCredentials()).toThrow('client_email');

    process.env.GOOGLE_CREDENTIALS_BASE64 = toBase64({ ...SERVICE_ACCOUNT, private_key: 'nope' });
    expect(() => resolveGoogleCredentials()).toThrow('private_key');

    process.env.GOOGLE_CREDENTIALS_BASE64 = toBase64({ ...SERVICE_ACCOUNT, type: 'user' });
    expect(() => resolveGoogleCredentials()).toThrow('service_account');
  });

  it('rechaza Base64 que no contiene JSON', () => {
    process.env.GOOGLE_CREDENTIALS_BASE64 = Buffer.from('texto suelto', 'utf8').toString('base64');
    expect(() => resolveGoogleCredentials()).toThrow('GOOGLE_CREDENTIALS_BASE64');
  });

  it('con GCS_USE_ADC delega en las credenciales por defecto del entorno', () => {
    process.env.GCS_USE_ADC = 'true';

    expect(resolveGoogleCredentials()).toEqual({ keyFilename: undefined });
  });

  it('falla si el fichero de credenciales apuntado no existe', () => {
    process.env.GCS_USE_ADC = 'true';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/ruta/que/no/existe.json';

    expect(() => resolveGoogleCredentials()).toThrow('does not exist');
  });

  it('en desarrollo admite los alias heredados en JSON inline', () => {
    process.env.GOOGLE_CREDENTIALS_JSON = JSON.stringify(SERVICE_ACCOUNT);

    expect(resolveGoogleCredentials().credentials?.project_id).toBe('corazon-migrante');
  });

  it('en desarrollo admite los alias heredados en Base64', () => {
    process.env.GCP_SERVICE_ACCOUNT_BASE64 = toBase64(SERVICE_ACCOUNT);

    expect(resolveGoogleCredentials().credentials?.project_id).toBe('corazon-migrante');
  });

  it('en producción rechaza los alias heredados y exige la variable canónica', () => {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_CREDENTIALS_JSON = JSON.stringify(SERVICE_ACCOUNT);

    expect(() => resolveGoogleCredentials()).toThrow('GOOGLE_CREDENTIALS_BASE64');
  });

  it('devuelve configuración vacía cuando no hay ninguna credencial', () => {
    expect(resolveGoogleCredentials()).toEqual({});

    process.env.NODE_ENV = 'production';
    expect(resolveGoogleCredentials()).toEqual({});
  });
});
