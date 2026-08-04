import {
  cleanEnvironmentValue,
  decodeOptionalBase64,
  firstEnvironmentValue,
  parseCorsOrigins,
  parseEnvironmentList,
} from './environment.util';

describe('cleanEnvironmentValue', () => {
  it('recorta espacios y descarta valores vacíos', () => {
    expect(cleanEnvironmentValue('  valor  ')).toBe('valor');
    expect(cleanEnvironmentValue('   ')).toBeUndefined();
    expect(cleanEnvironmentValue('')).toBeUndefined();
    expect(cleanEnvironmentValue(undefined)).toBeUndefined();
  });

  it('quita las comillas que algunos paneles de despliegue añaden', () => {
    expect(cleanEnvironmentValue('"valor"')).toBe('valor');
    expect(cleanEnvironmentValue("'valor'")).toBe('valor');
    expect(cleanEnvironmentValue('""')).toBeUndefined();
  });

  it('no toca comillas internas', () => {
    expect(cleanEnvironmentValue('a"b')).toBe('a"b');
  });
});

describe('firstEnvironmentValue', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('devuelve el primer valor no vacío conservando su nombre de origen', () => {
    process.env.PRIMERA = '   ';
    process.env.SEGUNDA = 'valor';

    expect(firstEnvironmentValue('PRIMERA', 'SEGUNDA')).toEqual({
      name: 'SEGUNDA',
      value: 'valor',
    });
  });

  it('devuelve undefined cuando ninguna está definida', () => {
    expect(firstEnvironmentValue('NO_EXISTE_A', 'NO_EXISTE_B')).toBeUndefined();
  });
});

describe('parseEnvironmentList', () => {
  it('separa por comas, recorta y elimina duplicados', () => {
    expect(parseEnvironmentList(' a , b ,a, ,c ')).toEqual(['a', 'b', 'c']);
    expect(parseEnvironmentList(undefined)).toEqual([]);
  });
});

describe('parseCorsOrigins', () => {
  it('conserva todos los orígenes fuera de producción', () => {
    expect(parseCorsOrigins('http://localhost:5173,https://app.example.com')).toEqual([
      'http://localhost:5173',
      'https://app.example.com',
    ]);
  });

  it('en producción descarta los orígenes que no son HTTPS', () => {
    // Un .env que arrastra orígenes locales no debe abrir CORS en producción
    // ni tumbar el arranque: simplemente se ignoran.
    expect(
      parseCorsOrigins('http://localhost:5173,https://app.example.com', { production: true }),
    ).toEqual(['https://app.example.com']);
  });

  it('en producción descarta valores que no son URLs', () => {
    expect(parseCorsOrigins('no-es-una-url,*', { production: true })).toEqual([]);
  });
});

describe('decodeOptionalBase64', () => {
  it('decodifica Base64 estándar', () => {
    const encoded = Buffer.from('contenido secreto', 'utf8').toString('base64');
    expect(decodeOptionalBase64(encoded, 'VAR')).toBe('contenido secreto');
  });

  it('acepta Base64 url-safe y sin relleno', () => {
    const encoded = Buffer.from('a+b/c', 'utf8').toString('base64').replace(/=+$/, '');
    const urlSafe = encoded.replace(/\+/g, '-').replace(/\//g, '_');
    expect(decodeOptionalBase64(urlSafe, 'VAR')).toBe('a+b/c');
  });

  it('tolera saltos de línea dentro del valor', () => {
    const encoded = Buffer.from('multilinea', 'utf8').toString('base64');
    expect(decodeOptionalBase64(`${encoded.slice(0, 4)}\n${encoded.slice(4)}`, 'VAR')).toBe(
      'multilinea',
    );
  });

  it('devuelve undefined cuando no hay valor', () => {
    expect(decodeOptionalBase64(undefined, 'VAR')).toBeUndefined();
    expect(decodeOptionalBase64('   ', 'VAR')).toBeUndefined();
  });

  it('falla pronto e indica la variable culpable si decodifica a vacío', () => {
    expect(() => decodeOptionalBase64('====', 'DATABASE_SSL_CA_BASE64')).toThrow(
      'DATABASE_SSL_CA_BASE64',
    );
  });
});
