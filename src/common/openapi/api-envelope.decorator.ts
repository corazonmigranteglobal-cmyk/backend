import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { PaginationMetaDto, ResponseMetaDto } from './envelope.dto';

/**
 * Tipos aceptados para describir el contenido de `data`.
 *
 * - Una clase decorada con `@ApiProperty` (lo habitual).
 * - Un `SchemaObject` en línea, para respuestas que no tienen DTO propio
 *   (por ejemplo `{ deleted: true }`).
 * - `'void'` para respuestas 204 y operaciones que no devuelven cuerpo.
 */
export type EnvelopeData = Type<unknown> | SchemaObject | 'void';

export interface ApiEnvelopeOptions {
  /** Código HTTP de la respuesta. Por defecto 200. */
  status?: number;
  /** Qué significa esta respuesta para quien la consume. Obligatoria. */
  description: string;
  /** `data` es un array del tipo indicado. */
  isArray?: boolean;
  /**
   * La respuesta es un listado paginado: añade `pagination` al sobre e implica
   * `isArray`. Corresponde a los handlers que devuelven `{ items, pagination }`.
   */
  paginated?: boolean;
}

function dataSchema(data: EnvelopeData, isArray: boolean): SchemaObject | undefined {
  if (data === 'void') return undefined;
  const base: SchemaObject =
    typeof data === 'function' ? ({ $ref: getSchemaPath(data) } as SchemaObject) : data;
  return isArray ? ({ type: 'array', items: base } as SchemaObject) : base;
}

/**
 * Declara una respuesta de éxito con el sobre real que emite
 * `ResponseInterceptor`: `{ data, meta }` y, en listados, `{ data, pagination, meta }`.
 *
 * Se usa en lugar de `@ApiOkResponse({ type: Dto })` porque el interceptor global
 * envuelve todo lo que devuelve el handler; documentar el DTO desnudo describiría
 * un cuerpo que la API nunca envía.
 *
 * @example
 * ＠ApiEnvelope(AppointmentDto, { description: 'Cita creada.', status: 201 })
 * ＠ApiEnvelope(AppointmentDto, { description: 'Listado de citas.', paginated: true })
 */
export function ApiEnvelope(data: EnvelopeData, options: ApiEnvelopeOptions) {
  const { status = 200, description, paginated = false } = options;
  const isArray = paginated || options.isArray === true;
  const schema = dataSchema(data, isArray);

  const properties: Record<string, SchemaObject> = {};
  if (schema) properties.data = schema;
  if (paginated) properties.pagination = { $ref: getSchemaPath(PaginationMetaDto) } as SchemaObject;
  properties.meta = { $ref: getSchemaPath(ResponseMetaDto) } as SchemaObject;

  const required = Object.keys(properties);

  const extraModels: Type<unknown>[] = [ResponseMetaDto];
  if (paginated) extraModels.push(PaginationMetaDto);
  if (typeof data === 'function') extraModels.push(data);

  return applyDecorators(
    ApiExtraModels(...extraModels),
    ApiResponse({
      status,
      description,
      schema: { type: 'object', properties, required } as SchemaObject,
    }),
  );
}

/**
 * Respuesta de éxito sin cuerpo (204). Nest devuelve 204 sin pasar por el
 * interceptor, así que aquí no hay sobre que documentar.
 */
export function ApiNoContent(description: string) {
  return ApiResponse({ status: 204, description });
}
