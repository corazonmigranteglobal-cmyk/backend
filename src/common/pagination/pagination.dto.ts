import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

function toOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

function toOptionalString(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function toOptionalLowerDirection(value: unknown) {
  const text = toOptionalString(value);
  return text ? text.toLowerCase() : undefined;
}

function toCamelCase(value: string) {
  return value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function sanitizeSortCandidate(value: unknown, fallbackSort: string) {
  return String(value || fallbackSort)
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '');
}

function firstString(...values: Array<unknown>) {
  for (const value of values) {
    const text = toOptionalString(value);
    if (text) return text;
  }
  return undefined;
}

export type SortDirection = 'ASC' | 'DESC';
export type SortAliasMap = Record<string, string>;

/**
 * DTO común para listados paginados.
 *
 * Importante:
 * - `ValidationPipe` corre con `whitelist` + `forbidNonWhitelisted`.
 * - Por eso aquí declaramos los aliases que ya existen en frontends legacy/admin.
 * - No abrimos la puerta a cualquier query: `debug`, `foo`, etc. siguen dando 400.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Página actual. Empieza en 1.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    name: 'p_page',
    example: 1,
    description:
      'Alias legacy aceptado por compatibilidad con frontends antiguos. Si page también llega, page tiene prioridad.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  p_page?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Cantidad de registros por página. Nombre histórico del frontend.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({
    example: 20,
    description:
      'Cantidad de registros por página. Nombre recomendado por contratos actuales.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    name: 'p_limit',
    example: 20,
    description:
      'Alias legacy aceptado para tamaño de página. Si limit o pageSize también llegan, limit/pageSize tienen prioridad.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  p_limit?: number;

  @ApiPropertyOptional({
    example: 'createdAt',
    description:
      'Campo de ordenamiento. Se aceptan aliases camelCase y snake_case conocidos; valores no permitidos se reemplazan por el default seguro del endpoint.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalString(value))
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    name: 'sortBy',
    example: 'created_at',
    description:
      'Alias usado por algunas tablas del frontend. sort tiene prioridad cuando ambos llegan.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalString(value))
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalLowerDirection(value))
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @ApiPropertyOptional({
    name: 'sortDir',
    example: 'desc',
    enum: ['asc', 'desc'],
    description:
      'Alias usado por algunas tablas del frontend. order tiene prioridad cuando ambos llegan.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalLowerDirection(value))
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @ApiPropertyOptional({ example: 'ansiedad' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    name: 'q',
    example: 'lucia',
    description: 'Alias corto para búsqueda. search tiene prioridad.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalString(value))
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    name: 'status',
    example: 'ACTIVE',
    description:
      'Filtro genérico de estado. En endpoints de usuarios también acepta activo/inactivo/pendiente/bloqueado.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalString(value))
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    name: 'estado',
    example: 'activo',
    description: 'Alias español para status. status tiene prioridad.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalString(value))
  @IsString()
  estado?: string;

  @ApiPropertyOptional({
    name: 'p_estado',
    example: 'activo',
    description: 'Alias legacy español para status. status/estado tienen prioridad.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalString(value))
  @IsString()
  p_estado?: string;

  @ApiPropertyOptional({
    name: 'role',
    example: 'THERAPIST',
    description:
      'Filtro genérico de rol para endpoints que lo soporten. En usuarios acepta THERAPIST/TERAPEUTA, PATIENT/PACIENTE, ACCOUNTANT/CONTADOR, etc.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalString(value))
  @IsString()
  role?: string;

  @ApiPropertyOptional({ name: 'rol', example: 'TERAPEUTA', description: 'Alias español para role.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalString(value))
  @IsString()
  rol?: string;

  @ApiPropertyOptional({
    name: 'p_rol',
    example: 'TERAPEUTA',
    description: 'Alias legacy español para role.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalString(value))
  @IsString()
  p_rol?: string;

  @ApiPropertyOptional({
    name: 'tipo_usuario',
    example: 'TERAPEUTA',
    description: 'Alias legacy para role/tipo de usuario.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalString(value))
  @IsString()
  tipo_usuario?: string;
}

export function getEffectivePage(query: PaginationQueryDto) {
  return query.page ?? query.p_page ?? 1;
}

export function getEffectivePageSize(query: PaginationQueryDto) {
  return query.limit ?? query.pageSize ?? query.p_limit ?? 20;
}

export function getEffectiveSearch(query: PaginationQueryDto) {
  return firstString(query.search, query.q);
}

export function getEffectiveStatusFilter(query: PaginationQueryDto) {
  return firstString(query.status, query.estado, query.p_estado);
}

export function getEffectiveRoleFilter(query: PaginationQueryDto) {
  return firstString(query.role, query.rol, query.p_rol, query.tipo_usuario);
}

export function toLimitOffset(query: PaginationQueryDto) {
  const page = getEffectivePage(query);
  const limit = getEffectivePageSize(query);
  const offset = (page - 1) * limit;
  return { limit, offset };
}

export function buildPagination(query: PaginationQueryDto, total: number) {
  const page = getEffectivePage(query);
  const pageSize = getEffectivePageSize(query);
  return {
    page,
    pageSize,
    limit: pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function resolveSafeSort(
  query: Pick<PaginationQueryDto, 'sort' | 'sortBy'>,
  allowedSorts: SortAliasMap,
  fallbackSort: string,
) {
  const requested = sanitizeSortCandidate(query.sort ?? query.sortBy, fallbackSort);
  const camelRequested = toCamelCase(requested);

  return (
    allowedSorts[requested] ?? allowedSorts[camelRequested] ?? allowedSorts[fallbackSort] ?? fallbackSort
  );
}

export function buildSafeOrder(
  query: PaginationQueryDto,
  allowedSorts: SortAliasMap,
  fallbackSort = 'createdAt',
): [string, SortDirection][] {
  const sort = resolveSafeSort(query, allowedSorts, fallbackSort);
  const rawDirection = query.order ?? query.sortDir ?? 'desc';
  const direction: SortDirection = rawDirection === 'asc' ? 'ASC' : 'DESC';
  return [[sort, direction]];
}
