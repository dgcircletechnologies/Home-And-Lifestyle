import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
@Catch()
export class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const parserStatus = (error as { status?: number })?.status;
    const status = error instanceof HttpException ? error.getStatus() : parserStatus === 413 ? 413 : parserStatus === 400 ? 400 : 500;
    const detail = error instanceof HttpException ? error.getResponse() : undefined;
    const body = typeof detail === 'object' && detail ? detail as Record<string, unknown> : {};
    host.switchToHttp().getResponse<Response>().status(status).json({ error: {
      status, code: typeof body.code === 'string' ? body.code : status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED', message: status >= 500 ? 'Service temporarily unavailable.' : typeof detail === 'string' ? detail : body.message ?? 'Request failed.',
      ...(body.fields ? { fields: body.fields } : {}),
    } });
  }
}
