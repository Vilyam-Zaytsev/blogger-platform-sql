import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { DomainException } from '../domain-exceptions';
import { ErrorResponseBody } from './types/error-response-body.type';
import { Request, Response } from 'express';
import { DomainExceptionsCodeMapper } from '../utils/domain-exceptions-code.mapper';

@Catch(DomainException)
export class DomainHttpExceptionsFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status: number = DomainExceptionsCodeMapper.mapToHttpStatus(exception.code);
    const responseBody: ErrorResponseBody = this.buildResponseBody(
      exception,
      request.url,
      request.method,
    );

    response.status(status).json(responseBody);
  }

  //TODO: create DTO for params
  private buildResponseBody(
    exception: DomainException,
    requestUrl: string,
    requestMethod: string,
  ): ErrorResponseBody {
    return {
      timestamp: new Date().toISOString(),
      path: requestUrl,
      method: requestMethod,
      message: exception.message,
      code: exception.code,
      extensions: exception.extensions,
    };
  }
}
