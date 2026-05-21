import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from '../errors/domain.exceptions';

interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
  path: string;
  timestamp: string;
}

/**
 * Global exception filter. Produces a consistent error envelope so the
 * frontend never has to inspect type or shape variants.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as Request & { requestId?: string }).requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof DomainException) {
      status = exception.getStatus();
      const resp = exception.getResponse() as Record<string, unknown>;
      code = (resp.code as string) ?? code;
      message = (resp.message as string) ?? message;
      details = resp.details as Record<string, unknown> | undefined;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (typeof resp === 'object' && resp !== null) {
        const obj = resp as Record<string, unknown>;
        message = (obj.message as string) ?? message;
        code = (obj.error as string)?.toUpperCase().replace(/\s+/g, '_') ?? `HTTP_${status}`;
        if (Array.isArray(obj.message)) {
          // class-validator returns array of messages; surface as details.
          details = { validationErrors: obj.message };
          message = 'Validation failed';
          code = 'VALIDATION_FAILED';
        }
      }
    } else {
      // Unknown error — log full stack but do not leak to client.
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponse = {
      statusCode: status,
      code,
      message,
      details,
      requestId,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}
