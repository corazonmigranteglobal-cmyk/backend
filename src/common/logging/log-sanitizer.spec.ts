import { sanitizeForLog } from './log-sanitizer';

describe('sanitizeForLog', () => {
  it('redacta las claves sensibles sin importar mayúsculas ni prefijos', () => {
    const sanitized = sanitizeForLog({
      email: 'paciente@example.com',
      password: 'secreta',
      Authorization: 'Bearer abc',
      refreshToken: 'rt',
      apiKey: 'k',
      userPassword: 'otra',
      verificationCode: '123456',
    }) as Record<string, unknown>;

    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.Authorization).toBe('[REDACTED]');
    expect(sanitized.refreshToken).toBe('[REDACTED]');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.userPassword).toBe('[REDACTED]');
    expect(sanitized.verificationCode).toBe('[REDACTED]');
    // Los campos no sensibles se conservan para poder diagnosticar.
    expect(sanitized.email).toBe('paciente@example.com');
  });

  it('redacta también en objetos anidados', () => {
    const sanitized = sanitizeForLog({ nivel1: { nivel2: { token: 'x', ok: true } } }) as any;
    expect(sanitized.nivel1.nivel2.token).toBe('[REDACTED]');
    expect(sanitized.nivel1.nivel2.ok).toBe(true);
  });

  it('corta la recursión en estructuras muy profundas', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'fondo' } } } } } };
    expect(JSON.stringify(sanitizeForLog(deep))).toContain('[MaxDepth]');
  });

  it('trunca cadenas largas indicando el tamaño original', () => {
    const sanitized = sanitizeForLog('x'.repeat(2_500)) as string;
    expect(sanitized).toContain('[truncated:2500]');
    expect(sanitized.length).toBeLessThan(2_100);
  });

  it('trunca arrays largos', () => {
    const sanitized = sanitizeForLog(Array.from({ length: 40 }, (_, i) => i)) as unknown[];
    expect(sanitized).toHaveLength(26);
    expect(sanitized.at(-1)).toBe('[truncated:40]');
  });

  it('resume los ficheros subidos en vez de volcar su contenido', () => {
    const sanitized = sanitizeForLog({
      fieldname: 'file',
      originalname: 'informe.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.alloc(1024),
    }) as Record<string, unknown>;

    expect(sanitized).toEqual({
      fieldname: 'file',
      originalname: 'informe.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    });
    expect(sanitized.buffer).toBeUndefined();
  });

  it('sustituye los buffers por su tamaño', () => {
    expect(sanitizeForLog(Buffer.alloc(16))).toBe('[Buffer:16]');
  });

  it('serializa errores conservando el stack para el log', () => {
    const sanitized = sanitizeForLog(new Error('falló')) as Record<string, unknown>;
    expect(sanitized.name).toBe('Error');
    expect(sanitized.message).toBe('falló');
    expect(typeof sanitized.stack).toBe('string');
  });

  it('normaliza tipos primitivos y valores nulos', () => {
    expect(sanitizeForLog(null)).toBeNull();
    expect(sanitizeForLog(undefined)).toBeUndefined();
    expect(sanitizeForLog(42)).toBe(42);
    expect(sanitizeForLog(false)).toBe(false);
    expect(sanitizeForLog(10n)).toBe('10');
    expect(sanitizeForLog(new Date('2026-08-03T00:00:00.000Z'))).toBe('2026-08-03T00:00:00.000Z');
    expect(sanitizeForLog(Symbol('s'))).toContain('Symbol');
  });
});
