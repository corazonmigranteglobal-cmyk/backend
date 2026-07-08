import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, map, throwError } from 'rxjs';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { sanitizeForLog } from '../logging/log-sanitizer';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = request.headers['x-request-id'] ?? randomUUID();
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
        query: sanitizeForLog(request.query),
        params: sanitizeForLog(request.params),
        body: sanitizeForLog(request.body),
      }),
    );

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
    requestId: string | string[],
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
        response: sanitizeForLog(payload),
      }),
    );
  }
}
