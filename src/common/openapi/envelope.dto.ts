import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Contrato de los sobres de respuesta que emite la API.
 *
 * Estas clases no se instancian en tiempo de ejecución: existen para que
 * `@nestjs/swagger` publique en el contrato la forma exacta que producen
 * `ResponseInterceptor` (éxito) y `HttpExceptionFilter` (error). Si alguno de
 * esos dos archivos cambia su salida, hay que cambiar estas clases en el mismo
 * commit; `scripts/check-openapi-coverage.mjs` no puede detectar esa deriva.
 *
 * @see src/common/interceptors/response.interceptor.ts
 * @see src/common/filters/http-exception.filter.ts
 */
export class ResponseMetaDto {
  @ApiProperty({
    format: 'uuid',
    example: '3f1c8a52-9d47-4a0b-8f21-6d5c0f1e2b7a',
    description:
      'Identificador de la petición. Se toma de la cabecera `X-Request-Id` cuando el cliente la envía y, si no, lo genera el servidor. Se devuelve también en la cabecera `X-Request-Id`.',
  })
  requestId!: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-08-03T19:45:12.345Z',
    description: 'Instante UTC en que el servidor serializó la respuesta.',
  })
  timestamp!: string;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Página devuelta. La numeración empieza en 1.' })
  page!: number;

  @ApiProperty({ example: 20, description: 'Número máximo de elementos por página.' })
  limit!: number;

  @ApiProperty({ example: 137, description: 'Total de elementos que cumplen el filtro.' })
  total!: number;

  @ApiProperty({ example: 7, description: 'Total de páginas disponibles con el `limit` actual.' })
  totalPages!: number;
}

export class ApiErrorDto {
  @ApiProperty({
    example: 'VALIDATION_ERROR',
    description:
      'Código estable y legible por máquina. Los clientes deben ramificar por este campo, nunca por `message`.',
  })
  code!: string;

  @ApiProperty({
    example: 'La solicitud contiene datos con un formato invalido.',
    description: 'Mensaje en español orientado a la persona usuaria final.',
  })
  message!: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description:
      'Detalles del fallo. En errores de validación contiene un elemento por campo rechazado con `field` y `constraints`; en el resto de errores puede venir vacío.',
    example: [{ field: 'email', constraints: { isEmail: 'email must be an email' } }],
  })
  details!: unknown[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: ApiErrorDto })
  error!: ApiErrorDto;

  @ApiProperty({ type: ResponseMetaDto })
  meta!: ResponseMetaDto;
}

/**
 * Sobre de éxito sin tipar. Sólo se usa como valor por defecto para operaciones
 * cuyo `data` aún no declara un esquema propio; el informe de cobertura
 * (`docs/reports/openapi-coverage.md`) las lista una a una.
 */
export class ApiSuccessResponseDto {
  @ApiPropertyOptional({
    description: 'Carga útil de la operación.',
    type: 'object',
    additionalProperties: true,
  })
  data?: unknown;

  @ApiPropertyOptional({
    type: PaginationMetaDto,
    description:
      'Presente únicamente en los listados paginados, es decir cuando el handler devuelve `{ items, pagination }`.',
  })
  pagination?: PaginationMetaDto;

  @ApiProperty({ type: ResponseMetaDto })
  meta!: ResponseMetaDto;
}
