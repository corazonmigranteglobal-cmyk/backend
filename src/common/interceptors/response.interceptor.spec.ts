import { ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

const makeContext = (headers: Record<string, string> = {}): ExecutionContext => {
  const setHeader = jest.fn();
  return {
    getHandler: () => ({ name: 'testHandler' }),
    getClass: () => ({ name: 'TestController' }),
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        method: 'GET',
        originalUrl: '/test',
        ip: '127.0.0.1',
        query: {},
        params: {},
        body: {},
      }),
      getResponse: () => ({ statusCode: 200, setHeader }),
    }),
  } as unknown as ExecutionContext;
};

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  it('wraps plain value in { data, meta }', (done) => {
    const ctx = makeContext({ 'x-request-id': 'rid-1' });
    interceptor.intercept(ctx, { handle: () => of({ name: 'test' }) }).subscribe((result) => {
      expect(result).toMatchObject({ data: { name: 'test' }, meta: { requestId: 'rid-1' } });
      done();
    });
  });

  it('wraps paginated value with { data, pagination, meta }', (done) => {
    const ctx = makeContext();
    const paginated = { items: [1, 2], pagination: { page: 1, totalPages: 3 } };
    interceptor.intercept(ctx, { handle: () => of(paginated) }).subscribe((result) => {
      expect(result).toMatchObject({
        data: [1, 2],
        pagination: { page: 1 },
        meta: expect.objectContaining({ requestId: expect.any(String) }),
      });
      done();
    });
  });

  it('passes through __raw payloads unwrapped', (done) => {
    const ctx = makeContext();
    interceptor
      .intercept(ctx, { handle: () => of({ __raw: true, payload: 'raw-data' }) })
      .subscribe((result) => {
        expect(result).toBe('raw-data');
        done();
      });
  });

  it('re-throws errors from handler', (done) => {
    const ctx = makeContext();
    const err = new Error('handler failed');
    interceptor.intercept(ctx, { handle: () => throwError(() => err) }).subscribe({
      error: (e) => {
        expect(e).toBe(err);
        done();
      },
    });
  });

  it('generates requestId when header absent', (done) => {
    const ctx = makeContext();
    interceptor.intercept(ctx, { handle: () => of(null) }).subscribe((result) => {
      expect((result as any).meta.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      done();
    });
  });
});
