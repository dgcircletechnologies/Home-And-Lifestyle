import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
@Catch()
export class Errors implements ExceptionFilter {
  private readonly logger = new Logger(Errors.name);
  catch(error: unknown, host: ArgumentsHost) {
    const parserStatus = (error as { status?: number })?.status;
    const status = error instanceof HttpException ? error.getStatus() : (error as { code?: string })?.code === 'LIMIT_FILE_SIZE' || parserStatus === 413 ? 413 : parserStatus === 400 ? 400 : 500;
    const detail = error instanceof HttpException ? error.getResponse() : undefined;
    const body = typeof detail === 'object' && detail ? detail as Record<string, unknown> : {};
    const http = host.switchToHttp();
    if (status >= 500) {
      const request = http.getRequest<Request>();
      const cause = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`${request.method} ${request.path} failed: ${cause.message}`, cause.stack);
    }
    http.getResponse<Response>().status(status).json({ error: {
      status, code: typeof body.code === 'string' ? body.code : (error as { code?: string })?.code === 'LIMIT_FILE_SIZE' ? 'IMAGE_TOO_LARGE' : status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED', message: status >= 500 ? 'Service temporarily unavailable.' : typeof detail === 'string' ? detail : body.message ?? ((error as { code?: string })?.code === 'LIMIT_FILE_SIZE' ? 'Category image is too large.' : 'Request failed.'),
      ...(body.fields ? { fields: body.fields } : {}),
    } });
  }
}
