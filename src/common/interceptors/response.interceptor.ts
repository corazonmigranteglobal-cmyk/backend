import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, map, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { resolveRequestId } from '../http/request-id';
import { sanitizeForLog } from '../logging/log-sanitizer';

/**
 * Los cuerpos de petición/respuesta llevan datos clínicos y personales
 * (perfiles de paciente, notas para el terapeuta, emails). Serializarlos en
 * cada request es además el mayor coste de CPU del pipeline en listados de
 * hasta 100 elementos, así que sólo se emiten cuando el nivel de log es debug.
 */
const VERBOSE_PAYLOAD_LOGGING = ['debug', 'trace'].includes(
  (process.env.LOG_LEVEL ?? 'info').toLowerCase(),
);

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = resolveRequestId(request.headers['x-request-id']);
    const startedAt = Date.now();
    const handler = context.getHandler();
    const controller = context.getClass();

    this.logger.log(
      JSON.stringify({
        event: 'HTTP_REQUEST_RECEIVED',
        requestId,
        method: request.method,
        url: request.originalUrl ?? request.url,
        controller: controller?.name,
        handler: handler?.name,
        ip: request.ip,
        ...(VERBOSE_PAYLOAD_LOGGING
          ? {
              query: sanitizeForLog(request.query),
              params: sanitizeForLog(request.params),
              body: sanitizeForLog(request.body),
            }
          : {}),
      }),
    );

    // Expose the request ID as a response header so clients can correlate errors.
    response.setHeader('X-Request-Id', requestId);

    return next.handle().pipe(
      map((value) => {
        if (value && typeof value === 'object' && (value as any).__raw === true) {
          const payload = (value as any).payload;
          this.logResponse(request, response, requestId, startedAt, payload);
          return payload;
        }

        let payload: unknown;
        if (
          value &&
          typeof value === 'object' &&
          'items' in (value as any) &&
          'pagination' in (value as any)
        ) {
          payload = {
            data: (value as any).items,
            pagination: (value as any).pagination,
            meta: { requestId, timestamp: new Date().toISOString() },
          };
        } else {
          payload = { data: value, meta: { requestId, timestamp: new Date().toISOString() } };
        }

        this.logResponse(request, response, requestId, startedAt, payload);
        return payload;
      }),
      catchError((error: unknown) => {
        this.logger.error(
          JSON.stringify({
            event: 'HTTP_REQUEST_FAILED',
            requestId,
            method: request.method,
            url: request.originalUrl ?? request.url,
            controller: controller?.name,
            handler: handler?.name,
            durationMs: Date.now() - startedAt,
            error: sanitizeForLog(error),
          }),
        );

        return throwError(() => error);
      }),
    );
  }

  private logResponse(
    request: Request,
    response: Response,
    requestId: string,
    startedAt: number,
    payload: unknown,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'HTTP_RESPONSE_SENT',
        requestId,
        method: request.method,
        url: request.originalUrl ?? request.url,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        ...(VERBOSE_PAYLOAD_LOGGING ? { response: sanitizeForLog(payload) } : {}),
      }),
    );
  }
}
