import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import {
  SpanRedactionProcessor,
  redactSqlLiterals,
  stripQueryString,
} from './span-redaction.processor';

const spanWith = (attributes: Record<string, unknown>) =>
  ({ attributes }) as unknown as ReadableSpan;

describe('redactSqlLiterals', () => {
  it('elimina el valor real de una búsqueda ILIKE', () => {
    // Caso real capturado en Jaeger: Sequelize interpola el literal en el SQL,
    // así que el correo del paciente viajaba dentro de la consulta.
    const sql =
      `SELECT count("TherapyProduct"."id") FROM "therapy_products" ` +
      `WHERE ("TherapyProduct"."name" ILIKE '%juan.perez@gmail.com%' ` +
      `AND "TherapyProduct"."status" = 'ACTIVE')`;

    const redacted = redactSqlLiterals(sql);

    expect(redacted).not.toContain('juan.perez@gmail.com');
    expect(redacted).not.toContain('ACTIVE');
    // La forma de la consulta se conserva: sigue sirviendo para medir latencia.
    expect(redacted).toContain('FROM "therapy_products"');
    expect(redacted).toContain("ILIKE '?'");
  });

  it('redacta números usados como valores', () => {
    expect(redactSqlLiterals('SELECT * FROM citas WHERE precio = 350 LIMIT 20')).toBe(
      'SELECT * FROM citas WHERE precio = ? LIMIT 20',
    );
    expect(redactSqlLiterals('INSERT INTO t VALUES (1, 2.5)')).toBe('INSERT INTO t VALUES (?, ?)');
  });

  it('no se rompe con comillas escapadas', () => {
    const redacted = redactSqlLiterals("SELECT * FROM t WHERE nombre = 'O''Brien'");
    expect(redacted).toBe("SELECT * FROM t WHERE nombre = '?'");
    expect(redacted).not.toContain('Brien');
  });

  it('conserva los identificadores entre comillas dobles', () => {
    expect(redactSqlLiterals('SELECT "users"."email" FROM "users"')).toBe(
      'SELECT "users"."email" FROM "users"',
    );
  });
});

describe('stripQueryString', () => {
  it('elimina el query string y el fragmento', () => {
    expect(stripQueryString('/api/v1/therapy/products?search=juan.perez%40gmail.com&page=1')).toBe(
      '/api/v1/therapy/products',
    );
    expect(stripQueryString('https://api.example.com/x?token=abc#seccion')).toBe(
      'https://api.example.com/x',
    );
  });

  it('deja intacta una URL sin parámetros', () => {
    expect(stripQueryString('/api/v1/therapy/products')).toBe('/api/v1/therapy/products');
  });
});

describe('SpanRedactionProcessor', () => {
  const processor = new SpanRedactionProcessor();

  it('sanea los atributos del span antes de exportarlo', () => {
    const span = spanWith({
      'db.query.text': "SELECT * FROM users WHERE email = 'ana@example.com'",
      'url.full': '/api/v1/users?search=ana@example.com',
      'url.query': 'search=ana@example.com',
      'db.query.parameters': ['ana@example.com'],
      'http.route': '/api/v1/users',
    });

    processor.onEnd(span);

    const attributes = span.attributes as Record<string, unknown>;
    expect(attributes['db.query.text']).toBe("SELECT * FROM users WHERE email = '?'");
    expect(attributes['url.full']).toBe('/api/v1/users');
    expect(attributes['url.query']).toBeUndefined();
    expect(attributes['db.query.parameters']).toBeUndefined();
    // Los atributos útiles y no sensibles se conservan.
    expect(attributes['http.route']).toBe('/api/v1/users');
    expect(JSON.stringify(attributes)).not.toContain('ana@example.com');
  });

  it('no falla con spans sin atributos sensibles', () => {
    const span = spanWith({ 'app.module': 'auth' });

    expect(() => processor.onEnd(span)).not.toThrow();
    expect((span.attributes as Record<string, unknown>)['app.module']).toBe('auth');
  });

  it('ignora valores que no son cadenas', () => {
    const span = spanWith({ 'url.full': 42 });

    processor.onEnd(span);

    expect((span.attributes as Record<string, unknown>)['url.full']).toBe(42);
  });

  it('expone un ciclo de vida de procesador válido', async () => {
    await expect(processor.forceFlush()).resolves.toBeUndefined();
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});
