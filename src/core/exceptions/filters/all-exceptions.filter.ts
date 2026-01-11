import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponseBody } from './types/error-response-body.type';
import { DomainExceptionCode } from '../domain-exception-codes';

@Catch()
export class AllHttpExceptionsFilter implements ExceptionFilter {
  constructor(private readonly isSendInternalServerErrorDetails: boolean) {}

  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const message: string = exception.message || 'Unknown exception occurred.';
    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    if (exception instanceof HttpException) status = exception.getStatus();
    const responseBody: ErrorResponseBody = this.buildResponseBody(
      request.url,
      request.method,
      message,
    );

    console.error(exception.stack);

    response.status(status).json(responseBody);
  }

  private buildResponseBody(
    requestUrl: string,
    requestMethod: string,
    message: string,
  ): ErrorResponseBody {
    if (!this.isSendInternalServerErrorDetails) {
      return {
        timestamp: new Date().toISOString(),
        path: null,
        method: null,
        message: 'Some error occurred',
        extensions: [],
        code: DomainExceptionCode.InternalServerError,
      };
    }

    return {
      timestamp: new Date().toISOString(),
      path: requestUrl,
      method: requestMethod,
      message,
      extensions: [],
      code: DomainExceptionCode.InternalServerError,
    };
  }
}
