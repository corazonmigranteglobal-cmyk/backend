import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BaseError as SequelizeBaseError,
  DatabaseError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
} from 'sequelize';

interface NormalizedError {
  status: number;
  code: string;
  message: string;
  details: unknown[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const requestId = request.headers['x-request-id'] ?? randomUUID();

    const normalized = this.normalize(exception);

    if (normalized.status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${normalized.status}: ${
          exception instanceof Error ? exception.stack : String(exception)
        }`,
      );
    }

    response.status(normalized.status).json({
      error: { code: normalized.code, message: normalized.message, details: normalized.details },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const defaultCode = status === 500 ? 'INTERNAL_SERVER_ERROR' : `HTTP_${status}`;

      if (typeof exceptionResponse === 'string') {
        return { status, code: defaultCode, message: exceptionResponse, details: [] };
      }
      if (exceptionResponse && typeof exceptionResponse === 'object') {
        const obj = exceptionResponse as Record<string, any>;
        return {
          status,
          code: obj.code ?? defaultCode,
          message: obj.message ?? 'Ocurrió un error inesperado.',
          details: Array.isArray(obj.details)
            ? obj.details
            : Array.isArray(obj.message)
              ? obj.message
              : [],
        };
      }
      return { status, code: defaultCode, message: 'Ocurrió un error inesperado.', details: [] };
    }

    if (exception instanceof UniqueConstraintError) {
      const fields = Object.keys(exception.fields ?? {});
      return {
        status: HttpStatus.CONFLICT,
        code: 'RESOURCE_ALREADY_EXISTS',
        message: fields.length
          ? `Ya existe un registro con ese valor en: ${fields.join(', ')}.`
          : 'Ya existe un registro con esos datos.',
        details: fields,
      };
    }

    if (exception instanceof ForeignKeyConstraintError) {
      return {
        status: HttpStatus.CONFLICT,
        code: 'RESOURCE_REFERENCE_CONFLICT',
        message: 'La operación viola una referencia con otro recurso relacionado.',
        details: [],
      };
    }

    if (exception instanceof SequelizeValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'HTTP_400',
        message: 'Datos inválidos.',
        details: exception.errors.map((error) => error.message),
      };
    }

    if (exception instanceof DatabaseError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'HTTP_400',
        message: 'La solicitud contiene datos con un formato inválido.',
        details: [],
      };
    }

    if (exception instanceof SequelizeBaseError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Servicio temporalmente no disponible.',
        details: [],
      };
    }

    // Errores nativos de Node/Express (http-errors) como body-parser
    // (payload too large, JSON malformado) no son HttpException pero
    // ya traen un status HTTP válido.
    const httpErrorStatus = this.extractHttpErrorStatus(exception);
    if (httpErrorStatus) {
      const defaultCode = `HTTP_${httpErrorStatus}`;
      const message =
        exception instanceof Error && httpErrorStatus === HttpStatus.PAYLOAD_TOO_LARGE
          ? 'El cuerpo de la solicitud excede el tamaño máximo permitido.'
          : exception instanceof Error && httpErrorStatus === HttpStatus.BAD_REQUEST
            ? 'La solicitud contiene un cuerpo JSON inválido.'
            : 'Ocurrió un error al procesar la solicitud.';
      return { status: httpErrorStatus, code: defaultCode, message, details: [] };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error inesperado.',
      details: [],
    };
  }

  private extractHttpErrorStatus(exception: unknown): number | undefined {
    if (!exception || typeof exception !== 'object') return undefined;
    const candidate = exception as Record<string, unknown>;
    const status = candidate.status ?? candidate.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 600) {
      return status;
    }
    return undefined;
  }
}
