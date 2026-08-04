import {
  PaginationQueryDto,
  buildPagination,
  buildSafeOrder,
  getEffectivePage,
  getEffectivePageSize,
  getEffectiveRoleFilter,
  getEffectiveSearch,
  getEffectiveStatusFilter,
  resolveSafeSort,
  toLimitOffset,
} from './pagination.dto';

const query = (values: Partial<PaginationQueryDto>) => values as PaginationQueryDto;

describe('resolución de alias de paginación', () => {
  it('prioriza el nombre canónico sobre los alias legacy', () => {
    expect(getEffectivePage(query({ page: 3, p_page: 9 }))).toBe(3);
    expect(getEffectivePageSize(query({ limit: 50, pageSize: 10, p_limit: 5 }))).toBe(50);
  });

  it('acepta los alias que usan los frontends legacy', () => {
    expect(getEffectivePage(query({ p_page: 4 }))).toBe(4);
    expect(getEffectivePageSize(query({ pageSize: 15 }))).toBe(15);
    expect(getEffectiveSearch(query({ q: 'ansiedad' }))).toBe('ansiedad');
    expect(getEffectiveStatusFilter(query({ p_estado: 'ACTIVE' }))).toBe('ACTIVE');
    expect(getEffectiveRoleFilter(query({ tipo_usuario: 'THERAPIST' }))).toBe('THERAPIST');
  });

  it('aplica los valores por defecto cuando no llega nada', () => {
    expect(getEffectivePage(query({}))).toBe(1);
    expect(getEffectivePageSize(query({}))).toBe(20);
    expect(getEffectiveSearch(query({}))).toBeUndefined();
    expect(getEffectiveStatusFilter(query({}))).toBeUndefined();
    expect(getEffectiveRoleFilter(query({}))).toBeUndefined();
  });
});

describe('toLimitOffset', () => {
  it('traduce página y tamaño a limit/offset', () => {
    expect(toLimitOffset(query({ page: 1, limit: 20 }))).toEqual({ limit: 20, offset: 0 });
    expect(toLimitOffset(query({ page: 3, limit: 25 }))).toEqual({ limit: 25, offset: 50 });
  });
});

describe('buildPagination', () => {
  it('calcula el total de páginas', () => {
    expect(buildPagination(query({ page: 2, limit: 20 }), 45)).toEqual({
      page: 2,
      pageSize: 20,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it('devuelve cero páginas cuando no hay resultados', () => {
    expect(buildPagination(query({}), 0).totalPages).toBe(0);
  });
});

describe('resolveSafeSort', () => {
  const allowed = { createdAt: 'created_at', name: 'name' };

  it('sólo permite columnas de la lista blanca', () => {
    expect(resolveSafeSort(query({ sort: 'name' }), allowed, 'createdAt')).toBe('name');
  });

  it('acepta la variante snake_case del alias', () => {
    // El frontend envía `created_at`; la lista blanca usa camelCase.
    expect(resolveSafeSort(query({ sort: 'created_at' }), allowed, 'createdAt')).toBe('created_at');
  });

  it('neutraliza un intento de inyección SQL cayendo al valor por defecto', () => {
    expect(resolveSafeSort(query({ sort: 'name; DROP TABLE users' }), allowed, 'createdAt')).toBe(
      'created_at',
    );
  });

  it('cae al valor por defecto con una columna desconocida', () => {
    expect(resolveSafeSort(query({ sort: 'inventada' }), allowed, 'createdAt')).toBe('created_at');
    expect(resolveSafeSort(query({}), allowed, 'createdAt')).toBe('created_at');
  });
});

describe('buildSafeOrder', () => {
  const allowed = { createdAt: 'created_at', name: 'name' };

  it('ordena descendente por defecto', () => {
    expect(buildSafeOrder(query({}), allowed)).toEqual([['created_at', 'DESC']]);
  });

  it('respeta la dirección ascendente', () => {
    expect(buildSafeOrder(query({ sort: 'name', order: 'asc' }), allowed)).toEqual([
      ['name', 'ASC'],
    ]);
    expect(buildSafeOrder(query({ sortDir: 'asc' }), allowed)).toEqual([['created_at', 'ASC']]);
  });

  it('cualquier dirección no reconocida se trata como descendente', () => {
    expect(buildSafeOrder(query({ order: 'lo-que-sea' } as never), allowed)).toEqual([
      ['created_at', 'DESC'],
    ]);
  });
});
